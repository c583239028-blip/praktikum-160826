/**
 * moderation.controller.test.js
 *
 * בדיקות יחידה ל-moderation.controller.js.
 * מוקאת את moderation.service.js ו-permissions.service.js — בודקת רק את
 * לוגיקת ה-HTTP (status codes, body, ניתוב פנימי) בלי לגעת ב-Prisma בכלל.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ModerationType } from '@prisma/client';
import moderationController from '../controller/moderation.controller.js';
import moderationService from '../services/moderation.service.js';
import permissionsService from '../services/permissions.service.js';
import { enforceMuteOnMediaServer } from '../utils/moderationSocket.js';
import { ERROR_MESSAGES, SOCKET_EVENTS } from '@worldplay/shared';

vi.mock('../services/moderation.service.js', () => ({
  default: {
    findActiveGameForStream: vi.fn(),
    createReport: vi.fn(),
    createModerationAction: vi.fn(),
    getGamesUnderReview: vi.fn(),
  },
}));

vi.mock('../services/permissions.service.js', () => ({
  default: {
    ensureModerator: vi.fn(),
  },
}));

vi.mock('../utils/moderationSocket.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, enforceMuteOnMediaServer: vi.fn() };
});

function buildReqRes({ params = {}, body = {}, userId = 'user-1', io } = {}) {
  const req = { params, body, user: { id: userId } };
  if (io) req.app = { get: (key) => (key === 'io' ? io : undefined) };
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return { req, res };
}

// io מזויף — to(room).emit(...) לפליטה, ו-in(room).socketsLeave(gameId) ל-KICK
function buildIo() {
  const emit = vi.fn();
  const to = vi.fn(() => ({ emit }));
  const socketsLeave = vi.fn();
  const inRoom = vi.fn(() => ({ socketsLeave }));
  return { io: { to, in: inRoom }, to, emit, inRoom, socketsLeave };
}

describe('moderationController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('report', () => {
    it('does not check moderator permission, but DOES bridge to the active game', async () => {
      const { req, res } = buildReqRes({
        params: { id: 'stream-1' },
        body: { reason: 'inappropriate behavior' },
      });
      moderationService.findActiveGameForStream.mockResolvedValue({
        id: 'game-1',
      });
      moderationService.createReport.mockResolvedValue({ id: 'action-1' });

      await moderationController.report(req, res);

      expect(permissionsService.ensureModerator).not.toHaveBeenCalled();
      expect(moderationService.findActiveGameForStream).toHaveBeenCalledWith(
        'stream-1'
      );
      expect(moderationService.createReport).toHaveBeenCalledWith(
        'stream-1',
        'game-1',
        'user-1',
        'inappropriate behavior'
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Report submitted successfully',
        data: { id: 'action-1' },
      });
    });

    it('returns 404 when there is no active game for the stream', async () => {
      const { req, res } = buildReqRes({ params: { id: 'stream-1' } });
      moderationService.findActiveGameForStream.mockResolvedValue(null);

      await moderationController.report(req, res);

      expect(moderationService.createReport).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: ERROR_MESSAGES.NO_ACTIVE_GAME_FOR_STREAM,
      });
    });

    it('returns 500 when the service throws', async () => {
      const { req, res } = buildReqRes({ params: { id: 'stream-1' } });
      moderationService.findActiveGameForStream.mockResolvedValue({
        id: 'game-1',
      });
      moderationService.createReport.mockRejectedValue(new Error('DB down'));

      await moderationController.report(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: ERROR_MESSAGES.FAILED_TO_SUBMIT_REPORT,
      });
    });
  });

  describe('mute / unmute / kick (performModeratorAction)', () => {
    const cases = [
      ['mute', ModerationType.MUTE],
      ['unmute', ModerationType.UNMUTE],
      ['kick', ModerationType.KICK],
    ];

    it.each(cases)(
      '%s returns 400 when targetUserId is missing, before checking for an active game',
      async (method) => {
        const { req, res } = buildReqRes({
          params: { id: 'stream-1' },
          body: {},
        });

        await moderationController[method](req, res);

        expect(
          moderationService.findActiveGameForStream
        ).not.toHaveBeenCalled();
        expect(permissionsService.ensureModerator).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          error: ERROR_MESSAGES.TARGET_USER_ID_REQUIRED,
        });
      }
    );

    it.each(cases)(
      '%s returns 404 when there is no active game for the stream',
      async (method) => {
        const { req, res } = buildReqRes({
          params: { id: 'stream-1' },
          body: { targetUserId: 'target-1' },
        });
        moderationService.findActiveGameForStream.mockResolvedValue(null);

        await moderationController[method](req, res);

        expect(permissionsService.ensureModerator).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({
          error: ERROR_MESSAGES.NO_ACTIVE_GAME_FOR_STREAM,
        });
      }
    );

    it.each(cases)(
      '%s returns 403 when the actor is not a moderator/host',
      async (method) => {
        const { req, res } = buildReqRes({
          params: { id: 'stream-1' },
          body: { targetUserId: 'target-1' },
        });
        moderationService.findActiveGameForStream.mockResolvedValue({
          id: 'game-1',
        });
        permissionsService.ensureModerator.mockRejectedValue(
          new Error(ERROR_MESSAGES.UNAUTHORIZED)
        );

        await moderationController[method](req, res);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({
          error: ERROR_MESSAGES.UNAUTHORIZED,
        });
        expect(moderationService.createModerationAction).not.toHaveBeenCalled();
      }
    );

    it.each(cases)(
      '%s creates the action with gameId and returns 201 when permission passes',
      async (method, type) => {
        const { req, res } = buildReqRes({
          params: { id: 'stream-1' },
          body: { targetUserId: 'target-1', reason: 'spamming chat' },
          userId: 'mod-1',
        });
        moderationService.findActiveGameForStream.mockResolvedValue({
          id: 'game-1',
        });
        permissionsService.ensureModerator.mockResolvedValue({
          role: 'MODERATOR',
        });
        moderationService.createModerationAction.mockResolvedValue({
          id: 'action-9',
          type,
        });

        await moderationController[method](req, res);

        expect(permissionsService.ensureModerator).toHaveBeenCalledWith(
          'game-1',
          'mod-1'
        );
        expect(moderationService.createModerationAction).toHaveBeenCalledWith(
          type,
          'stream-1',
          'game-1',
          'mod-1',
          'target-1',
          'spamming chat'
        );
        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith({
          message: 'Moderation action recorded',
          data: { id: 'action-9', type },
        });
      }
    );

    it.each(cases)(
      '%s returns 500 when the service throws after permission passes',
      async (method) => {
        const { req, res } = buildReqRes({
          params: { id: 'stream-1' },
          body: { targetUserId: 'target-1' },
        });
        moderationService.findActiveGameForStream.mockResolvedValue({
          id: 'game-1',
        });
        permissionsService.ensureModerator.mockResolvedValue({ role: 'HOST' });
        moderationService.createModerationAction.mockRejectedValue(
          new Error('DB down')
        );

        await moderationController[method](req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({
          error: ERROR_MESSAGES.FAILED_TO_PERFORM_MODERATION_ACTION,
        });
      }
    );
  });

  describe('real-time enforcement (socket layer)', () => {
    beforeEach(() => {
      moderationService.findActiveGameForStream.mockResolvedValue({
        id: 'game-1',
      });
      permissionsService.ensureModerator.mockResolvedValue({
        role: 'MODERATOR',
      });
      moderationService.createModerationAction.mockResolvedValue({
        id: 'action-9',
      });
    });

    it.each([
      ['mute', SOCKET_EVENTS.MODERATION.MUTED],
      ['unmute', SOCKET_EVENTS.MODERATION.UNMUTED],
    ])('%s emits %s to the target private room', async (method, event) => {
      const { io, to, emit } = buildIo();
      const { req, res } = buildReqRes({
        params: { id: 'stream-1' },
        body: { targetUserId: 'target-1' },
        io,
      });

      await moderationController[method](req, res);

      expect(to).toHaveBeenCalledWith('target-1');
      expect(emit).toHaveBeenCalledWith(event, { streamId: 'stream-1' });
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it.each([
      ['mute', true],
      ['unmute', false],
    ])(
      '%s enforces the change on the media server before notifying the target',
      async (method, muted) => {
        const { io } = buildIo();
        const { req, res } = buildReqRes({
          params: { id: 'stream-1' },
          body: { targetUserId: 'target-1' },
          io,
        });

        await moderationController[method](req, res);

        expect(enforceMuteOnMediaServer).toHaveBeenCalledWith(
          'stream-1',
          'target-1',
          muted
        );
        expect(res.status).toHaveBeenCalledWith(201);
      }
    );

    it('report and kick do not call the media-server mute channel', async () => {
      const { io } = buildIo();
      const { req: reportReq, res: reportRes } = buildReqRes({
        params: { id: 'stream-1' },
        body: { reason: 'spam' },
        io,
      });
      await moderationController.report(reportReq, reportRes);

      const { req: kickReq, res: kickRes } = buildReqRes({
        params: { id: 'stream-1' },
        body: { targetUserId: 'target-1' },
        io,
      });
      await moderationController.kick(kickReq, kickRes);

      expect(enforceMuteOnMediaServer).not.toHaveBeenCalled();
    });

    it('channel failure — logs and returns 500 instead of failing silently', async () => {
      enforceMuteOnMediaServer.mockRejectedValueOnce(
        new Error('media-server unreachable')
      );
      const { io, emit } = buildIo();
      const { req, res } = buildReqRes({
        params: { id: 'stream-1' },
        body: { targetUserId: 'target-1' },
        io,
      });

      await moderationController.mute(req, res);

      expect(console.error).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: ERROR_MESSAGES.FAILED_TO_PERFORM_MODERATION_ACTION,
      });
      // enforcement failed, so the target must not be told they're muted
      expect(emit).not.toHaveBeenCalled();
    });

    it('kick removes the target from the game room and emits KICKED', async () => {
      const { io, to, emit, inRoom, socketsLeave } = buildIo();
      const { req, res } = buildReqRes({
        params: { id: 'stream-1' },
        body: { targetUserId: 'target-1' },
        io,
      });

      await moderationController.kick(req, res);

      // scoped to the target's private room so only their sockets leave
      expect(inRoom).toHaveBeenCalledWith('target-1');
      expect(socketsLeave).toHaveBeenCalledWith('game-1');
      expect(to).toHaveBeenCalledWith('target-1');
      expect(emit).toHaveBeenCalledWith(SOCKET_EVENTS.MODERATION.KICKED, {
        streamId: 'stream-1',
      });
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('still records the action (201) when no io is attached', async () => {
      const { req, res } = buildReqRes({
        params: { id: 'stream-1' },
        body: { targetUserId: 'target-1' },
      });

      await moderationController.mute(req, res);

      expect(moderationService.createModerationAction).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
    });
  });

  describe('getGamesUnderReview', () => {
    it('200 — returns list of games under review', async () => {
      const mockGames = [
        {
          id: 'game-1',
          isUnderReview: true,
          host: { id: 'host-1', username: 'alice', email: 'alice@test.com' },
        },
      ];
      moderationService.getGamesUnderReview.mockResolvedValueOnce(mockGames);

      const { req, res } = buildReqRes();

      await moderationController.getGamesUnderReview(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ games: mockGames });
    });

    it('500 — unexpected error returns server error', async () => {
      moderationService.getGamesUnderReview.mockRejectedValueOnce(
        new Error('DB connection failed')
      );

      const { req, res } = buildReqRes();

      await moderationController.getGamesUnderReview(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: ERROR_MESSAGES.FAILED_TO_FETCH_GAMES_UNDER_REVIEW,
      });
    });
  });
});
