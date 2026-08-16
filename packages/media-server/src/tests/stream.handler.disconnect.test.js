import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────

const { mockFindFirst } = vi.hoisted(() => ({
  mockFindFirst: vi.fn().mockResolvedValue({ role: 'PLAYER' }),
}));

vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn().mockImplementation(function PrismaClient() {
    return {
      stream: { update: vi.fn() },
      game: { findFirst: vi.fn() },
      gameParticipant: { findFirst: mockFindFirst },
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
  SOCKET_EVENTS: {
    SYSTEM: {
      DISCONNECT: 'disconnect',
    },
    STREAM: {
      CREATE_ROOM: 'stream:create_room',
      CREATE_TRANSPORT: 'stream:create_transport',
      PRODUCE: 'stream:produce',
      PRODUCER_CLOSED: 'stream:producer_closed',
      NEW_PRODUCER: 'stream:new_producer',
      JOIN: 'stream:join',
      ENDED: 'stream:ended',
    },
  },
}));

import { registerStreamHandlers, streams } from '../sockets/stream.handler.js';
import * as msService from '../services/mediasoup.service.js';
import { SOCKET_EVENTS } from '@worldplay/shared';

// ─────────────────────────────────────────────
// עזר ליצירת socket מזויף עם תפיסת ה-handlers הרשומים
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
  };
}

function createMockIo() {
  return {
    to: vi.fn().mockReturnValue({ emit: vi.fn() }),
  };
}

// ─────────────────────────────────────────────
// תרחיש בסיס: יצירת חדר, יצירת transport, ואז PRODUCE
// כדי לקבל producer "אמיתי" מנקודת המבט של הקוד הנבדק
// ─────────────────────────────────────────────

async function setupRoomWithProducer({
  io,
  streamId,
  hostSocket,
  playerSocket,
  producerCount = 1,
}) {
  // ה-host יוצר את החדר
  registerStreamHandlers(io, hostSocket);
  const createRoomCb = vi.fn();
  await hostSocket.handlers[SOCKET_EVENTS.STREAM.CREATE_ROOM](
    { streamId },
    createRoomCb
  );
  // מזריקים router מינימלי שתומך ב-rtpCapabilities (לא בשימוש ישיר בטסט הזה)
  streams[streamId].router = { rtpCapabilities: {}, close: vi.fn() };

  // השחקן נרשם על אותו socket instance ויוצר transport
  registerStreamHandlers(io, playerSocket);

  // נוצר producer "אמיתי" בכל קריאה, ונשמר ישירות במערך הזה -
  // כך לא תלויים ב-mock.results הפנימי של vitest, שמתנהג שונה בין גרסאות
  const createdProducers = [];
  const fakeTransport = {
    id: 'transport-1',
    iceParameters: {},
    iceCandidates: [],
    dtlsParameters: {},
    on: vi.fn(),
    produce: vi.fn().mockImplementation(async () => {
      const newProducer = {
        id: `producer-${Math.random().toString(36).slice(2)}`,
        observer: { on: vi.fn() },
        close: vi.fn(),
      };
      createdProducers.push(newProducer);
      return newProducer;
    }),
  };
  msService.createWebRtcTransport.mockResolvedValue(fakeTransport);

  const createTransportCb = vi.fn();
  await playerSocket.handlers[SOCKET_EVENTS.STREAM.CREATE_TRANSPORT](
    { streamId },
    createTransportCb
  );
  const { id: transportId } = createTransportCb.mock.calls[0][0];

  // יצירת producerCount producers על אותו socket - לדוגמה וידאו + אודיו
  // של אותו שחקן, בדיוק כפי שקורה בפועל בשידור אמיתי
  const kinds = ['video', 'audio'];
  for (let i = 0; i < producerCount; i += 1) {
    const produceCb = vi.fn();

    await playerSocket.handlers[SOCKET_EVENTS.STREAM.PRODUCE](
      {
        transportId,
        kind: kinds[i % kinds.length],
        rtpParameters: { codecs: [{}], encodings: [{}] },
        streamId,
      },
      produceCb
    );
  }

  return {
    fakeTransport,
    producer: createdProducers[0],
    producers: createdProducers,
  };
}

// ─────────────────────────────────────────────
// טסטים
// ─────────────────────────────────────────────

describe('stream.handler — ניתוק שחקן בודד (PRODUCER_CLOSED)', () => {
  let io;
  const streamId = 'stream-test-1';

  beforeEach(() => {
    vi.clearAllMocks();
    mockFindFirst.mockResolvedValue({ role: 'PLAYER' });
    // ניקוי מצב גלובלי בין טסטים (streams הוא Map-like object מיוצא)
    Object.keys(streams).forEach((key) => delete streams[key]);
    io = createMockIo();
  });

  it('1. כש-producer נסגר ידנית (לא ע"י host), משודר PRODUCER_CLOSED עם producerId נכון', async () => {
    const hostSocket = createMockSocket('host-socket-1', 'host-user');
    const playerSocket = createMockSocket('player-socket-1', 'player-user');

    const { producer } = await setupRoomWithProducer({
      io,
      streamId,
      hostSocket,
      playerSocket,
    });

    // הפעלת ה-callback שנרשם ל-observer, כפי שmediasoup היה עושה בפועל
    producer.observer.on.mock.calls[0][1](); // מפעילים את ה-close callback

    expect(io.to).toHaveBeenCalledWith(streamId);
    const emitMock = io.to.mock.results[0].value.emit;
    expect(emitMock).toHaveBeenCalledWith(
      SOCKET_EVENTS.STREAM.PRODUCER_CLOSED,
      expect.objectContaining({
        producerId: producer.id,
        streamId,
      })
    );
  });

  it('2. כש-producer של ה-HOST נסגר, לא משודר PRODUCER_CLOSED', async () => {
    const hostSocket = createMockSocket('host-socket-2', 'host-user');

    const { producer } = await setupRoomWithProducer({
      io,
      streamId,
      hostSocket,
      playerSocket: hostSocket, // ה-host עצמו מפיק (למשל מצלמת השידור הראשית)
    });

    io.to.mockClear();

    producer.observer.on.mock.calls[0][1]();

    expect(io.to).not.toHaveBeenCalled();
  });

  it('3. ניתוק socket של שחקן סוגר את כל ה-producers שלו', async () => {
    const hostSocket = createMockSocket('host-socket-3', 'host-user');
    const playerSocket = createMockSocket('player-socket-3', 'player-user');

    const { producer } = await setupRoomWithProducer({
      io,
      streamId,
      hostSocket,
      playerSocket,
    });

    // מפעילים את אירוע ה-disconnect של אותו socket
    await playerSocket.handlers[SOCKET_EVENTS.SYSTEM.DISCONNECT]();

    expect(producer.close).toHaveBeenCalledTimes(1);
  });

  it('4. אחרי ניתוק, לא נשלחת קריאת close כפולה (אין מצב race על אותו producer)', async () => {
    const hostSocket = createMockSocket('host-socket-4', 'host-user');
    const playerSocket = createMockSocket('player-socket-4', 'player-user');

    const { producer } = await setupRoomWithProducer({
      io,
      streamId,
      hostSocket,
      playerSocket,
    });

    await playerSocket.handlers[SOCKET_EVENTS.SYSTEM.DISCONNECT]();
    await playerSocket.handlers[SOCKET_EVENTS.SYSTEM.DISCONNECT](); // ניתוק כפול היפותטי

    // בדיקה ישירה: אם המיפוי socketToProducers לא היה מתנקה אחרי
    // הניתוק הראשון, producer.close() היה נקרא שוב בניתוק השני.
    // קריאה יחידה מוכיחה שהניקוי הפנימי באמת קורה, לא רק שאין קריסה.
    expect(producer.close).toHaveBeenCalledTimes(1);
  });

  it('5. שחקן עם כמה producers (וידאו + אודיו) — ניתוק סוגר את כולם', async () => {
    const hostSocket = createMockSocket('host-socket-5', 'host-user');
    const playerSocket = createMockSocket('player-socket-5', 'player-user');

    const { producers } = await setupRoomWithProducer({
      io,
      streamId,
      hostSocket,
      playerSocket,
      producerCount: 2, // וידאו + אודיו על אותו socket
    });

    expect(producers).toHaveLength(2);

    await playerSocket.handlers[SOCKET_EVENTS.SYSTEM.DISCONNECT]();

    // שני ה-producers (גם הוידאו וגם האודיו) חייבים להיסגר -
    // לא רק הראשון שנוצר. זה בודק שה-Set ב-socketToProducers
    // אכן צובר את כל ה-producers של אותו socket, לא רק את האחרון.
    producers.forEach((p) => {
      expect(p.close).toHaveBeenCalledTimes(1);
    });
  });

  it('6. שחקן עם כמה producers — לכל producer שנסגר משודר PRODUCER_CLOSED נפרד', async () => {
    const hostSocket = createMockSocket('host-socket-6', 'host-user');
    const playerSocket = createMockSocket('player-socket-6', 'player-user');

    // io נפרד שמאפשר לאסוף emit-ים אחרי שלב ה-PRODUCE בלבד
    const ioForTest = createMockIo();
    const emitsAfterSetup = [];
    ioForTest.to.mockImplementation((room) => ({
      emit: vi.fn((...args) => emitsAfterSetup.push({ room, args })),
    }));

    const { producers } = await setupRoomWithProducer({
      io: ioForTest,
      streamId,
      hostSocket,
      playerSocket,
      producerCount: 2,
    });

    // מאפסים — כל מה שנאסף עד כה הוא new_producer משלב ה-PRODUCE
    emitsAfterSetup.length = 0;

    await playerSocket.handlers[SOCKET_EVENTS.SYSTEM.DISCONNECT]();

    // מפעילים ידנית את ה-observer של כל producer (mediasoup אמיתי היה עושה זאת)
    producers.forEach((p) => {
      p.observer.on.mock.calls[0][1]();
    });

    const producerClosedEmits = emitsAfterSetup.filter(
      ({ args }) => args[0] === SOCKET_EVENTS.STREAM.PRODUCER_CLOSED
    );
    const emittedIds = producerClosedEmits.map(
      ({ args }) => args[1].producerId
    );

    expect(emittedIds).toEqual(
      expect.arrayContaining([producers[0].id, producers[1].id])
    );
    expect(producerClosedEmits).toHaveLength(2);
  });

  it('7. ניתוק שחקן אחד לא פוגע בשחקן השני — בידוד מלא', async () => {
    // זהו "לב הכרטיס":
    // הבעיה שהטיקט נועד לפתור היא ניתוק גרנולרי — רק הריבוע של
    // השחקן שהתנתק נמחק, בלי לפגוע בשאר.
    // הטסט הזה בודק בדיוק את זה: שני שחקנים, רק אחד מתנתק,
    // ומוודא ש-producer של השני לא נסגר ולא שודר עליו אירוע.
    const hostSocket = createMockSocket('host-socket-7', 'host-user');
    const playerASocket = createMockSocket('player-socket-7a', 'player-a');
    const playerBSocket = createMockSocket('player-socket-7b', 'player-b');

    // io נפרד לטסט הזה כדי לאסוף את כל קריאות ה-emit בצורה נקייה
    const ioForTest = createMockIo();
    const allEmits = [];
    ioForTest.to.mockImplementation((room) => ({
      emit: vi.fn((...args) => allEmits.push({ room, args })),
    }));

    // שחקן A נרשם ויוצר producer
    const { producer: producerA } = await setupRoomWithProducer({
      io: ioForTest,
      streamId,
      hostSocket,
      playerSocket: playerASocket,
    });

    // שחקן B נרשם ויוצר producer על אותו חדר
    registerStreamHandlers(ioForTest, playerBSocket);
    const createdProducersB = [];
    const fakeTransportB = {
      id: 'transport-7b',
      iceParameters: {},
      iceCandidates: [],
      dtlsParameters: {},
      on: vi.fn(),
      produce: vi.fn().mockImplementation(async () => {
        const p = {
          id: `producer-b-${Math.random().toString(36).slice(2)}`,
          observer: { on: vi.fn() },
          close: vi.fn(),
        };
        createdProducersB.push(p);
        return p;
      }),
    };
    msService.createWebRtcTransport.mockResolvedValue(fakeTransportB);

    const transportBCb = vi.fn();
    await playerBSocket.handlers[SOCKET_EVENTS.STREAM.CREATE_TRANSPORT](
      { streamId },
      transportBCb
    );
    const { id: transportBId } = transportBCb.mock.calls[0][0];

    const produceBCb = vi.fn();
    await playerBSocket.handlers[SOCKET_EVENTS.STREAM.PRODUCE](
      {
        transportId: transportBId,
        kind: 'video',
        rtpParameters: { codecs: [{}], encodings: [{}] },
        streamId,
      },
      produceBCb
    );
    const producerB = createdProducersB[0];

    // מנתקים רק את שחקן A
    await playerASocket.handlers[SOCKET_EVENTS.SYSTEM.DISCONNECT]();
    // מפעילים את ה-observer של A (mediasoup היה עושה זאת אוטומטית)
    producerA.observer.on.mock.calls[0][1]();

    // ✓ producer של A נסגר
    expect(producerA.close).toHaveBeenCalledTimes(1);

    // ✓ producer של B לא נסגר ולא נפגע
    expect(producerB.close).not.toHaveBeenCalled();

    // ✓ PRODUCER_CLOSED שודר רק עם producerId של A, לא של B
    const producerClosedEmits = allEmits.filter(
      ({ args }) => args[0] === SOCKET_EVENTS.STREAM.PRODUCER_CLOSED
    );
    expect(producerClosedEmits).toHaveLength(1);
    expect(producerClosedEmits[0].args[1].producerId).toBe(producerA.id);
    expect(producerClosedEmits[0].args[1].producerId).not.toBe(producerB.id);
  });

  it('8. סגירת שידור מלאה (isClosing=true) — producers של שחקנים נסגרים בשקט, ללא PRODUCER_CLOSED', async () => {
    // הבעיה שהדגל isClosing פותר:
    // כשה-host מתנתק, handleCloseStream קורא ל-router.close() שסוגר
    // את כל ה-producers של כולם. כל observer מתעורר ו"רוצה" לשדר
    // PRODUCER_CLOSED — אבל זה מיותר כי stream:ended כבר נשלח.
    // הדגל isClosing=true גורם ל-observer לדלג על ה-emit.
    // הטסט מוודא שהדגל אכן עובד.
    const hostSocket = createMockSocket('host-socket-8', 'host-user');
    const playerSocket = createMockSocket('player-socket-8', 'player-user');

    const { producer } = await setupRoomWithProducer({
      io,
      streamId,
      hostSocket,
      playerSocket,
    });

    io.to.mockClear();

    // מסמנים שהשידור בתהליך סגירה — בדיוק מה ש-handleCloseStream עושה
    // לפני ש-router.close() מפעיל את כל ה-observers
    streams[streamId].isClosing = true;

    // מפעילים את ה-observer ישירות — כפי שmediasoup עושה כש-router נסגר
    producer.observer.on.mock.calls[0][1]();

    // ✓ לא שודר PRODUCER_CLOSED — הדגל isClosing מנע את ה-emit
    expect(io.to).not.toHaveBeenCalled();
  });
});
