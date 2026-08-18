import React from 'react';
import PropTypes from 'prop-types';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Colors, Spacing, BorderRadius, TextStyles } from '../../../../constants/design';
import Avatar from './Avatar';
import { CloseIcon } from './index';

const CARD_WIDTH = 117;
const AVATAR_SIZE = 56;

export default function SuggestedAccountCard({ account, onDismiss, onFollow }) {
  const { t } = useTranslation();

  return (
    <View style={styles.card}>
      <TouchableOpacity
        style={styles.dismissButton}
        onPress={() => onDismiss(account.id)}
        accessibilityRole="button"
        accessibilityLabel={t('watchers.dismissSuggestion')}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <CloseIcon size={12} color={Colors.text.secondary} />
      </TouchableOpacity>

      <Avatar uri={account.avatarUrl} size={AVATAR_SIZE} borderWidth={2} style={styles.avatar} />

      <Text style={styles.name} numberOfLines={1}>
        {account.name}
      </Text>

      <TouchableOpacity
        style={styles.followButton}
        onPress={() => onFollow(account.id)}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={t('watchers.follow')}
      >
        <Text style={styles.followLabel}>{t('watchers.follow')}</Text>
      </TouchableOpacity>
    </View>
  );
}

SuggestedAccountCard.propTypes = {
  account: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    avatarUrl: PropTypes.string.isRequired,
  }).isRequired,
  onDismiss: PropTypes.func.isRequired,
  onFollow: PropTypes.func.isRequired,
};

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.md,
    gap: Spacing.md,
    backgroundColor: Colors.neutral[100],
    borderRadius: BorderRadius.md,
  },
  dismissButton: {
    position: 'absolute',
    top: Spacing.sm,
    left: Spacing.sm,
    width: 20,
    height: 20,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surface.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    marginTop: Spacing.sm,
  },
  name: {
    ...TextStyles.bodyMMedium,
    color: Colors.text.primary,
  },
  followButton: {
    alignSelf: 'stretch',
    height: 32,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary.default,
    alignItems: 'center',
    justifyContent: 'center',
  },
  followLabel: {
    ...TextStyles.captionMedium,
    color: Colors.surface.white,
  },
});
