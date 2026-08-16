import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@prisma/client', () => ({ PrismaClient: vi.fn(() => ({})) }));
vi.mock('../services/game.service.js', () => ({
  default: { resolveQuestion: vi.fn() },
}));
vi.mock('../services/validation.service.js', () => ({
  validateJoinEligibility: vi.fn(),
}));
vi.mock('@worldplay/shared', () => ({
  logger: { info: vi.fn(), error: vi.fn(), socketJoin: vi.fn() },
  JoinGameSchema: { safeParse: vi.fn() },
  ResolveQuestionSchema: { safeParse: vi.fn() },
  ERROR_MESSAGES: {
    INVALID_DATA_FORMAT: 'Invalid data format',
    FAILED_TO_PERFORM_MODERATION_ACTION: 'Failed to perform moderation action',
  },
  SOCKET_EVENTS: {
    GAME: {
      JOIN: 'game:join_room',
      CREATE: 'game:create',
      PLACE_BET: 'game:place_bet',
      STATUS_UPDATE: 'game:status_update',
      RESOLVE_QUESTION: 'game:resolve_question',
      QUESTION_RESULT: 'game:question_result',
      INVITE_MODERATOR: 'game:invite_moderator',
      ACCEPT_MODERATOR: 'game:accept_moderator',
      REJECT_MODERATOR: 'game:reject_moderator',
      MODERATOR_INVITATION: 'game:moderator_invitation',
      MODERATOR_RESPONSE: 'game:moderator_response',
    },
    STREAM: {
      WATCH: 'stream:watch',
    },
  },
}));

import gameService from '../services/game.service.js';
import { ResolveQuestionSchema } from '@worldplay/shared';
import { registerGameHandlers } from '../sockets/game.handler.js';

function buildFakeSocket(userId) {
  const handlers = {};
  return {
    user: { id: userId, username: 'mod' },
    rooms: new Set(),
    on: vi.fn((event, cb) => {
      handlers[event] = cb;
    }),
    emit: vi.fn(),
    _handlers: handlers,
  };
}

describe('game.handler RESOLVE_QUESTION', () => {
  let io, socket;

  beforeEach(() => {
    vi.clearAllMocks();

    // ברירת מחדל: הוולידציה "עוברת" ומחזירה את ה-payload כמו שהוא
    ResolveQuestionSchema.safeParse.mockImplementation((payload) => ({
      success: true,
      data: payload,
    }));

    io = {
      to: vi.fn().mockReturnThis(),
      emit: vi.fn(),
      sockets: { sockets: new Map() },
    };
    socket = buildFakeSocket('mod-1');
    registerGameHandlers(io, socket);
  });

  it('emits QUESTION_RESULT per user based on service results', async () => {
    gameService.resolveQuestion.mockResolvedValue([
      { userId: 'user-a', type: 'win' },
      { userId: 'user-b', type: 'lose' },
    ]);

    const callback = vi.fn();
    await socket._handlers['game:resolve_question'](
      { gameId: 'game-1', questionId: 'question-1' },
      callback
    );

    expect(gameService.resolveQuestion).toHaveBeenCalledWith(
      'game-1',
      'question-1',
      'mod-1'
    );
    expect(io.to).toHaveBeenCalledWith('user-a');
    expect(io.to).toHaveBeenCalledWith('user-b');
    expect(io.emit).toHaveBeenCalledWith('game:question_result', {
      questionId: 'question-1',
      type: 'win',
    });
    expect(callback).toHaveBeenCalledWith({ success: true, resolvedCount: 2 });
  });

  it('rejects invalid payload before touching the service', async () => {
    ResolveQuestionSchema.safeParse.mockReturnValue({
      success: false,
      error: { format: () => ({ gameId: { _errors: ['Invalid uuid'] } }) },
    });

    const callback = vi.fn();
    await socket._handlers['game:resolve_question'](
      { gameId: 'not-a-uuid' },
      callback
    );

    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.any(String) })
    );
    expect(gameService.resolveQuestion).not.toHaveBeenCalled();
  });

  it('returns a generic error via callback when the service throws (does not leak internal message)', async () => {
    gameService.resolveQuestion.mockRejectedValue(
      new Error('some internal DB error')
    );
    const callback = vi.fn();
    await socket._handlers['game:resolve_question'](
      { gameId: 'game-1', questionId: 'question-1' },
      callback
    );

    expect(callback).toHaveBeenCalledWith({
      error: 'Failed to perform moderation action',
    });
    expect(io.to).not.toHaveBeenCalled();
  });
});
