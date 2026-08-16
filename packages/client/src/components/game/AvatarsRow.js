import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors, BorderRadius } from '@/constants/design';
import PropTypes from 'prop-types';
import { Avatar } from './Avatar';

// onPlayerPress הוא אופציונלי - אם לא הועבר, האווטארים נשארים לא-לחיצים
// (disabled) כמו שהיה קודם, כדי לא לשבור מקומות אחרים שכבר משתמשים ב-AvatarsRow.
export const AvatarsRow = ({ players, onPlayerPress }) => (
  <View style={styles.row}>
    {players.map((player, index) => (
      <TouchableOpacity
        key={player.id}
        activeOpacity={0.8}
        disabled={!onPlayerPress}
        onPress={() => onPlayerPress && onPlayerPress(player)}
        style={[styles.item, { marginLeft: index === 0 ? 0 : -12 }]}
      >
        <Avatar source={{ uri: player.avatarUrl }} />
      </TouchableOpacity>
    ))}
  </View>
);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  item: {
    borderWidth: 1.5,
    borderColor: Colors.surface.white,
    borderRadius: BorderRadius.full,
  },
});

AvatarsRow.propTypes = {
  players: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
      username: PropTypes.string,
      avatarUrl: PropTypes.string.isRequired,
      giftCount: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    })
  ).isRequired,
  onPlayerPress: PropTypes.func,
};

AvatarsRow.defaultProps = {
  onPlayerPress: null,
};
