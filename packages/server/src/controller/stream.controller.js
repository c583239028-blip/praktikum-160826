// ניהול מחזור חיי הסטרים — עצירה, חידוש וחישוב זמן השהייה המצטבר
import streamService from '../services/stream.service.js';
import { ERROR_MESSAGES, SOCKET_EVENTS } from '@worldplay/shared';
import { StreamStatus } from '@prisma/client';
import { logger } from '@worldplay/shared';

const streamController = {
  async createStream(req, res) {
    try {
      const userId = req.user.id;
      const { title } = req.body;

      if (!title) {
        return res.status(400).json({ error: ERROR_MESSAGES.TITLE_REQUIRED });
      }

      const stream = await streamService.createStream(userId, { title });
      res.status(201).json({ message: 'Stream created successfully', stream });
    } catch (error) {
      logger.error('Create Stream Error:', error.message);
      if (error.message.includes('already have an active stream')) {
        return res
          .status(409)
          .json({ error: ERROR_MESSAGES.ACTIVE_STREAM_EXISTS });
      }
      res.status(500).json({ error: ERROR_MESSAGES.FAILED_TO_CREATE_STREAM });
    }
  },

  async updateStatus(req, res) {
    try {
      const { id } = req.params;
      let { status, videoTimestamp } = req.body;
      const userId = req.user.id;

      if (status) status = status.trim().toUpperCase();

      const io = req.app.get('io');
      const result = await streamService.updateStreamStatus(id, userId, status);

      if (io) {
        const eventName =
          status === StreamStatus.PAUSE
            ? SOCKET_EVENTS.STREAM.STREAM_PAUSED
            : status === StreamStatus.LIVE
              ? SOCKET_EVENTS.STREAM.STREAM_RESUMED
              : SOCKET_EVENTS.STREAM.STATUS_UPDATE;
        io.to(id).emit(eventName, {
          id,
          status,
          videoTimestamp: videoTimestamp || null,
        });
      }

      res
        .status(200)
        .json({ message: 'Status updated successfully', data: result });
    } catch (error) {
      logger.error('Update Status Error:', error.message);
      if (error.message.includes('not found'))
        return res.status(404).json({ error: ERROR_MESSAGES.STREAM_NOT_FOUND });
      if (error.message.includes(ERROR_MESSAGES.UNAUTHORIZED))
        return res.status(403).json({ error: ERROR_MESSAGES.UNAUTHORIZED });
      if (error.message === ERROR_MESSAGES.INVALID_STATUS)
        return res.status(400).json({ error: ERROR_MESSAGES.INVALID_STATUS });
      res.status(500).json({ error: ERROR_MESSAGES.FAILED_TO_UPDATE_STATUS });
    }
  },

  async pauseStream(req, res) {
    const { streamId, status } = req.body;
    const userId = req.user.id;
    try {
      const updatedStream = await streamService.updateStreamStatus(
        streamId,
        userId,
        status
      );

      logger.info(
        `DB Update: Stream ${streamId} is ${status}. Total pause: ${updatedStream.accumulatedPauseMs}ms`
      );
      res.json({ success: true, stream: updatedStream });
    } catch (error) {
      logger.error('Controller Error (Status Update):', error.message);
      if (error.message === ERROR_MESSAGES.UNAUTHORIZED)
        return res.status(403).json({ error: ERROR_MESSAGES.UNAUTHORIZED });
      if (error.message === ERROR_MESSAGES.STREAM_NOT_FOUND)
        return res.status(404).json({ error: ERROR_MESSAGES.STREAM_NOT_FOUND });
      if (error.message === ERROR_MESSAGES.INVALID_STATUS)
        return res.status(400).json({ error: ERROR_MESSAGES.INVALID_STATUS });
      res.status(500).json({ error: ERROR_MESSAGES.FAILED_TO_UPDATE_STREAM });
    }
  },
};

export default streamController;
