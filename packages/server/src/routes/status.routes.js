// packages/server/src/routes/status.routes.js
import express from 'express';
import prisma from '../lib/prisma.js';
import { logger } from '@worldplay/shared';
const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    status: 'online',
    message: '🎮 HyPulse MAIN API is Running!',
    timestamp: new Date().toISOString(),
  });
});

// WHY a DB ping and not just 200: a container can serve '/' while its database
// connection is dead, so a shallow healthcheck reports green while every real
// request 500s. The deploy healthcheck hits this endpoint, so --wait/rollback
// catch a server that is up but cannot reach its DB (SCRUM-317).
router.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'healthy', db: 'up' });
  } catch (err) {
    // WHY log: when the healthcheck flips to 503 in prod, the log is the only
    // place that says which DB error caused it.
    logger.error('Health check DB ping failed:', err.message);
    res.status(503).json({ status: 'unhealthy', db: 'down' });
  }
});

export default router;
