import { vi } from 'vitest';

// Shared across stream.service.*.test.js — both files exercise
// StreamService.startRecording/stopRecording against the same shape of
// mocked mediasoup transport/consumer and ffmpeg child process.
export const createFakeTransport = () => {
  const consumer = {
    closed: false,
    close: vi.fn(function closeConsumer() {
      this.closed = true;
    }),
    requestKeyFrame: vi.fn().mockResolvedValue(),
  };

  const transport = {
    closed: false,
    connect: vi.fn().mockResolvedValue(),
    consume: vi.fn().mockResolvedValue(consumer),
    close: vi.fn(function closeTransport() {
      this.closed = true;
    }),
  };

  return { transport, consumer };
};

export const createFakeFFmpegProcess = () => {
  const handlers = {};

  return {
    handlers,
    kill: vi.fn(),
    on: vi.fn((event, handler) => {
      handlers[event] = handler;
    }),
  };
};
