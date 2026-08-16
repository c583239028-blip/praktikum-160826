// packages/shared/src/constants/participantRoles.js
// מקור-האמת בפועל הוא enum Prisma UserRole (packages/server/prisma/schema.prisma).
// כל שינוי כאן חייב להישאר מסונכרן איתו.
export const PARTICIPANT_ROLES = {
  HOST: 'HOST',
  PLAYER: 'PLAYER',
  MODERATOR: 'MODERATOR',
  VIEWER: 'VIEWER',
};
