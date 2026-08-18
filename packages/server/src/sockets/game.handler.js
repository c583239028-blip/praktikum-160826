import { PrismaClient } from '@prisma/client';
import {
  JoinGameSchema,
  SOCKET_EVENTS,
  ERROR_MESSAGES,
} from '@worldplay/shared';
import { logger } from '../utils/logger.js';
import * as gameRules from '../services/validation.service.js';
import gameService from '../services/game.service.js';

const prisma = new PrismaClient();

export const registerGameHandlers = (io, socket) => {
  const user = socket.user;

  // ---אירוע: הצטרפות לחדר ---
  socket.on(SOCKET_EVENTS.GAME.JOIN, async (payload) => {
    // שלב 1: ולידציה מבנית (Zod) - השומר בכניסה
    // אנחנו בודקים את המידע שהגיע מהלקוח מול הסכמה המשותפת
    const validationResult = JoinGameSchema.safeParse(payload);

    if (!validationResult.success) {
      const username = user?.username || 'Unknown/Guest';

      console.warn(
        `Validation failed for user ${username}`,
        JSON.stringify(validationResult.error.format(), null, 2)
      );
      socket.emit(SOCKET_EVENTS.SYSTEM.ERROR, {
        msg: ERROR_MESSAGES.INVALID_DATA_FORMAT,
        details: validationResult.error.format(),
      });
      return;
    }

    // מעכשיו משתמשים בנתונים הנקיים שעברו ולידציה
    const { gameId, role } = validationResult.data;

    // שלב 2: ולידציה עסקית (DB)

    if (socket.rooms.has(gameId)) {
      logger.info(`User ${user.username} is already in socket room ${gameId}`);
      socket.emit(SOCKET_EVENTS.SYSTEM.SYSTEM_MESSAGE, {
        msg: ERROR_MESSAGES.ALREADY_CONNECTED,
      });
      return;
    }

    try {
      const validation = await gameRules.validateJoinEligibility(
        gameId,
        user.id,
        role || 'VIEWER'
      );

      if (validation.status === 'ALREADY_JOINED') {
        socket.join(gameId);
        logger.socketJoin(user, gameId);
        socket.emit(SOCKET_EVENTS.SYSTEM.SYSTEM_MESSAGE, {
          msg: `Welcome back! You are connected to game ${gameId}`,
        });
        return;
      }

      // רישום שחקן ב-DB
      await prisma.gameParticipant.create({
        data: {
          gameId: gameId,
          userId: user.id,
          role: role || 'VIEWER',
          score: 0,
        },
      });

      // הצטרפות פיזית לחדר בסוקט
      socket.join(gameId);
      logger.socketJoin(user, gameId);

      socket.emit(SOCKET_EVENTS.SYSTEM.SYSTEM_MESSAGE, {
        msg: `Successfully joined game as ${role}`,
      });

      io.to(gameId).emit(SOCKET_EVENTS.GAME.ROOM_UPDATE, {
        type: 'USER_JOINED',
        userId: user.id,
        username: user.username,
        avatarUrl: user.avatarUrl,
        role: role,
        timestamp: new Date(),
      });
    } catch (error) {
      logger.error(`Join Room Failed for ${user.username}`, error.message);
      socket.emit(SOCKET_EVENTS.SYSTEM.ERROR, {
        msg: ERROR_MESSAGES.GAME_JOIN_FAILED,
      });
    }
  });
  // בתוך registerGameHandlers ב-App-Server
  socket.on(SOCKET_EVENTS.GAME.CREATE, async (payload, callback) => {
    try {
      const { title, description } = payload;

      const game = await gameService.createGame(user.id, {
        title,
        description,
      });

      console.log(`🎮 Game created via Socket: ${game.id} by ${user.username}`);

      // מחזירים לקליינט את הנתונים, כולל ה-streamId שהסרוויס יצר בטרנזקציה
      callback({
        success: true,
        gameId: game.id,
        streamId: game.streamId,
      });
    } catch (error) {
      console.error('Socket game:create error:', error);
      callback({
        error: ERROR_MESSAGES.GAME_CREATION_FAILED,
      });
    }
  });
  socket.on(SOCKET_EVENTS.GAME.PLACE_BET, async (payload) => {
    try {
      const { gameId, questionId, optionId, amount } = payload;
      const userId = socket.user.id;

      console.log(` Bet Received via Socket: User ${userId} on Game ${gameId}`);

      // עדכון ה-DB בטרנזקציה
      await prisma.$transaction([
        prisma.userAnswer.create({
          data: {
            userId,
            questionId,
            selectedOptionId: optionId,
            wager: amount,
          },
        }),
        prisma.user.update({
          where: { id: userId },
          data: { walletBalance: { decrement: amount } },
        }),
      ]);

      // שליפת הפונקציה ושידור העדכון לכולם
      const { syncUserBalances } = await import('../utils/balanceSync.js');
      await syncUserBalances(io, userId, gameId);
    } catch (error) {
      console.error('❌ Socket Bet Error:', error.message);
      socket.emit(SOCKET_EVENTS.SYSTEM.ERROR, {
        msg: ERROR_MESSAGES.BET_FAILED,
      });
    }
  });

  socket.on(SOCKET_EVENTS.GAME.STATUS_UPDATE, async (payload, callback) => {
    try {
      const { gameId, status } = payload;
      const userId = socket.user.id;

      const validStatuses = ['WAITING', 'ACTIVE', 'FINISHED'];

      if (!status || !validStatuses.includes(status.toUpperCase())) {
        return callback({
          error: ERROR_MESSAGES.INVALID_GAME_STATUS,
        });
      }

      const updatedGame = await gameService.updateGameStatus(
        gameId,
        userId,
        status.toUpperCase()
      );

      callback({ success: true, game: updatedGame });
    } catch (error) {
      console.error('Socket status update error:', error);
      callback({ error: ERROR_MESSAGES.FAILED_TO_UPDATE_STATUS });
    }
  });

  // ===== MODERATOR INVITATION HANDLERS =====
  const moderatorInvitations = new Map(); // gameId -> { moderatorId, hostId, timeout }

  socket.on(SOCKET_EVENTS.GAME.INVITE_MODERATOR, async (payload, callback) => {
    try {
      const { gameId, moderatorUserId } = payload;
      const hostId = socket.user.id;

      // 1. Verify host owns the game
      const game = await prisma.game.findUnique({
        where: { id: gameId },
      });

      if (!game) {
        return callback({ error: ERROR_MESSAGES.GAME_NOT_FOUND });
      }

      if (game.hostId !== hostId) {
        return callback({ error: ERROR_MESSAGES.HOST_ONLY_INVITE });
      }

      if (game.status !== 'WAITING') {
        return callback({ error: ERROR_MESSAGES.INVITE_ONLY_IN_WAITING });
      }

      // 2. Verify moderator exists
      const moderator = await prisma.user.findUnique({
        where: { id: moderatorUserId },
      });

      if (!moderator) {
        return callback({ error: ERROR_MESSAGES.MODERATOR_NOT_FOUND });
      }

      // 3. Check if moderator is already in game
      const existingParticipant = await prisma.gameParticipant.findUnique({
        where: {
          userId_gameId: {
            userId: moderatorUserId,
            gameId: gameId,
          },
        },
      });

      if (existingParticipant) {
        return callback({ error: ERROR_MESSAGES.MODERATOR_ALREADY_IN_GAME });
      }

      // 4. Create invitation and set 60-second timeout
      const invitationId = `inv_${Date.now()}`;
      let timeout;

      timeout = setTimeout(() => {
        // Auto-reject after 60 seconds
        moderatorInvitations.delete(gameId);

        const moderatorSocket = Array.from(io.sockets.sockets.values()).find(
          (s) => s.user?.id === moderatorUserId
        );

        if (moderatorSocket) {
          moderatorSocket.emit(SOCKET_EVENTS.GAME.MODERATOR_RESPONSE, {
            gameId,
            status: 'REJECTED',
            reason: 'timeout',
            timestamp: new Date(),
          });
        }

        // Notify host of timeout
        const hostSocket = io.sockets.sockets.get(socket.id);
        if (hostSocket) {
          hostSocket.emit(SOCKET_EVENTS.GAME.MODERATOR_RESPONSE, {
            gameId,
            status: 'REJECTED',
            reason: 'moderator_timeout',
            moderatorId: moderatorUserId,
            timestamp: new Date(),
          });
        }

        logger.info(
          `⏱️ Moderator invitation timeout for game ${gameId}, moderator ${moderatorUserId}`
        );
      }, 60000); // 60 seconds

      moderatorInvitations.set(gameId, {
        invitationId,
        moderatorId: moderatorUserId,
        hostId,
        timeout,
        createdAt: new Date(),
      });

      // 5. Emit invitation to moderator
      const moderatorSocket = Array.from(io.sockets.sockets.values()).find(
        (s) => s.user?.id === moderatorUserId
      );

      if (!moderatorSocket) {
        moderatorInvitations.delete(gameId);
        clearTimeout(timeout);
        return callback({ error: ERROR_MESSAGES.MODERATOR_OFFLINE });
      }

      moderatorSocket.emit(SOCKET_EVENTS.GAME.MODERATOR_INVITATION, {
        gameId,
        invitationId,
        hostId,
        hostName: socket.user.username,
        gameTitle: game.title,
        timeout: 60, // seconds
        timestamp: new Date(),
      });

      callback({ success: true, invitationId });

      logger.info(
        `✉️ Moderator invitation sent for game ${gameId} to ${moderator.username}`
      );
    } catch (error) {
      console.error('Socket invite moderator error:', error);
      callback({ error: ERROR_MESSAGES.FAILED_TO_PERFORM_MODERATION_ACTION });
    }
  });

  socket.on(SOCKET_EVENTS.GAME.ACCEPT_MODERATOR, async (payload, callback) => {
    try {
      const { gameId } = payload;
      const moderatorId = socket.user.id;

      // 1. Verify invitation exists
      const invitation = moderatorInvitations.get(gameId);

      if (!invitation) {
        return callback({
          error: ERROR_MESSAGES.INVITATION_NOT_FOUND_OR_EXPIRED,
        });
      }

      if (invitation.moderatorId !== moderatorId) {
        return callback({ error: ERROR_MESSAGES.INVITATION_MISMATCH });
      }

      // 2. Clear timeout
      clearTimeout(invitation.timeout);
      moderatorInvitations.delete(gameId);

      // 3. Create GameParticipant with MODERATOR role
      const participant = await prisma.gameParticipant.create({
        data: {
          gameId,
          userId: moderatorId,
          role: 'MODERATOR',
          score: 0,
        },
      });

      // 4. Join socket room
      socket.join(gameId);
      logger.socketJoin(socket.user, gameId);

      // 5. Broadcast update to game room
      io.to(gameId).emit(SOCKET_EVENTS.GAME.ROOM_UPDATE, {
        type: 'MODERATOR_ACCEPTED',
        userId: moderatorId,
        username: socket.user.username,
        avatarUrl: socket.user.avatarUrl,
        role: 'MODERATOR',
        timestamp: new Date(),
      });

      // 6. Notify host of acceptance
      const hostSocket = Array.from(io.sockets.sockets.values()).find(
        (s) => s.user?.id === invitation.hostId
      );

      if (hostSocket) {
        hostSocket.emit(SOCKET_EVENTS.GAME.MODERATOR_RESPONSE, {
          gameId,
          status: 'ACCEPTED',
          moderatorId,
          moderatorName: socket.user.username,
          timestamp: new Date(),
        });
      }

      callback({ success: true, participant });

      logger.info(
        `✅ Moderator ${socket.user.username} accepted invitation for game ${gameId}`
      );
    } catch (error) {
      console.error('Socket accept moderator error:', error);
      callback({ error: ERROR_MESSAGES.FAILED_TO_PERFORM_MODERATION_ACTION });
    }
  });

  socket.on(SOCKET_EVENTS.GAME.REJECT_MODERATOR, async (payload, callback) => {
    try {
      const { gameId } = payload;
      const moderatorId = socket.user.id;

      // 1. Verify invitation exists
      const invitation = moderatorInvitations.get(gameId);

      if (!invitation) {
        return callback({
          error: ERROR_MESSAGES.INVITATION_NOT_FOUND_OR_EXPIRED,
        });
      }

      if (invitation.moderatorId !== moderatorId) {
        return callback({ error: ERROR_MESSAGES.INVITATION_MISMATCH });
      }

      // 2. Clear timeout
      clearTimeout(invitation.timeout);
      moderatorInvitations.delete(gameId);

      // 3. Notify host of rejection
      const hostSocket = Array.from(io.sockets.sockets.values()).find(
        (s) => s.user?.id === invitation.hostId
      );

      if (hostSocket) {
        hostSocket.emit(SOCKET_EVENTS.GAME.MODERATOR_RESPONSE, {
          gameId,
          status: 'REJECTED',
          moderatorId,
          moderatorName: socket.user.username,
          reason: 'rejected_by_moderator',
          timestamp: new Date(),
        });
      }

      callback({ success: true });

      logger.info(
        `❌ Moderator ${socket.user.username} rejected invitation for game ${gameId}`
      );
    } catch (error) {
      console.error('Socket reject moderator error:', error);
      callback({ error: ERROR_MESSAGES.FAILED_TO_PERFORM_MODERATION_ACTION });
    }
  });
};
