// נתיבי מודרציה — דיווח, השתקה/ביטול השתקה, הרחקה, והנגשת משחקים תחת מעקב לצוות
import { ERROR_MESSAGES, logger } from '@worldplay/shared';
import moderationService from '../services/moderation.service.js';
import permissionsService from '../services/permissions.service.js';
import { ModerationType } from '@prisma/client';
import {
  moderationEventForType,
  emitModerationEvent,
  enforceKickSocket,
  enforceMuteOnMediaServer,
} from '../utils/moderationSocket.js';

// פעולה משותפת ל-mute/unmute/kick — גישור ל-game פעיל + אכיפת הרשאת moderator
async function performModeratorAction(req, res, type) {
  try {
    const { id: streamId } = req.params;
    const { targetUserId, reason } = req.body;
    const actorId = req.user.id;

    if (!targetUserId) {
      return res
        .status(400)
        .json({ error: ERROR_MESSAGES.TARGET_USER_ID_REQUIRED });
    }

    const game = await moderationService.findActiveGameForStream(streamId);
    if (!game) {
      return res
        .status(404)
        .json({ error: ERROR_MESSAGES.NO_ACTIVE_GAME_FOR_STREAM });
    }

    try {
      await permissionsService.ensureModerator(game.id, actorId);
    } catch (permissionError) {
      return res.status(403).json({ error: permissionError.message });
    }

    const action = await moderationService.createModerationAction(
      type,
      streamId,
      game.id,
      actorId,
      targetUserId,
      reason
    );

    // האכיפה כבר תועדה ב-DB; כעת אוכפים אותה בזמן אמת מול היעד.
    const io = req.app?.get?.('io');
    if (type === ModerationType.KICK) {
      await enforceKickSocket(io, targetUserId, game.id);
    } else if (type === ModerationType.MUTE || type === ModerationType.UNMUTE) {
      await enforceMuteOnMediaServer(
        streamId,
        targetUserId,
        type === ModerationType.MUTE
      );
    }
    emitModerationEvent(
      io,
      moderationEventForType(type),
      targetUserId,
      streamId
    );

    res
      .status(201)
      .json({ message: 'Moderation action recorded', data: action });
  } catch (error) {
    logger.error(`Moderation Action Error (${type}):`, error.message);
    res
      .status(500)
      .json({ error: ERROR_MESSAGES.FAILED_TO_PERFORM_MODERATION_ACTION });
  }
}

const moderationController = {
  async report(req, res) {
    try {
      const { id: streamId } = req.params;
      const { reason } = req.body;
      const actorId = req.user.id;

      const game = await moderationService.findActiveGameForStream(streamId);
      if (!game) {
        return res
          .status(404)
          .json({ error: ERROR_MESSAGES.NO_ACTIVE_GAME_FOR_STREAM });
      }

      const action = await moderationService.createReport(
        streamId,
        game.id,
        actorId,
        reason
      );

      res
        .status(201)
        .json({ message: 'Report submitted successfully', data: action });
    } catch (error) {
      logger.error('Report Error:', error.message);
      res.status(500).json({ error: ERROR_MESSAGES.FAILED_TO_SUBMIT_REPORT });
    }
  },

  async mute(req, res) {
    await performModeratorAction(req, res, ModerationType.MUTE);
  },

  async unmute(req, res) {
    await performModeratorAction(req, res, ModerationType.UNMUTE);
  },

  async kick(req, res) {
    await performModeratorAction(req, res, ModerationType.KICK);
  },

  async getGamesUnderReview(req, res) {
    try {
      const games = await moderationService.getGamesUnderReview();
      return res.status(200).json({ games });
    } catch (error) {
      logger.error('❌ getGamesUnderReview error:', error.message);
      return res
        .status(500)
        .json({ error: ERROR_MESSAGES.FAILED_TO_FETCH_GAMES_UNDER_REVIEW });
    }
  },
};

export default moderationController;
