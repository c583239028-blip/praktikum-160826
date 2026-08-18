import { useState, useEffect, useCallback } from 'react';
import { FlatList, RefreshControl, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import StreamCard from '../components/StreamCard';
import EmptyFeed from '../components/EmptyFeed';
import StreamCardSkeleton from '../components/StreamCardSkeleton';
import ErrorState from '../components/ErrorState';
import LazyAuthModal from '../components/LazyAuthModal';
import { feedApi } from '../services/feedApi';
import { useAuthGuard } from '../hooks/useAuthGuard';
import Screen from '../components/Screen';
import { Spacing } from '../../constants/design';

export default function FeedScreen() {
  const router = useRouter();
  const [streams, setStreams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const { guardedAction, isModalVisible, closeAuthModal } = useAuthGuard();

  const loadFeed = useCallback(async () => {
    setError(null);
    try {
      const data = await feedApi.getPublicFeed();
      setStreams(data.streams ?? []);
    } catch (err) {
      setError(err);
      console.error('[FeedScreen]', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  const onRefresh = () => {
    setRefreshing(true);
    loadFeed();
  };

  if (loading) return <StreamCardSkeleton />;

  if (error) return <ErrorState onRetry={loadFeed} />;

  return (
    <Screen padded={false}>
      <FlatList
        data={streams}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <StreamCard
            stream={item}
            onPress={() =>
              guardedAction(() =>
                router.push({
                  pathname: '/viewer',
                  params: { streamId: item.id, title: item.title },
                })
              )
            }
          />
        )}
        ListEmptyComponent={<EmptyFeed />}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={[
          styles.baseContainer,
          streams.length === 0 ? styles.listEmptyStyle : undefined,
        ]}
      />
      <LazyAuthModal visible={isModalVisible} onClose={closeAuthModal} />
    </Screen>
  );
}
const styles = StyleSheet.create({
  baseContainer: {
    padding: Spacing.lg,
    flexGrow: 1,
  },
  listEmptyStyle: {
    justifyContent: 'center',
  },
});
