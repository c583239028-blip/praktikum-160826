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

const videoProducer = {
  id: 'video-producer',
  kind: 'video',
};

const audioProducer = {
  id: 'audio-producer',
  kind: 'audio',
};

const startHostRecording = (streamId, producer) =>
  StreamService.startRecording({
    streamId,
    router,
    producer,
    participantId: 'host-user',
    role: 'HOST',
  });

describe('StreamService — RTP port pool integration', () => {
  const createdStreamIds = [];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    mocks.existsSync.mockReturnValue(false);
    mocks.spawn.mockImplementation(createFakeFFmpegProcess);
    mocks.release.mockReturnValue(true);
  });

  afterEach(async () => {
    for (const streamId of createdStreamIds.splice(0)) {
      await StreamService.stopRecording(streamId);
    }

    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('connects video and audio transports to different allocated ports', async () => {
    const streamId = 'a0000000-0000-4000-8000-000000000010';
    createdStreamIds.push(streamId);

    mocks.allocate.mockReturnValueOnce(11000).mockReturnValueOnce(11001);

    const videoResource = createFakeTransport();
    const audioResource = createFakeTransport();

    mocks.createPlainTransportForFFmpeg
      .mockResolvedValueOnce(videoResource.transport)
      .mockResolvedValueOnce(audioResource.transport);

    await startHostRecording(streamId, videoProducer);
    await startHostRecording(streamId, audioProducer);

    expect(mocks.allocate).toHaveBeenCalledTimes(2);

    expect(videoResource.transport.connect).toHaveBeenCalledWith({
      ip: '127.0.0.1',
      port: 11000,
    });

    expect(audioResource.transport.connect).toHaveBeenCalledWith({
      ip: '127.0.0.1',
      port: 11001,
    });
  });

  it('releases both stream ports when recording stops', async () => {
    const streamId = 'a0000000-0000-4000-8000-000000000011';
    createdStreamIds.push(streamId);

    mocks.allocate.mockReturnValueOnce(11000).mockReturnValueOnce(11001);

    const videoResource = createFakeTransport();
    const audioResource = createFakeTransport();

    mocks.createPlainTransportForFFmpeg
      .mockResolvedValueOnce(videoResource.transport)
      .mockResolvedValueOnce(audioResource.transport);

    await startHostRecording(streamId, videoProducer);
    await startHostRecording(streamId, audioProducer);

    await StreamService.stopRecording(streamId);

    expect(videoResource.consumer.close).toHaveBeenCalledTimes(1);
    expect(videoResource.transport.close).toHaveBeenCalledTimes(1);
    expect(audioResource.consumer.close).toHaveBeenCalledTimes(1);
    expect(audioResource.transport.close).toHaveBeenCalledTimes(1);

    expect(mocks.release).toHaveBeenCalledWith(11000);
    expect(mocks.release).toHaveBeenCalledWith(11001);

    createdStreamIds.splice(createdStreamIds.indexOf(streamId), 1);
  });

  it('allows released ports to be allocated to a later stream', async () => {
    const firstStreamId = 'a0000000-0000-4000-8000-000000000012';
    const secondStreamId = 'a0000000-0000-4000-8000-000000000013';

    createdStreamIds.push(firstStreamId, secondStreamId);

    mocks.allocate.mockReturnValueOnce(11000).mockReturnValueOnce(11000);

    const firstVideoResource = createFakeTransport();
    const secondVideoResource = createFakeTransport();

    mocks.createPlainTransportForFFmpeg
      .mockResolvedValueOnce(firstVideoResource.transport)
      .mockResolvedValueOnce(secondVideoResource.transport);

    await startHostRecording(firstStreamId, videoProducer);

    await StreamService.stopRecording(firstStreamId);

    await startHostRecording(secondStreamId, videoProducer);

    expect(mocks.release).toHaveBeenCalledWith(11000);

    expect(secondVideoResource.transport.connect).toHaveBeenCalledWith({
      ip: '127.0.0.1',
      port: 11000,
    });

    createdStreamIds.splice(createdStreamIds.indexOf(firstStreamId), 1);
  });

  it('does not allocate a port when transport creation fails', async () => {
    const streamId = 'a0000000-0000-4000-8000-000000000014';

    mocks.createPlainTransportForFFmpeg.mockRejectedValueOnce(
      new Error('Transport creation failed')
    );

    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    try {
      await expect(startHostRecording(streamId, videoProducer)).rejects.toThrow(
        'Transport creation failed'
      );

      expect(mocks.allocate).not.toHaveBeenCalled();
      expect(mocks.release).not.toHaveBeenCalled();
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });
});
