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
import { createFakeFFmpegProcess } from './helpers/stream-service.fixtures.js';

/**
 * AC2 coverage: "join/leave of a player/moderator updates the grid within a
 * few seconds (relaunch)". Every other test either drives FFmpegService
 * directly with a real ffmpeg binary (ffmpeg.service.relaunch.integration.test.js)
 * or mocks the ffmpeg child process without ever firing its 'close' event —
 * so stream.service.js's actual relaunch orchestration (restartFFmpeg ->
 * ffmpeg 'close' -> handleFFmpegClose -> launchFFmpeg with the rebuilt roster)
 * was never exercised end to end. This file closes that gap by manually
 * firing the mocked process's 'close' handler, exactly as the real child
 * process would after stop() sends SIGKILL.
 */

const router = {
  rtpCapabilities: {},
};

const createProducer = (id, kind) => ({ id, kind });

const getLatestSpawnedProcess = () => {
  const lastResult = mocks.spawn.mock.results.at(-1);

  return lastResult.value;
};

const getFlagValue = (args, flag) => args[args.indexOf(flag) + 1];

describe('StreamService — roster-change relaunch (AC2)', () => {
  // Real Stream.id is @default(uuid()); ensureDirectory now rejects non-UUIDs.
  const streamId = 'a0000000-0000-4000-8000-000000000003';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    mocks.existsSync.mockReturnValue(false);
    mocks.release.mockReturnValue(true);
    mocks.spawn.mockImplementation(createFakeFFmpegProcess);
    mocks.createPlainTransportForFFmpeg.mockImplementation(async () => ({
      connect: vi.fn().mockResolvedValue(),
      consume: vi.fn().mockResolvedValue({
        closed: false,
        close: vi.fn(),
        requestKeyFrame: vi.fn().mockResolvedValue(),
      }),
      close: vi.fn(),
      closed: false,
    }));

    let nextPort = 11000;
    mocks.allocate.mockImplementation(() => nextPort++);
  });

  afterEach(async () => {
    await StreamService.stopRecording(streamId);
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('spawns a second ffmpeg process with a two-tile grid when a player joins a live host-only stream', async () => {
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

    // Host-only launch: a single video input needs no filter_complex at all.
    expect(mocks.spawn).toHaveBeenCalledTimes(1);
    const firstArgs = mocks.spawn.mock.calls[0][1];
    expect(firstArgs).not.toContain('-filter_complex');

    const firstProcess = getLatestSpawnedProcess();

    // Player joins while the host is already live — this must trigger
    // restartFFmpeg() rather than a no-op.
    await StreamService.startRecording({
      streamId,
      router,
      producer: createProducer('player-video', 'video'),
      participantId: 'player-user',
      role: 'PLAYER',
    });

    await StreamService.startRecording({
      streamId,
      router,
      producer: createProducer('player-audio', 'audio'),
      participantId: 'player-user',
      role: 'PLAYER',
    });

    // No new spawn yet — the old process hasn't reported 'close'.
    expect(mocks.spawn).toHaveBeenCalledTimes(1);
    expect(firstProcess.kill).toHaveBeenCalledWith('SIGKILL');

    // Simulate the real ffmpeg process exiting after SIGKILL, exactly as
    // FFmpegService's own 'close' listener expects.
    firstProcess.handlers.close(null);

    // The relaunch is what actually spawns the replacement process.
    expect(mocks.spawn).toHaveBeenCalledTimes(2);

    const secondArgs = mocks.spawn.mock.calls[1][1];
    const filterComplex = getFlagValue(secondArgs, '-filter_complex');

    expect(filterComplex).toContain('xstack=inputs=2');
    expect(filterComplex).toContain('amix=inputs=2');
  });

  it('spawns a relaunched process without the departed player after they leave', async () => {
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

    const playerVideoProducer = createProducer('player-video', 'video');

    await StreamService.startRecording({
      streamId,
      router,
      producer: playerVideoProducer,
      participantId: 'player-user',
      role: 'PLAYER',
    });

    // Complete the relaunch that the player's join triggered so the stream
    // is fully live with two tiles before they leave.
    getLatestSpawnedProcess().handlers.close(null);
    expect(mocks.spawn).toHaveBeenCalledTimes(2);

    const liveProcess = getLatestSpawnedProcess();

    await StreamService.removeRecordingInput({
      streamId,
      producerId: playerVideoProducer.id,
    });

    expect(liveProcess.kill).toHaveBeenCalledWith('SIGKILL');

    liveProcess.handlers.close(null);

    expect(mocks.spawn).toHaveBeenCalledTimes(3);

    const finalArgs = mocks.spawn.mock.calls[2][1];
    expect(finalArgs).not.toContain('-filter_complex');
  });
});
