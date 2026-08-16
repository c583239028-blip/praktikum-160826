import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import PropTypes from 'prop-types';
import { SOCKET_EVENTS, logger } from '@worldplay/shared';
import { emitMediaPromise } from '../services/socket.service';
import LazyAuthModal from '../components/LazyAuthModal';
import { useAuthGuard } from '../hooks/useAuthGuard';

export default function BroadcastScreen() {
  const [localStream] = useState(null);
  const [remoteStream] = useState(null);
  const [isLive, setIsLive] = useState(false);
  const [status, setStatus] = useState('Connected');
  const { guardedAction, isModalVisible, closeAuthModal } = useAuthGuard();

  const initMedia = async () => {
    try {
      setStatus('Requesting camera access...');
      const stream = null;
      return stream;
    } catch (e) {
      setStatus('Camera error');
      throw e;
    }
  };

  const startBroadcast = async () => {
    try {
      await initMedia();
      setStatus('Connecting to media server...');

      const { streamId } = await emitMediaPromise(
        SOCKET_EVENTS.STREAM.INIT_BROADCAST,
        {
          title: 'Moderator broadcast',
        }
      );
      await emitMediaPromise(SOCKET_EVENTS.STREAM.CREATE_ROOM, { streamId });

      setIsLive(true);
      setStatus('Live (not recorded) - WebRTC Disabled');
    } catch (err) {
      logger.error(err);
      setStatus('Connection error');
    }
  };

  const VideoSlot = ({ stream, label, isRemote }) => (
    <View style={[styles.videoBox, isRemote && styles.remoteBox]}>
      {stream ? (
        <Text style={styles.placeholderText}>WebRTC Disabled</Text>
      ) : (
        <Text style={styles.placeholderText}>{label}</Text>
      )}
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{label}</Text>
      </View>
    </View>
  );

  VideoSlot.propTypes = {
    stream: PropTypes.object,
    label: PropTypes.string.isRequired,
    isRemote: PropTypes.bool,
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.statusText}>{status}</Text>
      </View>
      <View style={styles.splitGrid}>
        <VideoSlot stream={localStream} label="You (Moderator 1)" />
        <VideoSlot
          stream={remoteStream}
          label="Moderator 2 (waiting...)"
          isRemote
        />
      </View>
      <View style={styles.controls}>
        {!isLive ? (
          <TouchableOpacity
            style={styles.btnStart}
            onPress={() => guardedAction(startBroadcast)}
          >
            <Text style={styles.btnText}>Start Broadcast</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.btnStop} onPress={() => {}}>
            <Text style={styles.btnText}>Stop Broadcast</Text>
          </TouchableOpacity>
        )}
      </View>
      <LazyAuthModal visible={isModalVisible} onClose={closeAuthModal} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: {
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
  },
  statusText: { color: '#00ff00', fontWeight: 'bold' },
  splitGrid: { flex: 1, flexDirection: 'column' },
  videoBox: {
    flex: 1,
    backgroundColor: '#222',
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 2,
    borderColor: '#000',
  },
  remoteBox: { backgroundColor: '#181818' },
  placeholderText: { color: '#444' },
  badge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 5,
    borderRadius: 4,
  },
  badgeText: { color: '#fff', fontSize: 12 },
  controls: { padding: 20, backgroundColor: '#1a1a1a' },
  btnStart: {
    backgroundColor: '#ff4757',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  btnStop: {
    backgroundColor: '#2f3542',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  btnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
});
