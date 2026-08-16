import PropTypes from 'prop-types';
import {
  View,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Colors } from '../../constants/design';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function StreamCard({ stream, onPress }) {
  return (
    <View style={styles.wrapper}>
      <TouchableOpacity style={styles.card} onPress={onPress}>
        <Image source={{ uri: stream.thumbnailUrl }} style={styles.thumbnail} />
      </TouchableOpacity>

      {/* TODO: להחליף ב-<Image> כשהתמונה מוכנה */}
      <View style={styles.bottomSection} />
    </View>
  );
}

StreamCard.propTypes = {
  stream: PropTypes.shape({
    thumbnailUrl: PropTypes.string,
    title: PropTypes.string,
    host: PropTypes.shape({ username: PropTypes.string }),
    viewerCount: PropTypes.number,
  }).isRequired,
  onPress: PropTypes.func.isRequired,
};

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: Colors.neutral[200],
  },
  card: {
    backgroundColor: Colors.neutral[900],
    overflow: 'hidden',
    height: SCREEN_HEIGHT * 0.42,
    borderRadius: 0,
    marginBottom: 0,
  },
  thumbnail: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  bottomSection: {
    flex: 1,
    backgroundColor: Colors.neutral[200],
  },
});
