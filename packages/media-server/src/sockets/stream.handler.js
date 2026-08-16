import { PrismaClient } from '@prisma/client';
import * as msService from '../services/mediasoup.service.js';
import { logger } from '../utils/logger.js';
import { StreamService } from '../services/stream.service.js';
import { ERROR_MESSAGES, SOCKET_EVENTS } from '@worldplay/shared';
const prisma = new PrismaClient();

export const streams = {};
const transports = {};
const producers = {};
const consumers = {};
const socketToProducers = {};

export const registerStreamHandlers = (io, socket) => {
  const user = socket.user;

  logger.info(`Socket connected: ${user.username} (${user.id})`);

  socket.on(SOCKET_EVENTS.STREAM.INIT_BROADCAST, async (data, callback) => {
    try {
      // 1. בדיקה אם המשתמש כבר משדר (מניעת כפילויות)
      if (user && user.id) {
        const activeStream = Object.values(streams).find(
          (s) => s.hostUserId === user.id
        );
        if (activeStream) {
          return callback({
            error: ERROR_MESSAGES.ACTIVE_BROADCAST_EXISTS,
          });
        }
      }

      // 2. יצירת השידור בשרת האפליקציה
      logger.info(`Initiating broadcast for user: ${user.id}`);
      const response = await fetch('http://app-server:8080/api/streams', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${socket.handshake.auth.token}`,
        },
        body: JSON.stringify({ title: data.title || 'שידור חדש' }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || ERROR_MESSAGES.FAILED_TO_CREATE_STREAM_IN_DB
        );
      }

      // 3. החזרת ה-streamId לקליינט
      callback({ streamId: result.stream.id });
    } catch (error) {
      logger.error(`Failed to init broadcast: ${error.message}`);
      callback({ error: error.message });
    }
  });

  socket.on(
    SOCKET_EVENTS.STREAM.CREATE_ROOM,
    async ({ streamId }, callback) => {
      try {
        if (!streams[streamId]) {
          const worker = msService.getWorker();
          const router = await msService.createRouter(worker);
          streams[streamId] = {
            router,
            hostSocketId: socket.id,
            hostUserId: user ? user.id : 'dev-host',
            transports: new Map(), // הוספנו מפה לניהול טרנספורטים בתוך החדר
          };
        }
        callback({ rtpCapabilities: streams[streamId].router.rtpCapabilities });
      } catch (error) {
        callback({ error: error.message });
      }
    }
  );

  socket.on(
    SOCKET_EVENTS.STREAM.CREATE_TRANSPORT,
    async ({ streamId }, callback) => {
      try {
        const streamRoom = streams[streamId];
        if (!streamRoom)
          return callback({ error: ERROR_MESSAGES.STREAM_ROOM_NOT_FOUND });
        const transport = await msService.createWebRtcTransport(
          streamRoom.router
        );
        transport.on('dtlsstatechange', (dtlsState) => {
          if (dtlsState === 'closed') {
            transport.close();
            delete transports[transport.id];
            streamRoom.transports.delete(transport.id);
          }
        });
        transports[transport.id] = transport;
        streamRoom.transports.set(transport.id, transport); // שמירה בחדר עבור ה-Consume

        callback({
          id: transport.id,
          iceParameters: transport.iceParameters,
          iceCandidates: transport.iceCandidates,
          dtlsParameters: transport.dtlsParameters,
        });
      } catch (error) {
        callback({ error: error.message });
      }
    }
  );

  socket.on(
    SOCKET_EVENTS.STREAM.CONNECT_TRANSPORT,
    async ({ transportId, dtlsParameters }, callback) => {
      try {
        const transport = transports[transportId];
        if (!transport)
          return callback({ error: ERROR_MESSAGES.TRANSPORT_NOT_FOUND });
        await transport.connect({ dtlsParameters });
        callback({ success: true });
      } catch (error) {
        callback({ error: error.message });
      }
    }
  );

  socket.on(SOCKET_EVENTS.STREAM.PRODUCE, async (data, callback) => {
    try {
      let actualData = data;

      if (Array.isArray(data)) actualData = data[0];

      if (typeof actualData === 'string') {
        try {
          actualData = JSON.parse(actualData.trim());
        } catch (parseError) {
          logger.error(
            `JSON parse failed: ${parseError.message}. String received: ${actualData}`
          );
        }
      }

      // שינוי ל-let כי אנחנו עשויים לעדכן את rtpParameters
      let { transportId, kind, rtpParameters, streamId } = actualData || {};

      if (!kind) {
        logger.error(`Kind is missing. Type of data: ${typeof actualData}`);
        if (typeof callback === 'function')
          callback({ error: ERROR_MESSAGES.KIND_REQUIRED });
        return;
      }

      const streamRoom = streams[streamId];
      if (!streamRoom) throw new Error(ERROR_MESSAGES.ROOM_NOT_CREATED);

      let transport = transports[transportId];
      if (!transport) {
        logger.info('Creating temporary transport for testing...');
        transport = await msService.createWebRtcTransport(streamRoom.router);
        transports[transport.id] = transport;
        streamRoom.transports.set(transport.id, transport);
        logger.info(`Temporary transport created with ID: ${transport.id}`);
      }

      // 2. הוספת Codecs ו-Encodings אם הם חסרים
      if (
        !rtpParameters ||
        !rtpParameters.codecs ||
        rtpParameters.codecs.length === 0
      ) {
        rtpParameters = {
          mid: 'v',
          codecs: [
            {
              mimeType: 'video/vp8',
              payloadType: 101,
              clockRate: 90000,
              parameters: { 'x-google-start-bitrate': 1000 },
            },
          ],
          encodings: [{ ssrc: 11111111 }],
        };
      } else if (
        !rtpParameters.encodings ||
        rtpParameters.encodings.length === 0
      ) {
        rtpParameters.encodings = [{ ssrc: 11111111 }];
      }

      // 3. יצירת ה-Producer
      const producer = await transport.produce({ kind, rtpParameters });
      producers[producer.id] = producer;
      if (!streamRoom.producers) streamRoom.producers = {};
      streamRoom.producers[producer.id] = producer;

      if (!socketToProducers[socket.id]) {
        socketToProducers[socket.id] = new Set();
      }
      socketToProducers[socket.id].add(producer.id);

      producer.observer.on('close', () => {
        try {
          const isHost = streamRoom.hostSocketId === socket.id;
          if (!isHost && !streamRoom.isClosing) {
            io.to(streamId).emit(SOCKET_EVENTS.STREAM.PRODUCER_CLOSED, {
              producerId: producer.id,
              streamId,
            });
          }

          delete producers[producer.id];

          socketToProducers[socket.id]?.delete(producer.id);
          if (socketToProducers[socket.id]?.size === 0) {
            delete socketToProducers[socket.id];
          }

          if (streamRoom.producers) delete streamRoom.producers[producer.id];
          if (streamRoom.producerRoles)
            delete streamRoom.producerRoles[producer.id];

          logger.info(`Producer ${producer.id} cleaned up successfully`);
        } catch (err) {
          logger.error(
            `Error cleaning up producer ${producer.id}: ${err.message}`
          );
        }
      });

      // 4. קביעת role ושידור הצטרפות מצלמה חדשה לכל מי שבחדר
      let role;
      try {
        role = await validateParticipantRole(streamId, socket.user.id);
      } catch (roleErr) {
        producer.close();
        delete producers[producer.id];
        if (streamRoom.producers) delete streamRoom.producers[producer.id];
        socketToProducers[socket.id]?.delete(producer.id);
        if (socketToProducers[socket.id]?.size === 0) {
          delete socketToProducers[socket.id];
        }
        throw roleErr;
      }

      if (producer.closed) {
        if (typeof callback === 'function')
          callback({ error: 'Producer was closed before role resolved' });
        return;
      }

      if (!streamRoom.producerRoles) streamRoom.producerRoles = {};
      streamRoom.producerRoles[producer.id] = role;
      io.to(streamId).emit(SOCKET_EVENTS.STREAM.NEW_PRODUCER, {
        producerId: producer.id,
        role,
        streamId,
      });

      // 5. בדיקת תפקיד והפעלת FFmpeg (משתמש ב-role שחושב לעיל)
      if (kind === 'video' && (role === 'HOST' || role === 'PLAYER')) {
        logger.info('Video producer detected. Preparing FFmpeg pipeline.');

        await prisma.stream.update({
          where: { id: streamId },
          data: { status: 'LIVE', startTime: new Date() },
        });

        // הוספת השהיה של 1.5 שניות לפני תחילת ההקלטה
        setTimeout(async () => {
          try {
            logger.info(`Starting FFmpeg pipeline for stream: ${streamId}`);
            await StreamService.startRecording(
              streamId,
              streamRoom.router,
              producer // כאן עובר הפרודיוסר של הוידאו
            );
          } catch (err) {
            logger.error(`FFmpeg start error: ${err.message}`);
          }
        }, 1500);
      }

      if (typeof callback === 'function') callback({ id: producer.id });
      logger.info(`Producer created successfully for stream: ${streamId}`);
    } catch (err) {
      logger.error(`Produce error: ${err.message}`);
      if (typeof callback === 'function') callback({ error: err.message });
    }
  });

  socket.on(SOCKET_EVENTS.STREAM.CONSUME, async (data, callback) => {
    try {
      const actualData =
        typeof data === 'string' ? JSON.parse(data.trim()) : data;
      const { streamId, transportId, producerId, rtpCapabilities } = actualData;

      logger.info(`Consume request for producer: ${producerId}`);

      const room = streams[streamId];
      if (!room) return callback({ error: ERROR_MESSAGES.ROOM_NOT_FOUND });

      const transport = room.transports.get(transportId);
      if (!transport)
        return callback({ error: ERROR_MESSAGES.TRANSPORT_NOT_FOUND });

      if (!room.router.canConsume({ producerId, rtpCapabilities })) {
        return callback({ error: ERROR_MESSAGES.CANNOT_CONSUME });
      }

      const consumer = await transport.consume({
        producerId,
        rtpCapabilities,
        paused: true,
      });
      consumers[consumer.id] = consumer;

      consumer.on('transportclose', () => {
        logger.info(`Consumer ${consumer.id} closed: transport disconnected`);
        delete consumers[consumer.id];
      });

      consumer.on('producerclose', () => {
        logger.info(`Consumer ${consumer.id} closed: producer disconnected`);
        delete consumers[consumer.id];
      });

      callback({
        id: consumer.id,
        producerId,
        kind: consumer.kind,
        rtpParameters: consumer.rtpParameters,
      });
    } catch (consumeError) {
      logger.error(`Consume error: ${consumeError.message}`);
      callback({ error: consumeError.message });
    }
  });

  socket.on(SOCKET_EVENTS.STREAM.RESUME, async ({ consumerId }, callback) => {
    const consumer = consumers[consumerId];
    if (!consumer)
      return callback({ error: ERROR_MESSAGES.CONSUMER_NOT_FOUND });
    try {
      await consumer.resume();
      callback({ success: true });
    } catch (error) {
      logger.error(`Failed to resume consumer ${consumerId}: ${error.message}`);
      callback({ error: ERROR_MESSAGES.FAILED_TO_RESUME_CONSUMER });
    }
  });

  socket.on(SOCKET_EVENTS.STREAM.JOIN, async ({ streamId }, callback) => {
    try {
      const streamRoom = streams[streamId];
      if (!streamRoom)
        return callback({ error: ERROR_MESSAGES.STREAM_NOT_LIVE });
      socket.join(streamId);
      const producerRoles = streamRoom.producerRoles || {};
      const currentProducers = Object.keys(streamRoom.producers || {}).map(
        (producerId) => ({
          producerId,
          role: producerRoles[producerId] || 'VIEWER',
        })
      );
      const hostProducerId =
        Object.keys(producerRoles).find(
          (producerId) => producerRoles[producerId] === 'HOST'
        ) || null;

      const game = await prisma.game.findFirst({
        where: { streamId },
        select: { id: true },
      });

      callback({
        rtpCapabilities: streamRoom.router.rtpCapabilities,
        currentProducers,
        currentProducerId: hostProducerId,
        gameId: game?.id || null,
      });
    } catch (error) {
      callback({ error: error.message });
    }
  });

  socket.on(SOCKET_EVENTS.STREAM.ENDED, async () => {
    for (const streamId in streams) {
      if (streams[streamId].hostSocketId === socket.id) {
        await handleCloseStream(streamId, io);
      }
    }
  });
  // טיפול בניתוק פתאומי
  socket.on(SOCKET_EVENTS.SYSTEM.DISCONNECT, async () => {
    logger.info(`Socket disconnected: ${socket.id}`);

    if (socketToProducers[socket.id]) {
      for (const producerId of [...socketToProducers[socket.id]]) {
        const producer = producers[producerId];
        if (producer) {
          producer.close();
        }
      }
      delete socketToProducers[socket.id];
    }

    for (const streamId in streams) {
      // אם זה ה-Host שהתנתק
      if (streams[streamId].hostSocketId === socket.id) {
        logger.info(`Host disconnected, cleaning up stream: ${streamId}`);

        // קריאה לשירות הניקוי
        await StreamService.stopRecording(streamId);

        // עדכון סטטוס ב-DB וסגירת החדר
        await handleCloseStream(streamId, io);
      }
    }
  });
};

export const handleCloseStream = async (streamId, io) => {
  const streamRoom = streams[streamId];
  if (!streamRoom) return;
  streamRoom.isClosing = true;
  if (streamRoom.router) streamRoom.router.close();
  streamRoom.producerRoles = {};
  try {
    await prisma.stream.update({
      where: { id: streamId },
      data: { status: 'FINISHED', endTime: new Date() },
    });
  } catch (err) {
    logger.error(err.message);
  }
  io.to(streamId).emit(SOCKET_EVENTS.STREAM.ENDED, { streamId });
  delete streams[streamId];
};

async function validateParticipantRole(streamId, userId) {
  const participant = await prisma.gameParticipant.findFirst({
    where: { game: { streamId }, userId },
  });
  if (participant) return participant.role;

  const stream = await prisma.stream.findUnique({
    where: { id: streamId },
    select: { hostId: true },
  });
  return stream?.hostId === userId ? 'HOST' : 'VIEWER';
}
