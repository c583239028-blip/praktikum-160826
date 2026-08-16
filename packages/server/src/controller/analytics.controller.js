import { ERROR_MESSAGES, logger } from '@worldplay/shared';
import analyticsService from '../services/analytics.service.js';
export const reportAnalytics = async (req, res) => {
  try {
    const userId = req.user.id;
    const reportData = req.body;

    const newLog = await analyticsService.createViewLog(userId, reportData);

    res.status(201).json({
      message: 'Analytics reported successfully',
      log: newLog,
    });
  } catch (error) {
    logger.error('Error reporting analytics:', error);
    res.status(500).json({ error: ERROR_MESSAGES.FAILED_TO_REPORT_ANALYTICS });
  }
};
