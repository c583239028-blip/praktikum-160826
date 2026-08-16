// src/utils/logger.js
//
// logger משותף לכל החבילות (server / media-server / client).
// ה-API זהה ל-loggers המקומיים הקיימים כדי שההגירה תהיה 1:1.
//
// environment-aware:
//  - ב-Node (server/media): צבעי ANSI, פלט זהה ל-logger הקיים.
//  - ב-client (React Native): בלי קודי ANSI (אחרת ג׳יבריש בקונסולת RN),
//    ו-gated ל-__DEV__ כדי לא לזהם פרודקשן.

// Node חושף את process.versions.node; React Native / Metro לא.
const isNode =
  typeof process !== 'undefined' &&
  process.versions != null &&
  process.versions.node != null;

// __DEV__ הוא גלובל שמוזרק ע"י Metro בקליינט (RN), ולא קיים ב-Node.
/* global __DEV__ */
// בקליינט מדפיסים רק ב-dev; ב-Node תמיד מדפיסים (התנהגות זהה ללוגר הקיים).
const devEnabled = typeof __DEV__ === 'undefined' ? true : __DEV__;
const isEnabled = isNode || devEnabled;

// צבעי ANSI רלוונטיים רק לטרמינל של Node. בקונסולת RN הם מוצגים כג׳יבריש,
// לכן בקליינט הצבעים ריקים והפלט נקי.
const COLORS = isNode
  ? {
      reset: '\x1b[0m',
      green: '\x1b[32m',
      blue: '\x1b[34m',
      yellow: '\x1b[33m',
      red: '\x1b[31m',
      cyan: '\x1b[36m',
    }
  : { reset: '', green: '', blue: '', yellow: '', red: '', cyan: '' };

// קבלת שעה נוכחית בפורמט קריא
const getTimestamp = () => new Date().toLocaleTimeString();

export const logger = {
  system: (msg) => {
    if (!isEnabled) return;
    console.log(
      `${COLORS.cyan}[SYSTEM ${getTimestamp()}]${COLORS.reset} ${msg}`
    );
  },

  info: (msg) => {
    if (!isEnabled) return;
    console.log(`${COLORS.blue}[INFO]${COLORS.reset} ${msg}`);
  },

  success: (msg) => {
    if (!isEnabled) return;
    console.log(`${COLORS.green}[SUCCESS]${COLORS.reset}  ${msg}`);
  },

  error: (msg, error = '') => {
    if (!isEnabled) return;
    console.error(
      `${COLORS.red}[ERROR ${getTimestamp()}]${COLORS.reset}  ${msg}`,
      error
    );
  },

  warn: (msg) => {
    if (!isEnabled) return;
    console.warn(
      `${COLORS.yellow}[WARN ${getTimestamp()}]${COLORS.reset} ${msg}`
    );
  },

  // --- לוגים ספציפיים לסוקט ---

  socketConnect: (user, socketId) => {
    if (!isEnabled) return;
    const username = user?.username || 'Guest'; // אם אין יוזר, נקרא לו Guest
    const role = user?.role || 'UNKNOWN';

    console.log(
      `${COLORS.green}[SOCKET CONNECT]${COLORS.reset} User: ${COLORS.yellow}${username}${COLORS.reset} (Role: ${role}) | ID: ${socketId}`
    );
  },

  socketDisconnect: (user, socketId, reason) => {
    if (!isEnabled) return;
    const username = user ? user.username : 'Unknown';
    console.log(
      `${COLORS.red}[SOCKET DISCONNECT]${COLORS.reset} User: ${username} | ID: ${socketId} | Reason: ${reason}`
    );
  },

  socketAction: (user, action, details = '') => {
    if (!isEnabled) return;
    // עמידות ל-user חסר, עקבי עם socketConnect/socketDisconnect.
    const username = user?.username || 'Unknown';
    console.log(
      `${COLORS.blue}[SOCKET ACTION]${COLORS.reset} ${username} ➡ ${COLORS.cyan}${action}${COLORS.reset} ${details}`
    );
  },

  socketJoin: (user, roomId) => {
    if (!isEnabled) return;
    // עמידות ל-user חסר, עקבי עם socketConnect/socketDisconnect.
    const username = user?.username || 'Unknown';
    console.log(
      `${COLORS.blue}[ROOM JOIN]${COLORS.reset} User ${COLORS.yellow}${username}${COLORS.reset} joined room: ${COLORS.cyan}${roomId}${COLORS.reset}`
    );
  },
};
