import { View, StyleSheet } from 'react-native';
import { VideoTile } from './VideoTile';
import { Spacing } from '@/constants/design';
import PropTypes from 'prop-types';

export const StreamLayout = ({ streams }) => {
  if (!streams || streams.length === 0) return null;

  if (streams.length === 1) {
    return (
      <View style={styles.container}>
        <VideoTile {...streams[0]} />
      </View>
    );
  }

  if (streams.length === 2) {
    return (
      <View style={styles.container}>
        <VideoTile {...streams[0]} />
        <VideoTile {...streams[1]} />
      </View>
    );
  }

  if (streams.length === 3) {
    return (
      <View style={styles.container}>
        <VideoTile {...streams[0]} />
        <View style={styles.row}>
          <VideoTile {...streams[1]} />
          <VideoTile {...streams[2]} />
        </View>
      </View>
    );
  }

  if (streams.length === 4) {
    return (
      <View style={styles.container}>
        <View style={styles.row}>
          <VideoTile {...streams[0]} />
          <VideoTile {...streams[1]} />
        </View>
        <View style={styles.row}>
          <VideoTile {...streams[2]} />
          <VideoTile {...streams[3]} />
        </View>
      </View>
    );
  }

  return null;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: Spacing.sm,
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    gap: Spacing.sm,
  },
});

StreamLayout.propTypes = {
  streams: PropTypes.arrayOf(
    PropTypes.shape({
      stream: PropTypes.shape({ toURL: PropTypes.func.isRequired }),
      label: PropTypes.string.isRequired,
      isMicOn: PropTypes.bool.isRequired,
      isCameraOff: PropTypes.bool.isRequired,
      profileUrl: PropTypes.string.isRequired,
      isSelected: PropTypes.bool.isRequired,
      giftCount: PropTypes.oneOfType([PropTypes.string, PropTypes.number])
        .isRequired,
    })
  ).isRequired,
};
