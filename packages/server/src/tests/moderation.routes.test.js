/**
 * moderation.routes.test.js
 *
 * בדיקת אינטגרציה ל-moderation.routes.js עם Supertest.
 * מרכיבה אפליקציית Express אמיתית (express.json + הראוטר עצמו),
 * אבל מוקאת את auth.middleware.js ואת ה-services — כך שנבדקת
 * שכבת ה-routing/controller בפועל, בלי תלות ב-DB או בטוקנים אמיתיים.
 */
import express from 'express';
import request from 'supertest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ModerationType } from '@prisma/client';
import moderationRoutes from '../routes/moderation.routes.js';
import moderationService from '../services/moderation.service.js';
import permissionsService from '../services/permissions.service.js';
import { ERROR_MESSAGES } from '@worldplay/shared';

const CURRENT_USER_ID = 'user-123';
let mockUserRole = 'USER';

vi.mock('../middleware/auth.middleware.js', () => ({
  authenticateToken: (req, res, next) => {
    req.user = { id: CURRENT_USER_ID, role: mockUserRole };
    next();
  },
}));

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

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/streams', moderationRoutes);
  return app;
}

describe('moderation routes (/api/streams)', () => {
  let app;

  beforeEach(() => {
    mockUserRole = 'USER';
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    app = buildApp();
  });

  describe('/report', () => {
    it('201s, bridges to the active game, and does not require moderator role', async () => {
      moderationService.findActiveGameForStream.mockResolvedValue({
        id: 'game-1',
      });
      moderationService.createReport.mockResolvedValue({
        id: 'action-1',
        type: ModerationType.REPORT,
      });

      const res = await request(app)
        .post('/api/streams/stream-1/report')
        .send({ reason: 'harassment' });

      expect(res.status).toBe(201);
      expect(res.body.message).toBe('Report submitted successfully');
      expect(moderationService.createReport).toHaveBeenCalledWith(
        'stream-1',
        'game-1',
        CURRENT_USER_ID,
        'harassment'
      );
      expect(permissionsService.ensureModerator).not.toHaveBeenCalled();
    });

    it('returns 404 when there is no active game for the stream', async () => {
      moderationService.findActiveGameForStream.mockResolvedValue(null);

      const res = await request(app)
        .post('/api/streams/stream-1/report')
        .send({ reason: 'harassment' });

      expect(res.status).toBe(404);
      expect(res.body).toEqual({
        error: ERROR_MESSAGES.NO_ACTIVE_GAME_FOR_STREAM,
      });
      expect(moderationService.createReport).not.toHaveBeenCalled();
    });
  });

  describe('/mute, /unmute, /kick', () => {
    const endpoints = [
      ['mute', ModerationType.MUTE],
      ['unmute', ModerationType.UNMUTE],
      ['kick', ModerationType.KICK],
    ];

    it.each(endpoints)(
      '%s returns 400 when targetUserId is missing',
      async (path) => {
        const res = await request(app)
          .post(`/api/streams/stream-1/${path}`)
          .send({});

        expect(res.status).toBe(400);
        expect(res.body).toEqual({
          error: ERROR_MESSAGES.TARGET_USER_ID_REQUIRED,
        });
        expect(
          moderationService.findActiveGameForStream
        ).not.toHaveBeenCalled();
      }
    );

    it.each(endpoints)('%s returns 404 with no active game', async (path) => {
      moderationService.findActiveGameForStream.mockResolvedValue(null);

      const res = await request(app)
        .post(`/api/streams/stream-1/${path}`)
        .send({ targetUserId: 'target-1' });

      expect(res.status).toBe(404);
      expect(res.body).toEqual({
        error: ERROR_MESSAGES.NO_ACTIVE_GAME_FOR_STREAM,
      });
    });

    it.each(endpoints)(
      '%s returns 403 when caller is not a moderator',
      async (path) => {
        moderationService.findActiveGameForStream.mockResolvedValue({
          id: 'game-1',
        });
        permissionsService.ensureModerator.mockRejectedValue(
          new Error(ERROR_MESSAGES.UNAUTHORIZED)
        );

        const res = await request(app)
          .post(`/api/streams/stream-1/${path}`)
          .send({ targetUserId: 'target-1' });

        expect(res.status).toBe(403);
      }
    );

    it.each(endpoints)(
      '%s returns 201 and records the action with gameId for a valid moderator',
      async (path, type) => {
        moderationService.findActiveGameForStream.mockResolvedValue({
          id: 'game-1',
        });
        permissionsService.ensureModerator.mockResolvedValue({
          role: 'MODERATOR',
        });
        moderationService.createModerationAction.mockResolvedValue({
          id: 'action-2',
          type,
        });

        const res = await request(app)
          .post(`/api/streams/stream-1/${path}`)
          .send({ targetUserId: 'target-1', reason: 'spamming chat' });

        expect(res.status).toBe(201);
        expect(res.body.message).toBe('Moderation action recorded');
        expect(moderationService.createModerationAction).toHaveBeenCalledWith(
          type,
          'stream-1',
          'game-1',
          CURRENT_USER_ID,
          'target-1',
          'spamming chat'
        );
      }
    );
  });

  it('rejects unknown sub-paths with 404 (no matching route)', async () => {
    const res = await request(app).post('/api/streams/stream-1/ban');
    expect(res.status).toBe(404);
  });

  describe('GET /under-review', () => {
    it('200 — returns list of games under review for STAFF user', async () => {
      mockUserRole = 'STAFF';
      const mockGames = [
        {
          id: 'game-1',
          isUnderReview: true,
          host: { id: 'host-1', username: 'alice', email: 'alice@test.com' },
          stream: { id: 'stream-1', title: 'Test Stream' },
        },
      ];
      moderationService.getGamesUnderReview.mockResolvedValue(mockGames);

      const res = await request(app).get('/api/streams/under-review');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ games: mockGames });
      expect(moderationService.getGamesUnderReview).toHaveBeenCalledTimes(1);
    });

    it('403 — blocks USER role from accessing the endpoint', async () => {
      mockUserRole = 'USER';

      const res = await request(app).get('/api/streams/under-review');

      expect(res.status).toBe(403);
      expect(res.body).toEqual({ error: 'Access denied: staff only' });
      expect(moderationService.getGamesUnderReview).not.toHaveBeenCalled();
    });

    it('200 — also allows ADMIN role access', async () => {
      mockUserRole = 'ADMIN';
      moderationService.getGamesUnderReview.mockResolvedValue([]);

      const res = await request(app).get('/api/streams/under-review');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ games: [] });
    });
  });
});
