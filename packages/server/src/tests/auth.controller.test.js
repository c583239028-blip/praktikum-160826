/**
 * auth.controller.test.js
 *
 * בדיקות יחידה ל-auth.controller.js.
 * מוקאת את auth.service.js — בודקת רק אחריות controller: ולידציית request,
 * מיפוי סטטוסים (400/403/reason), חתימת JWT ועיצוב תגובת ה-HTTP.
 * גישת ה-DB עצמה נבדקת ב-auth.service.test.js.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks (must be defined before imports) ──────────────────

vi.mock('firebase-admin', () => {
  const verifyIdToken = vi.fn().mockResolvedValue({
    uid: 'mock-uid',
    email: 'mock@test.com',
    name: 'Mock User',
    firebase: { sign_in_provider: 'apple.com' },
  });
  const auth = vi.fn(() => ({ verifyIdToken }));
  return { default: { auth, apps: [], initializeApp: vi.fn() } };
});

vi.mock('../config/firebase.js', async () => {
  const admin = (await import('firebase-admin')).default;
  return { default: admin };
});

const {
  mockFindUserByEmail,
  mockCreateUserWithPassword,
  mockAuthenticateWithPassword,
  mockUpsertSocialUser,
  mockJwtSign,
} = vi.hoisted(() => ({
  mockFindUserByEmail: vi.fn(),
  mockCreateUserWithPassword: vi.fn(),
  mockAuthenticateWithPassword: vi.fn(),
  mockUpsertSocialUser: vi.fn(),
  mockJwtSign: vi.fn().mockReturnValue('mock-jwt-token'),
}));

vi.mock('../services/auth.service.js', () => ({
  findUserByEmail: mockFindUserByEmail,
  createUserWithPassword: mockCreateUserWithPassword,
  authenticateWithPassword: mockAuthenticateWithPassword,
  upsertSocialUser: mockUpsertSocialUser,
}));

vi.mock('jsonwebtoken', () => ({
  default: { sign: mockJwtSign },
}));

// ── Imports (after mocks) ──────────────────

import { socialLogin, register, login } from '../controller/auth.controller.js';
import { logger } from '@worldplay/shared';

// ── Helpers ──────────────────

/** Creates a mock Express response object with chainable status/json */
const mockRes = () => {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};

// ── register ──────────────────

describe('register', () => {
  let res;

  beforeEach(() => {
    res = mockRes();
    vi.clearAllMocks();
    mockJwtSign.mockReturnValue('mock-jwt-token');
  });

  it('400 — email already registered', async () => {
    mockFindUserByEmail.mockResolvedValueOnce({ id: 'existing-user' });

    const req = {
      body: {
        username: 'testuser',
        email: 'test@test.com',
        password: '123456',
      },
    };
    await register(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Email address is already registered',
    });
    expect(mockCreateUserWithPassword).not.toHaveBeenCalled();
  });

  it('201 — successful registration returns token and user', async () => {
    mockFindUserByEmail.mockResolvedValueOnce(null);
    mockCreateUserWithPassword.mockResolvedValueOnce({
      id: 'user-1',
      username: 'testuser',
      email: 'test@test.com',
    });

    const req = {
      body: {
        username: 'testuser',
        email: 'test@test.com',
        password: '123456',
      },
    };
    await register(req, res);

    expect(mockCreateUserWithPassword).toHaveBeenCalledTimes(1);
    expect(mockCreateUserWithPassword).toHaveBeenCalledWith({
      username: 'testuser',
      email: 'test@test.com',
      password: '123456',
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Registration successful',
        token: 'mock-jwt-token',
        user: expect.objectContaining({ id: 'user-1' }),
      })
    );

    // Fix 3 — shared JWT expiry across all auth paths
    expect(mockJwtSign).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(String),
      expect.objectContaining({ expiresIn: '7d' })
    );
  });

  it('201 — response does not contain role', async () => {
    mockFindUserByEmail.mockResolvedValueOnce(null);
    mockCreateUserWithPassword.mockResolvedValueOnce({
      id: 'user-1',
      username: 'testuser',
      email: 'test@test.com',
    });

    const req = {
      body: {
        username: 'testuser',
        email: 'test@test.com',
        password: '123456',
      },
    };
    await register(req, res);

    const jsonCall = res.json.mock.calls[0][0];
    expect(jsonCall.user).not.toHaveProperty('role');
  });

  it('500 — service error returns server error', async () => {
    mockFindUserByEmail.mockRejectedValueOnce(
      new Error('DB connection failed')
    );

    const req = {
      body: {
        username: 'testuser',
        email: 'test@test.com',
        password: '123456',
      },
    };
    await register(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Server error during registration',
    });
  });
});

// ── login ──────────────────

describe('login', () => {
  let res;

  beforeEach(() => {
    res = mockRes();
    vi.clearAllMocks();
    mockJwtSign.mockReturnValue('mock-jwt-token');
  });

  it('400 — invalid credentials (service says not ok)', async () => {
    mockAuthenticateWithPassword.mockResolvedValueOnce({
      ok: false,
      reason: 'INVALID_CREDENTIALS',
    });

    const req = { body: { email: 'test@test.com', password: '123456' } };
    await login(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Invalid email or password',
    });
  });

  it('403 — account inactive', async () => {
    mockAuthenticateWithPassword.mockResolvedValueOnce({
      ok: false,
      reason: 'INACTIVE',
    });

    const req = { body: { email: 'test@test.com', password: '123456' } };
    await login(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Your account is blocked or inactive. Please contact support.',
    });
  });

  it('400 — social-only account maps to SIGN_IN_WITH_SOCIAL', async () => {
    mockAuthenticateWithPassword.mockResolvedValueOnce({
      ok: false,
      reason: 'SOCIAL_ONLY',
    });

    const req = { body: { email: 'test@test.com', password: '123456' } };
    await login(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Please sign in with your social account',
    });
  });

  it('200 — successful login returns token and user, signs JWT with request email', async () => {
    mockAuthenticateWithPassword.mockResolvedValueOnce({
      ok: true,
      user: {
        id: 'user-1',
        username: 'testuser',
        avatarUrl: 'https://example.com/photo.jpg',
      },
    });

    const req = { body: { email: 'test@test.com', password: '123456' } };
    await login(req, res);

    expect(mockAuthenticateWithPassword).toHaveBeenCalledWith({
      email: 'test@test.com',
      password: '123456',
    });
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Login successful',
        token: 'mock-jwt-token',
        user: expect.objectContaining({
          id: 'user-1',
          username: 'testuser',
          avatarUrl: expect.any(String),
        }),
      })
    );

    // token payload carries id + request email, with shared 7d expiry
    expect(mockJwtSign).toHaveBeenCalledWith(
      { id: 'user-1', email: 'test@test.com' },
      expect.any(String),
      expect.objectContaining({ expiresIn: '7d' })
    );
  });

  it('200 — response does not contain role', async () => {
    mockAuthenticateWithPassword.mockResolvedValueOnce({
      ok: true,
      user: {
        id: 'user-1',
        username: 'testuser',
        avatarUrl: 'https://example.com/photo.jpg',
      },
    });

    const req = { body: { email: 'test@test.com', password: '123456' } };
    await login(req, res);

    const jsonCall = res.json.mock.calls[0][0];
    expect(jsonCall.user).not.toHaveProperty('role');
  });

  it('500 — service error returns server error', async () => {
    mockAuthenticateWithPassword.mockRejectedValueOnce(
      new Error('DB connection failed')
    );

    const req = { body: { email: 'test@test.com', password: '123456' } };
    await login(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Server error during login',
    });
  });
});

// ── socialLogin ──────────────────

describe('socialLogin — Firebase protected route', () => {
  let res;

  beforeEach(() => {
    res = mockRes();
    vi.clearAllMocks();
    mockJwtSign.mockReturnValue('mock-jwt-token');
  });

  it('400 — missing firebaseToken', async () => {
    const req = { body: {} };
    await socialLogin(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Firebase token is required',
    });
    expect(mockUpsertSocialUser).not.toHaveBeenCalled();
  });

  it('401 — invalid Firebase token', async () => {
    const admin = (await import('firebase-admin')).default;
    admin.auth().verifyIdToken.mockRejectedValueOnce(
      Object.assign(new Error('invalid token'), {
        code: 'auth/invalid-id-token',
      })
    );
    const req = { body: { firebaseToken: 'bad-token' } };
    await socialLogin(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Invalid or expired Firebase token',
    });
    expect(mockUpsertSocialUser).not.toHaveBeenCalled();
  });

  it('200 — valid token: passes decoded claims to the service and returns token', async () => {
    const user = { id: 'user-1', username: 'mockuser', email: 'mock@test.com' };
    mockUpsertSocialUser.mockResolvedValueOnce(user);

    const req = { body: { firebaseToken: 'valid-token' } };
    await socialLogin(req, res);

    // controller hands the verified claims straight to the service
    expect(mockUpsertSocialUser).toHaveBeenCalledWith(
      expect.objectContaining({ uid: 'mock-uid', email: 'mock@test.com' })
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Social login successful',
        token: 'mock-jwt-token',
        user,
      })
    );

    // Fix 3 — shared JWT expiry across all auth paths
    expect(mockJwtSign).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(String),
      expect.objectContaining({ expiresIn: '7d' })
    );
  });

  it('200 — response does not contain role', async () => {
    mockUpsertSocialUser.mockResolvedValueOnce({
      id: 'user-1',
      username: 'mockuser',
      email: 'mock@test.com',
    });

    const req = { body: { firebaseToken: 'valid-token' } };
    await socialLogin(req, res);

    const jsonCall = res.json.mock.calls[0][0];
    expect(jsonCall.user).not.toHaveProperty('role');
  });

  it('500 — service error returns authentication error with uid logged', async () => {
    const loggerErrorSpy = vi
      .spyOn(logger, 'error')
      .mockImplementation(() => {});
    mockUpsertSocialUser.mockRejectedValueOnce(
      new Error('DB connection failed')
    );

    const req = { body: { firebaseToken: 'valid-token' } };
    await socialLogin(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Authentication error',
    });
    // Acceptance criterion: uid must appear in the error log
    expect(loggerErrorSpy).toHaveBeenCalledWith(
      '[socialLogin] failed for uid:',
      expect.stringContaining('mock-uid')
    );

    loggerErrorSpy.mockRestore();
  });
});
