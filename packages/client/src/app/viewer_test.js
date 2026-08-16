import { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet } from 'react-native';
import { RTCView } from '@livekit/react-native-webrtc';
import {
  getMediaSocket,
  connectMediaSocket,
  emitMediaPromise,
  connectAppSocket,
  emitPromise,
} from '../services/socket.service';
import { MediasoupManager } from '../services/MediasoupManager';
import { SOCKET_EVENTS } from '@worldplay/shared';

export default function ViewerTestScreen() {
  const [streamId, setStreamId] = useState('');
  const [remoteStream, setRemoteStream] = useState(null);
  const [status, setStatus] = useState('Enter a Stream ID to watch');

  const startWatching = async () => {
    try {
      setStatus('Joining stream...');

      const { rtpCapabilities, producerIds, gameId } = await emitMediaPromise(
        SOCKET_EVENTS.STREAM.JOIN,
        { streamId }
      );

      if (!producerIds || producerIds.length === 0) {
        setStatus('Stream has not started yet or has no video');
        return;
      }

      // Register viewer in DB via app server
      if (gameId) {
        try {
          await connectAppSocket();
          await emitPromise(SOCKET_EVENTS.GAME.JOIN, {
            gameId,
            role: 'VIEWER',
          });
        } catch (e) {
          console.warn('Viewer DB registration failed:', e.message);
        }
      }

      setStatus('Loading WebRTC device...');
      await MediasoupManager.initDevice(rtpCapabilities);

      setStatus('Creating transport...');
      await connectMediaSocket();
      const transport = await MediasoupManager.createTransport(
        getMediaSocket(),
        'recv',
        streamId
      );

      const { MediaStream } = require('@livekit/react-native-webrtc');
      const tracks = [];

      for (const producerId of producerIds) {
        setStatus('Receiving video...');
        const consumerData = await emitMediaPromise(
          SOCKET_EVENTS.STREAM.CONSUME,
          {
            streamId,
            transportId: transport.id,
            producerId,
            rtpCapabilities: MediasoupManager.getRtpCapabilities(),
          }
        );

        const consumer = await transport.consume({
          id: consumerData.id,
          producerId: consumerData.producerId,
          kind: consumerData.kind,
          rtpParameters: consumerData.rtpParameters,
        });

        tracks.push(consumer.track);
      }

      const stream = new MediaStream(tracks);
      setRemoteStream(stream);
      setStatus('Watching live stream');
    } catch (err) {
      setStatus('Error: ' + err.message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.status}>{status}</Text>

      {!remoteStream ? (
        <>
          <TextInput
            style={styles.input}
            placeholder="Paste Stream ID here"
            placeholderTextColor="#888"
            value={streamId}
            onChangeText={setStreamId}
          />
          <Button
            title="Start watching"
            onPress={startWatching}
            color="#2ed573"
          />
        </>
      ) : (
        <View style={styles.videoBox}>
          <RTCView
            streamURL={remoteStream.toURL()}
            style={styles.video}
            objectFit="cover"
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', padding: 20 },
  status: {
    color: '#fff',
    textAlign: 'center',
    marginBottom: 20,
    fontSize: 16,
  },
  input: {
    backgroundColor: '#222',
    color: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    fontSize: 14,
  },
  videoBox: { width: '100%', aspectRatio: 16 / 9 },
  video: { width: '100%', height: '100%' },
});
