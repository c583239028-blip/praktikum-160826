/**
 * stream.service.js (server)
 *
 * שכבת השירות לניהול שידורים מהשרת הראשי.
 * אחראי על עדכון סטטוס שידורים ב-DB.
 *
 * פונקציות:
 *   updateStreamStatus(streamId, userId, status) — עדכון סטטוס עם מעקב זמן pause
 *   pauseStream(streamId)                      — השהיית שידור
 *   resumeStream(streamId)                     — המשך שידור
 *
 * מתקשר עם: Prisma → Stream
 * משמש את:  stream.controller.js, Socket.IO event handlers
 */
import prisma from '../lib/prisma.js';
import permissionsService from './permissions.service.js';
import { ERROR_MESSAGES } from '@worldplay/shared';
import { StreamStatus } from '@prisma/client';
import { logger } from '@worldplay/shared';
import { GAME_SETTINGS } from '../constants/gameRules.js';

const activeFreezeTimers = new Map();

function _clearFreezeTimer(streamId) {
  if (activeFreezeTimers.has(streamId)) {
    clearTimeout(activeFreezeTimers.get(streamId));
    activeFreezeTimers.delete(streamId);
  }
}

function _calculatePauseDuration(stream) {
  return stream.lastPausedAt
    ? Date.now() - new Date(stream.lastPausedAt).getTime()
    : 0;
}

const streamService = {
  async updateStreamStatus(streamId, userId, newStatus) {
    const normalizedStatus = newStatus
      ? newStatus.trim().toUpperCase()
      : newStatus;
    const validStatuses = Object.values(StreamStatus);
    if (!normalizedStatus || !validStatuses.includes(normalizedStatus)) {
      throw new Error(ERROR_MESSAGES.INVALID_STATUS);
    }

    const stream = await permissionsService.ensureStreamHost(streamId, userId);
    const dataToUpdate = { status: normalizedStatus };
    const now = new Date();

    if (normalizedStatus === StreamStatus.PAUSE) {
      dataToUpdate.lastPausedAt = now;
    } else if (normalizedStatus === StreamStatus.LIVE && stream.lastPausedAt) {
      dataToUpdate.accumulatedPauseMs =
        (stream.accumulatedPauseMs || 0) + _calculatePauseDuration(stream);
      dataToUpdate.lastPausedAt = null;
    }

    return await prisma.stream.update({
      where: { id: streamId },
      data: dataToUpdate,
    });
  },

  async pauseStream(streamId) {
    return await prisma.stream.update({
      where: { id: streamId },
      data: {
        status: StreamStatus.PAUSE,
        lastPausedAt: new Date(),
      },
    });
  },

  async resumeStream(streamId) {
    return await prisma.stream.update({
      where: { id: streamId },
      data: { status: StreamStatus.LIVE },
    });
  },
  async getStream(streamId) {
    return await prisma.stream.findUnique({
      where: { id: streamId },
    });
  },
  // Reads the live viewer count maintained by the media-server (C5c).
  // Defaults to 0 until C5c is wired — a stream with no recorded viewers
  // fails the moderator-join gate safely rather than open.
  async getViewerCount(streamId) {
    const stream = await prisma.stream.findUnique({
      where: { id: streamId },
      select: { viewerCount: true },
    });

    return stream?.viewerCount ?? 0;
  },
  // Auto-resume runs from an internal system timer, not a new client request —
  // ownership was already verified when the pause action started, so we skip
  // re-checking it here.
  async autoResume(streamId, stream) {
    if (!stream || stream.status !== StreamStatus.PAUSE) return null;

    return await prisma.stream.update({
      where: { id: streamId },
      data: {
        status: StreamStatus.LIVE,
        accumulatedPauseMs:
          (stream.accumulatedPauseMs || 0) + _calculatePauseDuration(stream),
        lastPausedAt: null,
      },
    });
  },
  async freezeStreamForQuestion(gameId, timeLimit) {
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      select: { streamId: true },
    });

    if (!game) {
      logger.warn(`[Freeze] Game ${gameId} not found — skipping freeze.`);
      return;
    }

    const { streamId } = game;
    const stream = await streamService.getStream(streamId);

    if (!stream) {
      logger.warn(`[Freeze] Stream ${streamId} not found — skipping freeze.`);
      return;
    }

    // אידמפוטנטיות: אם כבר במצב PAUSE, לא דורסים את lastPausedAt
    // (זה היה מקצר את ה-lag האמיתי שנצבר).
    if (stream.status !== StreamStatus.PAUSE) {
      await prisma.stream.update({
        where: { id: streamId },
        data: { status: StreamStatus.PAUSE, lastPausedAt: new Date() },
      });
    }

    // מבטלים טיימר קודם אם קיים (שאלה חדשה קובעת מסגרת זמן חדשה)
    _clearFreezeTimer(streamId);

    const durationMs =
      (timeLimit || GAME_SETTINGS.DEFAULT_QUESTION_TIMER) * 1000;

    const timer = setTimeout(async () => {
      activeFreezeTimers.delete(streamId);
      try {
        await streamService.performResume(streamId);
      } catch (err) {
        logger.error(`Auto-resume failed for stream ${streamId}:`, err.message);
      }
    }, durationMs);

    activeFreezeTimers.set(streamId, timer);
  },
  async performResume(streamId) {
    _clearFreezeTimer(streamId);

    const stream = await streamService.getStream(streamId);
    const updated = await streamService.autoResume(streamId, stream);

    return updated;
  },

  async cancelFreeze(streamId) {
    _clearFreezeTimer(streamId);

    const stream = await streamService.getStream(streamId);
    if (!stream || stream.status !== StreamStatus.PAUSE) return null;

    return await prisma.stream.update({
      where: { id: streamId },
      data: {
        accumulatedPauseMs:
          (stream.accumulatedPauseMs || 0) + _calculatePauseDuration(stream),
        lastPausedAt: null,
      },
    });
  },
};

export default streamService;
