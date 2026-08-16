// src/utils/moderationSocket.js
// שכבת ה-real-time של המודרציה (C3) — אינה מכפילה הרשאות; אותו דפוס כמו balanceSync.js
import axios from 'axios';
import { SOCKET_EVENTS, INTERNAL_API } from '@worldplay/shared';
import { ModerationType } from '@prisma/client';

// Media-server is a separate process on a private docker network — a hang
// there must not hang the moderator's HTTP request indefinitely.
const MEDIA_SERVER_REQUEST_TIMEOUT_MS = 5000;

// סוג פעולת מודרציה -> אירוע הסוקט המתאים ליעד
export function moderationEventForType(type) {
  switch (type) {
    case ModerationType.MUTE:
      return SOCKET_EVENTS.MODERATION.MUTED;
    case ModerationType.UNMUTE:
      return SOCKET_EVENTS.MODERATION.UNMUTED;
    case ModerationType.KICK:
      return SOCKET_EVENTS.MODERATION.KICKED;
    default:
      return null;
  }
}

// פליטת אירוע מודרציה לחדר הפרטי של היעד בלבד (socket.join(user.id))
export function emitModerationEvent(io, event, targetUserId, streamId) {
  if (!io || !event || !targetUserId) return;
  io.to(targetUserId).emit(event, { streamId });
}

// הוצאת כל הסוקטים של היעד מחדר המשחק בצד-שרת. משתמש ב-socketsLeave של
// Socket.IO v4 — עובד גם מול Redis adapter / כמה שרתים, לא רק שרת יחיד.
export async function enforceKickSocket(io, targetUserId, gameId) {
  if (!io || !targetUserId || !gameId) return;
  await io.in(targetUserId).socketsLeave(gameId);
}

// אוכפת MUTE/UNMUTE בפועל מול ה-producer של האודיו ב-media server (תהליך
// נפרד, פורט 8000). מותנת בכשל גלוי — axios זורק על non-2xx, וה-caller
// (moderation.controller.js) כבר תופס ומחזיר שגיאה למנחה + לוג. אין
// try/catch כאן בכוונה: הצלחה שקטה-כאילו היא בדיוק מה שאסור.
export async function enforceMuteOnMediaServer(streamId, targetUserId, muted) {
  const path = muted ? 'mute' : 'unmute';
  await axios.post(
    `${process.env.MEDIA_SERVER_INTERNAL_URL}${INTERNAL_API.MODERATION_BASE_PATH}/${path}`,
    { streamId, targetUserId },
    {
      headers: {
        [INTERNAL_API.HEADER_SECRET]: process.env.INTERNAL_SERVICE_SECRET,
      },
      timeout: MEDIA_SERVER_REQUEST_TIMEOUT_MS,
    }
  );
}
