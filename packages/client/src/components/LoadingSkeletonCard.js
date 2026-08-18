import { View, StyleSheet } from 'react-native';
import { Colors, Spacing } from '../../constants/design';

export default function LoadingSkeletonCard() {
  return (
    <View>
      <View style={styles.card}>
        <View style={styles.thumbnail} />
        <View style={styles.title} />
        <View style={styles.host} />
      </View>
      <View style={styles.card}>
        <View style={styles.thumbnail} />
        <View style={styles.title} />
        <View style={styles.host} />
      </View>
      <View style={styles.card}>
        <View style={styles.thumbnail} />
        <View style={styles.title} />
        <View style={styles.host} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface.white,
    marginBottom: Spacing.xl,
  },
  thumbnail: {
    width: '100%',
    height: 180,
    backgroundColor: Colors.neutral[300],
    marginBottom: Spacing.lg,
  },
  title: {
    width: '80%',
    height: 30,
    backgroundColor: Colors.neutral[300],
    marginBottom: Spacing.md,
  },
  host: {
    width: '45%',
    height: 30,
    backgroundColor: Colors.neutral[300],
    marginBottom: Spacing.md,
  },
});
