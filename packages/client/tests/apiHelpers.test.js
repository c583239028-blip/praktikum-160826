/**
 * tests/apiHelpers.test.js
 *
 * NOTE: The @react-native-async-storage/async-storage mock is now global
 * (jest.setup.js). The inline mock that used to live here was removed.
 */

import {
  apiFetch,
  setUnauthorizedHandler,
  UnauthorizedError,
} from '../src/services/apiHelpers';
import AsyncStorage from '@react-native-async-storage/async-storage';

let originalDEV;

beforeEach(() => {
  originalDEV = globalThis.__DEV__;
  globalThis.__DEV__ = true;
  jest.clearAllMocks();
  // clearAllMocks מנקה היסטוריה אבל לא implementations — משחזרים כאן כדי
  // שtest קודם שהגדיר null לא ישפיע על ה-test הבא.
  AsyncStorage.getItem.mockResolvedValue('my-token');
});

afterEach(() => {
  globalThis.__DEV__ = originalDEV;
});

test('מוסיף Authorization header עם token', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    status: 200,
    ok: true,
    headers: { get: () => 'application/json' },
    json: async () => ({ data: 'ok' }),
  });

  await apiFetch('/api/test');

  expect(fetch).toHaveBeenCalledWith(
    '/api/test',
    expect.objectContaining({
      headers: expect.objectContaining({
        Authorization: 'Bearer my-token',
      }),
    })
  );
});

test('401 → קורא logout וזורק UnauthorizedError', async () => {
  const mockLogout = jest.fn();
  setUnauthorizedHandler(mockLogout);

  global.fetch = jest.fn().mockResolvedValue({
    status: 401,
    headers: { get: () => null },
  });

  await expect(apiFetch('/api/test')).rejects.toBeInstanceOf(UnauthorizedError);

  expect(mockLogout).toHaveBeenCalledTimes(1);
});

test('401 ללא handler — לא קורס', async () => {
  setUnauthorizedHandler(null);

  global.fetch = jest.fn().mockResolvedValue({
    status: 401,
    headers: { get: () => null },
  });

  await expect(apiFetch('/api/test')).rejects.toBeInstanceOf(UnauthorizedError);
});

describe('handleResponse — error field parity', () => {
  test('שגיאת moderation (error בלבד) — מציגה את הודעת השרת האמיתית', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      status: 403,
      ok: false,
      headers: { get: () => 'application/json' },
      json: async () => ({ error: 'לא moderator' }),
    });

    await expect(apiFetch('/api/moderation/report')).rejects.toThrow(
      'לא moderator'
    );
  });

  test('404 עם error בלבד (אין משחק פעיל)', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      status: 404,
      ok: false,
      headers: { get: () => 'application/json' },
      json: async () => ({ error: 'אין משחק פעיל' }),
    });

    await expect(apiFetch('/api/moderation/mute')).rejects.toThrow(
      'אין משחק פעיל'
    );
  });

  test('400 עם error בלבד (targetUserId חסר)', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      status: 400,
      ok: false,
      headers: { get: () => 'application/json' },
      json: async () => ({ error: 'targetUserId חסר' }),
    });

    await expect(apiFetch('/api/moderation/kick')).rejects.toThrow(
      'targetUserId חסר'
    );
  });

  test('רגרסיה: message בלבד בסטטוס שאינו 401 (login/social)', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      status: 400,
      ok: false,
      headers: { get: () => 'application/json' },
      json: async () => ({ message: 'Invalid credentials' }),
    });

    await expect(apiFetch('/api/auth/login')).rejects.toThrow(
      'Invalid credentials'
    );
  });

  test('fallback: לא error ולא message — Error {status}', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      status: 500,
      ok: false,
      headers: { get: () => 'application/json' },
      json: async () => ({}),
    });

    await expect(apiFetch('/api/whatever')).rejects.toThrow('Error 500');
  });

  test('error וגם message ביחד — error מנצח', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      status: 403,
      ok: false,
      headers: { get: () => 'application/json' },
      json: async () => ({
        error: 'from error field',
        message: 'from message field',
      }),
    });

    await expect(apiFetch('/api/test')).rejects.toThrow('from error field');
  });
});
