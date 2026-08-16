import { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SOCKET_EVENTS, logger } from '@worldplay/shared';
import {
  getAppSocket,
  getMediaSocket,
  emitPromise,
  emitMediaPromise,
} from '../services/socket.service';
import { MediasoupManager } from '../services/MediasoupManager';
import { setStreamStatus, resetSession } from '../store/slices/gameStreamSlice';

// All host broadcast ("Phase 2") logic, extracted verbatim from HostScreen.
// The real-time handshake internals are UNCHANGED — this is a cut-and-paste
// move so the proven flow keeps working. HostFlow / LiveBroadcastScreen consume
// the returned display-state + actions. Cleanup-on-unmount stays in the
// container (it owns the mount lifecycle), so this hook exposes endAndCleanup.
export function useHostBroadcast() {
  const dispatch = useDispatch();
  const router = useRouter();
  const { t } = useTranslation('host');
  const {
    gameId,
    streamId,
    status: gameStatus,
  } = useSelector((state) => state.gameStream);

  const [localStream, setLocalStream] = useState(null);
  const [status, setStatus] = useState('Ready');
  const [isLive, setIsLive] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);
  // Camera / mic on-air toggles (the live broadcast controls)
  const [cameraOn, setCameraOn] = useState(true);
  const [micOn, setMicOn] = useState(true);

  const localStreamRef = useRef(null);
  const sendTransportRef = useRef(null);
  const videoProducerRef = useRef(null);
  const audioProducerRef = useRef(null);
  const gameIdRef = useRef(null);
  const streamIdRef = useRef(null);
  const hasEndedRef = useRef(false);
  const isStartingRef = useRef(false);

  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  useEffect(() => {
    gameIdRef.current = gameId;
  }, [gameId]);

  useEffect(() => {
    streamIdRef.current = streamId;
  }, [streamId]);

  // Live viewer count from the media-server (SCRUM-229). The host is in the
  // stream room (joined during startBroadcast), so it receives stream:viewer_count
  // on the media socket. We filter by streamId so a stray event for another
  // room can't overwrite our count.
  //
  // Depending only on [isLive] is safe: isLive is set to true at the end of
  // startBroadcast, *after* emitMediaPromise(CREATE_ROOM) resolves — which goes
  // through connectMediaSocket() and rejects unless the media socket is
  // connected. So by the time this effect runs, getMediaSocket() is guaranteed
  // non-null. The null-guard below is a belt-and-suspenders fallback.
  useEffect(() => {
    if (!isLive) return;
    const mediaSocket = getMediaSocket();
    if (!mediaSocket) return;

    const handleViewerCount = (payload) => {
      if (payload?.streamId && payload.streamId !== streamIdRef.current) return;
      if (typeof payload?.viewerCount === 'number') {
        setViewerCount(payload.viewerCount);
      }
    };

    mediaSocket.on(SOCKET_EVENTS.STREAM.VIEWER_COUNT, handleViewerCount);
    return () => {
      mediaSocket.off(SOCKET_EVENTS.STREAM.VIEWER_COUNT, handleViewerCount);
    };
  }, [isLive]);

  // ----- helpers -----

  const stopLocalMedia = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
      setLocalStream(null);
    }
    if (sendTransportRef.current) {
      sendTransportRef.current.close();
      sendTransportRef.current = null;
    }
    videoProducerRef.current = null;
    audioProducerRef.current = null;
  };

  // Tell the media server the producer was paused/resumed so it stops the
  // outgoing RTP and broadcasts the state to consumers (their tile shows a
  // "camera off" / "muted" indicator instead of a frozen frame).
  const notifyProducerState = async (producerId, kind, paused) => {
    if (!producerId) return;
    try {
      await emitMediaPromise(SOCKET_EVENTS.STREAM.PRODUCER_PAUSE, {
        streamId: streamIdRef.current || streamId,
        producerId,
        kind,
        paused,
      });
    } catch (err) {
      // non-fatal: the local track is already toggled either way. Still surface
      // it — a silent failure here means consumers keep a frozen frame with no
      // dev-visible cause.
      logger.warn(
        `notifyProducerState (${kind}, paused=${paused}) failed: ${err?.message ?? err}`
      );
    }
  };

  // Toggle the outgoing video track. The transport/producer stays alive; we
  // flip `enabled` locally and notify the server so consumers get a real
  // "camera off" state instead of a frozen frame.
  const toggleCamera = () => {
    const track = localStreamRef.current?.getVideoTracks?.()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setCameraOn(track.enabled);
    notifyProducerState(videoProducerRef.current?.id, 'video', !track.enabled);
  };

  // Toggle the outgoing audio track (mute / unmute). Same principle — the
  // producer stays up, we flip `enabled` and notify the server.
  const toggleMic = () => {
    const track = localStreamRef.current?.getAudioTracks?.()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setMicOn(track.enabled);
    notifyProducerState(audioProducerRef.current?.id, 'audio', !track.enabled);
  };

  const endAndCleanup = async () => {
    if (hasEndedRef.current) return;
    hasEndedRef.current = true;

    stopLocalMedia();

    try {
      await emitMediaPromise(SOCKET_EVENTS.STREAM.ENDED, {
        streamId: streamIdRef.current || streamId,
      });
    } catch (_) {
      // non-fatal
    }

    if (gameIdRef.current) {
      try {
        await emitPromise(SOCKET_EVENTS.GAME.STATUS_UPDATE, {
          gameId: gameIdRef.current,
          status: 'FINISHED',
        });
      } catch (_) {
        // best-effort
      }
    }

    dispatch(resetSession());
  };

  const startBroadcast = async () => {
    if (localStream || isClosing || !streamId || isStartingRef.current) return;
    isStartingRef.current = true;
    setHasError(false);
    try {
      setStatus(t('openingCamera', 'פותח מצלמה...'));
      const stream = await MediasoupManager.getLocalStream();
      if (!stream) throw new Error(t('cameraUnavailable', 'המצלמה אינה זמינה'));
      setLocalStream(stream);
      localStreamRef.current = stream;
      // Fresh broadcast starts with camera + mic live.
      setCameraOn(true);
      setMicOn(true);

      setStatus(t('connectingMedia', 'מתחבר לשרת המדיה...'));
      const roomData = await emitMediaPromise(
        SOCKET_EVENTS.STREAM.CREATE_ROOM,
        {
          streamId,
        }
      );

      setStatus(t('loadingWebrtc', 'טוען WebRTC...'));
      await MediasoupManager.initDevice(roomData.rtpCapabilities);

      setStatus(t('creatingTransport', 'יוצר transport...'));
      const transport = await MediasoupManager.createTransport(
        getAppSocket(),
        'send',
        streamId
      );
      sendTransportRef.current = transport;

      setStatus(t('sendingVideo', 'שולח וידאו...'));
      if (stream.getVideoTracks()[0]) {
        videoProducerRef.current = await transport.produce({
          track: stream.getVideoTracks()[0],
        });
      }
      if (stream.getAudioTracks()[0]) {
        audioProducerRef.current = await transport.produce({
          track: stream.getAudioTracks()[0],
        });
      }

      // Resuming an already-ACTIVE game (host re-entering via LIVE tab) must
      // not repeat the WAITING->ACTIVE transition — the server rejects a
      // same-status update, which would otherwise strand this resume in the
      // error state right after re-acquiring the camera.
      if (gameStatus !== 'ACTIVE') {
        await emitPromise(SOCKET_EVENTS.GAME.STATUS_UPDATE, {
          gameId,
          status: 'ACTIVE',
        });
        dispatch(setStreamStatus('ACTIVE'));
      }
      setIsLive(true);
      setStatus(t('liveStatus', 'שידור חי'));
    } catch (err) {
      setStatus(t('errorPrefix', 'שגיאה') + ': ' + err.message);
      stopLocalMedia();
      setIsLive(false);
      setHasError(true);
    } finally {
      isStartingRef.current = false;
    }
  };

  const confirmEndStream = async () => {
    setShowEndConfirm(false);
    setIsClosing(true);
    setIsLive(false);
    await endAndCleanup();
    router.back();
  };

  return {
    // display state
    localStream,
    status,
    isLive,
    isClosing,
    hasError,
    viewerCount,
    showEndConfirm,
    cameraOn,
    micOn,
    // actions
    startBroadcast,
    toggleCamera,
    toggleMic,
    requestEnd: () => setShowEndConfirm(true),
    cancelEnd: () => setShowEndConfirm(false),
    confirmEnd: confirmEndStream,
    // exposed so the container can run it on unmount / navigation away
    endAndCleanup,
  };
}
