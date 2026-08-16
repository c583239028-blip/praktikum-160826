import React from 'react';
import PropTypes from 'prop-types';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Colors, Spacing, BorderRadius, TextStyles } from '../../../../constants/design';
import { UserRemoveIcon } from './index';

export default function ProfileActionButtons({ onMessage, onRemoveFollow }) {
  const { t } = useTranslation();

  return (
    <View style={styles.row}>
      <TouchableOpacity
        style={styles.messageButton}
        onPress={onMessage}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={t('watchers.message')}
      >
        <Text style={styles.messageLabel}>{t('watchers.message')}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.removeFollowButton}
        onPress={onRemoveFollow}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={t('watchers.removeFollow')}
      >
        <UserRemoveIcon size={18} color={Colors.text.primary} />
        <Text style={styles.removeFollowLabel}>{t('watchers.removeFollow')}</Text>
      </TouchableOpacity>
    </View>
  );
}

ProfileActionButtons.propTypes = {
  onMessage: PropTypes.func.isRequired,
  onRemoveFollow: PropTypes.func.isRequired,
};

const BUTTON_HEIGHT = 44;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  messageButton: {
    flex: 1,
    height: BUTTON_HEIGHT,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary.default,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageLabel: {
    ...TextStyles.bodyMMedium,
    color: Colors.surface.white,
  },
  removeFollowButton: {
    flex: 1,
    height: BUTTON_HEIGHT,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.neutral[300],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  removeFollowLabel: {
    ...TextStyles.bodyMMedium,
    color: Colors.text.primary,
  },
});
