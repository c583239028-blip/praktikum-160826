import { renderHook, waitFor, act } from '@testing-library/react-native';
import {
  createConsumerStream,
  useRemoteStreams,
  CONNECTION_STATUS,
  MAX_STREAMS,
} from '../src/hooks/useRemoteStreams';
import { MediaStream } from '@livekit/react-native-webrtc';
import { MediasoupManager } from '../src/services/MediasoupManager';
import {
  emitMediaPromise,
  connectMediaSocket,
} from '../src/services/socket.service';
import { SOCKET_EVENTS } from '@worldplay/shared';

// ─── Mocks ───────────────────────────────────────────────────────────────────

jest.mock('@livekit/react-native-webrtc', () => ({
  RTCView: () => null,
  MediaStream: jest.fn().mockImplementation((tracks) => ({ tracks })),
}));

jest.mock('../src/services/MediasoupManager', () => ({
  MediasoupManager: {
    getRtpCapabilities: jest.fn(),
    createTransport: jest.fn(),
    initDevice: jest.fn(),
  },
}));

jest.mock('../src/services/socket.service', () => ({
  emitMediaPromise: jest.fn(),
  connectMediaSocket: jest.fn(),
}));

jest.mock('@worldplay/shared', () => ({
  SOCKET_EVENTS: {
    SYSTEM: {
      CONNECT: 'connect',
      DISCONNECT: 'disconnect',
    },
    STREAM: {
      JOIN: 'stream:join',
      CONSUME: 'stream:consume',
      RESUME: 'stream:resume',
      NEW_PRODUCER: 'stream:new_producer',
      PRODUCER_CLOSED: 'stream:producer_closed',
    },
  },
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const MOCK_PRODUCER_ID = 'producer-abc';
const MOCK_STREAM_ID = 'stream-xyz';

const MOCK_CAPS = { codecs: [] };
const MOCK_TRANSPORT = {
  id: 'transport-1',
  consume: jest.fn(),
  close: jest.fn(),
};
const MOCK_CONSUME_DATA = { id: 'consume-data-1' };
const MOCK_TRACK = { kind: 'video' };
const MOCK_CONSUMER = { id: 'consumer-1', track: MOCK_TRACK };

// ─── Tests: createConsumerStream ────────────────────────────────────────────

describe('createConsumerStream', () => {
  let mockMediaSocket;

  beforeEach(() => {
    jest.clearAllMocks();
    mockMediaSocket = { id: 'media-socket-1' };

    MediasoupManager.getRtpCapabilities.mockReturnValue(MOCK_CAPS);
    MediasoupManager.createTransport.mockResolvedValue(MOCK_TRANSPORT);
    MOCK_TRANSPORT.consume.mockResolvedValue(MOCK_CONSUMER);
    emitMediaPromise.mockImplementation((event) => {
      if (event === SOCKET_EVENTS.STREAM.CONSUME)
        return Promise.resolve(MOCK_CONSUME_DATA);
      if (event === SOCKET_EVENTS.STREAM.RESUME) return Promise.resolve();
    });
  });

  test('calls createTransport with correct arguments', async () => {
    await createConsumerStream(
      mockMediaSocket,
      MOCK_PRODUCER_ID,
      MOCK_STREAM_ID
    );

    expect(MediasoupManager.createTransport).toHaveBeenCalledWith(
      mockMediaSocket,
      'recv',
      MOCK_STREAM_ID
    );
  });

  test('sends STREAM.CONSUME with correct payload via emitMediaPromise', async () => {
    await createConsumerStream(
      mockMediaSocket,
      MOCK_PRODUCER_ID,
      MOCK_STREAM_ID
    );

    expect(emitMediaPromise).toHaveBeenCalledWith(
      SOCKET_EVENTS.STREAM.CONSUME,
      {
        transportId: MOCK_TRANSPORT.id,
        producerId: MOCK_PRODUCER_ID,
        rtpCapabilities: MOCK_CAPS,
        streamId: MOCK_STREAM_ID,
      }
    );
  });

  test('calls transport.consume() with the data returned from STREAM.CONSUME', async () => {
    await createConsumerStream(
      mockMediaSocket,
      MOCK_PRODUCER_ID,
      MOCK_STREAM_ID
    );

    expect(MOCK_TRANSPORT.consume).toHaveBeenCalledWith(MOCK_CONSUME_DATA);
  });

  test('does NOT call STREAM.RESUME — caller is responsible', async () => {
    await createConsumerStream(
      mockMediaSocket,
      MOCK_PRODUCER_ID,
      MOCK_STREAM_ID
    );

    const resumeCalled = emitMediaPromise.mock.calls.some(
      (c) => c[0] === SOCKET_EVENTS.STREAM.RESUME
    );
    expect(resumeCalled).toBe(false);
  });

  test('returns { consumer, stream } with correct values', async () => {
    const result = await createConsumerStream(
      mockMediaSocket,
      MOCK_PRODUCER_ID,
      MOCK_STREAM_ID
    );

    expect(result.consumer).toBe(MOCK_CONSUMER);
    expect(MediaStream).toHaveBeenCalledWith([MOCK_TRACK]);
    expect(result.stream).toBeDefined();
  });

  test('throws when createTransport fails', async () => {
    const error = new Error('Transport failed');
    MediasoupManager.createTransport.mockRejectedValue(error);

    await expect(
      createConsumerStream(mockMediaSocket, MOCK_PRODUCER_ID, MOCK_STREAM_ID)
    ).rejects.toThrow('Transport failed');
  });

  test('throws when STREAM.CONSUME fails', async () => {
    const error = new Error('Consume failed');
    emitMediaPromise.mockImplementation((event) => {
      if (event === SOCKET_EVENTS.STREAM.CONSUME) return Promise.reject(error);
    });

    await expect(
      createConsumerStream(mockMediaSocket, MOCK_PRODUCER_ID, MOCK_STREAM_ID)
    ).rejects.toThrow('Consume failed');
  });

  test('throws when transport.consume() fails', async () => {
    MOCK_TRANSPORT.consume.mockRejectedValue(new Error('consume() failed'));

    await expect(
      createConsumerStream(mockMediaSocket, MOCK_PRODUCER_ID, MOCK_STREAM_ID)
    ).rejects.toThrow('consume() failed');
  });
});

// ─── Tests: useRemoteStreams ─────────────────────────────────────────────────

// media socket מדומה: event emitter נשלט + on/off אמיתיים לצורך cleanup assertions
function createMockMediaSocket() {
  const handlers = {};
  return {
    connected: true,
    on: jest.fn((event, cb) => {
      handlers[event] = cb;
    }),
    off: jest.fn((event) => {
      delete handlers[event];
    }),
    trigger: (event, payload) => handlers[event] && handlers[event](payload),
  };
}

describe('useRemoteStreams', () => {
  let transportCounter;
  let consumerCounter;
  let mockMediaSocket;

  beforeEach(() => {
    jest.clearAllMocks();
    transportCounter = 0;
    consumerCounter = 0;
    mockMediaSocket = createMockMediaSocket();

    connectMediaSocket.mockResolvedValue(mockMediaSocket);
    MediasoupManager.getRtpCapabilities.mockReturnValue(MOCK_CAPS);
    MediasoupManager.initDevice.mockResolvedValue();

    // כל קריאה ל-createTransport מחזירה טרנספורט חדש עם id/close ייחודיים,
    // כדי שנוכל לספור בוודאות כמה טרנספורטים נוצרו בפועל
    MediasoupManager.createTransport.mockImplementation(async () => {
      transportCounter += 1;
      return {
        id: `transport-${transportCounter}`,
        close: jest.fn(),
        consume: jest.fn().mockImplementation(async () => {
          consumerCounter += 1;
          return {
            id: `consumer-${consumerCounter}`,
            track: { kind: 'video' },
            close: jest.fn(),
          };
        }),
      };
    });
  });

  // עוזר: מגדיר את תגובת emitMediaPromise עבור JOIN/CONSUME/RESUME
  function mockJoinAndConsume(currentProducersByStreamId) {
    emitMediaPromise.mockImplementation((event, payload) => {
      if (event === SOCKET_EVENTS.STREAM.JOIN) {
        return Promise.resolve({
          rtpCapabilities: MOCK_CAPS,
          currentProducers: currentProducersByStreamId[payload.streamId] ?? [],
        });
      }
      if (event === SOCKET_EVENTS.STREAM.CONSUME) {
        return Promise.resolve({ id: 'consume-data' });
      }
      if (event === SOCKET_EVENTS.STREAM.RESUME) {
        return Promise.resolve();
      }
      return Promise.resolve();
    });
  }

  describe('הגבלת MAX_STREAMS', () => {
    test('seed מ-JOIN לא צורך יותר מ-MAX_STREAMS producers, גם אם השרת שולח יותר', async () => {
      const producers = Array.from({ length: MAX_STREAMS + 2 }, (_, i) => ({
        producerId: `producer-${i}`,
        role: 'PLAYER',
      }));
      mockJoinAndConsume({ [MOCK_STREAM_ID]: producers });

      const { result } = renderHook(() =>
        useRemoteStreams({ streamId: MOCK_STREAM_ID })
      );

      await waitFor(() =>
        expect(result.current.status).toBe(CONNECTION_STATUS.JOINED)
      );

      expect(result.current.streams).toHaveLength(MAX_STREAMS);
      expect(MediasoupManager.createTransport).toHaveBeenCalledTimes(
        MAX_STREAMS
      );
    });

    test('NEW_PRODUCER נדחה בשקט כשכבר הגענו למגבלה', async () => {
      mockJoinAndConsume({ [MOCK_STREAM_ID]: [] });

      const { result } = renderHook(() =>
        useRemoteStreams({ streamId: MOCK_STREAM_ID })
      );

      await waitFor(() =>
        expect(result.current.status).toBe(CONNECTION_STATUS.JOINED)
      );

      for (let i = 0; i < MAX_STREAMS + 1; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        await act(async () => {
          mockMediaSocket.trigger(SOCKET_EVENTS.STREAM.NEW_PRODUCER, {
            producerId: `late-producer-${i}`,
            role: 'PLAYER',
            streamId: MOCK_STREAM_ID,
          });
        });
      }

      await waitFor(() =>
        expect(result.current.streams).toHaveLength(MAX_STREAMS)
      );
      expect(MediasoupManager.createTransport).toHaveBeenCalledTimes(
        MAX_STREAMS
      );
    });

    test('אחרי PRODUCER_CLOSED מתפנה סלוט, ואפשר לצרוך producer חדש', async () => {
      const producers = Array.from({ length: MAX_STREAMS }, (_, i) => ({
        producerId: `producer-${i}`,
        role: 'PLAYER',
      }));
      mockJoinAndConsume({ [MOCK_STREAM_ID]: producers });

      const { result } = renderHook(() =>
        useRemoteStreams({ streamId: MOCK_STREAM_ID })
      );

      await waitFor(() =>
        expect(result.current.streams).toHaveLength(MAX_STREAMS)
      );

      await act(async () => {
        mockMediaSocket.trigger(SOCKET_EVENTS.STREAM.PRODUCER_CLOSED, {
          producerId: 'producer-0',
          streamId: MOCK_STREAM_ID,
        });
      });

      await waitFor(() =>
        expect(result.current.streams).toHaveLength(MAX_STREAMS - 1)
      );

      await act(async () => {
        mockMediaSocket.trigger(SOCKET_EVENTS.STREAM.NEW_PRODUCER, {
          producerId: 'producer-new',
          role: 'PLAYER',
          streamId: MOCK_STREAM_ID,
        });
      });

      await waitFor(() =>
        expect(result.current.streams).toHaveLength(MAX_STREAMS)
      );
      expect(
        result.current.streams.some((s) => s.producerId === 'producer-new')
      ).toBe(true);
    });

    test('הצטרפות ל-streamId חדש לא נחסמת גם אם ה-streamId הקודם הגיע למגבלה', async () => {
      const OTHER_STREAM_ID = 'stream-other';
      const fullProducers = Array.from({ length: MAX_STREAMS }, (_, i) => ({
        producerId: `producer-${i}`,
        role: 'PLAYER',
      }));
      const nextProducers = [
        { producerId: 'next-producer-1', role: 'PLAYER' },
        { producerId: 'next-producer-2', role: 'PLAYER' },
      ];
      mockJoinAndConsume({
        [MOCK_STREAM_ID]: fullProducers,
        [OTHER_STREAM_ID]: nextProducers,
      });

      const { result, rerender } = renderHook(
        ({ streamId }) => useRemoteStreams({ streamId }),
        { initialProps: { streamId: MOCK_STREAM_ID } }
      );

      await waitFor(() =>
        expect(result.current.streams).toHaveLength(MAX_STREAMS)
      );

      rerender({ streamId: OTHER_STREAM_ID });

      await waitFor(() =>
        expect(result.current.streams).toHaveLength(nextProducers.length)
      );
      expect(
        result.current.streams.every((s) =>
          nextProducers.some((p) => p.producerId === s.producerId)
        )
      ).toBe(true);
    });
  });

  describe('סינון לפי streamId (singleton media socket)', () => {
    test('NEW_PRODUCER עם streamId שונה מהנוכחי — מתעלם ולא צורך producer', async () => {
      mockJoinAndConsume({ [MOCK_STREAM_ID]: [] });

      const { result } = renderHook(() =>
        useRemoteStreams({ streamId: MOCK_STREAM_ID })
      );

      await waitFor(() =>
        expect(result.current.status).toBe(CONNECTION_STATUS.JOINED)
      );

      await act(async () => {
        mockMediaSocket.trigger(SOCKET_EVENTS.STREAM.NEW_PRODUCER, {
          producerId: 'foreign-producer',
          role: 'PLAYER',
          streamId: 'some-other-stream-id', // לא ה-streamId של ה-hook הזה
        });
      });

      expect(result.current.streams).toHaveLength(0);
      expect(MediasoupManager.createTransport).not.toHaveBeenCalled();
    });

    test('PRODUCER_CLOSED עם streamId שונה מהנוכחי — לא מסיר stream קיים', async () => {
      const producers = [{ producerId: 'producer-0', role: 'PLAYER' }];
      mockJoinAndConsume({ [MOCK_STREAM_ID]: producers });

      const { result } = renderHook(() =>
        useRemoteStreams({ streamId: MOCK_STREAM_ID })
      );

      await waitFor(() => expect(result.current.streams).toHaveLength(1));

      await act(async () => {
        mockMediaSocket.trigger(SOCKET_EVENTS.STREAM.PRODUCER_CLOSED, {
          producerId: 'producer-0',
          streamId: 'some-other-stream-id',
        });
      });

      // ה-stream נשאר — האירוע לא היה מיועד ל-streamId הזה
      expect(result.current.streams).toHaveLength(1);
    });
  });

  describe('reconnect', () => {
    test("אירוע 'connect' אחרי JOIN מוצלח מפעיל join() מחדש עם status=RECONNECTING", async () => {
      mockJoinAndConsume({ [MOCK_STREAM_ID]: [] });

      const { result } = renderHook(() =>
        useRemoteStreams({ streamId: MOCK_STREAM_ID })
      );

      await waitFor(() =>
        expect(result.current.status).toBe(CONNECTION_STATUS.JOINED)
      );

      await act(async () => {
        mockMediaSocket.trigger(SOCKET_EVENTS.SYSTEM.CONNECT);
      });

      // ה-JOIN רץ מחדש ומסתיים שוב ב-JOINED (reconnect עבר בהצלחה)
      await waitFor(() =>
        expect(result.current.status).toBe(CONNECTION_STATUS.JOINED)
      );
      // emitMediaPromise(JOIN) נקרא פעמיים: חיבור ראשוני + reconnect
      const joinCalls = emitMediaPromise.mock.calls.filter(
        (c) => c[0] === SOCKET_EVENTS.STREAM.JOIN
      );
      expect(joinCalls.length).toBe(2);
    });

    test('disconnect מעדכן status ל-DISCONNECTED ומנקה streams', async () => {
      const producers = [{ producerId: 'producer-0', role: 'PLAYER' }];
      mockJoinAndConsume({ [MOCK_STREAM_ID]: producers });

      const { result } = renderHook(() =>
        useRemoteStreams({ streamId: MOCK_STREAM_ID })
      );

      await waitFor(() => expect(result.current.streams).toHaveLength(1));

      await act(async () => {
        mockMediaSocket.trigger(SOCKET_EVENTS.SYSTEM.DISCONNECT);
      });

      expect(result.current.status).toBe(CONNECTION_STATUS.DISCONNECTED);
      expect(result.current.streams).toHaveLength(0);
    });
  });

  describe('leave', () => {
    test('leave מנקה streams, מאפס status ל-IDLE, וסוגר consumers/transports', async () => {
      const producers = [{ producerId: 'producer-0', role: 'PLAYER' }];
      mockJoinAndConsume({ [MOCK_STREAM_ID]: producers });

      const { result } = renderHook(() =>
        useRemoteStreams({ streamId: MOCK_STREAM_ID })
      );

      await waitFor(() => expect(result.current.streams).toHaveLength(1));
      const [{ consumer, transport }] = result.current.streams;

      act(() => {
        result.current.leave();
      });

      expect(result.current.streams).toHaveLength(0);
      expect(result.current.status).toBe(CONNECTION_STATUS.IDLE);
      expect(consumer.close).toHaveBeenCalled();
      expect(transport.close).toHaveBeenCalled();
    });
  });
});
