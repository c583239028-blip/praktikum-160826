import { describe, it, expect, afterEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

// The health endpoint's whole point is the DB ping, so mock prisma to control
// whether the query succeeds or throws. vi.hoisted so the spy exists before the
// hoisted vi.mock factory references it.
const { queryRaw } = vi.hoisted(() => ({ queryRaw: vi.fn() }));
vi.mock('../lib/prisma.js', () => ({ default: { $queryRaw: queryRaw } }));

// Mount only the status router — importing the whole app.js would drag in
// unrelated services (auth/bcrypt/firebase) that have nothing to do with /health.
import statusRoutes from '../routes/status.routes.js';

const app = express();
app.use('/', statusRoutes);

describe('GET /health (deploy readiness — DB ping, SCRUM-317)', () => {
  afterEach(() => {
    queryRaw.mockReset();
  });

  it('returns 200 healthy when the DB query succeeds', async () => {
    queryRaw.mockResolvedValue([{ '?column?': 1 }]);
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'healthy', db: 'up' });
    expect(queryRaw).toHaveBeenCalled();
  });

  it('returns 503 unhealthy when the DB query throws', async () => {
    queryRaw.mockRejectedValue(new Error('connection refused'));
    const res = await request(app).get('/health');
    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ status: 'unhealthy', db: 'down' });
  });
});
