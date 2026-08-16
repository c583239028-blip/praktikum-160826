import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import PropTypes from 'prop-types';
import { useSelector, useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { fetchHistory, togglePin } from '../store/slices/historySlice';
import Screen from '../components/Screen';
import {
  Colors,
  Spacing,
  BorderRadius,
  FontSize,
  FontWeight,
} from '../../constants/design';
import { useScale } from '../hooks/useScale';
import { useRTL } from '../hooks/useRTL';

const GameCard = ({ item, onPin }) => {
  const { t, i18n } = useTranslation('history');
  const { textAlign } = useRTL();
  const { scale } = useScale();
  const roleColor =
    item.relationType === 'HOST' ? Colors.warning.main : Colors.info.main;
  const roleLabel =
    item.relationType === 'HOST' ? t('role_host') : t('role_player');

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View
          style={[
            styles.badge,
            { borderColor: roleColor, backgroundColor: roleColor + '22' },
          ]}
        >
          <Text style={[styles.badgeText, { color: roleColor }]}>
            {roleLabel}
          </Text>
        </View>
        <TouchableOpacity onPress={() => onPin(item.gameId)}>
          <Text style={styles.pinBtn}>
            {item.isPinned ? t('pinned_button') : t('pin_button')}
          </Text>
        </TouchableOpacity>
      </View>

      <Text
        style={[
          styles.gameTitle,
          { fontSize: scale(FontSize.bodyL), textAlign },
        ]}
      >
        {item.game?.title || t('untitled_game')}
      </Text>
      <Text style={[styles.gameDate, { textAlign }]}>
        {new Date(item.createdAt).toLocaleDateString(i18n.language)}
      </Text>

      <View style={styles.breakdown}>
        <Text style={styles.breakdownTitle}>{t('score_label')}</Text>
        <View style={styles.breakdownRow}>
          <Text style={styles.breakdownItem}>
            {t('breakdown_questions', { value: item.breakdown?.TRIVIA || 0 })}
          </Text>
          <Text style={styles.breakdownItem}>
            {t('breakdown_gifts', { value: item.breakdown?.DONATION || 0 })}
          </Text>
          <Text style={styles.breakdownItem}>
            {t('breakdown_bonus', { value: item.breakdown?.BONUS || 0 })}
          </Text>
        </View>
        <Text style={styles.totalText}>
          {t('total_label', { value: item.total || 0 })}
        </Text>
      </View>
    </View>
  );
};

GameCard.propTypes = {
  item: PropTypes.shape({
    gameId: PropTypes.string,
    relationType: PropTypes.string,
    isPinned: PropTypes.bool,
    createdAt: PropTypes.string,
    total: PropTypes.number,
    game: PropTypes.shape({
      title: PropTypes.string,
    }),
    breakdown: PropTypes.shape({
      TRIVIA: PropTypes.number,
      DONATION: PropTypes.number,
      BONUS: PropTypes.number,
    }),
  }).isRequired,
  onPin: PropTypes.func.isRequired,
};

const HistoryScreen = () => {
  const { t, i18n } = useTranslation('history');
  const { textAlign } = useRTL();
  const dispatch = useDispatch();
  const { all, asHost, asPlayer, loading, error } = useSelector(
    (state) => state.history
  );
  const [activeTab, setActiveTab] = useState('all');

  const TABS = [
    { id: 'all', label: t('tab_all') },
    { id: 'asHost', label: t('tab_as_host') },
    { id: 'asPlayer', label: t('tab_as_player') },
  ];

  useEffect(() => {
    dispatch(fetchHistory());
  }, [dispatch]);

  const onRefresh = () => dispatch(fetchHistory());
  const onPin = (gameId) => dispatch(togglePin(gameId));

  const currentData =
    activeTab === 'all' ? all : activeTab === 'asHost' ? asHost : asPlayer;

  if (loading && currentData.length === 0) {
    return (
      <Screen style={styles.center}>
        <ActivityIndicator color={Colors.warning.main} size="large" />
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      {error && <Text style={styles.errorText}>{`Error: ${error}`}</Text>}

      <View style={styles.tabBar}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tab, activeTab === tab.id && styles.tabActive]}
            onPress={() => setActiveTab(tab.id)}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === tab.id && styles.tabTextActive,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={currentData}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <GameCard item={item} onPin={onPin} />}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={onRefresh}
            tintColor={Colors.warning.main}
          />
        }
        ListEmptyComponent={() => (
          <Text style={styles.emptyText}>{t('empty')}</Text>
        )}
      />
    </Screen>
  );
};

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderColor: Colors.neutral[200],
  },
  tab: { flex: 1, paddingVertical: Spacing.lg, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderColor: Colors.warning.main },
  tabText: {
    color: Colors.text.secondary,
    fontSize: FontSize.bodyM,
    fontWeight: FontWeight.semiBold,
  },
  tabTextActive: { color: Colors.warning.main },
  list: { padding: Spacing.xl, paddingBottom: Spacing['3xl'] },
  card: {
    backgroundColor: Colors.neutral[100],
    borderRadius: BorderRadius.md,
    padding: Spacing['2xl'],
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.neutral[200],
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
  },
  badge: {
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  badgeText: { fontSize: FontSize.caption, fontWeight: FontWeight.bold },
  pinBtn: { fontSize: FontSize.bodyM, color: Colors.text.tertiary },
  gameTitle: {
    color: Colors.text.primary,
    fontWeight: FontWeight.bold,
    textAlign: 'right',
    marginBottom: Spacing.sm,
  },
  gameDate: {
    color: Colors.text.secondary,
    fontSize: FontSize.caption,
    textAlign: 'right',
    marginBottom: Spacing.lg,
  },
  breakdown: {
    backgroundColor: Colors.neutral[100],
    borderRadius: BorderRadius.sm,
    padding: Spacing.lg,
  },
  breakdownTitle: {
    color: Colors.text.tertiary,
    fontSize: FontSize.caption,
    fontWeight: FontWeight.bold,
    marginBottom: Spacing.md,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  breakdownItem: { color: Colors.text.secondary, fontSize: FontSize.caption },
  totalText: {
    color: Colors.warning.main,
    fontWeight: FontWeight.bold,
    fontSize: FontSize.bodyM,
    textAlign: 'left',
  },
  emptyText: {
    color: Colors.text.secondary,
    textAlign: 'center',
    marginTop: 60,
    fontSize: FontSize.bodyM,
  },
  errorText: {
    color: Colors.error.main,
    textAlign: 'center',
    marginTop: Spacing['2xl'],
    fontSize: FontSize.bodyM,
  },
});

export default HistoryScreen;
