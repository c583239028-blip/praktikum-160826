import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useSelector } from 'react-redux';
import { HostFlow } from '../screens/host/HostFlow';
import PlayerScreen from '../screens/PlayerScreen';
import ViewerScreen from '../screens/ViewerScreen';
import ModeratorScreen from './moderator';

export default function GameScreen() {
  const gameStream = useSelector((state) => state.gameStream);

  if (!gameStream || !gameStream.role) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  const { role, gameType } = gameStream;
  return (
    <View style={styles.container}>
      {role === 'HOST' ? (
        <HostFlow />
      ) : role === 'PLAYER' ? (
        <PlayerScreen gameType={gameType} />
      ) : role === 'MODERATOR' ? (
        <ModeratorScreen />
      ) : (
        <ViewerScreen />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a1a' },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
