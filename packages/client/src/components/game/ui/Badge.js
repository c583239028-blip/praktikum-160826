import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import PropTypes from 'prop-types';
import { FontFamily } from '../../../../constants/design';

// NOTE: #ffa502 has no close match in constants/design.js
// (nearest token, warning.dark, is 66pt away in RGB distance) — kept as-is.
const Badge = ({ label, color = '#ffa502' }) => (
  <View
    style={[styles.wrap, { backgroundColor: color + '22', borderColor: color }]}
  >
    <Text style={[styles.text, { color }]}>{label}</Text>
  </View>
);

Badge.propTypes = {
  label: PropTypes.string.isRequired,
  color: PropTypes.string,
};

const styles = StyleSheet.create({
  wrap: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  text: {
    fontFamily: FontFamily.primary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});

export default Badge;
