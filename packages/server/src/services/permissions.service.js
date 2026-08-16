/**
 * permissions.service.js
 *
 * שכבת בדיקות הרשאות למשחק — כל פעולה מוגבלת-תפקיד עוברת דרך כאן.
 * היררכיית תפקידים: HOST > MODERATOR > PLAYER > VIEWER
 * HOST מורשה לכל מה שMODERATOR מורשה לו.
 *
 * פונקציות:
 *   validateRole(gameId, userId, requiredRole) — בדיקה גנרית לפי תפקיד, זורקת שגיאה אם נכשל
 *   ensureHost(gameId, userId)                 — קיצור: דורש תפקיד HOST
 *   ensureModerator(gameId, userId)            — קיצור: דורש תפקיד MODERATOR או HOST
 *
 * מתקשר עם: Prisma → GameParticipant
 * תלוי ב:   אין תלויות חיצוניות
 * משמש את:  game.service.js, question.service.js, וכל service שדורש הרשאות
 */
import prisma from '../lib/prisma.js';
import { ERROR_MESSAGES } from '@worldplay/shared';

const permissionsService = {
  async validateRole(gameId, userId, requiredRole) {
    if (!gameId || !userId) {
      throw new Error(
        ERROR_MESSAGES.MISSING_GAME_OR_USER_ID_FOR_PERMISSION_CHECK
      );
    }

    const participant = await prisma.gameParticipant.findUnique({
      where: {
        gameId_userId: {
          gameId: gameId,
          userId: userId,
        },
      },
    });

    if (!participant) {
      console.warn(
        `Permission denied: ${userId} has no ${requiredRole} role in game ${gameId}`
      );
      throw new Error(ERROR_MESSAGES.UNAUTHORIZED);
    }

    // HOST יכול לעשות הכל מה שMODERATOR יכול
    const allowedRoles =
      requiredRole === 'MODERATOR' ? ['MODERATOR', 'HOST'] : [requiredRole];

    if (!allowedRoles.includes(participant.role)) {
      console.warn(
        `Permission denied: ${userId} role=${participant.role}, required=${requiredRole}`
      );
      throw new Error(ERROR_MESSAGES.UNAUTHORIZED);
    }

    return participant;
  },

  async ensureHost(gameId, userId) {
    return this.validateRole(gameId, userId, 'HOST');
  },

  async ensureModerator(gameId, userId) {
    return this.validateRole(gameId, userId, 'MODERATOR');
  },

  async ensureStreamHost(streamId, userId) {
    const stream = await prisma.stream.findUnique({
      where: { id: streamId },
    });

    if (!stream) {
      throw new Error(ERROR_MESSAGES.STREAM_NOT_FOUND);
    }

    if (stream.hostId !== userId) {
      throw new Error(ERROR_MESSAGES.UNAUTHORIZED);
    }

    return stream;
  },
};

export default permissionsService;
