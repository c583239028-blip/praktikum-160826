import React, { useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import Screen from '../components/Screen';
import {
  Colors,
  Spacing,
  BorderRadius,
  FontSize,
  FontWeight,
} from '../../constants/design';
import PropTypes from 'prop-types';
import { useSelector, useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import {
  fetchInbox,
  markAsRead,
  resetInbox,
  addNewItem,
} from '../store/slices/inboxSlice';
import { getAppSocket } from '../services/socket.service';
import { useRTL } from '../hooks/useRTL';

// Small shared components
const Badge = ({ label, color = Colors.warning.main }) => (
  <View
    style={[
      badgeStyles.wrap,
      { backgroundColor: color + '22', borderColor: color },
    ]}
  >
    <Text style={[badgeStyles.text, { color }]}>{label}</Text>
  </View>
);

Badge.propTypes = {
  label: PropTypes.string.isRequired,
  color: PropTypes.string,
};

const Card = ({ children, style }) => (
  <View style={[cardStyles.wrap, style]}>{children}</View>
);

Card.propTypes = {
  children: PropTypes.node.isRequired,
  style: PropTypes.object,
};

const Btn = ({
  label,
  onPress,
  color = Colors.warning.main,
  disabled,
  loading,
}) => (
  <TouchableOpacity
    style={[
      btnStyles.wrap,
      { backgroundColor: disabled || loading ? Colors.neutral[600] : color },
    ]}
    onPress={onPress}
    disabled={disabled || loading}
    activeOpacity={0.8}
  >
    {loading ? (
      <ActivityIndicator color={Colors.neutral[900]} size="small" />
    ) : (
      <Text
        style={[
          btnStyles.text,
          { color: disabled ? Colors.text.secondary : Colors.neutral[900] },
        ]}
      >
        {label}
      </Text>
    )}
  </TouchableOpacity>
);

Btn.propTypes = {
  label: PropTypes.string.isRequired,
  onPress: PropTypes.func.isRequired,
  color: PropTypes.string,
  disabled: PropTypes.bool,
  loading: PropTypes.bool,
};

// Main screen component
const InboxScreen = () => {
  const { t, i18n } = useTranslation('inbox');
  const { textAlign, flexDirection } = useRTL();
  const dispatch = useDispatch();
  const { items, loading, hasMore, page, error } = useSelector(
    (state) => state.inbox
  );

  useEffect(() => {
    dispatch(resetInbox());
    dispatch(fetchInbox({ page: 1, limit: 10 }));

    const handleNewItem = (data) => {
      dispatch(addNewItem(data));
    };

    const s = getAppSocket();
    if (s) s.on('new_inbox_item', handleNewItem);

    return () => {
      const s2 = getAppSocket();
      if (s2) s2.off('new_inbox_item', handleNewItem);
    };
  }, [dispatch]);

  const loadMore = () => {
    if (hasMore && !loading) {
      dispatch(fetchInbox({ page, limit: 10 }));
    }
  };

  const onRefresh = useCallback(() => {
    dispatch(resetInbox());
    dispatch(fetchInbox({ page: 1, limit: 10 }));
  }, [dispatch]);

  const renderItem = ({ item }) => (
    <Card style={[styles.cardMargin]}>
      <View style={[styles.itemHeader, { flexDirection }]}>
        <Badge
          label={
            item.type === 'GIFT'
              ? t('badge_gift')
              : item.type === 'FOLLOW'
                ? t('badge_follower')
                : t('badge_system')
          }
          color={item.type === 'GIFT' ? Colors.success.main : Colors.info.main}
        />
        <Text style={styles.timestamp}>
          {new Date(item.timestamp).toLocaleTimeString(i18n.language, {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Text>
      </View>

      <Text style={[styles.title, { textAlign }]}>{item.title}</Text>
      <Text style={[styles.content, { textAlign }]}>{item.content}</Text>

      <View style={[styles.actions, { flexDirection }]}>
        <Btn
          label={t('mark_as_read_button')}
          onPress={() => dispatch(markAsRead({ id: item.id, type: item.type }))}
          color={Colors.neutral[600]}
        />
        {item.type === 'FOLLOW' && item.metadata && !item.metadata.isMutual && (
          <Btn
            label={t('follow_back_button')}
            onPress={() => console.log('Follow back logic here')}
            color={Colors.warning.main}
          />
        )}
      </View>
    </Card>
  );

  return (
    <Screen padded={false}>
      {error && (
        <Text style={styles.errorText}>{t('load_error', { error })}</Text>
      )}
      <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={(item) => item.id.toString()}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={onRefresh}
            tintColor={Colors.warning.main}
          />
        }
        ListFooterComponent={() =>
          loading && hasMore ? (
            <ActivityIndicator
              color={Colors.warning.main}
              style={{ margin: Spacing['2xl'] }}
            />
          ) : null
        }
        ListEmptyComponent={() =>
          !loading && <Text style={styles.emptyText}>{t('empty')}</Text>
        }
        contentContainerStyle={styles.listContent}
      />
    </Screen>
  );
};

// Styles
const badgeStyles = StyleSheet.create({
  wrap: {
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.5,
  },
});

const cardStyles = StyleSheet.create({
  wrap: {
    backgroundColor: Colors.surface.white,
    borderRadius: BorderRadius.md,
    padding: Spacing['2xl'],
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.neutral[200],
  },
});

const btnStyles = StyleSheet.create({
  wrap: {
    borderRadius: BorderRadius.md,
    padding: Spacing.xl,
    alignItems: 'center',
    marginTop: Spacing.sm,
    flex: 1,
  },
  text: {
    fontWeight: FontWeight.bold,
    fontSize: FontSize.bodyM,
    letterSpacing: 0.5,
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    padding: Spacing.xl,
    paddingBottom: Spacing['3xl'],
  },
  cardMargin: {
    marginBottom: Spacing.lg,
  },
  itemHeader: {
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  timestamp: {
    color: Colors.text.secondary,
    fontSize: FontSize.caption,
  },
  title: {
    color: Colors.text.primary,
    fontSize: FontSize.bodyL,
    fontWeight: FontWeight.bold,
    textAlign: 'right',
    marginBottom: Spacing.sm,
  },
  content: {
    color: Colors.text.tertiary,
    fontSize: FontSize.bodyM,
    textAlign: 'right',
    marginBottom: Spacing.lg,
  },
  actions: {
    flexDirection: 'row-reverse',
    gap: Spacing.lg,
  },
  emptyText: {
    color: Colors.text.secondary,
    textAlign: 'center',
    marginTop: 100,
    fontSize: FontSize.bodyL,
  },
  errorText: {
    color: Colors.error.main,
    textAlign: 'center',
    marginTop: Spacing['2xl'],
    fontSize: FontSize.bodyM,
  },
});

export default InboxScreen;
