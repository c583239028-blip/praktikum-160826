import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { Colors, Spacing, BorderRadius, TextStyles } from '@/constants/design';
import PropTypes from 'prop-types';

export const RegisterButton = ({ icon: Icon, label, onPress }) => (
  <TouchableOpacity style={styles.button} onPress={onPress} activeOpacity={0.8}>
    <View style={styles.iconCircle}>
      <Icon width={24} height={24} />
    </View>
    <Text style={styles.label}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  button: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.neutral[300],
    backgroundColor: Colors.surface.white,
    paddingVertical: Spacing.sm,
    paddingLeft: 3,
    gap: Spacing.md,
    borderRadius: BorderRadius.lg,
  },

  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: {
    ...TextStyles.bodyLMedium,
    color: Colors.text.primary,
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
  },
});

RegisterButton.propTypes = {
  icon: PropTypes.elementType.isRequired,
  label: PropTypes.string.isRequired,
  onPress: PropTypes.func.isRequired,
};
