// packages/client/src/components/game/WinLossAnimation.js
import { View, StyleSheet, Dimensions, ActivityIndicator } from 'react-native';
import PropTypes from 'prop-types';
import { VideoView } from 'expo-video';
import { Colors } from '../../../constants/design';
import { useWinLossPlayer } from '../../hooks/useWinLossPlayer';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

const BOX_HEIGHT_RATIO = 0.6; // 60% מגובה המסך, לפי דרישת האפיון
const OVERLAY_Z_INDEX = 50;

export function WinLossAnimation({ type, onFinish = null }) {
  const { player, status } = useWinLossPlayer(type, onFinish);

  return (
    <View style={styles.box}>
      {status === 'loading' && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={Colors.primary.default} />
        </View>
      )}
      {status !== 'error' && (
        <VideoView
          player={player}
          style={styles.video}
          contentFit="cover"
          nativeControls={false}
        />
      )}
    </View>
  );
}

WinLossAnimation.propTypes = {
  type: PropTypes.oneOf(['win', 'lose']).isRequired,
  onFinish: PropTypes.func,
};

const styles = StyleSheet.create({
  box: {
    position: 'absolute',
    bottom: 0,
    width: SCREEN_W,
    height: SCREEN_H * BOX_HEIGHT_RATIO,
    overflow: 'hidden',
    backgroundColor: Colors.neutral[900],
    zIndex: OVERLAY_Z_INDEX,
  },
  video: { width: '100%', height: '100%' },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
});
