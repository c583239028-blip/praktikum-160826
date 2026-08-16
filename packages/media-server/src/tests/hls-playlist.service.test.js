import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// lib/prisma.js constructs a real PrismaClient at import time, which throws
// in any environment where `prisma generate` hasn't run (e.g. a fresh CI
// checkout). Every test in this suite injects its own stub via
// HlsPlaylistService.setPrismaClient() anyway, so the real client is never
// used — mock it purely to make the import safe.
vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn().mockImplementation(() => ({})),
}));

import { HlsPlaylistService } from '../services/hls-playlist.service.js';

const STREAM_ID = 'stream-123';
const SEGMENT_DURATION_MS = 2000;

const createSourceManifest = (segmentCount) => {
  const segmentLines = [];

  for (let index = 0; index < segmentCount; index += 1) {
    segmentLines.push(
      '#EXTINF:2.000000,',
      `segment_${String(index).padStart(9, '0')}.ts`
    );
  }

  return [
    '#EXTM3U',
    '#EXT-X-VERSION:3',
    '#EXT-X-TARGETDURATION:2',
    '#EXT-X-MEDIA-SEQUENCE:0',
    '#EXT-X-PLAYLIST-TYPE:EVENT',
    ...segmentLines,
    '',
  ].join('\n');
};

const readPublicManifest = (streamPath) =>
  fs.readFileSync(path.join(streamPath, 'index.m3u8'), 'utf8');

const writeSourceManifest = (streamPath, segmentCount) => {
  fs.writeFileSync(
    path.join(streamPath, 'source.m3u8'),
    createSourceManifest(segmentCount),
    'utf8'
  );
};

const writeSourceManifestContent = (streamPath, content) => {
  fs.writeFileSync(path.join(streamPath, 'source.m3u8'), content, 'utf8');
};

/**
 * Stand-in for the Stream record that SCRUM-172 (D2) maintains, plus helpers
 * that mimic D2's exact write behaviour on freeze and resume.
 */
const createStreamRecordStub = () => {
  const record = {
    status: 'LIVE',
    lastPausedAt: null,
    accumulatedPauseMs: 0,
  };

  return {
    record,
    prisma: {
      stream: {
        findUnique: vi.fn(async () => ({ ...record })),
      },
    },
    // D2 freeze: status = PAUSE, lastPausedAt = now
    freeze() {
      record.status = 'PAUSE';
      record.lastPausedAt = new Date();
    },
    // D2 resume: accumulatedPauseMs += elapsed, status = LIVE
    resume() {
      record.accumulatedPauseMs += Date.now() - record.lastPausedAt.getTime();
      record.status = 'LIVE';
      record.lastPausedAt = null;
    },
  };
};

describe('HlsPlaylistService — DB-driven catch-up buffer', () => {
  let streamPath;
  let stub;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-20T00:00:00Z'));

    streamPath = fs.mkdtempSync(
      path.join(os.tmpdir(), 'hls-playlist-service-')
    );

    stub = createStreamRecordStub();
    HlsPlaylistService.setPrismaClient(stub.prisma);
  });

  afterEach(() => {
    HlsPlaylistService.teardown(STREAM_ID);
    vi.useRealTimers();
    fs.rmSync(streamPath, { recursive: true, force: true });
  });

  it('publishes a live playlist when the stream was never paused', async () => {
    writeSourceManifest(streamPath, 3);

    HlsPlaylistService.initialize(STREAM_ID, streamPath);
    await HlsPlaylistService.sync(STREAM_ID);

    const manifest = readPublicManifest(streamPath);

    expect(manifest).toContain('#EXT-X-MEDIA-SEQUENCE:0');
    expect(manifest).toContain('segment_000000002.ts');
  });

  it('exposes only the configured public playlist window', async () => {
    writeSourceManifest(streamPath, 10);

    HlsPlaylistService.initialize(STREAM_ID, streamPath);
    await HlsPlaylistService.sync(STREAM_ID);

    const manifest = readPublicManifest(streamPath);

    expect(manifest).toContain('#EXT-X-MEDIA-SEQUENCE:4');
    expect(manifest).not.toContain('segment_000000003.ts');
    expect(manifest).toContain('segment_000000009.ts');
  });

  it('holds the viewing position while the DB reports the stream paused', async () => {
    writeSourceManifest(streamPath, 6);

    HlsPlaylistService.initialize(STREAM_ID, streamPath);
    await HlsPlaylistService.sync(STREAM_ID);

    // D2 opens a question -> freeze written to the DB.
    stub.freeze();

    // The encoder keeps producing while the question is open.
    vi.advanceTimersByTime(4 * SEGMENT_DURATION_MS);
    writeSourceManifest(streamPath, 10);
    await HlsPlaylistService.sync(STREAM_ID);

    const manifest = readPublicManifest(streamPath);

    // Viewer is still parked on the pre-freeze position.
    expect(manifest).toContain('segment_000000005.ts');
    expect(manifest).not.toContain('segment_000000006.ts');
    expect(manifest).not.toContain('segment_000000009.ts');
  });

  it('continues from the frozen position after resume instead of jumping to live', async () => {
    writeSourceManifest(streamPath, 6);

    HlsPlaylistService.initialize(STREAM_ID, streamPath);
    await HlsPlaylistService.sync(STREAM_ID);

    stub.freeze();

    vi.advanceTimersByTime(4 * SEGMENT_DURATION_MS);
    writeSourceManifest(streamPath, 10);
    await HlsPlaylistService.sync(STREAM_ID);

    // Question time is up -> D2 resumes.
    stub.resume();

    // Two more segments are produced after the resume.
    vi.advanceTimersByTime(2 * SEGMENT_DURATION_MS);
    writeSourceManifest(streamPath, 12);
    await HlsPlaylistService.sync(STREAM_ID);

    const manifest = readPublicManifest(streamPath);

    // Source is at segment 11, but the viewer advanced only by the two
    // segments produced since resume — from 5 to 7, not to live.
    expect(manifest).toContain('segment_000000007.ts');
    expect(manifest).not.toContain('segment_000000008.ts');
    expect(manifest).not.toContain('segment_000000011.ts');
  });

  it('accumulates lag across multiple freeze and resume cycles', async () => {
    writeSourceManifest(streamPath, 6);
    HlsPlaylistService.initialize(STREAM_ID, streamPath);

    // Cycle 1: freeze for 2 segments' worth of wall clock.
    stub.freeze();
    vi.advanceTimersByTime(2 * SEGMENT_DURATION_MS);
    writeSourceManifest(streamPath, 8);
    stub.resume();

    // Cycle 2: freeze for 3 segments' worth.
    stub.freeze();
    vi.advanceTimersByTime(3 * SEGMENT_DURATION_MS);
    writeSourceManifest(streamPath, 11);
    stub.resume();

    // Two more live segments.
    vi.advanceTimersByTime(2 * SEGMENT_DURATION_MS);
    writeSourceManifest(streamPath, 13);
    await HlsPlaylistService.sync(STREAM_ID);

    const manifest = readPublicManifest(streamPath);

    // Total lag is 5 segments; source has 13, so the viewer sits at 8.
    expect(manifest).toContain('segment_000000007.ts');
    expect(manifest).not.toContain('segment_000000008.ts');
    expect(manifest).not.toContain('segment_000000012.ts');
  });

  it('serves the frozen manifest to a viewer joining mid-freeze (AC6)', async () => {
    writeSourceManifest(streamPath, 6);
    HlsPlaylistService.initialize(STREAM_ID, streamPath);

    stub.freeze();
    vi.advanceTimersByTime(3 * SEGMENT_DURATION_MS);
    writeSourceManifest(streamPath, 9);

    // A late joiner triggers no special path — they simply fetch whatever
    // the periodic sync last wrote.
    await HlsPlaylistService.sync(STREAM_ID);

    const manifest = readPublicManifest(streamPath);

    expect(manifest).toContain('segment_000000005.ts');
    expect(manifest).not.toContain('segment_000000008.ts');
  });

  it('holds the last known position when the database read fails', async () => {
    writeSourceManifest(streamPath, 6);
    HlsPlaylistService.initialize(STREAM_ID, streamPath);

    stub.freeze();
    vi.advanceTimersByTime(2 * SEGMENT_DURATION_MS);
    writeSourceManifest(streamPath, 8);
    await HlsPlaylistService.sync(STREAM_ID);

    const manifestBeforeFailure = readPublicManifest(streamPath);

    // Database becomes unreachable; the viewer must not snap to live.
    stub.prisma.stream.findUnique.mockRejectedValueOnce(
      new Error('connection lost')
    );

    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    vi.advanceTimersByTime(2 * SEGMENT_DURATION_MS);
    writeSourceManifest(streamPath, 10);
    await HlsPlaylistService.sync(STREAM_ID);

    consoleErrorSpy.mockRestore();

    expect(readPublicManifest(streamPath)).toBe(manifestBeforeFailure);
  });

  it('preserves discontinuity tags in the public manifest', async () => {
    writeSourceManifestContent(
      streamPath,
      [
        '#EXTM3U',
        '#EXT-X-VERSION:3',
        '#EXT-X-TARGETDURATION:2',
        '#EXT-X-MEDIA-SEQUENCE:0',
        '#EXTINF:2.000000,',
        'segment_000000000.ts',
        '#EXTINF:2.000000,',
        'segment_000000001.ts',
        '#EXT-X-DISCONTINUITY',
        '#EXTINF:2.000000,',
        'segment_000000002.ts',
        '',
      ].join('\n')
    );

    HlsPlaylistService.initialize(STREAM_ID, streamPath);
    await HlsPlaylistService.sync(STREAM_ID);

    expect(readPublicManifest(streamPath)).toContain(
      ['#EXT-X-DISCONTINUITY', '#EXTINF:2,', 'segment_000000002.ts'].join('\n')
    );
  });

  it('does nothing when the source manifest does not exist yet', async () => {
    HlsPlaylistService.initialize(STREAM_ID, streamPath);

    await expect(HlsPlaylistService.sync(STREAM_ID)).resolves.toBeUndefined();
    expect(fs.existsSync(path.join(streamPath, 'index.m3u8'))).toBe(false);
    expect(stub.prisma.stream.findUnique).not.toHaveBeenCalled();
  });

  it('does not create duplicate synchronization timers', () => {
    const setIntervalSpy = vi.spyOn(global, 'setInterval');

    writeSourceManifest(streamPath, 2);

    HlsPlaylistService.initialize(STREAM_ID, streamPath);
    HlsPlaylistService.startSync(STREAM_ID);
    HlsPlaylistService.startSync(STREAM_ID);

    expect(setIntervalSpy).toHaveBeenCalledTimes(1);

    setIntervalSpy.mockRestore();
  });

  it('stops periodic synchronization during teardown', async () => {
    writeSourceManifest(streamPath, 2);

    HlsPlaylistService.initialize(STREAM_ID, streamPath);
    HlsPlaylistService.startSync(STREAM_ID);
    await vi.advanceTimersByTimeAsync(0);

    const manifestBeforeTeardown = readPublicManifest(streamPath);

    HlsPlaylistService.teardown(STREAM_ID);

    writeSourceManifest(streamPath, 3);
    await vi.advanceTimersByTimeAsync(2000);

    expect(readPublicManifest(streamPath)).toBe(manifestBeforeTeardown);
  });
});
