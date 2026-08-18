import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Button, ScrollView } from 'react-native';
import { socket, emitPromise } from '../services/socket.service';
import { MediasoupManager } from '../services/MediasoupManager';
import { SOCKET_EVENTS } from '@worldplay/shared';

function PlayerTestScreen() {
  const [status, setStatus] = useState('Waiting...');
  const [remoteStreams, setRemoteStreams] = useState([]);
  const streamId = 'live_game_test_123';

  useEffect(() => {
    const handleNewProducer = async ({ producerId, role }) => {
      handleConsume(producerId, role);
    };

    socket.on(SOCKET_EVENTS.STREAM.NEW_PRODUCER, handleNewProducer);
    return () =>
      socket.off(SOCKET_EVENTS.STREAM.NEW_PRODUCER, handleNewProducer);
  }, []);

  const handleJoinAndStream = async () => {
    try {
      setStatus('Connecting...');
      const data = await emitPromise(SOCKET_EVENTS.STREAM.JOIN, {
        streamId,
        role: 'PLAYER',
      });
      await MediasoupManager.initDevice(data.rtpCapabilities);

      if (data.currentProducers) {
        for (const p of data.currentProducers) {
          await handleConsume(p.producerId, p.role);
        }
      }
      setStatus('Broadcasting and watching!');
    } catch (err) {
      setStatus('Error: ' + err.message);
    }
  };

  const handleConsume = async (producerId, role) => {
    try {
      const recvTransport = await MediasoupManager.createTransport(
        socket,
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
      // MediaStream is not available natively without the webrtc import — storing the track for now
      setRemoteStreams((prev) => [...prev, { id: consumer.id, role }]);
      await emitPromise(SOCKET_EVENTS.STREAM.RESUME, {
        consumerId: consumer.id,
        streamId,
      });
    } catch (e) {
      console.error('Consume failed', e);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.status}>{status}</Text>

      <Text style={styles.label}>You (player):</Text>
      <View style={styles.localVideoBox}>
        <Text style={{ color: '#fff', textAlign: 'center', paddingTop: 50 }}>
          WebRTC Disabled
        </Text>
      </View>

      <Text style={styles.label}>Host broadcast:</Text>
      <ScrollView horizontal style={styles.remoteList}>
        {remoteStreams.map((item) => (
          <View key={item.id} style={styles.remoteVideoBox}>
            <Text
              style={{ color: '#fff', textAlign: 'center', paddingTop: 50 }}
            >
              WebRTC Disabled
            </Text>
            <Text style={styles.roleTag}>{item.role}</Text>
          </View>
        ))}
      </ScrollView>

      <Button title="Join game" onPress={handleJoinAndStream} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a1a', padding: 15 },
  status: { color: '#ffa502', marginBottom: 10 },
  label: { color: '#fff', marginTop: 10 },
  localVideoBox: { width: 120, height: 160, backgroundColor: '#000' },
  remoteVideoBox: {
    width: 280,
    height: 180,
    backgroundColor: '#000',
    marginRight: 10,
  },
  video: { width: '100%', height: '100%' },
  remoteList: { marginTop: 10 },
  roleTag: {
    position: 'absolute',
    bottom: 5,
    left: 5,
    color: '#fff',
    backgroundColor: 'red',
    padding: 2,
  },
});

export default function Page() {
  return <PlayerTestScreen />;
}
