import prisma from '../lib/prisma.js';
import * as msService from '../services/mediasoup.service.js';
import { logger } from '../utils/logger.js';
import { StreamService } from '../services/stream.service.js';
import { APP_SERVER_URL } from '../config.js';
import {
  ERROR_MESSAGES,
  SOCKET_EVENTS,
  MAX_ACTIVE_PLAYERS,
  isValidStreamId,
  PARTICIPANT_ROLES,
} from '@worldplay/shared';

export const streams = {};
const transports = {};
const producers = {};
const consumers = {};
const socketToProducers = {};
const socketToStream = {};
const viewerCountDebounceTimers = {};
const viewerCountWriteSequence = {};
const viewerCountWriteChain = {};

const VIEWER_COUNT_DEBOUNCE_MS = 500;

// מחשבת viewerCount מיד (סינכרוני) — מונע חישוב מיושן.
// viewerCountWriteSequence מונע מכתיבה איטית לדרוס כתיבה מאוחרת ומהירה
// ממנה: myTurn נלקח בזמן התזמון; אחרי ה-await, כתיבה נזרקת אם כבר
// התחיל turn גבוה יותר ממנה.
function publishViewerCount(io, streamId) {
  const streamRoom = streams[streamId];
  if (!streamRoom) return;

  const room = io.sockets.adapter.rooms.get(streamId);
  const roomSize = room ? room.size : 0;
  const viewerCount = Math.max(
    0,
    roomSize - streamRoom.participantSocketIds.size
  );

  if (viewerCountDebounceTimers[streamId]) {
    clearTimeout(viewerCountDebounceTimers[streamId]);
  }

  const myTurn = (viewerCountWriteSequence[streamId] || 0) + 1;
  viewerCountWriteSequence[streamId] = myTurn;

  viewerCountDebounceTimers[streamId] = setTimeout(() => {
    delete viewerCountDebounceTimers[streamId];

    const previousWrite = viewerCountWriteChain[streamId] || Promise.resolve();

    const thisWrite = previousWrite
      .catch(() => {})
      .then(async () => {
        if (viewerCountWriteSequence[streamId] > myTurn) return;

        const currentRoom = streams[streamId];
        if (!currentRoom || currentRoom.isClosing) return;

        try {
          await prisma.stream.update({
            where: { id: streamId },
            data: { viewerCount },
          });

          const roomAfterWrite = streams[streamId];
          if (viewerCountWriteSequence[streamId] > myTurn) return;
          if (!roomAfterWrite || roomAfterWrite.isClosing) return;

          io.to(streamId).emit(SOCKET_EVENTS.STREAM.VIEWER_COUNT, {
            streamId,
            viewerCount,
          });
        } catch (error) {
          logger.error(
            `Failed to publish viewer count for stream ${streamId}: ${error.message}`
          );
        }
      });

    viewerCountWriteChain[streamId] = thisWrite;
  }, VIEWER_COUNT_DEBOUNCE_MS);
}

const HLS_INPUT_ROLES = new Set(['HOST', 'PLAYER', 'MODERATOR']);
const RECORDING_START_DELAY_MS = 1500;

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
      const response = await fetch(`${APP_SERVER_URL}/api/streams`, {
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
        // שער ראשון: streamId מגיע מהקליינט. חוסמים כל מה שאינו UUID לפני
        // שנוצר חדר/ראוטר או שהמזהה זולג לנתיב בדיסק (path traversal, SCRUM-290).
        if (!isValidStreamId(streamId)) {
          return callback({ error: ERROR_MESSAGES.INVALID_STREAM_ID });
        }

        if (!streams[streamId]) {
          const worker = msService.getWorker();
          const router = await msService.createRouter(worker);
          streams[streamId] = {
            router,
            hostSocketId: socket.id,
            hostUserId: user ? user.id : 'dev-host',
            transports: new Map(),
            participantSocketIds: new Set(),
          };
        }

        socket.join(streamId);
        socketToStream[socket.id] = streamId;
        publishViewerCount(io, streamId);

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

      const { transportId, kind, rtpParameters, streamId } = actualData || {};

      if (!kind) {
        logger.error(`Kind is missing. Type of data: ${typeof actualData}`);
        if (typeof callback === 'function')
          callback({ error: ERROR_MESSAGES.KIND_REQUIRED });
        return;
      }

      const streamRoom = streams[streamId];
      if (!streamRoom) throw new Error(ERROR_MESSAGES.ROOM_NOT_CREATED);

      const transport = transports[transportId];
      if (!transport) {
        logger.error(`Transport not found for transportId: ${transportId}`);
        if (typeof callback === 'function')
          callback({ error: ERROR_MESSAGES.TRANSPORT_NOT_FOUND });
        return;
      }

      // לא ממציאים rtpParameters/SSRC כברירת מחדל — ערכים מפוברקים גורמים
      // להתנגשות בין producers שונים שמקבלים אותו SSRC (FINDINGS M4-05).
      if (
        !rtpParameters ||
        !rtpParameters.codecs ||
        rtpParameters.codecs.length === 0 ||
        !rtpParameters.encodings ||
        rtpParameters.encodings.length === 0
      ) {
        logger.error(`Missing or invalid rtpParameters for stream ${streamId}`);
        if (typeof callback === 'function')
          callback({ error: ERROR_MESSAGES.RTP_PARAMETERS_REQUIRED });
        return;
      }

      // 1. אימות תפקיד המשתתף בזרם

      let role;
      try {
        role = await validateParticipantRole(streamId, socket.user.id);
      } catch (roleErr) {
        if (typeof callback === 'function')
          callback({ error: roleErr.message });
        return;
      }

      // 2. Cap 4: רק HOST/PLAYER נספרים; MODERATOR ו-VIEWER לא.
      const isCountedRole = role === 'HOST' || role === 'PLAYER';
      const isExistingParticipant = streamRoom.participantSocketIds.has(
        socket.id
      );

      if (
        isCountedRole &&
        !isExistingParticipant &&
        streamRoom.participantSocketIds.size >= MAX_ACTIVE_PLAYERS
      ) {
        if (typeof callback === 'function')
          callback({ error: ERROR_MESSAGES.ROOM_FULL });
        logger.info(
          `Producer rejected for stream ${streamId}: room full (${MAX_ACTIVE_PLAYERS} players)`
        );
        return;
      }

      // SCRUM-315: שריון סינכרוני — לפני ה-await הבא, כדי לסגור את המרוץ.
      const reservedSlot = isCountedRole && !isExistingParticipant;
      if (reservedSlot) {
        streamRoom.participantSocketIds.add(socket.id);
      }

      // 3. יצירת ה-Producer — רק אחרי שעברנו role+cap.
      // streamId is recorded server-side here (not re-read from a future
      // event's payload) so later handlers never have to trust a client's
      // claim about which room a producer belongs to — see PRODUCER_PAUSE.
      let producer;
      try {
        producer = await transport.produce({
          kind,
          rtpParameters,
          appData: { socketId: socket.id, userId: user.id, streamId },
        });
      } catch (produceErr) {
        // rollback: produce נכשל, לשחרר את הסלוט שנשמר למעלה.
        if (reservedSlot) {
          streamRoom.participantSocketIds.delete(socket.id);
        }
        throw produceErr;
      }
      producers[producer.id] = producer;
      if (!streamRoom.producers) streamRoom.producers = {};
      streamRoom.producers[producer.id] = producer;

      if (!socketToProducers[socket.id]) {
        socketToProducers[socket.id] = new Set();
      }
      socketToProducers[socket.id].add(producer.id);

      producer.observer.on('close', async () => {
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

          if (streamRoom.producers) {
            delete streamRoom.producers[producer.id];
          }

          if (streamRoom.producerRoles) {
            delete streamRoom.producerRoles[producer.id];
          }

          if (streamRoom.producerUsers) {
            delete streamRoom.producerUsers[producer.id];
          }

          // forcedMutedUserIds is intentionally NOT cleaned up here — the
          // mute is keyed by userId, not this producer's id, so it must
          // survive this producer closing (e.g. a reconnect) and re-apply
          // to whatever producer the user creates next. Only an explicit
          // moderator UNMUTE clears it.

          // Room-capacity bookkeeping must not depend on the HLS-recording
          // cleanup below succeeding — a departed player's slot has to free
          // up even if removeRecordingInput fails.
          if (streamRoom.producers) {
            const stillHasProducerInRoom = Object.values(
              streamRoom.producers
            ).some((p) => p.appData?.socketId === socket.id);
            if (!stillHasProducerInRoom) {
              streamRoom.participantSocketIds.delete(socket.id);
            }
          } else {
            streamRoom.participantSocketIds.delete(socket.id);
          }

          publishViewerCount(io, streamId);

          await StreamService.removeRecordingInput({
            streamId,
            producerId: producer.id,
          });

          logger.info(`Producer ${producer.id} cleaned up successfully`);
        } catch (error) {
          logger.error(
            `Error cleaning up producer ${producer.id}: ${error.message}`
          );
        }
      });
      if (isCountedRole) {
        socket.join(streamId);
        socketToStream[socket.id] = streamId;
        publishViewerCount(io, streamId);
      }

      if (!streamRoom.producerRoles) streamRoom.producerRoles = {};
      streamRoom.producerRoles[producer.id] = role;
      // userId travels with every producer so a consumer can group a
      // participant's separate audio+video producers into one tile.
      if (!streamRoom.producerUsers) streamRoom.producerUsers = {};
      streamRoom.producerUsers[producer.id] = user.id;

      // The mute lock is per-user (streamRoom.forcedMutedUserIds), not tied
      // to a producer instance — so a producer created (or re-created after
      // a disconnect/reconnect) while its owner is under an active
      // moderator mute must start paused, or the mute would be silently
      // bypassed by the reconnect. Paused BEFORE announcing the producer
      // (NEW_PRODUCER) so the room never observes it as briefly active.
      const isBornMutedAudio =
        kind === 'audio' && streamRoom.forcedMutedUserIds?.has(user.id);
      if (isBornMutedAudio) {
        await producer.pause();
      }

      // Canonical 6-field contract (SCRUM-203 gate / FINDINGS M4-14): kind+paused
      // let a live-arriving producer seed the correct camera/mic state instead of
      // deriving it wrong forever; symmetric with JOIN's currentProducers.
      io.to(streamId).emit(SOCKET_EVENTS.STREAM.NEW_PRODUCER, {
        producerId: producer.id,
        role,
        streamId,
        userId: user.id,
        kind: producer.kind,
        paused: producer.paused,
      });

      if (isBornMutedAudio) {
        io.to(streamId).emit(SOCKET_EVENTS.STREAM.PRODUCER_PAUSED, {
          producerId: producer.id,
          kind: 'audio',
          paused: true,
          streamId,
        });
      }

      // 4. רישום כל מקור מדיה (Host / Player / Moderator) ב-StreamService.
      if (HLS_INPUT_ROLES.has(role)) {
        // רק וידאו של ה-Host מתחיל את השידור מבחינת השרת.
        if (kind === 'video' && role === 'HOST') {
          logger.info('Host video producer detected. Starting live stream.');

          await prisma.stream.update({
            where: { id: streamId },
            data: {
              status: 'LIVE',
              startTime: new Date(),
            },
          });
        }

        setTimeout(async () => {
          if (producer.closed) {
            logger.info(
              `Skipping closed ${kind} producer ${producer.id} for stream ${streamId}`
            );
            return;
          }

          try {
            logger.info(
              `Registering ${kind} producer for ${role} in stream ${streamId}`
            );

            await StreamService.startRecording({
              streamId,
              router: streamRoom.router,
              producer,
              participantId: socket.user.id,
              role,
            });
          } catch (error) {
            logger.error(
              `Failed to register ${kind} producer: ${error.message}`
            );
          }
        }, RECORDING_START_DELAY_MS);
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

  // Player/host toggled their camera or mic. Pause/resume the server-side
  // producer (stops outgoing RTP so consumers don't see a frozen frame) and
  // broadcast the new media state to the rest of the room so their tiles can
  // show a "camera off" / "muted" indicator instead of the last frame.
  socket.on(
    SOCKET_EVENTS.STREAM.PRODUCER_PAUSE,
    async ({ producerId, kind, paused }, callback) => {
      try {
        const producer = producers[producerId];
        if (!producer)
          return (
            typeof callback === 'function' &&
            callback({ error: ERROR_MESSAGES.PRODUCER_NOT_FOUND })
          );

        // Only the owner of the producer may change its state.
        if (!socketToProducers[socket.id]?.has(producerId))
          return (
            typeof callback === 'function' &&
            callback({ error: ERROR_MESSAGES.NOT_PRODUCER_OWNER })
          );

        // Which room this producer belongs to is recorded server-side at
        // creation time (producer.appData.streamId) — never trust a
        // client-supplied streamId for this. Otherwise a muted user could
        // send their own real producerId alongside an unrelated/fake
        // streamId, miss the forcedMutedUserIds lookup for their real
        // room, and resume themselves.
        const streamId = producer.appData?.streamId;
        if (!streamId || !streams[streamId])
          return (
            typeof callback === 'function' &&
            callback({ error: ERROR_MESSAGES.STREAM_ROOM_NOT_FOUND })
          );

        // A moderator-enforced mute locks the owner's own toggle — they
        // cannot unmute themselves while it's in effect (AC2). Keyed by
        // userId (not this producerId) so it survives the owner's producer
        // being closed and re-created (e.g. a reconnect).
        if (
          !paused &&
          producer.kind === 'audio' &&
          streams[streamId]?.forcedMutedUserIds?.has(socket.user.id)
        )
          return (
            typeof callback === 'function' &&
            callback({ error: ERROR_MESSAGES.MUTED_BY_MODERATOR })
          );

        if (paused) await producer.pause();
        else await producer.resume();

        const event = paused
          ? SOCKET_EVENTS.STREAM.PRODUCER_PAUSED
          : SOCKET_EVENTS.STREAM.PRODUCER_RESUMED;

        socket.to(streamId).emit(event, {
          producerId,
          kind: kind || producer.kind,
          paused,
          streamId,
        });

        if (typeof callback === 'function') callback({ success: true });
      } catch (error) {
        logger.error(
          `Failed to ${paused ? 'pause' : 'resume'} producer ${producerId}: ${error.message}`
        );
        if (typeof callback === 'function') callback({ error: error.message });
      }
    }
  );

  socket.on(SOCKET_EVENTS.STREAM.JOIN, async ({ streamId }, callback) => {
    try {
      const streamRoom = streams[streamId];
      if (!streamRoom)
        return callback({ error: ERROR_MESSAGES.STREAM_NOT_LIVE });
      socket.join(streamId);
      socketToStream[socket.id] = streamId;
      publishViewerCount(io, streamId);
      const producerRoles = streamRoom.producerRoles || {};
      const producerUsers = streamRoom.producerUsers || {};
      const roomProducers = streamRoom.producers || {};
      const currentProducers = Object.keys(roomProducers).map((producerId) => ({
        producerId,
        role: producerRoles[producerId] || PARTICIPANT_ROLES.VIEWER,
        userId: producerUsers[producerId] || null,
        // Carry the live media state so a late joiner seeds the tile as
        // "camera off" / "muted" instead of showing a paused producer as active.
        kind: roomProducers[producerId]?.kind,
        paused: roomProducers[producerId]?.paused ?? false,
      }));
      const hostProducerId =
        Object.keys(producerRoles).find(
          (producerId) => producerRoles[producerId] === PARTICIPANT_ROLES.HOST
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
    const streamIdsToClose = Object.keys(streams).filter(
      (streamId) => streams[streamId].hostSocketId === socket.id
    );

    await Promise.allSettled(
      streamIdsToClose.map(async (streamId) => {
        try {
          await handleCloseStream(streamId, io);
        } catch (error) {
          logger.error(`Failed to close stream ${streamId}: ${error.message}`);
        }
      })
    );
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

    const streamIdsToClose = Object.keys(streams).filter(
      (streamId) => streams[streamId].hostSocketId === socket.id
    );

    await Promise.allSettled(
      streamIdsToClose.map(async (streamId) => {
        try {
          logger.info(`Host disconnected, cleaning up stream: ${streamId}`);

          // עדכון סטטוס ב-DB וסגירת החדר — כולל עצירת ההקלטה
          await handleCloseStream(streamId, io);
        } catch (error) {
          logger.error(
            `Failed to clean up stream ${streamId} on disconnect: ${error.message}`
          );
        }
      })
    );

    if (socketToStream[socket.id]) {
      const leftStreamId = socketToStream[socket.id];
      delete socketToStream[socket.id];
      publishViewerCount(io, leftStreamId);
    }
  });
};

export const handleCloseStream = async (streamId, io) => {
  const streamRoom = streams[streamId];
  if (!streamRoom) return;
  try {
    await StreamService.stopRecording(streamId);
  } catch (err) {
    logger.error(
      `Failed to stop recording for stream ${streamId}: ${err.message}`
    );
  }
  streamRoom.isClosing = true;
  if (streamRoom.router) streamRoom.router.close();
  streamRoom.producerRoles = {};
  if (viewerCountDebounceTimers[streamId]) {
    clearTimeout(viewerCountDebounceTimers[streamId]);
    delete viewerCountDebounceTimers[streamId];
  }
  delete viewerCountWriteSequence[streamId];
  delete viewerCountWriteChain[streamId];
  try {
    await prisma.stream.update({
      where: { id: streamId },
      data: { status: 'FINISHED', endTime: new Date(), viewerCount: 0 },
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
  return stream?.hostId === userId
    ? PARTICIPANT_ROLES.HOST
    : PARTICIPANT_ROLES.VIEWER;
}
