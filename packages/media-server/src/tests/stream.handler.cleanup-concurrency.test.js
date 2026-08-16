import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─────────────────────────────────────────────
// Mocks — זהים במכוון לאלה שכבר קיימים ב-stream.handler.disconnect.test.js,
// כדי לשמור על עקביות בסגנון ה-mocking בין קבצי הטסטים (DRY).
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
      PRODUCER_CLOSED: 'stream:producer_closed',
      NEW_PRODUCER: 'stream:new_producer',
      JOIN: 'stream:join',
      ENDED: 'stream:ended',
    },
  },
  MAX_ACTIVE_PLAYERS: 4,
}));

import { registerStreamHandlers, streams } from '../sockets/stream.handler.js';
import { StreamService } from '../services/stream.service.js';
import { SOCKET_EVENTS } from '@worldplay/shared';
import prisma from '../lib/prisma.js';
import { logger } from '../utils/logger.js';

// ─────────────────────────────────────────────
// עזרים
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
    sockets: { adapter: { rooms: { get: () => undefined } } },
  };
}

// יוצר חדר עבור streamId נתון, בבעלות hostSocket שכבר רשום דרך
// registerStreamHandlers. הטסטים כאן בודקים אך ורק את לוגיקת ה-iteration
// והניקוי המקבילי (M4-08) — לא נדרש producer אמיתי בשבילם.
async function createHostRoom(hostSocket, streamId) {
  const createRoomCb = vi.fn();
  await hostSocket.handlers[SOCKET_EVENTS.STREAM.CREATE_ROOM](
    { streamId },
    createRoomCb
  );
  streams[streamId].router = { rtpCapabilities: {}, close: vi.fn() };
}

describe('stream.handler — M4-08: ניקוי מקבילי ובטוח של מספר streams (STREAM.ENDED)', () => {
  let io;
  const streamIdA = 'a0000000-0000-4000-8000-0000000000a1';
  const streamIdB = 'a0000000-0000-4000-8000-0000000000a2';
  const streamIdC = 'a0000000-0000-4000-8000-0000000000a3';
  const otherHostStreamId = 'a0000000-0000-4000-8000-0000000000a9';

  beforeEach(() => {
    vi.clearAllMocks();
    mockFindFirst.mockResolvedValue({ role: 'PLAYER' });
    Object.keys(streams).forEach((key) => delete streams[key]);
    io = createMockIo();
    StreamService.stopRecording.mockResolvedValue();
  });

  it('1. כל ה-streams של ה-host שסיים שידור מנוקים, ללא דילוגים — גם עם כמה streams', async () => {
    // זהו בדיוק תרחיש הבאג המקורי: for...in שרץ על streams תוך כדי
    // ש-handleCloseStream מוחק ממנו מפתחות. עם 3 streams, דילוג היה
    // משאיר לפחות אחד קיים ב-streams אחרי הניקוי.
    const hostSocket = createMockSocket('host-multi', 'host-user');
    registerStreamHandlers(io, hostSocket);

    await createHostRoom(hostSocket, streamIdA);
    await createHostRoom(hostSocket, streamIdB);
    await createHostRoom(hostSocket, streamIdC);

    await hostSocket.handlers[SOCKET_EVENTS.STREAM.ENDED]();

    expect(streams[streamIdA]).toBeUndefined();
    expect(streams[streamIdB]).toBeUndefined();
    expect(streams[streamIdC]).toBeUndefined();
    expect(StreamService.stopRecording).toHaveBeenCalledTimes(3);
  });

  it('2. הניקוי של כמה streams רץ במקביל, לא בזה-אחר-זה', async () => {
    // בניקוי סדרתי (await בתוך for), "start:B" רק היה מגיע אחרי
    // "end:A". כאן בודקים ששני ה-start מגיעים לפני כל end — סימן
    // מובהק שהניקוי יצא לדרך במקביל.
    const callOrder = [];
    StreamService.stopRecording.mockImplementation(async (streamId) => {
      callOrder.push(`start:${streamId}`);
      await new Promise((resolve) => setTimeout(resolve, 10));
      callOrder.push(`end:${streamId}`);
    });

    const hostSocket = createMockSocket('host-parallel', 'host-user');
    registerStreamHandlers(io, hostSocket);

    await createHostRoom(hostSocket, streamIdA);
    await createHostRoom(hostSocket, streamIdB);

    await hostSocket.handlers[SOCKET_EVENTS.STREAM.ENDED]();

    expect(callOrder.slice(0, 2)).toEqual(
      expect.arrayContaining([`start:${streamIdA}`, `start:${streamIdB}`])
    );
  });

  it('3. כישלון בניקוי stream אחד לא מונע ניקוי של streams אחרים (Promise.allSettled)', async () => {
    StreamService.stopRecording.mockImplementation(async (streamId) => {
      if (streamId === streamIdA) {
        throw new Error('disk delete failed');
      }
    });

    const hostSocket = createMockSocket('host-partial-fail', 'host-user');
    registerStreamHandlers(io, hostSocket);

    await createHostRoom(hostSocket, streamIdA);
    await createHostRoom(hostSocket, streamIdB);

    await hostSocket.handlers[SOCKET_EVENTS.STREAM.ENDED]();

    // ✓ שני ה-streams נוקו בכל זאת — handleCloseStream (M4-15) כבר
    // עוטף את stopRecording ב-try/catch פנימי משלו וממשיך הלאה.
    expect(streams[streamIdA]).toBeUndefined();
    expect(streams[streamIdB]).toBeUndefined();
    expect(prisma.stream.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: streamIdA } })
    );
    expect(prisma.stream.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: streamIdB } })
    );
  });

  it('4. streams ששייכים ל-host אחר לא נפגעים מהניקוי', async () => {
    const hostSocket = createMockSocket('host-own', 'host-user');
    const otherHostSocket = createMockSocket('host-other', 'other-user');
    registerStreamHandlers(io, hostSocket);
    registerStreamHandlers(io, otherHostSocket);

    await createHostRoom(hostSocket, streamIdA);
    await createHostRoom(otherHostSocket, otherHostStreamId);

    await hostSocket.handlers[SOCKET_EVENTS.STREAM.ENDED]();

    expect(streams[streamIdA]).toBeUndefined();
    expect(streams[otherHostStreamId]).toBeDefined();
    expect(StreamService.stopRecording).toHaveBeenCalledWith(streamIdA);
    expect(StreamService.stopRecording).not.toHaveBeenCalledWith(
      otherHostStreamId
    );
  });

  it('5. host שלא פתח אף stream — הקריאה ל-ENDED לא קורסת (רשימה ריקה)', async () => {
    const hostSocket = createMockSocket('host-no-streams', 'host-user');
    registerStreamHandlers(io, hostSocket);

    await expect(
      hostSocket.handlers[SOCKET_EVENTS.STREAM.ENDED]()
    ).resolves.not.toThrow();

    expect(StreamService.stopRecording).not.toHaveBeenCalled();
  });

  it('6. אם handleCloseStream עצמו זורק (לא רק stopRecording) — ה-try/catch החיצוני תופס, ושאר ה-streams עדיין מנוקים', async () => {
    // stopRecording עטוף כבר ב-try/catch *פנימי* בתוך handleCloseStream
    // (M4-15) — הטסטים 3 למעלה לא באמת בודקים את ה-try/catch *החיצוני*
    // שהוספתי כאן ב-M4-08. router.close() לעומת זאת אינו עטוף באף
    // try/catch פנימי, אז זו הדרך הנכונה לוודא שה-try/catch החיצוני
    // באמת עושה עבודה, ולא רק "עומד שם" בלי להיבדק אף פעם.
    const hostSocket = createMockSocket('host-router-throw', 'host-user');
    registerStreamHandlers(io, hostSocket);

    await createHostRoom(hostSocket, streamIdA);
    await createHostRoom(hostSocket, streamIdB);

    streams[streamIdA].router.close = vi.fn(() => {
      throw new Error('router close failed');
    });

    await hostSocket.handlers[SOCKET_EVENTS.STREAM.ENDED]();

    // ✓ stream B (שלא נכשל) עדיין נוקה במלואו
    expect(streams[streamIdB]).toBeUndefined();
    // ✓ הכישלון של A נרשם ביומן דרך ה-try/catch החיצוני
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining(streamIdA)
    );
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('router close failed')
    );
  });
});

describe('stream.handler — M4-08: ניקוי מקבילי ובטוח של מספר streams (DISCONNECT)', () => {
  let io;
  const streamIdA = 'a0000000-0000-4000-8000-0000000000b1';
  const streamIdB = 'a0000000-0000-4000-8000-0000000000b2';
  const streamIdC = 'a0000000-0000-4000-8000-0000000000b3';
  const otherHostStreamId = 'a0000000-0000-4000-8000-0000000000b9';

  beforeEach(() => {
    vi.clearAllMocks();
    mockFindFirst.mockResolvedValue({ role: 'PLAYER' });
    Object.keys(streams).forEach((key) => delete streams[key]);
    io = createMockIo();
    StreamService.stopRecording.mockResolvedValue();
  });

  it('1. ניתוק host מנקה את כל ה-streams שלו, ללא דילוגים', async () => {
    const hostSocket = createMockSocket('host-disc-multi', 'host-user');
    registerStreamHandlers(io, hostSocket);

    await createHostRoom(hostSocket, streamIdA);
    await createHostRoom(hostSocket, streamIdB);
    await createHostRoom(hostSocket, streamIdC);

    await hostSocket.handlers[SOCKET_EVENTS.SYSTEM.DISCONNECT]();

    expect(streams[streamIdA]).toBeUndefined();
    expect(streams[streamIdB]).toBeUndefined();
    expect(streams[streamIdC]).toBeUndefined();
    expect(StreamService.stopRecording).toHaveBeenCalledTimes(3);
  });

  it('2. הניקוי בזמן disconnect רץ במקביל, לא בזה-אחר-זה', async () => {
    const callOrder = [];
    StreamService.stopRecording.mockImplementation(async (streamId) => {
      callOrder.push(`start:${streamId}`);
      await new Promise((resolve) => setTimeout(resolve, 10));
      callOrder.push(`end:${streamId}`);
    });

    const hostSocket = createMockSocket('host-disc-parallel', 'host-user');
    registerStreamHandlers(io, hostSocket);

    await createHostRoom(hostSocket, streamIdA);
    await createHostRoom(hostSocket, streamIdB);

    await hostSocket.handlers[SOCKET_EVENTS.SYSTEM.DISCONNECT]();

    expect(callOrder.slice(0, 2)).toEqual(
      expect.arrayContaining([`start:${streamIdA}`, `start:${streamIdB}`])
    );
  });

  it('3. כישלון בניקוי stream אחד ב-disconnect לא מונע ניקוי אחרים, ונרשם ביומן', async () => {
    StreamService.stopRecording.mockImplementation(async (streamId) => {
      if (streamId === streamIdA) {
        throw new Error('disk delete failed');
      }
    });

    const hostSocket = createMockSocket('host-disc-fail', 'host-user');
    registerStreamHandlers(io, hostSocket);

    await createHostRoom(hostSocket, streamIdA);
    await createHostRoom(hostSocket, streamIdB);

    await hostSocket.handlers[SOCKET_EVENTS.SYSTEM.DISCONNECT]();

    expect(streams[streamIdA]).toBeUndefined();
    expect(streams[streamIdB]).toBeUndefined();
    // ה-catch הפנימי של handleCloseStream (M4-15) כבר תופס ורושם את השגיאה
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining(streamIdA)
    );
  });

  it('4. ניתוק host אחד לא פוגע ב-streams של host אחר', async () => {
    const hostSocket = createMockSocket('host-disc-own', 'host-user');
    const otherHostSocket = createMockSocket('host-disc-other', 'other-user');
    registerStreamHandlers(io, hostSocket);
    registerStreamHandlers(io, otherHostSocket);

    await createHostRoom(hostSocket, streamIdA);
    await createHostRoom(otherHostSocket, otherHostStreamId);

    await hostSocket.handlers[SOCKET_EVENTS.SYSTEM.DISCONNECT]();

    expect(streams[streamIdA]).toBeUndefined();
    expect(streams[otherHostStreamId]).toBeDefined();
    expect(StreamService.stopRecording).toHaveBeenCalledWith(streamIdA);
    expect(StreamService.stopRecording).not.toHaveBeenCalledWith(
      otherHostStreamId
    );
  });

  it('5. host שמתנתק בלי לפתוח אף stream — לא קורס (רשימה ריקה)', async () => {
    const hostSocket = createMockSocket('host-disc-no-streams', 'host-user');
    registerStreamHandlers(io, hostSocket);

    await expect(
      hostSocket.handlers[SOCKET_EVENTS.SYSTEM.DISCONNECT]()
    ).resolves.not.toThrow();

    expect(StreamService.stopRecording).not.toHaveBeenCalled();
  });

  it('6. אם handleCloseStream עצמו זורק ב-disconnect — ה-try/catch החיצוני תופס, ושאר ה-streams עדיין מנוקים', async () => {
    const hostSocket = createMockSocket('host-disc-router-throw', 'host-user');
    registerStreamHandlers(io, hostSocket);

    await createHostRoom(hostSocket, streamIdA);
    await createHostRoom(hostSocket, streamIdB);

    streams[streamIdA].router.close = vi.fn(() => {
      throw new Error('router close failed');
    });

    await hostSocket.handlers[SOCKET_EVENTS.SYSTEM.DISCONNECT]();

    expect(streams[streamIdB]).toBeUndefined();
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining(streamIdA)
    );
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('router close failed')
    );
  });
});
