// packages/media-server/src/tests/helpers/liveFlow.harness.js
//
// Reusable harness for simulating host+player+viewer flows in vitest.
// Replaces the old manual browser-tab QA process (SCRUM-224/232).
//
// Consumers of this file (test suites) are responsible for mocking
// '@prisma/client', '../utils/logger.js', '../services/stream.service.js',
// '../services/mediasoup.service.js', and '@worldplay/shared' BEFORE
// importing '../../sockets/stream.handler.js', exactly as the existing
// stream_handler_*_test.js files already do. This harness does not set up
// those mocks itself — it only provides the socket/io/transport fakes and
// orchestration helpers, so it can be imported safely from any test file
// regardless of how that file's mocks are structured.

import { vi } from 'vitest';

/**
 * Creates a fake Socket.IO socket that captures registered event handlers
 * so tests can invoke them directly (mirrors the pattern already used in
 * stream_handler_consume_test.js).
 */
export function createMockSocket(id, userId = `user-${id}`) {
  const handlers = {};
  return {
    id,
    user: { id: userId, username: `user-${userId}` },
    handshake: { auth: { token: 'mock-token' } },
    handlers,
    on: vi.fn((event, handler) => {
      handlers[event] = handler;
    }),
    join: vi.fn(),
  };
}

/**
 * Creates a fake Socket.IO server (`io`). Each distinct room name passed to
 * `io.to(room)` gets its own stable emit spy, stored in an internal Map —
 * so `io.to('room-A').emit` and `io.to('room-B').emit` are different spies.
 * This matters for tests asserting "event was NOT sent to room X": with a
 * single shared spy, an emit to room Y would be indistinguishable from one
 * to room X, masking real routing bugs.
 *
 * Also exposes `io.sockets.adapter.rooms` (real Socket.IO shape:
 * `Map<roomName, Set<socketId>>`), and an internal `_roomMembers` handle
 * of the same Map. `_roomMembers` is only meant to be used by
 * `attachRoomTracking`/`simulateDisconnect` below — test files should read
 * room state via `io.sockets.adapter.rooms.get(room)`, matching how
 * production code (stream.handler.js) reads it.
 *
 * By itself, `createMockIo()` does NOT make `socket.join` populate this map
 * — sockets created via `createMockSocket` keep their existing no-op
 * `join: vi.fn()`, so every pre-existing test suite is unaffected. Room
 * tracking only activates for sockets explicitly wired with
 * `attachRoomTracking(io, socket)`.
 */
export function createMockIo() {
  const roomEmitters = new Map();
  const roomMembers = new Map();

  return {
    to: vi.fn((room) => {
      if (!roomEmitters.has(room)) {
        roomEmitters.set(room, { emit: vi.fn() });
      }
      return roomEmitters.get(room);
    }),
    sockets: {
      adapter: {
        rooms: {
          get: (room) => roomMembers.get(room),
        },
      },
    },
    _roomMembers: roomMembers,
  };
}

/**
 * Opt-in room tracking for a mock socket. Overrides `socket.join` so that,
 * from this point on, calling it actually records membership in the given
 * `io`'s room registry (`io._roomMembers`) — mirroring what real
 * Socket.IO does when production code calls `socket.join(streamId)`.
 *
 * Does not affect sockets that never receive this call: their `join`
 * remains the plain `vi.fn()` no-op from `createMockSocket`, so existing
 * suites that don't call this function see no behavior change whatsoever.
 *
 * @param {object} io - a mock io from createMockIo()
 * @param {object} socket - a mock socket from createMockSocket()
 */
export function attachRoomTracking(io, socket) {
  socket.join = vi.fn((room) => {
    if (!io._roomMembers.has(room)) {
      io._roomMembers.set(room, new Set());
    }
    io._roomMembers.get(room).add(socket.id);
  });
}

/**
 * Simulates a socket disconnecting, matching real Socket.IO ordering:
 * the socket is removed from every room it was in FIRST, and only then
 * is the registered `disconnect` handler invoked — exactly as documented
 * in stream.handler.js's own comment about why a reverse-map (not
 * `socket.rooms`) is needed to know which stream a disconnecting socket
 * belonged to.
 *
 * Only meaningful for sockets previously wired with `attachRoomTracking`;
 * for a socket that was never tracked, this just invokes its disconnect
 * handler (no room cleanup needed, since it was never registered anywhere).
 *
 * @param {object} io - a mock io from createMockIo()
 * @param {object} socket - a mock socket, already registered via
 * registerStreamHandlers so `socket.handlers['disconnect']` exists
 */
export async function simulateDisconnect(io, socket) {
  for (const members of io._roomMembers.values()) {
    members.delete(socket.id);
  }

  const disconnectHandler = socket.handlers['disconnect'];
  if (disconnectHandler) {
    await disconnectHandler();
  }
}

/** Creates a fake mediasoup Producer with an observer close hook. */
export function createFakeProducer(id, kind = 'video') {
  const closeListeners = [];
  return {
    id,
    kind,
    closed: false,
    appData: {},
    close: vi.fn(function () {
      this.closed = true;
      closeListeners.forEach((fn) => fn());
    }),
    observer: {
      on: vi.fn((event, cb) => {
        if (event === 'close') closeListeners.push(cb);
      }),
    },
  };
}

/** Creates a fake mediasoup Consumer. */
export function createFakeConsumer(id, kind = 'video') {
  return {
    id,
    kind,
    rtpParameters: { codecs: [] },
    resume: vi.fn().mockResolvedValue(),
    on: vi.fn(),
  };
}

/** Creates a fake WebRTC transport that can both produce and consume. */
export function createFakeTransport(id) {
  return {
    id,
    iceParameters: {},
    iceCandidates: [],
    dtlsParameters: {},
    on: vi.fn(),
    produce: vi.fn(),
    consume: vi.fn(),
  };
}

/**
 * Registers a host socket and creates the room via CREATE_ROOM.
 * Returns the streamRoom-adjacent handles needed for further orchestration.
 *
 * @param {object} params
 * @param {object} params.io - fake io (see createMockIo)
 * @param {object} params.streams - the `streams` export from stream.handler.js
 * @param {Function} params.registerStreamHandlers
 * @param {string} params.streamId
 * @param {object} params.hostSocket
 */
export async function createRoomWithHost({
  io,
  streams,
  registerStreamHandlers,
  streamId,
  hostSocket,
}) {
  registerStreamHandlers(io, hostSocket);
  const cb = vi.fn();
  await hostSocket.handlers['stream:create_room']({ streamId }, cb);

  // Fake router capable of canConsume — tests may override further.
  streams[streamId].router = {
    rtpCapabilities: {},
    close: vi.fn(),
    canConsume: vi.fn().mockReturnValue(true),
  };

  return { createRoomCallback: cb };
}

/**
 * Realistic-shaped rtpParameters for produceFor's default flow. A fresh
 * SSRC per call (not a fixed constant) is essential — several test suites
 * spin up multiple concurrent producers via produceFor, and stream.handler.js
 * now requires every client-supplied rtpParameters to carry its own SSRC,
 * rejecting the request otherwise. A single shared/fixed SSRC here would
 * silently reintroduce the exact collision bug the handler now guards
 * against (FINDINGS M4-05).
 */
export function createDefaultRtpParameters(kind) {
  const ssrc = Math.floor(Math.random() * 1_000_000_000);
  return kind === 'audio'
    ? {
        codecs: [
          {
            mimeType: 'audio/opus',
            payloadType: 100,
            clockRate: 48000,
            channels: 2,
          },
        ],
        encodings: [{ ssrc }],
      }
    : {
        codecs: [{ mimeType: 'video/vp8', payloadType: 101, clockRate: 90000 }],
        encodings: [{ ssrc }],
      };
}

/**
 * Shared setup between produceFor and produceForWithGate: creates the fake
 * transport + producer and wires the transport into the room, but leaves
 * *how* transport.produce() resolves up to the caller (produceImpl) — that
 * is the one thing that actually differs between the two.
 */
function setupProduceCall({
  streams,
  msServiceMock,
  socket,
  streamId,
  kind,
  produceImpl,
}) {
  const streamRoom = streams[streamId];
  const transport = createFakeTransport(`transport-${socket.id}-${kind}`);
  const producer = createFakeProducer(`producer-${socket.id}-${kind}`, kind);

  transport.produce.mockImplementation(produceImpl(producer));
  msServiceMock.createWebRtcTransport.mockResolvedValue(transport);
  streamRoom.transports.set(transport.id, transport);

  return { transport, producer };
}

/**
 * Simulates a participant (host/player/viewer) producing media on a given
 * stream. Wires up a fresh fake transport + producer, calls the PRODUCE
 * handler, and returns the result (including any rejection error).
 *
 * @param {object} params
 * @param {object} params.streams
 * @param {object} params.msServiceMock - the mocked '../services/mediasoup.service.js'
 * @param {object} params.socket - the participant's mock socket (already registered)
 * @param {string} params.streamId
 * @param {string} params.kind - 'video' | 'audio'
 * @param {object} [params.rtpParameters] - optional; when omitted, the
 * harness generates realistic-shaped rtpParameters matching `kind`, with a
 * fresh random SSRC per call — stream.handler.js requires valid
 * rtpParameters from every producer and rejects the request otherwise
 * (FINDINGS M4-05). Pass explicit rtpParameters to test behavior against
 * specific codec/encoding data.
 */
export async function produceFor({
  streams,
  msServiceMock,
  socket,
  streamId,
  kind = 'video',
  rtpParameters = createDefaultRtpParameters(kind),
}) {
  // Mirrors real mediasoup behavior: appData passed to transport.produce()
  // is stored on the resulting producer. Without this, producer.appData
  // never gets socketId set, and the cap-4 cleanup logic (which matches
  // producers to their owning socket via appData.socketId) can't tell
  // which producers belong to a disconnecting participant.
  const { transport, producer } = setupProduceCall({
    streams,
    msServiceMock,
    socket,
    streamId,
    kind,
    produceImpl: (p) => async (opts) => {
      p.appData = opts?.appData || {};
      return p;
    },
  });

  // Goes through the real CREATE_TRANSPORT handler instead of relying only
  // on setupProduceCall's direct streamRoom.transports.set() above.
  // stream.handler.js keeps its own private `transports` registry
  // (module-scoped, not exported) that only CREATE_TRANSPORT populates —
  // PRODUCE looks up transportId there, not in streamRoom.transports.
  // Fabricating a transportId here used to work only because the old
  // "temporary transport" fallback in PRODUCE (removed under FINDINGS
  // M4-05) silently called createWebRtcTransport and populated that
  // private registry as a side effect. setupProduceCall already primed
  // msServiceMock.createWebRtcTransport to resolve with this same fake
  // transport, so CREATE_TRANSPORT hands it straight back and registers
  // it in the private registry too.
  const createTransportCb = vi.fn();
  await socket.handlers['stream:create_transport'](
    { streamId },
    createTransportCb
  );
  const transportId = createTransportCb.mock.calls[0][0].id;

  const cb = vi.fn();
  await socket.handlers['stream:produce'](
    { streamId, transportId, kind, rtpParameters },
    cb
  );

  return { transport, producer, callback: cb };
}

/**
 * Like produceFor, but gives the caller explicit control over exactly when
 * transport.produce() resolves — needed to test the participant-cap race
 * fix (FINDINGS.md M4-13 / SCRUM-315), where a mock that resolves
 * immediately can't reliably reproduce or disprove a race between two
 * concurrent PRODUCE calls.
 *
 * @returns { transport, producer, callback, resolveProduce, done }
 *   resolveProduce() lets the pending transport.produce() resolve; until
 *   called, the handler is suspended at that await. `done` is the promise
 *   for the handler call itself — await it after resolveProduce().
 */
export async function produceForWithGate({
  streams,
  msServiceMock,
  socket,
  streamId,
  kind = 'video',
  rtpParameters = createDefaultRtpParameters(kind),
}) {
  let resolveProduce;
  const gate = new Promise((resolve) => {
    resolveProduce = resolve;
  });

  const { transport, producer } = setupProduceCall({
    streams,
    msServiceMock,
    socket,
    streamId,
    kind,
    produceImpl: (p) => async (opts) => {
      await gate;
      p.appData = opts?.appData || {};
      return p;
    },
  });

  // Same reasoning as produceFor: PRODUCE looks transportId up in
  // stream.handler.js's private module-scoped `transports` registry, which
  // only the real CREATE_TRANSPORT handler populates. Without this call,
  // every gated PRODUCE call below would fail immediately with
  // TRANSPORT_NOT_FOUND, before ever reaching the reservation/gate logic
  // this helper exists to test.
  const createTransportCb = vi.fn();
  await socket.handlers['stream:create_transport'](
    { streamId },
    createTransportCb
  );
  const transportId = createTransportCb.mock.calls[0][0].id;

  const cb = vi.fn();
  // Not awaited here on purpose: stream:produce runs synchronously up to
  // its own internal `await gate` (inside produceImpl above) and then
  // suspends — capturing that still-pending promise as `done` is the
  // entire point of this helper. Awaiting it here would defeat it.
  const done = socket.handlers['stream:produce'](
    { streamId, transportId, kind, rtpParameters },
    cb
  );

  return { transport, producer, callback: cb, resolveProduce, done };
}

/**
 * Simulates a viewer joining a stream (stream:join) and consuming every
 * producer returned in `currentProducers` (seed → consume loop).
 * This is the harness entry point for the SCRUM-224/232 "seed" criterion.
 *
 * @param {object} params
 * @param {object} params.streams
 * @param {object} params.msServiceMock
 * @param {object} params.viewerSocket - already registered via registerStreamHandlers
 * @param {string} params.streamId
 */
export async function joinAndConsumeAll({
  streams,
  msServiceMock,
  viewerSocket,
  streamId,
}) {
  const streamRoom = streams[streamId];

  const joinCb = vi.fn();
  await viewerSocket.handlers['stream:join']({ streamId }, joinCb);
  const joinResult = joinCb.mock.calls[0][0];

  if (joinResult.error) {
    return { joinResult, consumeResults: [] };
  }

  const transport = createFakeTransport(`transport-${viewerSocket.id}-consume`);
  msServiceMock.createWebRtcTransport.mockResolvedValue(transport);
  streamRoom.transports.set(transport.id, transport);

  const consumeResults = [];
  for (const { producerId } of joinResult.currentProducers) {
    const consumer = createFakeConsumer(`consumer-${producerId}`);
    transport.consume.mockResolvedValueOnce(consumer);

    const consumeCb = vi.fn();
    await viewerSocket.handlers['stream:consume'](
      {
        streamId,
        transportId: transport.id,
        producerId,
        rtpCapabilities: {},
      },
      consumeCb
    );
    consumeResults.push({ producerId, consumer, callback: consumeCb });
  }

  return { joinResult, consumeResults, transport };
}
