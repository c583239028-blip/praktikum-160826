import { useRef, useEffect } from 'react';
import {
  View,
  Text,
  Animated,
  PanResponder,
  StyleSheet,
  Platform,
} from 'react-native';
import { RTCView } from '@livekit/react-native-webrtc';
import { LinearGradient } from 'expo-linear-gradient';
import { useSelector } from 'react-redux';
import {
  Colors,
  Spacing,
  BorderRadius,
  FontFamily,
  FontWeight,
} from '@/constants/design';
import MicOffIcon from '@/assets/icons/mic-off.svg';
import GiftFilledIcon from '@/assets/icons/gift-filled.svg';
import PropTypes from 'prop-types';

const TILE_WIDTH = 130;
const TILE_HEIGHT = 155;

const TILE_PLATFORM_STYLE = Platform.select({
  ios: {
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
  },
  android: {
    borderRadius: 0,
    elevation: 8,
    // Soft shadow to accompany the elevation (tint honored on API 28+).
    // No `overflow:'hidden'` here — on some Android versions it clips the
    // elevation shadow.
    shadowColor: Colors.neutral[900],
  },
});

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export const ModeratorPip = ({
  stream = null,
  isMute = false,
  initialPositionRatio = { x: 0, y: 0 },
  containerInsets = { top: 0, left: 0, right: 0, bottom: 0 },
}) => {
  // TODO: point this selector at your real gift slice/path.
  const giftCount = useSelector((state) => state.live?.giftCount ?? 0);

  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const offset = useRef({ x: 0, y: 0 }).current;
  const bounds = useRef({ width: 0, height: 0 }).current;

  const applyPositionFromRatio = () => {
    if (bounds.width === 0 || bounds.height === 0) return;
    const contentWidth = Math.max(
      0,
      bounds.width - containerInsets.left - containerInsets.right
    );
    const contentHeight = Math.max(
      0,
      bounds.height - containerInsets.top - containerInsets.bottom
    );
    const maxX = Math.max(0, bounds.width - TILE_WIDTH);
    const maxY = Math.max(0, bounds.height - TILE_HEIGHT);
    const nextX = clamp(
      containerInsets.left + initialPositionRatio.x * contentWidth,
      0,
      maxX
    );
    const nextY = clamp(
      containerInsets.top + initialPositionRatio.y * contentHeight,
      0,
      maxY
    );
    offset.x = nextX;
    offset.y = nextY;
    pan.setValue({ x: nextX, y: nextY });
  };

  useEffect(applyPositionFromRatio, [
    initialPositionRatio.x,
    initialPositionRatio.y,
  ]);

  const userHasMovedTile = useRef(false);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_evt, gesture) =>
        Math.abs(gesture.dx) > 2 || Math.abs(gesture.dy) > 2,
      onPanResponderMove: (_evt, gesture) => {
        const maxX = Math.max(0, bounds.width - TILE_WIDTH);
        const maxY = Math.max(0, bounds.height - TILE_HEIGHT);
        pan.setValue({
          x: clamp(offset.x + gesture.dx, 0, maxX),
          y: clamp(offset.y + gesture.dy, 0, maxY),
        });
      },
      onPanResponderRelease: (_evt, gesture) => {
        const maxX = Math.max(0, bounds.width - TILE_WIDTH);
        const maxY = Math.max(0, bounds.height - TILE_HEIGHT);
        offset.x = clamp(offset.x + gesture.dx, 0, maxX);
        offset.y = clamp(offset.y + gesture.dy, 0, maxY);
        userHasMovedTile.current = true;
      },
    })
  ).current;

  const handleBoundsLayout = (event) => {
    const { width, height, x, y } = event.nativeEvent.layout;
    bounds.width = width;
    bounds.height = height;
    if (!userHasMovedTile.current) {
      applyPositionFromRatio();
    } else {
      const maxX = Math.max(0, width - TILE_WIDTH);
      const maxY = Math.max(0, height - TILE_HEIGHT);
      offset.x = clamp(offset.x, 0, maxX);
      offset.y = clamp(offset.y, 0, maxY);
      pan.setValue({ x: offset.x, y: offset.y });
    }
  };

  return (
    <View
      style={styles.boundsLayer}
      pointerEvents="box-none"
      onLayout={handleBoundsLayout}
    >
      <Animated.View
        style={[styles.tile, { transform: pan.getTranslateTransform() }]}
        {...panResponder.panHandlers}
      >
        {stream ? (
          <RTCView
            streamURL={stream.toURL()}
            style={styles.stream}
            objectFit="cover"
            zOrder={1}
          />
        ) : (
          <View style={styles.streamPlaceholder} />
        )}

        <LinearGradient
          colors={['rgba(102,102,102,0)', 'rgba(0,0,0,0.8)']}
          locations={[0.59063, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.gradientOverlay}
          pointerEvents="none"
        />

        {isMute && (
          <View style={styles.muteIndicator} pointerEvents="none">
            <MicOffIcon width={22} height={18} />
          </View>
        )}

        <View style={styles.giftCounter} pointerEvents="none">
          <Text style={styles.giftCountText}>{giftCount}</Text>
          <GiftFilledIcon width={10} height={10} />
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  boundsLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999,
    elevation: 999,
  },
  tile: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: TILE_WIDTH,
    height: TILE_HEIGHT,
    borderWidth: 2,
    borderColor: Colors.neutral[100],
    backgroundColor: Colors.neutral[900],
    ...TILE_PLATFORM_STYLE,
  },
  stream: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  streamPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.neutral[900],
  },
  gradientOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  muteIndicator: {
    position: 'absolute',
    left: 9,
    bottom: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  giftCounter: {
    position: 'absolute',
    right: 10,
    bottom: 9,
    height: 19,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.xs,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  giftCountText: {
    fontFamily: FontFamily.primary,
    fontWeight: FontWeight.regular,
    fontSize: 10,
    lineHeight: 15,
    color: Colors.surface.white,
  },
});

ModeratorPip.propTypes = {
  stream: PropTypes.shape({ toURL: PropTypes.func.isRequired }),
  isMute: PropTypes.bool,
  initialPositionRatio: PropTypes.shape({
    x: PropTypes.number,
    y: PropTypes.number,
  }),
  containerInsets: PropTypes.shape({
    top: PropTypes.number,
    left: PropTypes.number,
    right: PropTypes.number,
    bottom: PropTypes.number,
  }),
};
