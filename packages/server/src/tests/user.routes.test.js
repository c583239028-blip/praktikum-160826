import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import userRoutes from '../routes/user.routes.js';

vi.mock('../middleware/auth.middleware.js', () => ({
  authenticateToken: (req, _res, next) => {
    req.user = { id: 'user-1' };
    next();
  },
}));

vi.mock('../controller/user.controller.js', () => ({
  getMe: (req, res) => res.status(200).json({ id: req.user.id }),
  updateMe: (req, res) => res.status(200).json({ id: req.user.id }),
  updateBirthday: (req, res) => res.status(200).json({ id: req.user.id }),
}));

vi.mock('../controller/auth.controller.js', () => ({
  register: (_req, res) => res.status(201).json({}),
  login: (_req, res) => res.status(200).json({}),
}));

const app = express();
app.use(express.json());
app.use('/api/users', userRoutes);

describe('user routes — /me convention', () => {
  it('GET /api/users/me → 200', async () => {
    const res = await request(app).get('/api/users/me');
    expect(res.status).toBe(200);
  });

  it('PUT /api/users/me → 200', async () => {
    const res = await request(app).put('/api/users/me');
    expect(res.status).toBe(200);
  });

  it('GET /api/users/profile → 404', async () => {
    const res = await request(app).get('/api/users/profile');
    expect(res.status).toBe(404);
  });

  it('PUT /api/users/profile → 404', async () => {
    const res = await request(app).put('/api/users/profile');
    expect(res.status).toBe(404);
  });
});
