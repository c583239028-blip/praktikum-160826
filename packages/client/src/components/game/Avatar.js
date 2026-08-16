import { View, Image, StyleSheet } from 'react-native';
import { Colors, BorderRadius } from '@/constants/design';
import PropTypes from 'prop-types';

export const Avatar = ({ source }) => (
  <View style={styles.avatar}>
    <Image source={source} style={styles.image} />
  </View>
);

const styles = StyleSheet.create({
  avatar: {
    width: 50,
    height: 50,
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
    backgroundColor: Colors.neutral[300],
  },
  image: {
    width: 50,
    height: 50,
    borderRadius: BorderRadius.full,
  },
});

Avatar.propTypes = {
  source: PropTypes.oneOfType([PropTypes.number, PropTypes.object]).isRequired,
};
