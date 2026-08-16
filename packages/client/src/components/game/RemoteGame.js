import { View, StyleSheet } from 'react-native';
import PropTypes from 'prop-types';
import { Colors, Spacing, BorderRadius } from '@/constants/design';
import { LiveIndicator } from '../game/LiveIndicator';
import { StreamLayout } from './StreamLayout';
import { PlayerNav } from './PlayerNav';
import { ModeratorPip } from './ModeratorPip';
import PowerIcon from '@/assets/icons/power.svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const MODERATOR_PIP_POSITION_RATIOS = {
  1: { x: 21 / 375, y: 36 / 812 },
  2: { x: 240 / 375, y: 288 / 812 },
  3: { x: 5 / 375, y: 16 / 812 },
  4: { x: 120 / 375, y: 376 / 812 },
};

const getModeratorPipPositionRatio = (viewerStreamCount) =>
  MODERATOR_PIP_POSITION_RATIOS[viewerStreamCount] ??
  MODERATOR_PIP_POSITION_RATIOS[4];

const STREAMS_AREA_INSETS = {
  top: 0,
  left: Spacing.sm,
  right: Spacing.sm,
  bottom: 0,
};

export const RemoteGame = ({
  isLive,
  streamTitle,
  viewerCount,
  giftCount,
  onPowerPress,
  streams,
  icons,
}) => {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <LiveIndicator
          isLive={isLive}
          streamTitle={streamTitle}
          viewerCount={viewerCount}
          giftCount={giftCount}
          powerIcon={PowerIcon}
          onPowerPress={onPowerPress}
        />
      </View>

      <View style={styles.streamsArea}>
        <StreamLayout streams={streams} />
        <ModeratorPip
          initialPositionRatio={getModeratorPipPositionRatio(streams.length)}
          containerInsets={STREAMS_AREA_INSETS}
        />
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
  header: {
    paddingHorizontal: Spacing.lg,
    zIndex: 2,
  },
  streamsArea: {
    flex: 1,
    minHeight: 0,
    paddingTop: Spacing.lg,
    paddingHorizontal: Spacing.sm,
    paddingBottom: 80,
    overflow: 'hidden',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.lg,
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
    zIndex: 2,
  },
});

RemoteGame.propTypes = {
  isLive: PropTypes.bool,
  streamTitle: PropTypes.string,
  viewerCount: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  giftCount: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onPowerPress: PropTypes.func,
  streams: PropTypes.arrayOf(
    PropTypes.shape({
      stream: PropTypes.any,
      label: PropTypes.string,
      giftCount: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      isCameraOff: PropTypes.bool,
      isMicOn: PropTypes.bool,
      isSelected: PropTypes.bool,
      profileUrl: PropTypes.any,
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

RemoteGame.defaultProps = {
  isLive: true,
  onPowerPress: () => {},
};
