import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockVerify, mockFindUnique } = vi.hoisted(() => ({
  mockVerify: vi.fn(),
  mockFindUnique: vi.fn(),
}));

vi.mock('jsonwebtoken', () => ({
  default: { verify: mockVerify },
}));

import { createSocketAuth } from '../middleware/socketAuth.js';

// SCRUM-351 / M11-01: מחליף את שני העותקים הזהים ב-server וב-media-server.
describe('shared createSocketAuth', () => {
  const prisma = { user: { findUnique: mockFindUnique } };
  let next;

  const makeSocket = (token) => ({
    handshake: { auth: { token }, headers: {} },
  });

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = 'test-secret';
    next = vi.fn();
  });

  it('rejects when no token is provided', async () => {
    const socketAuth = createSocketAuth({ prisma });
    await socketAuth(makeSocket(undefined), next);

    expect(next).toHaveBeenCalledWith(
      new Error('Not authorized: No token provided')
    );
    expect(mockVerify).not.toHaveBeenCalled();
  });

  it('rejects an invalid/expired token', async () => {
    mockVerify.mockImplementation(() => {
      throw new Error('jwt malformed');
    });
    const socketAuth = createSocketAuth({ prisma });
    await socketAuth(makeSocket('bad-token'), next);

    expect(next).toHaveBeenCalledWith(
      new Error('Not authorized: Invalid token')
    );
  });

  it('rejects when the user no longer exists', async () => {
    mockVerify.mockReturnValue({ id: 'ghost-user' });
    mockFindUnique.mockResolvedValueOnce(null);
    const socketAuth = createSocketAuth({ prisma });
    await socketAuth(makeSocket('valid-token'), next);

    expect(next).toHaveBeenCalledWith(
      new Error('Not authorized: User not found')
    );
  });

  it('rejects a banned (inactive) user', async () => {
    mockVerify.mockReturnValue({ id: 'user-1' });
    mockFindUnique.mockResolvedValueOnce({
      id: 'user-1',
      username: 'banned',
      role: 'PLAYER',
      isActive: false,
    });
    const socketAuth = createSocketAuth({ prisma });
    await socketAuth(makeSocket('valid-token'), next);

    expect(next).toHaveBeenCalledWith(
      new Error('Not authorized: User is banned')
    );
  });

  it('authorizes an active user and attaches socket.user', async () => {
    mockVerify.mockReturnValue({ id: 'user-1' });
    mockFindUnique.mockResolvedValueOnce({
      id: 'user-1',
      username: 'alice',
      role: 'PLAYER',
      isActive: true,
    });
    const socketAuth = createSocketAuth({ prisma });
    const socket = makeSocket('valid-token');
    await socketAuth(socket, next);

    expect(socket.user).toEqual(
      expect.objectContaining({ id: 'user-1', username: 'alice' })
    );
    expect(next).toHaveBeenCalledWith();
  });

  it('omits avatarUrl from the select by default (media-server usage)', async () => {
    mockVerify.mockReturnValue({ id: 'user-1' });
    mockFindUnique.mockResolvedValueOnce({
      id: 'user-1',
      username: 'alice',
      role: 'PLAYER',
      isActive: true,
    });
    const socketAuth = createSocketAuth({ prisma });
    await socketAuth(makeSocket('valid-token'), next);

    expect(mockFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        select: {
          id: true,
          username: true,
          role: true,
          isActive: true,
        },
      })
    );
  });

  it('includes avatarUrl in the select when includeAvatarUrl is true (server usage)', async () => {
    mockVerify.mockReturnValue({ id: 'user-1' });
    mockFindUnique.mockResolvedValueOnce({
      id: 'user-1',
      username: 'alice',
      role: 'PLAYER',
      isActive: true,
      avatarUrl: null,
    });
    const socketAuth = createSocketAuth({ prisma, includeAvatarUrl: true });
    await socketAuth(makeSocket('valid-token'), next);

    expect(mockFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        select: {
          id: true,
          username: true,
          role: true,
          isActive: true,
          avatarUrl: true,
        },
      })
    );
  });

  it('reads the token from handshake.headers.token as a fallback', async () => {
    mockVerify.mockReturnValue({ id: 'user-1' });
    mockFindUnique.mockResolvedValueOnce({
      id: 'user-1',
      username: 'alice',
      role: 'PLAYER',
      isActive: true,
    });
    const socketAuth = createSocketAuth({ prisma });
    const socket = {
      handshake: { auth: {}, headers: { token: 'header-token' } },
    };
    await socketAuth(socket, next);

    expect(mockVerify).toHaveBeenCalledWith('header-token', 'test-secret');
    expect(next).toHaveBeenCalledWith();
  });
});
