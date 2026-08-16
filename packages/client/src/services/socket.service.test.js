/* eslint-env jest */
// Covers the stream-room re-join registry [SCRUM-286 / M10-04].
// A socket.io reconnect gives the server a fresh socket in no room; the client
// must replay its STREAM.WATCH on every 'connect'. These tests drive a fake
// socket and assert the replay, the connected-time immediate join, and that a
// left room is not replayed.

jest.mock('socket.io-client', () => ({ io: jest.fn() }));
jest.mock('./auth.service', () => ({
  authService: { getToken: jest.fn().mockResolvedValue('tok') },
}));
jest.mock('./apiConfig', () => ({
  API_BASE_URL: 'http://app.test',
  MEDIA_BASE_URL: 'http://media.test',
}));
jest.mock('@worldplay/shared', () => ({
  SOCKET_EVENTS: {
    SYSTEM: { CONNECT: 'connect' },
    STREAM: { WATCH: 'stream:watch' },
  },
}));

const makeFakeSocket = () => {
  const handlers = {};
  return {
    connected: false,
    on: jest.fn((event, cb) => {
      (handlers[event] = handlers[event] || []).push(cb);
    }),
    emit: jest.fn(),
    // Test helper: fire a lifecycle event as socket.io would (connect/reconnect).
    fire: (event) => (handlers[event] || []).forEach((cb) => cb()),
  };
};

// Flush pending microtasks/timers so io() has been called and the 'connect'
// handler is registered. Post-SCRUM-264 connectAppSocket resolves only on the
// 'connect' event, so tests must start the connect, flush, then fire 'connect'.
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

let svc;
let io;

beforeEach(() => {
  // The registry and the singleton live at module scope — reset between tests.
  jest.resetModules();
  io = require('socket.io-client').io;
  svc = require('./socket.service');
});

test('replays tracked stream joins on connect and on every reconnect', async () => {
  const fake = makeFakeSocket();
  io.mockReturnValue(fake);

  const connecting = svc.connectAppSocket();
  await flush(); // io() called, 'connect' handler registered

  // Track a room while still disconnected → nothing emitted yet.
  svc.watchStreamRoom('stream-1');
  expect(fake.emit).not.toHaveBeenCalled();

  // First connect replays the join (and resolves connectAppSocket).
  fake.connected = true;
  fake.fire('connect');
  await connecting;
  expect(fake.emit).toHaveBeenCalledWith('stream:watch', {
    streamId: 'stream-1',
  });

  // A reconnect (same socket, 'connect' fires again) replays it again.
  fake.emit.mockClear();
  fake.fire('connect');
  expect(fake.emit).toHaveBeenCalledWith('stream:watch', {
    streamId: 'stream-1',
  });
});

test('joins immediately when the socket is already connected', async () => {
  const fake = makeFakeSocket();
  fake.connected = true;
  io.mockReturnValue(fake);

  const connecting = svc.connectAppSocket();
  await flush();
  fake.fire('connect');
  await connecting;

  svc.watchStreamRoom('stream-2');

  expect(fake.emit).toHaveBeenCalledWith('stream:watch', {
    streamId: 'stream-2',
  });
});

test('a left stream room is not replayed on reconnect', async () => {
  const fake = makeFakeSocket();
  io.mockReturnValue(fake);

  const connecting = svc.connectAppSocket();
  await flush();

  svc.watchStreamRoom('stream-1');
  svc.watchStreamRoom('stream-2');

  svc.leaveStreamRoom('stream-1');

  fake.connected = true;
  fake.fire('connect');
  await connecting;

  expect(fake.emit).not.toHaveBeenCalledWith('stream:watch', {
    streamId: 'stream-1',
  });
  // A room the user is still in is unaffected.
  expect(fake.emit).toHaveBeenCalledWith('stream:watch', {
    streamId: 'stream-2',
  });
});
