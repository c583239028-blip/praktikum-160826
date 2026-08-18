import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import PropTypes from 'prop-types';
import { Colors, FontFamily } from '../../../../constants/design';

// Shared text field. `variant` themes it: 'dark' (default) is the in-game look
// (dark input on dark surfaces) — UNCHANGED from the extraction; 'light' is the
// create-game wizard look (light surface, cyan pill border). `label` is optional
// — omit it for a bare input (the wizard uses the screen title as the heading).
//
// Original dark token notes: label (#9ca3af→text.tertiary), input bg
// (#1f2937→neutral[900]), input text (#f9fafb→surface.white), placeholder
// (#4b5563→neutral[600]); input border (#374151) has no close token — kept hex.
const Field = ({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  variant = 'dark',
  autoFocus = false,
}) => {
  const themed = variant === 'light' ? light : dark;
  return (
    <View style={styles.container}>
      {label ? <Text style={[styles.label, themed.label]}>{label}</Text> : null}
      <TextInput
        style={[styles.input, themed.input]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={
          variant === 'light' ? Colors.text.tertiary : Colors.neutral[600]
        }
        keyboardType={keyboardType}
        autoCapitalize="none"
        autoFocus={autoFocus}
      />
    </View>
  );
};

Field.propTypes = {
  label: PropTypes.string,
  value: PropTypes.string.isRequired,
  onChangeText: PropTypes.func.isRequired,
  placeholder: PropTypes.string,
  keyboardType: PropTypes.string,
  variant: PropTypes.oneOf(['light', 'dark']),
  autoFocus: PropTypes.bool,
};

// Shared (theme-agnostic) bits.
const styles = StyleSheet.create({
  container: { marginBottom: 12 },
  label: {
    fontFamily: FontFamily.primary,
    fontSize: 12,
    marginBottom: 5,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  input: {
    fontFamily: FontFamily.primary,
    fontSize: 14,
  },
});

// Dark (default) — byte-for-byte the previous hardcoded look.
const dark = StyleSheet.create({
  label: { color: Colors.text.tertiary },
  input: {
    backgroundColor: Colors.neutral[900],
    color: Colors.surface.white,
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 10,
    padding: 12,
  },
});

// Light — create-game wizard: cyan pill border on a light surface.
const light = StyleSheet.create({
  label: { color: Colors.text.secondary },
  input: {
    backgroundColor: Colors.surface.white,
    color: Colors.text.primary,
    borderWidth: 1.5,
    borderColor: Colors.primary.default,
    borderRadius: 24,
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
});

export default Field;
