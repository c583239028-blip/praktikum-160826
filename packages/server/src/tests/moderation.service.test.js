/**
 * moderation.service.test.js
 *
 * בדיקות יחידה ל-moderation.service.js.
 * מוקאת את ה-prisma singleton (lib/prisma.js) — אין פגיעה ב-DB אמיתי.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ModerationType, GameStatus } from '@prisma/client';
import { ERROR_MESSAGES } from '@worldplay/shared';

const { mockNotificationCreate } = vi.hoisted(() => ({
  mockNotificationCreate: vi.fn(),
}));

vi.mock('../lib/prisma.js', () => ({
  default: {
    game: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
    moderationAction: { create: vi.fn(), findMany: vi.fn() },
  },
}));

vi.mock('../services/notification.service.js', () => ({
  default: { createNewNotification: mockNotificationCreate },
}));

import moderationService from '../services/moderation.service.js';
import prisma from '../lib/prisma.js';

// ── Helpers ────────────────────────────────────────────────

const makeGame = (overrides = {}) => ({
  id: 'game-1',
  hostId: 'host-1',
  isUnderReview: false,
  ...overrides,
});

const makeReporters = (count) =>
  Array.from({ length: count }, (_, i) => ({ actorId: `user-${i + 1}` }));

describe('moderationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── findActiveGameForStream ──────────────────────────────

  describe('findActiveGameForStream', () => {
    it('queries Prisma for an ACTIVE game scoped to the given streamId', async () => {
      const fakeGame = {
        id: 'game-1',
        streamId: 'stream-1',
        status: GameStatus.ACTIVE,
      };
      prisma.game.findFirst.mockResolvedValue(fakeGame);

      const result =
        await moderationService.findActiveGameForStream('stream-1');

      expect(prisma.game.findFirst).toHaveBeenCalledWith({
        where: { streamId: 'stream-1', status: GameStatus.ACTIVE },
      });
      expect(result).toEqual(fakeGame);
    });

    it('returns null when there is no active game for the stream', async () => {
      prisma.game.findFirst.mockResolvedValue(null);

      const result =
        await moderationService.findActiveGameForStream('stream-1');

      expect(result).toBeNull();
    });
  });

  // ── createReport ──────────────────────────────────────────

  describe('createReport', () => {
    it('creates a REPORT action scoped to streamId AND gameId, with targetUserId forced to null', async () => {
      const fakeAction = { id: 'action-1', type: ModerationType.REPORT };
      prisma.moderationAction.create.mockResolvedValue(fakeAction);
      prisma.moderationAction.findMany.mockResolvedValue(makeReporters(1));

      const result = await moderationService.createReport(
        'stream-1',
        'game-1',
        'user-1',
        'spam'
      );

      expect(prisma.moderationAction.create).toHaveBeenCalledWith({
        data: {
          type: ModerationType.REPORT,
          streamId: 'stream-1',
          gameId: 'game-1',
          actorId: 'user-1',
          targetUserId: null,
          reason: 'spam',
        },
      });
      expect(result).toEqual(fakeAction);
    });

    it('allows reason to be omitted', async () => {
      prisma.moderationAction.create.mockResolvedValue({ id: 'action-2' });
      prisma.moderationAction.findMany.mockResolvedValue(makeReporters(1));

      await moderationService.createReport(
        'stream-1',
        'game-1',
        'user-1',
        undefined
      );

      expect(prisma.moderationAction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ reason: undefined }),
      });
    });
  });

  // ── checkReportThreshold ──────────────────────────────────

  describe('checkReportThreshold', () => {
    it('does not flag stream when unique reporters are below threshold (4)', async () => {
      prisma.moderationAction.findMany.mockResolvedValue(makeReporters(4));

      await moderationService.checkReportThreshold('game-1');

      expect(prisma.game.updateMany).not.toHaveBeenCalled();
      expect(mockNotificationCreate).not.toHaveBeenCalled();
    });

    it('flags stream and notifies host when exactly 5 unique reporters', async () => {
      prisma.moderationAction.findMany.mockResolvedValue(makeReporters(5));
      prisma.game.updateMany.mockResolvedValue({ count: 1 });
      prisma.game.findUnique.mockResolvedValue(makeGame());
      mockNotificationCreate.mockResolvedValue({});

      await moderationService.checkReportThreshold('game-1');

      expect(prisma.game.updateMany).toHaveBeenCalledWith({
        where: { id: 'game-1', isUnderReview: false },
        data: { isUnderReview: true },
      });
      expect(mockNotificationCreate).toHaveBeenCalledWith(
        'host-1',
        ERROR_MESSAGES.GAME_UNDER_REVIEW_TITLE,
        ERROR_MESSAGES.GAME_UNDER_REVIEW_MESSAGE
      );
    });

    it('flags stream when reporters exceed threshold (6)', async () => {
      prisma.moderationAction.findMany.mockResolvedValue(makeReporters(6));
      prisma.game.updateMany.mockResolvedValue({ count: 1 });
      prisma.game.findUnique.mockResolvedValue(makeGame());
      mockNotificationCreate.mockResolvedValue({});

      const result = await moderationService.checkReportThreshold('game-1');

      expect(prisma.game.updateMany).toHaveBeenCalled();
      expect(result.uniqueReporterCount).toBe(6);
    });

    it('does not flag or notify again when stream is already under review', async () => {
      prisma.moderationAction.findMany.mockResolvedValue(makeReporters(6));
      prisma.game.updateMany.mockResolvedValue({ count: 0 });

      await moderationService.checkReportThreshold('game-1');

      expect(prisma.game.findUnique).not.toHaveBeenCalled();
      expect(mockNotificationCreate).not.toHaveBeenCalled();
    });

    it('counts reporters scoped to gameId, not streamId', async () => {
      prisma.moderationAction.findMany.mockResolvedValue(makeReporters(2));
      prisma.game.findUnique.mockResolvedValue(makeGame());

      await moderationService.checkReportThreshold('game-1');

      expect(prisma.moderationAction.findMany).toHaveBeenCalledWith({
        where: { gameId: 'game-1', type: ModerationType.REPORT },
        distinct: ['actorId'],
      });
    });
  });

  // ── getGamesUnderReview ─────────────────────────────────

  describe('getGamesUnderReview', () => {
    it('returns all games where isUnderReview is true', async () => {
      const mockGames = [
        {
          id: 'game-1',
          isUnderReview: true,
          host: { id: 'host-1', username: 'alice', email: 'alice@test.com' },
        },
      ];
      prisma.game.findMany.mockResolvedValue(mockGames);

      const result = await moderationService.getGamesUnderReview();

      expect(prisma.game.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isUnderReview: true } })
      );
      expect(result).toEqual(mockGames);
    });

    it('returns empty array when no games are under review', async () => {
      prisma.game.findMany.mockResolvedValue([]);

      const result = await moderationService.getGamesUnderReview();

      expect(result).toEqual([]);
    });
  });

  // ── createModerationAction ────────────────────────────────

  describe('createModerationAction', () => {
    it.each([ModerationType.MUTE, ModerationType.UNMUTE, ModerationType.KICK])(
      'creates a %s action with streamId, gameId, actorId, targetUserId, and reason',
      async (type) => {
        const fakeAction = { id: 'action-3', type };
        prisma.moderationAction.create.mockResolvedValue(fakeAction);

        const result = await moderationService.createModerationAction(
          type,
          'stream-1',
          'game-1',
          'mod-1',
          'target-1',
          'repeated rule violations'
        );

        expect(prisma.moderationAction.create).toHaveBeenCalledWith({
          data: {
            type,
            streamId: 'stream-1',
            gameId: 'game-1',
            actorId: 'mod-1',
            targetUserId: 'target-1',
            reason: 'repeated rule violations',
          },
        });
        expect(result).toEqual(fakeAction);
      }
    );

    it('allows reason to be omitted for mute/unmute/kick', async () => {
      prisma.moderationAction.create.mockResolvedValue({ id: 'action-4' });

      await moderationService.createModerationAction(
        ModerationType.KICK,
        'stream-1',
        'game-1',
        'mod-1',
        'target-1',
        undefined
      );

      expect(prisma.moderationAction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ reason: undefined }),
      });
    });
  });
});
