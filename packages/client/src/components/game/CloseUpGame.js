import { View, StyleSheet } from 'react-native';
import { RTCView } from 'react-native-webrtc';
import { LinearGradient } from 'expo-linear-gradient';
import PropTypes from 'prop-types';
import { Colors, Spacing, BorderRadius } from '@/constants/design';
import { LiveIndicator } from '../game/LiveIndicator';
import { AvatarsRow } from './AvatarsRow';
import { PlayerNav } from './PlayerNav';
import PowerIcon from '@/assets/icons/power.svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const CloseUpGame = ({
  isLive,
  streamTitle,
  viewerCount,
  giftCount,
  onPowerPress,
  mainStream,
  players,
  icons,
}) => {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <RTCView
        streamURL={mainStream?.toURL?.()}
        style={StyleSheet.absoluteFill}
        objectFit="cover"
      />

      <LinearGradient
        colors={['rgba(0,0,0,0.6)', 'rgba(0,0,0,0)']}
        style={styles.headerGradient}
        pointerEvents="none"
      />

      <View style={[styles.header, { top: insets.top }]}>
        <LiveIndicator
          isLive={isLive}
          streamTitle={streamTitle}
          viewerCount={viewerCount}
          giftCount={giftCount}
          powerIcon={PowerIcon}
          onPowerPress={onPowerPress}
        />
        <View style={styles.avatarsRow}>
          <AvatarsRow players={players} />
        </View>
      </View>

      <View style={styles.footer}>
        <PlayerNav icons={icons} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface.dark ?? '#020917',
  },
  headerGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 160,
    zIndex: 1,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: 'transparent',
    paddingHorizontal: Spacing.lg,
    zIndex: 2,
  },
  avatarsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    backgroundColor: 'transparent',
    marginTop: Spacing.md,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.lg,
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    zIndex: 2,
  },
});

CloseUpGame.propTypes = {
  isLive: PropTypes.bool,
  streamTitle: PropTypes.string,
  viewerCount: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  giftCount: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onPowerPress: PropTypes.func,
  mainStream: PropTypes.object.isRequired,
  players: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
      username: PropTypes.string,
      avatarUrl: PropTypes.string.isRequired,
      giftCount: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    })
  ).isRequired,
  icons: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      icon: PropTypes.elementType.isRequired,
      onPress: PropTypes.func,
    })
  ).isRequired,
};

CloseUpGame.defaultProps = {
  isLive: true,
  onPowerPress: () => {},
};
