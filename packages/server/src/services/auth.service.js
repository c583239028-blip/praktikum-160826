// שכבת שירות לאימות — כל גישת ה-DB (Prisma) ו-bcrypt של register/login/socialLogin.
// ה-controller אחראי רק על ולידציית request, חתימת JWT ועיצוב תגובת ה-HTTP.
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma.js';

const MAX_USERNAME_LENGTH = 20;
const UID_FALLBACK_LENGTH = 8;

// מיפוי ספק Firebase לשדה הזיהוי המתאים במשתמש.
const PROVIDER_FIELD = {
  'google.com': 'googleId',
  'apple.com': 'appleId',
};

// שדות המשתמש הבטוחים לחשיפה החוצה (ללא password/isActive).
const USER_SELECT_FIELDS = {
  id: true,
  username: true,
  email: true,
  avatarUrl: true,
};

/**
 * שליפת משתמש לפי אימייל (לצורך בדיקת כפילות ברישום).
 * @returns {Promise<{ id: string } | null>}
 */
export const findUserByEmail = async (email) => {
  return prisma.user.findUnique({ where: { email } });
};

/**
 * יצירת משתמש חדש עם סיסמה מוצפנת (register).
 * @returns {Promise<object>} משתמש עם USER_SELECT_FIELDS בלבד.
 */
export const createUserWithPassword = async ({ username, email, password }) => {
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  return prisma.user.create({
    data: {
      username,
      email,
      password: hashedPassword,
      isActive: true,
    },
    select: USER_SELECT_FIELDS,
  });
};

/**
 * אימות מלא של התחברות באימייל+סיסמה (login).
 * מבצע שליפה, בדיקת isActive, השוואת bcrypt ועדכון lastActiveAt.
 * @returns {Promise<{ ok: true, user: object } | { ok: false, reason: string }>}
 *   reason ∈ 'INVALID_CREDENTIALS' | 'INACTIVE' | 'SOCIAL_ONLY'
 */
export const authenticateWithPassword = async ({ email, password }) => {
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
    return { ok: false, reason: 'INVALID_CREDENTIALS' };
  }

  if (!user.isActive) {
    return { ok: false, reason: 'INACTIVE' };
  }

  if (!user.password) {
    return { ok: false, reason: 'SOCIAL_ONLY' };
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    return { ok: false, reason: 'INVALID_CREDENTIALS' };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastActiveAt: new Date() },
  });

  // eslint-disable-next-line no-unused-vars
  const { password: _, isActive: __, ...safeUser } = user;
  return { ok: true, user: safeUser };
};

/**
 * מוצא/מעדכן/יוצר משתמש מתוך claims מאומתים של Firebase (socialLogin).
 * שומר על אותה סדר לוגי: התאמה לפי firebaseId, אחר כך לפי email, ולבסוף יצירה.
 * @param {object} decoded - ה-decoded token מ-admin.auth().verifyIdToken.
 * @returns {Promise<object>} משתמש עם USER_SELECT_FIELDS בלבד.
 */
export const upsertSocialUser = async (decoded) => {
  const { email, name, uid, picture } = decoded;
  const providerField = PROVIDER_FIELD[decoded.firebase?.sign_in_provider];

  let user = await prisma.user.findUnique({ where: { firebaseId: uid } });

  if (user) {
    return prisma.user.update({
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
  }

  if (email) {
    const existingByEmail = await prisma.user.findUnique({ where: { email } });

    if (existingByEmail) {
      return prisma.user.update({
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

  return prisma.user.create({
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
};
