import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockQuestionFindUnique,
  mockParticipantFindUnique,
  mockTransaction,
  mockUserUpdateMany,
  mockUserUpdate,
  mockUserAnswerFindUnique,
  mockUserAnswerUpsert,
  mockQueryRaw,
} = vi.hoisted(() => ({
  mockQuestionFindUnique: vi.fn(),
  mockParticipantFindUnique: vi.fn(),
  mockTransaction: vi.fn(),
  mockUserUpdateMany: vi.fn(),
  mockUserUpdate: vi.fn(),
  mockUserAnswerFindUnique: vi.fn(),
  mockUserAnswerUpsert: vi.fn(),
  mockQueryRaw: vi.fn(),
}));

vi.mock('../lib/prisma.js', () => ({
  default: {
    $transaction: mockTransaction,
  },
}));

vi.mock('../utils/socketHelpers.js', () => ({
  syncUserBalances: vi.fn(),
}));

import userAnswerService from '../services/userAnswer.service.js';

const io = {};
const userId = '11111111-1111-4111-8111-111111111111';
const gameId = '22222222-2222-4222-8222-222222222222';
const questionId = '33333333-3333-4333-8333-333333333333';
const selectedOptionId = '44444444-4444-4444-8444-444444444444';

describe('userAnswerService wager replacement', () => {
  let walletBalance;
  let storedAnswer;

  beforeEach(() => {
    vi.clearAllMocks();
    walletBalance = 100;
    storedAnswer = null;

    mockQuestionFindUnique.mockResolvedValue({
      id: questionId,
      gameId,
      isResolved: false,
      game: { status: 'ACTIVE' },
      options: [{ id: selectedOptionId }],
    });
    mockParticipantFindUnique.mockResolvedValue({
      id: 'participant-1',
      role: 'VIEWER',
    });
    mockUserUpdateMany.mockImplementation(({ data }) => {
      const delta = data.walletBalance.decrement;
      if (walletBalance < delta) return { count: 0 };
      walletBalance -= delta;
      return { count: 1 };
    });
    mockUserUpdate.mockImplementation(({ data }) => {
      walletBalance += data.walletBalance.increment;
    });
    mockUserAnswerFindUnique.mockImplementation(() => storedAnswer);
    mockUserAnswerUpsert.mockImplementation(({ update, create }) => {
      storedAnswer = {
        id: 'answer-1',
        wager: storedAnswer ? update.wager : create.wager,
      };
      return storedAnswer;
    });
    mockQueryRaw.mockResolvedValue([{ id: questionId, isResolved: false }]);
    mockTransaction.mockImplementation((callback) =>
      callback({
        question: { findUnique: mockQuestionFindUnique },
        gameParticipant: { findUnique: mockParticipantFindUnique },
        user: {
          updateMany: mockUserUpdateMany,
          update: mockUserUpdate,
        },
        userAnswer: {
          findUnique: mockUserAnswerFindUnique,
          upsert: mockUserAnswerUpsert,
        },
        $queryRaw: mockQueryRaw,
      })
    );
  });

  it('deducts only the latest wager after two submissions', async () => {
    await userAnswerService.submitAnswer(io, userId, {
      questionId,
      selectedOptionId,
      wager: 10,
    });
    await userAnswerService.submitAnswer(io, userId, {
      questionId,
      selectedOptionId,
      wager: 25,
    });

    expect(walletBalance).toBe(75);
    expect(mockUserUpdateMany).toHaveBeenNthCalledWith(1, {
      where: { id: userId, walletBalance: { gte: 10 } },
      data: { walletBalance: { decrement: 10 } },
    });
    expect(mockUserUpdateMany).toHaveBeenNthCalledWith(2, {
      where: { id: userId, walletBalance: { gte: 15 } },
      data: { walletBalance: { decrement: 15 } },
    });
  });

  it('refunds the difference when the new wager is lower than the previous one', async () => {
    await userAnswerService.submitAnswer(io, userId, {
      questionId,
      selectedOptionId,
      wager: 25,
    });
    await userAnswerService.submitAnswer(io, userId, {
      questionId,
      selectedOptionId,
      wager: 10,
    });

    expect(walletBalance).toBe(90);
    expect(mockUserUpdateMany).toHaveBeenCalledWith({
      where: { id: userId, walletBalance: { gte: 25 } },
      data: { walletBalance: { decrement: 25 } },
    });
    expect(mockUserUpdate).toHaveBeenCalledWith({
      where: { id: userId },
      data: { walletBalance: { increment: 15 } },
    });
  });

  it('rejects a wager below MIN_WAGER before opening a transaction', async () => {
    await expect(
      userAnswerService.submitAnswer(io, userId, {
        questionId,
        selectedOptionId,
        wager: 9,
      })
    ).rejects.toThrow();

    expect(mockTransaction).not.toHaveBeenCalled();
  });
});
