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
    START_RECORDING: 'stream:start_recording',
    ENDED: 'stream:ended',
    PRODUCER_CLOSED: 'stream:producer_closed',
    NEW_PRODUCER: 'stream:new_producer',
    RESUME: 'stream:resume',
    STREAM_PAUSED: 'stream_paused',
    STREAM_RESUMED: 'stream_resumed',
  },
  ECONOMY: {
    EVENT: 'economy:event',
  },
};
