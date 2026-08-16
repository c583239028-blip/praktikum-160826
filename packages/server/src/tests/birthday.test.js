import { describe, it, expect, vi, beforeEach } from 'vitest';
import { updateBirthday } from '../controller/user.controller.js';

const { mockUpdate } = vi.hoisted(() => ({
  mockUpdate: vi.fn(),
}));

vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn().mockImplementation(() => ({
    user: { update: mockUpdate },
  })),
}));

const mockRes = () => {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};

describe('updateBirthday', () => {
  let res;

  beforeEach(() => {
    res = mockRes();
    vi.clearAllMocks();
  });

  it('400 — missing dateOfBirth', async () => {
    const req = { body: {}, user: { id: 'user-1' } };
    await updateBirthday(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'dateOfBirth is required',
    });
  });

  it('400 — wrong format (not YYYY-MM-DD)', async () => {
    const req = { body: { dateOfBirth: '15/06/1995' }, user: { id: 'user-1' } };
    await updateBirthday(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'פורמט תאריך לא תקין. נדרש YYYY-MM-DD',
    });
  });

  it('400 — invalid date (Feb 30)', async () => {
    const req = { body: { dateOfBirth: '2000-02-30' }, user: { id: 'user-1' } };
    await updateBirthday(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'תאריך לא תקין' });
  });

  it('400 — future date', async () => {
    const req = { body: { dateOfBirth: '2099-01-01' }, user: { id: 'user-1' } };
    await updateBirthday(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'תאריך לידה חייב להיות בעבר',
    });
  });

  it('200 — valid date', async () => {
    mockUpdate.mockResolvedValueOnce({
      id: 'user-1',
      username: 'test',
      email: 'test@test.com',
      dateOfBirth: new Date('1995-06-15'),
    });

    const req = { body: { dateOfBirth: '1995-06-15' }, user: { id: 'user-1' } };
    await updateBirthday(req, res);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'user-1', dateOfBirth: expect.any(Date) })
    );
  });
});
