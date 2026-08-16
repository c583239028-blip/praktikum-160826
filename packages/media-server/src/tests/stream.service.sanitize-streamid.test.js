import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ERROR_MESSAGES } from '@worldplay/shared';

const mocks = vi.hoisted(() => ({
  allocate: vi.fn(),
  release: vi.fn(),
  createPlainTransportForFFmpeg: vi.fn(),
  spawn: vi.fn(),
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  chmodSync: vi.fn(),
  writeFileSync: vi.fn(),
  rmSync: vi.fn(),
}));

vi.mock('../services/port-pool.service.js', () => ({
  rtpPortPool: {
    allocate: mocks.allocate,
    release: mocks.release,
  },
}));

vi.mock('../services/mediasoup.service.js', () => ({
  createPlainTransportForFFmpeg: mocks.createPlainTransportForFFmpeg,
}));

vi.mock('child_process', () => ({
  spawn: mocks.spawn,
}));

vi.mock('fs', () => ({
  default: {
    existsSync: mocks.existsSync,
    mkdirSync: mocks.mkdirSync,
    chmodSync: mocks.chmodSync,
    writeFileSync: mocks.writeFileSync,
    rmSync: mocks.rmSync,
  },
}));

// StreamService pulls in HlsPlaylistService -> lib/prisma.js, which
// constructs a real PrismaClient at import time. That throws unless
// `prisma generate` has run (e.g. a fresh CI checkout). Nothing here
// exercises the DB path, so a trivial stub is enough.
vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn().mockImplementation(() => ({})),
}));

// isValidStreamId is intentionally NOT mocked — the real UUID validation
// is exactly what these tests exercise (SCRUM-290 path traversal guard).
import { StreamService } from '../services/stream.service.js';
import {
  createFakeTransport,
  createFakeFFmpegProcess,
} from './helpers/stream-service.fixtures.js';

const router = { rtpCapabilities: {} };

const createProducer = (id, kind) => ({ id, kind });

// A real Stream.id is @default(uuid()); use a well-formed UUID for the
// happy-path assertion.
const VALID_STREAM_ID = '11111111-1111-4111-8111-111111111111';

const TRAVERSAL_STREAM_IDS = [
  '../../../etc/foo',
  '..\\..\\windows',
  'not-a-uuid',
  '',
];

/**
 * SCRUM-290 — ensureDirectory(streamId) builds a filesystem path straight
 * from a client-supplied streamId, and stopRecording later fs.rmSync's that
 * same path recursively. A streamId containing ../ escapes public/streams/.
 * These tests prove a malformed streamId is rejected before it ever reaches
 * fs.mkdirSync / fs.rmSync.
 */
describe('StreamService — streamId sanitization (path traversal guard)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    mocks.existsSync.mockReturnValue(false);
    mocks.release.mockReturnValue(true);
    mocks.spawn.mockImplementation(createFakeFFmpegProcess);
    mocks.createPlainTransportForFFmpeg.mockImplementation(
      async () => createFakeTransport().transport
    );

    let nextPort = 11000;
    mocks.allocate.mockImplementation(() => nextPort++);
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it.each(TRAVERSAL_STREAM_IDS)(
    'rejects startRecording for malformed streamId %j without touching the filesystem',
    async (streamId) => {
      await expect(
        StreamService.startRecording({
          streamId,
          router,
          producer: createProducer('host-video', 'video'),
          participantId: 'host-user',
          role: 'HOST',
        })
      ).rejects.toThrow(ERROR_MESSAGES.INVALID_STREAM_ID);

      expect(mocks.mkdirSync).not.toHaveBeenCalled();
    }
  );

  it('never calls fs.rmSync for a malformed streamId (no matching stream state)', async () => {
    await expect(
      StreamService.stopRecording('../../etc')
    ).resolves.toBeUndefined();

    expect(mocks.rmSync).not.toHaveBeenCalled();
  });

  it('lets a valid UUID streamId through to the filesystem (happy path unchanged)', async () => {
    await StreamService.startRecording({
      streamId: VALID_STREAM_ID,
      router,
      producer: createProducer('host-video', 'video'),
      participantId: 'host-user',
      role: 'HOST',
    });

    expect(mocks.mkdirSync).toHaveBeenCalledTimes(1);

    // Cleanup: valid id -> real state was created, so stopRecording removes it.
    mocks.existsSync.mockReturnValue(true);
    await StreamService.stopRecording(VALID_STREAM_ID);
    expect(mocks.rmSync).toHaveBeenCalledTimes(1);
  });
});
