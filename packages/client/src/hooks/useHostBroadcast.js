import { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SOCKET_EVENTS } from '@worldplay/shared';
import {
  getAppSocket,
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
  const { gameId, streamId } = useSelector((state) => state.gameStream);

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

  // Simulated viewer counter while live
  useEffect(() => {
    if (!isLive) return;
    const interval = setInterval(() => {
      setViewerCount((prev) =>
        Math.max(0, prev + (Math.random() > 0.5 ? 1 : -1))
      );
    }, 4000);
    return () => clearInterval(interval);
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
  };

  // Toggle the outgoing video track. Disabling keeps the transport/producer
  // alive (viewers just see a frozen/black frame) so the broadcast never drops.
  const toggleCamera = () => {
    const track = localStreamRef.current?.getVideoTracks?.()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setCameraOn(track.enabled);
  };

  // Toggle the outgoing audio track (mute / unmute). Same principle — the
  // producer stays up, we only flip `enabled`.
  const toggleMic = () => {
    const track = localStreamRef.current?.getAudioTracks?.()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setMicOn(track.enabled);
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
        await transport.produce({ track: stream.getVideoTracks()[0] });
      }
      if (stream.getAudioTracks()[0]) {
        await transport.produce({ track: stream.getAudioTracks()[0] });
      }

      await emitPromise(SOCKET_EVENTS.GAME.STATUS_UPDATE, {
        gameId,
        status: 'ACTIVE',
      });
      dispatch(setStreamStatus('ACTIVE'));
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
