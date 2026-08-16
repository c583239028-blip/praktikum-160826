// אימות JWT לחיבורי Socket.IO — משותף ל-server ול-media-server (SCRUM-351, ממצא M11-01).
// שני החבילות היו מחזיקות עותק זהה שורה-בשורה של הלוגיקה הזו; ההבדל היחיד
// ביניהן היה avatarUrl ב-select, ולכן הוא הועבר לפרמטר includeAvatarUrl.
//
// מוגדר כ-factory (לא כמידלוור קבוע) כי לכל חבילה יש instance נפרד של
// PrismaClient משלה — shared לא תלויה ב-@prisma/client, ולכן ה-prisma
// מוזרק מבחוץ ולא נוצר כאן.
import jwt from 'jsonwebtoken';
import { ERROR_MESSAGES } from '../constants/errors.js';

export const createSocketAuth = ({ prisma, includeAvatarUrl = false }) => {
  return async (socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.headers.token;

    if (!token) {
      return next(new Error(ERROR_MESSAGES.NOT_AUTHORIZED_NO_TOKEN));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: {
          id: true,
          username: true,
          role: true,
          isActive: true,
          ...(includeAvatarUrl && { avatarUrl: true }),
        },
      });

      if (!user)
        return next(new Error(ERROR_MESSAGES.NOT_AUTHORIZED_USER_NOT_FOUND));
      if (!user.isActive)
        return next(new Error(ERROR_MESSAGES.NOT_AUTHORIZED_USER_BANNED));

      socket.user = user;
      next();
    } catch {
      return next(new Error(ERROR_MESSAGES.NOT_AUTHORIZED_INVALID_TOKEN));
    }
  };
};
