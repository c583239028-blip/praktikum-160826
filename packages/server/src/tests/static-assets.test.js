import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';

// 1. ביצוע Mock מלא לקובץ ההגדרות של Firebase לפני כל ייבוא אחר
vi.mock('../config/firebase.js', () => {
  return {
    default: {
      // כאן ניתן להגדיר פונקציות מדומוות אם הקוד שלך מייצא ומפעיל משהו ספציפי מקובץ זה
    },
    // אם האפליקציה מייבאת את ה-admin עצמו משם, אפשר לדמות אותו:
    admin: {
      auth: () => ({
        verifyIdToken: vi.fn().mockResolvedValue({ uid: 'mock-user' }),
      }),
    },
  };
});

// 2. ביצוע Mock ישיר ל-firebase-admin עצמו ליתר ביטחון
vi.mock('firebase-admin', () => {
  return {
    default: {
      apps: [{ name: 'mock-app' }],
      initializeApp: vi.fn(),
      credential: {
        cert: vi.fn().mockReturnValue({}),
      },
    },
  };
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ASSETS_DIR = path.join(__dirname, '../../assets/animations');
const FIXTURE_FILE = path.join(ASSETS_DIR, '__test-fixture.mp4');

describe('GET /assets/animations/:file (static serving, real app)', () => {
  let app;

  beforeAll(async () => {
    // יצירת תיקיית הנכסים וקובץ הבדיקה הפיזי
    fs.mkdirSync(ASSETS_DIR, { recursive: true });
    fs.writeFileSync(FIXTURE_FILE, Buffer.from('fake-mp4-bytes'));

    // טעינת האפליקציה - כעת הייבוא יעבור חלק ללא קריסה של Firebase
    const appModule = await import('../app.js');
    app = appModule.default;
  });

  afterAll(() => {
    fs.rmSync(FIXTURE_FILE, { force: true });
    vi.restoreAllMocks();
  });

  it('200s and serves the file with correct headers', async () => {
    const res = await request(app).get('/assets/animations/__test-fixture.mp4');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('video/mp4');
    expect(res.headers['accept-ranges']).toBe('bytes');
    expect(res.headers['content-length']).toBeDefined();
  });

  it('supports HEAD requests (used by curl -I in the ticket QA step)', async () => {
    const res = await request(app).head(
      '/assets/animations/__test-fixture.mp4'
    );
    expect(res.status).toBe(200);
  });

  it('returns 404 for a non-existent file', async () => {
    const res = await request(app).get('/assets/animations/does-not-exist.mp4');
    expect(res.status).toBe(404);
  });

  it('sets cache-control with the configured maxAge (7d)', async () => {
    const res = await request(app).get('/assets/animations/__test-fixture.mp4');
    expect(res.headers['cache-control']).toContain('max-age=604800');
  });
});
