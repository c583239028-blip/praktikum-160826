import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import PropTypes from 'prop-types';
import {
  Colors,
  Spacing,
  BorderRadius,
  TextStyles,
} from '../../../../constants/design';

/**
 * AnswerOption
 * Answer row with radio button — decorative only (not interactive).
 */
export function AnswerOption({ text, selected }) {
  return (
    <View style={[styles.row, selected && styles.rowSelected]}>
      <View style={[styles.radio, selected && styles.radioSelected]}>
        {selected && <View style={styles.radioDot} />}
      </View>
      <Text style={styles.answerText}>{text}</Text>
    </View>
  );
}

AnswerOption.propTypes = {
  text: PropTypes.string.isRequired,
  selected: PropTypes.bool,
};

AnswerOption.defaultProps = {
  selected: false,
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.neutral[200],
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    backgroundColor: Colors.surface.white,
    minHeight: 50, // no exact design token match - verify with designer
  },
  rowSelected: {
    borderColor: Colors.primary.default,
    backgroundColor: Colors.primary.extraLight,
  },

  // ── Radio ──────────────────────────────────────────────────────────────
  radio: {
    width: 24, // no exact design token match - verify with designer
    height: 24,
    borderRadius: BorderRadius.full,
    borderWidth: 2,
    borderColor: Colors.neutral[300],
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.surface.white,
  },
  radioSelected: {
    borderColor: Colors.primary.default,
    backgroundColor: Colors.primary.default,
  },
  radioDot: {
    width: Spacing.md + 2, // 10, no exact token match
    height: Spacing.md + 2,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surface.white,
  },

  // ── Text ───────────────────────────────────────────────────────────────
  answerText: {
    ...TextStyles.bodyMRegular,
    color: Colors.text.primary,
    flex: 1,
  },
});
