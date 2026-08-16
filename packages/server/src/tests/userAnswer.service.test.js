/**
 * userAnswer.service.test.js
 *
 * בדיקות יחידה ל-submitAnswer — מקור האמת העסקי היחיד להימור/תשובה
 * (SCRUM M5-14: תיקון פרצת אבטחה במסלול PLACE_BET המקביל).
 * כל הבדיקות העסקיות רצות בתוך ה-transaction (על tx), לא על prisma הראשי.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GameStatus } from '@prisma/client';
import { ERROR_MESSAGES } from '@worldplay/shared';

const {
  mockQuestionFindUnique,
  mockParticipantFindUnique,
  mockUserUpdateMany,
  mockUserAnswerFindUnique,
  mockUserAnswerUpsert,
  mockTransaction,
  mockQueryRaw,
} = vi.hoisted(() => ({
  mockQuestionFindUnique: vi.fn(),
  mockParticipantFindUnique: vi.fn(),
  mockUserUpdateMany: vi.fn(),
  mockUserAnswerFindUnique: vi.fn(),
  mockUserAnswerUpsert: vi.fn(),
  mockTransaction: vi.fn(),
  mockQueryRaw: vi.fn(),
}));

vi.mock('../lib/prisma.js', () => ({
  default: {
    $transaction: mockTransaction,
  },
}));

const { mockSyncUserBalances } = vi.hoisted(() => ({
  mockSyncUserBalances: vi.fn(),
}));

vi.mock('../utils/socketHelpers.js', () => ({
  syncUserBalances: mockSyncUserBalances,
}));

import userAnswerService from '../services/userAnswer.service.js';

const io = {};
const userId = '11111111-1111-4111-8111-111111111111';
const gameId = '22222222-2222-4222-8222-222222222222';
const questionId = '33333333-3333-4333-8333-333333333333';
const selectedOptionId = '44444444-4444-4444-8444-444444444444';

const validInput = { questionId, selectedOptionId, wager: 10 };

const openQuestion = {
  id: questionId,
  gameId,
  isResolved: false,
  game: { status: GameStatus.ACTIVE },
  options: [{ id: selectedOptionId }],
};

function mockTx() {
  return {
    question: { findUnique: mockQuestionFindUnique },
    gameParticipant: { findUnique: mockParticipantFindUnique },
    userAnswer: {
      findUnique: mockUserAnswerFindUnique,
      upsert: mockUserAnswerUpsert,
    },
    user: { updateMany: mockUserUpdateMany },
    $queryRaw: mockQueryRaw,
  };
}

describe('userAnswerService.submitAnswer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTransaction.mockImplementation((callback) => callback(mockTx()));
    // ברירת מחדל: הנעילה על שורת השאלה (FOR SHARE) "מוצאת" שאלה פתוחה —
    // הגייט האמיתי (isResolved) נבדק על הערך הזה, לא על mockQuestionFindUnique.
    mockQueryRaw.mockResolvedValue([{ id: questionId, isResolved: false }]);
    // אין הימור קודם כברירת מחדל — מדמה משתמש שמהמר לראשונה על השאלה
    mockUserAnswerFindUnique.mockResolvedValue(null);
  });

  // ── ולידציית קלט (Zod) — נדחית לפני שנפתחת טרנזקציה כלשהי ──────
  describe('ולידציית amount/wager', () => {
    it.each([
      ['שלילי', -10],
      ['אפס', 0],
      ['מחרוזת', '10'],
      ['NaN', NaN],
      ['Infinity', Infinity],
    ])('דוחה wager לא תקין: %s', async (_label, wager) => {
      await expect(
        userAnswerService.submitAnswer(io, userId, { ...validInput, wager })
      ).rejects.toThrow();

      expect(mockTransaction).not.toHaveBeenCalled();
    });
  });

  // ── שאלה/משחק — נבדקות בתוך הטרנזקציה, צמוד לניכוי ──────────────
  it('דוחה כשהשאלה לא נמצאה', async () => {
    // "לא נמצאה" נבדק על השאילתה הנועלת עצמה (0 שורות) — לא על findUnique.
    mockQueryRaw.mockResolvedValueOnce([]);

    await expect(
      userAnswerService.submitAnswer(io, userId, validInput)
    ).rejects.toThrow(ERROR_MESSAGES.QUESTION_NOT_FOUND);

    expect(mockUserUpdateMany).not.toHaveBeenCalled();
    expect(mockUserAnswerUpsert).not.toHaveBeenCalled();
  });

  it('דוחה שאלה שכבר נסגרה (isResolved)', async () => {
    // "כבר נסגרה" נבדק על השאילתה הנועלת עצמה — לא על findUnique שרץ אחריה.
    mockQueryRaw.mockResolvedValueOnce([{ id: questionId, isResolved: true }]);

    await expect(
      userAnswerService.submitAnswer(io, userId, validInput)
    ).rejects.toThrow(ERROR_MESSAGES.QUESTION_ALREADY_CLOSED);

    expect(mockUserUpdateMany).not.toHaveBeenCalled();
  });

  it('דוחה כשהמשחק אינו ACTIVE', async () => {
    mockQuestionFindUnique.mockResolvedValueOnce({
      ...openQuestion,
      game: { status: GameStatus.WAITING },
    });

    await expect(
      userAnswerService.submitAnswer(io, userId, validInput)
    ).rejects.toThrow(ERROR_MESSAGES.GAME_NOT_ACTIVE);
  });

  it('דוחה כש-selectedOptionId שייך לשאלה אחרת', async () => {
    mockQuestionFindUnique.mockResolvedValueOnce({
      ...openQuestion,
      options: [{ id: 'some-other-option-id' }],
    });

    await expect(
      userAnswerService.submitAnswer(io, userId, validInput)
    ).rejects.toThrow(ERROR_MESSAGES.OPTION_DOES_NOT_BELONG_TO_QUESTION);

    expect(mockUserUpdateMany).not.toHaveBeenCalled();
    expect(mockUserAnswerUpsert).not.toHaveBeenCalled();
  });

  // ── השתתפות ──────────────────────────────────────────────────
  it('דוחה משתמש שאינו participant במשחק', async () => {
    mockQuestionFindUnique.mockResolvedValueOnce(openQuestion);
    mockParticipantFindUnique.mockResolvedValueOnce(null);

    await expect(
      userAnswerService.submitAnswer(io, userId, validInput)
    ).rejects.toThrow(ERROR_MESSAGES.NOT_GAME_PARTICIPANT);

    expect(mockUserUpdateMany).not.toHaveBeenCalled();
    expect(mockUserAnswerUpsert).not.toHaveBeenCalled();
  });

  // ── הרשאה לפי תפקיד — הימור מוגבל ל-VIEWER בלבד (SPEC §2) ───────
  it.each([['HOST'], ['PLAYER'], ['MODERATOR']])(
    'דוחה participant בתפקיד %s (הימור מוגבל ל-VIEWER)',
    async (role) => {
      mockQuestionFindUnique.mockResolvedValueOnce(openQuestion);
      mockParticipantFindUnique.mockResolvedValueOnce({
        id: 'participant-1',
        role,
      });

      await expect(
        userAnswerService.submitAnswer(io, userId, validInput)
      ).rejects.toThrow(ERROR_MESSAGES.NOT_AUTHORIZED_TO_BET);

      expect(mockUserUpdateMany).not.toHaveBeenCalled();
      expect(mockUserAnswerUpsert).not.toHaveBeenCalled();
    }
  );

  // ── יתרה ─────────────────────────────────────────────────────
  it('דוחה כשהיתרה אינה מספיקה (updateMany מחזיר count 0), בלי לשמור תשובה', async () => {
    mockQuestionFindUnique.mockResolvedValueOnce(openQuestion);
    mockParticipantFindUnique.mockResolvedValueOnce({
      id: 'participant-1',
      role: 'VIEWER',
    });
    mockUserUpdateMany.mockResolvedValueOnce({ count: 0 });

    await expect(
      userAnswerService.submitAnswer(io, userId, validInput)
    ).rejects.toThrow(ERROR_MESSAGES.INSUFFICIENT_COINS);

    expect(mockUserAnswerUpsert).not.toHaveBeenCalled();
    expect(mockSyncUserBalances).not.toHaveBeenCalled();
  });

  // ── הצלחה ────────────────────────────────────────────────────
  it('מצליחה: שומרת תשובה (upsert), מנכה יתרה ומסנכרנת יתרות', async () => {
    mockQuestionFindUnique.mockResolvedValueOnce(openQuestion);
    mockParticipantFindUnique.mockResolvedValueOnce({
      id: 'participant-1',
      role: 'VIEWER',
    });
    mockUserUpdateMany.mockResolvedValueOnce({ count: 1 });
    mockUserAnswerUpsert.mockResolvedValueOnce({
      id: 'answer-1',
      ...validInput,
    });

    const answer = await userAnswerService.submitAnswer(io, userId, validInput);

    expect(mockQueryRaw).toHaveBeenCalledTimes(2);
    expect(mockQueryRaw.mock.calls[0][1]).toBe(questionId);
    expect(mockQueryRaw.mock.calls[1][1]).toBe(userId);

    expect(mockQuestionFindUnique).toHaveBeenCalledWith({
      where: { id: questionId },
      include: { game: true, options: { select: { id: true } } },
    });
    expect(mockParticipantFindUnique).toHaveBeenCalledWith({
      where: {
        gameId_userId: { gameId, userId },
      },
    });
    expect(mockUserUpdateMany).toHaveBeenCalledWith({
      where: { id: userId, walletBalance: { gte: 10 } },
      data: { walletBalance: { decrement: 10 } },
    });
    expect(mockUserAnswerUpsert).toHaveBeenCalledWith({
      where: { userId_questionId: { userId, questionId } },
      update: {
        wager: 10,
        option: { connect: { id: selectedOptionId } },
      },
      create: {
        wager: 10,
        user: { connect: { id: userId } },
        question: { connect: { id: questionId } },
        option: { connect: { id: selectedOptionId } },
      },
    });
    expect(answer).toEqual({ id: 'answer-1', ...validInput });

    // הסנכרון קורה אחרי ה-transaction דרך setImmediate
    await new Promise((resolve) => setImmediate(resolve));
    expect(mockSyncUserBalances).toHaveBeenCalledWith(io, userId, gameId);
  });
});
