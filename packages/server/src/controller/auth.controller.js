import jwt from 'jsonwebtoken';
import admin from '../config/firebase.js';
import { ERROR_MESSAGES, logger } from '@worldplay/shared';
import {
  findUserByEmail,
  createUserWithPassword,
  authenticateWithPassword,
  upsertSocialUser,
} from '../services/auth.service.js';

const JWT_EXPIRY = '7d';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error(ERROR_MESSAGES.JWT_SECRET_REQUIRED);

const signToken = (id, email) =>
  jwt.sign({ id, email }, JWT_SECRET, { expiresIn: JWT_EXPIRY });

// Named Export: export const register
export const register = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      return res
        .status(400)
        .json({ message: ERROR_MESSAGES.EMAIL_ALREADY_REGISTERED });
    }

    const newUser = await createUserWithPassword({ username, email, password });

    const token = signToken(newUser.id, newUser.email);

    res.status(201).json({
      message: 'Registration successful',
      token,
      user: newUser,
    });
  } catch (error) {
    logger.error('Registration error:', error);
    res.status(500).json({ message: ERROR_MESSAGES.SERVER_ERROR_REGISTRATION });
  }
};

// Named Export: export const login
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await authenticateWithPassword({ email, password });

    if (!result.ok) {
      if (result.reason === 'INACTIVE') {
        return res
          .status(403)
          .json({ message: ERROR_MESSAGES.ACCOUNT_INACTIVE });
      }
      if (result.reason === 'SOCIAL_ONLY') {
        return res
          .status(400)
          .json({ message: ERROR_MESSAGES.SIGN_IN_WITH_SOCIAL });
      }
      return res
        .status(400)
        .json({ message: ERROR_MESSAGES.INVALID_EMAIL_OR_PASSWORD });
    }

    const token = signToken(result.user.id, email);

    res.json({
      message: 'Login successful',
      token,
      user: result.user,
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({ message: ERROR_MESSAGES.SERVER_ERROR_LOGIN });
  }
};

export const socialLogin = async (req, res) => {
  let decoded;
  try {
    const { firebaseToken } = req.body;

    if (!firebaseToken) {
      return res
        .status(400)
        .json({ message: ERROR_MESSAGES.FIREBASE_TOKEN_REQUIRED });
    }

    try {
      decoded = await admin.auth().verifyIdToken(firebaseToken);
    } catch (firebaseError) {
      logger.error(
        '[socialLogin] Firebase verify error:',
        `${firebaseError.code} ${firebaseError.message}`
      );

      return res.status(401).json({
        message: ERROR_MESSAGES.INVALID_FIREBASE_TOKEN,
      });
    }

    const user = await upsertSocialUser(decoded);

    const token = signToken(user.id, user.email);

    return res.status(200).json({
      message: 'Social login successful',
      token,
      user,
    });
  } catch (err) {
    logger.error(
      '[socialLogin] failed for uid:',
      `${decoded?.uid ?? 'unknown'} ${err.message}`
    );
    res.status(500).json({ message: ERROR_MESSAGES.AUTHENTICATION_ERROR });
  }
};
