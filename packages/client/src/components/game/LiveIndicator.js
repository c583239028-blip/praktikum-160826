import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors, Spacing, BorderRadius, TextStyles } from '@/constants/design';
import PropTypes from 'prop-types';
import EyeIcon from '@/assets/icons/eye.svg';
import GiftIcon from '@/assets/icons/gift.svg';

export const LiveIndicator = ({
  isLive,
  streamTitle,
  viewerCount,
  giftCount,
  powerIcon: PowerIcon,
  onPowerPress,
}) => (
  <View style={styles.headerBar}>
    <View style={styles.headerLeft}>
      <View
        style={[
          styles.liveBadgeDot,
          {
            backgroundColor: isLive
              ? Colors.liveIndicator.live
              : Colors.liveIndicator.pause,
          },
        ]}
      />
      <Text style={styles.streamTitle}>{streamTitle}</Text>
    </View>
    <View style={styles.headerRight}>
      <View style={styles.viewerTag}>
        <Text style={styles.viewerTagText}>{viewerCount}</Text>
        <EyeIcon width={16} height={16} />
      </View>
      <View style={styles.giftTag}>
        <Text style={styles.giftTagText}>{giftCount}</Text>
        <GiftIcon width={16} height={16} />
      </View>
      <TouchableOpacity
        style={styles.powerButton}
        onPress={onPowerPress}
        activeOpacity={0.8}
      >
        <PowerIcon width={18} height={20} />
      </TouchableOpacity>
    </View>
  </View>
);

const styles = StyleSheet.create({
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  liveBadgeDot: {
    width: 8,
    height: 8,
    borderRadius: BorderRadius.full,
  },
  streamTitle: {
    ...TextStyles.subtitleM,
    color: Colors.surface.white,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  viewerTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: 32,
  },
  viewerTagText: {
    ...TextStyles.captionRegular,
    color: Colors.surface.white,
  },
  giftTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: 'rgba(179,0,255,0.3)',
    borderWidth: 1,
    borderColor: Colors.secondary.default,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: 32,
  },
  giftTagText: {
    ...TextStyles.captionMedium,
    color: Colors.surface.white,
  },
  powerButton: {
    width: 24,
    height: 24,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
});

LiveIndicator.propTypes = {
  isLive: PropTypes.bool.isRequired,
  streamTitle: PropTypes.string.isRequired,
  viewerCount: PropTypes.oneOfType([PropTypes.string, PropTypes.number])
    .isRequired,
  giftCount: PropTypes.oneOfType([PropTypes.string, PropTypes.number])
    .isRequired,
  powerIcon: PropTypes.elementType.isRequired,
  onPowerPress: PropTypes.func,
};
