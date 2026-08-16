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
import { UserRole } from '@prisma/client';
import { logger } from '@worldplay/shared';

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
      logger.warn(
        `Permission denied: ${userId} has no ${requiredRole} role in game ${gameId}`
      );
      throw new Error(ERROR_MESSAGES.UNAUTHORIZED);
    }

    // HOST יכול לעשות הכל מה שMODERATOR יכול
    const allowedRoles =
      requiredRole === UserRole.MODERATOR
        ? [UserRole.MODERATOR, UserRole.HOST]
        : [requiredRole];

    if (!allowedRoles.includes(participant.role)) {
      logger.warn(
        `Permission denied: ${userId} role=${participant.role}, required=${requiredRole}`
      );
      throw new Error(ERROR_MESSAGES.UNAUTHORIZED);
    }

    return participant;
  },

  async ensureHost(gameId, userId) {
    return this.validateRole(gameId, userId, UserRole.HOST);
  },

  async ensureModerator(gameId, userId) {
    return this.validateRole(gameId, userId, UserRole.MODERATOR);
  },

  // דורש שהמשתמש הוא משתתף במשחק בכל תפקיד (כולל VIEWER/PLAYER) — בלי אכיפת תפקיד.
  // משמש מסלולים שפתוחים לכל משתתף אך חסומים לזרים, למשל שליחת שאלת צופה (Q1b).
  async ensureParticipant(gameId, userId) {
    if (!gameId || !userId) {
      throw new Error(
        ERROR_MESSAGES.MISSING_GAME_OR_USER_ID_FOR_PERMISSION_CHECK
      );
    }

    const participant = await prisma.gameParticipant.findUnique({
      where: { gameId_userId: { gameId, userId } },
    });

    if (!participant) {
      logger.warn(
        `Permission denied: ${userId} is not a participant in game ${gameId}`
      );
      throw new Error(ERROR_MESSAGES.NOT_GAME_PARTICIPANT);
    }

    return participant;
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
