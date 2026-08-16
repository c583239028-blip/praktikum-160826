import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SOCKET_EVENTS } from '@worldplay/shared';
import questionController from '../controller/question.controller.js';
import questionService from '../services/question.service.js';

vi.mock('../services/question.service.js', () => ({
  default: {
    createQuestion: vi.fn(),
  },
}));

vi.mock('../utils/socketHelpers.js', () => ({
  syncUserBalances: vi.fn(),
  syncGameScores: vi.fn(),
  broadcastEconomyEvent: vi.fn(),
}));

function buildMockRes() {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

function buildMockReq({ body, io }) {
  return {
    user: { id: 'user-1' },
    body,
    app: {
      get: vi.fn().mockReturnValue(io),
    },
  };
}

describe('questionController.addQuestion', () => {
  const baseBody = {
    gameId: 'game-1',
    questionText: 'What is the capital of France?',
    options: [{ text: 'Paris' }, { text: 'Lyon' }],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should save and return a draft question WITHOUT emitting the socket event', async () => {
    const mockIo = { to: vi.fn().mockReturnThis(), emit: vi.fn() };
    const mockCreatedQuestion = {
      id: 'q-1',
      questionText: baseBody.questionText,
      rewardType: 'STANDARD',
      timeLimit: 60,
      isDraft: true,
      options: [
        { id: 'opt-1', text: 'Paris' },
        { id: 'opt-2', text: 'Lyon' },
      ],
    };

    questionService.createQuestion.mockResolvedValue(mockCreatedQuestion);

    const req = buildMockReq({
      body: { ...baseBody, timeLimit: 60, isDraft: true },
      io: mockIo,
    });
    const res = buildMockRes();

    await questionController.addQuestion(req, res);

    expect(questionService.createQuestion).toHaveBeenCalledWith(
      baseBody.gameId,
      'user-1',
      expect.objectContaining({ timeLimit: 60, isDraft: true })
    );

    // AC3: no socket emit for drafts
    expect(mockIo.emit).not.toHaveBeenCalled();

    // AC2: question is still saved and returned
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        question: expect.objectContaining({ isDraft: true, timeLimit: 60 }),
      })
    );
  });

  it('should save, return, AND emit the socket event for a non-draft question', async () => {
    const mockIo = { to: vi.fn().mockReturnThis(), emit: vi.fn() };
    const mockCreatedQuestion = {
      id: 'q-2',
      questionText: baseBody.questionText,
      rewardType: 'STANDARD',
      timeLimit: null,
      isDraft: false,
      options: [
        { id: 'opt-1', text: 'Paris' },
        { id: 'opt-2', text: 'Lyon' },
      ],
    };

    questionService.createQuestion.mockResolvedValue(mockCreatedQuestion);

    const req = buildMockReq({
      body: { ...baseBody, isDraft: false },
      io: mockIo,
    });
    const res = buildMockRes();

    await questionController.addQuestion(req, res);

    expect(mockIo.to).toHaveBeenCalledWith(baseBody.gameId);
    expect(mockIo.emit).toHaveBeenCalledWith(
      SOCKET_EVENTS.GAME.NEW_QUESTION,
      expect.objectContaining({ questionId: 'q-2' })
    );

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        question: expect.objectContaining({ isDraft: false }),
      })
    );
  });
});
