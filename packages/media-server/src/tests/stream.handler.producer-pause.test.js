import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { randomUUID } from 'node:crypto';

// ─────────────────────────────────────────────
// Mocks — SCRUM: producer-media-state-sync
// בודק את ה-handler החדש PRODUCER_PAUSE: השהיה/חידוש producer
// ושידור PRODUCER_PAUSED / PRODUCER_RESUMED לשאר החדר.
// ─────────────────────────────────────────────

vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn().mockImplementation(function PrismaClient() {
    return {
      stream: {
        update: vi.fn().mockResolvedValue({ id: 'stream-1' }),
        findUnique: vi.fn().mockResolvedValue({ hostId: 'host-user' }),
      },
      game: { findFirst: vi.fn().mockResolvedValue({ id: 'game-1' }) },
      gameParticipant: {
        findFirst: vi.fn(({ where }) =>
          where?.userId === 'host-user'
            ? Promise.resolve(null)
            : Promise.resolve({ role: 'PLAYER' })
        ),
      },
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

const { MAX_ACTIVE_PLAYERS } = vi.hoisted(() => ({ MAX_ACTIVE_PLAYERS: 4 }));

vi.mock('@worldplay/shared', () => ({
  // streamId UUID validation is covered in stream.service.sanitize-streamid.test.js;
  // here we only need the create_room guard to accept well-formed ids.
  isValidStreamId: () => true,
  PARTICIPANT_ROLES: {
    HOST: 'HOST',
    PLAYER: 'PLAYER',
    MODERATOR: 'MODERATOR',
    VIEWER: 'VIEWER',
  },
  ERROR_MESSAGES: {
    PRODUCER_NOT_FOUND: 'Producer not found',
    NOT_PRODUCER_OWNER: 'Not the owner of this producer',
    ROOM_FULL: `Room is full — maximum ${MAX_ACTIVE_PLAYERS} active players reached`,
  },
  MAX_ACTIVE_PLAYERS,
  SOCKET_EVENTS: {
    SYSTEM: { DISCONNECT: 'disconnect' },
    STREAM: {
      CREATE_ROOM: 'stream:create_room',
      CREATE_TRANSPORT: 'stream:create_transport',
      PRODUCE: 'stream:produce',
      NEW_PRODUCER: 'stream:new_producer',
      PRODUCER_CLOSED: 'stream:producer_closed',
      PRODUCER_PAUSE: 'stream:producer_pause',
      PRODUCER_PAUSED: 'stream:producer_paused',
      PRODUCER_RESUMED: 'stream:producer_resumed',
      JOIN: 'stream:join',
      ENDED: 'stream:ended',
    },
  },
}));

import { registerStreamHandlers, streams } from '../sockets/stream.handler.js';
import * as msService from '../services/mediasoup.service.js';
import { SOCKET_EVENTS } from '@worldplay/shared';

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

// socket.to(room).emit(...) — נאסף ל-roomEmits כדי לוודא שידור לחדר (ולא לשולח)
function createMockSocket(id, userId = 'player-user') {
  const handlers = {};
  const roomEmits = [];
  return {
    id,
    user: { id: userId, username: `user-${userId}` },
    handlers,
    roomEmits,
    on: vi.fn((event, handler) => {
      handlers[event] = handler;
    }),
    to: vi.fn((room) => ({
      emit: vi.fn((...args) => roomEmits.push({ room, args })),
    })),
    join: vi.fn(),
    handshake: { auth: { token: 'valid-token' } },
  };
}

function createMockIo() {
  return {
    to: vi.fn(() => ({ emit: vi.fn() })),
    sockets: { adapter: { rooms: { get: () => undefined } } },
  };
}

// יוצר חדר + producer יחיד (kind נבחר, ברירת מחדל וידאו) בבעלות playerSocket,
// ומחזיר את ה-mock producer
async function setupProducer({
  io,
  streamId,
  hostSocket,
  playerSocket,
  kind = 'video',
}) {
  registerStreamHandlers(io, hostSocket);
  await hostSocket.handlers[SOCKET_EVENTS.STREAM.CREATE_ROOM](
    { streamId },
    vi.fn()
  );
  streams[streamId].router = { rtpCapabilities: {}, close: vi.fn() };

  const producer = {
    id: `producer-${kind}`,
    kind,
    paused: false,
    observer: { on: vi.fn() },
    close: vi.fn(),
    // mirror mediasoup: pause()/resume() flip producer.paused
    pause: vi.fn().mockImplementation(async () => {
      producer.paused = true;
    }),
    resume: vi.fn().mockImplementation(async () => {
      producer.paused = false;
    }),
  };
  const transport = {
    id: 'transport-player',
    on: vi.fn(),
    // mirror mediasoup: transport.produce() attaches the caller's appData
    // (stream.handler.js passes { socketId, userId, streamId }) onto the
    // producer — PRODUCER_PAUSE derives its room from this, not the
    // client's payload.
    produce: vi.fn().mockImplementation(async ({ appData } = {}) => {
      producer.appData = appData;
      return producer;
    }),
  };
  msService.createWebRtcTransport.mockResolvedValue(transport);

  registerStreamHandlers(io, playerSocket);
  const tCb = vi.fn();
  await playerSocket.handlers[SOCKET_EVENTS.STREAM.CREATE_TRANSPORT](
    { streamId },
    tCb
  );
  await playerSocket.handlers[SOCKET_EVENTS.STREAM.PRODUCE](
    {
      transportId: tCb.mock.calls[0][0].id,
      kind,
      rtpParameters: { codecs: [{}], encodings: [{}] },
      streamId,
    },
    vi.fn()
  );

  return producer;
}

// ─────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────

describe('stream.handler — PRODUCER_PAUSE (producer-media-state-sync)', () => {
  let io;
  let streamId;
  let hostSocket;
  let playerSocket;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Real Stream.id is @default(uuid()); create_room now rejects non-UUIDs.
    streamId = randomUUID();
    io = createMockIo();
    hostSocket = createMockSocket('host-socket', 'host-user');
    playerSocket = createMockSocket('player-socket', 'player-user');
  });

  afterEach(() => {
    if (streams[streamId]) delete streams[streamId];
  });

  it('paused=true — מבצע producer.pause() ומשדר PRODUCER_PAUSED לחדר (לא לשולח)', async () => {
    const producer = await setupProducer({
      io,
      streamId,
      hostSocket,
      playerSocket,
    });

    const cb = vi.fn();
    await playerSocket.handlers[SOCKET_EVENTS.STREAM.PRODUCER_PAUSE](
      { streamId, producerId: producer.id, kind: 'video', paused: true },
      cb
    );

    expect(producer.pause).toHaveBeenCalledTimes(1);
    expect(producer.resume).not.toHaveBeenCalled();

    // שודר לחדר streamId דרך socket.to (broadcast לכולם חוץ מהשולח)
    expect(playerSocket.to).toHaveBeenCalledWith(streamId);
    const paused = playerSocket.roomEmits.find(
      (e) => e.args[0] === SOCKET_EVENTS.STREAM.PRODUCER_PAUSED
    );
    expect(paused).toBeTruthy();
    expect(paused.args[1]).toMatchObject({
      producerId: producer.id,
      kind: 'video',
      paused: true,
      streamId,
    });
    expect(cb).toHaveBeenCalledWith({ success: true });
  });

  it('paused=false — מבצע producer.resume() ומשדר PRODUCER_RESUMED', async () => {
    const producer = await setupProducer({
      io,
      streamId,
      hostSocket,
      playerSocket,
    });

    const cb = vi.fn();
    await playerSocket.handlers[SOCKET_EVENTS.STREAM.PRODUCER_PAUSE](
      { streamId, producerId: producer.id, kind: 'video', paused: false },
      cb
    );

    expect(producer.resume).toHaveBeenCalledTimes(1);
    expect(producer.pause).not.toHaveBeenCalled();
    const resumed = playerSocket.roomEmits.find(
      (e) => e.args[0] === SOCKET_EVENTS.STREAM.PRODUCER_RESUMED
    );
    expect(resumed.args[1]).toMatchObject({
      producerId: producer.id,
      paused: false,
    });
    expect(cb).toHaveBeenCalledWith({ success: true });
  });

  it('paused=true עם kind=audio — משדר PRODUCER_PAUSED עם kind audio (AC#2 השתקת מיקרופון)', async () => {
    const producer = await setupProducer({
      io,
      streamId,
      hostSocket,
      playerSocket,
      kind: 'audio',
    });

    const cb = vi.fn();
    await playerSocket.handlers[SOCKET_EVENTS.STREAM.PRODUCER_PAUSE](
      { streamId, producerId: producer.id, kind: 'audio', paused: true },
      cb
    );

    expect(producer.pause).toHaveBeenCalledTimes(1);
    expect(producer.resume).not.toHaveBeenCalled();

    const paused = playerSocket.roomEmits.find(
      (e) => e.args[0] === SOCKET_EVENTS.STREAM.PRODUCER_PAUSED
    );
    expect(paused).toBeTruthy();
    expect(paused.args[1]).toMatchObject({
      producerId: producer.id,
      kind: 'audio',
      paused: true,
      streamId,
    });
    expect(cb).toHaveBeenCalledWith({ success: true });
  });

  it('kind נגזר מה-producer אם לא סופק בבקשה', async () => {
    const producer = await setupProducer({
      io,
      streamId,
      hostSocket,
      playerSocket,
    });

    await playerSocket.handlers[SOCKET_EVENTS.STREAM.PRODUCER_PAUSE](
      { streamId, producerId: producer.id, paused: true },
      vi.fn()
    );

    const paused = playerSocket.roomEmits.find(
      (e) => e.args[0] === SOCKET_EVENTS.STREAM.PRODUCER_PAUSED
    );
    expect(paused.args[1].kind).toBe('video'); // producer.kind
  });

  it('producer לא קיים — callback מקבל error, אין שידור', async () => {
    await setupProducer({ io, streamId, hostSocket, playerSocket });

    const cb = vi.fn();
    await playerSocket.handlers[SOCKET_EVENTS.STREAM.PRODUCER_PAUSE](
      { streamId, producerId: 'does-not-exist', paused: true },
      cb
    );

    expect(cb.mock.calls[0][0]).toHaveProperty('error');
    expect(playerSocket.roomEmits.length).toBe(0);
  });

  it('מצטרף מאוחר — JOIN מחזיר paused=true ו-kind עבור producer שכבר מושהה', async () => {
    const producer = await setupProducer({
      io,
      streamId,
      hostSocket,
      playerSocket,
    });

    // ה-player מכבה מצלמה לפני שהצופה מצטרף
    await playerSocket.handlers[SOCKET_EVENTS.STREAM.PRODUCER_PAUSE](
      { streamId, producerId: producer.id, kind: 'video', paused: true },
      vi.fn()
    );

    // צופה חדש מצטרף אחרי הכיבוי
    const viewerSocket = createMockSocket('viewer-socket', 'viewer-user');
    registerStreamHandlers(io, viewerSocket);
    const joinCb = vi.fn();
    await viewerSocket.handlers[SOCKET_EVENTS.STREAM.JOIN](
      { streamId },
      joinCb
    );

    const entry = joinCb.mock.calls[0][0].currentProducers.find(
      (p) => p.producerId === producer.id
    );
    expect(entry).toMatchObject({ paused: true, kind: 'video' });
  });

  it('מצטרף מאוחר — producer פעיל מוחזר עם paused=false', async () => {
    const producer = await setupProducer({
      io,
      streamId,
      hostSocket,
      playerSocket,
    });

    const viewerSocket = createMockSocket('viewer-socket', 'viewer-user');
    registerStreamHandlers(io, viewerSocket);
    const joinCb = vi.fn();
    await viewerSocket.handlers[SOCKET_EVENTS.STREAM.JOIN](
      { streamId },
      joinCb
    );

    const entry = joinCb.mock.calls[0][0].currentProducers.find(
      (p) => p.producerId === producer.id
    );
    expect(entry.paused).toBe(false);
  });

  it('socket שאינו הבעלים של ה-producer — נדחה עם error, ה-producer לא מושהה', async () => {
    const producer = await setupProducer({
      io,
      streamId,
      hostSocket,
      playerSocket,
    });

    // host מנסה להשהות את ה-producer של ה-player
    const cb = vi.fn();
    await hostSocket.handlers[SOCKET_EVENTS.STREAM.PRODUCER_PAUSE](
      { streamId, producerId: producer.id, paused: true },
      cb
    );

    expect(cb.mock.calls[0][0]).toHaveProperty('error');
    expect(producer.pause).not.toHaveBeenCalled();
    expect(hostSocket.roomEmits.length).toBe(0);
  });
});
