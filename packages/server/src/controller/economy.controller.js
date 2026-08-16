import economyService from '../services/economy.service.js';
import { syncUserBalances } from '../utils/socketHelpers.js';
import { ERROR_MESSAGES } from '@worldplay/shared';

const economyController = {
  async sendGift(req, res) {
    try {
      const senderId = req.user.id;
      const { receiverPlayerId, moderatorId, giftValue, gameId } = req.body;

      // Reject an explicit mismatch instead of silently overriding it — surfaces IDOR attempts and client bugs rather than masking them.
      if (req.body.senderId !== undefined && req.body.senderId !== senderId) {
        return res.status(403).json({
          status: 'error',
          message: ERROR_MESSAGES.SENDER_ID_MISMATCH,
        });
      }

      const result = await economyService.sendGift(
        senderId,
        receiverPlayerId,
        moderatorId,
        giftValue,
        gameId
      );

      // סנכרון Real-time לכל הצדדים
      const io = req.app.get('io');
      if (io) {
        await syncUserBalances(io, senderId, gameId);
        await syncUserBalances(io, receiverPlayerId, gameId);
        await syncUserBalances(io, moderatorId, gameId);
      }

      res.status(200).json({ status: 'success', data: result });
    } catch (error) {
      res.status(400).json({ status: 'error', message: error.message });
    }
  },
};

export default economyController;
