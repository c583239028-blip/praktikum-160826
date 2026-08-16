import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { randomUUID } from 'node:crypto';

// ─────────────────────────────────────────────
// Mocks — דומה לקובץ הקיים אבל יותר מורחב
// ─────────────────────────────────────────────

const {
  mockGameParticipantFindFirst,
  mockStreamFindUnique,
  mockGameFindFirst,
  setGameParticipantRole,
  clearGameParticipantRoles,
} = vi.hoisted(() => {
  // מפה: userId -> role, כדי שה-mock יגיב לפי *מי* שואל,
  // בדיוק כמו gameParticipant.findFirst אמיתי שמחזיר נתון תלוי-userId
  const rolesByUserId = {};

  const findFirstImpl = vi.fn(({ where }) => {
    const userId = where?.userId;
    const role = rolesByUserId[userId];
    return Promise.resolve(role ? { role } : null);
  });

  return {
    mockGameParticipantFindFirst: findFirstImpl,
    mockStreamFindUnique: vi.fn(),
    setGameParticipantRole: (userId, role) => {
      rolesByUserId[userId] = role;
    },
    clearGameParticipantRoles: () => {
      Object.keys(rolesByUserId).forEach((k) => delete rolesByUserId[k]);
    },
    mockGameFindFirst: vi.fn().mockResolvedValue({ id: 'game-1' }),
  };
});

vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn().mockImplementation(function PrismaClient() {
    return {
      stream: {
        update: vi.fn().mockResolvedValue({ id: 'stream-1' }),
        findUnique: mockStreamFindUnique,
      },
      game: { findFirst: mockGameFindFirst },
      gameParticipant: { findFirst: mockGameParticipantFindFirst },
    };
  }),
}));

vi.mock('../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
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
  SOCKET_EVENTS: {
    SYSTEM: {
      DISCONNECT: 'disconnect',
    },
    STREAM: {
      CREATE_ROOM: 'stream:create_room',
      CREATE_TRANSPORT: 'stream:create_transport',
      PRODUCE: 'stream:produce',
      NEW_PRODUCER: 'stream:new_producer',
      PRODUCER_CLOSED: 'stream:producer_closed',
      JOIN: 'stream:join',
      ENDED: 'stream:ended',
    },
  },
  MAX_ACTIVE_PLAYERS: 4,
}));

import {
  registerStreamHandlers,
  streams,
  handleCloseStream,
} from '../sockets/stream.handler.js';
import * as msService from '../services/mediasoup.service.js';
import { SOCKET_EVENTS } from '@worldplay/shared';

// ─────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────

function createMockSocket(id, userId = 'user-1') {
  const handlers = {};
  return {
    id,
    user: { id: userId, username: `user-${userId}` },
    handlers,
    on: vi.fn((event, handler) => {
      handlers[event] = handler;
    }),
    join: vi.fn(),
    handshake: { auth: { token: 'valid-token' } },
  };
}

function createMockIo() {
  const emitTracker = [];
  return {
    to: vi.fn().mockImplementation((room) => ({
      emit: vi.fn((...args) => {
        emitTracker.push({ room, args });
      }),
    })),
    emitTracker,
    sockets: { adapter: { rooms: { get: () => undefined } } },
  };
}

async function setupRoomWithProducer({
  io,
  streamId,
  hostSocket,
  playerSocket,
  producerCount = 1,
}) {
  // הגדרת host — הוא יוצר את החדר
  registerStreamHandlers(io, hostSocket);

  const createRoomCb = vi.fn();
  await hostSocket.handlers[SOCKET_EVENTS.STREAM.CREATE_ROOM](
    { streamId },
    createRoomCb
  );

  // קריטי: streamRoom.router נצרך ע"י JOIN (router.rtpCapabilities) —
  // בלי זה, JOIN זורק TypeError ומחזיר { error } במקום התשובה התקינה
  streams[streamId].router = { rtpCapabilities: {}, close: vi.fn() };

  // Host יוצר transport ו-producer (וידאו)
  const hostTransport = {
    id: 'transport-host',
    iceParameters: {},
    iceCandidates: [],
    dtlsParameters: {},
    on: vi.fn(),
    produce: vi.fn().mockImplementation(async () => ({
      id: `producer-host-${Math.random().toString(36).slice(2)}`,
      observer: { on: vi.fn() },
      close: vi.fn(),
    })),
  };
  msService.createWebRtcTransport.mockResolvedValue(hostTransport);

  const hostTransportCb = vi.fn();
  await hostSocket.handlers[SOCKET_EVENTS.STREAM.CREATE_TRANSPORT](
    { streamId },
    hostTransportCb
  );
  const hostTransportId = hostTransportCb.mock.calls[0][0].id;

  const hostProduceCb = vi.fn();
  await hostSocket.handlers[SOCKET_EVENTS.STREAM.PRODUCE](
    {
      transportId: hostTransportId,
      kind: 'video',
      rtpParameters: { codecs: [{}], encodings: [{}] },
      streamId,
    },
    hostProduceCb
  );
  const hostProducerId = hostProduceCb.mock.calls[0][0].id;

  // Player (או שחקן נוסף) נרשם
  registerStreamHandlers(io, playerSocket);

  // Player יוצר transport
  const createdProducers = [];
  const playerTransport = {
    id: 'transport-player',
    iceParameters: {},
    iceCandidates: [],
    dtlsParameters: {},
    on: vi.fn(),
    produce: vi.fn().mockImplementation(async () => {
      const newProducer = {
        id: `producer-player-${Math.random().toString(36).slice(2)}`,
        observer: { on: vi.fn() },
        close: vi.fn(),
      };
      createdProducers.push(newProducer);
      return newProducer;
    }),
  };
  msService.createWebRtcTransport.mockResolvedValue(playerTransport);

  const playerTransportCb = vi.fn();
  await playerSocket.handlers[SOCKET_EVENTS.STREAM.CREATE_TRANSPORT](
    { streamId },
    playerTransportCb
  );
  const playerTransportId = playerTransportCb.mock.calls[0][0].id;

  // Player יוצר producers (וידאו ואודיו)
  const kinds = ['video', 'audio'];
  for (let i = 0; i < producerCount; i += 1) {
    const produceCb = vi.fn();
    await playerSocket.handlers[SOCKET_EVENTS.STREAM.PRODUCE](
      {
        transportId: playerTransportId,
        kind: kinds[i % kinds.length],
        rtpParameters: { codecs: [{}], encodings: [{}] },
        streamId,
      },
      produceCb
    );
  }

  return {
    hostProducerId,
    hostTransport,
    playerTransport,
    playerProducers: createdProducers,
  };
}

// ─────────────────────────────────────────────
// Tests — SCRUM-167: Producer Roles Broadcasting
// ─────────────────────────────────────────────

describe('stream.handler — SCRUM-167: Producer Roles & NEW_PRODUCER', () => {
  let io;
  let streamId;

  beforeEach(() => {
    vi.clearAllMocks();
    // streamId ייחודי לכל טסט (לא קבוע משותף) — מבטל לחלוטין סיכון
    // להתנגשות עם state שנכתב ע"י טסטים אחרים, גם אם קבצים שונים
    // רצים על אותו streams singleton באותו תהליך
    // Real Stream.id is @default(uuid()); create_room now rejects non-UUIDs.
    streamId = randomUUID();
    io = createMockIo();

    // איפוס מפת ה-roles בין טסטים - כל טסט מגדיר בעצמו מי קיבל איזה role
    // (במקום mockResolvedValue גלובלי שהיה מחזיר את אותו role לכולם,
    // כולל HOST, ולכן מסווה את ה-fallback ל-Stream.hostId)
    clearGameParticipantRoles();
    mockStreamFindUnique.mockResolvedValue({ hostId: 'host-user' });
    mockGameFindFirst.mockResolvedValue({ id: 'game-1' });
  });

  afterEach(() => {
    // ניקוי מפורש של כל מה שהטסט הזה (ורק הטסט הזה) יצר ב-streams,
    // בלי לפגוע ב-state של טסטים אחרים שרצים באותו זמן בקבצים אחרים
    if (streamId && streams[streamId]) {
      delete streams[streamId];
    }
  });

  // ─────────────────────────────────────────────
  // בדיקה 1: NEW_PRODUCER משודר עם role נכון
  // ─────────────────────────────────────────────

  it('1a. כששחקן (PLAYER) משדר producer — NEW_PRODUCER משודר עם role=PLAYER', async () => {
    const hostSocket = createMockSocket('host-socket-1', 'host-user');
    const playerSocket = createMockSocket('player-socket-1', 'player-user');

    // רק player-user רשום כ-GameParticipant; host-user נשאר בלי רשומה
    // (ייפול תחת fallback ל-Stream.hostId ויזוהה כ-HOST)
    setGameParticipantRole('player-user', 'PLAYER');

    const { playerProducers } = await setupRoomWithProducer({
      io,
      streamId,
      hostSocket,
      playerSocket,
    });

    const playerProducer = playerProducers[0];

    // בדוק: NEW_PRODUCER נשלח לחדר עם הproducerId ו-role הנכונים
    const newProducerEmits = io.emitTracker.filter(
      ({ args }) => args[0] === SOCKET_EVENTS.STREAM.NEW_PRODUCER
    );

    expect(newProducerEmits.length).toBeGreaterThan(0);
    const playerEmit = newProducerEmits.find(
      ({ args }) => args[1].producerId === playerProducer.id
    );
    expect(playerEmit.args[1]).toMatchObject({
      producerId: playerProducer.id,
      role: 'PLAYER',
      streamId,
    });
  });

  it('1b. כשצופה (VIEWER, ללא GameParticipant) משדר — NEW_PRODUCER משודר עם role=VIEWER', async () => {
    const hostSocket = createMockSocket('host-socket-1b', 'host-user');
    const viewerSocket = createMockSocket('viewer-socket-1b', 'viewer-user');

    // viewer-user — אין GameParticipant, ואינו hostId של ה-Stream
    // (host-user הוא ה-hostId; viewer-user לא, אז מקבל VIEWER)

    const { playerProducers } = await setupRoomWithProducer({
      io,
      streamId,
      hostSocket,
      playerSocket: viewerSocket,
    });

    const viewerProducer = playerProducers[0];

    const newProducerEmits = io.emitTracker.filter(
      ({ args }) => args[0] === SOCKET_EVENTS.STREAM.NEW_PRODUCER
    );

    const viewerEmit = newProducerEmits.find(
      ({ args }) => args[1].producerId === viewerProducer.id
    );
    expect(viewerEmit.args[1]).toMatchObject({
      producerId: viewerProducer.id,
      role: 'VIEWER',
    });
  });

  it('1c. כשHOST משדר producer — NEW_PRODUCER משודר עם role=HOST (fallback ל-Stream.hostId)', async () => {
    const hostSocket = createMockSocket('host-socket-1c', 'host-user');
    const dummyPlayerSocket = createMockSocket('dummy-socket', 'dummy-user');

    // HOST — אין GameParticipant (עדיין לא משחק פעיל)
    // אבל Stream.hostId = host-user, ש-validateParticipantRole בודק fallback
    // (dummy-user גם אין לו GameParticipant, ולא הוא ה-hostId -> יקבל VIEWER,
    // וזה בסדר כי הטסט הזה לא בודק אותו)

    const { hostProducerId } = await setupRoomWithProducer({
      io,
      streamId,
      hostSocket,
      playerSocket: dummyPlayerSocket,
    });

    const hostNewProducerEmits = io.emitTracker.filter(
      ({ args }) =>
        args[0] === SOCKET_EVENTS.STREAM.NEW_PRODUCER &&
        args[1].producerId === hostProducerId
    );

    expect(hostNewProducerEmits.length).toBeGreaterThan(0);
    expect(hostNewProducerEmits[0].args[1]).toMatchObject({
      producerId: hostProducerId,
      role: 'HOST',
    });
  });

  // ─────────────────────────────────────────────
  // בדיקה 2: JOIN מחזיר currentProducers עם roles
  // ─────────────────────────────────────────────

  it('2a. JOIN מחזיר currentProducers עם כל producers ו-roles שלהם', async () => {
    const hostSocket = createMockSocket('host-socket-2a', 'host-user');
    const playerSocket = createMockSocket('player-socket-2a', 'player-user');

    // player-user רשום כ-PLAYER; host-user אין לו GameParticipant
    // ולכן יזוהה כ-HOST דרך ה-fallback ל-Stream.hostId
    setGameParticipantRole('player-user', 'PLAYER');

    const { hostProducerId, playerProducers } = await setupRoomWithProducer({
      io,
      streamId,
      hostSocket,
      playerSocket,
      producerCount: 2, // וידאו ואודיו
    });

    // צופה חדש עושה JOIN
    const viewerSocket = createMockSocket('viewer-socket-2a', 'viewer-user');
    registerStreamHandlers(io, viewerSocket);

    const joinCb = vi.fn();
    await viewerSocket.handlers[SOCKET_EVENTS.STREAM.JOIN](
      { streamId },
      joinCb
    );

    // בדוק את הresponse של JOIN
    const response = joinCb.mock.calls[0][0];
    expect(response).toHaveProperty('currentProducers');
    expect(Array.isArray(response.currentProducers)).toBe(true);

    // צריכים 3 producers: 1 של host + 2 של player
    expect(response.currentProducers.length).toBe(3);

    // בדוק structure של כל producer
    response.currentProducers.forEach((p) => {
      expect(p).toHaveProperty('producerId');
      expect(p).toHaveProperty('role');
      expect(['HOST', 'PLAYER', 'VIEWER']).toContain(p.role);
    });

    // בדוק ש-HOST בעל הrole הנכון
    const hostProducerInList = response.currentProducers.find(
      (p) => p.producerId === hostProducerId
    );
    expect(hostProducerInList.role).toBe('HOST');

    // בדוק ש-PLAYERs בעלי הrole הנכון
    const playerProducersInList = response.currentProducers.filter((p) =>
      playerProducers.map((pr) => pr.id).includes(p.producerId)
    );
    playerProducersInList.forEach((p) => {
      expect(p.role).toBe('PLAYER');
    });
  });

  it('2b. JOIN מחזיר currentProducers עם ברירת מחדל VIEWER אם role לא נמצא', async () => {
    const hostSocket = createMockSocket('host-socket-2b', 'host-user');
    const playerSocket = createMockSocket('player-socket-2b', 'player-user');

    // player — PLAYER
    setGameParticipantRole('player-user', 'PLAYER');

    const { playerProducers } = await setupRoomWithProducer({
      io,
      streamId,
      hostSocket,
      playerSocket,
    });

    // בדיוק לפני JOIN, נמחוק את הrole מהزיכרון (edge case)
    // כדי לבדוק שJOIN עדיין מחזיר VIEWER כברירת מחדל
    const streamRoom = streams[streamId];
    if (streamRoom.producerRoles) {
      delete streamRoom.producerRoles[playerProducers[0].id];
    }

    const viewerSocket = createMockSocket('viewer-socket-2b', 'viewer-user');
    registerStreamHandlers(io, viewerSocket);

    const joinCb = vi.fn();
    await viewerSocket.handlers[SOCKET_EVENTS.STREAM.JOIN](
      { streamId },
      joinCb
    );

    const response = joinCb.mock.calls[0][0];
    const deletedProducerInList = response.currentProducers.find(
      (p) => p.producerId === playerProducers[0].id
    );

    expect(deletedProducerInList.role).toBe('VIEWER');
  });

  // ─────────────────────────────────────────────
  // בדיקה 3: JOIN מחזיר currentProducerId של HOST
  // ─────────────────────────────────────────────

  it('3a. JOIN מחזיר currentProducerId שהוא ID של ה-HOST', async () => {
    const hostSocket = createMockSocket('host-socket-3a', 'host-user');
    const playerSocket = createMockSocket('player-socket-3a', 'player-user');

    const { hostProducerId } = await setupRoomWithProducer({
      io,
      streamId,
      hostSocket,
      playerSocket,
    });

    const viewerSocket = createMockSocket('viewer-socket-3a', 'viewer-user');
    registerStreamHandlers(io, viewerSocket);

    const joinCb = vi.fn();
    await viewerSocket.handlers[SOCKET_EVENTS.STREAM.JOIN](
      { streamId },
      joinCb
    );

    const response = joinCb.mock.calls[0][0];
    expect(response).toHaveProperty('currentProducerId');
    expect(response.currentProducerId).toBe(hostProducerId);
  });

  it('3b. JOIN מחזיר currentProducerId=null אם HOST עדיין לא משדר', async () => {
    const hostSocket = createMockSocket('host-socket-3b', 'host-user');

    // יוצרים חדר בלי שהhost משדר (זה אפשרי)
    registerStreamHandlers(io, hostSocket);
    const createRoomCb = vi.fn();
    await hostSocket.handlers[SOCKET_EVENTS.STREAM.CREATE_ROOM](
      { streamId },
      createRoomCb
    );
    streams[streamId].router = { rtpCapabilities: {}, close: vi.fn() };

    // צופה עושה JOIN
    const viewerSocket = createMockSocket('viewer-socket-3b', 'viewer-user');
    registerStreamHandlers(io, viewerSocket);

    const joinCb = vi.fn();
    await viewerSocket.handlers[SOCKET_EVENTS.STREAM.JOIN](
      { streamId },
      joinCb
    );

    const response = joinCb.mock.calls[0][0];
    expect(response.currentProducerId).toBeNull();
  });

  // ─────────────────────────────────────────────
  // בדיקה 4: ניקוי producerRoles
  // ─────────────────────────────────────────────

  it('4a. כשproducer נסגר, הrole שלו נמחק מ-producerRoles', async () => {
    const hostSocket = createMockSocket('host-socket-4a', 'host-user');
    const playerSocket = createMockSocket('player-socket-4a', 'player-user');

    const { playerProducers } = await setupRoomWithProducer({
      io,
      streamId,
      hostSocket,
      playerSocket,
    });

    const playerProducer = playerProducers[0];

    // בדוק שה-role קיים לפני הsignal
    let streamRoom = streams[streamId];
    expect(streamRoom.producerRoles[playerProducer.id]).toBeDefined();

    // מפעילים את observer.on('close') callback
    const closeCallback = playerProducer.observer.on.mock.calls[0][1];
    closeCallback();

    // בדוק שהrole נמחק
    streamRoom = streams[streamId];
    expect(streamRoom.producerRoles[playerProducer.id]).toBeUndefined();
  });

  it('4b. handleCloseStream מאפס את producerRoles לאובייקט ריק', async () => {
    const hostSocket = createMockSocket('host-socket-4b', 'host-user');
    const playerSocket = createMockSocket('player-socket-4b', 'player-user');

    await setupRoomWithProducer({
      io,
      streamId,
      hostSocket,
      playerSocket,
      producerCount: 2,
    });

    // מלא producerRoles, ותפיסת רפרנס ל-streamRoom *לפני* הקריאה —
    // הרפרנס נשאר תקף גם אחרי delete streams[streamId] בתוך הפונקציה
    const streamRoom = streams[streamId];
    expect(Object.keys(streamRoom.producerRoles).length).toBeGreaterThan(0);

    await handleCloseStream(streamId, io);

    // בודקים בפועל שה-map התאפס לאובייקט ריק, לא רק שאין שגיאה
    expect(streamRoom.producerRoles).toEqual({});
    expect(() => handleCloseStream(streamId, io)).not.toThrow();
  });

  // ─────────────────────────────────────────────
  // בדיקה 5: HOST זוהה כ-HOST דרך Stream.hostId
  // ─────────────────────────────────────────────

  it('5a. HOST משדר לפני game — זוהה כ-HOST דרך fallback', async () => {
    const hostSocket = createMockSocket('host-socket-5a', 'host-user');
    const dummySocket = createMockSocket('dummy-socket', 'dummy-user');

    // host-user לא רשום ב-GameParticipant (לא קוראים ל-setGameParticipantRole
    // בשבילו) -> findFirst יחזיר null -> נופל ל-fallback של Stream.hostId

    const { hostProducerId } = await setupRoomWithProducer({
      io,
      streamId,
      hostSocket,
      playerSocket: dummySocket,
    });

    // בדוק שNEW_PRODUCER נשלח עם role=HOST
    const newProducerEmits = io.emitTracker.filter(
      ({ args }) =>
        args[0] === SOCKET_EVENTS.STREAM.NEW_PRODUCER &&
        args[1].producerId === hostProducerId
    );

    expect(newProducerEmits.length).toBeGreaterThan(0);
    expect(newProducerEmits[0].args[1].role).toBe('HOST');

    // בדוק שproducerRoles מכיל את ה-HOST
    const streamRoom = streams[streamId];
    expect(streamRoom.producerRoles[hostProducerId]).toBe('HOST');
  });

  it('5b. HOST זוהה כ-HOST גם עם GameParticipant (לא fallback)', async () => {
    const hostSocket = createMockSocket('host-socket-5b', 'host-user');
    const dummySocket = createMockSocket('dummy-socket', 'dummy-user');

    // HOST הוא גם שחקן רשום במשחק (יש GameParticipant), לא רק fallback
    setGameParticipantRole('host-user', 'HOST');

    const { hostProducerId } = await setupRoomWithProducer({
      io,
      streamId,
      hostSocket,
      playerSocket: dummySocket,
    });

    const newProducerEmits = io.emitTracker.filter(
      ({ args }) =>
        args[0] === SOCKET_EVENTS.STREAM.NEW_PRODUCER &&
        args[1].producerId === hostProducerId
    );

    expect(newProducerEmits[0].args[1].role).toBe('HOST');
  });

  it('5c. HOST מבצע PRODUCE לפני שנוצר game — JOIN מחזיר gameId=null אך role=HOST תקין', async () => {
    const hostSocket = createMockSocket('host-socket-5c', 'host-user');
    const dummySocket = createMockSocket('dummy-socket-5c', 'dummy-user');

    // מדמה מצב שבו עדיין אין game פעיל ב-DB עבור הstream הזה
    mockGameFindFirst.mockResolvedValueOnce(null);

    const { hostProducerId } = await setupRoomWithProducer({
      io,
      streamId,
      hostSocket,
      playerSocket: dummySocket,
    });

    const viewerSocket = createMockSocket('viewer-socket-5c', 'viewer-user');
    registerStreamHandlers(io, viewerSocket);

    const joinCb = vi.fn();
    await viewerSocket.handlers[SOCKET_EVENTS.STREAM.JOIN](
      { streamId },
      joinCb
    );

    const response = joinCb.mock.calls[0][0];

    // ה-role של ה-HOST נכון למרות שאין game
    const hostInList = response.currentProducers.find(
      (p) => p.producerId === hostProducerId
    );
    expect(hostInList.role).toBe('HOST');
    expect(response.currentProducerId).toBe(hostProducerId);

    // ובנוסף — בדיקת הפער שלא היה מכוסה ב-5a: gameId חוזר null
    expect(response.gameId).toBeNull();
  });

  // ─────────────────────────────────────────────
  // בדיקה 6: סגירה מלאה של שידור
  // ─────────────────────────────────────────────

  it('6. סגירת שידור מלאה — stream:ended משודר', async () => {
    const hostSocket = createMockSocket('host-socket-6', 'host-user');
    const playerSocket = createMockSocket('player-socket-6', 'player-user');

    await setupRoomWithProducer({
      io,
      streamId,
      hostSocket,
      playerSocket,
    });

    io.emitTracker.length = 0; // ניקוי עד כה

    // קרא לhandleCloseStream
    await handleCloseStream(streamId, io);

    // בדוק שstream:ended משודר
    const endedEmits = io.emitTracker.filter(
      ({ args }) => args[0] === SOCKET_EVENTS.STREAM.ENDED
    );

    expect(endedEmits.length).toBeGreaterThan(0);
    expect(endedEmits[0].args[1]).toMatchObject({ streamId });

    // בדוק שהstream נמחק
    expect(streams[streamId]).toBeUndefined();
  });

  // ─────────────────────────────────────────────
  // בדיקה 7: אינטגרציה מלאה
  // ─────────────────────────────────────────────

  it('7. סיקנריו שלם: PRODUCE → NEW_PRODUCER → JOIN → מקבלים roles נכונים', async () => {
    const hostSocket = createMockSocket('host-socket-7', 'host-user');
    const playerSocket = createMockSocket('player-socket-7', 'player-user');

    // player-user רשום כ-PLAYER; host-user נשאר ללא רשומה ומזוהה
    // כ-HOST דרך fallback ל-Stream.hostId
    setGameParticipantRole('player-user', 'PLAYER');

    const { hostProducerId, playerProducers } = await setupRoomWithProducer({
      io,
      streamId,
      hostSocket,
      playerSocket,
      producerCount: 2,
    });

    // צופה חדש עושה JOIN
    const viewerSocket = createMockSocket('viewer-socket-7', 'viewer-user');
    registerStreamHandlers(io, viewerSocket);

    const joinCb = vi.fn();
    await viewerSocket.handlers[SOCKET_EVENTS.STREAM.JOIN](
      { streamId },
      joinCb
    );

    const response = joinCb.mock.calls[0][0];

    // ✓ הroles נכונים
    expect(response.currentProducers.length).toBe(3); // 1 host + 2 player
    expect(response.currentProducerId).toBe(hostProducerId);

    const hostInList = response.currentProducers.find(
      (p) => p.producerId === hostProducerId
    );
    expect(hostInList.role).toBe('HOST');

    const playersInList = response.currentProducers.filter((p) =>
      playerProducers.map((pr) => pr.id).includes(p.producerId)
    );
    playersInList.forEach((p) => {
      expect(p.role).toBe('PLAYER');
    });

    // ✓ NEW_PRODUCER נשלח כשדברים נוצרו
    const newProducerEmits = io.emitTracker.filter(
      ({ args }) => args[0] === SOCKET_EVENTS.STREAM.NEW_PRODUCER
    );
    expect(newProducerEmits.length).toBeGreaterThan(0);
  });

  // ─────────────────────────────────────────────
  // בדיקה 8: טיפול בכשל DB ב-validateParticipantRole (finding 1, תגובה #15190).
  // הבדיקה המקורית 8b (race: producer נסגר בזמן שה-role resolve) הוסרה —
  // אחרי הזזת role+cap check לפני transport.produce() (SCRUM-250 code
  // review), התרחיש הזה בלתי אפשרי מבנית: אין יותר producer קיים בזמן
  // שה-role עדיין ממתין.
  // ─────────────────────────────────────────────

  it('8a. כשל DB ב-validateParticipantRole — producer נסגר ומנוקה, callback מקבל error, אין דליפה', async () => {
    const hostSocket = createMockSocket('host-socket-8a', 'host-user');
    registerStreamHandlers(io, hostSocket);

    const createRoomCb = vi.fn();
    await hostSocket.handlers[SOCKET_EVENTS.STREAM.CREATE_ROOM](
      { streamId },
      createRoomCb
    );
    streams[streamId].router = { rtpCapabilities: {}, close: vi.fn() };

    const closeSpy = vi.fn();
    const hostTransport = {
      id: 'transport-host-8a',
      on: vi.fn(),
      produce: vi.fn().mockResolvedValue({
        id: 'producer-8a',
        observer: { on: vi.fn() },
        close: closeSpy,
      }),
    };
    msService.createWebRtcTransport.mockResolvedValue(hostTransport);

    const transportCb = vi.fn();
    await hostSocket.handlers[SOCKET_EVENTS.STREAM.CREATE_TRANSPORT](
      { streamId },
      transportCb
    );
    const transportId = transportCb.mock.calls[0][0].id;

    // מדמים כשל DB אמיתי ב-gameParticipant.findFirst (השלב הראשון בתוך validateParticipantRole)
    mockGameParticipantFindFirst.mockRejectedValueOnce(
      new Error('DB connection lost')
    );

    const produceCb = vi.fn();
    await hostSocket.handlers[SOCKET_EVENTS.STREAM.PRODUCE](
      {
        transportId,
        kind: 'video',
        rtpParameters: { codecs: [{}], encodings: [{}] },
        streamId,
      },
      produceCb
    );

    expect(hostTransport.produce).not.toHaveBeenCalled();

    // הcallback קיבל error ולא id — הקליינט יודע שה-produce נכשל
    expect(produceCb.mock.calls[0][0]).toHaveProperty('error');
    expect(produceCb.mock.calls[0][0]).not.toHaveProperty('id');

    // אין producer "רפאים" שנשאר רשום בחדר
    const streamRoom = streams[streamId];
    expect(streamRoom.producers?.['producer-8a']).toBeUndefined();

    // לא שודר NEW_PRODUCER עבור producer שמעולם לא קיבל role תקין
    const leakedEmits = io.emitTracker.filter(
      ({ args }) =>
        args[0] === SOCKET_EVENTS.STREAM.NEW_PRODUCER &&
        args[1].producerId === 'producer-8a'
    );
    expect(leakedEmits.length).toBe(0);
  });

  // ─────────────────────────────────────────────
  // בדיקה 9: חוזה 6-השדות הקנוני של NEW_PRODUCER (SCRUM-203 / FINDINGS M4-14)
  // נועל את צורת ה-payload כדי שלא תיסחף שוב — S4 fan-out מתבסס עליה.
  // ─────────────────────────────────────────────

  it('9a. NEW_PRODUCER נושא את כל 6 שדות החוזה הקנוני', async () => {
    const hostSocket = createMockSocket('host-socket-9a', 'host-user');
    const playerSocket = createMockSocket('player-socket-9a', 'player-user');
    setGameParticipantRole('player-user', 'PLAYER');

    const { playerProducers } = await setupRoomWithProducer({
      io,
      streamId,
      hostSocket,
      playerSocket,
    });
    const playerProducer = playerProducers[0];

    const emit = io.emitTracker.find(
      ({ args }) =>
        args[0] === SOCKET_EVENTS.STREAM.NEW_PRODUCER &&
        args[1].producerId === playerProducer.id
    );
    const payload = emit.args[1];

    // ערכים דטרמיניסטיים: producerId / role / streamId / userId
    expect(payload).toMatchObject({
      producerId: playerProducer.id,
      role: 'PLAYER',
      streamId,
      userId: 'player-user',
    });
    // נוכחות שדות מצב-המדיה (הערכים מגיעים מ-producer.kind/paused בפרודקשן;
    // כאן המוק לא מגדיר אותם, אבל החוזה מחייב שהמפתחות ישודרו)
    expect(payload).toHaveProperty('kind');
    expect(payload).toHaveProperty('paused');
    expect(Object.keys(payload).sort()).toEqual(
      ['kind', 'paused', 'producerId', 'role', 'streamId', 'userId'].sort()
    );
  });

  it('9b. JOIN currentProducers נושא userId לכל producer', async () => {
    const hostSocket = createMockSocket('host-socket-9b', 'host-user');
    const playerSocket = createMockSocket('player-socket-9b', 'player-user');
    setGameParticipantRole('player-user', 'PLAYER');

    const { hostProducerId, playerProducers } = await setupRoomWithProducer({
      io,
      streamId,
      hostSocket,
      playerSocket,
      producerCount: 2,
    });

    const viewerSocket = createMockSocket('viewer-socket-9b', 'viewer-user');
    registerStreamHandlers(io, viewerSocket);
    const joinCb = vi.fn();
    await viewerSocket.handlers[SOCKET_EVENTS.STREAM.JOIN](
      { streamId },
      joinCb
    );
    const { currentProducers } = joinCb.mock.calls[0][0];

    currentProducers.forEach((p) => expect(p).toHaveProperty('userId'));
    expect(
      currentProducers.find((p) => p.producerId === hostProducerId).userId
    ).toBe('host-user');
    playerProducers.forEach((pr) => {
      expect(currentProducers.find((p) => p.producerId === pr.id).userId).toBe(
        'player-user'
      );
    });
  });
});
