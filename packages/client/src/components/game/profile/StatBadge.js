import React from 'react';
import PropTypes from 'prop-types';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Spacing, BorderRadius, TextStyles } from '../../../../constants/design';

export default function StatBadge({ value, label }) {
  return (
    <View style={styles.container}>
      <Text style={styles.value} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

StatBadge.propTypes = {
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  label: PropTypes.string.isRequired,
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.neutral[100],
    borderRadius: BorderRadius.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  value: {
    ...TextStyles.bodyMMedium,
    color: Colors.text.primary,
  },
  label: {
    ...TextStyles.captionRegular,
    color: Colors.text.secondary,
  },
});
