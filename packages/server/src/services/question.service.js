/**
 * question.service.js
 *
 * שכבת השירות לניהול שאלות במשחק — יצירה, סגירה, ושליפה.
 * סגירת שאלה (resolveQuestion) מפעילה אוטומטית את מנוע הכלכלה לחלוקת הקופה.
 *
 * סוגי שאלות:
 *   STANDARD        — חלוקה פרופורציונלית בין שחקנים + 125% לעונים נכון
 *   WINNER_TAKES_ALL — 85% לזוכה, 15% למנחה
 *
 * פונקציות:
 *   createQuestion(gameId, userId, data)              — יצירת שאלה עם אופציות
 *   resolveQuestion(questionId, userId, optionId)     — סגירת שאלה + חלוקת כסף
 *   getGameQuestions(gameId)                          — כל שאלות המשחק
 *   getQuestionById(questionId)                       — שאלה בודדת עם פרטים
 *
 * מתקשר עם: Prisma → Question, QuestionOption, UserAnswer
 * תלוי ב:   validation.service.js, permissions.service.js, economy.service.js
 * משמש את:  question.controller.js, Socket.IO event handlers
 */
import * as gameRules from '../services/validation.service.js';
import permissionsService from './permissions.service.js';
import economyService from './economy.service.js';
import prisma from '../lib/prisma.js';
import { ERROR_MESSAGES } from '@worldplay/shared';
import { GAME_SETTINGS } from '../constants/gameRules.js';
import { QuestionApprovalStatus } from '@prisma/client';

// שדות המחבר שנחשפים החוצה (event payload + GET). לא כולל שדות רגישים של User.
const AUTHOR_SELECT = { id: true, username: true, avatarUrl: true };

const questionService = {
  async createQuestion(
    gameId,
    userId,
    { questionText, rewardType, options, timeLimit, isDraft }
  ) {
    const game = await gameRules.ensureGameExists(gameId);
    gameRules.validateGameIsActive(game);
    gameRules.validateQuestionData(questionText, options);
    await permissionsService.ensureModerator(gameId, userId);

    const question = await prisma.question.create({
      data: {
        gameId,
        questionText,
        // userId כבר נבדק ל-ensureModerator; כאן הוא נשמר כמחבר השאלה (Q1a).
        authorId: userId,
        rewardType: rewardType || 'STANDARD',
        isResolved: false,
        timeLimit: timeLimit ?? GAME_SETTINGS.DEFAULT_QUESTION_TIMER,
        isDraft: isDraft ?? false,
        options: {
          create: options.map((option) => ({
            text: option.text,
            isCorrect: option.isCorrect || false,
            linkedPlayerId: option.linkedPlayerId || null, // חיוני ל-WINNER_TAKES_ALL
          })),
        },
      },
      include: { options: true, author: { select: AUTHOR_SELECT } },
    });

    // streamId הוא שדה של ה-Game (כבר שלוף ב-ensureGameExists), מוחזר בנפרד
    // ל-fan-out לחדר הסטרים — לא ממוזג לתוך ה-question. ראה 230.
    return { question, streamId: game.streamId };
  },

  // Q1b — שליחת שאלה על ידי צופה: טקסט בלבד, בלי תשובות, ממתינה לאישור מנחה.
  // פתוח לכל משתתף במשחק (כולל VIEWER) — זר נדחה ב-ensureParticipant.
  // לא משודר ב-game:new_question; הופך לניתן-לפרסום רק לאחר approveQuestion.
  async submitViewerQuestion(gameId, userId, { questionText }) {
    const game = await gameRules.ensureGameExists(gameId);
    gameRules.validateGameIsActive(game);
    gameRules.validateQuestionText(questionText);
    await permissionsService.ensureParticipant(gameId, userId);

    const question = await prisma.question.create({
      data: {
        gameId,
        questionText,
        authorId: userId, // הצופה שכתב את השאלה (Q1a)
        rewardType: 'STANDARD',
        isResolved: false,
        isDraft: false, // מובחן מטיוטת מנחה — לכן לא נכלל ב-selectDraftQuestions
        approvalStatus: QuestionApprovalStatus.PENDING,
        timeLimit: GAME_SETTINGS.DEFAULT_QUESTION_TIMER,
      },
      include: { options: true, author: { select: AUTHOR_SELECT } },
    });

    return { question, streamId: game.streamId };
  },

  // Q1b — אישור מנחה לשאלת צופה ממתינה: המנחה מוסיפה את התשובות והשאלה הופכת
  // לניתנת-לפרסום. כאן (ולא בשליחה) נאכף כלל המינימום שתי תשובות.
  async approveQuestion(
    questionId,
    userId,
    { options, rewardType, timeLimit }
  ) {
    const question = await prisma.question.findUnique({
      where: { id: questionId },
    });

    if (!question) throw new Error(ERROR_MESSAGES.QUESTION_NOT_FOUND);

    // הרשאה נבדקת לפני מצב ה-PENDING כדי לא לדלוף מצב שאלה למי שאינו מנחה.
    await permissionsService.ensureModerator(question.gameId, userId);

    if (question.approvalStatus !== QuestionApprovalStatus.PENDING)
      throw new Error(ERROR_MESSAGES.QUESTION_NOT_PENDING_APPROVAL);

    // מעבר לפרסום — כאן נדרשות לפחות שתי תשובות.
    if (!Array.isArray(options) || options.length < 2)
      throw new Error(ERROR_MESSAGES.QUESTION_OPTIONS_REQUIRED);

    const updated = await prisma.question.update({
      where: { id: questionId },
      data: {
        approvalStatus: QuestionApprovalStatus.APPROVED,
        rewardType: rewardType || question.rewardType,
        timeLimit: timeLimit ?? question.timeLimit,
        options: {
          create: options.map((option) => ({
            text: option.text,
            isCorrect: option.isCorrect || false,
            linkedPlayerId: option.linkedPlayerId || null,
          })),
        },
      },
      include: { options: true, author: { select: AUTHOR_SELECT } },
    });

    return updated;
  },

  // Q1b — דחיית מנחה לשאלת צופה ממתינה. השאלה נשארת במערכת במצב REJECTED,
  // ולעולם אינה משודרת ב-game:new_question.
  async rejectQuestion(questionId, userId) {
    const question = await prisma.question.findUnique({
      where: { id: questionId },
    });

    if (!question) throw new Error(ERROR_MESSAGES.QUESTION_NOT_FOUND);

    // הרשאה נבדקת לפני מצב ה-PENDING כדי לא לדלוף מצב שאלה למי שאינו מנחה.
    await permissionsService.ensureModerator(question.gameId, userId);

    if (question.approvalStatus !== QuestionApprovalStatus.PENDING)
      throw new Error(ERROR_MESSAGES.QUESTION_NOT_PENDING_APPROVAL);

    return await prisma.question.update({
      where: { id: questionId },
      data: { approvalStatus: QuestionApprovalStatus.REJECTED },
      include: { options: true, author: { select: AUTHOR_SELECT } },
    });
  },

  async resolveQuestion(questionId, userId, correctOptionId) {
    const question = await prisma.question.findUnique({
      where: { id: questionId },
      include: { game: true },
    });

    if (!question) throw new Error(ERROR_MESSAGES.QUESTION_NOT_FOUND);
    // בדיקה מוקדמת וזולה — חוסכת פתיחת טרנזקציה לשאלה שכבר נסגרה במקרה הרגיל.
    // אינה השער האמיתי נגד מרוץ; זה נעשה אטומית ב-updateMany בתוך הטרנזקציה (B1).
    if (question.isResolved)
      throw new Error(ERROR_MESSAGES.QUESTION_ALREADY_RESOLVED);

    await permissionsService.ensureModerator(question.gameId, userId);

    // A4 — timeout מדורג לפי מספר העונים: חלוקת STANDARD מעדכנת ארנק+ניקוד פר-משתמש,
    // כך שברירת-המחדל של 5s חורגת סביב ~50 עונים (§7.4). מחושב לפני פתיחת הטרנזקציה.
    const responders = await prisma.userAnswer.count({ where: { questionId } });
    const txTimeout = Math.min(60000, 10000 + responders * 250);

    // A1 — טרנזקציה אינטראקטיבית אחת שעוטפת את הכל: השער האטומי, סימון התשובה
    // הנכונה, חלוקת הקופה, ותגמול העונים. כשל בכל שלב מגלגל את כולם לאחור,
    // כולל isResolved — כך אין יותר מצב "נעול אך לא שולם" ואפשר לנסות שוב.
    const { distributionResult, rewardResults } = await prisma.$transaction(
      async (tx) => {
        // B1 — שער compare-and-swap אטומי נגד double-resolve: הסימון isResolved
        // הוא הצעד הראשון, מותנה ב-isResolved:false. שני resolve מקבילים —
        // רק לאחד count===1; לשני count===0 → ALREADY_RESOLVED, ללא חלוקה כפולה.
        // אותו דפוס כמו game.service.resolveQuestion; נתיב ה-REST היה חסר אותו.
        const gate = await tx.question.updateMany({
          where: { id: questionId, isResolved: false },
          data: { isResolved: true },
        });

        if (gate.count === 0)
          throw new Error(ERROR_MESSAGES.QUESTION_ALREADY_RESOLVED);

        await tx.questionOption.updateMany({
          where: { questionId },
          data: { isCorrect: false },
        });
        await tx.questionOption.update({
          where: { id: correctOptionId },
          data: { isCorrect: true },
        });

        const distributionResult =
          question.rewardType === 'WINNER_TAKES_ALL'
            ? await economyService.processWinnerPayout(
                questionId,
                correctOptionId,
                userId,
                question.gameId,
                tx
              )
            : await economyService.distributeStandardPot(
                questionId,
                question.gameId,
                userId,
                tx
              );

        const rewardResults = await economyService.rewardCorrectAnswers(
          questionId,
          question.gameId,
          correctOptionId,
          tx
        );

        return { distributionResult, rewardResults };
      },
      { timeout: txTimeout, maxWait: txTimeout }
    );

    const resolvedQuestion = await prisma.question.findUnique({
      where: { id: questionId },
      include: {
        options: true,
        answers: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
              },
            },
          },
        },
      },
    });

    return {
      question: resolvedQuestion,
      // מהשליפה הראשונה (שורה ~59) שכוללת game — לא מ-resolvedQuestion שאין בה game.
      streamId: question.game.streamId,
      distribution: distributionResult,
      correctAnswerRewards: rewardResults,
      summary: {
        totalPot: distributionResult?.totalPot || 0,
        rewardType: question.rewardType,
        participantsRewarded: rewardResults.length,
        timestamp: new Date(),
      },
    };
  },

  async getGameQuestions(gameId) {
    await gameRules.ensureGameExists(gameId);

    const questions = await prisma.question.findMany({
      where: { gameId },
      include: {
        options: true,
        author: { select: AUTHOR_SELECT },
        answers: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
              },
            },
          },
        },
        // מונה משתתפים לשאלה — ספירת UserAnswer בפועל. בזכות @@unique([userId, questionId])
        // כל שורה = משתתף ייחודי, כך שזו ספירה מדויקת ולא הערכה.
        _count: { select: { answers: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    // חושפים participantsCount שטוח לכל שאלה (הלקוח קורא question.participantsCount)
    // ומשמיטים את אובייקט ה-_count הפנימי של Prisma.
    return questions.map(({ _count, ...question }) => ({
      ...question,
      participantsCount: _count?.answers ?? 0,
    }));
  },

  async getQuestionById(questionId) {
    const question = await prisma.question.findUnique({
      where: { id: questionId },
      include: {
        options: true,
        author: { select: AUTHOR_SELECT },
        answers: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
              },
            },
          },
        },
        game: {
          select: {
            id: true,
            title: true,
            status: true,
          },
        },
      },
    });

    if (!question) {
      throw new Error(ERROR_MESSAGES.QUESTION_NOT_FOUND);
    }

    return question;
  },
};

export default questionService;
