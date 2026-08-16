import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getMe } from '../controller/user.controller.js';

const { mockFindUnique } = vi.hoisted(() => ({
  mockFindUnique: vi.fn(),
}));

vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn().mockImplementation(() => ({
    user: { findUnique: mockFindUnique },
  })),
}));

const mockRes = () => {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};

describe('getMe', () => {
  let res;

  beforeEach(() => {
    res = mockRes();
    vi.clearAllMocks();
  });

  it('200 — includes avatarUrl in the select and the response (SCRUM-274 regression)', async () => {
    mockFindUnique.mockResolvedValueOnce({
      id: 'user-1',
      username: 'testuser',
      email: 'test@test.com',
      dateOfBirth: new Date('1995-06-15'),
      walletBalance: 100,
      avatarUrl: 'https://example.com/photo.jpg',
      participations: [],
    });

    const req = { user: { id: 'user-1' } };
    await getMe(req, res);

    expect(mockFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({ avatarUrl: true }),
      })
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        avatarUrl: 'https://example.com/photo.jpg',
      })
    );
  });

  it('200 — user without an avatar returns avatarUrl: null (client falls back to default)', async () => {
    mockFindUnique.mockResolvedValueOnce({
      id: 'user-1',
      username: 'testuser',
      email: 'test@test.com',
      dateOfBirth: new Date('1995-06-15'),
      walletBalance: 100,
      avatarUrl: null,
      participations: [],
    });

    const req = { user: { id: 'user-1' } };
    await getMe(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ avatarUrl: null })
    );
  });

  it('404 — user not found', async () => {
    mockFindUnique.mockResolvedValueOnce(null);

    const req = { user: { id: 'missing-user' } };
    await getMe(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'משתמש לא נמצא' });
  });
});
