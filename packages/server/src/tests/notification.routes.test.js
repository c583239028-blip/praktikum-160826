/**
 * notification.routes.test.js
 *
 * בדיקת אינטגרציה ל-notification.routes.js עם Supertest.
 * בניגוד ל-moderation.routes.test.js, כאן *לא* מוקאים את השירות — אנחנו
 * מריצים את notification.service.js האמיתי (ואת validation.service.js דרכו)
 * מול prisma singleton מוקאי בלבד. כך הטסט תופס בפועל את באג הסכמה
 * (M9-07): שימוש ב-sendDate/readDate שלא קיימים במודל Notification היה
 * מפיל את שתי הנקודות ב-500. הטסט נועל את היישור לסכמה:
 *   - GET מ-orderBy לפי createdAt (ולא sendDate)
 *   - mark-read כותב { isRead: true } בלבד (ללא readDate)
 */
import express from 'express';
import request from 'supertest';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const CURRENT_USER_ID = 'user-123';

vi.mock('../middleware/auth.middleware.js', () => ({
  authenticateToken: (req, res, next) => {
    req.user = { id: CURRENT_USER_ID };
    next();
  },
}));

vi.mock('../lib/prisma.js', () => ({
  default: {
    user: { findUnique: vi.fn() },
    notification: {
      findMany: vi.fn(),
      count: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

import notificationRoutes from '../routes/notification.routes.js';
import prisma from '../lib/prisma.js';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/notifications', notificationRoutes);
  return app;
}

describe('notification routes (/api/notifications)', () => {
  let app;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    app = buildApp();
    // המשתמש קיים כברירת מחדל (ensureUserExists)
    prisma.user.findUnique.mockResolvedValue({ id: CURRENT_USER_ID });
  });

  describe('GET /', () => {
    it('200 — מחזיר התראות + unreadCount וממיין לפי createdAt', async () => {
      const rows = [{ id: 'n1', userId: CURRENT_USER_ID, isRead: false }];
      prisma.notification.findMany.mockResolvedValue(rows);
      prisma.notification.count.mockResolvedValue(1);

      const res = await request(app).get('/api/notifications');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        success: true,
        data: rows,
        unreadCount: 1,
      });
      // נעילת רגרסיה: השדה חייב להיות createdAt, לא sendDate
      expect(prisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: CURRENT_USER_ID },
          orderBy: { createdAt: 'desc' },
        })
      );
    });

    it('200 — filter=unread מסנן ל-isRead:false', async () => {
      prisma.notification.findMany.mockResolvedValue([]);
      prisma.notification.count.mockResolvedValue(0);

      const res = await request(app).get('/api/notifications?filter=unread');

      expect(res.status).toBe(200);
      expect(prisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: CURRENT_USER_ID, isRead: false },
        })
      );
    });
  });

  describe('PUT /:notificationId/read', () => {
    it('200 — מסמן כנקרא עם { isRead: true } בלבד (ללא readDate), מתוחם לבעלים', async () => {
      prisma.notification.updateMany.mockResolvedValue({ count: 1 });

      const res = await request(app).put('/api/notifications/n1/read');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        success: true,
        message: 'Notification marked as read',
      });
      // נעילת רגרסיה: עדכון אטומי מתוחם ל-id וגם ל-userId, ללא readDate
      expect(prisma.notification.updateMany).toHaveBeenCalledWith({
        where: { id: 'n1', userId: CURRENT_USER_ID },
        data: { isRead: true },
      });
    });

    it('404 — התראה לא קיימת (count 0)', async () => {
      prisma.notification.updateMany.mockResolvedValue({ count: 0 });

      const res = await request(app).put('/api/notifications/missing/read');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('404 — התראה קיימת אך שייכת למשתמש אחר (IDOR): where מתוחם ל-userId מחזיר count 0', async () => {
      prisma.notification.updateMany.mockResolvedValue({ count: 0 });

      const res = await request(app).put('/api/notifications/n1/read');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      // נעילת רגרסיה: ה-where תמיד מתוחם למשתמש המבקש, לא רק ל-id
      expect(prisma.notification.updateMany).toHaveBeenCalledWith({
        where: { id: 'n1', userId: CURRENT_USER_ID },
        data: { isRead: true },
      });
    });
  });
});
