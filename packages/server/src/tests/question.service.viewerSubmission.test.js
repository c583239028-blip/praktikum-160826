// Q1b — שאלת צופה: שליחה (טקסט בלבד), אישור (מינימום 2 תשובות במעבר לפרסום), ודחייה.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    question: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('../lib/prisma.js', () => ({ default: mockPrisma }));

vi.mock('../services/validation.service.js', () => ({
  ensureGameExists: vi.fn(),
  validateGameIsActive: vi.fn(),
  validateQuestionText: vi.fn(),
}));

vi.mock('../services/permissions.service.js', () => ({
  default: {
    ensureParticipant: vi.fn(),
    ensureModerator: vi.fn(),
  },
}));

vi.mock('../services/economy.service.js', () => ({ default: {} }));

vi.mock('../constants/gameRules.js', () => ({
  GAME_SETTINGS: { DEFAULT_QUESTION_TIMER: 30 },
}));

vi.mock('@prisma/client', () => ({
  QuestionApprovalStatus: {
    APPROVED: 'APPROVED',
    PENDING: 'PENDING',
    REJECTED: 'REJECTED',
  },
}));

vi.mock('@worldplay/shared', () => ({
  ERROR_MESSAGES: {
    QUESTION_NOT_FOUND: 'Question not found',
    QUESTION_OPTIONS_REQUIRED: 'At least 2 options required',
    QUESTION_NOT_PENDING_APPROVAL:
      'Question is not pending approval and cannot be approved or rejected',
    NOT_GAME_PARTICIPANT: 'You are not a participant in this game',
    QUESTION_TEXT_REQUIRED: 'Question text cannot be empty',
  },
}));

import * as gameRules from '../services/validation.service.js';
import permissionsService from '../services/permissions.service.js';
import questionService from '../services/question.service.js';

const GAME_ID = 'game-1';
const VIEWER_ID = 'viewer-1';
const MOD_ID = 'mod-1';
const QUESTION_ID = 'question-1';

beforeEach(() => vi.clearAllMocks());

describe('questionService.submitViewerQuestion', () => {
  it('participant submits text-only and it is saved PENDING with author and no options', async () => {
    gameRules.ensureGameExists.mockResolvedValue({ streamId: 'stream-1' });
    permissionsService.ensureParticipant.mockResolvedValue({ role: 'VIEWER' });
    mockPrisma.question.create.mockResolvedValue({
      id: QUESTION_ID,
      questionText: 'Who wins the next round?',
      approvalStatus: 'PENDING',
      authorId: VIEWER_ID,
      options: [],
    });

    const { question, streamId } = await questionService.submitViewerQuestion(
      GAME_ID,
      VIEWER_ID,
      { questionText: 'Who wins the next round?' }
    );

    expect(permissionsService.ensureParticipant).toHaveBeenCalledWith(
      GAME_ID,
      VIEWER_ID
    );
    // לא נדרש תפקיד מנחה למסלול הזה
    expect(permissionsService.ensureModerator).not.toHaveBeenCalled();

    const createArg = mockPrisma.question.create.mock.calls[0][0];
    expect(createArg.data.approvalStatus).toBe('PENDING');
    expect(createArg.data.authorId).toBe(VIEWER_ID);
    expect(createArg.data.isDraft).toBe(false); // מובחן מטיוטת מנחה
    expect(createArg.data.options).toBeUndefined(); // טקסט בלבד — בלי תשובות

    expect(question.approvalStatus).toBe('PENDING');
    expect(streamId).toBe('stream-1');
  });

  it('rejects a stranger (non-participant) and never creates the question', async () => {
    gameRules.ensureGameExists.mockResolvedValue({ streamId: 'stream-1' });
    permissionsService.ensureParticipant.mockRejectedValue(
      new Error('You are not a participant in this game')
    );

    await expect(
      questionService.submitViewerQuestion(GAME_ID, 'stranger-9', {
        questionText: 'Sneaky question',
      })
    ).rejects.toThrow(/not a participant/i);

    expect(mockPrisma.question.create).not.toHaveBeenCalled();
  });

  it('rejects empty text before touching the database', async () => {
    gameRules.ensureGameExists.mockResolvedValue({ streamId: 'stream-1' });
    gameRules.validateQuestionText.mockImplementation(() => {
      throw new Error('Question text cannot be empty');
    });

    await expect(
      questionService.submitViewerQuestion(GAME_ID, VIEWER_ID, {
        questionText: '   ',
      })
    ).rejects.toThrow(/cannot be empty/i);

    expect(mockPrisma.question.create).not.toHaveBeenCalled();
  });
});

describe('questionService.approveQuestion', () => {
  it('rejects publishing without at least two options', async () => {
    mockPrisma.question.findUnique.mockResolvedValue({
      id: QUESTION_ID,
      gameId: GAME_ID,
      approvalStatus: 'PENDING',
    });
    permissionsService.ensureModerator.mockResolvedValue({ role: 'MODERATOR' });

    await expect(
      questionService.approveQuestion(QUESTION_ID, MOD_ID, {
        options: [{ text: 'Only one' }],
      })
    ).rejects.toThrow(/2 options/i);

    expect(mockPrisma.question.update).not.toHaveBeenCalled();
  });

  it('approves a pending question, adds options and sets APPROVED', async () => {
    mockPrisma.question.findUnique.mockResolvedValue({
      id: QUESTION_ID,
      gameId: GAME_ID,
      approvalStatus: 'PENDING',
      rewardType: 'STANDARD',
      timeLimit: 30,
    });
    permissionsService.ensureModerator.mockResolvedValue({ role: 'MODERATOR' });
    mockPrisma.question.update.mockResolvedValue({
      id: QUESTION_ID,
      approvalStatus: 'APPROVED',
      options: [{ id: 'o1' }, { id: 'o2' }],
    });

    const result = await questionService.approveQuestion(QUESTION_ID, MOD_ID, {
      options: [{ text: 'A' }, { text: 'B' }],
    });

    expect(permissionsService.ensureModerator).toHaveBeenCalledWith(
      GAME_ID,
      MOD_ID
    );
    const updateArg = mockPrisma.question.update.mock.calls[0][0];
    expect(updateArg.data.approvalStatus).toBe('APPROVED');
    expect(updateArg.data.options.create).toHaveLength(2);
    expect(result.approvalStatus).toBe('APPROVED');
  });

  it('rejects approving a question that is not pending', async () => {
    mockPrisma.question.findUnique.mockResolvedValue({
      id: QUESTION_ID,
      gameId: GAME_ID,
      approvalStatus: 'APPROVED',
    });
    permissionsService.ensureModerator.mockResolvedValue({ role: 'MODERATOR' });

    await expect(
      questionService.approveQuestion(QUESTION_ID, MOD_ID, {
        options: [{ text: 'A' }, { text: 'B' }],
      })
    ).rejects.toThrow(/not pending approval/i);

    // הרשאה נבדקת לפני מצב ה-PENDING (מונע דליפת מצב למי שאינו מנחה)
    expect(permissionsService.ensureModerator).toHaveBeenCalledWith(
      GAME_ID,
      MOD_ID
    );
    expect(mockPrisma.question.update).not.toHaveBeenCalled();
  });
});

describe('questionService.rejectQuestion', () => {
  it('sets a pending question to REJECTED', async () => {
    mockPrisma.question.findUnique.mockResolvedValue({
      id: QUESTION_ID,
      gameId: GAME_ID,
      approvalStatus: 'PENDING',
    });
    permissionsService.ensureModerator.mockResolvedValue({ role: 'MODERATOR' });
    mockPrisma.question.update.mockResolvedValue({
      id: QUESTION_ID,
      approvalStatus: 'REJECTED',
    });

    const result = await questionService.rejectQuestion(QUESTION_ID, MOD_ID);

    const updateArg = mockPrisma.question.update.mock.calls[0][0];
    expect(updateArg.data.approvalStatus).toBe('REJECTED');
    expect(result.approvalStatus).toBe('REJECTED');
  });

  it('rejects rejecting a question that is not pending', async () => {
    mockPrisma.question.findUnique.mockResolvedValue({
      id: QUESTION_ID,
      gameId: GAME_ID,
      approvalStatus: 'REJECTED',
    });
    permissionsService.ensureModerator.mockResolvedValue({ role: 'MODERATOR' });

    await expect(
      questionService.rejectQuestion(QUESTION_ID, MOD_ID)
    ).rejects.toThrow(/not pending approval/i);

    // הרשאה נבדקת לפני מצב ה-PENDING (מונע דליפת מצב למי שאינו מנחה)
    expect(permissionsService.ensureModerator).toHaveBeenCalledWith(
      GAME_ID,
      MOD_ID
    );
    expect(mockPrisma.question.update).not.toHaveBeenCalled();
  });
});
