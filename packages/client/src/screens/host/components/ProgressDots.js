import { View, StyleSheet } from 'react-native';
import PropTypes from 'prop-types';
import { Colors, Spacing } from '@/constants/design';

// Row of wizard progress dots (Figma: ● ● ○ ○ …). `total` is the dot count —
// take it from the Figma frame, don't invent it. `current` = 0-based active
// step. `onDark` switches the inactive-dot color for the gradient step.
export function ProgressDots({ total, current, onDark = false }) {
  return (
    <View style={styles.row}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            i === current
              ? styles.active
              : onDark
                ? styles.inactiveOnDark
                : styles.inactive,
          ]}
        />
      ))}
    </View>
  );
}

ProgressDots.propTypes = {
  total: PropTypes.number.isRequired,
  current: PropTypes.number.isRequired,
  onDark: PropTypes.bool,
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  active: { backgroundColor: Colors.primary.default },
  inactive: { backgroundColor: Colors.neutral[200] },
  inactiveOnDark: { backgroundColor: 'rgba(255,255,255,0.5)' },
});
