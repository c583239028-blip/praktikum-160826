import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─────────────────────────────────────────────
// Mocks — FINDINGS M4-05
// בודק את ולידציית ה-transport וה-rtpParameters ב-handler של PRODUCE:
// הסרת ה-transport הזמני וה-SSRC/payloadType המפוברקים, והחלפתם
// בדחייה מפורשת כשהלקוח לא שולח נתונים תקינים — וכן שמסלול ההצלחה
// (שני משדרים במקביל עם rtpParameters שונים) ממשיך לעבוד ללא התנגשות.
// ─────────────────────────────────────────────

vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn().mockImplementation(function PrismaClient() {
    return {
      stream: {
        update: vi.fn().mockResolvedValue({ id: 'stream-1' }),
        findUnique: vi.fn().mockResolvedValue({ hostId: 'host-user' }),
      },
      game: { findFirst: vi.fn().mockResolvedValue(null) },
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
    removeRecordingInput: vi.fn().mockResolvedValue(),
  },
}));

vi.mock('../services/mediasoup.service.js', () => ({
  getWorker: vi.fn(),
  createRouter: vi.fn(),
  createWebRtcTransport: vi.fn(),
}));

const { MAX_ACTIVE_PLAYERS } = vi.hoisted(() => ({ MAX_ACTIVE_PLAYERS: 4 }));

vi.mock('@worldplay/shared', () => ({
  isValidStreamId: () => true,
  PARTICIPANT_ROLES: {
    HOST: 'HOST',
    PLAYER: 'PLAYER',
    MODERATOR: 'MODERATOR',
    VIEWER: 'VIEWER',
  },
  ERROR_MESSAGES: {
    TRANSPORT_NOT_FOUND: 'Transport not found',
    RTP_PARAMETERS_REQUIRED: 'rtpParameters is required',
    KIND_REQUIRED: 'kind is required',
    ROOM_NOT_CREATED: 'Room not found. Call stream:create_room first.',
    STREAM_ROOM_NOT_FOUND: 'Stream Room not found',
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
    },
  },
}));

import { registerStreamHandlers, streams } from '../sockets/stream.handler.js';
import * as msService from '../services/mediasoup.service.js';
import { SOCKET_EVENTS, ERROR_MESSAGES } from '@worldplay/shared';
import {
  createMockSocket,
  createMockIo,
  createRoomWithHost,
  createFakeTransport,
  createDefaultRtpParameters,
  produceFor,
} from './helpers/liveFlow.harness.js';

// ─────────────────────────────────────────────
// עזר: יוצר חדר + transport אמיתי (דרך CREATE_TRANSPORT האמיתי) עבור socket
// נתון, כדי שטסטי ה-rtpParameters יוכלו לשלוח transportId תקף ולבודד
// את הבדיקה לוולידציית ה-rtpParameters בלבד.
// ─────────────────────────────────────────────
async function setupRoomWithRealTransport({ io, streamId, socket }) {
  await createRoomWithHost({
    io,
    streams,
    registerStreamHandlers,
    streamId,
    hostSocket: socket,
  });

  const fakeTransport = createFakeTransport(`transport-${socket.id}`);
  msService.createWebRtcTransport.mockResolvedValue(fakeTransport);

  const cb = vi.fn();
  await socket.handlers[SOCKET_EVENTS.STREAM.CREATE_TRANSPORT](
    { streamId },
    cb
  );

  return { transportId: cb.mock.calls[0][0].id, fakeTransport };
}

describe('stream.handler — PRODUCE: ולידציית transport ו-rtpParameters (FINDINGS M4-05)', () => {
  let io;
  const streamId = 'stream-rtp-validation-test';

  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(streams).forEach((key) => delete streams[key]);
    io = createMockIo();
  });

  // ───────────────────────────────────────────
  // קבוצה א׳ — transportId לא תקין
  // ───────────────────────────────────────────

  it('transportId שמצביע ל-transport שלא קיים — TRANSPORT_NOT_FOUND, ואין יצירת transport זמני מתוך PRODUCE', async () => {
    const hostSocket = createMockSocket('host-1', 'host-user');
    await createRoomWithHost({
      io,
      streams,
      registerStreamHandlers,
      streamId,
      hostSocket,
    });

    const cb = vi.fn();
    await hostSocket.handlers[SOCKET_EVENTS.STREAM.PRODUCE](
      {
        streamId,
        transportId: 'transport-that-does-not-exist',
        kind: 'video',
        rtpParameters: createDefaultRtpParameters('video'),
      },
      cb
    );

    expect(cb).toHaveBeenCalledWith({
      error: ERROR_MESSAGES.TRANSPORT_NOT_FOUND,
    });

    // ליבת הבאג המקורי: PRODUCE לא היה אמור ליצור transport בעצמו בשום
    // מצב — יצירת transport קורית אך ורק דרך ה-handler הייעודי
    // CREATE_TRANSPORT, שלא נקרא בטסט הזה כלל.
    expect(msService.createWebRtcTransport).not.toHaveBeenCalled();

    expect(io.to(streamId).emit).not.toHaveBeenCalledWith(
      SOCKET_EVENTS.STREAM.NEW_PRODUCER,
      expect.anything()
    );
  });

  it('transportId חסר לגמרי מהבקשה — TRANSPORT_NOT_FOUND, לא רק כשהערך שגוי', async () => {
    const hostSocket = createMockSocket('host-1b', 'host-user');
    await createRoomWithHost({
      io,
      streams,
      registerStreamHandlers,
      streamId,
      hostSocket,
    });

    const cb = vi.fn();
    await hostSocket.handlers[SOCKET_EVENTS.STREAM.PRODUCE](
      {
        streamId,
        // transportId לא נשלח בכלל — בדיוק התרחיש שתואר ב-M4-05 המקורי
        kind: 'video',
        rtpParameters: createDefaultRtpParameters('video'),
      },
      cb
    );

    expect(cb).toHaveBeenCalledWith({
      error: ERROR_MESSAGES.TRANSPORT_NOT_FOUND,
    });
    expect(msService.createWebRtcTransport).not.toHaveBeenCalled();
  });

  // ───────────────────────────────────────────
  // קבוצה ב׳ — rtpParameters לא תקין, בכל הצורות האפשריות
  // ───────────────────────────────────────────

  it.each([
    ['rtpParameters חסר לגמרי', undefined],
    ['codecs חסר', { encodings: [{ ssrc: 222 }] }],
    ['codecs ריק', { codecs: [], encodings: [{ ssrc: 223 }] }],
    [
      'encodings חסר',
      {
        codecs: [{ mimeType: 'video/vp8', payloadType: 96, clockRate: 90000 }],
      },
    ],
    [
      'encodings ריק',
      {
        codecs: [{ mimeType: 'video/vp8', payloadType: 96, clockRate: 90000 }],
        encodings: [],
      },
    ],
  ])(
    '%s — נדחה עם RTP_PARAMETERS_REQUIRED, אין producer שנוצר',
    async (_label, rtpParameters) => {
      const hostSocket = createMockSocket(`host-rtp-${_label}`, 'host-user');
      const { transportId, fakeTransport } = await setupRoomWithRealTransport({
        io,
        streamId,
        socket: hostSocket,
      });

      const cb = vi.fn();
      await hostSocket.handlers[SOCKET_EVENTS.STREAM.PRODUCE](
        { streamId, transportId, kind: 'video', rtpParameters },
        cb
      );

      expect(cb).toHaveBeenCalledWith({
        error: ERROR_MESSAGES.RTP_PARAMETERS_REQUIRED,
      });
      expect(fakeTransport.produce).not.toHaveBeenCalled();
    }
  );

  // ───────────────────────────────────────────
  // קבוצה ג׳ — מסלול הצלחה: שני producers עם rtpParameters שונים, ללא התנגשות
  // ───────────────────────────────────────────

  it('שני producers עם rtpParameters שונים מהלקוח — כל אחד נשמר כפי שנשלח, בלי דריסה ל-SSRC משותף (AC: אין התנגשות)', async () => {
    const hostSocket = createMockSocket('host-5', 'host-user');
    const playerSocket = createMockSocket('player-5', 'player-user');

    await createRoomWithHost({
      io,
      streams,
      registerStreamHandlers,
      streamId,
      hostSocket,
    });
    registerStreamHandlers(io, playerSocket);

    const hostRtpParameters = {
      codecs: [{ mimeType: 'video/vp8', payloadType: 96, clockRate: 90000 }],
      encodings: [{ ssrc: 555111 }],
    };
    const playerRtpParameters = {
      codecs: [{ mimeType: 'video/vp8', payloadType: 96, clockRate: 90000 }],
      encodings: [{ ssrc: 999222 }],
    };

    // מוודאים קודם שנתוני הבדיקה עצמם אכן שונים — אחרת הטסט לא באמת בודק כלום.
    expect(hostRtpParameters.encodings[0].ssrc).not.toBe(
      playerRtpParameters.encodings[0].ssrc
    );

    const hostResult = await produceFor({
      streams,
      msServiceMock: msService,
      socket: hostSocket,
      streamId,
      kind: 'video',
      rtpParameters: hostRtpParameters,
    });

    const playerResult = await produceFor({
      streams,
      msServiceMock: msService,
      socket: playerSocket,
      streamId,
      kind: 'video',
      rtpParameters: playerRtpParameters,
    });

    // ליבת ה-AC: השרת מעביר את ה-rtpParameters בדיוק כפי שהתקבל מכל לקוח —
    // לא דורס אותם לערך קבוע משותף (payloadType: 101 / ssrc: 11111111
    // הישנים), שהוא בדיוק מה שגרם להתנגשות בממצא המקורי.
    expect(hostResult.transport.produce).toHaveBeenCalledWith(
      expect.objectContaining({ rtpParameters: hostRtpParameters })
    );
    expect(playerResult.transport.produce).toHaveBeenCalledWith(
      expect.objectContaining({ rtpParameters: playerRtpParameters })
    );

    // מסלול ההצלחה עצמו לא נשבר: ה-callback חוזר עם מזהה producer תקין,
    // ולא עם שגיאה — לא מספיק להוכיח שהבאג נעלם, צריך גם להוכיח
    // שההתנהגות התקינה נשארה שלמה.
    expect(hostResult.callback).toHaveBeenCalledWith({
      id: hostResult.producer.id,
    });
    expect(playerResult.callback).toHaveBeenCalledWith({
      id: playerResult.producer.id,
    });
    expect(hostResult.callback).not.toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.anything() })
    );

    // ושני ה-producers אכן שודרו לחדר, עם מזהים שונים.
    const newProducerEmits = io
      .to(streamId)
      .emit.mock.calls.filter(
        ([event]) => event === SOCKET_EVENTS.STREAM.NEW_PRODUCER
      )
      .map(([, payload]) => payload.producerId);

    expect(newProducerEmits).toContain(hostResult.producer.id);
    expect(newProducerEmits).toContain(playerResult.producer.id);
    expect(new Set(newProducerEmits).size).toBe(2);
  });
});
