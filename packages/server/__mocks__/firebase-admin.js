import { vi } from 'vitest';

export const auth = vi.fn(() => ({
  verifyIdToken: vi.fn().mockResolvedValue({
    uid: 'mock-uid',
    email: 'mock@test.com',
  }),
}));

export default { auth };
