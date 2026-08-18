import { useLocalSearchParams } from 'expo-router';
import { SOCKET_EVENTS } from '@worldplay/shared';
import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Button,
  TextInput,
  Alert,
  I18nManager,
} from 'react-native';
import { connectAppSocket, emitPromise } from '../services/socket.service';
import { MediasoupManager } from '../services/MediasoupManager';
import { RTCView, MediaStream } from '@livekit/react-native-webrtc';
import i18n from '../i18n';
import LazyAuthModal from '../components/LazyAuthModal';
import ErrorState from '../components/ErrorState';
import LoadingSkeletonCard from '../components/LoadingSkeletonCard';
import BirthdayModal from '../components/BirthdayModal';
import { Colors } from '../../constants/design';
import { useAuthGuard } from '../hooks/useAuthGuard';
import { useAuth } from '../context/AuthContext';
import { birthdayService } from '../services/birthday.service';
// rgba derived from Colors.warning.dark (#E08835) for semi-transparent banner background
const DVR_BANNER_BG = 'rgba(224,136,53,0.92)';
export async function createConsumerStream(socket, producerId, targetStreamId) {
  const caps = MediasoupManager.getRtpCapabilities();
  const transport = await MediasoupManager.createTransport(
    socket,
    'recv',
    targetStreamId
  );
  const consumeData = await emitPromise(SOCKET_EVENTS.STREAM.CONSUME, {
    transportId: transport.id,
    producerId,
    rtpCapabilities: caps,
    streamId: targetStreamId,
  });
  const consumer = await transport.consume(consumeData);
  const stream = new MediaStream([consumer.track]);
  return { consumer, stream };
}

const overlay = StyleSheet.create({
  row: {
    position: 'absolute',
    bottom: 12,
    start: 12,
    flexDirection: 'row',
    gap: 8,
    zIndex: 20,
  },
  camBox: {
    width: 72,
    height: 96,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.warning.dark,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  video: { position: 'absolute', width: '100%', height: '100%' },
  label: {
    color: Colors.surface.white,
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 2,
  },
});
const PlayerCamsOverlay = ({ streams }) => {
  if (!streams || streams.length === 0) return null;
  return (
    <View style={overlay.row}>
      {streams.map((s) => (
        <View key={s.id} style={overlay.camBox}>
          <RTCView
            streamURL={s.stream.toURL()}
            style={overlay.video}
            objectFit="cover"
          />
          <Text style={overlay.label} numberOfLines={1}>
            {s.role ?? i18n.t('viewer:playerLabel')}
          </Text>
        </View>
      ))}
    </View>
  );
};

PlayerCamsOverlay.propTypes = {
  streams: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      role: PropTypes.string,
      stream: PropTypes.object.isRequired,
    })
  ),
};

PlayerCamsOverlay.defaultProps = {
  streams: [],
};
export default function ViewerScreen() {
  const [remoteStream, setRemoteStream] = useState(null);
  const [playerStreams, setPlayerStreams] = useState([]);
  const [viewState, setViewState] = useState('loading');
  const [isPaused, setIsPaused] = useState(false);
  const [hasReceivedDVREvent, setHasReceivedDVREvent] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [status, setStatus] = useState(() =>
    i18n.t('viewer:status_waiting_for_id')
  );
  const { streamId, title } = useLocalSearchParams();
  const [streamIdInput, setStreamIdInput] = useState(streamId ?? '');
  const { guardedAction, isModalVisible, closeAuthModal } = useAuthGuard();
  const { user, updateUser } = useAuth();
  const [showBirthday, setShowBirthday] = useState(false);

  useEffect(() => {
    if (user && birthdayService.shouldShowPopup(user)) {
      setShowBirthday(true);
    }
  }, [user]);

  const consume = useCallback(async (producerId, targetId) => {
    try {
      const activeSocket = await connectAppSocket();
      const { consumer, stream } = await createConsumerStream(
        activeSocket,
        producerId,
        targetId
      );
      setRemoteStream(stream);
      setStatus(i18n.t('viewer:status_live'));
      setViewState('live');
      await emitPromise(SOCKET_EVENTS.STREAM.RESUME, {
        consumerId: consumer.id,
        streamId: targetId,
      });
    } catch (err) {
      console.error('Consume error:', err);
      setStatus(i18n.t('viewer:status_error_receiving_video'));
      setViewState('error');
    }
  }, []);

  // אם הגענו עם streamId מהניווט — מצטרפים אוטומטית
  useEffect(() => {
    if (streamId) {
      setHasInteracted(true);
      setStatus(i18n.t('viewer:joining_stream'));
      setViewState('loading');
      emitPromise(SOCKET_EVENTS.STREAM.JOIN, { streamId })
        .then(async (data) => {
          await MediasoupManager.initDevice(data.rtpCapabilities);
          if (data.currentProducerId) {
            await consume(data.currentProducerId, streamId);
          } else {
            setStatus(i18n.t('viewer:waiting_for_host'));
            setViewState('empty');
          }
        })
        .catch((err) => {
          console.error('Join error:', err);
          setStatus(i18n.t('viewer:status_error', { message: err.message }));
          setViewState('error');
        });
    }
  }, [streamId, consume]);

  useEffect(() => {
    let activeSocket;
    connectAppSocket().then((s) => {
      if (!s) return;
      activeSocket = s;
      activeSocket.on(
        SOCKET_EVENTS.STREAM.NEW_PRODUCER,
        async ({ producerId, role }) => {
          if (role === 'PLAYER') {
            try {
              const { consumer, stream } = await createConsumerStream(
                activeSocket,
                producerId,
                streamIdInput
              );
              setPlayerStreams((prev) => [
                ...prev.filter((p) => p.id !== producerId),
                { id: producerId, role, stream },
              ]);
              await emitPromise(SOCKET_EVENTS.STREAM.RESUME, {
                consumerId: consumer.id,
                streamId: streamIdInput,
              });
            } catch (err) {
              console.error('Player consume error:', err);
            }
          } else {
            consume(producerId, streamIdInput);
          }
        }
      );
      activeSocket.on(SOCKET_EVENTS.STREAM.ENDED, () => {
        setRemoteStream(null);
        setPlayerStreams([]);
        setStatus(i18n.t('viewer:status_stream_ended'));
        setViewState('empty');
      });
      activeSocket.on(SOCKET_EVENTS.STREAM.STREAM_PAUSED, () => {
        setIsPaused(true);
        setHasReceivedDVREvent(true);
      });
      activeSocket.on(SOCKET_EVENTS.STREAM.STREAM_RESUMED, () => {
        setIsPaused(false);
        setHasReceivedDVREvent(true);
      });
    });
    return () => {
      if (activeSocket) {
        activeSocket.off(SOCKET_EVENTS.STREAM.NEW_PRODUCER);
        activeSocket.off(SOCKET_EVENTS.STREAM.ENDED);
        activeSocket.off(SOCKET_EVENTS.STREAM.STREAM_PAUSED);
        activeSocket.off(SOCKET_EVENTS.STREAM.STREAM_RESUMED);
      }
    };
  }, [streamIdInput, consume]);

  const handleJoinPress = async () => {
    if (!streamIdInput) {
      Alert.alert(i18n.t('viewer:alert_enter_stream_id'));
      return;
    }
    try {
      setStatus(i18n.t('viewer:joining_stream'));
      setHasInteracted(true);
      setViewState('loading');
      const data = await emitPromise(SOCKET_EVENTS.STREAM.JOIN, {
        streamId: streamIdInput,
      });
      await MediasoupManager.initDevice(data.rtpCapabilities);
      if (data.currentProducerId) {
        await consume(data.currentProducerId, streamIdInput);
      } else {
        setStatus(i18n.t('viewer:waiting_for_host'));
        setViewState('empty');
      }
    } catch (err) {
      console.error('Join error:', err);
      setStatus(i18n.t('viewer:status_error', { message: err.message }));
      setViewState('error');
    }
  };

  const handleSubmitBet = () => {
    Alert.alert(
      i18n.t('viewer:bet_submitted_title'),
      i18n.t('viewer:bet_submitted_message')
    );
  };

  const handleBirthdayConfirm = async (date) => {
    try {
      const iso = date.toISOString().split('T')[0];
      await birthdayService.saveBirthday(iso);
      updateUser({ dateOfBirth: iso });
      setShowBirthday(false);
    } catch (err) {
      console.error('Birthday save failed:', err.message);
      Alert.alert(
        i18n.t('birthday:save_error_title'),
        i18n.t('birthday:save_error_message')
      );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>
        {title ?? i18n.t('viewer:default_title')}
      </Text>
      {!hasInteracted ? (
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder={i18n.t('viewer:stream_id_placeholder')}
            placeholderTextColor={Colors.neutral[500]}
            value={streamIdInput}
            onChangeText={setStreamIdInput}
          />
          <Button
            title={i18n.t('viewer:join_button')}
            onPress={() => guardedAction(handleJoinPress)}
            color={Colors.live}
          />
        </View>
      ) : (
        <View style={styles.videoBox}>
          {viewState === 'loading' && <LoadingSkeletonCard />}
          {viewState === 'error' && <ErrorState onRetry={handleJoinPress} />}
          {viewState === 'empty' && (
            <Text style={styles.statusText}>{status}</Text>
          )}
          {viewState === 'live' && remoteStream && (
            <>
              <RTCView
                streamURL={remoteStream.toURL()}
                objectFit="contain"
                style={styles.video}
              />
              <PlayerCamsOverlay streams={playerStreams} />
              {hasReceivedDVREvent && (
                <View style={styles.dvrBanner}>
                  <Text style={styles.dvrBannerText}>
                    {isPaused
                      ? i18n.t('viewer:question_active')
                      : i18n.t('viewer:stream_resumed_message')}
                  </Text>
                </View>
              )}
            </>
          )}
        </View>
      )}
      <Text style={styles.statusBadge}>{status}</Text>
      <View style={styles.betButtonContainer}>
        <Button
          title={i18n.t('viewer:submit_bet_button')}
          onPress={() => guardedAction(handleSubmitBet)}
          color={Colors.success.main}
        />
      </View>
      <LazyAuthModal visible={isModalVisible} onClose={closeAuthModal} />
      <BirthdayModal visible={showBirthday} onConfirm={handleBirthdayConfirm} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.neutral[900],
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    color: Colors.surface.white,
    fontSize: 22,
    marginBottom: 30,
    fontWeight: 'bold',
    textAlign: I18nManager.isRTL ? 'right' : 'left',
  },
  inputContainer: { width: '100%', alignItems: 'center' },
  input: {
    backgroundColor: Colors.surface.white,
    width: '90%',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
    textAlign: 'center',
  },
  videoBox: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: Colors.neutral[900],
    borderRadius: 12,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  video: { width: '100%', height: '100%' },
  dvrBanner: {
    position: 'absolute',
    top: 12,
    start: 12,
    end: 12,
    backgroundColor: DVR_BANNER_BG,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    zIndex: 30,
  },
  dvrBannerText: {
    color: Colors.neutral[900],
    fontWeight: '700',
    fontSize: 13,
    textAlign: 'center',
  },
  statusText: {
    color: Colors.text.tertiary,
    textAlign: I18nManager.isRTL ? 'right' : 'left',
  },
  statusBadge: {
    color: Colors.warning.dark,
    marginTop: 20,
    textAlign: I18nManager.isRTL ? 'right' : 'left',
  },
  betButtonContainer: { width: '100%', alignItems: 'center', marginTop: 20 },
});
