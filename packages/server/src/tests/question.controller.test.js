import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SOCKET_EVENTS, ERROR_MESSAGES } from '@worldplay/shared';
import questionController from '../controller/question.controller.js';
import questionService from '../services/question.service.js';
import streamService from '../services/stream.service.js';

vi.mock('../services/question.service.js', () => ({
  default: {
    createQuestion: vi.fn(),
    resolveQuestion: vi.fn(),
    submitViewerQuestion: vi.fn(),
    approveQuestion: vi.fn(),
    rejectQuestion: vi.fn(),
  },
}));

// חדש — עוקב אחרי הטריגרים ל-freeze/resume
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

function buildMockRes() {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

function buildMockReq({ body, io, params = {} }) {
  return {
    user: { id: 'user-1' },
    body,
    params,
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

    questionService.createQuestion.mockResolvedValue({
      question: mockCreatedQuestion,
      streamId: 'stream-1',
    });

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

    // חדש — D2: draft לא אמור להפעיל freeze
    expect(streamService.freezeStreamForQuestion).not.toHaveBeenCalled();

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
      approvalStatus: 'APPROVED',
      options: [
        { id: 'opt-1', text: 'Paris' },
        { id: 'opt-2', text: 'Lyon' },
      ],
    };

    questionService.createQuestion.mockResolvedValue({
      question: mockCreatedQuestion,
      streamId: 'stream-1',
    });

    const req = buildMockReq({
      body: { ...baseBody, isDraft: false },
      io: mockIo,
    });
    const res = buildMockRes();

    await questionController.addQuestion(req, res);

    // Emitted to the game room (host/player/moderator)...
    expect(mockIo.to).toHaveBeenCalledWith(baseBody.gameId);
    expect(mockIo.emit).toHaveBeenCalledWith(
      SOCKET_EVENTS.GAME.NEW_QUESTION,
      expect.objectContaining({ questionId: 'q-2' })
    );

    // ...and fanned out to the stream room so the viewer (not in the game room)
    // receives it. The stream payload must include gameId so it can bet.
    expect(mockIo.to).toHaveBeenCalledWith('stream-1');
    expect(mockIo.emit).toHaveBeenCalledWith(
      SOCKET_EVENTS.GAME.NEW_QUESTION,
      expect.objectContaining({ questionId: 'q-2', gameId: baseBody.gameId })
    );

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        question: expect.objectContaining({ isDraft: false }),
      })
    );
  });

  // ── Q1a: author ב-payload של game:new_question ──────────────

  it('non-draft: מוסיפה את המחבר (id + שם + אווטאר) ל-payload של game:new_question, בחדר המשחק ובחדר הסטרים', async () => {
    const mockIo = { to: vi.fn().mockReturnThis(), emit: vi.fn() };
    const author = {
      id: 'user-1',
      username: 'Riky',
      avatarUrl: 'https://cdn.example/riky.png',
    };

    questionService.createQuestion.mockResolvedValue({
      question: {
        id: 'q-author',
        questionText: baseBody.questionText,
        rewardType: 'STANDARD',
        timeLimit: 60,
        isDraft: false,
        approvalStatus: 'APPROVED',
        author,
        options: [
          { id: 'opt-1', text: 'Paris' },
          { id: 'opt-2', text: 'Lyon' },
        ],
      },
      streamId: 'stream-1',
    });

    const req = buildMockReq({
      body: { ...baseBody, isDraft: false },
      io: mockIo,
    });
    const res = buildMockRes();

    await questionController.addQuestion(req, res);

    const expectedAuthor = {
      id: 'user-1',
      username: 'Riky',
      avatarUrl: 'https://cdn.example/riky.png',
    };

    // חדר המשחק
    expect(mockIo.emit).toHaveBeenCalledWith(
      SOCKET_EVENTS.GAME.NEW_QUESTION,
      expect.objectContaining({
        questionId: 'q-author',
        author: expectedAuthor,
      })
    );
    // fan-out לחדר הסטרים
    expect(mockIo.emit).toHaveBeenCalledWith(
      SOCKET_EVENTS.GAME.NEW_QUESTION,
      expect.objectContaining({
        gameId: baseBody.gameId,
        author: expectedAuthor,
      })
    );
  });

  it('שאלה ללא מחבר (רשומה ישנה): author = null ב-payload, לא מפיל את הנתיב', async () => {
    const mockIo = { to: vi.fn().mockReturnThis(), emit: vi.fn() };

    questionService.createQuestion.mockResolvedValue({
      question: {
        id: 'q-noauthor',
        questionText: baseBody.questionText,
        rewardType: 'STANDARD',
        timeLimit: 60,
        isDraft: false,
        approvalStatus: 'APPROVED',
        author: null,
        options: [
          { id: 'opt-1', text: 'Paris' },
          { id: 'opt-2', text: 'Lyon' },
        ],
      },
      streamId: 'stream-1',
    });

    const req = buildMockReq({
      body: { ...baseBody, isDraft: false },
      io: mockIo,
    });
    const res = buildMockRes();

    await questionController.addQuestion(req, res);

    expect(mockIo.emit).toHaveBeenCalledWith(
      SOCKET_EVENTS.GAME.NEW_QUESTION,
      expect.objectContaining({ questionId: 'q-noauthor', author: null })
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  // ── חדש — D2: freezeStreamForQuestion ────────────────────

  it('non-draft: קוראת ל-freezeStreamForQuestion עם gameId ו-timeLimit של השאלה שנוצרה', async () => {
    const mockIo = { to: vi.fn().mockReturnThis(), emit: vi.fn() };
    questionService.createQuestion.mockResolvedValue({
      question: {
        id: 'q-3',
        questionText: baseBody.questionText,
        rewardType: 'STANDARD',
        timeLimit: 45,
        isDraft: false,
        approvalStatus: 'APPROVED',
        options: [
          { id: 'opt-1', text: 'Paris' },
          { id: 'opt-2', text: 'Lyon' },
        ],
      },
      streamId: 'stream-1',
    });

    const req = buildMockReq({
      body: { ...baseBody, isDraft: false },
      io: mockIo,
    });
    const res = buildMockRes();

    await questionController.addQuestion(req, res);

    expect(streamService.freezeStreamForQuestion).toHaveBeenCalledWith(
      'game-1',
      45
    );
  });

  it('כשל ב-freezeStreamForQuestion (fire-and-forget): לא משפיע על תגובת ה-HTTP', async () => {
    const mockIo = { to: vi.fn().mockReturnThis(), emit: vi.fn() };
    questionService.createQuestion.mockResolvedValue({
      question: {
        id: 'q-4',
        questionText: baseBody.questionText,
        rewardType: 'STANDARD',
        timeLimit: 30,
        isDraft: false,
        approvalStatus: 'APPROVED',
        options: [
          { id: 'opt-1', text: 'Paris' },
          { id: 'opt-2', text: 'Lyon' },
        ],
      },
      streamId: 'stream-1',
    });
    streamService.freezeStreamForQuestion.mockRejectedValueOnce(
      new Error('media server down')
    );

    const req = buildMockReq({
      body: { ...baseBody, isDraft: false },
      io: mockIo,
    });
    const res = buildMockRes();

    await questionController.addQuestion(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
  });
});

// ── חדש — describe שלם: resolveQuestion ─────────────────────

describe('questionController.resolveQuestion', () => {
  const buildResolvedResult = (overrides = {}) => ({
    question: { id: 'q-1', gameId: 'game-1' },
    distribution: { totalPot: 100, distributions: [], winnerId: null },
    correctAnswerRewards: [],
    summary: { rewardType: 'STANDARD', participantsRewarded: 0 },
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('200 — resolves the question and returns distribution/rewards/summary', async () => {
    const mockIo = { to: vi.fn().mockReturnThis(), emit: vi.fn() };
    questionService.resolveQuestion.mockResolvedValueOnce(
      buildResolvedResult()
    );

    const req = buildMockReq({
      params: { id: 'q-1' },
      body: { optionId: 'opt-1' },
      io: mockIo,
    });
    const res = buildMockRes();

    await questionController.resolveQuestion(req, res);

    expect(questionService.resolveQuestion).toHaveBeenCalledWith(
      'q-1',
      'user-1',
      'opt-1'
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Question resolved and funds distributed successfully',
      })
    );
  });

  it('400 — optionId חסר: לא קוראת בכלל ל-resolveQuestion', async () => {
    const req = buildMockReq({
      params: { id: 'q-1' },
      body: {},
      io: null,
    });
    const res = buildMockRes();

    await questionController.resolveQuestion(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(questionService.resolveQuestion).not.toHaveBeenCalled();
  });

  it('fans out question_resolved to the stream room with gameId [SCRUM-230]', async () => {
    const mockIo = { to: vi.fn().mockReturnThis(), emit: vi.fn() };
    questionService.resolveQuestion.mockResolvedValueOnce(
      buildResolvedResult({ streamId: 'stream-1' })
    );

    const req = buildMockReq({
      params: { id: 'q-1' },
      body: { optionId: 'opt-1' },
      io: mockIo,
    });
    const res = buildMockRes();

    await questionController.resolveQuestion(req, res);

    // Emitted to the game room (host/player/moderator)...
    expect(mockIo.to).toHaveBeenCalledWith('game-1');
    // ...and fanned out to the stream room so the viewer (not in the game room)
    // receives it. The stream payload must include gameId so it can bet.
    expect(mockIo.to).toHaveBeenCalledWith('stream-1');
    expect(mockIo.emit).toHaveBeenCalledWith(
      SOCKET_EVENTS.GAME.QUESTION_RESOLVED,
      expect.objectContaining({ questionId: 'q-1', gameId: 'game-1' })
    );
  });
});

// ── Q1b: שליחת שאלת צופה (טקסט בלבד, ממתינה לאישור, לא משודרת) ──────────
describe('questionController.submitViewerQuestion', () => {
  beforeEach(() => vi.clearAllMocks());

  it('201 — נשמרת ולא משדרת game:new_question (ממתינה לאישור)', async () => {
    const mockIo = { to: vi.fn().mockReturnThis(), emit: vi.fn() };
    questionService.submitViewerQuestion.mockResolvedValue({
      question: { id: 'vq-1', approvalStatus: 'PENDING' },
      streamId: 'stream-1',
    });

    const req = buildMockReq({
      body: { gameId: 'game-1', questionText: 'Who wins?' },
      io: mockIo,
    });
    const res = buildMockRes();

    await questionController.submitViewerQuestion(req, res);

    expect(questionService.submitViewerQuestion).toHaveBeenCalledWith(
      'game-1',
      'user-1',
      { questionText: 'Who wins?' }
    );
    // AC: שאלה שאינה מאושרת לא נשלחת ב-game:new_question
    expect(mockIo.emit).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('400 — טקסט חסר: לא קוראת לשירות', async () => {
    const req = buildMockReq({ body: { gameId: 'game-1' }, io: null });
    const res = buildMockRes();

    await questionController.submitViewerQuestion(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(questionService.submitViewerQuestion).not.toHaveBeenCalled();
  });

  it('403 — משתמש שאינו משתתף במשחק נדחה', async () => {
    questionService.submitViewerQuestion.mockRejectedValue(
      new Error(ERROR_MESSAGES.NOT_GAME_PARTICIPANT)
    );

    const req = buildMockReq({
      body: { gameId: 'game-1', questionText: 'Sneaky' },
      io: null,
    });
    const res = buildMockRes();

    await questionController.submitViewerQuestion(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });
});

describe('questionController.approveQuestion / rejectQuestion', () => {
  beforeEach(() => vi.clearAllMocks());

  it('approve 400 — פרסום בלי שתי תשובות נדחה', async () => {
    questionService.approveQuestion.mockRejectedValue(
      new Error(ERROR_MESSAGES.QUESTION_OPTIONS_REQUIRED)
    );

    const req = buildMockReq({
      params: { id: 'vq-1' },
      body: { options: [{ text: 'only-one' }] },
      io: null,
    });
    const res = buildMockRes();

    await questionController.approveQuestion(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('approve 200 — מאשרת ומחזירה את השאלה', async () => {
    questionService.approveQuestion.mockResolvedValue({
      id: 'vq-1',
      approvalStatus: 'APPROVED',
    });

    const req = buildMockReq({
      params: { id: 'vq-1' },
      body: { options: [{ text: 'A' }, { text: 'B' }] },
      io: null,
    });
    const res = buildMockRes();

    await questionController.approveQuestion(req, res);

    expect(questionService.approveQuestion).toHaveBeenCalledWith(
      'vq-1',
      'user-1',
      expect.objectContaining({ options: [{ text: 'A' }, { text: 'B' }] })
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('reject 200 — דוחה ומחזירה את השאלה', async () => {
    questionService.rejectQuestion.mockResolvedValue({
      id: 'vq-1',
      approvalStatus: 'REJECTED',
    });

    const req = buildMockReq({ params: { id: 'vq-1' }, io: null });
    const res = buildMockRes();

    await questionController.rejectQuestion(req, res);

    expect(questionService.rejectQuestion).toHaveBeenCalledWith(
      'vq-1',
      'user-1'
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
