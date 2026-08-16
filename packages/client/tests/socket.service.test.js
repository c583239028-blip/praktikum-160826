// ─────────────────────────────────────────────
// Mocks: io() returns a controllable fake socket whose 'connect' /
// 'connect_error' events we fire by hand. authService.getToken is stubbed
// per-test. apiConfig is mocked so the module has stable URLs under jest.
//
// resetModules() runs each test to get a fresh module-level singleton, so the
// io / authService references are re-required inside beforeEach to match the
// copies the freshly-loaded socket.service sees.
// ─────────────────────────────────────────────
jest.mock('socket.io-client', () => ({ io: jest.fn() }));
jest.mock('../src/services/auth.service', () => ({
  authService: { getToken: jest.fn() },
}));
jest.mock('../src/services/apiConfig', () => ({
  API_BASE_URL: 'http://app.test',
  MEDIA_BASE_URL: 'http://media.test',
}));

// Builds a fake socket that records event handlers so a test can fire them.
// Handlers are stored per-event as an array (not a single slot) because
// connectAppSocket registers two separate 'connect' listeners on the real
// socket (the connect helper's resolve listener, and a persistent
// replayRoomJoins listener) — a single-slot mock would silently let the
// second registration overwrite the first and hide that behavior.
const makeFakeSocket = () => {
  const handlers = {};
  return {
    connected: false,
    on: jest.fn((event, cb) => {
      (handlers[event] = handlers[event] || []).push(cb);
    }),
    emit: jest.fn(),
    // test helper: fires every handler registered for the event, in
    // registration order — mirrors how socket.io dispatches to listeners.
    fire(event, ...args) {
      (handlers[event] || []).forEach((cb) => cb(...args));
    },
  };
};

describe('connectAppSocket (SCRUM-264)', () => {
  let io;
  let authService;
  let connectAppSocket;
  let watchStreamRoom;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    ({ io } = require('socket.io-client'));
    ({ authService } = require('../src/services/auth.service'));
    ({
      connectAppSocket,
      watchStreamRoom,
    } = require('../src/services/socket.service'));
    authService.getToken.mockResolvedValue('valid-token');
  });

  it('resolves only after the "connect" event, not on io() return', async () => {
    const fake = makeFakeSocket();
    io.mockReturnValue(fake);

    let resolved = false;
    const p = connectAppSocket().then((s) => {
      resolved = true;
      return s;
    });

    // io() has returned, but 'connect' has not fired yet — must stay pending.
    await Promise.resolve();
    expect(resolved).toBe(false);

    fake.connected = true;
    fake.fire('connect');
    const socket = await p;

    expect(resolved).toBe(true);
    expect(socket).toBe(fake);
  });

  it('rejects on "connect_error"', async () => {
    const fake = makeFakeSocket();
    io.mockReturnValue(fake);

    const p = connectAppSocket();
    await Promise.resolve();
    fake.fire('connect_error', new Error('handshake failed'));

    await expect(p).rejects.toThrow('handshake failed');
  });

  it('dedups concurrent calls into a single io() connection', async () => {
    const fake = makeFakeSocket();
    io.mockReturnValue(fake);

    const p1 = connectAppSocket();
    const p2 = connectAppSocket();

    await Promise.resolve();
    fake.connected = true;
    fake.fire('connect');

    const [s1, s2] = await Promise.all([p1, p2]);
    expect(s1).toBe(fake);
    expect(s2).toBe(fake);
    expect(io).toHaveBeenCalledTimes(1); // not two sockets
  });

  it('does not overwrite/orphan an instance that is mid-reconnect', async () => {
    const fake = makeFakeSocket();
    io.mockReturnValue(fake);

    // First connect succeeds.
    const p = connectAppSocket();
    await Promise.resolve();
    fake.connected = true;
    fake.fire('connect');
    await p;
    expect(io).toHaveBeenCalledTimes(1);

    // Simulate a transient drop: instance still exists, connected === false.
    fake.connected = false;
    const again = await connectAppSocket();

    // Must return the SAME instance and NOT call io() again (no orphan socket).
    expect(again).toBe(fake);
    expect(io).toHaveBeenCalledTimes(1);
  });

  it('resolves null when there is no token (preserves caller contract)', async () => {
    authService.getToken.mockResolvedValue(null);

    const result = await connectAppSocket();

    expect(result).toBeNull();
    expect(io).not.toHaveBeenCalled();
  });

  // Code-review finding on PR #283: replayRoomJoins is registered as its own
  // persistent 'connect' listener (via the connectSocket helper's onSocket),
  // separate from the listener that resolves the connect promise — it must
  // keep firing on every reconnect, not just the first connect. Regression
  // coverage for this already exists in src/services/socket.service.test.js,
  // but that file wasn't touched by this PR and its test wasn't obvious from
  // the diff — this test covers the same behavior directly in the file this
  // PR does change, using the array-based mock above (a single-slot mock
  // would let the second 'connect' listener silently overwrite the first and
  // hide a regression here).
  it('replays a watched stream room on connect and again on a later reconnect', async () => {
    const fake = makeFakeSocket();
    io.mockReturnValue(fake);

    const connecting = connectAppSocket();
    await Promise.resolve();

    watchStreamRoom('stream-1');
    expect(fake.emit).not.toHaveBeenCalled();

    fake.connected = true;
    fake.fire('connect');
    await connecting;

    expect(fake.emit).toHaveBeenCalledWith('stream:watch', {
      streamId: 'stream-1',
    });

    // Reconnect: same socket fires 'connect' again (socket.io's own
    // reconnection, not a fresh connectAppSocket() call).
    fake.emit.mockClear();
    fake.fire('connect');

    expect(fake.emit).toHaveBeenCalledWith('stream:watch', {
      streamId: 'stream-1',
    });
  });
});

// Safety net written BEFORE the INFRA/refactor/shared-socket-connect-helper
// extraction: pins connectMediaSocket's current behavior (dedup, forceNew,
// error handling) so the refactor to a shared connect helper can be checked
// against it with a real regression test, not just by reading the diff.
describe('connectMediaSocket (pre-refactor baseline)', () => {
  let io;
  let authService;
  let connectMediaSocket;
  let getMediaSocket;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    ({ io } = require('socket.io-client'));
    ({ authService } = require('../src/services/auth.service'));
    ({
      connectMediaSocket,
      getMediaSocket,
    } = require('../src/services/socket.service'));
    authService.getToken.mockResolvedValue('valid-token');
  });

  it('resolves only after the "connect" event, not on io() return', async () => {
    const fake = makeFakeSocket();
    io.mockReturnValue(fake);

    let resolved = false;
    const p = connectMediaSocket().then((s) => {
      resolved = true;
      return s;
    });

    await Promise.resolve();
    expect(resolved).toBe(false);

    fake.connected = true;
    fake.fire('connect');
    const socket = await p;

    expect(resolved).toBe(true);
    expect(socket).toBe(fake);
  });

  it('passes forceNew: true to io()', async () => {
    const fake = makeFakeSocket();
    io.mockReturnValue(fake);

    connectMediaSocket();
    await Promise.resolve();

    expect(io).toHaveBeenCalledWith(
      'http://media.test',
      expect.objectContaining({ forceNew: true })
    );
  });

  it('rejects on "connect_error"', async () => {
    const fake = makeFakeSocket();
    io.mockReturnValue(fake);

    const p = connectMediaSocket();
    await Promise.resolve();
    fake.fire('connect_error', new Error('handshake failed'));

    await expect(p).rejects.toThrow('handshake failed');
  });

  it('dedups concurrent calls into a single io() connection', async () => {
    const fake = makeFakeSocket();
    io.mockReturnValue(fake);

    const p1 = connectMediaSocket();
    const p2 = connectMediaSocket();

    await Promise.resolve();
    fake.connected = true;
    fake.fire('connect');

    const [s1, s2] = await Promise.all([p1, p2]);
    expect(s1).toBe(fake);
    expect(s2).toBe(fake);
    expect(io).toHaveBeenCalledTimes(1); // not two sockets
  });

  it('opens a fresh io() connection on a later call even if a prior instance exists and is disconnected (forceNew, no reuse guard)', async () => {
    const fake1 = makeFakeSocket();
    io.mockReturnValue(fake1);

    // First connect succeeds.
    const p = connectMediaSocket();
    await Promise.resolve();
    fake1.connected = true;
    fake1.fire('connect');
    await p;
    expect(io).toHaveBeenCalledTimes(1);

    // The instance later drops without going through connectMediaSocket
    // again yet (e.g. transport loss). Unlike connectAppSocket, media has no
    // "reuse the existing instance" guard — forceNew means every call here
    // is expected to open a new connection.
    fake1.connected = false;
    const fake2 = makeFakeSocket();
    io.mockReturnValue(fake2);

    const again = connectMediaSocket();
    await Promise.resolve();
    fake2.connected = true;
    fake2.fire('connect');
    const socket = await again;

    expect(socket).toBe(fake2);
    expect(io).toHaveBeenCalledTimes(2);
  });

  it('rejects when there is no token (does not resolve null like connectAppSocket)', async () => {
    authService.getToken.mockResolvedValue(null);

    await expect(connectMediaSocket()).rejects.toThrow('No token found');
    expect(io).not.toHaveBeenCalled();
  });

  it('keeps getMediaSocket() pointing at the socket even after connect_error (instance is set synchronously, not only on success)', async () => {
    const fake = makeFakeSocket();
    io.mockReturnValue(fake);

    const p = connectMediaSocket();
    await Promise.resolve();

    expect(getMediaSocket()).toBe(fake);

    fake.fire('connect_error', new Error('boom'));
    await expect(p).rejects.toThrow('boom');

    expect(getMediaSocket()).toBe(fake);
  });
});
