import { View, Text, Image, StyleSheet } from 'react-native';
import { RTCView } from '@livekit/react-native-webrtc';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Colors,
  Spacing,
  BorderRadius,
  FontFamily,
  FontWeight,
  FontSize,
  LineHeight,
} from '@/constants/design';
import MicOffIcon from '@/assets/icons/mic-off.svg';
import GiftFilledIcon from '@/assets/icons/gift-filled.svg';
import PropTypes from 'prop-types';

export const VideoTile = ({
  stream,
  label,
  isMicOn,
  isCameraOff,
  profileUrl,
  isSelected,
  giftCount,
}) => (
  <View style={[styles.container, isSelected && styles.containerSelected]}>
    {isCameraOff ? (
      <View style={styles.avatarWrapper}>
        <Image
          source={
            typeof profileUrl === 'string' ? { uri: profileUrl } : profileUrl
          }
          style={styles.avatarImage}
        />
      </View>
    ) : stream ? (
      <RTCView
        streamURL={stream.toURL()}
        style={styles.backgroundImage}
        objectFit="cover"
      />
    ) : (
      <View style={styles.avatarWrapper} />
    )}

    <LinearGradient
      colors={['rgba(0,0,0,0)', 'rgba(0,0,0,1)']}
      locations={[0.7, 1]}
      style={styles.gradientOverlay}
      pointerEvents="none"
    />

    <View style={styles.giftCounter}>
      <Text style={styles.giftCountText}>{giftCount}</Text>
      <View style={styles.giftIconWrapper}>
        <GiftFilledIcon width={13.333} height={13.333} />
      </View>
    </View>

    <View style={styles.userBadgeWrapper}>
      {!isMicOn && (
        <View style={styles.micIconWrapper}>
          <MicOffIcon width={22} height={18} />
        </View>
      )}
      <View style={styles.nameLabel}>
        <Text style={styles.nameText}>{label}</Text>
      </View>
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  containerSelected: {
    borderColor: Colors.primary.default,
  },
  avatarWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.neutral[900],
  },
  avatarImage: {
    height: '40%',
    aspectRatio: 1,
    borderRadius: BorderRadius.full,
  },
  backgroundImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  gradientOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  giftCounter: {
    position: 'absolute',
    top: '3.01%',
    right: '4.55%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    padding: Spacing.sm,
    borderRadius: BorderRadius.xs,
    backgroundColor: Colors.neutral[900],
  },
  giftCountText: {
    fontFamily: FontFamily.primary,
    fontWeight: FontWeight.regular,
    fontSize: 10,
    lineHeight: 15,
    color: Colors.surface.white,
  },
  giftIconWrapper: {
    width: 16,
    height: 16,
    overflow: 'hidden',
    marginLeft: Spacing.sm,
  },
  userBadgeWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: '3.34%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: Spacing.none,
    paddingHorizontal: Spacing.md,
  },
  micIconWrapper: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
    overflow: 'hidden',
  },
  nameLabel: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.xs,
  },
  nameText: {
    fontFamily: FontFamily.primary,
    fontWeight: FontWeight.bold,
    fontSize: FontSize.bodyM,
    lineHeight: LineHeight.bodyM,
    color: Colors.surface.white,
    textAlign: 'right',
  },
});

VideoTile.propTypes = {
  stream: PropTypes.shape({ toURL: PropTypes.func.isRequired }),
  label: PropTypes.string.isRequired,
  isMicOn: PropTypes.bool.isRequired,
  isCameraOff: PropTypes.bool.isRequired,
  profileUrl: PropTypes.string.isRequired,
  isSelected: PropTypes.bool.isRequired,
  giftCount: PropTypes.oneOfType([PropTypes.string, PropTypes.number])
    .isRequired,
};
