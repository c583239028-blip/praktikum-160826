/**
 * stream.service.js (media-server)
 *
 * מנהל את מחזור החיים של מקורות המדיה בכל שידור.
 * יוצר PlainTransports ו-Consumers, מקצה פורטי RTP,
 * שומר את מקורות המשתתפים ומתאם הפעלה ועצירה של FFmpeg.
 *
 * זרימת עבודה:
 *   1. startRecording(video) → שומר input וממתין לאודיו
 *   2. startRecording(audio) → שומר input ומנסה להפעיל FFmpeg
 *   3. stopRecording         → עוצר FFmpeg ומנקה את כל משאבי המדיה
 *
 * תלוי ב:
 *   mediasoup.service.js
 *   port-pool.service.js
 *   ffmpeg.service.js
 *
 * משמש את:
 *   socket handlers בשרת המדיה
 */

import path from 'path';
import fs from 'fs';
import { createPlainTransportForFFmpeg } from './mediasoup.service.js';
import { rtpPortPool } from './port-pool.service.js';
import { FFmpegService } from './ffmpeg.service.js';
import { HlsPlaylistService } from './hls-playlist.service.js';
import { logger } from '../utils/logger.js';
import { MODERATOR_ROLE } from '../constants/roles.js';
import { ERROR_MESSAGES, isValidStreamId } from '@worldplay/shared';

const STREAMS_BASE_PATH = '/usr/src/app/packages/media-server/public/streams';

const LOCAL_RTP_IP = '127.0.0.1';
const AUDIO_WAIT_TIMEOUT_MS = 3000;
const KEYFRAME_REQUEST_DELAY_MS = 1000;

const activeStreams = new Map();
const ffmpegTimers = new Map();

const clearFFmpegTimer = (streamId) => {
  const timer = ffmpegTimers.get(streamId);

  if (!timer) {
    return;
  }

  clearTimeout(timer);
  ffmpegTimers.delete(streamId);
};

const ensureDirectory = (streamId) => {
  // הגנת עומק אחרונה לפני fs: streamId מגיע במקור מהקליינט, ו-path.join
  // עם '../' חורג מ-STREAMS_BASE_PATH (path traversal). חוסמים כל מה שאינו UUID.
  if (!isValidStreamId(streamId)) {
    throw new Error(ERROR_MESSAGES.INVALID_STREAM_ID);
  }

  const streamPath = path.join(STREAMS_BASE_PATH, streamId);

  if (!fs.existsSync(streamPath)) {
    fs.mkdirSync(streamPath, { recursive: true });
    fs.chmodSync(streamPath, 0o777);
  }

  return streamPath;
};

const createStreamState = (streamId) => {
  const streamPath = ensureDirectory(streamId);

  HlsPlaylistService.initialize(streamId, streamPath);

  return {
    inputs: new Map(),
    ffmpegService: new FFmpegService({
      streamId,
      streamPath,
    }),
    streamPath,
    isStopping: false,
    isRestarting: false,
  };
};

const createParticipantInput = (participantId, role) => ({
  participantId,
  role,
  video: null,
  audio: null,
});

const closeMediaResource = (mediaResource) => {
  if (!mediaResource) {
    return;
  }

  if (!mediaResource.consumer.closed) {
    mediaResource.consumer.close();
  }

  if (!mediaResource.transport.closed) {
    mediaResource.transport.close();
  }

  rtpPortPool.release(mediaResource.port);
};

const replaceMediaResource = (participantInput, kind, nextMediaResource) => {
  const previousMediaResource = participantInput[kind];

  if (previousMediaResource) {
    closeMediaResource(previousMediaResource);
  }

  participantInput[kind] = nextMediaResource;
};

const closeParticipantMediaResources = (participantInput) => {
  closeMediaResource(participantInput.video);
  closeMediaResource(participantInput.audio);

  participantInput.video = null;
  participantInput.audio = null;
};

const closeStreamMediaResources = (state) => {
  for (const participantInput of state.inputs.values()) {
    closeParticipantMediaResources(participantInput);
  }

  state.inputs.clear();
};

const buildActiveInputs = (state) => {
  const activeInputs = [];

  for (const participantInput of state.inputs.values()) {
    if (participantInput.video) {
      activeInputs.push({
        participantId: participantInput.participantId,
        role: participantInput.role,
        kind: 'video',
        port: participantInput.video.port,
        consumer: participantInput.video.consumer,
      });
    }

    if (participantInput.audio) {
      activeInputs.push({
        participantId: participantInput.participantId,
        role: participantInput.role,
        kind: 'audio',
        port: participantInput.audio.port,
        consumer: participantInput.audio.consumer,
      });
    }
  }

  return activeInputs;
};

const requestVideoKeyframes = (streamId) => {
  const state = activeStreams.get(streamId);

  if (!state) {
    return;
  }

  const videoInputs = buildActiveInputs(state).filter(
    (input) => input.kind === 'video'
  );

  for (const videoInput of videoInputs) {
    videoInput.consumer.requestKeyFrame().catch((error) => {
      logger.error(
        `Failed to request keyframe for ${videoInput.participantId} ` +
          `[${streamId}]: ${error.message}`
      );
    });
  }
};

const handleFFmpegClose = (streamId) => {
  const state = activeStreams.get(streamId);

  if (!state || state.isStopping) {
    return;
  }

  if (state.isRestarting) {
    state.isRestarting = false;
    launchFFmpeg(streamId);
    return;
  }

  clearFFmpegTimer(streamId);
  closeStreamMediaResources(state);
  HlsPlaylistService.teardown(streamId);
  activeStreams.delete(streamId);
};

const restartFFmpeg = (streamId) => {
  const state = activeStreams.get(streamId);

  if (
    !state ||
    state.isStopping ||
    state.isRestarting ||
    !state.ffmpegService.isRunning()
  ) {
    return;
  }

  state.isRestarting = true;
  state.ffmpegService.stop();
};

const launchFFmpeg = (streamId) => {
  const state = activeStreams.get(streamId);

  if (!state || state.ffmpegService.isRunning()) {
    return;
  }

  const activeInputs = buildActiveInputs(state);

  // The moderator is never a main-grid tile (ffmpeg.service.js overlays them
  // separately), so their video alone can't satisfy the grid — launching
  // with zero main-video inputs makes buildFFmpegArgs throw synchronously,
  // which would otherwise crash the whole media-server process from inside
  // this setTimeout/FFmpeg-close callback.
  const hasMainVideo = activeInputs.some(
    (input) => input.kind === 'video' && input.role !== MODERATOR_ROLE
  );

  if (!hasMainVideo) {
    return;
  }

  try {
    state.ffmpegService.start(activeInputs, () => {
      handleFFmpegClose(streamId);
    });
  } catch (error) {
    logger.error(
      `Failed to launch FFmpeg for stream ${streamId}: ${error.message}`
    );

    return;
  }

  HlsPlaylistService.startSync(streamId);

  const hasAudio = activeInputs.some((input) => input.kind === 'audio');

  logger.info(`FFmpeg launch — audio status: ${hasAudio}`);

  setTimeout(() => {
    requestVideoKeyframes(streamId);
  }, KEYFRAME_REQUEST_DELAY_MS);
};

export const StreamService = {
  async startRecording({ streamId, router, producer, participantId, role }) {
    const kind = producer.kind;

    let pendingTransport = null;
    let pendingPort = null;
    let participantInput = null;

    try {
      if (!activeStreams.has(streamId)) {
        activeStreams.set(streamId, createStreamState(streamId));
      }

      const state = activeStreams.get(streamId);

      participantInput = state.inputs.get(participantId);

      if (!participantInput) {
        participantInput = createParticipantInput(participantId, role);

        state.inputs.set(participantId, participantInput);
      } else {
        participantInput.role = role;
      }

      pendingTransport = await createPlainTransportForFFmpeg(router);

      pendingPort = rtpPortPool.allocate();

      await pendingTransport.connect({
        ip: LOCAL_RTP_IP,
        port: pendingPort,
      });

      const consumer = await pendingTransport.consume({
        producerId: producer.id,
        rtpCapabilities: router.rtpCapabilities,
        paused: false,
      });

      const mediaResource = {
        producerId: producer.id,
        consumer,
        transport: pendingTransport,
        port: pendingPort,
      };

      replaceMediaResource(participantInput, kind, mediaResource);
      const shouldRestartFFmpeg = state.ffmpegService.isRunning();

      // From this point the stream state owns the transport and port.
      pendingTransport = null;
      pendingPort = null;

      logger.info(
        `[${kind.toUpperCase()}] Consumer ready for ${participantId}`
      );

      if (shouldRestartFFmpeg) {
        restartFFmpeg(streamId);
        return;
      }

      if (kind === 'audio') {
        clearFFmpegTimer(streamId);
        launchFFmpeg(streamId);
      } else if (kind === 'video') {
        clearFFmpegTimer(streamId);

        const timer = setTimeout(() => {
          launchFFmpeg(streamId);
          ffmpegTimers.delete(streamId);
        }, AUDIO_WAIT_TIMEOUT_MS);

        ffmpegTimers.set(streamId, timer);
      }
    } catch (error) {
      if (pendingTransport && !pendingTransport.closed) {
        pendingTransport.close();
      }

      if (pendingPort !== null) {
        rtpPortPool.release(pendingPort);
      }

      const state = activeStreams.get(streamId);

      if (
        state &&
        participantInput &&
        !participantInput.video &&
        !participantInput.audio
      ) {
        state.inputs.delete(participantId);
      }

      if (
        state &&
        state.inputs.size === 0 &&
        !state.ffmpegService.isRunning()
      ) {
        activeStreams.delete(streamId);
      }

      logger.error(`StreamService error: ${error.message}`);
      throw error;
    }
  },
  async removeRecordingInput({ streamId, producerId }) {
    const state = activeStreams.get(streamId);

    if (!state) {
      return;
    }

    let removedInput = false;

    for (const [participantId, participantInput] of state.inputs.entries()) {
      for (const kind of ['video', 'audio']) {
        const mediaResource = participantInput[kind];

        if (mediaResource?.producerId !== producerId) {
          continue;
        }

        closeMediaResource(mediaResource);
        participantInput[kind] = null;
        removedInput = true;

        if (!participantInput.video && !participantInput.audio) {
          state.inputs.delete(participantId);
        }

        break;
      }

      if (removedInput) {
        break;
      }
    }

    if (!removedInput) {
      return;
    }

    if (state.ffmpegService.isRunning()) {
      restartFFmpeg(streamId);
    }
  },
  async stopRecording(streamId) {
    const state = activeStreams.get(streamId);

    if (!state) {
      return;
    }

    state.isStopping = true;
    clearFFmpegTimer(streamId);

    logger.info(`Stopping stream and deleting folder: ${streamId}`);

    state.ffmpegService.stop();
    closeStreamMediaResources(state);

    try {
      if (fs.existsSync(state.streamPath)) {
        fs.rmSync(state.streamPath, {
          recursive: true,
          force: true,
        });

        logger.success(`Folder deleted: ${state.streamPath}`);
      }
    } catch (error) {
      logger.error(`Failed to delete folder: ${error.message}`);
    }
    HlsPlaylistService.teardown(streamId);
    activeStreams.delete(streamId);
  },
};
