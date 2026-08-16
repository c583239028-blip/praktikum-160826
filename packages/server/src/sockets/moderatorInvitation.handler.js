import {
  SOCKET_EVENTS,
  ERROR_MESSAGES,
  MIN_VIEWERS_FOR_MODERATOR,
  INSUFFICIENT_VIEWERS_CODE,
  MODERATOR_RESPONSE_STATUS,
  MODERATOR_RESPONSE_REASON,
  ROOM_UPDATE_TYPE,
} from '@worldplay/shared';
import { UserRole } from '@prisma/client';
import { logger } from '@worldplay/shared';
import prisma from '../lib/prisma.js';
import streamService from '../services/stream.service.js';

// ===== MODERATOR INVITATION HANDLERS =====
const moderatorInvitations = new Map(); // gameId -> { moderatorId, hostId, timeout }

export const registerModeratorInvitationHandlers = (io, socket) => {
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
        return callback({
          error: ERROR_MESSAGES.HOST_ONLY_CAN_INVITE_MODERATOR,
        });
      }

      if (game.status !== 'WAITING') {
        return callback({
          error: ERROR_MESSAGES.CAN_ONLY_INVITE_MODERATOR_WHEN_WAITING,
        });
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
        return callback({
          error: ERROR_MESSAGES.MODERATOR_ALREADY_IN_GAME,
        });
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
            status: MODERATOR_RESPONSE_STATUS.REJECTED,
            reason: MODERATOR_RESPONSE_REASON.TIMEOUT,
            timestamp: new Date(),
          });
        }

        // Notify host of timeout
        const hostSocket = io.sockets.sockets.get(socket.id);
        if (hostSocket) {
          hostSocket.emit(SOCKET_EVENTS.GAME.MODERATOR_RESPONSE, {
            gameId,
            status: MODERATOR_RESPONSE_STATUS.REJECTED,
            reason: MODERATOR_RESPONSE_REASON.MODERATOR_TIMEOUT,
            moderatorId: moderatorUserId,
            timestamp: new Date(),
          });
        }

        logger.info(
          `Moderator invitation timeout for game ${gameId}, moderator ${moderatorUserId}`
        );
      }, 60000); // 60 seconds

      const existingInvitation = moderatorInvitations.get(gameId);
      if (existingInvitation) {
        clearTimeout(existingInvitation.timeout);
      }

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
        return callback({
          error: ERROR_MESSAGES.MODERATOR_NOT_CONNECTED,
        });
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
        `Moderator invitation sent for game ${gameId} to ${moderator.username}`
      );
    } catch (error) {
      logger.error('Socket invite moderator error:', error.message);
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
        return callback({
          error: ERROR_MESSAGES.INVITATION_NOT_FOR_YOU,
        });
      }

      // 2. Gate: block moderator join if not enough live viewers yet.
      // The invitation's 60-second timeout is intentionally NOT cleared
      // here — per client-side requirement, an invitation must always
      // expire exactly 60s after creation, regardless of how many blocked
      // accept-attempts happen in between. Only a terminal outcome below
      // (game no longer exists, or the gate passes and the moderator
      // actually joins) consumes the invitation early.
      const game = await prisma.game.findUnique({
        where: { id: gameId },
        select: { streamId: true },
      });

      if (!game) {
        clearTimeout(invitation.timeout);
        moderatorInvitations.delete(gameId);
        return callback({ error: ERROR_MESSAGES.GAME_NOT_FOUND });
      }

      const currentViewers = await streamService.getViewerCount(game.streamId);

      if (currentViewers < MIN_VIEWERS_FOR_MODERATOR) {
        // Blocked, but the invitation stays alive: don't touch the
        // timeout or the map. The moderator can retry until the viewer
        // count rises, or until the original 60s timeout fires on its own.
        return callback({
          error: ERROR_MESSAGES.INSUFFICIENT_VIEWERS_FOR_MODERATOR,
          code: INSUFFICIENT_VIEWERS_CODE,
          current: currentViewers,
          required: MIN_VIEWERS_FOR_MODERATOR,
        });
      }

      clearTimeout(invitation.timeout);
      moderatorInvitations.delete(gameId);

      // 3. Create GameParticipant with MODERATOR role
      const participant = await prisma.gameParticipant.create({
        data: {
          gameId,
          userId: moderatorId,
          role: UserRole.MODERATOR,
          score: 0,
        },
      });

      // 4. Join socket room
      socket.join(gameId);
      logger.socketJoin(socket.user, gameId);

      // 5. Broadcast update to game room
      io.to(gameId).emit(SOCKET_EVENTS.GAME.ROOM_UPDATE, {
        type: ROOM_UPDATE_TYPE.MODERATOR_ACCEPTED,
        userId: moderatorId,
        username: socket.user.username,
        avatarUrl: socket.user.avatarUrl,
        role: UserRole.MODERATOR,
        timestamp: new Date(),
      });

      // 6. Notify host of acceptance
      const hostSocket = Array.from(io.sockets.sockets.values()).find(
        (s) => s.user?.id === invitation.hostId
      );

      if (hostSocket) {
        hostSocket.emit(SOCKET_EVENTS.GAME.MODERATOR_RESPONSE, {
          gameId,
          status: MODERATOR_RESPONSE_STATUS.ACCEPTED,
          moderatorId,
          moderatorName: socket.user.username,
          timestamp: new Date(),
        });
      }

      callback({ success: true, participant });

      logger.info(
        `Moderator ${socket.user.username} accepted invitation for game ${gameId}`
      );
    } catch (error) {
      logger.error('Socket accept moderator error:', error.message);
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
        return callback({
          error: ERROR_MESSAGES.INVITATION_NOT_FOR_YOU,
        });
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
          status: MODERATOR_RESPONSE_STATUS.REJECTED,
          moderatorId,
          moderatorName: socket.user.username,
          reason: MODERATOR_RESPONSE_REASON.REJECTED_BY_MODERATOR,
          timestamp: new Date(),
        });
      }

      callback({ success: true });

      logger.info(
        `Moderator ${socket.user.username} rejected invitation for game ${gameId}`
      );
    } catch (error) {
      logger.error('Socket reject moderator error:', error.message);
      callback({ error: ERROR_MESSAGES.FAILED_TO_PERFORM_MODERATION_ACTION });
    }
  });
};
