import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import {
  Colors,
  Spacing,
  FontFamily,
  FontSize,
  FontWeight,
  LineHeight,
} from '../../../../constants/design';

export const CONNECTION_TABS = {
  IN_PROGRESS: 'inProgress',
  FOLLOWERS: 'followers',
  RECOMMENDED: 'recommended',
};

const TAB_I18N_KEYS = {
  [CONNECTION_TABS.IN_PROGRESS]: 'connectionsTabInProgress',
  [CONNECTION_TABS.FOLLOWERS]: 'connectionsTabFollowers',
  [CONNECTION_TABS.RECOMMENDED]: 'connectionsTabRecommended',
};

const ConnectionsTab = ({ activeTab, onTabChange }) => {
  const { t } = useTranslation('connections');

  return (
    <View style={styles.container}>
      {Object.values(CONNECTION_TABS).map((tab) => {
        const isActive = tab === activeTab;
        return (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, isActive && styles.tabActive]}
            onPress={() => onTabChange(tab)}
            activeOpacity={0.7}
          >
            <Text style={[styles.label, isActive && styles.labelActive]}>
              {t(TAB_I18N_KEYS[tab])}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

ConnectionsTab.propTypes = {
  activeTab: PropTypes.oneOf(Object.values(CONNECTION_TABS)).isRequired,
  onTabChange: PropTypes.func.isRequired,
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    width: '100%',
    height: 48,
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral[100],
    backgroundColor: Colors.surface.white,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    paddingHorizontal: Spacing.md,
  },
  tabActive: {
    borderBottomColor: Colors.primary.dark,
  },
  label: {
    fontFamily: FontFamily.primary,
    fontSize: FontSize.bodyM,
    fontWeight: FontWeight.regular,
    lineHeight: LineHeight.bodyM,
    color: Colors.text.secondary,
  },
  labelActive: {
    fontWeight: FontWeight.medium,
    color: Colors.text.primary,
  },
});

export default ConnectionsTab;
