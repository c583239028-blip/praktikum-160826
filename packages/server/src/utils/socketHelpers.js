// src/utils/socketHelpers.js
// ✅ כלי עזר לסנכרון real-time של יתרות משתמשים

import prisma from '../lib/prisma.js';
import { SOCKET_EVENTS, logger } from '@worldplay/shared';

/**
 * שידור עדכון יתרה וניקוד לכל המשתמשים המעורבים
 *
 * @param {Object} io - מופע Socket.io
 * @param {string|Array<string>} userIds - מזהה משתמש בודד או מערך מזהים
 * @param {string} gameId - מזהה המשחק
 * @returns {Promise<void>}
 */
export async function syncUserBalances(io, userIds, gameId) {
  if (!io) {
    logger.warn('[SOCKET] IO instance not available - skipping balance sync');
    return;
  }

  // נרמול קלט - תמיכה גמישה ב-string בודד או array
  const normalizedUserIds = Array.isArray(userIds)
    ? userIds
    : userIds
      ? [userIds]
      : [];

  if (normalizedUserIds.length === 0) {
    logger.warn('[SOCKET] No user IDs provided for balance sync');
    return;
  }

  try {
    logger.info(
      `[SOCKET] Syncing balances for ${normalizedUserIds.length} users...`
    );

    for (const userId of normalizedUserIds) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          walletBalance: true,
          participations: gameId
            ? { where: { gameId }, select: { score: true }, take: 1 }
            : false,
        },
      });

      if (user) {
        const pointsInGame = user.participations?.[0]?.score
          ? Number(user.participations[0].score)
          : 0;

        // מבנה payload חדש - תואם ל-walletSlice בצד הלקוח
        const balanceData = {
          walletCoins: Number(user.walletBalance),
          gameId,
          pointsInGame,
        };

        // שידור לחדר הפרטי של המשתמש
        io.to(userId).emit(SOCKET_EVENTS.WALLET.BALANCE_UPDATE, balanceData);

        logger.info(
          `[SOCKET]  Updated balance for user ${userId}: walletCoins=${balanceData.walletCoins}, pointsInGame=${balanceData.pointsInGame}`
        );
      } else {
        logger.warn(`[SOCKET]  User ${userId} not found`);
      }
    }

    logger.info('[SOCKET] Balance sync completed');
  } catch (error) {
    logger.error('[SOCKET]  Error syncing balances:', error.message);
  }
}

/**
 * שידור עדכון ציון במשחק לכל המשתתפים
 *
 * @param {Object} io - מופע Socket.io
 * @param {string} gameId - מזהה המשחק
 * @returns {Promise<void>}
 */
export async function syncGameScores(io, gameId) {
  if (!io) {
    logger.warn('[SOCKET] IO instance not available - skipping score sync');
    return;
  }

  try {
    logger.info(`[SOCKET] Syncing scores for game ${gameId}...`);

    const participants = await prisma.gameParticipant.findMany({
      where: { gameId },
      select: {
        userId: true,
        score: true,
        role: true,
        user: {
          select: {
            username: true,
          },
        },
      },
      orderBy: { score: 'desc' },
    });

    if (participants.length === 0) {
      logger.warn(`[SOCKET] No participants found for game ${gameId}`);
      return;
    }

    // המרת Decimal ל-Number
    const leaderboard = participants.map((p) => ({
      userId: p.userId,
      username: p.user.username,
      score: Number(p.score),
      role: p.role,
    }));

    // שידור לכל מי שבחדר המשחק
    io.to(gameId).emit(SOCKET_EVENTS.GAME.LEADERBOARD_UPDATED, {
      gameId,
      leaderboard,
      timestamp: new Date().toISOString(),
    });

    logger.success(
      `[SOCKET] ✅ Synced scores for ${participants.length} participants`
    );
  } catch (error) {
    logger.error('[SOCKET] ❌ Error syncing game scores:', error.message);
  }
}

/**
 * שידור אירוע כספי כללי (למעקב)
 *
 * @param {Object} io - מופע Socket.io
 * @param {string} gameId - מזהה המשחק
 * @param {string} eventType - סוג האירוע
 * @param {Object} data - נתונים נוספים
 */
export function broadcastEconomyEvent(io, gameId, eventType, data) {
  if (!io) return;

  io.to(gameId).emit(SOCKET_EVENTS.ECONOMY.EVENT, {
    type: eventType,
    gameId,
    data,
    timestamp: new Date().toISOString(),
  });

  logger.info(`[SOCKET] 📢 Broadcasted ${eventType} to game ${gameId}`);
}

/**
 * המרת Decimal ל-Number (פונקציית עזר)
 *
 * @param {Decimal|number} value - ערך לעיבוד
 * @returns {number}
 */
export function toNumber(value) {
  return value ? Number(value) : 0;
}
