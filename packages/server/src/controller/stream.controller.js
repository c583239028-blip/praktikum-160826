// ניהול מחזור חיי הסטרים — הפעלה, עצירה, חידוש וחישוב זמן השהייה המצטבר
import streamService from '../services/stream.service.js';
import permissionsService from '../services/permissions.service.js';
import { ERROR_MESSAGES } from '@worldplay/shared';

const streamController = {
  async start(req, res) {
    const { streamId } = req.params;

    try {
      console.log(`Start request received for stream: ${streamId}`);

      await permissionsService.ensureStreamHost(streamId, req.user.id);

      // Response נשלח לפני await — Service ממשיך ברקע
      res.status(200).json({
        message: 'Stream ingestion started',
        streamId,
      });

      await streamService.startStream(streamId, req);

      console.log(`✅ Stream ${streamId} processing completed`);
    } catch (error) {
      console.error(`Controller Error: ${error.message}`);
      if (!res.headersSent) {
        if (error.message.includes('not found'))
          return res
            .status(404)
            .json({ error: ERROR_MESSAGES.STREAM_NOT_FOUND });
        if (error.message.includes(ERROR_MESSAGES.UNAUTHORIZED))
          return res.status(403).json({ error: ERROR_MESSAGES.UNAUTHORIZED });
        res.status(500).json({ error: ERROR_MESSAGES.FAILED_TO_START_STREAM });
      }
    }
  },

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
      console.error('Create Stream Error:', error);
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
          status === 'PAUSE' ? 'stream_paused' : 'status_update';
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
      console.error('Update Status Error:', error);
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

      console.log(
        `DB Update: Stream ${streamId} is ${status}. Total pause: ${updatedStream.accumulatedPauseMs}ms`
      );
      res.json({ success: true, stream: updatedStream });
    } catch (error) {
      console.error('Controller Error (Status Update):', error.message);
      if (error.message === ERROR_MESSAGES.UNAUTHORIZED)
        return res.status(403).json({ error: ERROR_MESSAGES.UNAUTHORIZED });
      if (error.message === ERROR_MESSAGES.STREAM_NOT_FOUND)
        return res.status(404).json({ error: ERROR_MESSAGES.STREAM_NOT_FOUND });
      if (error.message === ERROR_MESSAGES.INVALID_STATUS)
        return res.status(400).json({ error: ERROR_MESSAGES.INVALID_STATUS });
      res.status(500).json({ error: ERROR_MESSAGES.FAILED_TO_UPDATE_STREAM });
    }
  },

  async handleQuestionPause(req, res) {
    const { streamId } = req.body;
    const PAUSE_TIME_SECONDS = 30;

    try {
      await streamService.updateStreamStatus(streamId, req.user.id, 'PAUSE');

      req.app.get('io').to(streamId).emit('stream_paused', { streamId });

      setTimeout(async () => {
        try {
          const stream = await streamService.getStream(streamId);
          const updated = await streamService.autoResume(streamId, stream);
          if (updated) {
            req.app.get('io').to(streamId).emit('stream_resumed', { streamId });
            console.log(`Auto-Resume: Stream ${streamId} is back LIVE.`);
          }
        } catch (err) {
          console.error('Auto-Resume Error:', err.message);
        }
      }, PAUSE_TIME_SECONDS * 1000);

      res.json({ success: true, message: 'Question pause initiated' });
    } catch (error) {
      console.error('Controller Error (handleQuestionPause):', error.message);
      if (error.message.includes('not found')) {
        return res.status(404).json({ error: ERROR_MESSAGES.STREAM_NOT_FOUND });
      }
      if (error.message.includes(ERROR_MESSAGES.UNAUTHORIZED)) {
        return res.status(403).json({ error: ERROR_MESSAGES.UNAUTHORIZED });
      }
      if (error.message === ERROR_MESSAGES.INVALID_STATUS) {
        return res.status(400).json({ error: ERROR_MESSAGES.INVALID_STATUS });
      }
      res
        .status(500)
        .json({ error: ERROR_MESSAGES.FAILED_TO_HANDLE_QUESTION_PAUSE });
    }
  },
};

export default streamController;
