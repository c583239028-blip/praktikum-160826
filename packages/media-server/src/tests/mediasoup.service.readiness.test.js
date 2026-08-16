import { describe, it, expect, vi } from 'vitest';

// Fake workers so the test never touches the native mediasoup binary. createWorkers
// pushes whatever createWorker returns, so a plain object with { closed, on } is enough.
const created = [];
vi.mock('mediasoup', () => ({
  default: {
    createWorker: vi.fn(async () => {
      const worker = { closed: false, on: vi.fn() };
      created.push(worker);
      return worker;
    }),
  },
}));
vi.mock('../config.js', () => ({
  config: { mediasoup: { numWorkers: 2, worker: {} } },
}));

import {
  createWorkers,
  areWorkersReady,
} from '../services/mediasoup.service.js';

// The module-level workers array persists across these tests, so they run in order:
// empty -> populated -> one closed.
describe('areWorkersReady (media deploy readiness, SCRUM-317)', () => {
  it('is false before any worker is created', () => {
    expect(areWorkersReady()).toBe(false);
  });

  it('is true once workers are created and alive', async () => {
    await createWorkers();
    expect(created).toHaveLength(2);
    expect(areWorkersReady()).toBe(true);
  });

  it('is false again if a worker becomes closed', () => {
    created[0].closed = true;
    expect(areWorkersReady()).toBe(false);
  });
});
