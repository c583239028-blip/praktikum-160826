/**
 * userAnswer.concurrency.integration.test.js
 *
 * טסט אינטגרציה מול Postgres אמיתי (לא mocked) — SCRUM-296, 3.8.
 * מוודא שהגשות submitAnswer מקבילות של אותו משתמש על אותה שאלה (זוג,
 * וגם burst גדול יותר) לא יוצרות מטבעות יש מאין (נתיב החזר) ולא גובות
 * ביתר (נתיב ניכוי), הודות לנעילת שורת המשתמש (SELECT ... FOR UPDATE)
 * בתוך הטרנזקציה. משתמש במחסום (armBarrier) כדי לכפות חפיפה אמיתית בין
 * הטרנזקציות המקבילות, בלי תלות במזל תזמון מול DB מקומי מהיר.
 *
 * גם מכסה את המרוץ מול סגירת שאלה (FOR SHARE על שורת ה-question): מהמרים
 * שונים על אותה שאלה חייבים לרוץ במקביל (SHARE תואם ל-SHARE), וסגירה
 * מקבילה (resolveQuestion, UPDATE) חייבת עדיין להיחסם/לחסום נכון.
 *
 * דורש DATABASE_URL אמיתי (Docker מקומי או ה-Postgres החד-פעמי של CI
 * ב-server-tests.yml) — לא רץ מול Prisma מדומה כמו שאר הטסטים.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import prisma from '../lib/prisma.js';
import userAnswerService from '../services/userAnswer.service.js';
import { GameStatus, UserRole } from '@prisma/client';
import { ERROR_MESSAGES } from '@worldplay/shared';

const io = {};

// מחסום (barrier) אמיתי, לא ניחוש זמן: כל טרנזקציה שמגיעה לקריאת
// previousWager (UserAnswer.findUnique) עוצרת ומחכה עד שבדיוק N טרנזקציות
// הגיעו לאותה נקודה — ורק אז כולן משתחררות ביחד. כך מובטחת חפיפה מלאה
// בין כל ה-N קריאות המקבילות, בלי תלות בתזמון רשת/מערכת.
// שסתום ביטחון: אם הנעילה עובדת, לעולם לא יגיעו N טרנזקציות ל-checkpoint
// בו-זמנית (הן מסודרות אחת-אחת לפני זה, ב-FOR UPDATE) — אז לא מחכים לנצח,
// אחרי BARRIER_TIMEOUT_MS ממשיכים בכל מקרה (זה בדיוק המצב התקין/מתוקן).
const BARRIER_TIMEOUT_MS = 100;
let barrierExpected = 0;
let barrierArrived = 0;
let releaseBarrier;
let barrierPromise;

function armBarrier(expectedCount) {
  barrierExpected = expectedCount;
  barrierArrived = 0;
  barrierPromise = new Promise((resolve) => {
    releaseBarrier = resolve;
  });
}

prisma.$use(async (params, next) => {
  if (
    barrierExpected > 0 &&
    params.model === 'UserAnswer' &&
    params.action === 'findUnique'
  ) {
    barrierArrived += 1;
    if (barrierArrived >= barrierExpected) {
      releaseBarrier();
    }
    await Promise.race([
      barrierPromise,
      new Promise((resolve) => setTimeout(resolve, BARRIER_TIMEOUT_MS)),
    ]);
  }
  return next(params);
});

describe('userAnswerService.submitAnswer — מקביליות מול DB אמיתי', () => {
  let hostId, userId, streamId, gameId, questionId, optionId;

  beforeEach(async () => {
    hostId = randomUUID();
    userId = randomUUID();
    streamId = randomUUID();
    gameId = randomUUID();
    questionId = randomUUID();
    optionId = randomUUID();

    await prisma.user.create({
      data: {
        id: hostId,
        username: `host-${hostId}`,
        email: `${hostId}@test.local`,
      },
    });
    await prisma.user.create({
      data: {
        id: userId,
        username: `viewer-${userId}`,
        email: `${userId}@test.local`,
        walletBalance: 100,
      },
    });
    await prisma.stream.create({
      data: { id: streamId, title: 'concurrency-test-stream', hostId },
    });
    await prisma.game.create({
      data: {
        id: gameId,
        title: 'concurrency-test-game',
        hostId,
        streamId,
        status: GameStatus.ACTIVE,
      },
    });
    await prisma.question.create({
      data: { id: questionId, gameId, questionText: 'q', isResolved: false },
    });
    await prisma.questionOption.create({
      data: { id: optionId, questionId, text: 'opt' },
    });
    await prisma.gameParticipant.create({
      data: { gameId, userId, role: UserRole.VIEWER },
    });
  });

  afterEach(async () => {
    await prisma.userAnswer.deleteMany({ where: { questionId } });
    await prisma.gameParticipant.deleteMany({ where: { gameId } });
    await prisma.questionOption.deleteMany({ where: { questionId } });
    await prisma.question.deleteMany({ where: { id: questionId } });
    await prisma.game.deleteMany({ where: { id: gameId } });
    await prisma.stream.deleteMany({ where: { id: streamId } });
    await prisma.user.deleteMany({ where: { id: { in: [userId, hostId] } } });
  });

  it('נתיב החזר: שתי הגשות מקבילות שמורידות הימור — אין יצירת מטבעות יש מאין', async () => {
    // הימור קיים: 25 → יתרה יורדת ל-75 (תואם לתרחיש בטיקט)
    await userAnswerService.submitAnswer(io, userId, {
      questionId,
      selectedOptionId: optionId,
      wager: 25,
    });

    armBarrier(2);
    try {
      await Promise.all([
        userAnswerService.submitAnswer(io, userId, {
          questionId,
          selectedOptionId: optionId,
          wager: 10,
        }),
        userAnswerService.submitAnswer(io, userId, {
          questionId,
          selectedOptionId: optionId,
          wager: 10,
        }),
      ]);
    } finally {
      barrierExpected = 0;
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    // ללא התיקון: 105 (15 מטבעות שנוצרו יש מאין). עם התיקון: 90.
    expect(Number(user.walletBalance)).toBe(90);

    const answers = await prisma.userAnswer.findMany({
      where: { userId, questionId },
    });
    expect(answers).toHaveLength(1);
    expect(Number(answers[0].wager)).toBe(10);
  });

  it('שתי הגשות מקבילות עם ערכים שונים — היתרה תואמת בדיוק להימור שנשמר', async () => {
    // בניגוד לטסטים האחרים (שני הצדדים שולחים אותו wager) — כאן הערכים
    // שונים (10 מול 20), בלי הנחה איזו הגשה "מנצחת". בודקת את האינווריאנט
    // "היתרה משקפת את ההימור האחרון בלבד" בצורה שלא תלויה בסדר scheduling.
    await userAnswerService.submitAnswer(io, userId, {
      questionId,
      selectedOptionId: optionId,
      wager: 25,
    });

    armBarrier(2);
    try {
      await Promise.all([
        userAnswerService.submitAnswer(io, userId, {
          questionId,
          selectedOptionId: optionId,
          wager: 10,
        }),
        userAnswerService.submitAnswer(io, userId, {
          questionId,
          selectedOptionId: optionId,
          wager: 20,
        }),
      ]);
    } finally {
      barrierExpected = 0;
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    const answer = await prisma.userAnswer.findUnique({
      where: { userId_questionId: { userId, questionId } },
    });

    expect([10, 20]).toContain(Number(answer.wager));
    // 100 - ההימור שבפועל נשמר — לא משנה איזו משתי ההגשות "ניצחה"
    expect(Number(user.walletBalance)).toBe(100 - Number(answer.wager));
  });

  it('נתיב ניכוי: שתי הגשות מקבילות שמעלות הימור — אין חיוב-יתר', async () => {
    // הימור קיים: 10 → יתרה יורדת ל-90
    await userAnswerService.submitAnswer(io, userId, {
      questionId,
      selectedOptionId: optionId,
      wager: 10,
    });

    armBarrier(2);
    try {
      await Promise.all([
        userAnswerService.submitAnswer(io, userId, {
          questionId,
          selectedOptionId: optionId,
          wager: 40,
        }),
        userAnswerService.submitAnswer(io, userId, {
          questionId,
          selectedOptionId: optionId,
          wager: 40,
        }),
      ]);
    } finally {
      barrierExpected = 0;
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    // ללא התיקון: 30 (חיוב-יתר של 30). עם התיקון: 60.
    expect(Number(user.walletBalance)).toBe(60);

    const answers = await prisma.userAnswer.findMany({
      where: { userId, questionId },
    });
    expect(answers).toHaveLength(1);
    expect(Number(answers[0].wager)).toBe(40);
  });

  it('בקשות burst (12 הגשות מקבילות) — כל הממתינים מסתדרים בתור, לא רק זוג', async () => {
    // תרחיש תוקף שיורה הרבה בקשות בו-זמנית במכוון (לא רק 2) — מדמה טוב
    // יותר double-tap אמיתי, כמה מכשירים, וניסיון ניצול מכוון. מוודאת
    // שהנעילה מתנהגת כתור לכל מספר ממתינים, לא רק לזוג.
    await userAnswerService.submitAnswer(io, userId, {
      questionId,
      selectedOptionId: optionId,
      wager: 25,
    });

    const CONCURRENT_SUBMISSIONS = 12;
    armBarrier(CONCURRENT_SUBMISSIONS);
    try {
      const results = await Promise.allSettled(
        Array.from({ length: CONCURRENT_SUBMISSIONS }, () =>
          userAnswerService.submitAnswer(io, userId, {
            questionId,
            selectedOptionId: optionId,
            wager: 10,
          })
        )
      );
      // כל ה-12 אמורות להצליח — אין rate limiting/timeout צפוי בהיקף הזה
      expect(results.filter((r) => r.status === 'rejected')).toHaveLength(0);
    } finally {
      barrierExpected = 0;
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    // ללא התיקון: 75 + (15 * 12) = 255. עם התיקון: 90.
    expect(Number(user.walletBalance)).toBe(90);

    const answers = await prisma.userAnswer.findMany({
      where: { userId, questionId },
    });
    expect(answers).toHaveLength(1);
    expect(Number(answers[0].wager)).toBe(10);
  });

  it('נעילת השורה חוסמת טרנזקציה מקבילה על אותו userId עד commit (בדיקה ישירה, לא תלוית-תזמון)', async () => {
    // בודקת ישירות את התנהגות FOR UPDATE, בלי לעבור דרך submitAnswer,
    // כדי לא להיות תלויה במזל תזמון של Promise.all מול DB אמיתי.
    let releaseFirst;
    const firstMayRelease = new Promise((resolve) => {
      releaseFirst = resolve;
    });
    let firstLockAcquired;
    const firstLockAcquiredPromise = new Promise((resolve) => {
      firstLockAcquired = resolve;
    });

    const tx1Promise = prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "walletBalance" FROM "users" WHERE id = ${userId} FOR UPDATE`;
      firstLockAcquired();
      await firstMayRelease;
    });

    // מוודאים שהטרנזקציה הראשונה כבר תופסת את הנעילה לפני שמתחילים את השנייה
    await firstLockAcquiredPromise;

    let secondResolved = false;
    const tx2Promise = prisma
      .$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "walletBalance" FROM "users" WHERE id = ${userId} FOR UPDATE`;
      })
      .then(() => {
        secondResolved = true;
      });

    // אחרי המתנה קצרה, הטרנזקציה השנייה עדיין אמורה להיות חסומה
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(secondResolved).toBe(false);

    releaseFirst();
    await tx1Promise;
    await tx2Promise;
    expect(secondResolved).toBe(true);
  });

  it('התרחיש מהטיקט: המנחה סוגרת את השאלה בדיוק כשההימור נשמר — ההימור נדחה, בלי שינוי בארנק ובלי שורת UserAnswer', async () => {
    // מדמה את הצעד המרכזי של resolveQuestion (UPDATE על "is_resolved") בלי
    // להריץ את כל השירות (מנחה/permissions/חלוקת זכייה) — מספיק כדי לתפוס
    // בפועל את נעילת שורת השאלה לפני ש-submitAnswer מגיע אליה, בדיוק כמו
    // בתרחיש התחרותי בטיקט. שליטה מפורשת בסדר (promises), לא תלוית-תזמון.
    let releaseClose;
    const closeMayCommit = new Promise((resolve) => {
      releaseClose = resolve;
    });
    let closeLockAcquired;
    const closeLockAcquiredPromise = new Promise((resolve) => {
      closeLockAcquired = resolve;
    });

    const closePromise = prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "questions" WHERE id = ${questionId} FOR UPDATE`;
      closeLockAcquired();
      await closeMayCommit;
      await tx.question.update({
        where: { id: questionId },
        data: { isResolved: true },
      });
    });

    // מוודאים שהסגירה כבר תופסת את נעילת שורת השאלה לפני שההימור מתחרה עליה
    await closeLockAcquiredPromise;

    const submitPromise = userAnswerService.submitAnswer(io, userId, {
      questionId,
      selectedOptionId: optionId,
      wager: 10,
    });
    let submitSettled = false;
    submitPromise.then(
      () => {
        submitSettled = true;
      },
      () => {
        submitSettled = true;
      }
    );

    // אחרי המתנה קצרה, ההימור עדיין אמור להיות חסום מאחורי נעילת הסגירה —
    // בלי התיקון, הוא לא היה נחסם כאן ופשוט היה נשמר על שאלה שעומדת להיסגר.
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(submitSettled).toBe(false);

    releaseClose();
    await closePromise;

    await expect(submitPromise).rejects.toThrow(
      ERROR_MESSAGES.QUESTION_ALREADY_CLOSED
    );

    const user = await prisma.user.findUnique({ where: { id: userId } });
    expect(Number(user.walletBalance)).toBe(100);

    const answers = await prisma.userAnswer.findMany({
      where: { userId, questionId },
    });
    expect(answers).toHaveLength(0);
  });

  it('שאלה חמה: הרבה משתמשים שונים מהמרים בו-זמנית על אותה שאלה — כולם עוברים, בלי timeout (FOR SHARE, לא FOR UPDATE)', async () => {
    // §7.4: משחקים עם 50+ צופים שמהמרים על אותה שאלה באותה שנייה הם
    // steady state, לא edge-case. עם FOR UPDATE על שורת השאלה, מהמרים
    // שונים היו מסתדרים בתור אחד-אחד וחלקם נכשלים בשגיאת maxWait גולמית
    // ("Unable to start a transaction..."). FOR SHARE תואם לעצמו, אז
    // מהמרים לא אמורים לחסום זה את זה בכלל.
    const BETTORS = 60;
    const bettorIds = Array.from({ length: BETTORS }, () => randomUUID());

    await prisma.user.createMany({
      data: bettorIds.map((id) => ({
        id,
        username: `hot-${id}`,
        email: `${id}@test.local`,
        walletBalance: 100,
      })),
    });
    await prisma.gameParticipant.createMany({
      data: bettorIds.map((id) => ({
        gameId,
        userId: id,
        role: UserRole.VIEWER,
      })),
    });

    try {
      const results = await Promise.allSettled(
        bettorIds.map((id) =>
          userAnswerService.submitAnswer(io, id, {
            questionId,
            selectedOptionId: optionId,
            wager: 10,
          })
        )
      );

      const rejected = results.filter((r) => r.status === 'rejected');
      if (rejected.length > 0) {
        console.error(
          'רוב-מהמרים על שאלה חמה — כשלים לא צפויים:',
          rejected.map((r) => r.reason?.message)
        );
      }
      expect(rejected).toHaveLength(0);

      const answers = await prisma.userAnswer.findMany({
        where: { questionId, userId: { in: bettorIds } },
      });
      expect(answers).toHaveLength(BETTORS);
    } finally {
      await prisma.userAnswer.deleteMany({
        where: { userId: { in: bettorIds } },
      });
      await prisma.gameParticipant.deleteMany({
        where: { userId: { in: bettorIds } },
      });
      await prisma.user.deleteMany({ where: { id: { in: bettorIds } } });
    }
  });
});
