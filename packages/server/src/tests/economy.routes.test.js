// M8-11: regression guard for the 403 through the real route + authenticateToken, not just the controller function directly.
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

const { mockSendGift } = vi.hoisted(() => ({
  mockSendGift: vi.fn(),
}));

vi.mock('../services/economy.service.js', () => ({
  default: { sendGift: mockSendGift },
}));

vi.mock('../utils/socketHelpers.js', () => ({
  syncUserBalances: vi.fn(),
}));

// ── App ──────────────────

const { default: economyRoutes } = await import('../routes/economy.routes.js');

const app = express();
app.use(express.json());
app.use('/api/economy', economyRoutes);

// ── Tests ──────────────────

describe('POST /api/economy/gifts/send', () => {
  const baseBody = {
    receiverPlayerId: 'player-1',
    moderatorId: 'mod-1',
    giftValue: 100,
    gameId: 'game-1',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('403 — senderId זר ב-body נחסם לפני שה-route מגיע ל-service', async () => {
    const res = await request(app)
      .post('/api/economy/gifts/send')
      .send({ ...baseBody, senderId: 'victim-99' });

    expect(res.status).toBe(403);
    expect(res.body).toEqual({
      status: 'error',
      message: ERROR_MESSAGES.SENDER_ID_MISMATCH,
    });
    expect(mockSendGift).not.toHaveBeenCalled();
  });

  it('200 — בקשה תקינה עוברת דרך authenticateToken והראוט האמיתי ל-service', async () => {
    mockSendGift.mockResolvedValueOnce({ giftValue: 100 });

    const res = await request(app)
      .post('/api/economy/gifts/send')
      .send(baseBody);

    expect(res.status).toBe(200);
    expect(mockSendGift).toHaveBeenCalledWith(
      'user-1',
      baseBody.receiverPlayerId,
      baseBody.moderatorId,
      baseBody.giftValue,
      baseBody.gameId
    );
  });
});
