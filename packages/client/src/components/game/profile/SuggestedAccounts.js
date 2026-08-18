import React from 'react';
import PropTypes from 'prop-types';
import { View, TouchableOpacity, Text, ScrollView, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Colors, Spacing, TextStyles } from '../../../../constants/design';
import SuggestedAccountCard from './SuggestedAccountCard';
import { ChevronRightIcon } from './index';

export default function SuggestedAccounts({ accounts, onShowAll, onDismiss, onFollow }) {
  const { t } = useTranslation();

  if (!accounts.length) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('watchers.suggestedAccounts')}</Text>
        <TouchableOpacity
          style={styles.showAll}
          onPress={onShowAll}
          accessibilityRole="button"
          accessibilityLabel={t('watchers.showAll')}
        >
          <Text style={styles.showAllLabel}>{t('watchers.showAll')}</Text>
          <ChevronRightIcon size={16} color={Colors.text.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
      >
        {accounts.map((account) => (
          <SuggestedAccountCard
            key={account.id}
            account={account}
            onDismiss={onDismiss}
            onFollow={onFollow}
          />
        ))}
      </ScrollView>
    </View>
  );
}

SuggestedAccounts.propTypes = {
  accounts: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
      avatarUrl: PropTypes.string.isRequired,
    })
  ).isRequired,
  onShowAll: PropTypes.func.isRequired,
  onDismiss: PropTypes.func.isRequired,
  onFollow: PropTypes.func.isRequired,
};

const styles = StyleSheet.create({
  container: {
    gap: Spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    ...TextStyles.subtitleM,
    color: Colors.text.primary,
  },
  showAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  showAllLabel: {
    ...TextStyles.bodyMRegular,
    color: Colors.text.primary,
  },
  list: {
    gap: Spacing.md,
  },
});
