// Server-side enforcement of moderator MUTE/UNMUTE actions. Called only
// from the internal service-to-service moderation route
// (packages/media-server/src/routes/internal.routes.js) — never reachable
// from a client socket, which is why this bypasses the NOT_PRODUCER_OWNER
// ownership check the self-service PRODUCER_PAUSE handler enforces.
import { streams } from '../sockets/stream.handler.js';
import { SOCKET_EVENTS, ERROR_MESSAGES } from '@worldplay/shared';

// Forces the audio producer(s) belonging to targetUserId in streamId into
// (or out of) a moderator-muted state.
//
// The mute is tracked by userId (streamRoom.forcedMutedUserIds), not by
// producer id: a producer is a transient instance (it's replaced on every
// reconnect/re-produce), while the mute must hold "as long as it's in
// effect" regardless of producer churn (AC2). This also means MUTE
// succeeds even when the target has no live audio producer right now — the
// moderator's intent still has to be recorded so a producer created
// afterward (see stream.handler.js's PRODUCE handler) is born paused
// instead of silently bypassing the mute.
//
// Broadcasts with io.to(streamId), not socket.to — there is no client
// socket to exclude here, and the muted user themselves must receive the
// event too (they didn't initiate this, unlike a self-toggle).
export async function setAudioMuteForUser(io, streamId, targetUserId, muted) {
  const streamRoom = streams[streamId];
  if (!streamRoom) throw new Error(ERROR_MESSAGES.STREAM_ROOM_NOT_FOUND);

  if (!streamRoom.forcedMutedUserIds) {
    streamRoom.forcedMutedUserIds = new Set();
  }

  const audioProducers = Object.values(streamRoom.producers || {}).filter(
    (p) => p.appData?.userId === targetUserId && p.kind === 'audio'
  );

  // The lock (forcedMutedUserIds) and the actual enforcement (pause/resume)
  // must never disagree, even if mediasoup throws partway through several
  // producers (a user can technically have more than one audio producer).
  // changedProducers tracks what actually succeeded so a later failure can
  // roll back exactly that, not the whole user. Events are only broadcast
  // once the entire batch succeeds — a rolled-back producer was never
  // announced as changed in the first place, so there's nothing to correct
  // on the client side.
  const changedProducers = [];

  if (muted) {
    // Lock first (fail-safe): a self-unmute racing in with the pause()
    // calls below must still be blocked. Rolled back only if enforcement
    // itself throws, so a failed MUTE never leaves a lock with no
    // corresponding pause.
    streamRoom.forcedMutedUserIds.add(targetUserId);
    try {
      for (const producer of audioProducers) {
        await producer.pause();
        changedProducers.push(producer);
      }
    } catch (error) {
      await Promise.allSettled(
        changedProducers.map((producer) => producer.resume())
      );
      streamRoom.forcedMutedUserIds.delete(targetUserId);
      throw error;
    }

    for (const producer of changedProducers) {
      io.to(streamId).emit(SOCKET_EVENTS.STREAM.PRODUCER_PAUSED, {
        producerId: producer.id,
        kind: 'audio',
        paused: true,
        streamId,
      });
    }
  } else {
    try {
      for (const producer of audioProducers) {
        await producer.resume();
        changedProducers.push(producer);
      }
    } catch (error) {
      await Promise.allSettled(
        changedProducers.map((producer) => producer.pause())
      );
      throw error;
    }

    // Unlock only after every producer actually resumed — otherwise a
    // resume() failure would leave a producer paused but the self-toggle
    // unlocked, letting the user "unmute" a producer that never resumed.
    streamRoom.forcedMutedUserIds.delete(targetUserId);

    for (const producer of changedProducers) {
      io.to(streamId).emit(SOCKET_EVENTS.STREAM.PRODUCER_RESUMED, {
        producerId: producer.id,
        kind: 'audio',
        paused: false,
        streamId,
      });
    }
  }

  return { affectedProducerCount: audioProducers.length };
}
