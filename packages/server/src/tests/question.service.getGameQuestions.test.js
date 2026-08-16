/**
 * question.service.getGameQuestions.test.js
 *
 * Q1a — שומר רגרסיה על חשיפת המחבר בנתיב GET /api/questions/game/:gameId.
 * מאמת שהשליפה כוללת author ב-include (id/username/avatarUrl) ושהמחבר
 * מוחזר בכל שאלה. תופס הסרה בטעות של ה-include בעתיד.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockQuestionFindMany } = vi.hoisted(() => ({
  mockQuestionFindMany: vi.fn(),
}));

vi.mock('../lib/prisma.js', () => ({
  default: {
    question: { findMany: mockQuestionFindMany },
  },
}));

const { mockEnsureGameExists } = vi.hoisted(() => ({
  mockEnsureGameExists: vi.fn(),
}));

vi.mock('../services/validation.service.js', () => ({
  ensureGameExists: mockEnsureGameExists,
}));

import questionService from '../services/question.service.js';

describe('questionService.getGameQuestions — author exposure', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnsureGameExists.mockResolvedValue({ id: 'game-1' });
  });

  it('שולפת את המחבר ב-include (id/username/avatarUrl) לכל שאלה', async () => {
    mockQuestionFindMany.mockResolvedValue([]);

    await questionService.getGameQuestions('game-1');

    expect(mockQuestionFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { gameId: 'game-1' },
        include: expect.objectContaining({
          author: { select: { id: true, username: true, avatarUrl: true } },
        }),
      })
    );
  });

  it('מחזירה את המחבר בכל שאלה בתשובה', async () => {
    const author = {
      id: 'user-1',
      username: 'Riky',
      avatarUrl: 'https://cdn.example/riky.png',
    };
    mockQuestionFindMany.mockResolvedValue([
      { id: 'q-1', questionText: 'Q1', author, _count: { answers: 3 } },
      { id: 'q-2', questionText: 'Q2', author: null, _count: { answers: 0 } }, // שאלה ישנה ללא מחבר
    ]);

    const questions = await questionService.getGameQuestions('game-1');

    expect(questions).toHaveLength(2);
    expect(questions[0].author).toEqual(author);
    expect(questions[1].author).toBeNull();
  });

  it('כוללת _count של answers ב-include כדי לספור משתתפים', async () => {
    mockQuestionFindMany.mockResolvedValue([]);

    await questionService.getGameQuestions('game-1');

    expect(mockQuestionFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          _count: { select: { answers: true } },
        }),
      })
    );
  });

  it('חושפת participantsCount לכל שאלה מתוך ספירת UserAnswer בפועל', async () => {
    mockQuestionFindMany.mockResolvedValue([
      { id: 'q-1', questionText: 'Q1', author: null, _count: { answers: 250 } },
      { id: 'q-2', questionText: 'Q2', author: null, _count: { answers: 0 } },
    ]);

    const questions = await questionService.getGameQuestions('game-1');

    expect(questions[0].participantsCount).toBe(250);
    expect(questions[1].participantsCount).toBe(0);
    // אובייקט ה-_count הפנימי לא דולף החוצה
    expect(questions[0]).not.toHaveProperty('_count');
  });

  it('מחזירה participantsCount=0 כשאין _count (הגנה על שאלות ללא עונים)', async () => {
    mockQuestionFindMany.mockResolvedValue([
      { id: 'q-1', questionText: 'Q1', author: null },
    ]);

    const questions = await questionService.getGameQuestions('game-1');

    expect(questions[0].participantsCount).toBe(0);
  });
});
