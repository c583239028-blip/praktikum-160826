// middleware לבדיקת הרשאות לפי תפקיד מערכתי (SystemRole)
import { SystemRole } from '@prisma/client';

export const requireStaff = (req, res, next) => {
  if (
    req.user.role !== SystemRole.STAFF &&
    req.user.role !== SystemRole.ADMIN
  ) {
    return res.status(403).json({ error: 'Access denied: staff only' });
  }
  next();
};
