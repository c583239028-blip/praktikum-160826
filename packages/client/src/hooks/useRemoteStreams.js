import { useState, useEffect, useRef, useCallback } from 'react';
import { SOCKET_EVENTS } from '@worldplay/shared';
import { MediaStream } from '@livekit/react-native-webrtc';
import { MediasoupManager } from '../services/MediasoupManager';
import {
  connectMediaSocket,
  emitMediaPromise,
} from '../services/socket.service';

export const MAX_STREAMS = 4;

export const CONNECTION_STATUS = {
  IDLE: 'idle',
  CONNECTING: 'connecting',
  RECONNECTING: 'reconnecting',
  JOINED: 'joined',
  DISCONNECTED: 'disconnected',
  ERROR: 'error',
};

// media-socket only — STREAM.JOIN/CONSUME/RESUME מטופלים ע"י media-server, לא app-server.
export async function createConsumerStream(
  mediaSocket,
  producerId,
  targetStreamId
) {
  const caps = MediasoupManager.getRtpCapabilities();
  const transport = await MediasoupManager.createTransport(
    mediaSocket,
    'recv',
    targetStreamId
  );
  let consumer;
  try {
    const consumeData = await emitMediaPromise(SOCKET_EVENTS.STREAM.CONSUME, {
      transportId: transport.id,
      producerId,
      rtpCapabilities: caps,
      streamId: targetStreamId,
    });
    consumer = await transport.consume(consumeData);
    const stream = new MediaStream([consumer.track]);
    return { stream, consumer, transport };
  } catch (err) {
    if (consumer) consumer.close();
    transport.close();
    throw err;
  }
}

function closeConsumersAndTransports(streams) {
  streams.forEach(({ consumer, transport }) => {
    consumer.close();
    transport.close();
  });
}

export function useRemoteStreams({ streamId }) {
  const [streams, setStreams] = useState([]);
  const [status, setStatus] = useState(CONNECTION_STATUS.IDLE);
  const [error, setError] = useState(null);

  const streamsRef = useRef([]);
  const activeCountRef = useRef(0);
  // false מ-disconnect עד סיום ה-join() הבא — מונע הכנסת stream יתום אחרי ניתוק
  const isActiveRef = useRef(true);
  // מונע הפעלה כפולה של join() אם 'connect' יורה סמוך לחיבור הראשוני
  const isJoiningRef = useRef(false);

  useEffect(() => {
    streamsRef.current = streams;
  }, [streams]);

  useEffect(() => {
    return () => closeConsumersAndTransports(streamsRef.current);
  }, []);

  useEffect(() => {
    if (!streamId) return;

    let cancelled = false;
    let mediaSocket = null;
    let newProducerHandler;
    let producerClosedHandler;

    async function consumeProducer({
      producerId,
      role,
      socket,
      targetStreamId,
    }) {
      const alreadyExists = streamsRef.current.some(
        (s) => s.producerId === producerId
      );
      if (!alreadyExists && activeCountRef.current >= MAX_STREAMS) return;
      if (!alreadyExists) activeCountRef.current += 1;

      let stream, consumer, transport;
      try {
        ({ stream, consumer, transport } = await createConsumerStream(
          socket,
          producerId,
          targetStreamId
        ));
        await emitMediaPromise(SOCKET_EVENTS.STREAM.RESUME, {
          consumerId: consumer.id,
          streamId: targetStreamId,
        });
      } catch (err) {
        if (!alreadyExists) activeCountRef.current -= 1;
        if (consumer) consumer.close();
        if (transport) transport.close();
        console.error(`Failed to consume producer ${producerId}:`, err.message);
        return;
      }

      if (!isActiveRef.current || cancelled) {
        // disconnect/leave/unmount קרה בזמן שהמתנו ל-consume — לא מכניסים תוצאה יתומה ל-state
        consumer.close();
        transport.close();
        if (!alreadyExists) activeCountRef.current -= 1;
        return;
      }

      const existingStream = streamsRef.current.find(
        (s) => s.producerId === producerId
      );
      if (existingStream) {
        existingStream.consumer.close();
        existingStream.transport.close();
      }

      setStreams((prev) => [
        ...prev.filter((s) => s.producerId !== producerId),
        { producerId, role, stream, consumer, transport },
      ]);
    }

    async function join(socket) {
      if (isJoiningRef.current) return;
      isJoiningRef.current = true;
      isActiveRef.current = true;

      // איפוס לפני הצטרפות (mount ראשוני / reconnect) — אחרת נשארים streams מה-session הקודם
      activeCountRef.current = 0;
      closeConsumersAndTransports(streamsRef.current);
      setStreams([]);
      setError(null);
      setStatus((prevStatus) =>
        prevStatus === CONNECTION_STATUS.JOINED
          ? CONNECTION_STATUS.RECONNECTING // היינו כבר מחוברים — זה reconnect, לא חיבור ראשוני
          : CONNECTION_STATUS.CONNECTING
      );

      try {
        const data = await emitMediaPromise(SOCKET_EVENTS.STREAM.JOIN, {
          streamId,
        });
        await MediasoupManager.initDevice(data.rtpCapabilities);
        if (cancelled) return;

        for (const { producerId, role } of data.currentProducers ?? []) {
          if (cancelled) break;
          if (activeCountRef.current >= MAX_STREAMS) break;
          // eslint-disable-next-line no-await-in-loop
          await consumeProducer({
            producerId,
            role,
            socket,
            targetStreamId: streamId,
          });
        }
        if (!cancelled) setStatus(CONNECTION_STATUS.JOINED);
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
          setStatus(CONNECTION_STATUS.ERROR);
        }
      } finally {
        isJoiningRef.current = false;
      }
    }

    function handleProducerClosed({ producerId, streamId: eventStreamId }) {
      if (eventStreamId !== streamId) return; // singleton socket עשוי להיות רשום ליותר מ-streamId אחד בו-זמנית
      const target = streamsRef.current.find(
        (s) => s.producerId === producerId
      );
      if (!target) return;
      activeCountRef.current -= 1;
      target.consumer.close();
      target.transport.close();
      setStreams((prev) => prev.filter((s) => s.producerId !== producerId));
    }

    function handleDisconnect() {
      isActiveRef.current = false;
      activeCountRef.current = 0;
      closeConsumersAndTransports(streamsRef.current);
      setStreams([]);
      setStatus(CONNECTION_STATUS.DISCONNECTED);
    }

    function handleReconnect() {
      join(mediaSocket);
    }

    (async () => {
      mediaSocket = await connectMediaSocket();
      if (cancelled || !mediaSocket) return;

      newProducerHandler = ({ producerId, role, streamId: eventStreamId }) => {
        if (eventStreamId !== streamId) return; // אותה סיבה — ראי handleProducerClosed
        consumeProducer({
          producerId,
          role,
          socket: mediaSocket,
          targetStreamId: streamId,
        });
      };
      producerClosedHandler = handleProducerClosed;

      mediaSocket.on(SOCKET_EVENTS.STREAM.NEW_PRODUCER, newProducerHandler);
      mediaSocket.on(
        SOCKET_EVENTS.STREAM.PRODUCER_CLOSED,
        producerClosedHandler
      );
      mediaSocket.on(SOCKET_EVENTS.SYSTEM.DISCONNECT, handleDisconnect);
      mediaSocket.on(SOCKET_EVENTS.SYSTEM.CONNECT, handleReconnect); // חיבור ראשוני + כל reconnect עתידי

      await join(mediaSocket);
    })();

    return () => {
      cancelled = true;
      isActiveRef.current = false;
      activeCountRef.current = 0;
      closeConsumersAndTransports(streamsRef.current);
      setStreams([]);
      if (mediaSocket) {
        mediaSocket.off(SOCKET_EVENTS.STREAM.NEW_PRODUCER, newProducerHandler);
        mediaSocket.off(
          SOCKET_EVENTS.STREAM.PRODUCER_CLOSED,
          producerClosedHandler
        );
        mediaSocket.off(SOCKET_EVENTS.SYSTEM.DISCONNECT, handleDisconnect);
        mediaSocket.off(SOCKET_EVENTS.SYSTEM.CONNECT, handleReconnect);
      }
    };
  }, [streamId]);

  const leave = useCallback(() => {
    isActiveRef.current = false;
    activeCountRef.current = 0;
    closeConsumersAndTransports(streamsRef.current);
    setStreams([]);
    setStatus(CONNECTION_STATUS.IDLE);
  }, []);

  return { streams, status, error, leave };
}
