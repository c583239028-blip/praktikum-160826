/**
 * stream.service.js (server)
 *
 * שכבת השירות לניהול שידורים מהשרת הראשי.
 * אחראי על עדכון סטטוס שידורים ב-DB ועל פרוקסי בקשות לשרת המדיה.
 *
 * פונקציות:
 *   startStream(streamId, inputPipe)           — פרוקסי stream גולמי לשרת המדיה
 *   updateStreamStatus(streamId, userId, status) — עדכון סטטוס עם מעקב זמן pause
 *   pauseStream(streamId)                      — השהיית שידור
 *   resumeStream(streamId)                     — המשך שידור
 *
 * מתקשר עם: Prisma → Stream, axios → media-server
 * תלוי ב:   MEDIA_SERVER_URL (hardcoded — TODO: להעביר ל-ENV)
 * משמש את:  stream.controller.js, Socket.IO event handlers
 */
import prisma from '../lib/prisma.js';
import axios from 'axios';
import permissionsService from './permissions.service.js';
import { ERROR_MESSAGES } from '@worldplay/shared';

const MEDIA_SERVER_URL = 'http://media-server:8000';

const streamService = {
  async startStream(streamId, inputPipe) {
    try {
      await axios({
        method: 'post',
        url: `${MEDIA_SERVER_URL}/live/start/${streamId}`,
        data: inputPipe,
        headers: { 'Content-Type': 'application/octet-stream' },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      });
    } catch (err) {
      throw new Error(`Stream pipe failed: ${err.message}`);
    }
  },
  async updateStreamStatus(streamId, userId, newStatus) {
    const normalizedStatus = newStatus
      ? newStatus.trim().toUpperCase()
      : newStatus;
    const validStatuses = ['WAITING', 'FINISHED', 'LIVE', 'PAUSE'];
    if (!normalizedStatus || !validStatuses.includes(normalizedStatus)) {
      throw new Error(ERROR_MESSAGES.INVALID_STATUS);
    }

    const stream = await permissionsService.ensureStreamHost(streamId, userId);
    const dataToUpdate = { status: normalizedStatus };
    const now = new Date();

    if (normalizedStatus === 'PAUSE') {
      dataToUpdate.lastPausedAt = now;
    } else if (normalizedStatus === 'LIVE' && stream.lastPausedAt) {
      const pauseDuration =
        now.getTime() - new Date(stream.lastPausedAt).getTime();
      dataToUpdate.accumulatedPauseMs =
        (stream.accumulatedPauseMs || 0) + pauseDuration;
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
        status: 'PAUSE',
        lastPausedAt: new Date(),
      },
    });
  },

  async resumeStream(streamId) {
    return await prisma.stream.update({
      where: { id: streamId },
      data: { status: 'LIVE' },
    });
  },
  async getStream(streamId) {
    return await prisma.stream.findUnique({
      where: { id: streamId },
    });
  },
  // Auto-resume runs from an internal system timer, not a new client request —
  // ownership was already verified when the pause action started, so we skip
  // re-checking it here.
  async autoResume(streamId, stream) {
    if (!stream || stream.status !== 'PAUSE') return null;

    const now = new Date();
    const pauseDuration = stream.lastPausedAt
      ? now.getTime() - new Date(stream.lastPausedAt).getTime()
      : 0;

    return await prisma.stream.update({
      where: { id: streamId },
      data: {
        status: 'LIVE',
        accumulatedPauseMs: (stream.accumulatedPauseMs || 0) + pauseDuration,
        lastPausedAt: null,
      },
    });
  },
};

export default streamService;
