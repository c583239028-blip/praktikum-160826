/**
 * economy.service.js
 *
 * שכבת השירות לניהול הכלכלה במשחק — כל תנועת כסף עוברת דרך כאן.
 * כל פעולה כספית מוגנת בתוך $transaction של Prisma כדי למנוע אי-התאמות.
 *
 * פונקציות:
 *   distributeStandardPot  — חלוקת קופה רגילה בין שחקנים + מנחה
 *   processWinnerPayout    — תשלום ל"מי ינצח" (85% לזוכה, 15% למנחה)
 *   rewardCorrectAnswers   — פרס לכל העונים נכון (125% מההימור), batched
 *   sendGift               — שליחת מתנה (35% לשחקן, 65% למנחה)
 *
 * מתקשר עם: Prisma → User, GameParticipant, UserAnswer, QuestionOption, Transaction, Game
 * תלוי ב:   אין תלויות חיצוניות מעבר ל-Prisma
 * משמש את:  question.service.js, game.controller.js, Socket.IO event handlers
 */
import prisma from '../lib/prisma.js';
import { ERROR_MESSAGES, formatMessage } from '@worldplay/shared';
import { GAME_SETTINGS } from '../constants/gameRules.js';

const economyService = {
  /**
   * המרת Decimal ל-Number
   * @private
   */
  _toNumber(value) {
    return value ? Number(value) : 0;
  },

  // ========================================
  // 1. חלוקת קופה רגילה (Standard Question)
  // ========================================

  // tx אופציונלי: כשמעבירים אותו, החלוקה רצה בתוך הטרנזקציה של הקורא (resolveQuestion)
  // ולא פותחת $transaction מקונן — כך כשל בהמשך מגלגל גם את החלוקה לאחור (אטומיות מלאה).
  async distributeStandardPot(questionId, gameId, moderatorId, tx = null) {
    const run = async (tx) => {
      const totalWagersResult = await tx.userAnswer.aggregate({
        where: { questionId },
        _sum: { wager: true },
      });

      const totalPot = this._toNumber(totalWagersResult._sum.wager);
      if (totalPot === 0) return { totalPot: 0, distributions: [] };

      const activeAnswers = await tx.userAnswer.findMany({
        where: { questionId },
        select: { userId: true },
        distinct: ['userId'],
      });

      const activePlayerIds = activeAnswers.map((a) => a.userId);
      const numPlayers = activePlayerIds.length;

      if (numPlayers === 0) {
        await tx.user.update({
          where: { id: moderatorId },
          data: { walletBalance: { increment: totalPot } },
        });
        return {
          totalPot,
          distributions: [
            { userId: moderatorId, amount: totalPot, role: 'HOST' },
          ],
        };
      }

      const totalUnits = numPlayers * 1.0 + 1.15;
      const baseShare = Math.floor(totalPot / totalUnits);

      const playerDistributions = [];
      for (const playerId of activePlayerIds) {
        await tx.user.update({
          where: { id: playerId },
          data: { walletBalance: { increment: baseShare } },
        });

        await tx.gameParticipant.upsert({
          where: { gameId_userId: { gameId, userId: playerId } },
          update: { score: { increment: baseShare } },
          create: {
            gameId,
            userId: playerId,
            score: baseShare,
            role: 'VIEWER',
          },
        });

        playerDistributions.push({
          userId: playerId,
          amount: baseShare,
          role: 'PLAYER',
        });
      }

      const totalGivenToPlayers = baseShare * numPlayers;
      const hostShare = totalPot - totalGivenToPlayers;

      await tx.user.update({
        where: { id: moderatorId },
        data: { walletBalance: { increment: hostShare } },
      });

      return {
        totalPot,
        baseShare,
        hostShare,
        distributions: [
          ...playerDistributions,
          { userId: moderatorId, amount: hostShare, role: 'HOST' },
        ],
      };
    };

    return tx ? run(tx) : prisma.$transaction(run);
  },

  // ========================================
  // 2. שאלת "מי ינצח" (Winner Payout)
  // ========================================

  // tx אופציונלי — ראה הערה ב-distributeStandardPot.
  async processWinnerPayout(
    questionId,
    correctOptionId,
    moderatorId,
    gameId,
    tx = null
  ) {
    const run = async (tx) => {
      const correctOption = await tx.questionOption.findUnique({
        where: { id: correctOptionId },
      });

      if (!correctOption?.linkedPlayerId)
        throw new Error(ERROR_MESSAGES.NO_WINNER_LINKED);
      const winnerId = correctOption.linkedPlayerId;

      const totalWagersResult = await tx.userAnswer.aggregate({
        where: { questionId },
        _sum: { wager: true },
      });

      const totalPot = this._toNumber(totalWagersResult._sum.wager);
      if (totalPot === 0) return { totalPot: 0, winnerId };

      const winnerShare = Math.floor(totalPot * 0.85);
      const hostShare = totalPot - winnerShare;

      await tx.user.update({
        where: { id: winnerId },
        data: { walletBalance: { increment: winnerShare } },
      });

      await tx.gameParticipant.upsert({
        where: { gameId_userId: { gameId, userId: winnerId } },
        update: { score: { increment: winnerShare } },
        create: {
          gameId,
          userId: winnerId,
          score: winnerShare,
          role: 'VIEWER',
        },
      });

      await tx.user.update({
        where: { id: moderatorId },
        data: { walletBalance: { increment: hostShare } },
      });

      await tx.transaction.createMany({
        data: [
          {
            userId: winnerId,
            type: 'WINNER_PAYOUT',
            amount: winnerShare,
            gameId,
            currency: 'COIN',
            status: 'SUCCESS',
          },
          {
            userId: moderatorId,
            type: 'WINNER_PAYOUT',
            amount: hostShare,
            gameId,
            currency: 'COIN',
            status: 'SUCCESS',
          },
        ],
      });

      return { totalPot, winnerId, winnerShare, hostShare };
    };

    return tx ? run(tx) : prisma.$transaction(run);
  },

  // ========================================
  // 3. זיכוי תשובות נכונות - STANDARD בלבד
  //    כל מי שענה נכון מקבל 125% מההימור שלו
  // ========================================
  //
  // batched: שולפים את כל העונים-נכון בשאילתה אחת (findMany) במקום findFirst
  // לכל משתמש, ומתעדים את כל הזיכויים ב-createMany בודד. עדכוני הארנק/הניקוד
  // נשארים פר-משתמש כי הסכום שונה לכל אחד, אך אין יותר N שאילתות findFirst.
  // tx אופציונלי — ראה הערה ב-distributeStandardPot.
  async rewardCorrectAnswers(questionId, gameId, correctOptionId, tx = null) {
    const run = async (tx) => {
      // כל מי שבחר את התשובה הנכונה, בשליפה אחת — מחליף את לולאת ה-findFirst.
      const correctAnswers = await tx.userAnswer.findMany({
        where: { questionId, selectedOptionId: correctOptionId },
        select: { userId: true, wager: true },
      });

      if (correctAnswers.length === 0) return [];

      const rewardResults = [];
      const transactionRecords = [];

      for (const answer of correctAnswers) {
        const originalWager = this._toNumber(answer.wager);
        // 125% מההימור המקורי
        const reward = Math.floor(originalWager * 1.25);

        // זיכוי הארנק
        await tx.user.update({
          where: { id: answer.userId },
          data: { walletBalance: { increment: reward } },
        });

        // עדכון ניקוד במשחק
        await tx.gameParticipant.upsert({
          where: { gameId_userId: { gameId, userId: answer.userId } },
          update: { score: { increment: reward } },
          create: {
            gameId,
            userId: answer.userId,
            score: reward,
            role: 'VIEWER',
          },
        });

        transactionRecords.push({
          userId: answer.userId,
          type: 'CORRECT_ANSWER',
          amount: reward,
          gameId,
          currency: 'COIN',
          status: 'SUCCESS',
        });

        rewardResults.push({
          userId: answer.userId,
          rewarded: true,
          reward,
          originalWager,
        });
      }

      // תיעוד כל הזיכויים בבת אחת — createMany בודד במקום N קריאות create.
      await tx.transaction.createMany({ data: transactionRecords });

      return rewardResults;
    };

    return tx ? run(tx) : prisma.$transaction(run);
  },

  // ========================================
  // 4. מערכת מתנות (Gifts)
  // ========================================

  async sendGift(senderId, receiverPlayerId, moderatorId, giftValue, gameId) {
    // Validated before the transaction opens — a non-positive giftValue would flip the decrement below into a credit for the sender.
    if (
      typeof giftValue !== 'number' ||
      !Number.isFinite(giftValue) ||
      giftValue <= 0
    ) {
      throw new Error(ERROR_MESSAGES.INVALID_GIFT_VALUE);
    }

    if (giftValue > GAME_SETTINGS.MAX_GIFT_AMOUNT) {
      throw new Error(
        formatMessage(ERROR_MESSAGES.GIFT_EXCEEDS_MAX, {
          max: GAME_SETTINGS.MAX_GIFT_AMOUNT,
        })
      );
    }

    return await prisma.$transaction(async (tx) => {
      const game = await tx.game.findUnique({ where: { id: gameId } });
      if (!game) throw new Error(ERROR_MESSAGES.GAME_NOT_FOUND);

      const sender = await tx.user.findUnique({ where: { id: senderId } });
      const senderBalance = this._toNumber(sender?.walletBalance);

      if (senderBalance < giftValue)
        throw new Error(ERROR_MESSAGES.INSUFFICIENT_COINS);

      await tx.user.update({
        where: { id: senderId },
        data: { walletBalance: { decrement: giftValue } },
      });

      const playerShare = Math.floor(giftValue * 0.35);
      const hostShare = giftValue - playerShare;

      await tx.user.update({
        where: { id: receiverPlayerId },
        data: { walletBalance: { increment: playerShare } },
      });

      await tx.user.update({
        where: { id: moderatorId },
        data: { walletBalance: { increment: hostShare } },
      });

      await tx.gameParticipant.upsert({
        where: { gameId_userId: { gameId, userId: receiverPlayerId } },
        update: { score: { increment: playerShare } },
        create: {
          gameId,
          userId: receiverPlayerId,
          score: playerShare,
          role: 'VIEWER',
        },
      });

      await tx.transaction.createMany({
        data: [
          {
            userId: senderId,
            type: 'GIFT',
            amount: -giftValue,
            gameId,
            currency: 'COIN',
            status: 'SUCCESS',
          },
          {
            userId: receiverPlayerId,
            type: 'GIFT',
            amount: playerShare,
            gameId,
            currency: 'COIN',
            status: 'SUCCESS',
          },
          {
            userId: moderatorId,
            type: 'GIFT',
            amount: hostShare,
            gameId,
            currency: 'COIN',
            status: 'SUCCESS',
          },
        ],
      });

      return { giftValue, playerShare, hostShare };
    });
  },
};

export default economyService;
