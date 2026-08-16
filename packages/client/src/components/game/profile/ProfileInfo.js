import React from 'react';
import PropTypes from 'prop-types';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Colors, Spacing, TextStyles } from '../../../../constants/design';
import StatBadge from './StatBadge';

// Note: the avatar itself is rendered by TopBar (it overlaps the gradient
// header), so this block only covers everything below it.
export default function ProfileInfo({ user }) {
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      <View style={styles.identity}>
        <Text style={styles.name} numberOfLines={1}>
          {user.name}
        </Text>
        <Text style={styles.username} numberOfLines={1}>
          @{user.username}
        </Text>
      </View>

      <View style={styles.statsRow}>
        <StatBadge value={user.inProgressCount} label={t('watchers.inProgress')} />
        <StatBadge value={user.followersLabel} label={t('watchers.followers')} />
        <StatBadge value={user.liveFeedCount} label={t('watchers.liveFeed')} />
      </View>

      {!!user.bio && (
        <Text style={styles.bio} numberOfLines={3}>
          {user.bio}
        </Text>
      )}
    </View>
  );
}

ProfileInfo.propTypes = {
  user: PropTypes.shape({
    avatarUrl: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    username: PropTypes.string.isRequired,
    bio: PropTypes.string,
    inProgressCount: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    followersLabel: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    liveFeedCount: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  }).isRequired,
};

const styles = StyleSheet.create({
  container: {
    gap: Spacing.lg,
    paddingTop: Spacing['2xl'],
  },
  identity: {
    gap: Spacing.sm,
  },
  name: {
    ...TextStyles.subtitleL,
    color: Colors.text.primary,
  },
  username: {
    ...TextStyles.bodyMRegular,
    color: Colors.text.secondary,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  bio: {
    ...TextStyles.bodyMRegular,
    color: Colors.text.secondary,
  },
});
