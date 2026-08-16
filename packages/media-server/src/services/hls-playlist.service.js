import fs from 'fs';
import path from 'path';
import prisma from '../lib/prisma.js';
import { HLS_OUTPUT_CONFIG } from '../constants/hls.js';
import { logger } from '../utils/logger.js';

const SOURCE_MANIFEST_FILENAME = HLS_OUTPUT_CONFIG.sourceManifestFilename;
const PUBLIC_MANIFEST_FILENAME = 'index.m3u8';
const TEMP_MANIFEST_SUFFIX = '.tmp';

const HLS_SYNC_INTERVAL_MS = 1000;
const PUBLIC_PLAYLIST_SEGMENT_COUNT = 6;

const DEFAULT_MEDIA_SEQUENCE = 0;
const DEFAULT_TARGET_DURATION_SECONDS = 1;

const PAUSED_STREAM_STATUS = 'PAUSE';

const hlsStates = new Map();

// Defaults to the shared media-server Prisma client; overridable so tests
// can supply a stub instead of a live database.
let prismaClient = prisma;

const getPrismaClient = () => prismaClient;

const createState = (streamPath) => ({
  streamPath,
  // Last Stream record successfully read from the database. Kept so a
  // transient database error can be ridden out by recomputing the lag from
  // the last known pause state — which keeps growing correctly if that state
  // was "paused" — instead of snapping the viewer to live.
  lastKnownStreamRecord: null,
  syncTimer: null,
  isSyncing: false,
});

const parseTagInteger = (line) =>
  Number.parseInt(line.slice(line.indexOf(':') + 1), 10);

const parseDurationSeconds = (line) => {
  const value = line.slice('#EXTINF:'.length).split(',')[0];

  return Number.parseFloat(value);
};

const parsePlaylist = (content) => {
  const lines = content.split(/\r?\n/);
  const segments = [];

  let mediaSequence = DEFAULT_MEDIA_SEQUENCE;
  let targetDuration = DEFAULT_TARGET_DURATION_SECONDS;
  let pendingDurationSeconds = null;
  let pendingDiscontinuity = false;

  for (const line of lines) {
    if (line.startsWith('#EXT-X-MEDIA-SEQUENCE:')) {
      mediaSequence = parseTagInteger(line);
      continue;
    }

    if (line.startsWith('#EXT-X-TARGETDURATION:')) {
      targetDuration = parseTagInteger(line);
      continue;
    }

    if (line === '#EXT-X-DISCONTINUITY') {
      pendingDiscontinuity = true;
      continue;
    }

    if (line.startsWith('#EXTINF:')) {
      pendingDurationSeconds = parseDurationSeconds(line);
      continue;
    }

    if (
      pendingDurationSeconds !== null &&
      line.length > 0 &&
      !line.startsWith('#')
    ) {
      segments.push({
        durationMs: pendingDurationSeconds * 1000,
        extinfLine: `#EXTINF:${pendingDurationSeconds},`,
        uri: line,
        hasDiscontinuity: pendingDiscontinuity,
      });

      pendingDiscontinuity = false;
      pendingDurationSeconds = null;
    }
  }

  return {
    mediaSequence,
    targetDuration,
    segments,
  };
};

const calculateTotalDurationMs = (segments) =>
  segments.reduce((total, segment) => total + segment.durationMs, 0);

const selectPublicWindow = (segments, visibleDurationMs) => {
  let elapsedMs = 0;
  let visibleEndIndex = -1;

  for (let index = 0; index < segments.length; index += 1) {
    const nextElapsedMs = elapsedMs + segments[index].durationMs;

    if (nextElapsedMs > visibleDurationMs) {
      break;
    }

    elapsedMs = nextElapsedMs;
    visibleEndIndex = index;
  }

  if (visibleEndIndex < 0) {
    return {
      firstSegmentIndex: 0,
      segments: [],
    };
  }

  const firstSegmentIndex = Math.max(
    0,
    visibleEndIndex - PUBLIC_PLAYLIST_SEGMENT_COUNT + 1
  );

  return {
    firstSegmentIndex,
    segments: segments.slice(firstSegmentIndex, visibleEndIndex + 1),
  };
};

const buildPublicPlaylist = ({ targetDuration, mediaSequence, segments }) => {
  const segmentLines = segments.flatMap((segment) => {
    const lines = [];

    if (segment.hasDiscontinuity) {
      lines.push('#EXT-X-DISCONTINUITY');
    }

    lines.push(segment.extinfLine, segment.uri);

    return lines;
  });

  return [
    '#EXTM3U',
    '#EXT-X-VERSION:3',
    `#EXT-X-TARGETDURATION:${targetDuration}`,
    `#EXT-X-MEDIA-SEQUENCE:${mediaSequence}`,
    '#EXT-X-PLAYLIST-TYPE:EVENT',
    ...segmentLines,
    '',
  ].join('\n');
};

const writePublicManifest = (state, playlist) => {
  const publicManifestPath = path.join(
    state.streamPath,
    PUBLIC_MANIFEST_FILENAME
  );
  const temporaryManifestPath = publicManifestPath + TEMP_MANIFEST_SUFFIX;

  // Replace atomically so HLS clients never read a partially written manifest.
  fs.writeFileSync(temporaryManifestPath, playlist, 'utf8');
  fs.renameSync(temporaryManifestPath, publicManifestPath);
};

const readSourcePlaylist = (state) => {
  const sourceManifestPath = path.join(
    state.streamPath,
    SOURCE_MANIFEST_FILENAME
  );

  if (!fs.existsSync(sourceManifestPath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(sourceManifestPath, 'utf8');

    return parsePlaylist(content);
  } catch (error) {
    logger.error(`Failed to read HLS source manifest: ${error.message}`);

    return null;
  }
};

/**
 * The viewer's lag behind live, derived entirely from the Stream record that
 * SCRUM-172 (D2) maintains:
 *
 *   lag = accumulatedPauseMs + (currently paused ? now - lastPausedAt : 0)
 *
 * While the stream is paused the open-pause term grows at wall-clock rate —
 * exactly the rate at which the source playlist grows — so the visible
 * position stays put on its own. No freeze/resume call is needed, and the
 * transition to LIVE is seamless because D2 folds the same elapsed time into
 * accumulatedPauseMs at that moment.
 */
const calculateLagMs = (streamRecord, nowMs) => {
  const accumulatedPauseMs = streamRecord.accumulatedPauseMs ?? 0;

  const isPaused =
    streamRecord.status === PAUSED_STREAM_STATUS && streamRecord.lastPausedAt;

  if (!isPaused) {
    return Math.max(0, accumulatedPauseMs);
  }

  const openPauseMs = nowMs - new Date(streamRecord.lastPausedAt).getTime();

  return Math.max(0, accumulatedPauseMs + Math.max(0, openPauseMs));
};

const fallbackLagMs = (state, nowMs) =>
  state.lastKnownStreamRecord
    ? calculateLagMs(state.lastKnownStreamRecord, nowMs)
    : 0;

const readLagMs = async (streamId, state) => {
  const nowMs = Date.now();

  try {
    const streamRecord = await getPrismaClient().stream.findUnique({
      where: { id: streamId },
      select: {
        status: true,
        lastPausedAt: true,
        accumulatedPauseMs: true,
      },
    });

    if (!streamRecord) {
      return fallbackLagMs(state, nowMs);
    }

    state.lastKnownStreamRecord = streamRecord;

    return calculateLagMs(streamRecord, nowMs);
  } catch (error) {
    logger.error(
      `Failed to read stream pause state [${streamId}]: ${error.message}`
    );

    return fallbackLagMs(state, nowMs);
  }
};

const syncPublicManifest = async (streamId, state) => {
  const sourcePlaylist = readSourcePlaylist(state);

  if (!sourcePlaylist || sourcePlaylist.segments.length === 0) {
    return;
  }

  const lagMs = await readLagMs(streamId, state);

  const totalDurationMs = calculateTotalDurationMs(sourcePlaylist.segments);
  const visibleDurationMs = Math.max(0, totalDurationMs - lagMs);

  const publicWindow = selectPublicWindow(
    sourcePlaylist.segments,
    visibleDurationMs
  );

  if (publicWindow.segments.length === 0) {
    return;
  }

  const publicPlaylist = buildPublicPlaylist({
    targetDuration: sourcePlaylist.targetDuration,
    mediaSequence:
      sourcePlaylist.mediaSequence + publicWindow.firstSegmentIndex,
    segments: publicWindow.segments,
  });

  writePublicManifest(state, publicPlaylist);
};

export const HlsPlaylistService = {
  /**
   * Test seam — inject a stub Prisma client. Production code never calls this.
   */
  setPrismaClient(client) {
    prismaClient = client;
  },

  initialize(streamId, streamPath) {
    if (hlsStates.has(streamId)) {
      return;
    }

    hlsStates.set(streamId, createState(streamPath));
  },

  async sync(streamId) {
    const state = hlsStates.get(streamId);

    if (!state) {
      return;
    }

    await syncPublicManifest(streamId, state);
  },

  startSync(streamId) {
    const state = hlsStates.get(streamId);

    if (!state || state.syncTimer) {
      return;
    }

    const runSync = async () => {
      // Skip if the previous tick is still awaiting the database, so a slow
      // read can never stack up overlapping manifest writes.
      if (state.isSyncing) {
        return;
      }

      state.isSyncing = true;

      try {
        await syncPublicManifest(streamId, state);
      } finally {
        state.isSyncing = false;
      }
    };

    runSync();

    state.syncTimer = setInterval(runSync, HLS_SYNC_INTERVAL_MS);
  },

  stopSync(streamId) {
    const state = hlsStates.get(streamId);

    if (!state?.syncTimer) {
      return;
    }

    clearInterval(state.syncTimer);
    state.syncTimer = null;
  },

  teardown(streamId) {
    this.stopSync(streamId);
    hlsStates.delete(streamId);
  },
};
