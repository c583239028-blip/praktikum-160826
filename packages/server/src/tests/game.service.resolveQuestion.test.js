import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    question: { updateMany: vi.fn() },
    userAnswer: { findMany: vi.fn() },
  },
}));

vi.mock('../lib/prisma.js', () => ({
  default: mockPrisma,
}));
vi.mock('../services/validation.service.js', () => ({
  ensureGameExists: vi.fn(),
}));
vi.mock('@worldplay/shared', () => ({
  ERROR_MESSAGES: {
    NOT_AUTHORIZED_TO_RESOLVE_QUESTION:
      'You are not authorized to resolve this question',
    QUESTION_ALREADY_RESOLVED: 'Question is already resolved',
  },
}));
import * as gameRules from '../services/validation.service.js';
import gameService from '../services/game.service.js';

describe('gameService.resolveQuestion', () => {
  const GAME_ID = 'game-1';
  const QUESTION_ID = 'question-1';
  const MODERATOR_ID = 'mod-1';

  beforeEach(() => vi.clearAllMocks());

  it('throws if the caller is not the assigned moderator', async () => {
    gameRules.ensureGameExists.mockResolvedValue({
      moderatorId: 'someone-else',
    });
    await expect(
      gameService.resolveQuestion(GAME_ID, QUESTION_ID, MODERATOR_ID)
    ).rejects.toThrow(/not authorized/i);

    expect(mockPrisma.question.updateMany).not.toHaveBeenCalled();
  });

  it('throws if the game has no assigned moderator at all', async () => {
    gameRules.ensureGameExists.mockResolvedValue({ moderatorId: null });
    await expect(
      gameService.resolveQuestion(GAME_ID, QUESTION_ID, MODERATOR_ID)
    ).rejects.toThrow(/not authorized/i);
  });

  it('throws if the question was already resolved (atomic guard)', async () => {
    gameRules.ensureGameExists.mockResolvedValue({ moderatorId: MODERATOR_ID });
    mockPrisma.question.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      gameService.resolveQuestion(GAME_ID, QUESTION_ID, MODERATOR_ID)
    ).rejects.toThrow(/already resolved/i);
    expect(mockPrisma.userAnswer.findMany).not.toHaveBeenCalled();
  });

  it('returns win/lose per user based on selected option correctness', async () => {
    gameRules.ensureGameExists.mockResolvedValue({ moderatorId: MODERATOR_ID });
    mockPrisma.question.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.userAnswer.findMany.mockResolvedValue([
      { userId: 'user-a', option: { isCorrect: true } },
      { userId: 'user-b', option: { isCorrect: false } },
    ]);
    const results = await gameService.resolveQuestion(
      GAME_ID,
      QUESTION_ID,
      MODERATOR_ID
    );
    expect(results).toEqual([
      { userId: 'user-a', type: 'win' },
      { userId: 'user-b', type: 'lose' },
    ]);
  });

  it('returns an empty array when nobody answered (no messages sent)', async () => {
    gameRules.ensureGameExists.mockResolvedValue({ moderatorId: MODERATOR_ID });
    mockPrisma.question.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.userAnswer.findMany.mockResolvedValue([]);
    const results = await gameService.resolveQuestion(
      GAME_ID,
      QUESTION_ID,
      MODERATOR_ID
    );
    expect(results).toEqual([]);
  });
});
