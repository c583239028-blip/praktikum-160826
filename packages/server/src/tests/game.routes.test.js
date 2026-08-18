import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { ERROR_MESSAGES } from '@worldplay/shared';

// ── Mocks ──────────────────

vi.mock('../middleware/auth.middleware.js', () => ({
  authenticateToken: (req, _res, next) => {
    req.user = { id: 'user-host-1' };
    next();
  },
}));

const { mockGetParticipants } = vi.hoisted(() => ({
  mockGetParticipants: vi.fn(),
}));

vi.mock('../services/game.service.js', () => ({
  default: {
    getGameParticipants: mockGetParticipants,
  },
}));

// ── App ──────────────────

const { default: gameRoutes } = await import('../routes/games.routes.js');

const app = express();
app.use(express.json());
app.use('/api/games', gameRoutes);

// ── Tests ──────────────────

describe('GET /api/games/:gameId/participants', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('200 — מחזיר רשימת משתתפים עם username ו-role', async () => {
    mockGetParticipants.mockResolvedValueOnce([
      {
        id: 'p-1',
        role: 'HOST',
        score: 0,
        user: {
          id: 'user-1',
          username: 'alice',
          avatarUrl: 'https://example.com/alice.jpg',
        },
      },
      {
        id: 'p-2',
        role: 'PLAYER',
        score: 10,
        user: { id: 'user-2', username: 'bob', avatarUrl: null },
      },
    ]);

    const res = await request(app).get('/api/games/valid-uuid/participants');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].user.username).toBe('alice');
    expect(res.body.data[0].user.avatarUrl).toBe(
      'https://example.com/alice.jpg'
    );
    expect(res.body.data[1].user.avatarUrl).toBeNull();
    expect(res.body.data[0]).not.toHaveProperty('email');
    expect(res.body.data[0]).not.toHaveProperty('password');
  });

  it('200 — מחזיר מערך ריק אם אין משתתפים', async () => {
    mockGetParticipants.mockResolvedValueOnce([]);

    const res = await request(app).get('/api/games/valid-uuid/participants');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual([]);
  });

  // 401 מכוסה ע"י בדיקות auth.middleware — לא צריך לכפול כאן

  it('404 — gameId לא קיים מחזיר 404', async () => {
    mockGetParticipants.mockRejectedValueOnce(
      new Error(ERROR_MESSAGES.GAME_NOT_FOUND)
    );

    const res = await request(app).get(
      '/api/games/nonexistent-uuid/participants'
    );

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('המשחק לא נמצא');
  });

  it('403 — משתמש שאינו host מחזיר 403', async () => {
    mockGetParticipants.mockRejectedValueOnce(
      new Error(ERROR_MESSAGES.UNAUTHORIZED)
    );

    const res = await request(app).get('/api/games/valid-uuid/participants');

    expect(res.status).toBe(403);
  });

  it('400 — gameId לא תקין מחזיר 400', async () => {
    const prismaError = new Error('Invalid UUID');
    prismaError.code = 'P2023';
    mockGetParticipants.mockRejectedValueOnce(prismaError);

    const res = await request(app).get('/api/games/abc/participants');

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('מזהה משחק לא תקין');
  });
});
