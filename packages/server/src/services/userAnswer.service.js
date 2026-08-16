/**
 * userAnswer.service.js
 *
 * שכבת השירות להגשת תשובות והימורים על שאלות במשחק.
 * מקור האמת העסקי היחיד להימור — גם ה-REST endpoint (POST /user-answers/submit)
 * וגם אירוע ה-Socket.IO (PLACE_BET) קוראים לפונקציה הזו, כדי שכל כללי הקבלה
 * (סכום, יתרה, השתתפות, תפקיד VIEWER בלבד, סטטוס שאלה/משחק) ייאכפו במקום אחד בלבד.
 * הימור מוגבל לתפקיד VIEWER בלבד (SPEC §2) — Player/Moderator/Host אינם מהמרים.
 * כל הגשה מנוכה מהארנק ונשמרת בטרנזקציה אטומית.
 * לאחר הטרנזקציה מתבצע סנכרון יתרה ל-UI דרך Socket.IO.
 *
 * פונקציות:
 *   submitAnswer(io, userId, inputData) — ולידציה + ניכוי מטבעות + שמירת תשובה
 *
 * מתקשר עם: Prisma → User, UserAnswer, Question, GameParticipant
 * תלוי ב:   SubmitAnswerSchema (Zod validation), socketHelpers (Socket.IO sync)
 * משמש את:  Socket.IO event handlers (PLACE_BET) ו-REST (POST /user-answers/submit)
 */
import prisma from '../lib/prisma.js';
import { syncUserBalances } from '../utils/socketHelpers.js';
import { SubmitAnswerSchema } from '../../../shared/src/index.js';
import { ERROR_MESSAGES } from '@worldplay/shared';
import { GameStatus, UserRole } from '@prisma/client';

const userAnswerService = {
  async submitAnswer(io, userId, inputData) {
    const validatedData = SubmitAnswerSchema.parse(inputData);
    const { questionId, selectedOptionId, wager } = validatedData;

    // Keep authorization checks and wallet mutation in one transaction.
    const result = await prisma.$transaction(async (tx) => {
      // FOR SHARE (לא FOR UPDATE) על שורת השאלה: מהמרים שונים על אותה שאלה
      // תואמים זה לזה (SHARE מול SHARE לא מתנגש) ולכן רצים במקביל, בלי
      // לעצור זה את זה בתור. סגירת שאלה מקבילה (resolveQuestion, UPDATE על
      // is_resolved) עדיין מתנגשת עם SHARE — אז היא נחסמת נכון מול הימור
      // פעיל, וסגירה שכבר התחייבה נקראת נכון על ידי הימור שמתחיל אחריה.
      // הגייט על isResolved קורא מהערך שחוזר מהשאילתה הנועלת עצמה — לא
      // מקריאה נפרדת אחריה — כדי שהבדיקה לא תוכל "להישאר" בטעות על ערך ישן.
      const [lockedQuestion] = await tx.$queryRaw`
        SELECT id, is_resolved AS "isResolved"
        FROM "questions"
        WHERE id = ${questionId}
        FOR SHARE
      `;

      if (!lockedQuestion) throw new Error(ERROR_MESSAGES.QUESTION_NOT_FOUND);
      if (lockedQuestion.isResolved)
        throw new Error(ERROR_MESSAGES.QUESTION_ALREADY_CLOSED);

      const question = await tx.question.findUnique({
        where: { id: questionId },
        include: { game: true, options: { select: { id: true } } },
      });

      if (question.game.status !== GameStatus.ACTIVE)
        throw new Error(ERROR_MESSAGES.GAME_NOT_ACTIVE);
      if (!question.options.some((option) => option.id === selectedOptionId))
        throw new Error(ERROR_MESSAGES.OPTION_DOES_NOT_BELONG_TO_QUESTION);

      const participant = await tx.gameParticipant.findUnique({
        where: {
          gameId_userId: { gameId: question.gameId, userId },
        },
      });
      if (!participant) throw new Error(ERROR_MESSAGES.NOT_GAME_PARTICIPANT);
      if (participant.role !== UserRole.VIEWER)
        throw new Error(ERROR_MESSAGES.NOT_AUTHORIZED_TO_BET);

      // נעילת שורת המשתמש עד סוף הטרנזקציה — מסדרת per-user את קריאת
      // previousWager מול כתיבת הארנק כדי למנוע race בין הגשות מקבילות.
      await tx.$queryRaw`SELECT "walletBalance" FROM "users" WHERE id = ${userId} FOR UPDATE`;

      const previousAnswer = await tx.userAnswer.findUnique({
        where: { userId_questionId: { userId, questionId } },
        select: { wager: true },
      });
      const previousWager = Number(previousAnswer?.wager ?? 0);
      const wagerDelta = wager - previousWager;

      if (wagerDelta > 0) {
        const balanceUpdate = await tx.user.updateMany({
          where: { id: userId, walletBalance: { gte: wagerDelta } },
          data: { walletBalance: { decrement: wagerDelta } },
        });
        if (balanceUpdate.count !== 1)
          throw new Error(ERROR_MESSAGES.INSUFFICIENT_COINS);
      } else if (wagerDelta < 0) {
        await tx.user.update({
          where: { id: userId },
          data: { walletBalance: { increment: Math.abs(wagerDelta) } },
        });
      }

      const answer = await tx.userAnswer.upsert({
        where: { userId_questionId: { userId, questionId } },
        update: {
          wager,
          option: { connect: { id: selectedOptionId } },
        },
        create: {
          wager,
          user: { connect: { id: userId } },
          question: { connect: { id: questionId } },
          option: { connect: { id: selectedOptionId } },
        },
      });

      return { answer, gameId: question.gameId };
    });

    // סנכרון אחרי סגירת הטרנזקציה — מבטיח שהיתרה שנשלחת ל-UI כבר מעודכנת ב-DB
    setImmediate(async () => {
      try {
        await syncUserBalances(io, userId, result.gameId);
      } catch {
        // כישלון בסנכרון לא אמור להחזיר שגיאה למשתמש
      }
    });

    return result.answer;
  },
};

export default userAnswerService;
