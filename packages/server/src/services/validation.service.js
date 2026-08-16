/**
 * validation.service.js
 *
 * שירות הולידציה המרכזי של האפליקציה — כמעט כל שירות אחר תלוי בו.
 * מחולק לארבעה אזורים:
 *   1. בדיקות קיום    — ensureXxxExists (זורקות שגיאה אם הרשומה לא נמצאת)
 *   2. בדיקות סטטוס   — validateXxx (זורקות שגיאה אם הסטטוס לא מתאים)
 *   3. ולידציות מורכבות — validateJoinEligibility, ensureQuestionIsBetable
 *   4. עזרים          — validateNonEmptyText, mergeUniqueIds, getSignificantInteractionRules
 *
 * מיוצא גם כ-named exports וגם כ-default object —
 * שירותים שמשתמשים ב-import * as gameRules יקבלו את ה-named exports.
 *
 * מתקשר עם: Prisma → Game, Stream, User, Notification, GameParticipant, Question
 * תלוי ב:   אין תלויות חיצוניות
 * משמש את:  כל שירותי השרת
 */
import prisma from '../lib/prisma.js';
import { ERROR_MESSAGES, JOIN_ELIGIBILITY_STATUS } from '@worldplay/shared';
import { GameStatus, StreamStatus, UserRole } from '@prisma/client';

// --- בדיקות קיום (Existence) ---

export const ensureGameExists = async (gameId) => {
  // חיפוש ישיר - UUID הוא מחרוזת וצריך להישאר כזו
  const game = await prisma.game.findUnique({
    where: { id: gameId },
  });

  if (!game) throw new Error(ERROR_MESSAGES.GAME_NOT_FOUND);
  return game;
};

export const ensureStreamExists = async (streamId) => {
  const stream = await prisma.stream.findUnique({ where: { id: streamId } });
  if (!stream) throw new Error(ERROR_MESSAGES.STREAM_NOT_FOUND);
  return stream;
};

export const ensureUserExists = async (userId) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error(`User with ID ${userId} not found`);
  return user;
};

export const ensureUserExistsByEmail = async (email) => {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error('אימייל או סיסמה שגויים.');
  return user;
};

export const validateEmailIsUnique = async (email) => {
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) throw new Error('משתמש עם אימייל זה כבר קיים.');
};

// --- בדיקות סטטוס וזמינות ---

export const validateGameIsActive = (game) => {
  if (game.status !== GameStatus.ACTIVE) {
    throw new Error(`Action not allowed. Game is currently ${game.status}`);
  }
};

export const validateStatusTransition = (currentStatus, newStatus) => {
  if (currentStatus === GameStatus.FINISHED)
    throw new Error(ERROR_MESSAGES.GAME_ALREADY_FINISHED);
  if (currentStatus === newStatus)
    throw new Error(`Game is already ${newStatus}`);
};

export const validateStreamIsFree = async (streamId) => {
  const busyStreamGame = await prisma.game.findFirst({
    where: {
      streamId: streamId,
      status: { in: [GameStatus.WAITING, GameStatus.ACTIVE] },
    },
  });
  if (busyStreamGame) {
    throw new Error(
      `Stream is currently busy with another game: "${busyStreamGame.title}"`
    );
  }
};

export const validateUserHasNoActiveStream = async (userId) => {
  const activeStream = await prisma.stream.findFirst({
    where: {
      hostId: userId,
      status: {
        in: [StreamStatus.WAITING, StreamStatus.LIVE, StreamStatus.PAUSE],
      },
    },
  });

  if (activeStream) {
    throw new Error(
      `You already have an active stream: "${activeStream.title}". Please finish it before.`
    );
  }
};

export const validateHostIsAvailable = async (userId) => {
  const activeHosting = await prisma.gameParticipant.findFirst({
    where: {
      userId: userId,
      role: UserRole.HOST,
      game: { status: { in: [GameStatus.WAITING, GameStatus.ACTIVE] } },
    },
    include: { game: true },
  });
  if (activeHosting) {
    throw new Error(
      `You cannot host a new game while hosting: "${activeHosting.game.title}"`
    );
  }
};

// --- ולידציות מורכבות ---

export const validateJoinEligibility = async (
  gameId,
  userId,
  requestedRole
) => {
  const game = await ensureGameExists(gameId);

  if (game.status === GameStatus.FINISHED)
    throw new Error(ERROR_MESSAGES.CANNOT_JOIN_FINISHED_GAME);

  if (requestedRole === UserRole.HOST && game.hostId !== userId) {
    throw new Error(ERROR_MESSAGES.HOST_ONLY);
  }

  if (requestedRole === UserRole.PLAYER) {
    const activeParticipation = await prisma.gameParticipant.findFirst({
      where: {
        userId,
        role: UserRole.PLAYER,
        game: { status: { in: [GameStatus.WAITING, GameStatus.ACTIVE] } },
      },
      include: { game: { select: { title: true } } },
    });
    if (activeParticipation) {
      throw new Error(
        `You are already playing in "${activeParticipation.game.title}". Finish that game before joining another.`
      );
    }
  }

  const existingParticipant = await prisma.gameParticipant.findUnique({
    where: { gameId_userId: { gameId, userId } },
  });

  if (existingParticipant) {
    if (existingParticipant.role === requestedRole) {
      return {
        status: JOIN_ELIGIBILITY_STATUS.ALREADY_JOINED,
        participant: existingParticipant,
      };
    }
    throw new Error(`Conflict: Already joined as ${existingParticipant.role}.`);
  }

  return { status: JOIN_ELIGIBILITY_STATUS.ELIGIBLE, game };
};

// --- עזרים ותוכן ---

export const validateQuestionData = (questionText, options) => {
  validateQuestionText(questionText);
  if (!Array.isArray(options) || options.length < 2)
    throw new Error(ERROR_MESSAGES.QUESTION_OPTIONS_REQUIRED);
};

// ולידציה של טקסט שאלה בלבד — למסלול שליחת שאלת צופה (Q1b), שבו אין תשובות.
// כלל המינימום-שתי-תשובות נאכף רק במעבר לפרסום (approve), לא בשליחה.
export const validateQuestionText = (questionText) => {
  if (!questionText?.trim())
    throw new Error(ERROR_MESSAGES.QUESTION_TEXT_REQUIRED);
};

export const ensureChatParticipantsExist = async (senderId, receiverId) => {
  if (senderId === receiverId)
    throw new Error(ERROR_MESSAGES.SELF_MESSAGE_NOT_ALLOWED);
  await Promise.all([ensureUserExists(senderId), ensureUserExists(receiverId)]);
};
export const getSignificantInteractionRules = () => {
  return [{ duration: { gt: 60 } }, { participationPercent: { gt: 0.2 } }];
};

export const mergeUniqueIds = (...arrays) => {
  const combined = arrays.flat();
  return [...new Set(combined)];
};

export const ensureQuestionIsBetable = async (questionId) => {
  const question = await prisma.question.findUnique({
    where: { id: questionId },
    include: { game: true },
  });

  if (!question) throw new Error('השאלה לא נמצאה');
  if (question.isResolved) throw new Error('השאלה כבר נפתרה וסגורה ');
  if (question.game.status !== GameStatus.ACTIVE)
    throw new Error('המשחק אינו פעיל כרגע');

  return question;
};

export const validateUserFunds = (user, amount) => {
  if (Number(user.walletBalance) < amount) {
    throw new Error('אין מספיק מטבעות בארנק לביצוע ההימור');
  }
};

export const validateNonEmptyText = (text, fieldName = 'Field') => {
  if (!text?.trim()) throw new Error(`${fieldName} cannot be empty`);
};
export default {
  ensureGameExists,
  ensureStreamExists,
  ensureUserExists,
  ensureUserExistsByEmail,
  validateEmailIsUnique,
  validateUserHasNoActiveStream,
  validateStreamIsFree,
  validateGameIsActive,
  validateStatusTransition,
  validateHostIsAvailable,
  validateJoinEligibility,
  validateQuestionData,
  validateQuestionText,
  ensureChatParticipantsExist,
  ensureQuestionIsBetable,
  validateUserFunds,
  validateNonEmptyText,
  getSignificantInteractionRules,
  mergeUniqueIds,
};
