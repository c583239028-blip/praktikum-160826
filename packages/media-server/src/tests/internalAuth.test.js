import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ERROR_MESSAGES } from '@worldplay/shared';
import { internalAuth } from '../middleware/internalAuth.js';

function buildRes() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
}

describe('internalAuth middleware', () => {
  const ORIGINAL_SECRET = process.env.INTERNAL_SERVICE_SECRET;

  beforeEach(() => {
    process.env.INTERNAL_SERVICE_SECRET = 'test-secret';
  });

  afterEach(() => {
    // Plain assignment would coerce `undefined` to the string "undefined"
    // instead of actually clearing it, leaking a truthy value into
    // whatever runs next in this worker.
    if (ORIGINAL_SECRET === undefined) {
      delete process.env.INTERNAL_SERVICE_SECRET;
    } else {
      process.env.INTERNAL_SERVICE_SECRET = ORIGINAL_SECRET;
    }
  });

  it('401s when the header is missing', () => {
    const req = { headers: {} };
    const res = buildRes();
    const next = vi.fn();

    internalAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: ERROR_MESSAGES.UNAUTHORIZED,
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('401s when the header does not match the configured secret', () => {
    const req = { headers: { 'x-internal-secret': 'wrong' } };
    const res = buildRes();
    const next = vi.fn();

    internalAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next() when the header matches', () => {
    const req = { headers: { 'x-internal-secret': 'test-secret' } };
    const res = buildRes();
    const next = vi.fn();

    internalAuth(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('401s when INTERNAL_SERVICE_SECRET is not configured at all, even with a header', () => {
    delete process.env.INTERNAL_SERVICE_SECRET;
    const req = { headers: { 'x-internal-secret': 'anything' } };
    const res = buildRes();
    const next = vi.fn();

    internalAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('401s (not a thrown length-mismatch error) when the header length differs from the secret', () => {
    const req = { headers: { 'x-internal-secret': 'short' } };
    const res = buildRes();
    const next = vi.fn();

    expect(() => internalAuth(req, res, next)).not.toThrow();
    expect(res.status).toHaveBeenCalledWith(401);
  });
});
