import { describe, it, expect, vi, beforeEach } from 'vitest';

// This file intentionally does NOT mock '@worldplay/shared' — it exercises the
// REAL isValidStreamId + ERROR_MESSAGES so the stream:create_room gate (SCRUM-290,
// AC1 second enforcement point) is genuinely covered, not stubbed to () => true.
// Only the module's load-time side dependencies are mocked so importing the
// handler is safe; the guard returns before any of them is reached.

vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn().mockImplementation(() => ({})),
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

import { registerStreamHandlers, streams } from '../sockets/stream.handler.js';
import * as msService from '../services/mediasoup.service.js';
import { ERROR_MESSAGES, SOCKET_EVENTS } from '@worldplay/shared';

function createMockSocket(id = 'host-1', userId = 'host-user') {
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

const MALFORMED_STREAM_IDS = [
  '../../../etc/passwd',
  '..\\..\\windows',
  'not-a-uuid',
  '',
];

describe('stream.handler — stream:create_room streamId gate (SCRUM-290)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const key of Object.keys(streams)) delete streams[key];
  });

  it.each(MALFORMED_STREAM_IDS)(
    'rejects create_room for malformed streamId %j without creating a room or router',
    async (streamId) => {
      const socket = createMockSocket();
      registerStreamHandlers({}, socket);

      const cb = vi.fn();
      await socket.handlers[SOCKET_EVENTS.STREAM.CREATE_ROOM]({ streamId }, cb);

      expect(cb).toHaveBeenCalledWith({
        error: ERROR_MESSAGES.INVALID_STREAM_ID,
      });
      expect(streams[streamId]).toBeUndefined();
      expect(msService.getWorker).not.toHaveBeenCalled();
      expect(msService.createRouter).not.toHaveBeenCalled();
      expect(socket.join).not.toHaveBeenCalled();
    }
  );
});
