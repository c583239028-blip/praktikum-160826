import express from 'express';
import { getPublicFeed } from '../controller/feed.controller.js';

const router = express.Router();

router.get('/public', getPublicFeed);

export default router;
