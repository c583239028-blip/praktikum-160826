// Service-to-service routes only — mounted behind internalAuth in index.js.
// Never exposed to client sockets. Routing + middleware only, no business
// logic — see controller/internalModeration.controller.js.
import express from 'express';
import { INTERNAL_API } from '@worldplay/shared';
import internalModerationController from '../controller/internalModeration.controller.js';

const router = express.Router();

router.post(
  `${INTERNAL_API.MODERATION_PATH}/mute`,
  internalModerationController.mute
);
router.post(
  `${INTERNAL_API.MODERATION_PATH}/unmute`,
  internalModerationController.unmute
);

export default router;
