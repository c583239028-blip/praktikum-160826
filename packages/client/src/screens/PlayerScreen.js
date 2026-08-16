import React, { useEffect, useState, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import PropTypes from 'prop-types';
import { MediaStream } from '@livekit/react-native-webrtc';
import { getAppSocket, emitPromise } from '../services/socket.service';
import { MediasoupManager } from '../services/MediasoupManager';
import { InvitationDialog } from '../components/game/JoinLifecycle/InvitationDialog';
import { SOCKET_EVENTS, logger } from '@worldplay/shared';
import { RejectedInvitation } from '../components/game/JoinLifecycle/RejectedInvitation';
import { EnteringScreen } from '../components/game/JoinLifecycle/EnteringScreen';
import { RemoteGame } from '../components/game/RemoteGame';
import { CloseUpGame } from '../components/game/CloseUpGame';
import SettingsIcon from '@/assets/icons/settings.svg';
import CameraIcon from '@/assets/icons/camera.svg';
import SpeakerIcon from '@/assets/icons/speaker.svg';
import MicCameraPermissionsScreen from '../components/dialogs/MicCameraPermissionsScreen';

export default function PlayerScreen({ streamId, gameType }) {
  const [remoteStreams, setRemoteStreams] = useState([]);
  const [localStream, setLocalStream] = useState(null);
  const [status, setStatus] = useState('dialog');
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [isMicOn, setIsMicOn] = useState(false);
  const remoteStreamsCountRef = useRef(0);
  const resourcesRef = useRef([]);
  const [showPermissionsScreen, setShowPermissionsScreen] = useState(true); // shown on entry
  const startMyCamera = async () => {
    const stream = await MediasoupManager.getLocalStream();
    setLocalStream(stream);
  };

  const consumeStream = async (producerId, role) => {
    try {
      const recvTransport = await MediasoupManager.createTransport(
        getAppSocket(),
        'recv',
        streamId
      );
      const consumeData = await emitPromise(SOCKET_EVENTS.STREAM.CONSUME, {
        transportId: recvTransport.id,
        producerId,
        rtpCapabilities: MediasoupManager.getRtpCapabilities(),
        streamId,
      });
      const consumer = await recvTransport.consume(consumeData);
      const stream = new MediaStream([consumer.track]);
      await emitPromise(SOCKET_EVENTS.STREAM.RESUME, {
        consumerId: consumer.id,
        streamId,
      });
      setRemoteStreams((prev) => [
        ...prev,
        // isCameraOff / isMicOn track the producer's live media state, updated
        // by the PRODUCER_PAUSED/RESUMED listeners below. J2 maps these onto
        // the rendered tile.
        // NOTE for J2: audio and video are SEPARATE producers → separate
        // entries here. The producers→tiles mapping must group by participant
        // so a single tile carries both isCameraOff (video) and isMicOn (audio).
        {
          id: producerId,
          role,
          stream,
          // Seeded optimistically as live. A late joiner whose target is already
          // paused gets the correct flag from JOIN's currentProducers — that
          // seeding is consumed in SCRUM-224, not here yet.
          isCameraOff: false,
          isMicOn: true,
        },
      ]);
      resourcesRef.current.push({ transport: recvTransport, consumer });
    } catch (error) {
      remoteStreamsCountRef.current -= 1;
      logger.error('Error consuming stream:', error);
    }
  };
  // ── STUB HANDLER — permissions screen only, no live wiring ──
  const handlePermissionsContinue = ({ cameraEnabled, micEnabled }) => {
    setIsCameraOn(cameraEnabled);
    setIsMicOn(micEnabled);
    setShowPermissionsScreen(false);
    setStatus('dialog');
  };

  useEffect(() => {
    startMyCamera();

    const handleNewProducer = async ({ producerId, role }) => {
      if (remoteStreamsCountRef.current >= 4) {
        return;
      }
      remoteStreamsCountRef.current += 1;
      await consumeStream(producerId, role);
    };

    // A remote producer paused/resumed its camera or mic — reflect it on the
    // matching tile so the viewer sees "camera off" / "muted" instead of a
    // frozen frame.
    const applyProducerState = ({ producerId, kind, paused }) => {
      setRemoteStreams((prev) =>
        prev.map((rs) => {
          if (rs.id !== producerId) return rs;
          if (kind === 'audio') return { ...rs, isMicOn: !paused };
          return { ...rs, isCameraOff: paused };
        })
      );
    };
    const handleProducerPaused = (payload) =>
      applyProducerState({ ...payload, paused: true });
    const handleProducerResumed = (payload) =>
      applyProducerState({ ...payload, paused: false });

    const s = getAppSocket();
    if (s) {
      s.on(SOCKET_EVENTS.STREAM.NEW_PRODUCER, handleNewProducer);
      s.on(SOCKET_EVENTS.STREAM.PRODUCER_PAUSED, handleProducerPaused);
      s.on(SOCKET_EVENTS.STREAM.PRODUCER_RESUMED, handleProducerResumed);
    }
    return () => {
      const s2 = getAppSocket();
      if (s2) {
        s2.off(SOCKET_EVENTS.STREAM.NEW_PRODUCER, handleNewProducer);
        s2.off(SOCKET_EVENTS.STREAM.PRODUCER_PAUSED, handleProducerPaused);
        s2.off(SOCKET_EVENTS.STREAM.PRODUCER_RESUMED, handleProducerResumed);
      }
      resourcesRef.current.forEach(({ transport, consumer }) => {
        consumer.close();
        transport.close();
      });
    };
  }, []);

  return (
    <View style={styles.container}>
      {status == 'dialog' && (
        <InvitationDialog
          role={'player'}
          initialCountdown={60}
          onAccept={() => {
            setStatus('entering');
          }}
          onReject={() => {
            setStatus('reject');
          }}
          // PROD
          inviterName={'sdgf'}
          inviterImageUri={'https://placehold.co/100x100'}
        ></InvitationDialog>
      )}
      {status == 'reject' && (
        <RejectedInvitation role="player" onClose={() => setStatus('dialog')} />
      )}
      {status == 'entering' && <EnteringScreen></EnteringScreen>}
      {status == 'live' &&
        // PROD
        (gameType == 'REMOTE' ? (
          <RemoteGame
            isLive
            giftCount={33}
            viewerCount={22}
            streamTitle={'egsefgd'}
            onPowerPress={() => logger.info('power')}
            streams={[
              {
                stream: localStream,
                label: 'local stream',
                giftCount: 47556,
                isCameraOff: true,
                isMicOn: false,
                isSelected: true,
                profileUrl: require('@/assets/images/icon.png'),
              },
              {
                stream: localStream,
                label: 'local stream',
                giftCount: 47556,
                isCameraOff: false,
                isMicOn: false,
                isSelected: false,
                profileUrl: require('@/assets/images/icon.png'),
              },
              {
                stream: localStream,
                label: 'local stream',
                giftCount: 47556,
                isCameraOff: false,
                isMicOn: false,
                isSelected: false,
                profileUrl: require('@/assets/images/icon.png'),
              },
              {
                stream: localStream,
                label: 'local stream',
                giftCount: 47556,
                isCameraOff: true,
                isMicOn: false,
                isSelected: false,
                profileUrl: require('@/assets/images/icon.png'),
              },
            ]}
            icons={[
              {
                id: 'settings',
                icon: SettingsIcon,
                onPress: () => logger.info('settings'),
              },
              {
                id: 'camera',
                icon: CameraIcon,
                onPress: () => logger.info('camera'),
              },
              {
                id: 'speaker',
                icon: SpeakerIcon,
                onPress: () => logger.info('speaker'),
              },
            ]}
          ></RemoteGame>
        ) : (
          <CloseUpGame
            // PROD
            isLive
            giftCount={33}
            viewerCount={22}
            streamTitle={'egsefgd'}
            onPowerPress={() => logger.info('power')}
            mainStream={localStream}
            players={[
              {
                id: 'player-1',
                username: 'player1',
                avatarUrl: 'https://placehold.co/100x100',
                giftCount: 0,
              },
              {
                id: 'player-2',
                username: 'player2',
                avatarUrl: 'https://placehold.co/100x100',
                giftCount: 0,
              },
              {
                id: 'player-3',
                username: 'player3',
                avatarUrl: 'https://placehold.co/100x100',
                giftCount: 0,
              },
              {
                id: 'player-4',
                username: 'player4',
                avatarUrl: 'https://placehold.co/100x100',
                giftCount: 0,
              },
            ]}
            icons={[
              {
                id: 'settings',
                icon: SettingsIcon,
                onPress: () => logger.info('settings'),
              },
              {
                id: 'camera',
                icon: CameraIcon,
                onPress: () => logger.info('camera'),
              },
              {
                id: 'speaker',
                icon: SpeakerIcon,
                onPress: () => logger.info('speaker'),
              },
            ]}
          ></CloseUpGame>
        ))}
      <MicCameraPermissionsScreen
        visible={showPermissionsScreen}
        onContinue={handlePermissionsContinue}
      />
    </View>
  );
}

PlayerScreen.propTypes = {
  streamId: PropTypes.string,
  gameType: PropTypes.oneOf(['CLOSE_UP', 'REMOTE']),
};

const styles = StyleSheet.create({
  container: { flex: 1 },
});
