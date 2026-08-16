/**
 * game.service.test.js
 *
 * בדיקות יחידה ל-updateGameStatus/cancelOldGames — מוקדות בשילוב עם
 * streamService.cancelFreeze (SCRUM-172, D2 — ניקוי freeze בסיום/ביטול משחק).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GameStatus, StreamStatus } from '@prisma/client';

vi.mock('../lib/prisma.js', () => ({
  default: {
    game: { findMany: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
    stream: { updateMany: vi.fn(), create: vi.fn() },
    gameParticipant: { create: vi.fn() },
    userGameActivity: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock('../services/stream.service.js', () => ({
  default: {
    cancelFreeze: vi.fn(),
  },
}));

vi.mock('../services/permissions.service.js', () => ({
  default: {
    ensureHost: vi.fn(),
  },
}));

vi.mock('../services/validation.service.js', () => ({
  ensureGameExists: vi.fn(),
  validateStatusTransition: vi.fn(),
  validateHostIsAvailable: vi.fn(),
}));

import gameService from '../services/game.service.js';
import prisma from '../lib/prisma.js';
import streamService from '../services/stream.service.js';
import permissionsService from '../services/permissions.service.js';
import * as gameRules from '../services/validation.service.js';

describe('gameService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── updateGameStatus ──────────────────────────────────────

  describe('updateGameStatus', () => {
    it('כשעוברים ל-FINISHED עם streamId: קוראת ל-cancelFreeze לפני עדכון הסטרים', async () => {
      gameRules.ensureGameExists.mockResolvedValueOnce({
        id: 'game-1',
        status: GameStatus.ACTIVE,
        streamId: 'stream-1',
        startedAt: new Date(),
      });
      permissionsService.ensureHost.mockResolvedValueOnce(true);
      prisma.game.update.mockResolvedValueOnce({
        id: 'game-1',
        status: GameStatus.FINISHED,
      });
      streamService.cancelFreeze.mockResolvedValueOnce({});
      prisma.stream.updateMany.mockResolvedValueOnce({ count: 1 });

      await gameService.updateGameStatus(
        'game-1',
        'user-1',
        GameStatus.FINISHED
      );

      expect(streamService.cancelFreeze).toHaveBeenCalledWith('stream-1');
      expect(prisma.stream.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['stream-1'] } },
        data: expect.objectContaining({ status: StreamStatus.FINISHED }),
      });

      // סדר קריאות: cancelFreeze חייב לקרות לפני updateMany
      const cancelOrder =
        streamService.cancelFreeze.mock.invocationCallOrder[0];
      const updateOrder = prisma.stream.updateMany.mock.invocationCallOrder[0];
      expect(cancelOrder).toBeLessThan(updateOrder);
    });

    it('כשעוברים ל-ACTIVE: לא קוראת ל-cancelFreeze בכלל', async () => {
      gameRules.ensureGameExists.mockResolvedValueOnce({
        id: 'game-1',
        status: GameStatus.WAITING,
        streamId: 'stream-1',
      });
      permissionsService.ensureHost.mockResolvedValueOnce(true);
      prisma.game.update.mockResolvedValueOnce({
        id: 'game-1',
        status: GameStatus.ACTIVE,
      });

      await gameService.updateGameStatus('game-1', 'user-1', GameStatus.ACTIVE);

      expect(streamService.cancelFreeze).not.toHaveBeenCalled();
      expect(prisma.stream.updateMany).not.toHaveBeenCalled();
    });

    it('FINISHED אך אין streamId: לא קוראת ל-cancelFreeze ולא לעדכון סטרים', async () => {
      gameRules.ensureGameExists.mockResolvedValueOnce({
        id: 'game-1',
        status: GameStatus.ACTIVE,
        streamId: null,
      });
      permissionsService.ensureHost.mockResolvedValueOnce(true);
      prisma.game.update.mockResolvedValueOnce({
        id: 'game-1',
        status: GameStatus.FINISHED,
      });

      await gameService.updateGameStatus(
        'game-1',
        'user-1',
        GameStatus.FINISHED
      );

      expect(streamService.cancelFreeze).not.toHaveBeenCalled();
      expect(prisma.stream.updateMany).not.toHaveBeenCalled();
    });

    it('קוראת ל-cancelFreeze פעם אחת בלבד לכל עדכון סטטוס (לא כפול)', async () => {
      gameRules.ensureGameExists.mockResolvedValueOnce({
        id: 'game-1',
        status: GameStatus.ACTIVE,
        streamId: 'stream-1',
      });
      permissionsService.ensureHost.mockResolvedValueOnce(true);
      prisma.game.update.mockResolvedValueOnce({
        id: 'game-1',
        status: GameStatus.FINISHED,
      });
      streamService.cancelFreeze.mockResolvedValueOnce({});
      prisma.stream.updateMany.mockResolvedValueOnce({ count: 1 });

      await gameService.updateGameStatus(
        'game-1',
        'user-1',
        GameStatus.FINISHED
      );

      expect(streamService.cancelFreeze).toHaveBeenCalledTimes(1);
    });

    it('שומרת endTime על הסטרים כשמסתיים', async () => {
      gameRules.ensureGameExists.mockResolvedValueOnce({
        id: 'game-1',
        status: GameStatus.ACTIVE,
        streamId: 'stream-1',
      });
      permissionsService.ensureHost.mockResolvedValueOnce(true);
      prisma.game.update.mockResolvedValueOnce({});
      streamService.cancelFreeze.mockResolvedValueOnce({});
      prisma.stream.updateMany.mockResolvedValueOnce({ count: 1 });

      await gameService.updateGameStatus(
        'game-1',
        'user-1',
        GameStatus.FINISHED
      );

      expect(prisma.stream.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ endTime: expect.any(Date) }),
        })
      );
    });
  });

  // ── cancelOldGames (דרך createGame) ───────────────────────

  describe('cancelOldGames (via createGame)', () => {
    function mockTransaction() {
      prisma.$transaction.mockImplementationOnce(async (cb) => {
        const tx = {
          stream: { create: vi.fn().mockResolvedValue({ id: 'new-stream' }) },
          game: { create: vi.fn().mockResolvedValue({ id: 'new-game' }) },
          gameParticipant: { create: vi.fn().mockResolvedValue({}) },
          userGameActivity: { create: vi.fn().mockResolvedValue({}) },
        };
        return cb(tx);
      });
    }

    it('קוראת ל-cancelFreeze על כל streamId בנפרד כשיש כמה משחקים ישנים', async () => {
      prisma.game.findMany.mockResolvedValueOnce([
        { id: 'old-game-1', streamId: 'old-stream-1' },
        { id: 'old-game-2', streamId: 'old-stream-2' },
      ]);
      prisma.game.updateMany.mockResolvedValueOnce({ count: 2 });
      streamService.cancelFreeze.mockResolvedValue({});
      prisma.stream.updateMany.mockResolvedValueOnce({ count: 2 });
      gameRules.validateHostIsAvailable.mockResolvedValueOnce(undefined);
      mockTransaction();

      await gameService.createGame('user-1', { title: 'New Game' });

      expect(streamService.cancelFreeze).toHaveBeenCalledTimes(2);
      expect(streamService.cancelFreeze).toHaveBeenCalledWith('old-stream-1');
      expect(streamService.cancelFreeze).toHaveBeenCalledWith('old-stream-2');
    });

    it('לא קוראת ל-cancelFreeze כשלמשחקים הישנים אין streamId בכלל', async () => {
      prisma.game.findMany.mockResolvedValueOnce([
        { id: 'old-game-1', streamId: null },
      ]);
      prisma.game.updateMany.mockResolvedValueOnce({ count: 1 });
      gameRules.validateHostIsAvailable.mockResolvedValueOnce(undefined);
      mockTransaction();

      await gameService.createGame('user-1', { title: 'New Game' });

      expect(streamService.cancelFreeze).not.toHaveBeenCalled();
      expect(prisma.stream.updateMany).not.toHaveBeenCalled();
    });

    it('אין משחקים ישנים בכלל: יוצאת מוקדם, לא נוגעת בכלום', async () => {
      prisma.game.findMany.mockResolvedValueOnce([]);
      gameRules.validateHostIsAvailable.mockResolvedValueOnce(undefined);
      mockTransaction();

      await gameService.createGame('user-1', { title: 'New Game' });

      expect(prisma.game.updateMany).not.toHaveBeenCalled();
      expect(streamService.cancelFreeze).not.toHaveBeenCalled();
    });
  });
});
