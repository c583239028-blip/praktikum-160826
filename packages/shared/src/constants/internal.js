// packages/shared/src/constants/internal.js
// Contract for the app-server -> media-server service-to-service channel
// (see moderationSocket.js / internalAuth.js / internal.routes.js). Kept in
// one place so a rename on either side fails loudly instead of 401-ing.

const MOUNT_PATH = '/internal';
const MODERATION_PATH = '/moderation';

export const INTERNAL_API = {
  HEADER_SECRET: 'x-internal-secret',
  MOUNT_PATH,
  MODERATION_PATH,
  MODERATION_BASE_PATH: `${MOUNT_PATH}${MODERATION_PATH}`,
};
