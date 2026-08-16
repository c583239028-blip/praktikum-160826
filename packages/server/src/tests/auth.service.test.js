/**
 * auth.service.test.js
 *
 * בדיקות יחידה ל-auth.service.js.
 * מוקאת את ה-prisma singleton (lib/prisma.js) — אין פגיעה ב-DB אמיתי.
 * בודקת את לוגיקת גישת ה-DB בלבד: findUserByEmail / createUserWithPassword /
 * authenticateWithPassword / upsertSocialUser.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/prisma.js', () => ({
  default: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import prisma from '../lib/prisma.js';
import bcrypt from 'bcryptjs';
import {
  findUserByEmail,
  createUserWithPassword,
  authenticateWithPassword,
  upsertSocialUser,
} from '../services/auth.service.js';

describe('authService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── findUserByEmail ──────────────────────────────────────

  describe('findUserByEmail', () => {
    it('queries Prisma by email and returns the user', async () => {
      const user = { id: 'user-1' };
      prisma.user.findUnique.mockResolvedValueOnce(user);

      const result = await findUserByEmail('test@test.com');

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@test.com' },
      });
      expect(result).toBe(user);
    });

    it('returns null when no user exists', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(null);

      const result = await findUserByEmail('missing@test.com');

      expect(result).toBeNull();
    });
  });

  // ── createUserWithPassword ───────────────────────────────

  describe('createUserWithPassword', () => {
    it('hashes the password and creates an active user with safe select fields', async () => {
      const created = {
        id: 'user-1',
        username: 'testuser',
        email: 'test@test.com',
        avatarUrl: null,
      };
      prisma.user.create.mockResolvedValueOnce(created);

      const result = await createUserWithPassword({
        username: 'testuser',
        email: 'test@test.com',
        password: '123456',
      });

      expect(prisma.user.create).toHaveBeenCalledTimes(1);
      const arg = prisma.user.create.mock.calls[0][0];

      // password is hashed, not stored in plaintext
      expect(arg.data.password).not.toBe('123456');
      expect(await bcrypt.compare('123456', arg.data.password)).toBe(true);

      expect(arg.data).toMatchObject({
        username: 'testuser',
        email: 'test@test.com',
        isActive: true,
      });
      // safe fields only — never exposes password/isActive
      expect(arg.select).toMatchObject({
        id: true,
        username: true,
        email: true,
        avatarUrl: true,
      });
      expect(arg.select).not.toHaveProperty('password');

      expect(result).toBe(created);
    });
  });

  // ── authenticateWithPassword ─────────────────────────────

  describe('authenticateWithPassword', () => {
    const buildActiveUser = async (overrides = {}) => ({
      id: 'user-1',
      username: 'testuser',
      avatarUrl: 'https://example.com/photo.jpg',
      password: await bcrypt.hash('123456', 10),
      isActive: true,
      ...overrides,
    });

    it('returns INVALID_CREDENTIALS when the user is not found', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(null);

      const result = await authenticateWithPassword({
        email: 'test@test.com',
        password: '123456',
      });

      expect(result).toEqual({ ok: false, reason: 'INVALID_CREDENTIALS' });
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('returns INACTIVE when the account is disabled', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(
        await buildActiveUser({ isActive: false })
      );

      const result = await authenticateWithPassword({
        email: 'test@test.com',
        password: '123456',
      });

      expect(result).toEqual({ ok: false, reason: 'INACTIVE' });
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('returns SOCIAL_ONLY when the user has no password (social account)', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(
        await buildActiveUser({ password: null })
      );

      const result = await authenticateWithPassword({
        email: 'test@test.com',
        password: '123456',
      });

      expect(result).toEqual({ ok: false, reason: 'SOCIAL_ONLY' });
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('returns INVALID_CREDENTIALS on password mismatch', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(await buildActiveUser());

      const result = await authenticateWithPassword({
        email: 'test@test.com',
        password: 'wrongpassword',
      });

      expect(result).toEqual({ ok: false, reason: 'INVALID_CREDENTIALS' });
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('on success touches lastActiveAt and returns a user without password/isActive', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(await buildActiveUser());
      prisma.user.update.mockResolvedValueOnce({});

      const result = await authenticateWithPassword({
        email: 'test@test.com',
        password: '123456',
      });

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          data: expect.objectContaining({ lastActiveAt: expect.any(Date) }),
        })
      );
      expect(result.ok).toBe(true);
      expect(result.user).toMatchObject({
        id: 'user-1',
        username: 'testuser',
        avatarUrl: 'https://example.com/photo.jpg',
      });
      expect(result.user).not.toHaveProperty('password');
      expect(result.user).not.toHaveProperty('isActive');
    });
  });

  // ── upsertSocialUser ─────────────────────────────────────

  describe('upsertSocialUser', () => {
    const decoded = (overrides = {}) => ({
      uid: 'mock-uid',
      email: 'mock@test.com',
      name: 'Mock User',
      picture: 'https://example.com/photo.jpg',
      firebase: { sign_in_provider: 'google.com' },
      ...overrides,
    });

    it('found by firebaseId: updates the existing user and returns it', async () => {
      const existing = { id: 'user-1' };
      const updated = { id: 'user-1', username: 'mockuser' };
      prisma.user.findUnique.mockResolvedValueOnce(existing);
      prisma.user.update.mockResolvedValueOnce(updated);

      const result = await upsertSocialUser(decoded());

      expect(prisma.user.findUnique).toHaveBeenCalledTimes(1);
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          data: expect.objectContaining({
            lastActiveAt: expect.any(Date),
            avatarUrl: 'https://example.com/photo.jpg',
            email: 'mock@test.com',
            googleId: 'mock-uid',
          }),
        })
      );
      expect(prisma.user.create).not.toHaveBeenCalled();
      expect(result).toBe(updated);
    });

    it('found by firebaseId without picture (e.g. Apple): does not overwrite avatarUrl', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'user-1' });
      prisma.user.update.mockResolvedValueOnce({ id: 'user-1' });

      await upsertSocialUser(
        decoded({
          picture: undefined,
          firebase: { sign_in_provider: 'apple.com' },
        })
      );

      const updateData = prisma.user.update.mock.calls[0][0].data;
      expect(updateData).not.toHaveProperty('avatarUrl');
      expect(updateData).toHaveProperty('appleId', 'mock-uid');
    });

    it('no firebaseId match but email exists: links the account instead of duplicating', async () => {
      const existingByEmail = { id: 'user-2' };
      prisma.user.findUnique
        .mockResolvedValueOnce(null) // miss by firebaseId
        .mockResolvedValueOnce(existingByEmail); // hit by email
      prisma.user.update.mockResolvedValueOnce(existingByEmail);

      const result = await upsertSocialUser(decoded());

      expect(prisma.user.findUnique).toHaveBeenCalledTimes(2);
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-2' },
          data: expect.objectContaining({ firebaseId: 'mock-uid' }),
        })
      );
      expect(prisma.user.create).not.toHaveBeenCalled();
      expect(result).toBe(existingByEmail);
    });

    it('no match at all: creates a new user with avatarUrl from picture', async () => {
      const created = { id: 'user-3', username: 'MockUser' };
      prisma.user.findUnique
        .mockResolvedValueOnce(null) // miss by firebaseId
        .mockResolvedValueOnce(null); // miss by email
      prisma.user.create.mockResolvedValueOnce(created);

      const result = await upsertSocialUser(decoded());

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            firebaseId: 'mock-uid',
            avatarUrl: 'https://example.com/photo.jpg',
            email: 'mock@test.com',
            googleId: 'mock-uid',
          }),
        })
      );
      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(result).toBe(created);
    });

    it('creates a fallback email and username when the token omits email/name', async () => {
      prisma.user.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      prisma.user.create.mockResolvedValueOnce({ id: 'user-4' });

      // no email → skips the email lookup entirely (only firebaseId query)
      await upsertSocialUser(decoded({ email: undefined, name: undefined }));

      expect(prisma.user.findUnique).toHaveBeenCalledTimes(1);
      const createData = prisma.user.create.mock.calls[0][0].data;
      expect(createData.email).toBe('mock-uid@noemail.firebase');
      expect(createData.username).toBe('User_mock-uid');
    });
  });
});
