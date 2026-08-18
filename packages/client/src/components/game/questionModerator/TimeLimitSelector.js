import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import PropTypes from 'prop-types';
import { Colors, BorderRadius, FontFamily } from '../../../../constants/design';

/**
 * TimeLimitSelector
 * Fixed-choice chip selector for a question's response time limit.
 * Replaces the old +/- stepper. Values come from an external list (prop),
 * not hardcoded here, so it can be reused with different option sets later.
 *
 * Props:
 *   options   — number[]           e.g. [60, 45, 30, 15]
 *   value     — number             currently selected value
 *   onChange  — (seconds: number) => void
 *   unitLabel — string (optional)  single shared unit tag shown once, e.g. "שניות"
 */
export function TimeLimitSelector({ options, value, onChange, unitLabel }) {
  return (
    <View style={styles.wrapper}>
      <View style={styles.chipsRow}>
        {options.map((opt) => {
          const selected = opt === value;
          return (
            <TouchableOpacity
              key={opt}
              style={[styles.chip, selected && styles.chipSelected]}
              onPress={() => onChange(opt)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityState={{ selected }}
            >
              <Text
                style={[styles.chipText, selected && styles.chipTextSelected]}
              >
                {opt}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {unitLabel ? <Text style={styles.unitLabel}>{unitLabel}</Text> : null}
    </View>
  );
}

TimeLimitSelector.propTypes = {
  options: PropTypes.arrayOf(PropTypes.number).isRequired,
  value: PropTypes.number.isRequired,
  onChange: PropTypes.func.isRequired,
  unitLabel: PropTypes.string,
};

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'flex-end',
    gap: 4,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  // Same footprint as the old +/- buttons (32x32 circle) so the row size doesn't change.
  chip: {
    minWidth: 32,
    height: 32,
    paddingHorizontal: 10,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.neutral[300],
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipSelected: {
    borderColor: Colors.primary.default,
    backgroundColor: Colors.primary.default,
  },
  chipText: {
    fontFamily: FontFamily.primary,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  chipTextSelected: {
    color: Colors.surface.white,
  },
  unitLabel: {
    fontFamily: FontFamily.primary,
    fontSize: 10,
    fontWeight: '400',
    color: Colors.text.secondary,
  },
});
