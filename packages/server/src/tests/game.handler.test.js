import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────

const {
  mockParticipantCreate,
  mockTransaction,
  mockUserAnswerCreate,
  mockUserUpdate,
  mockGameFindUnique,
  mockUserFindUnique,
  mockParticipantFindUnique,
} = vi.hoisted(() => ({
  mockParticipantCreate: vi.fn(),
  mockTransaction: vi.fn(),
  mockUserAnswerCreate: vi.fn(),
  mockUserUpdate: vi.fn(),
  mockGameFindUnique: vi.fn(),
  mockUserFindUnique: vi.fn(),
  mockParticipantFindUnique: vi.fn(),
}));

vi.mock('../lib/prisma.js', () => ({
  default: {
    game: { findUnique: mockGameFindUnique },
    user: {
      findUnique: mockUserFindUnique,
      update: mockUserUpdate,
    },
    gameParticipant: {
      findUnique: mockParticipantFindUnique,
      create: mockParticipantCreate,
    },
    userAnswer: {
      create: mockUserAnswerCreate,
    },
    $transaction: mockTransaction,
  },
}));

const { mockValidateJoinEligibility } = vi.hoisted(() => ({
  mockValidateJoinEligibility: vi.fn(),
}));

vi.mock('../services/validation.service.js', () => ({
  validateJoinEligibility: mockValidateJoinEligibility,
}));

const { mockCreateGame, mockUpdateGameStatus } = vi.hoisted(() => ({
  mockCreateGame: vi.fn(),
  mockUpdateGameStatus: vi.fn(),
}));

vi.mock('../services/game.service.js', () => ({
  default: {
    createGame: mockCreateGame,
    updateGameStatus: mockUpdateGameStatus,
  },
}));

const { mockSubmitAnswer } = vi.hoisted(() => ({
  mockSubmitAnswer: vi.fn(),
}));

vi.mock('../services/userAnswer.service.js', () => ({
  default: { submitAnswer: mockSubmitAnswer },
}));

const { mockSyncUserBalances } = vi.hoisted(() => ({
  mockSyncUserBalances: vi.fn(),
}));

vi.mock('../utils/socketHelpers.js', () => ({
  syncUserBalances: mockSyncUserBalances,
}));

vi.mock('../sockets/moderatorInvitation.handler.js', () => ({
  registerModeratorInvitationHandlers: vi.fn(),
}));

// שולטים ידנית על תוצאת הוולידציה של Zod, בלי לתלות את הטסט בפרטי
// המימוש הפנימי של הסכמה המשותפת (@worldplay/shared).
const { mockSafeParse } = vi.hoisted(() => ({ mockSafeParse: vi.fn() }));

vi.mock('@worldplay/shared', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    JoinGameSchema: { safeParse: mockSafeParse },
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      socketJoin: vi.fn(),
    },
  };
});

import { registerGameHandlers } from '../sockets/game.handler.js';
import {
  ERROR_MESSAGES,
  SOCKET_EVENTS,
  ROOM_UPDATE_TYPE,
} from '@worldplay/shared';
import { UserRole } from '@prisma/client';

// ─────────────────────────────────────────────
// עזרי בדיקה
// ─────────────────────────────────────────────

function createMockSocket(id, userId) {
  const handlers = {};
  return {
    id,
    user: { id: userId, username: `user-${userId}`, avatarUrl: null },
    handlers,
    rooms: new Set(),
    on: vi.fn((event, handler) => {
      handlers[event] = handler;
    }),
    join: vi.fn(),
    emit: vi.fn(),
  };
}

function createMockIo() {
  return {
    to: vi.fn().mockReturnValue({ emit: vi.fn() }),
    sockets: { sockets: new Map() },
  };
}

// ─────────────────────────────────────────────
// טסטים
// ─────────────────────────────────────────────

describe('game.handler', () => {
  let io, socket;

  beforeEach(() => {
    mockParticipantCreate.mockReset();
    mockTransaction.mockReset();
    mockUserAnswerCreate.mockReset();
    mockUserUpdate.mockReset();
    mockValidateJoinEligibility.mockReset();
    mockCreateGame.mockReset();
    mockUpdateGameStatus.mockReset();
    mockSyncUserBalances.mockReset();
    mockSubmitAnswer.mockReset();
    mockSafeParse.mockReset();

    socket = createMockSocket('socket-1', 'user-1');
    io = createMockIo();
    registerGameHandlers(io, socket);
  });

  // ═══════════════════════════════════════════
  // JOIN
  // ═══════════════════════════════════════════
  describe('JOIN', () => {
    const gameId = 'game-1';

    it('שולחת SYSTEM.ERROR עם INVALID_DATA_FORMAT כשה-payload לא עובר ולידציה', async () => {
      mockSafeParse.mockReturnValueOnce({
        success: false,
        error: { format: () => ({ gameId: { _errors: ['required'] } }) },
      });

      await socket.handlers[SOCKET_EVENTS.GAME.JOIN]({});

      expect(socket.emit).toHaveBeenCalledWith(
        SOCKET_EVENTS.SYSTEM.ERROR,
        expect.objectContaining({ msg: ERROR_MESSAGES.INVALID_DATA_FORMAT })
      );
      expect(mockValidateJoinEligibility).not.toHaveBeenCalled();
    });

    it('שולחת SYSTEM_MESSAGE ALREADY_CONNECTED_TO_ROOM אם הסוקט כבר בחדר', async () => {
      mockSafeParse.mockReturnValueOnce({
        success: true,
        data: { gameId, role: UserRole.VIEWER },
      });
      socket.rooms.add(gameId);

      await socket.handlers[SOCKET_EVENTS.GAME.JOIN]({
        gameId,
        role: UserRole.VIEWER,
      });

      expect(socket.emit).toHaveBeenCalledWith(
        SOCKET_EVENTS.SYSTEM.SYSTEM_MESSAGE,
        expect.objectContaining({
          msg: ERROR_MESSAGES.ALREADY_CONNECTED_TO_ROOM,
        })
      );
      expect(mockValidateJoinEligibility).not.toHaveBeenCalled();
    });

    it('כשה-status הוא ALREADY_JOINED — מצטרפת לחדר ושולחת WELCOME_BACK, בלי ליצור participant חדש', async () => {
      mockSafeParse.mockReturnValueOnce({
        success: true,
        data: { gameId, role: UserRole.VIEWER },
      });
      mockValidateJoinEligibility.mockResolvedValueOnce({
        status: 'ALREADY_JOINED',
      });

      await socket.handlers[SOCKET_EVENTS.GAME.JOIN]({
        gameId,
        role: UserRole.VIEWER,
      });

      expect(socket.join).toHaveBeenCalledWith(gameId);
      expect(mockParticipantCreate).not.toHaveBeenCalled();
      expect(socket.emit).toHaveBeenCalledWith(
        SOCKET_EVENTS.SYSTEM.SYSTEM_MESSAGE,
        expect.objectContaining({
          msg: expect.stringContaining(gameId),
        })
      );
    });

    it('מצליחה: יוצרת participant, מצטרפת לחדר, ומשדרת ROOM_UPDATE (USER_JOINED)', async () => {
      mockSafeParse.mockReturnValueOnce({
        success: true,
        data: { gameId, role: UserRole.VIEWER },
      });
      mockValidateJoinEligibility.mockResolvedValueOnce({ status: 'ELIGIBLE' });
      mockParticipantCreate.mockResolvedValueOnce({ id: 'participant-1' });

      const roomEmit = vi.fn();
      io.to.mockReturnValueOnce({ emit: roomEmit });

      await socket.handlers[SOCKET_EVENTS.GAME.JOIN]({
        gameId,
        role: UserRole.VIEWER,
      });

      expect(mockParticipantCreate).toHaveBeenCalledWith({
        data: { gameId, userId: 'user-1', role: UserRole.VIEWER, score: 0 },
      });
      expect(socket.join).toHaveBeenCalledWith(gameId);
      expect(io.to).toHaveBeenCalledWith(gameId);
      expect(roomEmit).toHaveBeenCalledWith(
        SOCKET_EVENTS.GAME.ROOM_UPDATE,
        expect.objectContaining({
          type: ROOM_UPDATE_TYPE.USER_JOINED,
          userId: 'user-1',
        })
      );
    });

    it('שולחת SYSTEM.ERROR FAILED_TO_JOIN_GAME כשה-DB זורק שגיאה', async () => {
      mockSafeParse.mockReturnValueOnce({
        success: true,
        data: { gameId, role: UserRole.VIEWER },
      });
      mockValidateJoinEligibility.mockResolvedValueOnce({ status: 'ELIGIBLE' });
      mockParticipantCreate.mockRejectedValueOnce(new Error('DB down'));

      await socket.handlers[SOCKET_EVENTS.GAME.JOIN]({
        gameId,
        role: UserRole.VIEWER,
      });

      expect(socket.emit).toHaveBeenCalledWith(
        SOCKET_EVENTS.SYSTEM.ERROR,
        expect.objectContaining({ msg: ERROR_MESSAGES.FAILED_TO_JOIN_GAME })
      );
    });

    it('משתמשת בברירת מחדל UserRole.VIEWER כש-role לא סופק', async () => {
      mockSafeParse.mockReturnValueOnce({
        success: true,
        data: { gameId, role: undefined },
      });
      mockValidateJoinEligibility.mockResolvedValueOnce({ status: 'ELIGIBLE' });
      mockParticipantCreate.mockResolvedValueOnce({ id: 'participant-1' });

      await socket.handlers[SOCKET_EVENTS.GAME.JOIN]({ gameId });

      expect(mockValidateJoinEligibility).toHaveBeenCalledWith(
        gameId,
        'user-1',
        UserRole.VIEWER
      );
      expect(mockParticipantCreate).toHaveBeenCalledWith({
        data: { gameId, userId: 'user-1', role: UserRole.VIEWER, score: 0 },
      });
    });
  });

  // ═══════════════════════════════════════════
  // CREATE
  // ═══════════════════════════════════════════
  describe('CREATE', () => {
    it('מצליחה: מחזירה gameId ו-streamId מ-callback', async () => {
      mockCreateGame.mockResolvedValueOnce({
        id: 'game-1',
        streamId: 'stream-1',
      });
      const cb = vi.fn();

      await socket.handlers[SOCKET_EVENTS.GAME.CREATE](
        { title: 'Trivia', description: 'fun' },
        cb
      );

      expect(mockCreateGame).toHaveBeenCalledWith('user-1', {
        title: 'Trivia',
        description: 'fun',
      });
      expect(cb).toHaveBeenCalledWith({
        success: true,
        gameId: 'game-1',
        streamId: 'stream-1',
      });
    });

    it('מחזירה FAILED_TO_CREATE_GAME כש-gameService זורק שגיאה', async () => {
      mockCreateGame.mockRejectedValueOnce(new Error('DB down'));
      const cb = vi.fn();

      await socket.handlers[SOCKET_EVENTS.GAME.CREATE](
        { title: 'Trivia', description: 'fun' },
        cb
      );

      expect(cb).toHaveBeenCalledWith({
        error: ERROR_MESSAGES.FAILED_TO_CREATE_GAME,
      });
    });
  });

  // ═══════════════════════════════════════════
  // PLACE_BET
  // ═══════════════════════════════════════════
  describe('PLACE_BET', () => {
    it('מצליחה: ממפה optionId/amount ל-selectedOptionId/wager וקוראת לשירות', async () => {
      mockSubmitAnswer.mockResolvedValueOnce({ id: 'answer-1' });

      await socket.handlers[SOCKET_EVENTS.GAME.PLACE_BET]({
        gameId: 'game-1',
        questionId: 'q-1',
        optionId: 'opt-1',
        amount: 10,
      });

      expect(mockSubmitAnswer).toHaveBeenCalledWith(io, 'user-1', {
        questionId: 'q-1',
        selectedOptionId: 'opt-1',
        wager: 10,
      });
    });

    it('אינה נוגעת ב-Prisma ישירות — כל הלוגיקה עוברת דרך userAnswerService', async () => {
      mockSubmitAnswer.mockResolvedValueOnce({ id: 'answer-1' });

      await socket.handlers[SOCKET_EVENTS.GAME.PLACE_BET]({
        gameId: 'game-1',
        questionId: 'q-1',
        optionId: 'opt-1',
        amount: 10,
      });

      expect(mockTransaction).not.toHaveBeenCalled();
      expect(mockUserAnswerCreate).not.toHaveBeenCalled();
      expect(mockUserUpdate).not.toHaveBeenCalled();
    });

    it('שולחת SYSTEM.ERROR BET_FAILED כשהשירות דוחה את ההימור', async () => {
      mockSubmitAnswer.mockRejectedValueOnce(
        new Error(ERROR_MESSAGES.INSUFFICIENT_COINS)
      );

      await socket.handlers[SOCKET_EVENTS.GAME.PLACE_BET]({
        gameId: 'game-1',
        questionId: 'q-1',
        optionId: 'opt-1',
        amount: 10,
      });

      expect(socket.emit).toHaveBeenCalledWith(
        SOCKET_EVENTS.SYSTEM.ERROR,
        expect.objectContaining({ msg: ERROR_MESSAGES.BET_FAILED })
      );
      expect(mockSyncUserBalances).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════
  // STATUS_UPDATE
  // ═══════════════════════════════════════════
  describe('STATUS_UPDATE', () => {
    it('דוחה סטטוס לא תקין ומחזירה הודעה עם הערכים המותרים', async () => {
      const cb = vi.fn();

      await socket.handlers[SOCKET_EVENTS.GAME.STATUS_UPDATE](
        { gameId: 'game-1', status: 'BOGUS' },
        cb
      );

      expect(cb).toHaveBeenCalledWith({
        error: expect.stringContaining('WAITING'),
      });
      expect(mockUpdateGameStatus).not.toHaveBeenCalled();
    });

    it('דוחה בקשה כש-status חסר לגמרי מה-payload', async () => {
      const cb = vi.fn();

      await socket.handlers[SOCKET_EVENTS.GAME.STATUS_UPDATE](
        { gameId: 'game-1' },
        cb
      );

      expect(cb).toHaveBeenCalledWith({
        error: expect.stringContaining('WAITING'),
      });
      expect(mockUpdateGameStatus).not.toHaveBeenCalled();
    });

    it('מצליחה: מעדכנת סטטוס ומחזירה את המשחק המעודכן', async () => {
      mockUpdateGameStatus.mockResolvedValueOnce({
        id: 'game-1',
        status: 'ACTIVE',
      });
      const cb = vi.fn();

      await socket.handlers[SOCKET_EVENTS.GAME.STATUS_UPDATE](
        { gameId: 'game-1', status: 'active' },
        cb
      );

      expect(mockUpdateGameStatus).toHaveBeenCalledWith(
        'game-1',
        'user-1',
        'ACTIVE'
      );
      expect(cb).toHaveBeenCalledWith({
        success: true,
        game: { id: 'game-1', status: 'ACTIVE' },
      });
    });

    it('מחזירה FAILED_TO_UPDATE_STATUS כש-gameService זורק שגיאה', async () => {
      mockUpdateGameStatus.mockRejectedValueOnce(new Error('DB down'));
      const cb = vi.fn();

      await socket.handlers[SOCKET_EVENTS.GAME.STATUS_UPDATE](
        { gameId: 'game-1', status: 'ACTIVE' },
        cb
      );

      expect(cb).toHaveBeenCalledWith({
        error: ERROR_MESSAGES.FAILED_TO_UPDATE_STATUS,
      });
    });
  });
});
