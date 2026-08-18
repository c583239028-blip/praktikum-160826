import React from 'react';
import PropTypes from 'prop-types';
import { Image, StyleSheet } from 'react-native';
import { Colors, BorderRadius } from '../../../../constants/design';

export default function Avatar({ uri, size, borderWidth, style }) {
  return (
    <Image
      source={{ uri }}
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: BorderRadius.full,
          borderWidth,
        },
        style,
      ]}
    />
  );
}

Avatar.propTypes = {
  uri: PropTypes.string.isRequired,
  size: PropTypes.number,
  borderWidth: PropTypes.number,
  // eslint-disable-next-line react/forbid-prop-types
  style: PropTypes.oneOfType([PropTypes.object, PropTypes.array]),
};

Avatar.defaultProps = {
  size: 96,
  borderWidth: 3,
  style: null,
};

const styles = StyleSheet.create({
  avatar: {
    borderColor: Colors.surface.white,
    backgroundColor: Colors.neutral[200],
  },
});
