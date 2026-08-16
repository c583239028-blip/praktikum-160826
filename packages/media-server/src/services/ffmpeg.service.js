import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { HLS_OUTPUT_CONFIG } from '../constants/hls.js';
import { MODERATOR_ROLE } from '../constants/roles.js';
import { logger } from '../utils/logger.js';

const LOCAL_RTP_IP = '127.0.0.1';

const VIDEO_PAYLOAD_TYPE = 101;
const AUDIO_PAYLOAD_TYPE = 111;

const VIDEO_KEYFRAME_INTERVAL = 15;
const AUDIO_SAMPLE_RATE = 44100;
const AUDIO_CHANNELS = 2;
const AUDIO_BITRATE = '128k';

const VIDEO_TILE_WIDTH = 640;
const VIDEO_TILE_HEIGHT = 360;
const MIN_GRID_VIDEO_INPUTS = 1;
const MAX_GRID_VIDEO_INPUTS = 4;
const SINGLE_VIDEO_INPUT = 1;

const MODERATOR_TILE_WIDTH = 320;
const MODERATOR_TILE_HEIGHT = 180;
const MODERATOR_OVERLAY_MARGIN = 24;

const SINGLE_AUDIO_INPUT = 1;
const AUDIO_MIX_DURATION = 'longest';
const AUDIO_MIX_DROPOUT_TRANSITION = 2;

const GRID_LAYOUTS = {
  2: '0_0|640_0',
  3: '0_0|640_0|0_360',
  4: '0_0|640_0|0_360|640_360',
};

// Re-exported so existing consumers (integration tests) that import this
// from ffmpeg.service.js keep working. The values themselves live in
// constants/hls.js — see that file for why.
export { HLS_OUTPUT_CONFIG };

const createUnifiedSDP = ({ streamPath, activeInputs }) => {
  let sdp = `v=0
o=- 0 0 IN IP4 ${LOCAL_RTP_IP}
s=Mediasoup
c=IN IP4 ${LOCAL_RTP_IP}
t=0 0
`;

  for (const input of activeInputs) {
    if (input.kind === 'video') {
      sdp += `m=video ${input.port} RTP/AVP ${VIDEO_PAYLOAD_TYPE}
a=rtpmap:${VIDEO_PAYLOAD_TYPE} VP8/90000
a=rtcp-mux
`;
    }

    if (input.kind === 'audio') {
      sdp += `m=audio ${input.port} RTP/AVP ${AUDIO_PAYLOAD_TYPE}
a=rtpmap:${AUDIO_PAYLOAD_TYPE} opus/48000/2
a=rtcp-mux
`;
    }
  }

  const sdpPath = path.join(streamPath, 'input.sdp');

  fs.writeFileSync(sdpPath, sdp);

  return sdpPath;
};

const buildVideoFilter = (videoStreamIndexes) => {
  const videoInputsCount = videoStreamIndexes.length;

  if (
    videoInputsCount < MIN_GRID_VIDEO_INPUTS ||
    videoInputsCount > MAX_GRID_VIDEO_INPUTS
  ) {
    throw new Error(
      `Video grid supports between ${MIN_GRID_VIDEO_INPUTS} and ` +
        `${MAX_GRID_VIDEO_INPUTS} inputs. Received: ${videoInputsCount}`
    );
  }

  if (videoInputsCount === SINGLE_VIDEO_INPUT) {
    return {
      filter: null,
      outputLabel: `0:v:${videoStreamIndexes[0]}`,
    };
  }

  const scaledInputs = videoStreamIndexes.map(
    (streamIndex, tileIndex) =>
      `[0:v:${streamIndex}]` +
      `scale=${VIDEO_TILE_WIDTH}:${VIDEO_TILE_HEIGHT},` +
      `setpts=PTS-STARTPTS[v${tileIndex}]`
  );

  const stackInputs = videoStreamIndexes
    .map((_, tileIndex) => `[v${tileIndex}]`)
    .join('');

  return {
    filter:
      `${scaledInputs.join(';')};` +
      `${stackInputs}xstack=inputs=${videoInputsCount}:` +
      `layout=${GRID_LAYOUTS[videoInputsCount]}[videoOut]`,
    outputLabel: '[videoOut]',
  };
};

const buildModeratorOverlay = ({
  baseVideoOutputLabel,
  moderatorStreamIndex,
}) => {
  if (moderatorStreamIndex === null) {
    return {
      filter: null,
      outputLabel: baseVideoOutputLabel,
    };
  }

  const baseVideoInput = baseVideoOutputLabel.startsWith('[')
    ? baseVideoOutputLabel
    : `[${baseVideoOutputLabel}]`;

  return {
    filter:
      `[0:v:${moderatorStreamIndex}]` +
      `scale=${MODERATOR_TILE_WIDTH}:${MODERATOR_TILE_HEIGHT},` +
      `setpts=PTS-STARTPTS[moderatorTile];` +
      `${baseVideoInput}[moderatorTile]` +
      `overlay=` +
      `main_w-overlay_w-${MODERATOR_OVERLAY_MARGIN}:` +
      `main_h-overlay_h-${MODERATOR_OVERLAY_MARGIN}` +
      `[compositeVideo]`,
    outputLabel: '[compositeVideo]',
  };
};

const buildAudioFilter = (audioInputsCount) => {
  if (audioInputsCount === 0) {
    return {
      filter: null,
      outputLabel: null,
    };
  }

  if (audioInputsCount === SINGLE_AUDIO_INPUT) {
    return {
      filter: null,
      outputLabel: '0:a:0',
    };
  }

  const audioStreams = Array.from(
    { length: audioInputsCount },
    (_, index) => `[0:a:${index}]`
  ).join('');

  return {
    filter:
      `${audioStreams}amix=inputs=${audioInputsCount}:` +
      `duration=${AUDIO_MIX_DURATION}:` +
      `dropout_transition=${AUDIO_MIX_DROPOUT_TRANSITION}` +
      `[audioOut]`,
    outputLabel: '[audioOut]',
  };
};

const buildFFmpegArgs = ({ sdpPath, streamPath, activeInputs }) => {
  const videoInputs = activeInputs.filter((input) => input.kind === 'video');

  const indexedVideoInputs = videoInputs.map((input, streamIndex) => ({
    role: input.role,
    streamIndex,
  }));

  const mainVideoStreamIndexes = indexedVideoInputs
    .filter((input) => input.role !== MODERATOR_ROLE)
    .map((input) => input.streamIndex);

  const moderatorVideoInput = indexedVideoInputs.find(
    (input) => input.role === MODERATOR_ROLE
  );

  const { filter: gridFilter, outputLabel: gridOutputLabel } = buildVideoFilter(
    mainVideoStreamIndexes
  );

  const { filter: moderatorOverlayFilter, outputLabel: finalVideoOutputLabel } =
    buildModeratorOverlay({
      baseVideoOutputLabel: gridOutputLabel,
      moderatorStreamIndex: moderatorVideoInput?.streamIndex ?? null,
    });

  const audioInputsCount = activeInputs.filter(
    (input) => input.kind === 'audio'
  ).length;

  const { filter: audioFilter, outputLabel: audioOutputLabel } =
    buildAudioFilter(audioInputsCount);

  const segmentFilename = path.join(
    streamPath,
    HLS_OUTPUT_CONFIG.segmentFilenamePattern
  );

  const sourceManifestPath = path.join(
    streamPath,
    HLS_OUTPUT_CONFIG.sourceManifestFilename
  );

  const args = [
    '-loglevel',
    'info',
    '-protocol_whitelist',
    'rtp,udp,file,crypto,data,pipe',
    '-fflags',
    '+genpts+discardcorrupt+nobuffer',
    '-probesize',
    '32',
    '-analyzeduration',
    '0',
    '-f',
    'sdp',
    '-i',
    sdpPath,
  ];

  const filters = [gridFilter, moderatorOverlayFilter, audioFilter].filter(
    Boolean
  );

  if (filters.length > 0) {
    args.push('-filter_complex', filters.join(';'));
  }

  args.push('-map', finalVideoOutputLabel);

  if (audioOutputLabel) {
    args.push('-map', audioOutputLabel);
  }

  args.push(
    '-c:v',
    'libx264',
    '-preset',
    'ultrafast',
    '-tune',
    'zerolatency',
    '-pix_fmt',
    'yuv420p',
    '-g',
    String(VIDEO_KEYFRAME_INTERVAL),
    '-keyint_min',
    String(VIDEO_KEYFRAME_INTERVAL),
    '-sc_threshold',
    '0',
    '-c:a',
    'aac',
    '-ar',
    String(AUDIO_SAMPLE_RATE),
    '-ac',
    String(AUDIO_CHANNELS),
    '-b:a',
    AUDIO_BITRATE,
    '-f',
    'hls',
    '-hls_time',
    String(HLS_OUTPUT_CONFIG.segmentDurationSeconds),
    '-hls_list_size',
    '0',
    '-hls_flags',
    HLS_OUTPUT_CONFIG.hlsFlags,
    '-hls_segment_filename',
    segmentFilename,
    sourceManifestPath
  );

  return args;
};

export class FFmpegService {
  constructor({ streamId, streamPath }) {
    this.streamId = streamId;
    this.streamPath = streamPath;
    this.process = null;
  }

  isRunning() {
    return Boolean(this.process);
  }

  start(activeInputs, onClose) {
    if (this.process) {
      return this.process;
    }

    const hasAudio = activeInputs.some((input) => input.kind === 'audio');

    const sdpPath = createUnifiedSDP({
      streamPath: this.streamPath,
      activeInputs,
    });

    const args = buildFFmpegArgs({
      sdpPath,
      streamPath: this.streamPath,
      activeInputs,
    });

    logger.info(
      `Spawning FFmpeg process for stream: ${this.streamId} (Audio: ${hasAudio})`
    );

    this.process = spawn('ffmpeg', args, {
      stdio: ['pipe', 'inherit', 'inherit'],
    });

    this.process.on('error', (error) => {
      logger.error(`FFmpeg error [${this.streamId}]: ${error.message}`);
    });

    this.process.on('close', (code) => {
      logger.info(
        `FFmpeg process for ${this.streamId} closed with code ${code}`
      );

      this.process = null;
      onClose?.(code);
    });

    return this.process;
  }

  stop() {
    if (!this.process) {
      return;
    }

    this.process.kill('SIGKILL');
  }
}
