import prisma from '../lib/prisma.js';
import { UserRole } from '@prisma/client';
import {
  JoinGameSchema,
  ResolveQuestionSchema,
  SOCKET_EVENTS,
  ERROR_MESSAGES,
  ROOM_UPDATE_TYPE,
  JOIN_ELIGIBILITY_STATUS,
  formatMessage,
} from '@worldplay/shared';
import { GameStatus } from '@prisma/client';
import { logger } from '@worldplay/shared';
import * as gameRules from '../services/validation.service.js';
import gameService from '../services/game.service.js';
import userAnswerService from '../services/userAnswer.service.js';
import { registerModeratorInvitationHandlers } from './moderatorInvitation.handler.js';

export const registerGameHandlers = (io, socket) => {
  const user = socket.user;

  // ---אירוע: הצטרפות לחדר ---
  socket.on(SOCKET_EVENTS.GAME.JOIN, async (payload) => {
    const validationResult = JoinGameSchema.safeParse(payload);

    if (!validationResult.success) {
      const username = user?.username || 'Unknown/Guest';

      logger.warn(
        `Validation failed for user ${username}: ${JSON.stringify(validationResult.error.format())}`
      );
      socket.emit(SOCKET_EVENTS.SYSTEM.ERROR, {
        msg: ERROR_MESSAGES.INVALID_DATA_FORMAT,
        details: validationResult.error.format(),
      });
      return;
    }

    const { gameId, role } = validationResult.data;

    if (socket.rooms.has(gameId)) {
      logger.info(`User ${user.username} is already in socket room ${gameId}`);
      socket.emit(SOCKET_EVENTS.SYSTEM.SYSTEM_MESSAGE, {
        msg: ERROR_MESSAGES.ALREADY_CONNECTED_TO_ROOM,
      });
      return;
    }

    try {
      const validation = await gameRules.validateJoinEligibility(
        gameId,
        user.id,
        role || UserRole.VIEWER
      );

      if (validation.status === JOIN_ELIGIBILITY_STATUS.ALREADY_JOINED) {
        socket.join(gameId);
        logger.socketJoin(user, gameId);
        socket.emit(SOCKET_EVENTS.SYSTEM.SYSTEM_MESSAGE, {
          msg: formatMessage(ERROR_MESSAGES.WELCOME_BACK_TO_GAME, { gameId }),
        });
        return;
      }

      await prisma.gameParticipant.create({
        data: {
          gameId: gameId,
          userId: user.id,
          role: role || UserRole.VIEWER,
          score: 0,
        },
      });

      socket.join(gameId);
      logger.socketJoin(user, gameId);

      socket.emit(SOCKET_EVENTS.SYSTEM.SYSTEM_MESSAGE, {
        msg: formatMessage(ERROR_MESSAGES.SUCCESSFULLY_JOINED_GAME, { role }),
      });

      io.to(gameId).emit(SOCKET_EVENTS.GAME.ROOM_UPDATE, {
        type: ROOM_UPDATE_TYPE.USER_JOINED,
        userId: user.id,
        username: user.username,
        avatarUrl: user.avatarUrl,
        role: role,
        timestamp: new Date(),
      });
    } catch (error) {
      logger.error(`Join Room Failed for ${user.username}`, error.message);
      socket.emit(SOCKET_EVENTS.SYSTEM.ERROR, {
        msg: ERROR_MESSAGES.FAILED_TO_JOIN_GAME,
      });
    }
  });
  // הצטרפות הצופה לחדר הסטרים על ה-app io — מישור השאלות/סטטוס בלבד.
  // לא game room, ולא נגיעה במישור המדיה (mediasoup). ראה 230.
  socket.on(SOCKET_EVENTS.STREAM.WATCH, ({ streamId }, callback) => {
    if (streamId) socket.join(streamId);
    callback?.();
  });

  socket.on(SOCKET_EVENTS.GAME.CREATE, async (payload, callback) => {
    try {
      const { title, description } = payload;

      const game = await gameService.createGame(user.id, {
        title,
        description,
      });

      logger.info(`Game created via Socket: ${game.id} by ${user.username}`);

      callback({
        success: true,
        gameId: game.id,
        streamId: game.streamId,
      });
    } catch (error) {
      logger.error('Socket game:create error:', error.message);
      callback({ error: ERROR_MESSAGES.FAILED_TO_CREATE_GAME });
    }
  });

  socket.on(SOCKET_EVENTS.GAME.PLACE_BET, async (payload) => {
    try {
      const { gameId, questionId, optionId, amount } = payload;
      const userId = socket.user.id;

      logger.info(`Bet Received via Socket: User ${userId} on Game ${gameId}`);

      await userAnswerService.submitAnswer(io, userId, {
        questionId,
        selectedOptionId: optionId,
        wager: amount,
      });
    } catch (error) {
      logger.error('Socket Bet Error:', error.message);
      socket.emit(SOCKET_EVENTS.SYSTEM.ERROR, {
        msg: ERROR_MESSAGES.BET_FAILED,
      });
    }
  });

  socket.on(SOCKET_EVENTS.GAME.STATUS_UPDATE, async (payload, callback) => {
    try {
      const { gameId, status } = payload;
      const userId = socket.user.id;

      const validStatuses = Object.values(GameStatus);

      if (!status || !validStatuses.includes(status.toUpperCase())) {
        return callback({
          error: formatMessage(ERROR_MESSAGES.INVALID_STATUS_ALLOWED_VALUES, {
            values: validStatuses.join(', '),
          }),
        });
      }

      const updatedGame = await gameService.updateGameStatus(
        gameId,
        userId,
        status.toUpperCase()
      );

      callback({ success: true, game: updatedGame });
    } catch (error) {
      logger.error('Socket status update error:', error.message);
      callback({ error: ERROR_MESSAGES.FAILED_TO_UPDATE_STATUS });
    }
  });

  // ===== RESOLVE QUESTION — the moderator closes a question and results are broadcast =====
  socket.on(SOCKET_EVENTS.GAME.RESOLVE_QUESTION, async (payload, callback) => {
    try {
      const validationResult = ResolveQuestionSchema.safeParse(payload);

      if (!validationResult.success) {
        return callback?.({
          error: ERROR_MESSAGES.INVALID_DATA_FORMAT,
          details: validationResult.error.format(),
        });
      }

      const { gameId, questionId } = validationResult.data;
      const moderatorId = user.id;

      const results = await gameService.resolveQuestion(
        gameId,
        questionId,
        moderatorId
      );

      for (const { userId, type } of results) {
        io.to(userId).emit(SOCKET_EVENTS.GAME.QUESTION_RESULT, {
          questionId,
          type,
        });
      }

      callback?.({ success: true, resolvedCount: results.length });
    } catch (error) {
      logger.error('Socket resolve question error:', error.message);
      // Generic constant, not error.message — consistent with the other
      // handlers in this file (INVITE/ACCEPT/REJECT_MODERATOR), and avoids
      // leaking internal error text to the client.
      callback?.({ error: ERROR_MESSAGES.FAILED_TO_PERFORM_MODERATION_ACTION });
    }
  });

  registerModeratorInvitationHandlers(io, socket);
};
