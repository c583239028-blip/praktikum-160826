import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
// TODO: תלות ב-T16 — StreamCard (מנוטרל זמנית עד שהתיקון יתמזג)
// import StreamCard from '../../components/StreamCard';
import { useRouter } from 'expo-router';
import { useAuthGuard } from '../../hooks/useAuthGuard';
import LazyAuthModal from '../../components/LazyAuthModal';
import StreamCard from '../../components/StreamCard';
import StreamCardSkeleton from '../../components/StreamCardSkeleton';
import EmptyFeed from '../../components/EmptyFeed';
import ErrorState from '../../components/ErrorState';
import Screen from '../../components/Screen';
import { feedApi } from '../../services/feedApi';
import { joinGame } from '../../store/actions/gameActions';
import {
  Colors,
  FontSize,
  FontWeight,
  Spacing,
} from '../../../constants/design';

export function getJoinableGameId(stream) {
  const games = Array.isArray(stream?.games) ? stream.games : [];
  return (
    games.find((game) => game?.status === 'ACTIVE' && game?.id)?.id ?? null
  );
}

export default function LiveScreen() {
  const router = useRouter();
  const dispatch = useDispatch();
  const { t } = useTranslation('game');
  const { user } = useAuth();
  // useAuthGuard may retain this action while a guest signs in. Reading the
  // latest user through a ref ensures the resumed action can still detect that
  // the newly authenticated user owns the selected stream.
  const currentUserRef = useRef(user);
  currentUserRef.current = user;
  const joinInProgressRef = useRef(false);
  const { guardedAction, isModalVisible, closeAuthModal } = useAuthGuard();
  const [streams, setStreams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [feedError, setFeedError] = useState(null);
  const [joiningGameId, setJoiningGameId] = useState(null);
  const [joinError, setJoinError] = useState(null);

  const loadFeed = useCallback(async () => {
    setFeedError(null);

    try {
      const data = await feedApi.getPublicFeed();
      setStreams(Array.isArray(data?.streams) ? data.streams : []);
    } catch (error) {
      setFeedError(error);
      logger.error('[LiveScreen] Failed to load feed:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  const joinableStreams = useMemo(
    () =>
      streams
        .filter((stream) => stream?.status === 'LIVE')
        .map((stream) => ({
          ...stream,
          gameId: getJoinableGameId(stream),
        }))
        .filter((stream) => stream.gameId),
    [streams]
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadFeed();
  }, [loadFeed]);

  const handleJoinLive = (stream) => {
    const { gameId } = stream;
    if (!gameId || joinInProgressRef.current) return;

    guardedAction(async () => {
      if (joinInProgressRef.current) return;
      joinInProgressRef.current = true;
      setJoinError(null);
      setJoiningGameId(gameId);

      try {
        const hostId = stream.hostId ?? stream.host?.id;
        const isHost = Boolean(hostId) && currentUserRef.current?.id === hostId;
        const joinAction = isHost ? joinGame(gameId, 'HOST') : joinGame(gameId);

        await dispatch(joinAction);
        router.push('/game_screen');
      } catch (error) {
        logger.error('[LiveScreen] Failed to join game:', error);
        setJoinError(t('error_join_failed'));
        await loadFeed();
      } finally {
        joinInProgressRef.current = false;
        setJoiningGameId(null);
      }
    });
  };

  return (
    <Screen padded={false} backgroundColor={Colors.surface.dark}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('live_title')}</Text>
        <Text style={styles.subtitle}>{t('live_subtitle')}</Text>
        {joinError && <Text style={styles.errorText}>{joinError}</Text>}
      </View>

      {loading ? (
        <StreamCardSkeleton />
      ) : feedError ? (
        <ErrorState onRetry={loadFeed} />
      ) : (
        <FlatList
          data={joinableStreams}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.cardContainer}>
              <StreamCard
                stream={item}
                onPress={() => handleJoinLive(item)}
                disabled={Boolean(joiningGameId)}
              />
              {joiningGameId === item.gameId && (
                <View style={styles.joiningOverlay}>
                  <ActivityIndicator
                    size="large"
                    color={Colors.primary.default}
                  />
                </View>
              )}
            </View>
          )}
          ListEmptyComponent={<EmptyFeed />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={Colors.primary.default}
              colors={[Colors.primary.default]}
            />
          }
          contentContainerStyle={[
            styles.listContent,
            joinableStreams.length === 0 && styles.emptyList,
          ]}
        />
      )}

      <LazyAuthModal visible={isModalVisible} onClose={closeAuthModal} />
    </Screen>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  title: {
    color: '#06b6d4',
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitle: {
    color: '#aaa',
    fontSize: 14,
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#06b6d4',
    paddingVertical: 12,
    paddingHorizontal: 40,
    borderRadius: 24,
    width: 200,
    alignItems: 'center',
  },
  viewerButton: {
    backgroundColor: '#3a3a3a',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
