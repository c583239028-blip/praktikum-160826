import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import PropTypes from 'prop-types';
import {
  Colors,
  Spacing,
  BorderRadius,
  TextStyles,
} from '../../../constants/design';

export function PublishButton({ label, onPress, variant = 'primary' }) {
  const isPrimary = variant === 'primary';
  return (
    <TouchableOpacity
      style={[styles.btn, isPrimary ? styles.primaryBtn : styles.secondaryBtn]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={[styles.btnText, !isPrimary && styles.secondaryBtnText]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

PublishButton.propTypes = {
  label: PropTypes.string.isRequired,
  onPress: PropTypes.func.isRequired,
  variant: PropTypes.oneOf(['primary', 'secondary']),
};

const styles = StyleSheet.create({
  btn: {
    width: '50%',
    height: 44, // no exact design token match - verify with designer
    borderRadius: BorderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: Spacing.md, // 8
    paddingHorizontal: Spacing.xl, // 16
  },
  primaryBtn: {
    backgroundColor: Colors.primary.default,
  },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: Colors.text.primary,
  },
  btnText: {
    ...TextStyles.bodyLMedium,
    color: Colors.text.primary,
  },
  secondaryBtnText: {
    color: Colors.text.primary,
  },
});
