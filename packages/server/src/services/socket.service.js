/**
 * socket.service.js (server)
 *
 * אתחול שרת Socket.IO וניהול אירועי חיבור/ניתוק.
 * מטפל בשני תרחישים עיקריים:
 *   1. חיבור — הצטרפות לחדר פרטי לפי userId (להתראות אישיות)
 *   2. ניתוק — סגירה אוטומטית של משחקים פעילים כשמארח מתנתק
 *
 * מתקשר עם: Prisma → Game, Socket.IO rooms
 * תלוי ב:   createSocketAuth (@worldplay/shared), game.handler.js, game.service.js
 * משמש את:  server.js (קריאה ל-initializeSocketIO בהפעלה)
 *
 * CORS: origin מוגבל ל-allowlist לפי NODE_ENV (ראה config/corsOptions.js).
 */
import { Server } from 'socket.io';
import { registerGameHandlers } from '../sockets/game.handler.js';
import { createSocketAuth } from '@worldplay/shared/src/middleware/socketAuth.js';
import gameService from './game.service.js';
import prisma from '../lib/prisma.js';
import corsOptions from '../config/corsOptions.js';
import { SOCKET_EVENTS } from '@worldplay/shared';

export const initializeSocketIO = (httpServer) => {
  const io = new Server(httpServer, {
    cors: { ...corsOptions, methods: ['GET', 'POST'] },
  });

  io.use(createSocketAuth({ prisma, includeAvatarUrl: true }));

  io.on('connection', (socket) => {
    registerGameHandlers(io, socket);

    const user = socket.user;
    if (user && user.id) {
      socket.join(user.id);
    }

    socket.on(SOCKET_EVENTS.SYSTEM.DISCONNECT, async () => {
      if (user && user.id) {
        try {
          const activeGames = await prisma.game.findMany({
            where: { hostId: user.id, status: 'ACTIVE' },
          });

          for (const game of activeGames) {
            await gameService.updateGameStatus(game.id, user.id, 'FINISHED');
            io.to(game.id).emit(SOCKET_EVENTS.GAME.STATUS_UPDATE, {
              gameId: game.id,
              status: 'FINISHED',
            });
          }
        } catch {
          // כישלון בניקוי לא אמור לפיל את השרת
        }
      }
    });
  });

  return io;
};
