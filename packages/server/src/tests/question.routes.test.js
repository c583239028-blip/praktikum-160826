// Q1b — טסט אינטגרציה דרך שכבת Express האמיתית: מאמת שהנתיב POST /viewer-submission
// רשום, עובר את authenticateToken והבקר, ומגיע לשירות (מוק ירוק לא יכול להסתיר נתיב לא-רשום).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { ERROR_MESSAGES } from '@worldplay/shared';

// ── Mocks ──────────────────

vi.mock('../middleware/auth.middleware.js', () => ({
  authenticateToken: (req, _res, next) => {
    req.user = { id: 'user-1' };
    next();
  },
}));

const { mockService } = vi.hoisted(() => ({
  mockService: {
    submitViewerQuestion: vi.fn(),
    approveQuestion: vi.fn(),
    rejectQuestion: vi.fn(),
    createQuestion: vi.fn(),
    resolveQuestion: vi.fn(),
    getQuestionById: vi.fn(),
    getGameQuestions: vi.fn(),
  },
}));

vi.mock('../services/question.service.js', () => ({ default: mockService }));
vi.mock('../services/stream.service.js', () => ({
  default: { freezeStreamForQuestion: vi.fn().mockResolvedValue({}) },
}));
vi.mock('../utils/socketHelpers.js', () => ({
  syncUserBalances: vi.fn(),
  syncGameScores: vi.fn(),
  broadcastEconomyEvent: vi.fn(),
}));
vi.mock('@worldplay/shared', async (importOriginal) => ({
  ...(await importOriginal()),
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), success: vi.fn() },
}));
vi.mock('../controller/userAnswer.controller.js', () => ({
  default: { submit: vi.fn() },
}));

// ── App ──────────────────

const { default: questionRoutes } =
  await import('../routes/question.routes.js');

const app = express();
app.use(express.json());
app.use('/api/questions', questionRoutes);

// ── Tests ──────────────────

describe('POST /api/questions/viewer-submission', () => {
  beforeEach(() => vi.clearAllMocks());

  it('201 — צופה משתתף שולח טקסט בלבד; הנתיב מגיע לשירות עם userId מה-token', async () => {
    mockService.submitViewerQuestion.mockResolvedValue({
      question: { id: 'vq-1', approvalStatus: 'PENDING' },
      streamId: 'stream-1',
    });

    const res = await request(app)
      .post('/api/questions/viewer-submission')
      .send({ gameId: 'game-1', questionText: 'Who wins?' });

    expect(res.status).toBe(201);
    expect(mockService.submitViewerQuestion).toHaveBeenCalledWith(
      'game-1',
      'user-1',
      { questionText: 'Who wins?' }
    );
  });

  it('403 — משתמש שאינו משתתף נדחה דרך הראוט האמיתי', async () => {
    mockService.submitViewerQuestion.mockRejectedValue(
      new Error(ERROR_MESSAGES.NOT_GAME_PARTICIPANT)
    );

    const res = await request(app)
      .post('/api/questions/viewer-submission')
      .send({ gameId: 'game-1', questionText: 'Sneaky' });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe(ERROR_MESSAGES.NOT_GAME_PARTICIPANT);
  });

  it('400 — טקסט חסר: לא קורא לשירות', async () => {
    const res = await request(app)
      .post('/api/questions/viewer-submission')
      .send({ gameId: 'game-1' });

    expect(res.status).toBe(400);
    expect(mockService.submitViewerQuestion).not.toHaveBeenCalled();
  });
});
