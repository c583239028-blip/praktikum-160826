import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import prisma from './src/lib/prisma.js';
import { logger } from './src/utils/logger.js';
import { validateEnv } from './src/config/validateEnv.js';
import { internalAuth } from './src/middleware/internalAuth.js';
import {
  createWorkers,
  areWorkersReady,
} from './src/services/mediasoup.service.js';
import { registerStreamHandlers } from './src/sockets/stream.handler.js';
import { config, APP_SERVER_URL } from './src/config.js';
import statusRoutes from './src/routes/status.routes.js';
import internalRoutes from './src/routes/internal.routes.js';
import { StreamService } from './src/services/stream.service.js';
import { INTERNAL_API } from '@worldplay/shared';
import { createSocketAuth } from '@worldplay/shared/src/middleware/socketAuth.js';
import { reconcileOrphanedStreams } from './src/startup/reconcileOrphanedStreams.js';

dotenv.config();
validateEnv();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const httpServer = http.createServer(app);
const PORT = process.env.MEDIA_PORT || 8000;

const io = new Server(httpServer, {
  cors: {
    origin: true,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

app.use(express.json());

// Stop stream endpoint
app.post('/live/stop/:streamId', internalAuth, async (req, res) => {
  const { streamId } = req.params;
  logger.info(`Received stop request for stream: ${streamId}`);

  try {
    await StreamService.stopRecording(streamId);
    res
      .status(200)
      .json({ success: true, message: 'Stream stopped and cleaned up' });
  } catch (err) {
    logger.error(`Failed to stop stream ${streamId}`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// Serve HLS files (segments and playlists).
//
// CORS is required here: mass viewers (SCRUM-171) run on a different origin
// than the media server, and express.static does not add these headers on its
// own — without them the browser blocks the HLS player from reading the
// manifest and segments. The feed is public by nature, so '*' is appropriate.
app.use(
  '/streams',
  (req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    next();
  },
  express.static(path.join(__dirname, 'public', 'streams'))
);

// WHY before statusRoutes: keeps the 10s deploy healthcheck ping out of the
// request logger, and a dedicated readiness check (live mediasoup workers)
// catches a process that answers HTTP but has no workers (SCRUM-317).
app.get('/health', (req, res) => {
  if (areWorkersReady()) {
    res.json({ status: 'healthy', workers: 'ready' });
  } else {
    res.status(503).json({ status: 'unhealthy', workers: 'not-ready' });
  }
});

app.use('/', statusRoutes);
app.use(INTERNAL_API.MOUNT_PATH, internalAuth, internalRoutes);

app.set('io', io);

io.use(createSocketAuth({ prisma }));
io.on('connection', (socket) => {
  logger.socketConnect(socket.user, socket.id);
  registerStreamHandlers(io, socket);
  socket.on('disconnect', (reason) => {
    logger.socketDisconnect(socket.user, socket.id, reason);
  });
});

const startServer = async () => {
  try {
    // רץ לפני httpServer.listen — אין חיבורים אפשריים עד אז, אז אין סיכון
    // שסוקט יצליח ליצור/להצטרף לחדר "יתום" בזמן שהניקוי עדיין רץ.
    //
    // WHY the env gate (SCRUM-291): reconcileOrphanedStreams marks ALL LIVE/PAUSE
    // streams FINISHED — correct only for a single media process. During the
    // migration the dedicated droplet runs ALONGSIDE the app-droplet copy against
    // the same DB, so its startup reconcile would kill the live streams the other
    // server is serving. Set SKIP_STREAM_RECONCILE=true on the dedicated droplet
    // while both run; remove it after the app-droplet copy is gone so the sole
    // remaining server reconciles its own orphans again.
    if (process.env.SKIP_STREAM_RECONCILE !== 'true') {
      await reconcileOrphanedStreams(prisma, logger);
    } else {
      logger.info(
        'SKIP_STREAM_RECONCILE=true — skipping orphaned-stream reconciliation (SCRUM-291 parallel-run)'
      );
    }

    await createWorkers();
    logger.success('Mediasoup Workers Initialized');
    httpServer.listen(PORT, '0.0.0.0', () => {
      logger.system(`Media Server is running on http://localhost:${PORT}`);
      // Surface the deploy-critical targets once at boot so a broken droplet
      // config is visible in the log, not only via `printenv`. Logs the
      // effective values (env + fallback), not the raw env — the app-server
      // target especially matters when media moves off the compose network
      // (SCRUM-291); ANNOUNCED_IP silently breaks ICE if it stays private.
      logger.system(
        `Deploy targets — ANNOUNCED_IP: ${config.mediasoup.webRtcTransport.listenIps[0].announcedIp}, app-server: ${APP_SERVER_URL}`
      );
    });
  } catch (err) {
    logger.error('Failed to start Media Server', err);
  }
};

startServer();
