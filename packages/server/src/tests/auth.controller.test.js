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

const { mockFindUnique, mockUpdate, mockCreate, mockJwtSign } = vi.hoisted(
  () => ({
    mockFindUnique: vi.fn(),
    mockUpdate: vi.fn(),
    mockCreate: vi.fn(),
    mockJwtSign: vi.fn().mockReturnValue('mock-jwt-token'),
  })
);

vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn().mockImplementation(() => ({
    user: {
      findUnique: mockFindUnique,
      update: mockUpdate,
      create: mockCreate,
    },
  })),
}));

vi.mock('jsonwebtoken', () => ({
  default: { sign: mockJwtSign },
}));

// ── Imports (after mocks) ──────────────────

import { socialLogin, register, login } from '../controller/auth.controller.js';

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
    mockFindUnique.mockResolvedValueOnce({ id: 'existing-user' });

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
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('201 — successful registration returns token and user', async () => {
    mockFindUnique.mockResolvedValueOnce(null);
    mockCreate.mockResolvedValueOnce({
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

    expect(mockCreate).toHaveBeenCalledTimes(1);
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
    mockFindUnique.mockResolvedValueOnce(null);
    mockCreate.mockResolvedValueOnce({
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

  it('500 — DB error returns server error', async () => {
    mockFindUnique.mockRejectedValueOnce(new Error('DB connection failed'));

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

  it('400 — user not found', async () => {
    mockFindUnique.mockResolvedValueOnce(null);

    const req = { body: { email: 'test@test.com', password: '123456' } };
    await login(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Invalid email or password',
    });
  });

  it('403 — account inactive', async () => {
    mockFindUnique.mockResolvedValueOnce({
      id: 'user-1',
      email: 'test@test.com',
      password: 'hashed',
      isActive: false,
    });

    const req = { body: { email: 'test@test.com', password: '123456' } };
    await login(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Your account is blocked or inactive. Please contact support.',
    });
  });

  it('400 — wrong password', async () => {
    mockFindUnique.mockResolvedValueOnce({
      id: 'user-1',
      email: 'test@test.com',
      password: '$2a$10$invalidhashedpassword',
      isActive: true,
    });

    const req = { body: { email: 'test@test.com', password: 'wrongpassword' } };
    await login(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Invalid email or password',
    });
  });

  it('400 — no password (social account)', async () => {
    mockFindUnique.mockResolvedValueOnce({
      id: 'user-1',
      email: 'test@test.com',
      password: null,
      isActive: true,
    });

    const req = { body: { email: 'test@test.com', password: '123456' } };
    await login(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Please sign in with your social account',
    });
  });

  it('200 — successful login returns token and user', async () => {
    const bcrypt = (await import('bcryptjs')).default;
    const hashedPassword = await bcrypt.hash('123456', 10);

    mockFindUnique.mockResolvedValueOnce({
      id: 'user-1',
      username: 'testuser',
      avatarUrl: 'https://example.com/photo.jpg',
      password: hashedPassword,
      isActive: true,
    });
    mockUpdate.mockResolvedValueOnce({});

    const req = { body: { email: 'test@test.com', password: '123456' } };
    await login(req, res);

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ lastActiveAt: expect.any(Date) }),
      })
    );
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

    // Fix 3 — shared JWT expiry across all auth paths
    expect(mockJwtSign).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(String),
      expect.objectContaining({ expiresIn: '7d' })
    );
  });

  it('200 — response does not contain role', async () => {
    const bcrypt = (await import('bcryptjs')).default;
    const hashedPassword = await bcrypt.hash('123456', 10);

    mockFindUnique.mockResolvedValueOnce({
      id: 'user-1',
      username: 'testuser',
      avatarUrl: 'https://example.com/photo.jpg',
      password: hashedPassword,
      isActive: true,
    });
    mockUpdate.mockResolvedValueOnce({});

    const req = { body: { email: 'test@test.com', password: '123456' } };
    await login(req, res);

    const jsonCall = res.json.mock.calls[0][0];
    expect(jsonCall.user).not.toHaveProperty('role');
  });

  it('500 — DB error returns server error', async () => {
    mockFindUnique.mockRejectedValueOnce(new Error('DB connection failed'));

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
  });

  // Step 1: known user found by firebaseId

  it('200 — existing user found by firebaseId: updates and returns token', async () => {
    const existingUser = {
      id: 'user-1',
      username: 'mockuser',
      email: 'mock@test.com',
    };
    mockFindUnique.mockResolvedValueOnce(existingUser);
    mockUpdate.mockResolvedValueOnce(existingUser);

    const req = { body: { firebaseToken: 'valid-token' } };
    await socialLogin(req, res);

    expect(mockFindUnique).toHaveBeenCalledTimes(1);
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockCreate).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ token: 'mock-jwt-token' })
    );

    // Fix 3 — shared JWT expiry across all auth paths
    expect(mockJwtSign).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(String),
      expect.objectContaining({ expiresIn: '7d' })
    );
  });

  it('200 — response does not contain role', async () => {
    const existingUser = {
      id: 'user-1',
      username: 'mockuser',
      email: 'mock@test.com',
    };
    mockFindUnique.mockResolvedValueOnce(existingUser);
    mockUpdate.mockResolvedValueOnce(existingUser);

    const req = { body: { firebaseToken: 'valid-token' } };
    await socialLogin(req, res);

    const jsonCall = res.json.mock.calls[0][0];
    expect(jsonCall.user).not.toHaveProperty('role');
  });

  // avatarUrl: Google/social login populates avatarUrl from the Firebase
  // `picture` claim. The default mock (apple.com) has no `picture`, so
  // these two tests override verifyIdToken per-case rather than touching
  // the shared mock, to avoid affecting the rest of the suite.

  it('200 — existing user with picture in token: avatarUrl included in update data', async () => {
    const admin = (await import('firebase-admin')).default;
    admin.auth().verifyIdToken.mockResolvedValueOnce({
      uid: 'mock-uid',
      email: 'mock@test.com',
      name: 'Mock User',
      picture: 'https://example.com/photo.jpg',
      firebase: { sign_in_provider: 'google.com' },
    });

    const existingUser = {
      id: 'user-1',
      username: 'mockuser',
      email: 'mock@test.com',
      avatarUrl: 'https://example.com/photo.jpg',
    };
    mockFindUnique.mockResolvedValueOnce({ id: 'user-1' });
    mockUpdate.mockResolvedValueOnce(existingUser);

    const req = { body: { firebaseToken: 'valid-token' } };
    await socialLogin(req, res);

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          avatarUrl: 'https://example.com/photo.jpg',
        }),
      })
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        user: expect.objectContaining({
          avatarUrl: 'https://example.com/photo.jpg',
        }),
      })
    );
  });

  it('200 — existing user, no picture in token (e.g. Apple): avatarUrl not overwritten', async () => {
    // Default mock (apple.com) already omits `picture`
    const existingUser = {
      id: 'user-1',
      username: 'mockuser',
      email: 'mock@test.com',
    };
    mockFindUnique.mockResolvedValueOnce({ id: 'user-1' });
    mockUpdate.mockResolvedValueOnce(existingUser);

    const req = { body: { firebaseToken: 'valid-token' } };
    await socialLogin(req, res);

    const updateCallData = mockUpdate.mock.calls[0][0].data;
    expect(updateCallData).not.toHaveProperty('avatarUrl');
  });

  // Step 2: no firebaseId match — link existing account by email
  // This is the core Fix 2 scenario the mentor described:
  // existing email+password user signs in with Google (same email) →
  // must be linked, not duplicated, and must not 500 on unique(email).

  it('200 — no firebaseId match, existing email found: links account (no duplicate, no 500)', async () => {
    const existingByEmail = {
      id: 'user-2',
      username: 'emailuser',
      email: 'mock@test.com',
    };
    mockFindUnique.mockResolvedValueOnce(null); // miss by firebaseId
    mockFindUnique.mockResolvedValueOnce(existingByEmail); // hit by email
    mockUpdate.mockResolvedValueOnce(existingByEmail);

    const req = { body: { firebaseToken: 'valid-token' } };
    await socialLogin(req, res);

    expect(mockFindUnique).toHaveBeenCalledTimes(2);
    // The existing account is linked via update — its id is preserved
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-2' },
        data: expect.objectContaining({ firebaseId: 'mock-uid' }),
      })
    );
    // No duplicate creation, no 500
    expect(mockCreate).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.status).not.toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        user: expect.objectContaining({ id: 'user-2' }),
      })
    );
  });

  // Step 3: no match at all — create a new user

  it('200 — no match at all: creates new user', async () => {
    const newUser = {
      id: 'user-3',
      username: 'MockUser',
      email: 'mock@test.com',
    };
    mockFindUnique.mockResolvedValueOnce(null);
    mockFindUnique.mockResolvedValueOnce(null);
    mockCreate.mockResolvedValueOnce(newUser);

    const req = { body: { firebaseToken: 'valid-token' } };
    await socialLogin(req, res);

    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ token: 'mock-jwt-token' })
    );
  });

  it('200 — newly created user response does not contain role', async () => {
    const newUser = {
      id: 'user-3',
      username: 'MockUser',
      email: 'mock@test.com',
    };
    mockFindUnique.mockResolvedValueOnce(null);
    mockFindUnique.mockResolvedValueOnce(null);
    mockCreate.mockResolvedValueOnce(newUser);

    const req = { body: { firebaseToken: 'valid-token' } };
    await socialLogin(req, res);

    const jsonCall = res.json.mock.calls[0][0];
    expect(jsonCall.user).not.toHaveProperty('role');
  });

  it('200 — new user created with avatarUrl from picture', async () => {
    const admin = (await import('firebase-admin')).default;
    admin.auth().verifyIdToken.mockResolvedValueOnce({
      uid: 'mock-uid',
      email: 'mock@test.com',
      name: 'Mock User',
      picture: 'https://example.com/photo.jpg',
      firebase: { sign_in_provider: 'google.com' },
    });

    mockFindUnique.mockResolvedValueOnce(null);
    mockFindUnique.mockResolvedValueOnce(null);
    mockCreate.mockResolvedValueOnce({
      id: 'user-3',
      username: 'MockUser',
      email: 'mock@test.com',
      avatarUrl: 'https://example.com/photo.jpg',
    });

    const req = { body: { firebaseToken: 'valid-token' } };
    await socialLogin(req, res);

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          avatarUrl: 'https://example.com/photo.jpg',
        }),
      })
    );
  });

  // DB failure — must log uid and return clean 500

  it('500 — DB error returns authentication error with uid logged', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    mockFindUnique.mockRejectedValueOnce(new Error('DB connection failed'));

    const req = { body: { firebaseToken: 'valid-token' } };
    await socialLogin(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Authentication error',
    });
    // Acceptance criterion: uid must appear in the error log
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[socialLogin] failed for uid:',
      'mock-uid',
      expect.any(String)
    );

    consoleErrorSpy.mockRestore();
  });
});
