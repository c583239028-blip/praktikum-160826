import express from 'express';
import { register, login, socialLogin } from '../controller/auth.controller.js';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/social', socialLogin);

export default router;
