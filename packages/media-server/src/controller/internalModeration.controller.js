// בקשות שרת-לשרת בלבד (מאחורי internalAuth ב-index.js). קבלת request,
// ולידציה, והחזרת response — הלוגיקה העסקית ב-
// services/producerModeration.service.js.
import { logger } from '../utils/logger.js';
import { setAudioMuteForUser } from '../services/producerModeration.service.js';
import { ERROR_MESSAGES } from '@worldplay/shared';

// Errors we throw ourselves with known, safe-to-expose messages. Anything
// else (e.g. an unexpected mediasoup exception) must not reach the response
// body — only the log — so internal failure details never leak, even to
// this trusted internal caller.
const NOT_FOUND_ERRORS = new Set([ERROR_MESSAGES.STREAM_ROOM_NOT_FOUND]);

async function handleAudioMute(req, res, muted) {
  const { streamId, targetUserId } = req.body;
  if (!streamId || !targetUserId) {
    return res
      .status(400)
      .json({ error: ERROR_MESSAGES.MISSING_REQUIRED_FIELDS });
  }

  try {
    const io = req.app.get('io');
    await setAudioMuteForUser(io, streamId, targetUserId, muted);
    res.status(200).json({ success: true });
  } catch (error) {
    logger.error(
      `Internal moderation ${muted ? 'mute' : 'unmute'} failed for stream ${streamId}, user ${targetUserId}: ${error.message}`
    );
    if (NOT_FOUND_ERRORS.has(error.message)) {
      return res.status(404).json({ error: error.message });
    }
    res
      .status(500)
      .json({ error: ERROR_MESSAGES.FAILED_TO_ENFORCE_MEDIA_MODERATION });
  }
}

const internalModerationController = {
  async mute(req, res) {
    await handleAudioMute(req, res, true);
  },

  async unmute(req, res) {
    await handleAudioMute(req, res, false);
  },
};

export default internalModerationController;
