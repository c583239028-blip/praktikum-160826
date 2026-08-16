import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
// `prisma generate` has run (e.g. a fresh CI checkout). Nothing in this
// file exercises the playlist-sync/DB path, so a trivial stub is enough.
vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn().mockImplementation(() => ({})),
}));

import { StreamService } from '../services/stream.service.js';
import {
  createFakeTransport,
  createFakeFFmpegProcess,
} from './helpers/stream-service.fixtures.js';

/**
 * Regression coverage for a code-review finding: launchFFmpeg used to treat
 * "any video input" as enough to start FFmpeg, but ffmpeg.service.js's main
 * grid excludes the moderator entirely. A moderator-only video input (or,
 * independently, a main-grid input count outside 1-4) made buildFFmpegArgs
 * throw synchronously from inside a setTimeout/FFmpeg-close callback with no
 * try/catch anywhere in the call chain - crashing the whole media-server
 * process, taking every active stream down with it, not just this one.
 */

const router = {
  rtpCapabilities: {},
};

const createProducer = (id, kind) => ({ id, kind });

describe('StreamService — FFmpeg launch guard', () => {
  // Real Stream.id is @default(uuid()); ensureDirectory now rejects non-UUIDs.
  const streamId = 'a0000000-0000-4000-8000-000000000005';

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

  afterEach(async () => {
    await StreamService.stopRecording(streamId);
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('does not launch or crash when only the moderator has video, then launches once main video arrives', async () => {
    await StreamService.startRecording({
      streamId,
      router,
      producer: createProducer('moderator-video', 'video'),
      participantId: 'moderator-user',
      role: 'MODERATOR',
    });

    await expect(
      StreamService.startRecording({
        streamId,
        router,
        producer: createProducer('moderator-audio', 'audio'),
        participantId: 'moderator-user',
        role: 'MODERATOR',
      })
    ).resolves.not.toThrow();

    expect(mocks.spawn).not.toHaveBeenCalled();

    await StreamService.startRecording({
      streamId,
      router,
      producer: createProducer('host-video', 'video'),
      participantId: 'host-user',
      role: 'HOST',
    });

    await StreamService.startRecording({
      streamId,
      router,
      producer: createProducer('host-audio', 'audio'),
      participantId: 'host-user',
      role: 'HOST',
    });

    expect(mocks.spawn).toHaveBeenCalledTimes(1);
  });

  it('does not crash when a launch would build a grid outside the supported input range', async () => {
    const players = ['player-1', 'player-2', 'player-3', 'player-4'];

    await StreamService.startRecording({
      streamId,
      router,
      producer: createProducer('host-video', 'video'),
      participantId: 'host-user',
      role: 'HOST',
    });

    for (const playerId of players) {
      await StreamService.startRecording({
        streamId,
        router,
        producer: createProducer(`${playerId}-video`, 'video'),
        participantId: playerId,
        role: 'PLAYER',
      });
    }

    // 5 main-video inputs (host + 4 players) exceed ffmpeg.service.js's
    // 4-tile grid. The audio arrival below is what synchronously triggers
    // the first launch attempt.
    await expect(
      StreamService.startRecording({
        streamId,
        router,
        producer: createProducer('host-audio', 'audio'),
        participantId: 'host-user',
        role: 'HOST',
      })
    ).resolves.not.toThrow();

    expect(mocks.spawn).not.toHaveBeenCalled();
  });
});
