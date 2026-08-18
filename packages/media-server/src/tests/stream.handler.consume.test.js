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
      INIT_BROADCAST: 'stream:init_broadcast',
      CREATE_TRANSPORT: 'stream:create_transport',
      CONNECT_TRANSPORT: 'stream:connect_transport',
      PRODUCE: 'stream:produce',
      CONSUME: 'stream:consume',
      RESUME: 'stream:resume',
      JOIN: 'stream:join',
      START_RECORDING: 'stream:start_recording',
      ENDED: 'stream:ended',
      PRODUCER_CLOSED: 'stream:producer_closed',
      NEW_PRODUCER: 'stream:new_producer',
    },
  },
  ERROR_MESSAGES: {
    ROOM_NOT_FOUND: 'Room not found',
    TRANSPORT_NOT_FOUND: 'Transport not found',
    CANNOT_CONSUME: 'Cannot consume',
    CONSUMER_NOT_FOUND: 'Consumer not found',
  },
}));

import { registerStreamHandlers, streams } from '../sockets/stream.handler.js';
import * as msService from '../services/mediasoup.service.js';
import { ERROR_MESSAGES, SOCKET_EVENTS } from '@worldplay/shared';

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
// עזר: יצירת חדר עם transport מוכן לצריכה (consume)
// מחזיר את כל הכלים הדרושים לבדיקות consume ו-resume
// ─────────────────────────────────────────────

async function setupRoomForConsume({ io, streamId, hostSocket, viewerSocket }) {
  // ה-host יוצר את החדר
  registerStreamHandlers(io, hostSocket);
  const createRoomCb = vi.fn();
  await hostSocket.handlers[SOCKET_EVENTS.STREAM.CREATE_ROOM](
    { streamId },
    createRoomCb
  );

  // consumer מזויף שמדמה את ה-consumer האמיתי של mediasoup
  const fakeConsumer = {
    id: `consumer-${Math.random().toString(36).slice(2)}`,
    kind: 'video',
    rtpParameters: { codecs: [] },
    resume: vi.fn().mockResolvedValue(),
    on: vi.fn(),
  };

  // transport מזויף שתומך ב-consume
  const fakeTransport = {
    id: `transport-${Math.random().toString(36).slice(2)}`,
    iceParameters: {},
    iceCandidates: [],
    dtlsParameters: {},
    on: vi.fn(),
    consume: vi.fn().mockResolvedValue(fakeConsumer),
    produce: vi.fn(),
  };

  // router מזויף שמאפשר consume
  streams[streamId].router = {
    rtpCapabilities: {},
    close: vi.fn(),
    canConsume: vi.fn().mockReturnValue(true),
  };

  // שמירת ה-transport ישירות במפת החדר — כפי שה-CREATE_TRANSPORT handler עושה
  streams[streamId].transports.set(fakeTransport.id, fakeTransport);

  // רישום הצופה
  registerStreamHandlers(io, viewerSocket);
  msService.createWebRtcTransport.mockResolvedValue(fakeTransport);

  return { fakeTransport, fakeConsumer };
}

// ─────────────────────────────────────────────
// טסטים
// ─────────────────────────────────────────────

describe('stream.handler — CONSUME ו-RESUME (תיקון באג stream:resume)', () => {
  let io;
  const streamId = 'stream-consume-test';
  const producerId = 'producer-abc';
  const rtpCapabilities = { codecs: [] };

  beforeEach(() => {
    vi.clearAllMocks();
    mockFindFirst.mockResolvedValue({ role: 'PLAYER' });
    // ניקוי מצב גלובלי בין טסטים
    Object.keys(streams).forEach((key) => delete streams[key]);
    io = createMockIo();
  });

  // ─────────────────────────────────────────────
  // קבוצה 1: CONSUME handler
  // ─────────────────────────────────────────────

  it('1. CONSUME מחזיר את פרטי ה-consumer התקינים ל-callback', async () => {
    // בודק שה-callback מקבל את כל השדות שהקליינט צריך כדי לבנות את החיבור
    const hostSocket = createMockSocket('host-1', 'host-user');
    const viewerSocket = createMockSocket('viewer-1', 'viewer-user');

    const { fakeTransport, fakeConsumer } = await setupRoomForConsume({
      io,
      streamId,
      hostSocket,
      viewerSocket,
    });

    const cb = vi.fn();
    await viewerSocket.handlers[SOCKET_EVENTS.STREAM.CONSUME](
      {
        streamId,
        transportId: fakeTransport.id,
        producerId,
        rtpCapabilities,
      },
      cb
    );

    expect(cb).toHaveBeenCalledWith(
      expect.objectContaining({
        id: fakeConsumer.id,
        producerId,
        kind: fakeConsumer.kind,
        rtpParameters: fakeConsumer.rtpParameters,
      })
    );
  });

  it('2. CONSUME יוצר את ה-consumer עם paused: true — הצופה לא מקבל מדיה לפני שהוא מוכן', async () => {
    // זהו ליבת הבאג: לפני התיקון היה paused: false.
    // paused: true מבטיח שהשרת לא ישדר לפני שהקליינט אישר שהוא מוכן.
    const hostSocket = createMockSocket('host-2', 'host-user');
    const viewerSocket = createMockSocket('viewer-2', 'viewer-user');

    const { fakeTransport } = await setupRoomForConsume({
      io,
      streamId,
      hostSocket,
      viewerSocket,
    });

    const cb = vi.fn();
    await viewerSocket.handlers[SOCKET_EVENTS.STREAM.CONSUME](
      { streamId, transportId: fakeTransport.id, producerId, rtpCapabilities },
      cb
    );

    expect(fakeTransport.consume).toHaveBeenCalledWith(
      expect.objectContaining({ paused: true })
    );
  });

  it('3. CONSUME שומר את ה-consumer במפה הפנימית — ניתן למצוא אותו אחר כך ב-RESUME', async () => {
    // אם ה-consumer לא נשמר במפה, ה-RESUME handler לא יוכל למצוא אותו
    // ויחזיר שגיאה. הטסט מוכיח שהשמירה קורית על ידי כך שה-RESUME מצליח.
    const hostSocket = createMockSocket('host-3', 'host-user');
    const viewerSocket = createMockSocket('viewer-3', 'viewer-user');

    const { fakeTransport, fakeConsumer } = await setupRoomForConsume({
      io,
      streamId,
      hostSocket,
      viewerSocket,
    });

    // שלב א: consume — שומר את ה-consumer במפה
    const consumeCb = vi.fn();
    await viewerSocket.handlers[SOCKET_EVENTS.STREAM.CONSUME](
      { streamId, transportId: fakeTransport.id, producerId, rtpCapabilities },
      consumeCb
    );

    // שלב ב: resume — מצליח רק אם ה-consumer אכן נשמר
    const resumeCb = vi.fn();
    await viewerSocket.handlers[SOCKET_EVENTS.STREAM.RESUME](
      { consumerId: fakeConsumer.id },
      resumeCb
    );

    expect(resumeCb).toHaveBeenCalledWith({ success: true });
  });

  it('4. CONSUME מחזיר שגיאה אם החדר לא קיים', async () => {
    // הגנת קצה: צופה מנסה לצרוך ממיזרח שלא נוצר
    const viewerSocket = createMockSocket('viewer-4', 'viewer-user');
    registerStreamHandlers(io, viewerSocket);

    const cb = vi.fn();
    await viewerSocket.handlers[SOCKET_EVENTS.STREAM.CONSUME](
      {
        streamId: 'room-that-does-not-exist',
        transportId: 'some-transport',
        producerId,
        rtpCapabilities,
      },
      cb
    );

    expect(cb).toHaveBeenCalledWith({ error: ERROR_MESSAGES.ROOM_NOT_FOUND });
  });

  it('5. CONSUME מחזיר שגיאה אם ה-transport לא קיים בחדר', async () => {
    // הגנת קצה: transportId שגוי — השרת לא קורס אלא מחזיר שגיאה מסודרת
    const hostSocket = createMockSocket('host-5', 'host-user');
    const viewerSocket = createMockSocket('viewer-5', 'viewer-user');

    await setupRoomForConsume({ io, streamId, hostSocket, viewerSocket });

    const cb = vi.fn();
    await viewerSocket.handlers[SOCKET_EVENTS.STREAM.CONSUME](
      {
        streamId,
        transportId: 'transport-that-does-not-exist',
        producerId,
        rtpCapabilities,
      },
      cb
    );

    expect(cb).toHaveBeenCalledWith({
      error: ERROR_MESSAGES.TRANSPORT_NOT_FOUND,
    });
  });

  it('6. CONSUME מחזיר שגיאה אם ה-router לא יכול לצרוך את ה-producer', async () => {
    // הגנת קצה: rtpCapabilities לא תואמים את ה-producer —
    // השרת בודק זאת לפני היצירה ומחזיר שגיאה ברורה
    const hostSocket = createMockSocket('host-6', 'host-user');
    const viewerSocket = createMockSocket('viewer-6', 'viewer-user');

    const { fakeTransport } = await setupRoomForConsume({
      io,
      streamId,
      hostSocket,
      viewerSocket,
    });

    // מדמים מצב שבו ה-router דוחה את הבקשה
    streams[streamId].router.canConsume.mockReturnValue(false);

    const cb = vi.fn();
    await viewerSocket.handlers[SOCKET_EVENTS.STREAM.CONSUME](
      { streamId, transportId: fakeTransport.id, producerId, rtpCapabilities },
      cb
    );

    expect(cb).toHaveBeenCalledWith({ error: ERROR_MESSAGES.CANNOT_CONSUME });
  });

  // ─────────────────────────────────────────────
  // קבוצה 2: RESUME handler
  // ─────────────────────────────────────────────

  it('7. RESUME קורא ל-consumer.resume() ומחזיר success — emitPromise בקליינט מסתיים', async () => {
    // זהו הליבה השנייה של הבאג: לפני התיקון לא היה handler לאירוע הזה,
    // כך ש-emitPromise בקליינט היה תלוי לנצח.
    // עכשיו ה-handler קיים, קורא resume(), ומחזיר ACK.
    const hostSocket = createMockSocket('host-7', 'host-user');
    const viewerSocket = createMockSocket('viewer-7', 'viewer-user');

    const { fakeTransport, fakeConsumer } = await setupRoomForConsume({
      io,
      streamId,
      hostSocket,
      viewerSocket,
    });

    const consumeCb = vi.fn();
    await viewerSocket.handlers[SOCKET_EVENTS.STREAM.CONSUME](
      { streamId, transportId: fakeTransport.id, producerId, rtpCapabilities },
      consumeCb
    );

    const resumeCb = vi.fn();
    await viewerSocket.handlers[SOCKET_EVENTS.STREAM.RESUME](
      { consumerId: fakeConsumer.id },
      resumeCb
    );

    expect(fakeConsumer.resume).toHaveBeenCalledTimes(1);
    expect(resumeCb).toHaveBeenCalledWith({ success: true });
  });

  it('8. RESUME עם consumerId לא קיים מחזיר שגיאה ולא קורס', async () => {
    // הגנת קצה: consumerId שגוי — השרת מחזיר שגיאה ברורה במקום לקרוס
    const viewerSocket = createMockSocket('viewer-8', 'viewer-user');
    registerStreamHandlers(io, viewerSocket);

    const cb = vi.fn();
    await viewerSocket.handlers[SOCKET_EVENTS.STREAM.RESUME](
      { consumerId: 'consumer-that-does-not-exist' },
      cb
    );

    expect(cb).toHaveBeenCalledWith({
      error: ERROR_MESSAGES.CONSUMER_NOT_FOUND,
    });
  });

  it('9. RESUME לא מפעיל consumer של צופה אחר — בידוד מלא בין צופים', async () => {
    // בידוד: כל צופה מחזיק consumer משלו. resume של צופה א
    // לא אמור להשפיע על ה-consumer של צופה ב.
    const hostSocket = createMockSocket('host-9', 'host-user');
    const viewerASocket = createMockSocket('viewer-9a', 'viewer-a');
    const viewerBSocket = createMockSocket('viewer-9b', 'viewer-b');

    const { fakeTransport, fakeConsumer: consumerA } =
      await setupRoomForConsume({
        io,
        streamId,
        hostSocket,
        viewerSocket: viewerASocket,
      });

    // צופה B יוצר consumer נפרד עם transport נפרד
    registerStreamHandlers(io, viewerBSocket);
    const consumerB = {
      id: `consumer-b-${Math.random().toString(36).slice(2)}`,
      kind: 'video',
      rtpParameters: { codecs: [] },
      resume: vi.fn().mockResolvedValue(),
      on: vi.fn(),
    };
    const transportB = {
      id: `transport-b-${Math.random().toString(36).slice(2)}`,
      on: vi.fn(),
      consume: vi.fn().mockResolvedValue(consumerB),
    };
    streams[streamId].transports.set(transportB.id, transportB);

    // consume לשני הצופים
    await viewerASocket.handlers[SOCKET_EVENTS.STREAM.CONSUME](
      { streamId, transportId: fakeTransport.id, producerId, rtpCapabilities },
      vi.fn()
    );
    await viewerBSocket.handlers[SOCKET_EVENTS.STREAM.CONSUME](
      {
        streamId,
        transportId: transportB.id,
        producerId,
        rtpCapabilities,
      },
      vi.fn()
    );

    // resume רק לצופה A
    await viewerASocket.handlers[SOCKET_EVENTS.STREAM.RESUME](
      { consumerId: consumerA.id },
      vi.fn()
    );

    // ✓ רק consumer של A קיבל resume
    expect(consumerA.resume).toHaveBeenCalledTimes(1);
    // ✓ consumer של B לא נגע
    expect(consumerB.resume).not.toHaveBeenCalled();
  });

  // ─────────────────────────────────────────────
  // קבוצה 3: ניקוי consumers map
  // ─────────────────────────────────────────────

  it('10. סגירת transport מוחקת את ה-consumer מהמפה — אין memory leak', async () => {
    // כשחיבור הרשת של הצופה נסגר, ה-consumer כבר לא שמיש.
    // הטסט מוכיח שהמחיקה קורית על ידי כך שה-RESUME נכשל אחרי ה-transportclose.
    const hostSocket = createMockSocket('host-10', 'host-user');
    const viewerSocket = createMockSocket('viewer-10', 'viewer-user');

    const { fakeTransport, fakeConsumer } = await setupRoomForConsume({
      io,
      streamId,
      hostSocket,
      viewerSocket,
    });

    // שלב א: consume — שומר את ה-consumer במפה
    await viewerSocket.handlers[SOCKET_EVENTS.STREAM.CONSUME](
      { streamId, transportId: fakeTransport.id, producerId, rtpCapabilities },
      vi.fn()
    );

    // שלב ב: מדמים סגירת ה-transport (mediasoup מפעיל את האירוע הזה אוטומטית)
    const transportCloseHandler = fakeConsumer.on.mock.calls.find(
      ([event]) => event === 'transportclose'
    )[1];
    transportCloseHandler();

    // שלב ג: resume — אמור להיכשל כי ה-consumer נמחק מהמפה
    const resumeCb = vi.fn();
    await viewerSocket.handlers[SOCKET_EVENTS.STREAM.RESUME](
      { consumerId: fakeConsumer.id },
      resumeCb
    );

    expect(resumeCb).toHaveBeenCalledWith({
      error: ERROR_MESSAGES.CONSUMER_NOT_FOUND,
    });
  });

  it('11. סגירת transport של צופה א לא מוחקת את ה-consumer של צופה ב', async () => {
    // בידוד ניקוי: רק ה-consumer של הצופה שה-transport שלו נסגר
    // נמחק מהמפה. ה-consumer של הצופה השני נשאר פעיל.
    const hostSocket = createMockSocket('host-11', 'host-user');
    const viewerASocket = createMockSocket('viewer-11a', 'viewer-a');
    const viewerBSocket = createMockSocket('viewer-11b', 'viewer-b');

    const { fakeTransport, fakeConsumer: consumerA } =
      await setupRoomForConsume({
        io,
        streamId,
        hostSocket,
        viewerSocket: viewerASocket,
      });

    registerStreamHandlers(io, viewerBSocket);
    const consumerB = {
      id: `consumer-b-${Math.random().toString(36).slice(2)}`,
      kind: 'video',
      rtpParameters: { codecs: [] },
      resume: vi.fn().mockResolvedValue(),
      on: vi.fn(),
    };
    const transportB = {
      id: `transport-b-${Math.random().toString(36).slice(2)}`,
      on: vi.fn(),
      consume: vi.fn().mockResolvedValue(consumerB),
    };
    streams[streamId].transports.set(transportB.id, transportB);

    // consume לשני הצופים
    await viewerASocket.handlers[SOCKET_EVENTS.STREAM.CONSUME](
      { streamId, transportId: fakeTransport.id, producerId, rtpCapabilities },
      vi.fn()
    );
    await viewerBSocket.handlers[SOCKET_EVENTS.STREAM.CONSUME](
      { streamId, transportId: transportB.id, producerId, rtpCapabilities },
      vi.fn()
    );

    // סגירת transport של צופה A בלבד
    const transportCloseHandler = consumerA.on.mock.calls.find(
      ([event]) => event === 'transportclose'
    )[1];
    transportCloseHandler();

    // ✓ resume של צופה A נכשל — נמחק מהמפה
    const resumeACb = vi.fn();
    await viewerASocket.handlers[SOCKET_EVENTS.STREAM.RESUME](
      { consumerId: consumerA.id },
      resumeACb
    );
    expect(resumeACb).toHaveBeenCalledWith({
      error: ERROR_MESSAGES.CONSUMER_NOT_FOUND,
    });

    // ✓ resume של צופה B מצליח — לא נפגע
    const resumeBCb = vi.fn();
    await viewerBSocket.handlers[SOCKET_EVENTS.STREAM.RESUME](
      { consumerId: consumerB.id },
      resumeBCb
    );
    expect(resumeBCb).toHaveBeenCalledWith({ success: true });
  });

  it('12. producerclose מוחק את ה-consumer מהמפה — מונע memory leak כשהמפיק (שחקן) מתנתק', async () => {
    // ליבת התיקון: כשהשחקן (producer) מתנתק, mediasoup יורה 'producerclose'
    // על כל consumer שתלוי בו. לפני התיקון לא היה handler לאירוע הזה,
    // וה-consumer נשאר במפה לנצח. הטסט מוכיח שהמחיקה קורית, בדיוק
    // באותו דפוס כמו טסט 10 (שבודק את 'transportclose').
    const hostSocket = createMockSocket('host-12', 'host-user');
    const viewerSocket = createMockSocket('viewer-12', 'viewer-user');

    const { fakeTransport, fakeConsumer } = await setupRoomForConsume({
      io,
      streamId,
      hostSocket,
      viewerSocket,
    });

    // שלב א: consume — שומר את ה-consumer במפה
    await viewerSocket.handlers[SOCKET_EVENTS.STREAM.CONSUME](
      { streamId, transportId: fakeTransport.id, producerId, rtpCapabilities },
      vi.fn()
    );

    // שלב ב: מדמים ניתוק שחקן — mediasoup מפעיל 'producerclose' על ה-consumer
    const producerCloseHandler = fakeConsumer.on.mock.calls.find(
      ([event]) => event === 'producerclose'
    )[1];
    producerCloseHandler();

    // שלב ג: resume נכשל — הוכחה שה-consumer נמחק מהמפה
    const resumeCb = vi.fn();
    await viewerSocket.handlers[SOCKET_EVENTS.STREAM.RESUME](
      { consumerId: fakeConsumer.id },
      resumeCb
    );

    expect(resumeCb).toHaveBeenCalledWith({
      error: ERROR_MESSAGES.CONSUMER_NOT_FOUND,
    });
  });
});
