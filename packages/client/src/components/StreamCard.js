import PropTypes from 'prop-types';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Colors, Spacing } from '../../constants/design';
import EyeIcon from '@/assets/icons/eye.svg';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const FALLBACK_THUMBNAIL = require('../../assets/images/live-placeholder.png');
const THUMBNAIL_HEIGHT_RATIO = 0.42;

export default function StreamCard({ stream, onPress, disabled = false }) {
  return (
    <View style={styles.wrapper}>
      <TouchableOpacity
        style={styles.card}
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={stream.title}
      >
        <Image
          source={
            stream.thumbnailUrl
              ? { uri: stream.thumbnailUrl }
              : FALLBACK_THUMBNAIL
          }
          style={styles.thumbnail}
        />

        {/* Live viewer count, read from the feed API (Stream.viewerCount). The
            feed is not in the stream socket room, so this is a snapshot value. */}
        {typeof stream.viewerCount === 'number' && (
          <View style={styles.viewerTag}>
            <EyeIcon width={16} height={16} />
            <Text style={styles.viewerTagText}>{stream.viewerCount}</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* TODO: להחליף ב-<Image> כשהתמונה מוכנה */}
      <View style={styles.bottomSection} />
    </View>
  );
}

StreamCard.propTypes = {
  stream: PropTypes.shape({
    id: PropTypes.string.isRequired,
    gameId: PropTypes.string,
    hostId: PropTypes.string,
    status: PropTypes.string,
    thumbnailUrl: PropTypes.string,
    title: PropTypes.string.isRequired,
    host: PropTypes.shape({
      id: PropTypes.string,
      username: PropTypes.string,
    }),
    viewerCount: PropTypes.number,
  }).isRequired,
  onPress: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
};

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: Colors.neutral[200],
  },
  card: {
    backgroundColor: Colors.neutral[900],
    overflow: 'hidden',
    height: SCREEN_HEIGHT * THUMBNAIL_HEIGHT_RATIO,
    borderRadius: 0,
    marginBottom: 0,
  },
  thumbnail: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  viewerTag: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: 32,
  },
  viewerTagText: {
    color: Colors.surface.white,
    fontSize: 12,
    fontWeight: '600',
  },
  bottomSection: {
    flex: 1,
    backgroundColor: Colors.neutral[200],
  },
});
