import { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Dimensions } from 'react-native';
import { Colors, BorderRadius, Spacing } from '../../constants/design';
import { hexToRgba } from '../utils/colorUtils';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_COUNT = 4;
const SHIMMER_DURATION_MS = 1200;
const THUMBNAIL_HEIGHT = 180;
const BADGE_WIDTH = 36;
const BADGE_HEIGHT = 20;
const TITLE_LINE_WIDTH = '75%';
const HOST_LINE_WIDTH = '45%';
const VIEWERS_LINE_WIDTH = '30%';
const TITLE_LINE_HEIGHT = 20;
const META_LINE_HEIGHT = 16;
const VIEWERS_LINE_MARGIN_TOP = 2;
const SHIMMER_COLOR = hexToRgba(Colors.surface.white, 0.07);

function ShimmerCard({ shimmerAnim }) {
  const translateX = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-SCREEN_WIDTH, SCREEN_WIDTH],
  });

  const shimmerOverlay = (
    <Animated.View
      style={[
        StyleSheet.absoluteFillObject,
        styles.shimmer,
        { transform: [{ translateX }] },
      ]}
    />
  );

  return (
    <View style={styles.card}>
      <View style={styles.thumbnail}>{shimmerOverlay}</View>
      <View style={styles.liveBadge}>{shimmerOverlay}</View>
      <View style={styles.info}>
        <View style={styles.titleLine}>{shimmerOverlay}</View>
        <View style={styles.hostLine}>{shimmerOverlay}</View>
        <View style={styles.viewersLine}>{shimmerOverlay}</View>
      </View>
    </View>
  );
}

export default function StreamCardSkeleton() {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: SHIMMER_DURATION_MS,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [shimmerAnim]);

  return (
    <View style={styles.container}>
      {Array.from({ length: CARD_COUNT }).map((_, i) => (
        <ShimmerCard key={i} shimmerAnim={shimmerAnim} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: Spacing.lg },
  card: {
    backgroundColor: Colors.neutral[900],
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.lg,
    overflow: 'hidden',
  },
  thumbnail: {
    width: '100%',
    height: THUMBNAIL_HEIGHT,
    backgroundColor: Colors.neutral[600],
    overflow: 'hidden',
  },
  liveBadge: {
    position: 'absolute',
    top: Spacing.md,
    left: Spacing.md,
    width: BADGE_WIDTH,
    height: BADGE_HEIGHT,
    borderRadius: BorderRadius.xs,
    backgroundColor: Colors.neutral[600],
    overflow: 'hidden',
  },
  info: { padding: Spacing.lg },
  titleLine: {
    width: TITLE_LINE_WIDTH,
    height: TITLE_LINE_HEIGHT,
    borderRadius: BorderRadius.xs,
    backgroundColor: Colors.neutral[600],
    marginBottom: Spacing.sm,
    overflow: 'hidden',
  },
  hostLine: {
    width: HOST_LINE_WIDTH,
    height: META_LINE_HEIGHT,
    borderRadius: BorderRadius.xs,
    backgroundColor: Colors.neutral[600],
    marginTop: Spacing.sm,
    overflow: 'hidden',
  },
  viewersLine: {
    width: VIEWERS_LINE_WIDTH,
    height: META_LINE_HEIGHT,
    borderRadius: BorderRadius.xs,
    backgroundColor: Colors.neutral[600],
    marginTop: VIEWERS_LINE_MARGIN_TOP,
    overflow: 'hidden',
  },
  shimmer: {
    backgroundColor: SHIMMER_COLOR,
  },
});
