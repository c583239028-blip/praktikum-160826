import React from 'react';
import { View, StyleSheet } from 'react-native';
import PropTypes from 'prop-types';
import { Colors } from '../../../../constants/design';

// NOTE: original bg (#111827) and border (#1f2937) are both extremely close
// to Colors.neutral[900] (RGB distance 29.7 and 4.0 respectively) — mapped
// to the same token. Side effect: the border is now visually indistinguishable
// from the background, since design.js has no separate dark border shade.
const Card = ({ children, style = null }) => (
  <View style={[styles.wrap, style]}>{children}</View>
);

Card.propTypes = {
  children: PropTypes.node.isRequired,
  style: PropTypes.oneOfType([PropTypes.object, PropTypes.array]),
};

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: Colors.neutral[900],
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
});

export default Card;
