// packages/media-server/src/tests/stream.handler.viewer-count.test.js
//
// SCRUM: C5c — stream:viewer_count. מכסה: debounce/coalescing, נוסחת
// הספירה (room size − HOST/PLAYER producers), עלייה/ירידה בכל אירוע רלוונטי,
// בידוד בין שידורים, וטיפול בסגירת שידור. קבוצה F מתעדת פער ידוע ולא-פתור
// (סדר סיום כתיבות DB) — ר' הסבר בתחילת הקובץ.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { randomUUID } from 'node:crypto';

// ─────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────

const { mockStreamUpdate, mockGameParticipantFindFirst, mockStreamFindUnique } =
  vi.hoisted(() => ({
    mockStreamUpdate: vi.fn().mockResolvedValue({ id: 'stream-1' }),
    mockGameParticipantFindFirst: vi.fn(),
    mockStreamFindUnique: vi.fn().mockResolvedValue({ hostId: 'host-user' }),
  }));

vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn().mockImplementation(function PrismaClient() {
    return {
      stream: { update: mockStreamUpdate, findUnique: mockStreamFindUnique },
      game: { findFirst: vi.fn().mockResolvedValue({ id: 'game-1' }) },
      gameParticipant: { findFirst: mockGameParticipantFindFirst },
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
    ACTIVE_BROADCAST_EXISTS: 'Active broadcast exists',
    FAILED_TO_CREATE_STREAM_IN_DB: 'Failed to create stream',
    STREAM_ROOM_NOT_FOUND: 'Stream room not found',
    TRANSPORT_NOT_FOUND: 'Transport not found',
    KIND_REQUIRED: 'Kind is required',
    ROOM_NOT_CREATED: 'Room not created',
    ROOM_FULL: 'Room is full — maximum 4 active players reached',
    ROOM_NOT_FOUND: 'Room not found',
    CANNOT_CONSUME: 'Cannot consume',
    CONSUMER_NOT_FOUND: 'Consumer not found',
    FAILED_TO_RESUME_CONSUMER: 'Failed to resume consumer',
    PRODUCER_NOT_FOUND: 'Producer not found',
    NOT_PRODUCER_OWNER: 'Not the owner of this producer',
    STREAM_NOT_LIVE: 'Stream not live',
  },
  MAX_ACTIVE_PLAYERS: 4,
  SOCKET_EVENTS: {
    SYSTEM: { DISCONNECT: 'disconnect' },
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
      PRODUCER_PAUSE: 'stream:producer_pause',
      PRODUCER_PAUSED: 'stream:producer_paused',
      PRODUCER_RESUMED: 'stream:producer_resumed',
      VIEWER_COUNT: 'stream:viewer_count',
    },
  },
}));

import {
  registerStreamHandlers,
  streams,
  handleCloseStream,
} from '../sockets/stream.handler.js';
import * as msService from '../services/mediasoup.service.js';
import { SOCKET_EVENTS } from '@worldplay/shared';
import {
  createMockSocket,
  createMockIo,
  createRoomWithHost,
  produceFor,
  attachRoomTracking,
  simulateDisconnect,
} from './helpers/liveFlow.harness.js';

const DEBOUNCE_MS = 500;

// מקדם את ה-fake timers מעבר לחלון ה-debounce, וגם "משחרר" את ה-microtask
// queue כדי שה-await בתוך ה-setTimeout callback (prisma.stream.update)
// יספיק להיפתר לפני שהטסט ממשיך.
async function flushDebounce() {
  await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
}

// שרשרת viewerCountWriteChain (סריאליזציה) עוברת דרך כמה .then()/.catch()
// מקוננים בכל "חוליה" — כל חוליה נוספת בתור מוסיפה עוד כמה microtask hops.
// 2 קפיצות (כפי שהיה קודם) מספיקות לשרשרת פשוטה, אבל לא לתרחיש שבו כמה
// writes מחכים זה לזה ברצף (כמו בטסטים 17-18). מריצים הרבה קפיצות כדי
// להיות בטוחים שכל השרשרת, לא משנה כמה עמוקה, מספיקה להתיישב במלואה.
async function flushMicrotasks(rounds = 20) {
  for (let i = 0; i < rounds; i++) {
    await Promise.resolve();
  }
}

function createDeferred() {
  let resolve;
  const promise = new Promise((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

// כל הפניה ל-io.to(streamId).emit חוזרת לאותו spy יציב (הארנס דואג לזה) —
// כאן רק מסננים החוצה את קריאות VIEWER_COUNT הספציפיות.
function viewerCountEmits(io, streamId) {
  const emitSpy = io.to(streamId).emit;
  return emitSpy.mock.calls
    .filter(([event]) => event === SOCKET_EVENTS.STREAM.VIEWER_COUNT)
    .map(([, payload]) => payload);
}

async function setupHostProducing({ io, streamId, hostSocket }) {
  attachRoomTracking(io, hostSocket);
  await createRoomWithHost({
    io,
    streams,
    registerStreamHandlers,
    streamId,
    hostSocket,
  });
  mockGameParticipantFindFirst.mockResolvedValueOnce({ role: 'HOST' });
  await produceFor({
    streams,
    msServiceMock: msService,
    socket: hostSocket,
    streamId,
    kind: 'video',
  });
}

async function joinAsViewer({ io, streamId, viewerSocket }) {
  attachRoomTracking(io, viewerSocket);
  registerStreamHandlers(io, viewerSocket);
  await viewerSocket.handlers[SOCKET_EVENTS.STREAM.JOIN]({ streamId }, vi.fn());
}

// ─────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────

describe('stream.handler — viewer count (C5c)', () => {
  let io;
  let streamId;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mockStreamUpdate.mockReset();
    mockStreamUpdate.mockResolvedValue({ id: 'stream-1' });
    mockGameParticipantFindFirst.mockReset();
    mockStreamFindUnique.mockResolvedValue({ hostId: 'host-user' });
    // Real Stream.id is @default(uuid()); create_room now rejects non-UUIDs.
    streamId = randomUUID();
    io = createMockIo();
    Object.keys(streams).forEach((key) => delete streams[key]);
  });

  afterEach(() => {
    vi.useRealTimers();
    if (streams[streamId]) delete streams[streamId];
  });

  // ─────────────────────────────────────────────
  // קבוצה A: debounce / coalescing
  // ─────────────────────────────────────────────

  describe('debounce', () => {
    it('1. לא כותב viewerCount ל-DB באופן מיידי — רק אחרי שחלפו 500ms בלי אירוע נוסף', async () => {
      const hostSocket = createMockSocket('host-1', 'host-user');
      await setupHostProducing({ io, streamId, hostSocket });

      const viewerCountCallsBeforeDebounce = mockStreamUpdate.mock.calls.filter(
        ([arg]) => 'viewerCount' in arg.data
      );
      expect(viewerCountCallsBeforeDebounce).toHaveLength(0);

      await flushDebounce();

      const viewerCountCallsAfterDebounce = mockStreamUpdate.mock.calls.filter(
        ([arg]) => 'viewerCount' in arg.data
      );
      expect(viewerCountCallsAfterDebounce).toHaveLength(1);
    });

    it('2. כמה הצטרפויות תוך פחות מ-500ms מצטמצמות לכתיבה יחידה עם הערך הסופי בלבד', async () => {
      const hostSocket = createMockSocket('host-2', 'host-user');
      await setupHostProducing({ io, streamId, hostSocket });
      await flushDebounce(); // מיישרים קו: host מוחרג, viewerCount=0 כרגע
      mockStreamUpdate.mockClear();

      const viewer1 = createMockSocket('viewer-2a', 'viewer-a');
      const viewer2 = createMockSocket('viewer-2b', 'viewer-b');

      await vi.advanceTimersByTimeAsync(100);
      await joinAsViewer({ io, streamId, viewerSocket: viewer1 });
      await vi.advanceTimersByTimeAsync(100);
      await joinAsViewer({ io, streamId, viewerSocket: viewer2 });

      // עדיין בתוך חלון ה-debounce מאז ההצטרפות האחרונה — אין כתיבה עדיין
      expect(mockStreamUpdate).not.toHaveBeenCalled();

      await flushDebounce();

      // כתיבה אחת בלבד (לא 2, אחת לכל הצטרפות) עם הערך הסופי (2 צופים)
      expect(mockStreamUpdate).toHaveBeenCalledTimes(1);
      expect(mockStreamUpdate).toHaveBeenCalledWith({
        where: { id: streamId },
        data: { viewerCount: 2 },
      });
    });

    it('3. שני שידורים שונים לא חולקים/מפריעים אחד לטיימר ה-debounce של השני', async () => {
      const streamIdB = randomUUID();
      const hostA = createMockSocket('host-3a', 'host-user-a');
      const hostB = createMockSocket('host-3b', 'host-user-b');

      await setupHostProducing({ io, streamId, hostSocket: hostA });

      mockGameParticipantFindFirst.mockResolvedValueOnce({ role: 'HOST' });
      attachRoomTracking(io, hostB);
      await createRoomWithHost({
        io,
        streams,
        registerStreamHandlers,
        streamId: streamIdB,
        hostSocket: hostB,
      });
      await produceFor({
        streams,
        msServiceMock: msService,
        socket: hostB,
        streamId: streamIdB,
        kind: 'video',
      });

      await flushDebounce();

      // כל שידור קיבל כתיבה משלו, עם streamId משלו — לא מתערבבים
      const calls = mockStreamUpdate.mock.calls.map(([arg]) => arg.where.id);
      expect(calls).toEqual(expect.arrayContaining([streamId, streamIdB]));
      expect(new Set(calls).size).toBe(2);

      delete streams[streamIdB];
    });
  });

  // ─────────────────────────────────────────────
  // קבוצה B: נוסחת הספירה (room size − HOST/PLAYER producers)
  // ─────────────────────────────────────────────

  describe('נוסחת viewerCount', () => {
    it('4. [תיעוד התנהגות ידועה] בין CREATE_ROOM ל-PRODUCE, המארח נספר זמנית כצופה', async () => {
      // זהו חלון קצר וידוע: socket.join קורה מיד ב-CREATE_ROOM, אבל
      // participantSocketIds מתמלא רק אחרי PRODUCE מוצלח. זה מתכנס
      // מעצמו ברגע שה-PRODUCE מסתיים (טסט 5) — לא דורש תיקון נוסף.
      const hostSocket = createMockSocket('host-4', 'host-user');
      attachRoomTracking(io, hostSocket);
      await createRoomWithHost({
        io,
        streams,
        registerStreamHandlers,
        streamId,
        hostSocket,
      });

      await flushDebounce();

      expect(mockStreamUpdate).toHaveBeenCalledWith({
        where: { id: streamId },
        data: { viewerCount: 1 }, // המארח לבדו בחדר, עדיין לא producer
      });
    });

    it('5. אחרי PRODUCE מוצלח של המארח, viewerCount מתעדכן ל-0 (המארח מוחרג)', async () => {
      const hostSocket = createMockSocket('host-5', 'host-user');
      await setupHostProducing({ io, streamId, hostSocket });

      await flushDebounce();

      const lastCall =
        mockStreamUpdate.mock.calls[mockStreamUpdate.mock.calls.length - 1][0];
      expect(lastCall).toEqual({
        where: { id: streamId },
        data: { viewerCount: 0 },
      });
    });

    it('6. PLAYER שמפיק מדיה מוחרג מהספירה בדיוק כמו HOST', async () => {
      const hostSocket = createMockSocket('host-6', 'host-user');
      const playerSocket = createMockSocket('player-6', 'player-user');

      await setupHostProducing({ io, streamId, hostSocket });

      attachRoomTracking(io, playerSocket);
      registerStreamHandlers(io, playerSocket);
      mockGameParticipantFindFirst.mockResolvedValueOnce({ role: 'PLAYER' });
      await produceFor({
        streams,
        msServiceMock: msService,
        socket: playerSocket,
        streamId,
        kind: 'video',
      });

      await flushDebounce();

      const lastCall =
        mockStreamUpdate.mock.calls[mockStreamUpdate.mock.calls.length - 1][0];
      // 2 סוקטים בחדר (host+player), שניהם producers → 0 צופים
      expect(lastCall.data.viewerCount).toBe(0);
    });

    it('7. צופה רגיל שמצטרף (JOIN) מעלה את viewerCount ב-1', async () => {
      const hostSocket = createMockSocket('host-7', 'host-user');
      const viewerSocket = createMockSocket('viewer-7', 'viewer-user');

      await setupHostProducing({ io, streamId, hostSocket });
      await flushDebounce();
      mockStreamUpdate.mockClear();

      await joinAsViewer({ io, streamId, viewerSocket });
      await flushDebounce();

      expect(mockStreamUpdate).toHaveBeenCalledWith({
        where: { id: streamId },
        data: { viewerCount: 1 },
      });
    });

    it('8. כמה צופים מצטרפים ברצף (מעבר לחלון debounce אחד) — הספירה מצטברת נכון', async () => {
      const hostSocket = createMockSocket('host-8', 'host-user');
      await setupHostProducing({ io, streamId, hostSocket });
      await flushDebounce();
      mockStreamUpdate.mockClear();

      for (const label of ['a', 'b', 'c']) {
        const viewerSocket = createMockSocket(
          `viewer-8${label}`,
          `viewer-${label}`
        );
        await joinAsViewer({ io, streamId, viewerSocket });
        await flushDebounce();
      }

      const lastCall =
        mockStreamUpdate.mock.calls[mockStreamUpdate.mock.calls.length - 1][0];
      expect(lastCall.data.viewerCount).toBe(3);
    });
  });

  // ─────────────────────────────────────────────
  // קבוצה C: ירידה נכונה בכל מקרה
  // ─────────────────────────────────────────────

  describe('ירידת viewerCount', () => {
    it('9. סגירת producer בלי ניתוק (למשל שחקן עוצר שידור) מעלה את viewerCount בחזרה', async () => {
      const hostSocket = createMockSocket('host-9', 'host-user');
      const playerSocket = createMockSocket('player-9', 'player-user');

      await setupHostProducing({ io, streamId, hostSocket });

      attachRoomTracking(io, playerSocket);
      registerStreamHandlers(io, playerSocket);
      mockGameParticipantFindFirst.mockResolvedValueOnce({ role: 'PLAYER' });
      const { producer } = await produceFor({
        streams,
        msServiceMock: msService,
        socket: playerSocket,
        streamId,
        kind: 'video',
      });

      await flushDebounce();
      mockStreamUpdate.mockClear();

      // מדמים סגירת ה-producer (mediasoup קורא לזה) — playerSocket עדיין
      // בחדר (לא ניתוק), אז room.size לא זז, אבל participantSocketIds כן
      producer.close();

      await flushDebounce();

      expect(mockStreamUpdate).toHaveBeenCalledWith({
        where: { id: streamId },
        data: { viewerCount: 1 }, // הפלייר "הופך לצופה" מבחינת הספירה
      });
    });

    it('10. ניתוק צופה (disconnect) מוריד את viewerCount ב-1', async () => {
      const hostSocket = createMockSocket('host-10', 'host-user');
      const viewerSocket = createMockSocket('viewer-10', 'viewer-user');

      await setupHostProducing({ io, streamId, hostSocket });
      await joinAsViewer({ io, streamId, viewerSocket });
      await flushDebounce();
      mockStreamUpdate.mockClear();

      await simulateDisconnect(io, viewerSocket);
      await flushDebounce();

      expect(mockStreamUpdate).toHaveBeenCalledWith({
        where: { id: streamId },
        data: { viewerCount: 0 },
      });
    });

    it('11. ניתוק סוקט שמעולם לא הצטרף לשום חדר — אין קריסה ואין publish מיותר', async () => {
      const strangerSocket = createMockSocket('stranger-11', 'stranger-user');
      registerStreamHandlers(io, strangerSocket);

      await expect(
        simulateDisconnect(io, strangerSocket)
      ).resolves.not.toThrow();

      await flushDebounce();
      expect(mockStreamUpdate).not.toHaveBeenCalled();
    });

    it('12. producer close ואז disconnect מיד אחריו (אותו socket) — אין כפילות/קריסה, viewerCount סופי נכון', async () => {
      const hostSocket = createMockSocket('host-12', 'host-user');
      const playerSocket = createMockSocket('player-12', 'player-user');

      await setupHostProducing({ io, streamId, hostSocket });

      attachRoomTracking(io, playerSocket);
      registerStreamHandlers(io, playerSocket);
      mockGameParticipantFindFirst.mockResolvedValueOnce({ role: 'PLAYER' });
      await produceFor({
        streams,
        msServiceMock: msService,
        socket: playerSocket,
        streamId,
        kind: 'video',
      });

      await flushDebounce();
      mockStreamUpdate.mockClear();

      // ניתוק שוגר קודם — הוא זה שסוגר את ה-producers בפועל (disconnect
      // handler קורא producer.close() על סוקט שהתנתק), בדיוק כמו בקוד האמיתי
      await expect(simulateDisconnect(io, playerSocket)).resolves.not.toThrow();

      await flushDebounce();

      const lastCall =
        mockStreamUpdate.mock.calls[mockStreamUpdate.mock.calls.length - 1][0];
      // הפלייר גם עזב את החדר וגם הפסיק להיות producer — 0 צופים (רק המארח)
      expect(lastCall.data.viewerCount).toBe(0);
    });
  });

  // ─────────────────────────────────────────────
  // קבוצה D: handleCloseStream
  // ─────────────────────────────────────────────

  describe('handleCloseStream', () => {
    it('13. viewerCount:0 נכתב באותה קריאת update כמו status:FINISHED', async () => {
      const hostSocket = createMockSocket('host-13', 'host-user');
      await setupHostProducing({ io, streamId, hostSocket });
      await flushDebounce();
      mockStreamUpdate.mockClear();

      await handleCloseStream(streamId, io);

      expect(mockStreamUpdate).toHaveBeenCalledTimes(1);
      expect(mockStreamUpdate).toHaveBeenCalledWith({
        where: { id: streamId },
        data: expect.objectContaining({
          status: 'FINISHED',
          viewerCount: 0,
        }),
      });
    });

    it('14. סגירת שידור בזמן שיש debounce ממתין מבטלת אותו — אין כתיבה מיושנת אחרי הסגירה', async () => {
      const hostSocket = createMockSocket('host-14', 'host-user');
      const viewerSocket = createMockSocket('viewer-14', 'viewer-user');

      await setupHostProducing({ io, streamId, hostSocket });
      await flushDebounce();
      mockStreamUpdate.mockClear();

      // מתזמנים אירוע (טיימר ממתין, טרם נורה) ואז סוגרים את השידור מיד
      await joinAsViewer({ io, streamId, viewerSocket });
      await handleCloseStream(streamId, io);

      // מקדמים זמן מעבר לרגע שהטיימר המקורי היה אמור לירות בו
      await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);

      // רק קריאת ה-update של handleCloseStream עצמה קרתה — הטיימר בוטל
      expect(mockStreamUpdate).toHaveBeenCalledTimes(1);
      expect(mockStreamUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'FINISHED' }),
        })
      );
    });

    it('15. אחרי שהשידור נסגר, אירוע נוסף (ניתוק) לא גורם ל-DB write נוסף (streamRoom כבר לא קיים)', async () => {
      const hostSocket = createMockSocket('host-15', 'host-user');
      const viewerSocket = createMockSocket('viewer-15', 'viewer-user');

      await setupHostProducing({ io, streamId, hostSocket });
      await joinAsViewer({ io, streamId, viewerSocket });
      await flushDebounce();

      await handleCloseStream(streamId, io);
      mockStreamUpdate.mockClear();

      // ניתוק אחרי שהחדר כבר נמחק — publishViewerCount אמור לצאת בשקט
      await expect(simulateDisconnect(io, viewerSocket)).resolves.not.toThrow();
      await flushDebounce();

      expect(mockStreamUpdate).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────
  // קבוצה E: תוכן ה-emit
  // ─────────────────────────────────────────────

  describe('שידור stream:viewer_count', () => {
    it('16. ה-emit נשלח לחדר עם { streamId, viewerCount } תואם למה שנכתב ל-DB', async () => {
      const hostSocket = createMockSocket('host-16', 'host-user');
      const viewerSocket = createMockSocket('viewer-16', 'viewer-user');

      await setupHostProducing({ io, streamId, hostSocket });
      await joinAsViewer({ io, streamId, viewerSocket });
      await flushDebounce();

      const emits = viewerCountEmits(io, streamId);
      expect(emits.length).toBeGreaterThan(0);
      expect(emits[emits.length - 1]).toEqual({ streamId, viewerCount: 1 });
    });
  });

  // ─────────────────────────────────────────────
  // קבוצה F: הגנה מפני סדר-סיום הפוך של כתיבות (viewerCountWriteSequence)
  // ─────────────────────────────────────────────

  describe('הגנה מפני סדר-סיום הפוך של כתיבות ל-DB', () => {
    it('17. עם סריאליזציה (chain), המצב הסופי ב-DB תמיד נכון — גם אם כתיבה מוקדמת איטית כותבת ערך ביניים זמני', async () => {
      const hostSocket = createMockSocket('host-17', 'host-user');
      await setupHostProducing({ io, streamId, hostSocket });
      await flushDebounce();
      mockStreamUpdate.mockClear();

      const dbState = { viewerCount: null };
      const deferredFirst = createDeferred();
      let firstCallSeen = false;

      mockStreamUpdate.mockImplementation(async ({ data }) => {
        if (!firstCallSeen) {
          firstCallSeen = true;
          await deferredFirst.promise; // מדמה כתיבה ראשונה איטית באופן חריג
        }
        dbState.viewerCount = data.viewerCount;
        return { id: 'stream-1' };
      });

      const viewer1 = createMockSocket('viewer-17a', 'viewer-a');
      await joinAsViewer({ io, streamId, viewerSocket: viewer1 });
      await flushDebounce();

      const viewer2 = createMockSocket('viewer-17b', 'viewer-b');
      await joinAsViewer({ io, streamId, viewerSocket: viewer2 });
      await flushDebounce();
      await flushMicrotasks();

      // write2 עדיין בתור, ממתין ל-write1 התקוע — אין עדיין כתיבה בפועל
      expect(dbState.viewerCount).toBeNull();

      // משחררים את write1 — הוא כותב 1, ואז ה-chain משחרר את write2 מיד אחריו
      deferredFirst.resolve();
      await flushMicrotasks();

      // ✓ המצב הסופי, אחרי שהתור התרוקן, תמיד נכון — 2, לא 1
      expect(dbState.viewerCount).toBe(2);
      expect(mockStreamUpdate).toHaveBeenCalledTimes(2);
    });

    it('18. הלקוחות תמיד מקבלים כ-emit אחרון את הערך הנכון (2) — גם אם שודר emit ביניים זמני (1)', async () => {
      const hostSocket = createMockSocket('host-18', 'host-user');
      await setupHostProducing({ io, streamId, hostSocket });
      await flushDebounce();

      const deferredFirst = createDeferred();
      let firstCallSeen = false;

      mockStreamUpdate.mockImplementation(async () => {
        if (!firstCallSeen) {
          firstCallSeen = true;
          await deferredFirst.promise;
        }
        return { id: 'stream-1' };
      });

      const viewer1 = createMockSocket('viewer-18a', 'viewer-a');
      await joinAsViewer({ io, streamId, viewerSocket: viewer1 });
      await flushDebounce();

      const viewer2 = createMockSocket('viewer-18b', 'viewer-b');
      await joinAsViewer({ io, streamId, viewerSocket: viewer2 });
      await flushDebounce();
      await flushMicrotasks();

      deferredFirst.resolve();
      await flushMicrotasks();

      const emitsAfter = viewerCountEmits(io, streamId);
      // ✓ ה-emit האחרון שכן שודר משקף את הערך הנכון (2), לא נשאר תקוע על 1
      expect(emitsAfter[emitsAfter.length - 1].viewerCount).toBe(2);
    });

    it('19. write שכבר בתור כשהשידור נסגר לא כותב/משדר אחרי handleCloseStream', async () => {
      const hostSocket = createMockSocket('host-19', 'host-user');
      const viewerSocket = createMockSocket('viewer-19', 'viewer-user');

      await setupHostProducing({ io, streamId, hostSocket });
      await flushDebounce();
      mockStreamUpdate.mockClear();

      const deferredJoinWrite = createDeferred();
      let joinCallSeen = false;

      mockStreamUpdate.mockImplementation(async (arg) => {
        // "תוקעים" רק את הכתיבה של viewerCount (מ-JOIN) — לא את זו
        // של handleCloseStream, כדי לדמות בדיוק את התרחיש: write ישן
        // עדיין ממתין כש-handleCloseStream כבר מתבצע ומסתיים.
        if (
          !joinCallSeen &&
          'viewerCount' in arg.data &&
          arg.data.status === undefined
        ) {
          joinCallSeen = true;
          await deferredJoinWrite.promise;
        }
        return { id: 'stream-1' };
      });

      await joinAsViewer({ io, streamId, viewerSocket });
      await flushDebounce(); // ה-write של ה-JOIN "יצא לדרך" ותקוע

      // השידור נסגר בזמן שה-write התקוע עדיין ממתין
      await handleCloseStream(streamId, io);

      const closeCallCount = mockStreamUpdate.mock.calls.length;

      // עכשיו משחררים את ה-write התקוע — הוא אמור לזהות שהחדר כבר נסגר
      deferredJoinWrite.resolve();
      await flushMicrotasks();

      // ✓ אין קריאת DB נוספת אחרי handleCloseStream — ה-write הישן נזרק בשקט
      expect(mockStreamUpdate).toHaveBeenCalledTimes(closeCallCount);
      // ✓ גם אין emit נוסף עם ערך שסותר את הסגירה
      const emits = viewerCountEmits(io, streamId);
      const emitsAfterClose = emits.filter((e) => e.viewerCount !== 0);
      expect(emitsAfterClose).toHaveLength(0);
    });
  });
});
