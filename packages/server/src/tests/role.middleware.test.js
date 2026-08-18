import { describe, it, expect, vi, beforeEach } from 'vitest';
import { requireStaff } from '../middleware/role.middleware.js';

// ── Helpers ────────────────────────────────────────────────

const mockRes = () => {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};

const mockNext = vi.fn();

// ── requireStaff ───────────────────────────────────────────

describe('requireStaff middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Access granted ──

  it('calls next() when user role is STAFF', () => {
    const req = { user: { role: 'STAFF' } };
    const res = mockRes();

    requireStaff(req, res, mockNext);

    expect(mockNext).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('calls next() when user role is ADMIN', () => {
    const req = { user: { role: 'ADMIN' } };
    const res = mockRes();

    requireStaff(req, res, mockNext);

    expect(mockNext).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  // ── Access denied ──

  it('returns 403 when user role is USER', () => {
    const req = { user: { role: 'USER' } };
    const res = mockRes();

    requireStaff(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Access denied: staff only',
    });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('returns 403 when user has no role', () => {
    const req = { user: {} };
    const res = mockRes();

    requireStaff(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Access denied: staff only',
    });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('returns 403 when user role is unknown', () => {
    const req = { user: { role: 'MODERATOR' } };
    const res = mockRes();

    requireStaff(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Access denied: staff only',
    });
    expect(mockNext).not.toHaveBeenCalled();
  });
});
