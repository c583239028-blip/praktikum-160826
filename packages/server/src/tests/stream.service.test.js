/**
 * stream.service.test.js
 *
 * בדיקות יחידה למנגנון ה-freeze/resume (SCRUM-172, D2).
 * מוקאת את ה-prisma singleton, logger ו-permissions.service —
 * אין פגיעה ב-DB אמיתי.
 *
 * הערה חשובה: activeFreezeTimers הוא Map ברמת המודול, משותף לכל הטסטים
 * בקובץ. כדי למנוע זליגת מצב בין טסטים, כל טסט משתמש ב-streamId ייחודי
 * משלו, ולא מסתמך על ניקוי ה-Map בין טסטים.
 *
 * המסלולים של freeze/resume/cancelFreeze אינם מתקשרים עם media-server
 * ישירות (ראו הסרת _notifyMediaServer) — 244 קוראת מה-DB בעצמה.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StreamStatus } from '@prisma/client';

vi.mock('../lib/prisma.js', () => ({
  default: {
    game: { findUnique: vi.fn() },
    stream: { findUnique: vi.fn(), update: vi.fn() },
  },
}));

vi.mock('@worldplay/shared', async (importOriginal) => ({
  ...(await importOriginal()),
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('../services/permissions.service.js', () => ({
  default: {
    ensureStreamHost: vi.fn(),
  },
}));

import streamService from '../services/stream.service.js';
import prisma from '../lib/prisma.js';
import { logger } from '@worldplay/shared';
import permissionsService from '../services/permissions.service.js';

// ── Helpers ────────────────────────────────────────────────

const makeStream = (overrides = {}) => ({
  id: 'stream-1',
  status: StreamStatus.LIVE,
  lastPausedAt: null,
  accumulatedPauseMs: 0,
  ...overrides,
});

describe('streamService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  // ── freezeStreamForQuestion ──────────────────────────────

  describe('freezeStreamForQuestion', () => {
    it('ממפה gameId→streamId, מסמנת PAUSE וקובעת lastPausedAt', async () => {
      const streamId = 'freeze-basic';
      prisma.game.findUnique.mockResolvedValueOnce({ streamId });
      prisma.stream.findUnique.mockResolvedValueOnce(
        makeStream({ id: streamId, status: StreamStatus.LIVE })
      );
      prisma.stream.update.mockResolvedValueOnce({});

      await streamService.freezeStreamForQuestion('game-1', 15);

      expect(prisma.stream.update).toHaveBeenCalledWith({
        where: { id: streamId },
        data: expect.objectContaining({ status: StreamStatus.PAUSE }),
      });
    });

    it('אידמפוטנטיות: אם הסטרים כבר ב-PAUSE, לא דורסים lastPausedAt', async () => {
      const streamId = 'freeze-idempotent';
      const existingPausedAt = new Date('2026-01-01T00:00:00Z');
      prisma.game.findUnique.mockResolvedValueOnce({ streamId });
      prisma.stream.findUnique.mockResolvedValueOnce(
        makeStream({
          id: streamId,
          status: StreamStatus.PAUSE,
          lastPausedAt: existingPausedAt,
        })
      );

      await streamService.freezeStreamForQuestion('game-1', 15);

      expect(prisma.stream.update).not.toHaveBeenCalled();
    });

    it('משתמשת ב-timeLimit שהועבר ולא בברירת המחדל, כשהוא הוגדר', async () => {
      const streamId = 'freeze-custom-limit';
      prisma.game.findUnique.mockResolvedValueOnce({ streamId });
      prisma.stream.findUnique.mockResolvedValueOnce(
        makeStream({ id: streamId, status: StreamStatus.LIVE })
      );
      prisma.stream.update.mockResolvedValueOnce({});
      // עבור ה-resume בתוך הטיימר
      prisma.stream.findUnique.mockResolvedValueOnce(
        makeStream({ id: streamId, status: StreamStatus.PAUSE })
      );
      prisma.stream.update.mockResolvedValueOnce({});

      await streamService.freezeStreamForQuestion('game-1', 5);

      // אחרי 4.9 שניות — הטיימר עוד לא אמור לירות
      await vi.advanceTimersByTimeAsync(4900);
      expect(prisma.stream.update).toHaveBeenCalledTimes(1); // רק ה-freeze עצמו

      // אחרי עוד 200ms (סה"כ 5.1 שניות) — הטיימר כן אמור לירות
      await vi.advanceTimersByTimeAsync(200);
      expect(prisma.stream.update).toHaveBeenCalledTimes(2); // freeze + resume
    });

    it('נופלת לברירת המחדל (45 שניות) כש-timeLimit לא הועבר', async () => {
      const streamId = 'freeze-default-limit';
      prisma.game.findUnique.mockResolvedValueOnce({ streamId });
      prisma.stream.findUnique.mockResolvedValueOnce(
        makeStream({ id: streamId, status: StreamStatus.LIVE })
      );
      prisma.stream.update.mockResolvedValueOnce({});
      prisma.stream.findUnique.mockResolvedValueOnce(
        makeStream({ id: streamId, status: StreamStatus.PAUSE })
      );
      prisma.stream.update.mockResolvedValueOnce({});

      await streamService.freezeStreamForQuestion('game-1', undefined);

      await vi.advanceTimersByTimeAsync(44900);
      expect(prisma.stream.update).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(200);
      expect(prisma.stream.update).toHaveBeenCalledTimes(2);
    });

    it('מבטלת טיימר קודם כששאלה חדשה נפתחת על אותו סטרים לפני שהקודם ירה', async () => {
      const streamId = 'freeze-replace-timer';
      // freeze ראשון, 30 שניות
      prisma.game.findUnique.mockResolvedValueOnce({ streamId });
      prisma.stream.findUnique.mockResolvedValueOnce(
        makeStream({ id: streamId, status: StreamStatus.LIVE })
      );
      prisma.stream.update.mockResolvedValueOnce({});
      await streamService.freezeStreamForQuestion('game-1', 30);

      await vi.advanceTimersByTimeAsync(10000); // 10 שניות חלפו

      // freeze שני על אותו streamId, 10 שניות חדשות
      prisma.game.findUnique.mockResolvedValueOnce({ streamId });
      prisma.stream.findUnique.mockResolvedValueOnce(
        makeStream({ id: streamId, status: StreamStatus.PAUSE })
      );
      await streamService.freezeStreamForQuestion('game-1', 10);

      // אם היה 20 שניות נוספות (30 שניות מהראשון) — הטיימר הישן לא אמור לירות
      prisma.stream.findUnique.mockResolvedValueOnce(
        makeStream({ id: streamId, status: StreamStatus.PAUSE })
      );
      prisma.stream.update.mockResolvedValueOnce({});
      await vi.advanceTimersByTimeAsync(10100); // רק הטיימר החדש (10 שניות) אמור לירות

      // סה"כ prisma.stream.update: freeze-ראשון + freeze-שני-אין-כי-כבר-PAUSE + resume-אחד = 2
      expect(prisma.stream.update).toHaveBeenCalledTimes(2);
    });

    it('game לא נמצא — יוצאת בשקט, רושמת אזהרה, לא זורקת שגיאה', async () => {
      prisma.game.findUnique.mockResolvedValueOnce(null);

      await expect(
        streamService.freezeStreamForQuestion('missing-game', 15)
      ).resolves.not.toThrow();

      expect(logger.warn).toHaveBeenCalled();
      expect(prisma.stream.update).not.toHaveBeenCalled();
    });

    it('stream לא נמצא — יוצאת בשקט, רושמת אזהרה, לא זורקת שגיאה', async () => {
      prisma.game.findUnique.mockResolvedValueOnce({
        streamId: 'missing-stream',
      });
      prisma.stream.findUnique.mockResolvedValueOnce(null);

      await expect(
        streamService.freezeStreamForQuestion('game-1', 15)
      ).resolves.not.toThrow();

      expect(logger.warn).toHaveBeenCalled();
      expect(prisma.stream.update).not.toHaveBeenCalled();
    });

    // ── תוספת (4): כשל DB בכתיבת ה-freeze הראשונית ──────────
    it('מעבירה הלאה שגיאת DB מכתיבת ה-freeze הראשונית, ולא קובעת טיימר', async () => {
      const streamId = 'freeze-db-error';
      const dbError = new Error('DB write failed');
      prisma.game.findUnique.mockResolvedValueOnce({ streamId });
      prisma.stream.findUnique.mockResolvedValueOnce(
        makeStream({ id: streamId, status: StreamStatus.LIVE })
      );
      prisma.stream.update.mockRejectedValueOnce(dbError);

      await expect(
        streamService.freezeStreamForQuestion('game-1', 15)
      ).rejects.toThrow('DB write failed');

      // אם נכשלנו לפני setTimeout, אין טיימר שיירה בהמשך —
      // מתקדמים הרבה מעבר לכל timeLimit סביר ומוודאים שאין קריאת update נוספת.
      await vi.advanceTimersByTimeAsync(60000);
      expect(prisma.stream.update).toHaveBeenCalledTimes(1); // רק הניסיון שנכשל
    });

    // ── תוספת (2): טיפול בשגיאה בתוך ה-callback של הטיימר האוטומטי ──
    it('רושמת שגיאה ולא מפילה את התהליך אם performResume נכשל בתוך קריאת הטיימר האוטומטי', async () => {
      const streamId = 'freeze-timer-callback-error';
      prisma.game.findUnique.mockResolvedValueOnce({ streamId });
      prisma.stream.findUnique.mockResolvedValueOnce(
        makeStream({ id: streamId, status: StreamStatus.LIVE })
      );
      prisma.stream.update.mockResolvedValueOnce({});

      await streamService.freezeStreamForQuestion('game-1', 5);

      // כשהטיימר יורה, performResume קורא ל-getStream — נדמה כשל DB בשלב הזה
      const dbError = new Error('DB unavailable');
      prisma.stream.findUnique.mockRejectedValueOnce(dbError);

      await expect(vi.advanceTimersByTimeAsync(5000)).resolves.not.toThrow();

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining(`Auto-resume failed for stream ${streamId}`),
        dbError.message
      );
    });
  });

  // ── performResume ────────────────────────────────────────

  describe('performResume', () => {
    it('מעדכנת status ל-LIVE ומחשבת accumulatedPauseMs', async () => {
      const streamId = 'resume-basic';
      const lastPausedAt = new Date(Date.now() - 5000); // 5 שניות "עברו"
      prisma.stream.findUnique.mockResolvedValueOnce(
        makeStream({
          id: streamId,
          status: StreamStatus.PAUSE,
          lastPausedAt,
          accumulatedPauseMs: 1000,
        })
      );
      prisma.stream.update.mockResolvedValueOnce({});

      await streamService.performResume(streamId);

      const callArgs = prisma.stream.update.mock.calls[0][0];
      expect(callArgs.data.status).toBe(StreamStatus.LIVE);
      expect(callArgs.data.accumulatedPauseMs).toBeGreaterThanOrEqual(6000); // 1000 + ~5000
      expect(callArgs.data.lastPausedAt).toBeNull();
    });

    it('לא מעדכנת DB אם autoResume מחזירה null (הסטרים לא היה ב-PAUSE)', async () => {
      const streamId = 'resume-not-paused';
      prisma.stream.findUnique.mockResolvedValueOnce(
        makeStream({ id: streamId, status: StreamStatus.LIVE })
      );

      const result = await streamService.performResume(streamId);

      expect(result).toBeNull();
      expect(prisma.stream.update).not.toHaveBeenCalled();
    });

    it('מבטלת טיימר פעיל לפני שהיא מבצעת resume', async () => {
      const streamId = 'resume-cancels-timer';
      prisma.game.findUnique.mockResolvedValueOnce({ streamId });
      prisma.stream.findUnique.mockResolvedValueOnce(
        makeStream({ id: streamId, status: StreamStatus.LIVE })
      );
      prisma.stream.update.mockResolvedValueOnce({});
      await streamService.freezeStreamForQuestion('game-1', 30);

      // resolveQuestion מקדים את הטיימר אחרי 5 שניות
      await vi.advanceTimersByTimeAsync(5000);
      prisma.stream.findUnique.mockResolvedValueOnce(
        makeStream({ id: streamId, status: StreamStatus.PAUSE })
      );
      prisma.stream.update.mockResolvedValueOnce({});
      await streamService.performResume(streamId);

      const updateCallsAfterManualResume =
        prisma.stream.update.mock.calls.length;

      // מתקדמים 30 שניות נוספות — הטיימר המקורי לא אמור לירות שוב
      await vi.advanceTimersByTimeAsync(30000);
      expect(prisma.stream.update).toHaveBeenCalledTimes(
        updateCallsAfterManualResume
      );
    });
  });

  // ── autoResume ────────────────────────────────────────────

  describe('autoResume', () => {
    it('מחזירה null כש-stream הוא null/undefined', async () => {
      const result = await streamService.autoResume('stream-x', null);
      expect(result).toBeNull();
      expect(prisma.stream.update).not.toHaveBeenCalled();
    });

    it('מחזירה null כשה-status אינו PAUSE', async () => {
      const result = await streamService.autoResume(
        'stream-x',
        makeStream({ status: StreamStatus.LIVE })
      );
      expect(result).toBeNull();
      expect(prisma.stream.update).not.toHaveBeenCalled();
    });

    it('מחשבת נכון accumulatedPauseMs מצטבר לאורך כמה שאלות ברצף', async () => {
      const lastPausedAt = new Date(Date.now() - 3000);
      prisma.stream.update.mockResolvedValueOnce({});

      await streamService.autoResume(
        'stream-x',
        makeStream({
          status: StreamStatus.PAUSE,
          lastPausedAt,
          accumulatedPauseMs: 2000,
        })
      );

      const data = prisma.stream.update.mock.calls[0][0].data;
      expect(data.accumulatedPauseMs).toBeGreaterThanOrEqual(5000); // 2000 + ~3000
      expect(data.status).toBe(StreamStatus.LIVE);
      expect(data.lastPausedAt).toBeNull();
    });
  });

  // ── cancelFreeze ──────────────────────────────────────────

  describe('cancelFreeze', () => {
    it('מבטלת טיימר, שומרת accumulatedPauseMs, ולא נוגעת ב-status', async () => {
      const streamId = 'cancel-basic';
      const lastPausedAt = new Date(Date.now() - 4000);
      prisma.stream.findUnique.mockResolvedValueOnce(
        makeStream({
          id: streamId,
          status: StreamStatus.PAUSE,
          lastPausedAt,
          accumulatedPauseMs: 500,
        })
      );
      prisma.stream.update.mockResolvedValueOnce({});

      await streamService.cancelFreeze(streamId);

      const data = prisma.stream.update.mock.calls[0][0].data;
      expect(data).not.toHaveProperty('status'); // קריטי: לא נוגעים ב-status בכלל
      expect(data.accumulatedPauseMs).toBeGreaterThanOrEqual(4500);
      expect(data.lastPausedAt).toBeNull();
    });

    it('מחזירה null ולא נוגעת ב-DB אם הסטרים לא ב-PAUSE', async () => {
      const streamId = 'cancel-not-paused';
      prisma.stream.findUnique.mockResolvedValueOnce(
        makeStream({ id: streamId, status: StreamStatus.LIVE })
      );

      const result = await streamService.cancelFreeze(streamId);

      expect(result).toBeNull();
      expect(prisma.stream.update).not.toHaveBeenCalled();
    });

    it('מחזירה null אם הסטרים לא נמצא', async () => {
      prisma.stream.findUnique.mockResolvedValueOnce(null);

      const result = await streamService.cancelFreeze('missing-stream');

      expect(result).toBeNull();
      expect(prisma.stream.update).not.toHaveBeenCalled();
    });

    it('מבטלת טיימר פעיל כך שהוא לא יורה אחרי cancelFreeze (סימולציית סיום משחק)', async () => {
      const streamId = 'cancel-prevents-later-resume';
      prisma.game.findUnique.mockResolvedValueOnce({ streamId });
      prisma.stream.findUnique.mockResolvedValueOnce(
        makeStream({ id: streamId, status: StreamStatus.LIVE })
      );
      prisma.stream.update.mockResolvedValueOnce({});
      await streamService.freezeStreamForQuestion('game-1', 30);

      // המשחק מסתיים אחרי 10 שניות, קורא ל-cancelFreeze
      await vi.advanceTimersByTimeAsync(10000);
      prisma.stream.findUnique.mockResolvedValueOnce(
        makeStream({
          id: streamId,
          status: StreamStatus.PAUSE,
          lastPausedAt: new Date(),
        })
      );
      prisma.stream.update.mockResolvedValueOnce({});
      await streamService.cancelFreeze(streamId);

      const callsAfterCancel = prisma.stream.update.mock.calls.length;

      // מתקדמים עוד 30 שניות — הטיימר המקורי לא אמור לירות
      await vi.advanceTimersByTimeAsync(30000);
      expect(prisma.stream.update).toHaveBeenCalledTimes(callsAfterCancel);
    });
  });

  // ── updateStreamStatus (הנתיב הישן, עדיין רלוונטי ל-D2 מבחינת accumulatedPauseMs) ──

  describe('updateStreamStatus', () => {
    it('זורקת INVALID_STATUS על ערך לא חוקי', async () => {
      await expect(
        streamService.updateStreamStatus('stream-1', 'user-1', 'BOGUS')
      ).rejects.toThrow();
    });

    it('מחשבת accumulatedPauseMs נכון במעבר PAUSE→LIVE', async () => {
      const lastPausedAt = new Date(Date.now() - 2000);
      permissionsService.ensureStreamHost.mockResolvedValueOnce(
        makeStream({
          status: StreamStatus.PAUSE,
          lastPausedAt,
          accumulatedPauseMs: 100,
        })
      );
      prisma.stream.update.mockResolvedValueOnce({});

      await streamService.updateStreamStatus('stream-1', 'user-1', 'LIVE');

      const data = prisma.stream.update.mock.calls[0][0].data;
      expect(data.accumulatedPauseMs).toBeGreaterThanOrEqual(2100);
    });

    // ── תוספת (1): מעבר ל-PAUSE ──────────────────────────────
    it('קובעת lastPausedAt במעבר ל-PAUSE, בלי לגעת ב-accumulatedPauseMs', async () => {
      permissionsService.ensureStreamHost.mockResolvedValueOnce(
        makeStream({ status: StreamStatus.LIVE, lastPausedAt: null })
      );
      prisma.stream.update.mockResolvedValueOnce({});

      await streamService.updateStreamStatus('stream-1', 'user-1', 'PAUSE');

      const data = prisma.stream.update.mock.calls[0][0].data;
      expect(data.status).toBe(StreamStatus.PAUSE);
      expect(data.lastPausedAt).toBeInstanceOf(Date);
      expect(data).not.toHaveProperty('accumulatedPauseMs');
    });
  });

  // ── תוספת (3): פונקציות עזר פשוטות ─────────────────────────

  describe('getStream', () => {
    it('מחזירה את רשומת הסטרים לפי id', async () => {
      const stream = makeStream({ id: 'stream-42' });
      prisma.stream.findUnique.mockResolvedValueOnce(stream);

      const result = await streamService.getStream('stream-42');

      expect(prisma.stream.findUnique).toHaveBeenCalledWith({
        where: { id: 'stream-42' },
      });
      expect(result).toEqual(stream);
    });
  });

  describe('getViewerCount', () => {
    it('מחזירה את viewerCount כשהוא קיים ברשומה', async () => {
      prisma.stream.findUnique.mockResolvedValueOnce({ viewerCount: 7 });

      const result = await streamService.getViewerCount('stream-1');

      expect(result).toBe(7);
    });

    it('מחזירה 0 כברירת מחדל כש-viewerCount חסר ברשומה', async () => {
      prisma.stream.findUnique.mockResolvedValueOnce({});

      const result = await streamService.getViewerCount('stream-1');

      expect(result).toBe(0);
    });

    it('מחזירה 0 כשהסטרים לא נמצא כלל', async () => {
      prisma.stream.findUnique.mockResolvedValueOnce(null);

      const result = await streamService.getViewerCount('missing-stream');

      expect(result).toBe(0);
    });
  });

  describe('pauseStream', () => {
    it('מסמנת PAUSE וקובעת lastPausedAt לזמן הנוכחי', async () => {
      prisma.stream.update.mockResolvedValueOnce({});

      await streamService.pauseStream('stream-1');

      const call = prisma.stream.update.mock.calls[0][0];
      expect(call.where).toEqual({ id: 'stream-1' });
      expect(call.data.status).toBe(StreamStatus.PAUSE);
      expect(call.data.lastPausedAt).toBeInstanceOf(Date);
    });
  });

  describe('resumeStream', () => {
    it('מסמנת LIVE בלבד, בלי לגעת ב-lastPausedAt או ב-accumulatedPauseMs', async () => {
      prisma.stream.update.mockResolvedValueOnce({});

      await streamService.resumeStream('stream-1');

      expect(prisma.stream.update).toHaveBeenCalledWith({
        where: { id: 'stream-1' },
        data: { status: StreamStatus.LIVE },
      });
    });
  });
});
