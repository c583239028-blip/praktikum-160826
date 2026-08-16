/**
 * socket.service.js (client)
 *
 * Manages two separate Socket.IO connections:
 *   appSocket   — main server (game events, notifications, chat)
 *   mediaSocket — media server (WebRTC video/audio streaming)
 *
 * connectMediaSocket uses promise dedup to prevent concurrent duplicate connects.
 * emitPromise / emitMediaPromise wrap emit in a Promise for convenient async/await use.
 *
 * Depends on: auth.service.js (auth token), EXPO_PUBLIC_MEDIA_SERVER_URL (ENV)
 * Used by: any screen that needs to send/receive realtime events
 */
import { io } from 'socket.io-client';
import { SOCKET_EVENTS } from '@worldplay/shared';
import { authService } from './auth.service';
import { API_BASE_URL, MEDIA_BASE_URL } from './apiConfig';

const APP_SERVER_URL = API_BASE_URL;
const EMIT_ACK_TIMEOUT_MS = 10000; // מונע Promise תלוי לנצח אם ה-ack לא מגיע (media socket בלבד)

let appSocketInstance = null;
let appSocketConnectPromise = null;
let mediaSocketInstance = null;
let mediaSocketConnectPromise = null;

export const getAppSocket = () => appSocketInstance;
export const getMediaSocket = () => mediaSocketInstance;

// ---------------------------------------------------------------------------
// Stream-room re-join registry [SCRUM-286 / M10-04]
//
// A socket.io reconnect creates a FRESH socket on the server with a new id and
// empty room membership. The server auto-restores only the private room
// (socket.join(user.id) in server/socket.service.js) — the streamId room is
// lost silently: private-room events (WALLET.BALANCE_UPDATE) keep working, so
// the socket looks healthy while the stream fan-out (questions/status to
// io.to(streamId), SCRUM-230) dies with no error and no log.
//
// streamId membership is never persisted server-side (STREAM.WATCH is an
// ephemeral socket.join), so the client is the only place that knows which
// rooms to restore. We track them here and replay STREAM.WATCH on every
// 'connect' — which fires on the first connect AND on every reconnect.
// Idempotent: STREAM.WATCH is a plain socket.join, so a replay never doubles.
//
// Module-level state is safe here: the only tracker today is ViewerScreen,
// which calls leaveStreamRoom on unmount, and logout unmounts the authed stack
// (running that cleanup) before a new session connects. A full reset belongs
// with socket-teardown-on-logout, which does not exist yet (see SCRUM-264).
//
// gameId rooms are intentionally NOT tracked here: the real player/host path
// joins the game over HTTP and no screen socket-joins the gameId room, so there
// is no membership to restore. gameId re-join is deferred to its own ticket
// (host rehearsal resilience, alongside SCRUM-237).
const joinedStreamRooms = new Set(); // streamId

const replayRoomJoins = (socket) => {
  for (const streamId of joinedStreamRooms) {
    socket.emit(SOCKET_EVENTS.STREAM.WATCH, { streamId });
  }
};

// Record a stream room (questions/status plane on the app socket) and, if
// connected, subscribe now. The join is always replayed on the next 'connect',
// so a cold-start call before the socket is up still takes effect.
export const watchStreamRoom = (streamId) => {
  if (!streamId) return;
  joinedStreamRooms.add(streamId);
  if (appSocketInstance?.connected)
    appSocketInstance.emit(SOCKET_EVENTS.STREAM.WATCH, { streamId });
};

// Stop tracking a stream room so a later reconnect does not replay a join the
// user has already left (e.g. after navigating away from a stream).
export const leaveStreamRoom = (streamId) => joinedStreamRooms.delete(streamId);

// Shared connect logic [INFRA/refactor/shared-socket-connect-helper]
//
// connectAppSocket and connectMediaSocket differ only in url and forceNew
// (media only) once a token is in hand — that's the only place they're
// SUPPOSED to differ, so it's the only part that lives here. Dedup checks,
// token lookup, the no-token branch (app resolves null, media rejects — see
// each caller), and what runs after 'connect' (e.g. replayRoomJoins) stay in
// each caller.
//
// onSocket fires synchronously right after io() returns, before 'connect' or
// 'connect_error' — this preserves the pre-refactor behavior of assigning the
// module-level instance immediately, so getAppSocket()/getMediaSocket() still
// report the socket even if it goes on to error out.
const connectSocket = ({ url, forceNew, token, onSocket }) =>
  new Promise((resolve, reject) => {
    const socket = io(url, {
      auth: { token },
      transports: ['polling', 'websocket'],
      reconnection: true,
      ...(forceNew && { forceNew: true }),
    });
    onSocket?.(socket);

    socket.on(SOCKET_EVENTS.SYSTEM.CONNECT, () => resolve(socket));
    socket.on('connect_error', (error) => reject(error));
  });

export const connectAppSocket = async () => {
  // Fast path: already connected.
  if (appSocketInstance && appSocketInstance.connected)
    return appSocketInstance;
  // Dedup: an initial connect is already in flight. Return that promise (it
  // resolves on 'connect') rather than kicking off a second io().
  if (appSocketConnectPromise) return appSocketConnectPromise;
  // Instance exists but is temporarily disconnected (mid-reconnect). socket.io
  // is already retrying with the original listeners attached, so return it as-is
  // — calling io() again would orphan this socket (it keeps reconnecting and
  // firing every event a second time) and overwrite the singleton.
  if (appSocketInstance) return appSocketInstance;

  appSocketConnectPromise = new Promise((resolve, reject) => {
    authService
      .getToken()
      .then((token) => {
        if (!token) {
          // Preserve the existing no-token contract: callers rely on a null
          // return (ViewerScreen.js optional-chains the result / `if (!s) return`),
          // so resolve null here rather than rejecting.
          appSocketConnectPromise = null;
          return resolve(null);
        }

        connectSocket({
          url: APP_SERVER_URL,
          token,
          onSocket: (socket) => {
            appSocketInstance = socket;
            // Re-join every tracked stream room on the first connect AND on
            // every reconnect — a reconnect creates a fresh server-side
            // socket with empty room membership. Idempotent: STREAM.WATCH is
            // a plain socket.join. Registered directly on the socket (not
            // chained off the promise below) because it must keep firing on
            // every later reconnect, while the promise only ever settles
            // once. [SCRUM-286 / M10-04]
            socket.on(SOCKET_EVENTS.SYSTEM.CONNECT, () =>
              replayRoomJoins(socket)
            );
          },
        })
          .then((socket) => {
            appSocketConnectPromise = null;
            resolve(socket);
          })
          .catch((error) => {
            appSocketConnectPromise = null;
            reject(error);
          });
      })
      .catch(reject);
  });

  return appSocketConnectPromise;
};

export const connectMediaSocket = async () => {
  if (mediaSocketInstance && mediaSocketInstance.connected)
    return mediaSocketInstance;
  if (mediaSocketConnectPromise) return mediaSocketConnectPromise;

  mediaSocketConnectPromise = new Promise((resolve, reject) => {
    authService
      .getToken()
      .then((token) => {
        if (!token) {
          mediaSocketConnectPromise = null;
          return reject(new Error('No token found'));
        }

        // Polling fallback: the media server's websocket upgrade is not
        // always available (only polling answers the handshake), so allow
        // polling first and upgrade to websocket when possible.
        connectSocket({
          url: MEDIA_BASE_URL,
          forceNew: true,
          token,
          onSocket: (socket) => {
            mediaSocketInstance = socket;
          },
        })
          .then((socket) => {
            mediaSocketConnectPromise = null;
            resolve(socket);
          })
          .catch((error) => {
            mediaSocketConnectPromise = null;
            reject(error);
          });
      })
      .catch(reject);
  });

  return mediaSocketConnectPromise;
};

export const emitPromise = (type, data) => {
  return new Promise((resolve, reject) => {
    connectAppSocket()
      .then((activeSocket) => {
        if (!activeSocket || !activeSocket.connected)
          return reject(new Error('App socket not connected'));
        activeSocket.emit(type, data, (response) => {
          if (response && response.error) reject(new Error(response.error));
          else resolve(response);
        });
      })
      .catch(reject);
  });
};

export const emitMediaPromise = (type, data) => {
  return new Promise((resolve, reject) => {
    connectMediaSocket()
      .then((activeSocket) => {
        if (!activeSocket || !activeSocket.connected)
          return reject(new Error('Media socket not connected'));
        activeSocket
          .timeout(EMIT_ACK_TIMEOUT_MS)
          .emit(type, data, (timeoutErr, response) => {
            if (timeoutErr) return reject(timeoutErr);
            if (response && response.error) reject(new Error(response.error));
            else resolve(response);
          });
      })
      .catch(reject);
  });
};
