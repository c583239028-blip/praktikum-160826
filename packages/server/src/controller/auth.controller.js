import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import admin from '../config/firebase.js';
import { ERROR_MESSAGES } from '@worldplay/shared';

const PROVIDER_FIELD = {
  'google.com': 'googleId',
  'apple.com': 'appleId',
};

const JWT_EXPIRY = '7d';
const MAX_USERNAME_LENGTH = 20;
const UID_FALLBACK_LENGTH = 8;

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error(ERROR_MESSAGES.JWT_SECRET_REQUIRED);

const USER_SELECT_FIELDS = {
  id: true,
  username: true,
  email: true,
  avatarUrl: true,
};

// Named Export: export const register
export const register = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res
        .status(400)
        .json({ message: ERROR_MESSAGES.EMAIL_ALREADY_REGISTERED });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = await prisma.user.create({
      data: {
        username,
        email,
        password: hashedPassword,
        isActive: true,
      },
      select: USER_SELECT_FIELDS,
    });

    const token = jwt.sign(
      { id: newUser.id, email: newUser.email },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );

    res.status(201).json({
      message: 'Registration successful',
      token,
      user: newUser,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: ERROR_MESSAGES.SERVER_ERROR_REGISTRATION });
  }
};

// Named Export: export const login
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { email },

      select: {
        id: true,
        username: true,
        avatarUrl: true,
        password: true,
        isActive: true,
      },
    });

    if (!user) {
      return res
        .status(400)
        .json({ message: ERROR_MESSAGES.INVALID_EMAIL_OR_PASSWORD });
    }

    if (!user.isActive) {
      return res.status(403).json({
        message: ERROR_MESSAGES.ACCOUNT_INACTIVE,
      });
    }

    if (user.password) {
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res
          .status(400)
          .json({ message: ERROR_MESSAGES.INVALID_EMAIL_OR_PASSWORD });
      }
    } else {
      return res
        .status(400)
        .json({ message: ERROR_MESSAGES.SIGN_IN_WITH_SOCIAL });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastActiveAt: new Date() },
    });

    const token = jwt.sign({ id: user.id, email: email }, JWT_SECRET, {
      expiresIn: JWT_EXPIRY,
    });

    // eslint-disable-next-line no-unused-vars
    const { password: _, isActive: __, ...safeUser } = user;

    res.json({
      message: 'Login successful',
      token,
      user: safeUser,
    });
  } catch (error) {
    console.error(error);
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
      console.error(
        '[socialLogin] Firebase verify error:',
        firebaseError.code,
        firebaseError.message
      );

      return res.status(401).json({
        message: ERROR_MESSAGES.INVALID_FIREBASE_TOKEN,
      });
    }
    let email, name, uid, picture;
    ({ email, name, uid, picture } = decoded);
    const providerField = PROVIDER_FIELD[decoded.firebase?.sign_in_provider];

    let user = await prisma.user.findUnique({ where: { firebaseId: uid } });

    if (user) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          lastActiveAt: new Date(),
          // Firebase omits `picture` for some providers (e.g. Apple) or after
          // a token refresh where the photo wasn't re-supplied. Conditional
          // spread avoids overwriting an existing avatarUrl with nothing.
          ...(picture && { avatarUrl: picture }),
          ...(email && { email }),
          ...(providerField && { [providerField]: uid }),
        },
        select: USER_SELECT_FIELDS,
      });
    } else if (email) {
      const existingByEmail = await prisma.user.findUnique({
        where: { email },
      });

      if (existingByEmail) {
        user = await prisma.user.update({
          where: { id: existingByEmail.id },
          data: {
            firebaseId: uid,
            lastActiveAt: new Date(),
            ...(picture && { avatarUrl: picture }),
            ...(providerField && { [providerField]: uid }),
          },
          select: USER_SELECT_FIELDS,
        });
      }
    }

    if (!user) {
      user = await prisma.user.create({
        data: {
          firebaseId: uid,
          avatarUrl: picture ?? null,
          email: email ?? `${uid}@noemail.firebase`,
          username:
            name?.replace(/\s+/g, '').slice(0, MAX_USERNAME_LENGTH) ||
            email?.split('@')[0] ||
            `User_${uid.slice(0, UID_FALLBACK_LENGTH)}`,
          isActive: true,
          ...(providerField && { [providerField]: uid }),
        },
        select: USER_SELECT_FIELDS,
      });
    }

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
      },
      JWT_SECRET,
      {
        expiresIn: JWT_EXPIRY,
      }
    );

    return res.status(200).json({
      message: 'Social login successful',
      token,
      user,
    });
  } catch (err) {
    console.error(
      '[socialLogin] failed for uid:',
      decoded?.uid ?? 'unknown',
      err.message
    );
    res.status(500).json({ message: ERROR_MESSAGES.AUTHENTICATION_ERROR });
  }
};
