import React from 'react';
import {
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import PropTypes from 'prop-types';
import { Colors, FontFamily } from '../../../../constants/design';

// NOTE: default color (#ffa502) and disabled bg (#374151) have no close
// design.js token (dist 66.4 and 40.4) — kept as hex. Disabled text
// (#6b7280→text.secondary, dist 26.0) is a real match — mapped. Enabled
// text/loading indicator (#000) has no dark/black token at all — kept as hex.
const Btn = ({ label, onPress, color = '#ffa502', disabled, loading }) => (
  <TouchableOpacity
    style={[
      styles.wrap,
      { backgroundColor: disabled || loading ? '#374151' : color },
    ]}
    onPress={onPress}
    disabled={disabled || loading}
    activeOpacity={0.8}
  >
    {loading ? (
      <ActivityIndicator color="#000" size="small" />
    ) : (
      <Text
        style={[
          styles.text,
          { color: disabled ? Colors.text.secondary : '#000' },
        ]}
      >
        {label}
      </Text>
    )}
  </TouchableOpacity>
);

Btn.propTypes = {
  label: PropTypes.string.isRequired,
  onPress: PropTypes.func.isRequired,
  color: PropTypes.string,
  disabled: PropTypes.bool,
  loading: PropTypes.bool,
};

const styles = StyleSheet.create({
  wrap: { borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 4 },
  text: {
    fontFamily: FontFamily.primary,
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 0.5,
  },
});

export default Btn;
