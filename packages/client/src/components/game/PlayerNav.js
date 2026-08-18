import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Spacing, BorderRadius } from '@/constants/design';
import PropTypes from 'prop-types';

export const PlayerNav = ({ icons }) => (
  <View style={styles.playerNav}>
    {icons.map((item) => (
      <TouchableOpacity
        key={item.id}
        style={styles.playerNavButton}
        onPress={item.onPress}
        activeOpacity={0.8}
      >
        <View style={styles.playerNavIconWrapper}>
          <item.icon width={24} height={24} />
        </View>
      </TouchableOpacity>
    ))}
  </View>
);

const styles = StyleSheet.create({
  playerNav: {
    position: 'absolute',
    bottom: 22,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.lg,
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  playerNavButton: {
    width: 62,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  playerNavIconWrapper: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

PlayerNav.propTypes = {
  icons: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
      icon: PropTypes.elementType.isRequired,
      onPress: PropTypes.func,
    })
  ).isRequired,
};
