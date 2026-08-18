import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import {
  Colors,
  Spacing,
  BorderRadius,
  TextStyles,
} from '../../../../constants/design';

export function DialogButton({ label, onPress, variant = 'primary' }) {
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

const styles = StyleSheet.create({
  btn: {
    width: '100%',
    height: 44,
    borderRadius: BorderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
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
