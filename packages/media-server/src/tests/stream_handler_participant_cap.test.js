import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────

const { mockFindFirst } = vi.hoisted(() => ({
  mockFindFirst: vi.fn(),
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
    },
  },
  ERROR_MESSAGES: {
    ROOM_NOT_FOUND: 'Room not found',
    TRANSPORT_NOT_FOUND: 'Transport not found',
    CANNOT_CONSUME: 'Cannot consume',
    CONSUMER_NOT_FOUND: 'Consumer not found',
    ROOM_FULL: 'Room is full — maximum 4 active players reached',
    RTP_PARAMETERS_REQUIRED: 'rtpParameters is required',
    KIND_REQUIRED: 'kind is required',
    ROOM_NOT_CREATED: 'Room not found. Call stream:create_room first.',
  },
  MAX_ACTIVE_PLAYERS: 4,
}));

import { registerStreamHandlers, streams } from '../sockets/stream.handler.js';
import * as msService from '../services/mediasoup.service.js';
import { ERROR_MESSAGES, SOCKET_EVENTS } from '@worldplay/shared';
import {
  createMockSocket,
  createMockIo,
  createRoomWithHost,
  createFakeTransport,
  createDefaultRtpParameters,
  produceFor,
  produceForWithGate,
} from './helpers/liveFlow.harness.js';

describe('stream.handler — cap 4 (HOST+PLAYER בלבד, MODERATOR/VIEWER לא נספרים)', () => {
  let io;
  // Real Stream.id is @default(uuid()); create_room now rejects non-UUIDs.
  const streamId = 'a0000000-0000-4000-8000-000000000002';

  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(streams).forEach((key) => delete streams[key]);
    io = createMockIo();
  });

  async function setupRoomWithNPlayers(n, { roles } = {}) {
    const hostSocket = createMockSocket('host-cap', 'host-user');
    await createRoomWithHost({
      io,
      streams,
      registerStreamHandlers,
      streamId,
      hostSocket,
    });

    const sockets = [];
    for (let i = 0; i < n; i++) {
      const role = roles?.[i] || (i === 0 ? 'HOST' : 'PLAYER');
      const socket =
        i === 0
          ? hostSocket
          : createMockSocket(`player-${i}`, `player-user-${i}`);
      if (i !== 0) registerStreamHandlers(io, socket);

      mockFindFirst.mockResolvedValueOnce({ role });
      await produceFor({
        streams,
        msServiceMock: msService,
        socket,
        streamId,
        kind: 'video',
      });
      sockets.push(socket);
    }
    return { hostSocket, sockets };
  }

  it('4 שחקנים (HOST+3 PLAYER) מצליחים להצטרף ולהפיק — אין דחייה', async () => {
    const { sockets } = await setupRoomWithNPlayers(4);
    expect(streams[streamId].participantSocketIds.size).toBe(4);
    sockets.forEach((s) => {
      expect(streams[streamId].participantSocketIds.has(s.id)).toBe(true);
    });
  });

  it('שחקן חמישי נדחה עם ROOM_FULL, ה-producer מעולם לא נוצר, ואין PRODUCER_CLOSED מיותר', async () => {
    await setupRoomWithNPlayers(4);

    const fifthSocket = createMockSocket('player-5', 'player-user-5');
    registerStreamHandlers(io, fifthSocket);
    mockFindFirst.mockResolvedValueOnce({ role: 'PLAYER' });

    // io.to(streamId) מחזיר spy יציב וייחודי לחדר הזה בלבד (Map פנימי ב-createMockIo)
    const emitSpy = io.to(streamId).emit;

    const { transport, callback } = await produceFor({
      streams,
      msServiceMock: msService,
      socket: fifthSocket,
      streamId,
      kind: 'video',
    });

    expect(callback).toHaveBeenCalledWith({ error: ERROR_MESSAGES.ROOM_FULL });

    // ה-producer מעולם לא נוצר בפועל — אחרי התיקון, transport.produce
    // לא נקרא כלל, כי הבדיקה קורית לפני יצירת ה-producer
    expect(transport.produce).not.toHaveBeenCalled();

    expect(streams[streamId].participantSocketIds.size).toBe(4);
    expect(streams[streamId].participantSocketIds.has(fifthSocket.id)).toBe(
      false
    );

    // אין שום producer חדש שנוסף בשם השחקן החמישי
    const producerIdsForFifth = Object.values(
      streams[streamId].producers
    ).filter((p) => p.appData?.socketId === fifthSocket.id);
    expect(producerIdsForFifth).toHaveLength(0);

    // אין PRODUCER_CLOSED שנפלט על producer שאף פעם לא הוכרז
    expect(emitSpy).not.toHaveBeenCalledWith(
      SOCKET_EVENTS.STREAM.PRODUCER_CLOSED,
      expect.anything()
    );
  });

  it('VIEWER לא נספר במניין ולא נדחה גם אם יש כבר 4 HOST/PLAYER', async () => {
    await setupRoomWithNPlayers(4);

    const viewerSocket = createMockSocket('viewer-cap', 'viewer-user');
    registerStreamHandlers(io, viewerSocket);
    mockFindFirst.mockResolvedValueOnce(null); // אין GameParticipant, לא HOST → נופל ל-VIEWER

    const { callback } = await produceFor({
      streams,
      msServiceMock: msService,
      socket: viewerSocket,
      streamId,
      kind: 'video',
    });

    expect(callback).not.toHaveBeenCalledWith(
      expect.objectContaining({ error: ERROR_MESSAGES.ROOM_FULL })
    );
    expect(streams[streamId].participantSocketIds.has(viewerSocket.id)).toBe(
      false
    );
  });

  it('MODERATOR לא נספר במניין ולא נדחה גם אם יש כבר 4 HOST/PLAYER', async () => {
    await setupRoomWithNPlayers(4);

    const moderatorSocket = createMockSocket('moderator-cap', 'moderator-user');
    registerStreamHandlers(io, moderatorSocket);
    mockFindFirst.mockResolvedValueOnce({ role: 'MODERATOR' });

    const { callback } = await produceFor({
      streams,
      msServiceMock: msService,
      socket: moderatorSocket,
      streamId,
      kind: 'video',
    });

    expect(callback).not.toHaveBeenCalledWith(
      expect.objectContaining({ error: ERROR_MESSAGES.ROOM_FULL })
    );
    expect(streams[streamId].participantSocketIds.has(moderatorSocket.id)).toBe(
      false
    );
    expect(streams[streamId].participantSocketIds.size).toBe(4);
  });

  it('שחקן קיים ששולח producer שני (למשל אודיו אחרי וידאו) מורשה תמיד, גם כשהחדר "מלא"', async () => {
    const { sockets } = await setupRoomWithNPlayers(4);
    const existingPlayer = sockets[1];

    mockFindFirst.mockResolvedValueOnce({ role: 'PLAYER' });
    const { callback } = await produceFor({
      streams,
      msServiceMock: msService,
      socket: existingPlayer,
      streamId,
      kind: 'audio',
    });

    expect(callback).not.toHaveBeenCalledWith(
      expect.objectContaining({ error: ERROR_MESSAGES.ROOM_FULL })
    );
    expect(streams[streamId].participantSocketIds.size).toBe(4);
  });

  it('אחרי שאחד מ-4 השחקנים מנתק את כל ה-producers שלו, מתפנה מקום לשחקן חדש', async () => {
    const { sockets } = await setupRoomWithNPlayers(4);
    const leavingPlayer = sockets[3];

    Object.values(streams[streamId].producers)
      .filter((p) => p.appData?.socketId === leavingPlayer.id)
      .forEach((p) => p.close());

    expect(streams[streamId].participantSocketIds.has(leavingPlayer.id)).toBe(
      false
    );
    expect(streams[streamId].participantSocketIds.size).toBe(3);

    const newPlayerSocket = createMockSocket('player-new', 'player-user-new');
    registerStreamHandlers(io, newPlayerSocket);
    mockFindFirst.mockResolvedValueOnce({ role: 'PLAYER' });

    const { callback } = await produceFor({
      streams,
      msServiceMock: msService,
      socket: newPlayerSocket,
      streamId,
      kind: 'video',
    });

    expect(callback).not.toHaveBeenCalledWith(
      expect.objectContaining({ error: ERROR_MESSAGES.ROOM_FULL })
    );
    expect(streams[streamId].participantSocketIds.size).toBe(4);
  });

  it('שני שחקנים פותחים מצלמה בו-זמנית כשיש 3 פעילים — רק אחד מתקבל (מרוץ TOCTOU, M4-13/SCRUM-315)', async () => {
    // מצב התחלתי: 3 משתתפים פעילים (מארח + 2), עוד מקום אחד פנוי.
    await setupRoomWithNPlayers(3);

    const fourthSocket = createMockSocket('player-4a', 'player-user-4a');
    const fifthSocket = createMockSocket('player-4b', 'player-user-4b');
    registerStreamHandlers(io, fourthSocket);
    registerStreamHandlers(io, fifthSocket);

    // כל אחת מהקריאות תצרוך ערך נפרד, לפי סדר תחילת-הריצה (לא סדר הסיום) —
    // ולכן צריך תור בגודל 2, לא ערך אחד משותף.
    mockFindFirst.mockResolvedValueOnce({ role: 'PLAYER' });
    mockFindFirst.mockResolvedValueOnce({ role: 'PLAYER' });

    // מתחילות שתי הקריאות בלי await ביניהן — שתיהן ירוצו עד שהן נתקעות
    // בתוך await transport.produce (השער עדיין סגור).
    const callA = await produceForWithGate({
      streams,
      msServiceMock: msService,
      socket: fourthSocket,
      streamId,
      kind: 'video',
    });
    const callB = await produceForWithGate({
      streams,
      msServiceMock: msService,
      socket: fifthSocket,
      streamId,
      kind: 'video',
    });

    // נותנות ל-event loop כמה "טיקים" כדי לוודא ששתי הקריאות אכן הגיעו
    // עד נקודת ה-await ונתקעו שם (ולא רק שהתחילו לרוץ).
    await Promise.resolve();
    await Promise.resolve();

    // עכשיו משחררות את שתיהן ומחכות שהן יסתיימו.
    callA.resolveProduce();
    callB.resolveProduce();
    await callA.done;
    await callB.done;

    const resultA = callA.callback.mock.calls[0][0];
    const resultB = callB.callback.mock.calls[0][0];
    const results = [resultA, resultB];

    const successes = results.filter((r) => !r.error);
    const rejections = results.filter(
      (r) => r.error === ERROR_MESSAGES.ROOM_FULL
    );

    // זה בדיוק מה שהיה שבור לפני התיקון: בלי שריון-מוקדם, שתי הקריאות
    // עוברות את הבדיקה (3<4) לפני שאחת מהן נרשמת, ושתיהן היו מתקבלות
    // (successes.length === 2, size הופך ל-5). אחרי התיקון — רק אחת
    // מתקבלת, השנייה נדחית עם ROOM_FULL, וה-size נשאר 4.
    expect(successes).toHaveLength(1);
    expect(rejections).toHaveLength(1);
    expect(streams[streamId].participantSocketIds.size).toBe(4);
  });

  it('produce נכשל אחרי ששוריין סלוט — הסלוט משתחרר בחזרה (rollback), ומשתתף חדש יכול לתפוס אותו', async () => {
    await setupRoomWithNPlayers(3);

    const failingSocket = createMockSocket('player-fail', 'player-user-fail');
    registerStreamHandlers(io, failingSocket);
    mockFindFirst.mockResolvedValueOnce({ role: 'PLAYER' });

    // בונות ידנית transport שה-produce שלו נכשל, כדי לבדוק בדיוק את ה-catch
    // בקוד: reservedSlot=true (עברנו את הבדיקה, שוריינו סלוט), ואז produce
    // עצמו זורק. הציפייה: הסלוט משוחרר, לא נשאר "תפוס-סרק".
    const failingTransport = createFakeTransport(
      `transport-${failingSocket.id}-video`
    );
    failingTransport.produce.mockRejectedValue(
      new Error('mediasoup: produce failed')
    );
    msService.createWebRtcTransport.mockResolvedValue(failingTransport);

    // Goes through the real CREATE_TRANSPORT handler so this transportId
    // actually lands in stream.handler.js's private transports registry —
    // PRODUCE looks it up there, not in streamRoom.transports.
    const createTransportCb = vi.fn();
    await failingSocket.handlers['stream:create_transport'](
      { streamId },
      createTransportCb
    );
    const failingTransportId = createTransportCb.mock.calls[0][0].id;

    const cb = vi.fn();
    await failingSocket.handlers['stream:produce'](
      {
        streamId,
        transportId: failingTransportId,
        kind: 'video',
        // rtpParameters must be valid here — this test targets the
        // transport.produce() rejection path specifically, not the
        // RTP-parameters validation added under FINDINGS M4-05.
        rtpParameters: createDefaultRtpParameters('video'),
      },
      cb
    );

    // השגיאה חוזרת ללקוח דרך ה-catch החיצוני של ה-handler.
    expect(cb).toHaveBeenCalledWith({ error: 'mediasoup: produce failed' });

    // הליבה של הבדיקה: הסלוט לא נשאר תפוס אחרי כשל ה-produce.
    expect(streams[streamId].participantSocketIds.size).toBe(3);
    expect(streams[streamId].participantSocketIds.has(failingSocket.id)).toBe(
      false
    );

    // ולכן: משתתף אמיתי רביעי יכול עדיין לתפוס את המקום שהתפנה בחזרה —
    // אם ה-rollback לא היה קורה, המשתתף הזה היה נדחה בטעות עם ROOM_FULL.
    const newSocket = createMockSocket(
      'player-after-fail',
      'player-user-after-fail'
    );
    registerStreamHandlers(io, newSocket);
    mockFindFirst.mockResolvedValueOnce({ role: 'PLAYER' });

    const { callback } = await produceFor({
      streams,
      msServiceMock: msService,
      socket: newSocket,
      streamId,
      kind: 'video',
    });

    expect(callback).not.toHaveBeenCalledWith(
      expect.objectContaining({ error: ERROR_MESSAGES.ROOM_FULL })
    );
    expect(streams[streamId].participantSocketIds.size).toBe(4);
    expect(streams[streamId].participantSocketIds.has(newSocket.id)).toBe(true);
  });
});
