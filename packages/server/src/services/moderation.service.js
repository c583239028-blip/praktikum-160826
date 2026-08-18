/**
 * moderation.service.js
 *
 * לוגיקה עסקית למודרציה — דיווח, השתקה/ביטול השתקה, הרחקה, וסף דיווחים.
 * report פתוח לכל צופה (אך משויך ל-game הפעיל); mute/unmute/kick דורשים
 * moderator ברמת ה-game הפעיל. כל הפעולות נשמרות עם gameId (לא רק
 * streamId), כדי שספירת דיווחים/סינון עתידי לפי game לא יתערבב בין
 * משחקים שונים שרצו על אותו stream.
 *
 * תלוי ב: Prisma (ModerationAction, Game, Stream)
 *          notification.service.js (שליחת התראה לפותח)
 * משמש את: moderation.controller.js
 */
import prisma from '../lib/prisma.js';
import { ModerationType, GameStatus } from '@prisma/client';
import notificationService from './notification.service.js';
import { ERROR_MESSAGES } from '@worldplay/shared';

const REPORT_THRESHOLD = 5;

const moderationService = {
  async findActiveGameForStream(streamId) {
    return prisma.game.findFirst({
      where: { streamId, status: GameStatus.ACTIVE },
    });
  },

  async createReport(streamId, gameId, actorId, reason) {
    const action = await prisma.moderationAction.create({
      data: {
        type: ModerationType.REPORT,
        streamId,
        gameId,
        actorId,
        targetUserId: null,
        reason,
      },
    });

    await this.checkReportThreshold(gameId);

    return action;
  },

  // Counts distinct reporters for this game and flags the game once the
  // threshold is reached. Idempotent — checked via Game.isUnderReview.
  async checkReportThreshold(gameId) {
    const uniqueReporters = await prisma.moderationAction.findMany({
      where: { gameId, type: ModerationType.REPORT },
      distinct: ['actorId'],
    });

    const uniqueReporterCount = uniqueReporters.length;

    if (uniqueReporterCount >= REPORT_THRESHOLD) {
      const { count } = await prisma.game.updateMany({
        where: { id: gameId, isUnderReview: false },
        data: { isUnderReview: true },
      });

      if (count === 1) {
        const game = await prisma.game.findUnique({ where: { id: gameId } });
        await notificationService.createNewNotification(
          game.hostId,
          ERROR_MESSAGES.GAME_UNDER_REVIEW_TITLE,
          ERROR_MESSAGES.GAME_UNDER_REVIEW_MESSAGE
        );
      }
    }

    return { uniqueReporterCount };
  },

  async getGamesUnderReview() {
    return prisma.game.findMany({
      where: { isUnderReview: true },
      include: {
        host: {
          select: { id: true, username: true, email: true },
        },
        stream: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  async createModerationAction(
    type,
    streamId,
    gameId,
    actorId,
    targetUserId,
    reason
  ) {
    return prisma.moderationAction.create({
      data: { type, streamId, gameId, actorId, targetUserId, reason },
    });
  },
};

export default moderationService;
