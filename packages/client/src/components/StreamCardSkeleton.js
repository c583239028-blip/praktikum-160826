import { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Dimensions } from 'react-native';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_COUNT = 4;

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
        duration: 1200,
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
  container: { padding: 12 },
  card: {
    backgroundColor: '#1f2937',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
  thumbnail: {
    width: '100%',
    height: 180,
    backgroundColor: '#374151',
    overflow: 'hidden',
  },
  liveBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 36,
    height: 20,
    borderRadius: 4,
    backgroundColor: '#374151',
    overflow: 'hidden',
  },
  info: { padding: 12 },
  titleLine: {
    width: '75%',
    height: 20,
    borderRadius: 4,
    backgroundColor: '#374151',
    marginBottom: 4,
    overflow: 'hidden',
  },
  hostLine: {
    width: '45%',
    height: 16,
    borderRadius: 4,
    backgroundColor: '#374151',
    marginTop: 4,
    overflow: 'hidden',
  },
  viewersLine: {
    width: '30%',
    height: 16,
    borderRadius: 4,
    backgroundColor: '#374151',
    marginTop: 2,
    overflow: 'hidden',
  },
  shimmer: {
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
});
