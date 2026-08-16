// נתיבי מודרציה — דיווח, השתקה/ביטול השתקה, הרחקה, והנגשת משחקים תחת מעקב לצוות
import express from 'express';
import moderationController from '../controller/moderation.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { requireStaff } from '../middleware/role.middleware.js';

const router = express.Router();

router.use(authenticateToken);

router.post('/:id/report', moderationController.report);
router.post('/:id/mute', moderationController.mute);
router.post('/:id/unmute', moderationController.unmute);
router.post('/:id/kick', moderationController.kick);

router.get(
  '/under-review',
  requireStaff,
  moderationController.getGamesUnderReview
);

export default router;
