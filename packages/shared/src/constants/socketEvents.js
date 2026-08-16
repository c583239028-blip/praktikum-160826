// packages/shared/src/constants/socketEvents.js
export const SOCKET_EVENTS = {
  // General system events
  SYSTEM: {
    CONNECT: 'connect',
    DISCONNECT: 'disconnect',
    ERROR: 'error',
    SYSTEM_MESSAGE: 'system_message',
  },
  // Wallet events (App-Server)
  WALLET: {
    BALANCE_UPDATE: 'balance_update',
  },
  // Game events (App-Server)
  GAME: {
    CREATE: 'game:create',
    JOIN: 'game:join_room',
    PLACE_BET: 'game:place_bet',
    STATUS_UPDATE: 'game:status_update',
    ROOM_UPDATE: 'game:room_update',
    INVITE_MODERATOR: 'game:invite_moderator',
    ACCEPT_MODERATOR: 'game:accept_moderator',
    REJECT_MODERATOR: 'game:reject_moderator',
    MODERATOR_INVITATION: 'game:moderator_invitation',
    MODERATOR_RESPONSE: 'game:moderator_response',
    RESOLVE_QUESTION: 'game:resolve_question',
    QUESTION_RESULT: 'game:question_result',
    NEW_QUESTION: 'game:new_question',
    QUESTION_RESOLVED: 'game:question_resolved',
    ERROR: 'game:error',
    LEADERBOARD_UPDATED: 'game:leaderboard_updated',
  },
  // Stream events (Media-Server / Mediasoup)
  STREAM: {
    CREATE_ROOM: 'stream:create_room',
    INIT_BROADCAST: 'stream:init_broadcast',
    CREATE_TRANSPORT: 'stream:create_transport',
    CONNECT_TRANSPORT: 'stream:connect_transport',
    PRODUCE: 'stream:produce',
    CONSUME: 'stream:consume',
    JOIN: 'stream:join',
    // Subscribe the viewer to the streamId room on the app io (questions/status
    // plane). Distinct from JOIN, which is video on the media plane. See 230.
    WATCH: 'stream:watch',
    START_RECORDING: 'stream:start_recording',
    ENDED: 'stream:ended',
    PRODUCER_CLOSED: 'stream:producer_closed',
    NEW_PRODUCER: 'stream:new_producer',
    RESUME: 'stream:resume',
    STREAM_PAUSED: 'stream_paused',
    STREAM_RESUMED: 'stream_resumed',
    STATUS_UPDATE: 'status_update',
    // Per-producer media state (cam/mic toggle). Distinct from STREAM_PAUSED,
    // which is the whole-stream status domain (see INFRA/status-socket-sync).
    PRODUCER_PAUSE: 'stream:producer_pause', // client -> server: request to pause/resume a producer
    PRODUCER_PAUSED: 'stream:producer_paused', // server -> room: a producer was paused
    PRODUCER_RESUMED: 'stream:producer_resumed', // server -> room: a producer was resumed
    VIEWER_COUNT: 'stream:viewer_count', // server -> room: live viewer count changed
  },

  // Moderation events (App-Server) — real-time enforcement of C3 actions.
  // Emitted to the target user's private room (socket.join(user.id)).
  MODERATION: {
    MUTED: 'moderation:muted',
    UNMUTED: 'moderation:unmuted',
    KICKED: 'moderation:kicked',
  },

  ECONOMY: {
    EVENT: 'economy:event',
  },
};
