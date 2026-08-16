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

const router = {
  rtpCapabilities: {},
};

const createProducer = (id, kind) => ({
  id,
  kind,
});

describe('StreamService — multi-input state', () => {
  // Real Stream.id is @default(uuid()); ensureDirectory now rejects non-UUIDs.
  const streamId = 'a0000000-0000-4000-8000-000000000004';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    mocks.existsSync.mockReturnValue(false);
    mocks.release.mockReturnValue(true);
    mocks.spawn.mockImplementation(createFakeFFmpegProcess);

    mocks.allocate
      .mockReturnValueOnce(11000)
      .mockReturnValueOnce(11001)
      .mockReturnValueOnce(11002)
      .mockReturnValueOnce(11003)
      .mockReturnValueOnce(11004)
      .mockReturnValueOnce(11005);
  });

  afterEach(async () => {
    await StreamService.stopRecording(streamId);
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('keeps host, player and moderator media resources without overwriting each other', async () => {
    const hostVideo = createFakeTransport();
    const hostAudio = createFakeTransport();
    const playerVideo = createFakeTransport();
    const playerAudio = createFakeTransport();
    const moderatorVideo = createFakeTransport();
    const moderatorAudio = createFakeTransport();

    mocks.createPlainTransportForFFmpeg
      .mockResolvedValueOnce(hostVideo.transport)
      .mockResolvedValueOnce(hostAudio.transport)
      .mockResolvedValueOnce(playerVideo.transport)
      .mockResolvedValueOnce(playerAudio.transport)
      .mockResolvedValueOnce(moderatorVideo.transport)
      .mockResolvedValueOnce(moderatorAudio.transport);

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

    await StreamService.startRecording({
      streamId,
      router,
      producer: createProducer('moderator-video', 'video'),
      participantId: 'moderator-user',
      role: 'MODERATOR',
    });

    await StreamService.startRecording({
      streamId,
      router,
      producer: createProducer('moderator-audio', 'audio'),
      participantId: 'moderator-user',
      role: 'MODERATOR',
    });

    expect(hostVideo.transport.connect).toHaveBeenCalledWith({
      ip: '127.0.0.1',
      port: 11000,
    });

    expect(hostAudio.transport.connect).toHaveBeenCalledWith({
      ip: '127.0.0.1',
      port: 11001,
    });

    expect(playerVideo.transport.connect).toHaveBeenCalledWith({
      ip: '127.0.0.1',
      port: 11002,
    });

    expect(playerAudio.transport.connect).toHaveBeenCalledWith({
      ip: '127.0.0.1',
      port: 11003,
    });

    expect(moderatorVideo.transport.connect).toHaveBeenCalledWith({
      ip: '127.0.0.1',
      port: 11004,
    });

    expect(moderatorAudio.transport.connect).toHaveBeenCalledWith({
      ip: '127.0.0.1',
      port: 11005,
    });

    expect(mocks.allocate).toHaveBeenCalledTimes(6);
  });

  it('releases all participant ports and closes all media resources on stop', async () => {
    const resources = Array.from({ length: 6 }, createFakeTransport);

    mocks.createPlainTransportForFFmpeg
      .mockResolvedValueOnce(resources[0].transport)
      .mockResolvedValueOnce(resources[1].transport)
      .mockResolvedValueOnce(resources[2].transport)
      .mockResolvedValueOnce(resources[3].transport)
      .mockResolvedValueOnce(resources[4].transport)
      .mockResolvedValueOnce(resources[5].transport);

    const participants = [
      ['host-user', 'HOST'],
      ['player-user', 'PLAYER'],
      ['moderator-user', 'MODERATOR'],
    ];

    for (const [participantId, role] of participants) {
      await StreamService.startRecording({
        streamId,
        router,
        producer: createProducer(`${participantId}-video`, 'video'),
        participantId,
        role,
      });

      await StreamService.startRecording({
        streamId,
        router,
        producer: createProducer(`${participantId}-audio`, 'audio'),
        participantId,
        role,
      });
    }

    await StreamService.stopRecording(streamId);

    for (const resource of resources) {
      expect(resource.consumer.close).toHaveBeenCalledTimes(1);
      expect(resource.transport.close).toHaveBeenCalledTimes(1);
    }

    expect(mocks.release).toHaveBeenCalledTimes(6);

    for (const port of [11000, 11001, 11002, 11003, 11004, 11005]) {
      expect(mocks.release).toHaveBeenCalledWith(port);
    }
  });
});
