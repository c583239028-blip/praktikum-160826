// M8-11: senderId must come from req.user, never req.body — regression guard against the IDOR that let a caller drain another user's wallet.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ERROR_MESSAGES } from '@worldplay/shared';

vi.mock('../services/economy.service.js', () => ({
  default: { sendGift: vi.fn() },
}));

vi.mock('../utils/socketHelpers.js', () => ({
  syncUserBalances: vi.fn(),
}));

import economyController from '../controller/economy.controller.js';
import economyService from '../services/economy.service.js';
import { syncUserBalances } from '../utils/socketHelpers.js';

function buildMockRes() {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

function buildMockReq({ body, userId = 'user-1', io = null }) {
  return {
    user: { id: userId },
    body,
    app: { get: vi.fn().mockReturnValue(io) },
  };
}

const baseBody = {
  receiverPlayerId: 'player-1',
  moderatorId: 'mod-1',
  giftValue: 100,
  gameId: 'game-1',
};

describe('economyController.sendGift', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('403 — senderId זר ב-body: ה-service לא נקרא בכלל', async () => {
    const req = buildMockReq({
      body: { ...baseBody, senderId: 'victim-99' },
      userId: 'attacker-1',
    });
    const res = buildMockRes();

    await economyController.sendGift(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      status: 'error',
      message: ERROR_MESSAGES.SENDER_ID_MISMATCH,
    });
    expect(economyService.sendGift).not.toHaveBeenCalled();
  });

  it('מעביר ל-service את req.user.id כ-senderId, גם כשה-body לא כולל senderId', async () => {
    economyService.sendGift.mockResolvedValueOnce({ giftValue: 100 });
    const req = buildMockReq({ body: baseBody, userId: 'user-1' });
    const res = buildMockRes();

    await economyController.sendGift(req, res);

    expect(economyService.sendGift).toHaveBeenCalledWith(
      'user-1',
      baseBody.receiverPlayerId,
      baseBody.moderatorId,
      baseBody.giftValue,
      baseBody.gameId
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('מעביר ל-service את req.user.id גם כש-body.senderId תואם למשתמש המחובר', async () => {
    economyService.sendGift.mockResolvedValueOnce({ giftValue: 100 });
    const req = buildMockReq({
      body: { ...baseBody, senderId: 'user-1' },
      userId: 'user-1',
    });
    const res = buildMockRes();

    await economyController.sendGift(req, res);

    expect(economyService.sendGift).toHaveBeenCalledWith(
      'user-1',
      baseBody.receiverPlayerId,
      baseBody.moderatorId,
      baseBody.giftValue,
      baseBody.gameId
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('400 — שגיאת ולידציה מה-service (giftValue לא תקין) מוחזרת כ-400', async () => {
    economyService.sendGift.mockRejectedValueOnce(
      new Error(ERROR_MESSAGES.INVALID_GIFT_VALUE)
    );
    const req = buildMockReq({ body: { ...baseBody, giftValue: -10 } });
    const res = buildMockRes();

    await economyController.sendGift(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      status: 'error',
      message: ERROR_MESSAGES.INVALID_GIFT_VALUE,
    });
  });

  it('200 — מסנכרן יתרות לשולח, למקבל ולמנחה כשיש io', async () => {
    economyService.sendGift.mockResolvedValueOnce({ giftValue: 100 });
    const io = {};
    const req = buildMockReq({ body: baseBody, userId: 'user-1', io });
    const res = buildMockRes();

    await economyController.sendGift(req, res);

    expect(syncUserBalances).toHaveBeenCalledWith(
      io,
      'user-1',
      baseBody.gameId
    );
    expect(syncUserBalances).toHaveBeenCalledWith(
      io,
      baseBody.receiverPlayerId,
      baseBody.gameId
    );
    expect(syncUserBalances).toHaveBeenCalledWith(
      io,
      baseBody.moderatorId,
      baseBody.gameId
    );
  });
});
