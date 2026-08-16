import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// SCRUM-346 / FINDINGS M4-07: INIT_BROADCAST must reach app-server via an
// env-driven URL (APP_SERVER_URL) so media works off a dedicated droplet
// (SCRUM-291), while still falling back to the compose hostname when unset.
//
// APP_SERVER_URL is read once at module load, so each case sets the env and
// re-imports the handler through vi.resetModules() (see loadHandler()).

vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn().mockImplementation(function PrismaClient() {
    return {
      stream: { update: vi.fn() },
      game: { findFirst: vi.fn() },
      gameParticipant: { findFirst: vi.fn() },
    };
  }),
}));

vi.mock('../utils/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn() },
}));

vi.mock('../services/stream.service.js', () => ({
  StreamService: {
    startRecording: vi.fn().mockResolvedValue(),
    stopRecording: vi.fn().mockResolvedValue(),
  },
}));

vi.mock('../services/mediasoup.service.js', () => ({
  getWorker: vi.fn(),
  createRouter: vi.fn(),
  createWebRtcTransport: vi.fn(),
}));

vi.mock('@worldplay/shared', () => ({
  isValidStreamId: () => true,
  PARTICIPANT_ROLES: {
    HOST: 'HOST',
    PLAYER: 'PLAYER',
    MODERATOR: 'MODERATOR',
    VIEWER: 'VIEWER',
  },
  MAX_ACTIVE_PLAYERS: 4,
  SOCKET_EVENTS: {
    SYSTEM: { DISCONNECT: 'disconnect' },
    STREAM: {
      INIT_BROADCAST: 'stream:init_broadcast',
      CREATE_ROOM: 'stream:create_room',
    },
  },
  ERROR_MESSAGES: {
    ACTIVE_BROADCAST_EXISTS: 'active broadcast exists',
    FAILED_TO_CREATE_STREAM_IN_DB: 'failed to create stream in db',
  },
}));

import { createMockSocket, createMockIo } from './helpers/liveFlow.harness.js';

const ORIGINAL_APP_SERVER_URL = process.env.APP_SERVER_URL;

// Re-imports the handler so its module-level APP_SERVER_URL picks up the env
// set by the current test.
async function loadHandler() {
  vi.resetModules();
  return import('../sockets/stream.handler.js');
}

describe('stream.handler — INIT_BROADCAST app-server URL (SCRUM-346 / M4-07)', () => {
  let fetchMock;

  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ stream: { id: 'new-stream-id' } }),
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (ORIGINAL_APP_SERVER_URL === undefined) {
      delete process.env.APP_SERVER_URL;
    } else {
      process.env.APP_SERVER_URL = ORIGINAL_APP_SERVER_URL;
    }
  });

  async function initBroadcast() {
    const { registerStreamHandlers } = await loadHandler();
    const io = createMockIo();
    const socket = createMockSocket('host-1', 'host-user-1');
    registerStreamHandlers(io, socket);

    const callback = vi.fn();
    await socket.handlers['stream:init_broadcast'](
      { title: 'test broadcast' },
      callback
    );
    return { callback };
  }

  it('ללא APP_SERVER_URL — נופל לברירת המחדל של compose (http://app-server:8080)', async () => {
    delete process.env.APP_SERVER_URL;

    const { callback } = await initBroadcast();

    expect(fetchMock).toHaveBeenCalledWith(
      'http://app-server:8080/api/streams',
      expect.any(Object)
    );
    expect(callback).toHaveBeenCalledWith({ streamId: 'new-stream-id' });
  });

  it('עם APP_SERVER_URL מוגדר — פונה לכתובת מה-env (דרופלט מדיה ייעודי)', async () => {
    process.env.APP_SERVER_URL = 'http://10.0.0.5:8080';

    await initBroadcast();

    expect(fetchMock).toHaveBeenCalledWith(
      'http://10.0.0.5:8080/api/streams',
      expect.any(Object)
    );
  });

  it('סלאש נגרר ב-env מנוקה — לא נוצר // בכתובת', async () => {
    process.env.APP_SERVER_URL = 'http://10.0.0.5:8080/';

    await initBroadcast();

    expect(fetchMock).toHaveBeenCalledWith(
      'http://10.0.0.5:8080/api/streams',
      expect.any(Object)
    );
  });
});
