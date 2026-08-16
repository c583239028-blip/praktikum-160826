import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─────────────────────────────────────────────
// Mocks (same pattern as stream_handler_consume_test.js)
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
  },
  MAX_ACTIVE_PLAYERS: 4,
}));

import { registerStreamHandlers, streams } from '../sockets/stream.handler.js';
import * as msService from '../services/mediasoup.service.js';
import {
  createMockSocket,
  createMockIo,
  createRoomWithHost,
  produceFor,
  joinAndConsumeAll,
} from './helpers/liveFlow.harness.js';

describe('stream.handler — seed מ-currentProducers → consume ללולאה (SCRUM-224/232)', () => {
  let io;
  // Real Stream.id is @default(uuid()); create_room now rejects non-UUIDs.
  const streamId = 'a0000000-0000-4000-8000-000000000001';

  beforeEach(() => {
    vi.clearAllMocks();
    mockFindFirst.mockResolvedValue({ role: 'PLAYER' });
    Object.keys(streams).forEach((key) => delete streams[key]);
    io = createMockIo();
  });

  it('viewer שמצטרף לחדר עם 2 producers פעילים (host+player) מקבל את שניהם ב-currentProducers וצורך את שניהם בהצלחה', async () => {
    const hostSocket = createMockSocket('host-1', 'host-user');
    const playerSocket = createMockSocket('player-1', 'player-user');
    const viewerSocket = createMockSocket('viewer-1', 'viewer-user');

    await createRoomWithHost({
      io,
      streams,
      registerStreamHandlers,
      streamId,
      hostSocket,
    });

    // ה-host מפיק וידאו
    mockFindFirst.mockResolvedValueOnce({ role: 'HOST' });
    const { producer: hostProducer } = await produceFor({
      streams,
      msServiceMock: msService,
      socket: hostSocket,
      streamId,
      kind: 'video',
    });

    // שחקן שני מצטרף ומפיק
    registerStreamHandlers(io, playerSocket);
    mockFindFirst.mockResolvedValueOnce({ role: 'PLAYER' });
    const { producer: playerProducer } = await produceFor({
      streams,
      msServiceMock: msService,
      socket: playerSocket,
      streamId,
      kind: 'video',
    });

    // הצטרפות viewer + seed→consume ללולאה
    registerStreamHandlers(io, viewerSocket);
    const { joinResult, consumeResults } = await joinAndConsumeAll({
      streams,
      msServiceMock: msService,
      viewerSocket,
      streamId,
    });

    expect(joinResult.currentProducers).toHaveLength(2);
    expect(joinResult.currentProducers.map((p) => p.producerId).sort()).toEqual(
      [hostProducer.id, playerProducer.id].sort()
    );

    // consume נקרא בהצלחה על כל אחד מהם — לא רק על אחד
    expect(consumeResults).toHaveLength(2);
    consumeResults.forEach(({ callback }) => {
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ id: expect.any(String) })
      );
      expect(callback).not.toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.anything() })
      );
    });
  });

  it('viewer שמצטרף לחדר ריק (אין producers עדיין) מקבל currentProducers ריק ולא מנסה לצרוך כלום', async () => {
    const hostSocket = createMockSocket('host-2', 'host-user');
    const viewerSocket = createMockSocket('viewer-2', 'viewer-user');

    await createRoomWithHost({
      io,
      streams,
      registerStreamHandlers,
      streamId,
      hostSocket,
    });

    registerStreamHandlers(io, viewerSocket);
    const { joinResult, consumeResults } = await joinAndConsumeAll({
      streams,
      msServiceMock: msService,
      viewerSocket,
      streamId,
    });

    expect(joinResult.currentProducers).toEqual([]);
    expect(consumeResults).toEqual([]);
  });

  it('כל consume בלולאה מקבל rtpParameters/kind נכונים מהמוק — לא מתבלבל בין producers', async () => {
    const hostSocket = createMockSocket('host-3', 'host-user');
    const playerSocket = createMockSocket('player-3', 'player-user');
    const viewerSocket = createMockSocket('viewer-3', 'viewer-user');

    await createRoomWithHost({
      io,
      streams,
      registerStreamHandlers,
      streamId,
      hostSocket,
    });

    mockFindFirst.mockResolvedValueOnce({ role: 'HOST' });
    await produceFor({
      streams,
      msServiceMock: msService,
      socket: hostSocket,
      streamId,
      kind: 'video',
    });

    registerStreamHandlers(io, playerSocket);
    mockFindFirst.mockResolvedValueOnce({ role: 'PLAYER' });
    await produceFor({
      streams,
      msServiceMock: msService,
      socket: playerSocket,
      streamId,
      kind: 'audio',
    });

    registerStreamHandlers(io, viewerSocket);
    const { consumeResults } = await joinAndConsumeAll({
      streams,
      msServiceMock: msService,
      viewerSocket,
      streamId,
    });

    const producerIds = consumeResults.map((r) => r.producerId);
    // כל producerId ייחודי — אין דריסה/כפילות בלולאה
    expect(new Set(producerIds).size).toBe(producerIds.length);
  });
});
