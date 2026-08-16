import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { randomUUID } from 'node:crypto';

// ─────────────────────────────────────────────
// Mocks — SCRUM: moderation-mute-server-enforcement
// בודק את setAudioMuteForUser (הערוץ הפנימי app-server -> media-server) וגם
// את הנעילה של PRODUCER_PAUSE העצמי כשההשתקה כפויה (AC2). ההשתקה נשמרת
// לפי userId (לא producerId), כדי לשרוד סגירה/יצירה מחדש של producer
// (למשל reconnect) — ר' producerModeration.service.js.
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
    STREAM_ROOM_NOT_FOUND: 'Stream Room not found',
    MUTED_BY_MODERATOR:
      'You have been muted by a moderator and cannot unmute yourself',
    ROOM_FULL: 'Room is full — maximum 4 active players reached',
  },
  MAX_ACTIVE_PLAYERS: 4,
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
import { setAudioMuteForUser } from '../services/producerModeration.service.js';
import * as msService from '../services/mediasoup.service.js';
import { SOCKET_EVENTS, ERROR_MESSAGES } from '@worldplay/shared';

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

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

// io.to(room).emit(...) — נאסף ל-roomEmits כדי לוודא שידור לכל החדר, כולל
// המושתק עצמו (בניגוד ל-socket.to של הטוגל העצמי).
function createMockIo() {
  const roomEmits = [];
  const to = vi.fn((room) => ({
    emit: vi.fn((...args) => roomEmits.push({ room, args })),
  }));
  return {
    io: {
      to,
      sockets: { adapter: { rooms: { get: () => undefined } } },
    },
    roomEmits,
  };
}

async function setupRoom({ io, streamId, hostSocket }) {
  registerStreamHandlers(io, hostSocket);
  await hostSocket.handlers[SOCKET_EVENTS.STREAM.CREATE_ROOM](
    { streamId },
    vi.fn()
  );
  streams[streamId].router = { rtpCapabilities: {}, close: vi.fn() };
}

// Creates a producer on an already-registered socket. Captures the
// observer.on('close', ...) handler so tests can simulate the producer
// closing (e.g. a reconnect) via producer._simulateClose().
async function produceOnSocket({ io, streamId, socket, kind = 'audio' }) {
  registerStreamHandlers(io, socket);

  const producer = {
    id: `producer-${kind}-${socket.user.id}-${Math.random().toString(36).slice(2)}`,
    kind,
    paused: false,
    observer: {
      on: vi.fn((event, handler) => {
        if (event === 'close') producer._simulateClose = handler;
      }),
    },
    close: vi.fn(),
    pause: vi.fn().mockImplementation(async () => {
      producer.paused = true;
    }),
    resume: vi.fn().mockImplementation(async () => {
      producer.paused = false;
    }),
  };
  const transport = {
    id: `transport-${socket.id}-${Math.random().toString(36).slice(2)}`,
    on: vi.fn(),
    // mirror mediasoup: transport.produce() attaches the caller's appData
    // (stream.handler.js passes { socketId, userId }) onto the producer.
    produce: vi.fn().mockImplementation(async ({ appData } = {}) => {
      producer.appData = appData;
      return producer;
    }),
  };
  msService.createWebRtcTransport.mockResolvedValue(transport);

  const tCb = vi.fn();
  await socket.handlers[SOCKET_EVENTS.STREAM.CREATE_TRANSPORT](
    { streamId },
    tCb
  );
  await socket.handlers[SOCKET_EVENTS.STREAM.PRODUCE](
    {
      transportId: tCb.mock.calls[tCb.mock.calls.length - 1][0].id,
      kind,
      rtpParameters: { codecs: [{}], encodings: [{}] },
      streamId,
    },
    vi.fn()
  );

  return producer;
}

async function setupProducer({
  io,
  streamId,
  hostSocket,
  playerSocket,
  kind = 'audio',
}) {
  await setupRoom({ io, streamId, hostSocket });
  return produceOnSocket({ io, streamId, socket: playerSocket, kind });
}

// ─────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────

describe('stream.handler — setAudioMuteForUser (moderation-mute-server-enforcement)', () => {
  let io;
  let roomEmits;
  let streamId;
  let hostSocket;
  let playerSocket;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Real Stream.id is @default(uuid()); create_room now rejects non-UUIDs.
    streamId = randomUUID();
    ({ io, roomEmits } = createMockIo());
    hostSocket = createMockSocket('host-socket', 'host-user');
    playerSocket = createMockSocket('player-socket', 'player-user');
  });

  afterEach(() => {
    if (streams[streamId]) delete streams[streamId];
  });

  it('אכיפה מוצלחת — משהה את ה-producer של האודיו ומשדר PRODUCER_PAUSED ל-io.to(streamId) (כולל המושתק)', async () => {
    const producer = await setupProducer({
      io,
      streamId,
      hostSocket,
      playerSocket,
    });

    await setAudioMuteForUser(io, streamId, 'player-user', true);

    expect(producer.pause).toHaveBeenCalledTimes(1);
    expect(io.to).toHaveBeenCalledWith(streamId);
    const paused = roomEmits.find(
      (e) => e.args[0] === SOCKET_EVENTS.STREAM.PRODUCER_PAUSED
    );
    expect(paused).toBeTruthy();
    expect(paused.args[1]).toMatchObject({
      producerId: producer.id,
      kind: 'audio',
      paused: true,
      streamId,
    });
  });

  it('UNMUTE משחרר את ה-producer ומשדר PRODUCER_RESUMED', async () => {
    const producer = await setupProducer({
      io,
      streamId,
      hostSocket,
      playerSocket,
    });
    await setAudioMuteForUser(io, streamId, 'player-user', true);

    await setAudioMuteForUser(io, streamId, 'player-user', false);

    expect(producer.resume).toHaveBeenCalledTimes(1);
    const resumed = roomEmits.find(
      (e) => e.args[0] === SOCKET_EVENTS.STREAM.PRODUCER_RESUMED
    );
    expect(resumed.args[1]).toMatchObject({
      producerId: producer.id,
      paused: false,
    });
  });

  it('MUTE: אם pause() נכשל, הנעילה מתבטלת (rollback) — לא נשארת "תקועה" בלי אכיפה בפועל', async () => {
    const producer = await setupProducer({
      io,
      streamId,
      hostSocket,
      playerSocket,
    });
    producer.pause.mockImplementationOnce(async () => {
      throw new Error('mediasoup pause failed');
    });

    await expect(
      setAudioMuteForUser(io, streamId, 'player-user', true)
    ).rejects.toThrow('mediasoup pause failed');

    expect(streams[streamId].forcedMutedUserIds.has('player-user')).toBe(false);
  });

  it('UNMUTE: אם resume() נכשל, הנעילה נשארת בתוקף — לא משתחררת בלי אכיפה בפועל', async () => {
    const producer = await setupProducer({
      io,
      streamId,
      hostSocket,
      playerSocket,
    });
    await setAudioMuteForUser(io, streamId, 'player-user', true);
    producer.resume.mockImplementationOnce(async () => {
      throw new Error('mediasoup resume failed');
    });

    await expect(
      setAudioMuteForUser(io, streamId, 'player-user', false)
    ).rejects.toThrow('mediasoup resume failed');

    expect(streams[streamId].forcedMutedUserIds.has('player-user')).toBe(true);

    // the self-toggle must still be locked — the producer never actually resumed
    const cb = vi.fn();
    await playerSocket.handlers[SOCKET_EVENTS.STREAM.PRODUCER_PAUSE](
      { streamId, producerId: producer.id, kind: 'audio', paused: false },
      cb
    );
    expect(cb).toHaveBeenCalledWith({
      error: ERROR_MESSAGES.MUTED_BY_MODERATOR,
    });
  });

  it('MUTE עם כמה audio producers — אם השני נכשל, הראשון מקבל resume בחזרה (rollback חלקי) ואין lock', async () => {
    await setupRoom({ io, streamId, hostSocket });
    const producerA = await produceOnSocket({
      io,
      streamId,
      socket: playerSocket,
    });
    const producerB = await produceOnSocket({
      io,
      streamId,
      socket: playerSocket,
    });
    producerB.pause.mockImplementationOnce(async () => {
      throw new Error('mediasoup pause failed');
    });

    await expect(
      setAudioMuteForUser(io, streamId, 'player-user', true)
    ).rejects.toThrow('mediasoup pause failed');

    // producer A was paused, then rolled back — its real state must match
    // "not muted", the same as the lock.
    expect(producerA.pause).toHaveBeenCalledTimes(1);
    expect(producerA.resume).toHaveBeenCalledTimes(1);
    expect(streams[streamId].forcedMutedUserIds.has('player-user')).toBe(false);

    // nothing was ever announced for producer A — it was rolled back before
    // any broadcast, so there's nothing for clients to un-see.
    const pausedForA = roomEmits.find(
      (e) =>
        e.args[0] === SOCKET_EVENTS.STREAM.PRODUCER_PAUSED &&
        e.args[1].producerId === producerA.id
    );
    expect(pausedForA).toBeUndefined();
  });

  it('UNMUTE עם כמה audio producers — אם השני נכשל, הראשון מקבל pause בחזרה (rollback חלקי) וה-lock נשאר', async () => {
    await setupRoom({ io, streamId, hostSocket });
    const producerA = await produceOnSocket({
      io,
      streamId,
      socket: playerSocket,
    });
    const producerB = await produceOnSocket({
      io,
      streamId,
      socket: playerSocket,
    });
    await setAudioMuteForUser(io, streamId, 'player-user', true);
    producerB.resume.mockImplementationOnce(async () => {
      throw new Error('mediasoup resume failed');
    });

    await expect(
      setAudioMuteForUser(io, streamId, 'player-user', false)
    ).rejects.toThrow('mediasoup resume failed');

    // producer A was resumed, then rolled back (re-paused) — its real state
    // must match "still muted", the same as the lock.
    expect(producerA.resume).toHaveBeenCalledTimes(1);
    expect(producerA.pause).toHaveBeenCalledTimes(2); // initial MUTE + rollback
    expect(streams[streamId].forcedMutedUserIds.has('player-user')).toBe(true);

    const resumedForA = roomEmits.find(
      (e) =>
        e.args[0] === SOCKET_EVENTS.STREAM.PRODUCER_RESUMED &&
        e.args[1].producerId === producerA.id
    );
    expect(resumedForA).toBeUndefined();
  });

  it('producer שאינו קיים — ה-MUTE עדיין מצליח, ונשמר לפעם שבה ייווצר producer', async () => {
    await setupRoom({ io, streamId, hostSocket });

    const result = await setAudioMuteForUser(io, streamId, 'nobody-user', true);

    expect(result).toEqual({ affectedProducerCount: 0 });
    expect(streams[streamId].forcedMutedUserIds.has('nobody-user')).toBe(true);
  });

  it('חדר שידור שאינו קיים זורק STREAM_ROOM_NOT_FOUND', async () => {
    await expect(
      setAudioMuteForUser(io, 'no-such-stream', 'player-user', true)
    ).rejects.toThrow(ERROR_MESSAGES.STREAM_ROOM_NOT_FOUND);
  });

  it('AC2 — המושתק אינו יכול לבטל את ההשתקה בעצמו דרך הטוגל שלו', async () => {
    const producer = await setupProducer({
      io,
      streamId,
      hostSocket,
      playerSocket,
    });
    await setAudioMuteForUser(io, streamId, 'player-user', true);

    const cb = vi.fn();
    await playerSocket.handlers[SOCKET_EVENTS.STREAM.PRODUCER_PAUSE](
      { streamId, producerId: producer.id, kind: 'audio', paused: false },
      cb
    );

    expect(cb).toHaveBeenCalledWith({
      error: ERROR_MESSAGES.MUTED_BY_MODERATOR,
    });
    expect(producer.resume).not.toHaveBeenCalled();
    expect(producer.paused).toBe(true);
  });

  it('streamId מזויף ב-PRODUCER_PAUSE לא עוקף את הנעילה — השרת גוזר את החדר מ-producer.appData, לא מה-payload של הלקוח', async () => {
    const producer = await setupProducer({
      io,
      streamId,
      hostSocket,
      playerSocket,
    });
    await setAudioMuteForUser(io, streamId, 'player-user', true);

    const cb = vi.fn();
    await playerSocket.handlers[SOCKET_EVENTS.STREAM.PRODUCER_PAUSE](
      {
        streamId: 'attacker-controlled-fake-stream',
        producerId: producer.id,
        kind: 'audio',
        paused: false,
      },
      cb
    );

    expect(cb).toHaveBeenCalledWith({
      error: ERROR_MESSAGES.MUTED_BY_MODERATOR,
    });
    expect(producer.resume).not.toHaveBeenCalled();
  });

  it('אחרי UNMUTE של המנחה — הטוגל העצמי חוזר לעבוד כרגיל', async () => {
    const producer = await setupProducer({
      io,
      streamId,
      hostSocket,
      playerSocket,
    });
    await setAudioMuteForUser(io, streamId, 'player-user', true);
    await setAudioMuteForUser(io, streamId, 'player-user', false);

    const cb = vi.fn();
    await playerSocket.handlers[SOCKET_EVENTS.STREAM.PRODUCER_PAUSE](
      { streamId, producerId: producer.id, kind: 'audio', paused: false },
      cb
    );

    expect(cb).toHaveBeenCalledWith({ success: true });
    expect(producer.resume).toHaveBeenCalled();
  });

  it('עקיפה דרך producer חדש (reconnect) נחסמת — הנעילה שייכת למשתמש, לא ל-producer הישן', async () => {
    await setupRoom({ io, streamId, hostSocket });
    const firstProducer = await produceOnSocket({
      io,
      streamId,
      socket: playerSocket,
    });
    await setAudioMuteForUser(io, streamId, 'player-user', true);
    expect(firstProducer.pause).toHaveBeenCalledTimes(1);

    // the old producer closes (e.g. a reconnect)
    await firstProducer._simulateClose();

    // a new producer is created for the same user
    const secondProducer = await produceOnSocket({
      io,
      streamId,
      socket: playerSocket,
    });

    // it must be born paused — the mute must not be silently bypassed
    expect(secondProducer.pause).toHaveBeenCalledTimes(1);
    const pausedForSecond = roomEmits.find(
      (e) =>
        e.args[0] === SOCKET_EVENTS.STREAM.PRODUCER_PAUSED &&
        e.args[1].producerId === secondProducer.id
    );
    expect(pausedForSecond).toBeTruthy();

    // self-unmute on the NEW producer is still blocked
    const cb = vi.fn();
    await playerSocket.handlers[SOCKET_EVENTS.STREAM.PRODUCER_PAUSE](
      { streamId, producerId: secondProducer.id, kind: 'audio', paused: false },
      cb
    );
    expect(cb).toHaveBeenCalledWith({
      error: ERROR_MESSAGES.MUTED_BY_MODERATOR,
    });
  });

  it('MUTE לפני שקיים producer — ה-producer שנוצר אחר כך נולד מושתק', async () => {
    await setupRoom({ io, streamId, hostSocket });

    await setAudioMuteForUser(io, streamId, 'player-user', true);
    const producer = await produceOnSocket({
      io,
      streamId,
      socket: playerSocket,
    });

    expect(producer.pause).toHaveBeenCalledTimes(1);

    const cb = vi.fn();
    await playerSocket.handlers[SOCKET_EVENTS.STREAM.PRODUCER_PAUSE](
      { streamId, producerId: producer.id, kind: 'audio', paused: false },
      cb
    );
    expect(cb).toHaveBeenCalledWith({
      error: ERROR_MESSAGES.MUTED_BY_MODERATOR,
    });
  });

  it('רק audio מושפע — video producer של אותו משתמש נשאר פעיל', async () => {
    await setupRoom({ io, streamId, hostSocket });
    const audioProducer = await produceOnSocket({
      io,
      streamId,
      socket: playerSocket,
      kind: 'audio',
    });
    const videoProducer = await produceOnSocket({
      io,
      streamId,
      socket: playerSocket,
      kind: 'video',
    });

    await setAudioMuteForUser(io, streamId, 'player-user', true);

    expect(audioProducer.pause).toHaveBeenCalledTimes(1);
    expect(videoProducer.pause).not.toHaveBeenCalled();
  });
});
