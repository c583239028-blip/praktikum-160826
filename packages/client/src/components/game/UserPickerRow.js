import { Text, TouchableOpacity, StyleSheet } from 'react-native';
import PropTypes from 'prop-types';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from './Avatar';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/design';

// A single selectable person row (Figma: host / player invitation lists).
// Avatar is a placeholder for now (real profile photos come from the API later).
export function UserPickerRow({ name, uri, selected = false, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.row, selected && styles.rowSelected]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Avatar uri={uri} size={36} />
      <Text style={styles.name}>{name}</Text>
      {selected ? (
        <Ionicons
          name="checkmark-circle"
          size={22}
          color={Colors.primary.dark}
        />
      ) : null}
    </TouchableOpacity>
  );
}

UserPickerRow.propTypes = {
  name: PropTypes.string.isRequired,
  uri: PropTypes.string,
  selected: PropTypes.bool,
  onPress: PropTypes.func.isRequired,
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.sm,
  },
  rowSelected: { backgroundColor: Colors.neutral[100] },
  name: {
    flex: 1,
    color: Colors.text.primary,
    fontSize: FontSize.bodyL,
  },
});
