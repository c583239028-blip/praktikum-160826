import React, { useEffect, useState, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import PropTypes from 'prop-types';
import { MediaStream } from '@livekit/react-native-webrtc';
import { getAppSocket, emitPromise } from '../services/socket.service';
import { MediasoupManager } from '../services/MediasoupManager';
import { InvitationDialog } from '../components/game/JoinLifecycle/InvitationDialog';
import { SOCKET_EVENTS } from '@worldplay/shared';
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
      setRemoteStreams((prev) => [...prev, { id: producerId, role, stream }]);
      resourcesRef.current.push({ transport: recvTransport, consumer });
    } catch (error) {
      remoteStreamsCountRef.current -= 1;
      console.error('Error consuming stream:', error);
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

    const s = getAppSocket();
    if (s) s.on(SOCKET_EVENTS.STREAM.NEW_PRODUCER, handleNewProducer);
    return () => {
      const s2 = getAppSocket();
      if (s2) s2.off(SOCKET_EVENTS.STREAM.NEW_PRODUCER, handleNewProducer);
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
            onPowerPress={() => console.log('power')}
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
                onPress: () => console.log('settings'),
              },
              {
                id: 'camera',
                icon: CameraIcon,
                onPress: () => console.log('camera'),
              },
              {
                id: 'speaker',
                icon: SpeakerIcon,
                onPress: () => console.log('speaker'),
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
            onPowerPress={() => console.log('power')}
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
                onPress: () => console.log('settings'),
              },
              {
                id: 'camera',
                icon: CameraIcon,
                onPress: () => console.log('camera'),
              },
              {
                id: 'speaker',
                icon: SpeakerIcon,
                onPress: () => console.log('speaker'),
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
