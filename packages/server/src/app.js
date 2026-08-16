/**
 * app.js (server)
 *
 * בניית ה-Express app — middleware ו-routes בלבד.
 * לא מריץ listen() ולא נוגע ב-Socket.IO/media-server — זה תפקיד index.js.
 * הופרד מ-index.js כדי לאפשר לטסטים לייבא את ה-app האמיתי
 * (supertest) בלי לפתוח פורט אמיתי או להיתקע בהמתנה למדיה-סרבר.
 *
 * Routes:
 *   /api/users, /api/user-answers, /api/finance, /api/streams
 *   /api/games, /api/questions, /api/analytics, /api/notifications
 *   /api/chat, /api/economy, /api/inbox, /api/follows
 *   /api/auth, /api/feed, /api/config, / (status)
 *
 * TODO: cors origin: '*' — יש להגביל לדומיין הידוע לפני פרודקשן
 */
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

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
import economyRoutes from './routes/economy.routes.js';
import inboxRoutes from './routes/inbox.routes.js';
import followRoutes from './routes/follow.routes.js';
import feedRoutes from './routes/feed.routes.js';
import authRoutes from './routes/auth.routes.js';
import moderationRoutes from './routes/moderation.routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

// --- Middleware ---
app.use(express.json());
app.use(cors(corsOptions));

// --- Static assets (MP4 animations, etc.) ---
app.use(
  '/assets',
  express.static(path.join(__dirname, '../assets'), {
    maxAge: '7d',
    acceptRanges: true,
  })
);

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

export default app;
