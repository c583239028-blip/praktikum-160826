/**
 * index.js (server)
 *
 * נקודת הכניסה לשרת הראשי — מאתחל Express, Socket.IO, ו-Routes.
 * מחכה לזמינות שרת המדיה לפני שמסמן שהשרת מוכן.
 *
 * Routes:
 *   /api/users, /api/user-answers, /api/finance, /api/streams
 *   /api/games, /api/questions, /api/analytics, /api/notifications
 *   /api/chat, /api/economy, /api/inbox, /api/follows
 *   /api/auth, /api/feed, /api/config, / (status)
 *
 * TODO: cors origin: '*' — יש להגביל לדומיין הידוע לפני פרודקשן
 */
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'http';
import axios from 'axios';
import { validateEnv } from './config/validateEnv.js';

import userRoutes from './routes/user.routes.js';
import financeRoutes from './routes/finance.routes.js';
import streamRoutes from './routes/stream.routes.js';
import gameRoutes from './routes/games.routes.js';
import questionRoutes from './routes/question.routes.js';
import analyticsRoutes from './routes/analytics.routes.js';
import chatRoutes from './routes/chat.routes.js';
import notificationRoutes from './routes/notification.routes.js';
import configRoutes from './routes/config.routes.js';
import statusRoutes from './routes/status.routes.js';
import userAnswerRoutes from './routes/userAnswer.routes.js';
import corsOptions from './config/corsOptions.js';
import { initializeSocketIO } from './services/socket.service.js';

import economyRoutes from './routes/economy.routes.js';

import inboxRoutes from './routes/inbox.routes.js';
import followRoutes from './routes/follow.routes.js';
import feedRoutes from './routes/feed.routes.js';
import authRoutes from './routes/auth.routes.js';
import moderationRoutes from './routes/moderation.routes.js';

validateEnv();
const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 8080;

// --- Middleware ---
app.use(express.json());
app.use(cors(corsOptions));

// --- Routes ---
app.use('/', statusRoutes); // דף הבית של ה-API
app.use('/api/config', configRoutes); // קונפיגורציית המדיה
app.use('/api/users', userRoutes);
app.use('/api/user-answers', userAnswerRoutes);
app.use('/api/finance', financeRoutes);
app.use('/api/streams', streamRoutes);
app.use('/api/streams', moderationRoutes); // moderation endpoints share the /api/streams base path
app.use('/api/games', gameRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/chat', chatRoutes);

app.use('/api/economy', economyRoutes);

app.use('/api/inbox', inboxRoutes);
app.use('/api/follows', followRoutes);
app.use('/api/feed', feedRoutes);
app.use('/api/auth', authRoutes);

// --- Functions ---
async function checkMediaServer() {
  let connected = false;
  const mediaUrl = process.env.MEDIA_SERVER_INTERNAL_URL;

  while (!connected) {
    try {
      const response = await axios.get(mediaUrl); // פנייה לכתובת הדינמית
      console.log(
        '[BACKEND-TO-MEDIA] Connection successful:',
        response.data.status
      );
      connected = true;
    } catch (error) {
      console.log(
        `[BACKEND-TO-MEDIA] Waiting for media server at ${mediaUrl}...`,
        error.message
      );
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }
}

// --- Startup ---
const io = initializeSocketIO(server);
app.set('io', io);

server.listen(PORT, '0.0.0.0', async () => {
  console.log(`✅ Main Server running on port ${PORT}`);
  await checkMediaServer();
});
