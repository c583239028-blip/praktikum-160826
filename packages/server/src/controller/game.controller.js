// ניהול מחזור חיי המשחק — יצירה, הצטרפות, עדכון סטטוס, פיד והיסטוריה
import gameService from '../services/game.service.js';
import { ERROR_MESSAGES, SOCKET_EVENTS, logger } from '@worldplay/shared';

const gameController = {
  async createGame(req, res) {
    try {
      const userId = req.user.id;
      const { title, description, moderatorId, gameType } = req.body;

      if (!title) {
        return res.status(400).json({
          error: ERROR_MESSAGES.TITLE_REQUIRED,
        });
      }

      const validTypes = ['CLOSE_UP', 'REMOTE'];
      if (
        !gameType ||
        typeof gameType !== 'string' ||
        !validTypes.includes(gameType.toUpperCase())
      ) {
        return res.status(400).json({
          error: `${ERROR_MESSAGES.INVALID_GAME_TYPE}. Allowed values: ${validTypes.join(', ')}`,
        });
      }

      const normalizedGameType = gameType.toUpperCase();

      const game = await gameService.createGame(userId, {
        title,
        description,
        moderatorId,
        gameType: normalizedGameType,
      });

      res.status(201).json({ message: 'Game created successfully', game });
    } catch (error) {
      logger.error('Create Game Error:', error);

      // שגיאת מפתח זר ב-Prisma (P2003)
      if (error.code === 'P2003') {
        const fieldName = error.meta?.field_name || '';

        if (fieldName.includes('moderator_id')) {
          return res
            .status(404)
            .json({ error: ERROR_MESSAGES.MODERATOR_NOT_FOUND });
        }
      }

      res.status(500).json({ error: ERROR_MESSAGES.ERROR_CREATING_GAME });
    }
  },

  async updateStatus(req, res) {
    try {
      const { id } = req.params;
      let statusValue = req.body.status || req.body.newStatus;
      const userId = req.user.id;

      const validStatuses = ['WAITING', 'ACTIVE', 'FINISHED'];

      if (statusValue) statusValue = statusValue.trim().toUpperCase();

      if (!statusValue || !validStatuses.includes(statusValue)) {
        return res.status(400).json({
          error: `${ERROR_MESSAGES.INVALID_STATUS}. Allowed values: ${validStatuses.join(', ')}`,
        });
      }

      const updatedGame = await gameService.updateGameStatus(
        id,
        userId,
        statusValue
      );

      const io = req.app.get('io');
      if (io) {
        io.emit(SOCKET_EVENTS.GAME.STATUS_UPDATE, {
          gameId: id,
          status: statusValue,
        });
        // PROD
        logger.info(
          ` Broadcasted status update for game ${id}: ${statusValue}`
        );
      }
      res.status(200).json({
        message: 'Game status updated successfully',
        game: updatedGame,
      });
    } catch (error) {
      logger.error('Update Status Error:', error);
      res.status(500).json({ error: ERROR_MESSAGES.ERROR_UPDATING_STATUS });
    }
  },

  async joinGame(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const { role } = req.body;
      const validRoles = ['PLAYER', 'VIEWER', 'MODERATOR', 'HOST'];
      const assignedRole = role && validRoles.includes(role) ? role : 'PLAYER';

      const result = await gameService.joinGame(id, userId, assignedRole);

      if (result.alreadyJoined) {
        return res.status(200).json({
          message: 'User is already registered for this game',
          participant: result.participant,
        });
      }

      res.status(201).json({
        message: 'Successfully joined the game!',
        participant: result.participant,
      });
    } catch (error) {
      logger.error('Join Game Error:', error);

      if (error.message === ERROR_MESSAGES.GAME_NOT_FOUND) {
        return res.status(404).json({ error: ERROR_MESSAGES.GAME_NOT_FOUND });
      }
      if (error.message.includes(ERROR_MESSAGES.UNAUTHORIZED)) {
        return res.status(403).json({ error: error.message });
      }
      if (
        error.message.includes('Conflict') ||
        error.message.includes('already playing') ||
        error.message.includes('already has a HOST')
      ) {
        return res.status(409).json({ error: error.message });
      }

      if (error.message.includes('Cannot join')) {
        return res.status(400).json({ error: error.message });
      }

      res.status(500).json({ error: ERROR_MESSAGES.ERROR_JOINING_GAME });
    }
  },

  async getFeed(req, res) {
    try {
      const userId = req.user.id;
      const feed = await gameService.getFollowedFeed(userId);
      res.status(200).json({ success: true, data: feed });
    } catch (error) {
      logger.error('Feed Error:', error);
      res.status(500).json({ error: ERROR_MESSAGES.ERROR_LOADING_FEED });
    }
  },

  async getHistory(req, res) {
    try {
      const userId = req.user.id;
      const data = await gameService.getGameHistory(userId);
      res.status(200).json({ success: true, data });
    } catch (error) {
      logger.error('Get History Error:', error);
      res.status(500).json({ error: ERROR_MESSAGES.INTERNAL_PROCESSING_ERROR });
    }
  },

  async togglePin(req, res) {
    try {
      const userId = req.user.id;
      const { gameId } = req.params;
      const data = await gameService.togglePin(userId, gameId);
      res.status(200).json({ success: true, data });
    } catch (error) {
      logger.error('Toggle Pin Error:', error);
      if (error.message === ERROR_MESSAGES.ACTIVITY_NOT_FOUND) {
        return res
          .status(404)
          .json({ error: ERROR_MESSAGES.GAME_NOT_FOUND_IN_HISTORY });
      }
      res.status(500).json({ error: ERROR_MESSAGES.INTERNAL_PROCESSING_ERROR });
    }
  },

  async getGameViewers(req, res) {
    try {
      const { gameId } = req.params;
      const userId = req.user.id;
      const data = await gameService.getGameViewers(gameId, userId);
      res.status(200).json({ success: true, data });
    } catch (error) {
      logger.error('Get Game Viewers Error:', error);
      res.status(500).json({ error: ERROR_MESSAGES.INTERNAL_PROCESSING_ERROR });
    }
  },

  async getParticipants(req, res) {
    try {
      const { gameId } = req.params;
      const data = await gameService.getGameParticipants(gameId, req.user.id);
      res.status(200).json({ success: true, data });
    } catch (error) {
      logger.error('Get Participants Error:', error);
      if (error.message === ERROR_MESSAGES.GAME_NOT_FOUND) {
        return res.status(404).json({ error: ERROR_MESSAGES.GAME_NOT_FOUND });
      }
      if (error.message === ERROR_MESSAGES.UNAUTHORIZED) {
        return res
          .status(403)
          .json({ error: ERROR_MESSAGES.UNAUTHORIZED_VIEW_PARTICIPANTS });
      }
      if (error.code === 'P2023') {
        return res.status(400).json({ error: ERROR_MESSAGES.INVALID_GAME_ID });
      }
      res
        .status(500)
        .json({ error: ERROR_MESSAGES.ERROR_LOADING_PARTICIPANTS });
    }
  },
};

export default gameController;
