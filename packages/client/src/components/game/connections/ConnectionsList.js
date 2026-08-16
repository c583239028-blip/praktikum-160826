import React, { useEffect, useState, useCallback } from 'react';
import {
  Modal,
  View,
  FlatList,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Text,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import PropTypes from 'prop-types';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import {
  Colors,
  Spacing,
  BorderRadius,
  FontFamily,
  FontSize,
  FontWeight,
  LineHeight,
} from '../../../../constants/design';
import ConnectionsTab, { CONNECTION_TABS } from './ConnectionsTab';
import BackSvg from '../../../../assets/icons/back.svg';

// ---------------------------------------------------------------------------
// Slice actions — import from your slice once it is ready.
// Replace the mock block below with these imports and remove the mock.
//
// import {
//   fetchInProgressConnections,
//   fetchFollowersConnections,
//   fetchRecommendedConnections,
//   sendMessage,
//   followConnection,
//   unfollowConnection,
// } from '../../../../store/slices/ConnectionsSlice';
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// DEV MOCK — remove before pushing to git
const MOCK_CONNECTION = {
  id: '1',
  name: 'Ron Dramoni',
  avatarUri: 'https://i.pravatar.cc/64?img=3',
  subtitle: 'By tracking',
  monitoringAvatars: [
    'https://i.pravatar.cc/32?img=1',
    'https://i.pravatar.cc/32?img=2',
  ],
};
const MOCK_LISTS = {
  [CONNECTION_TABS.IN_PROGRESS]: [
    MOCK_CONNECTION,
    {
      ...MOCK_CONNECTION,
      id: '2',
      name: 'Dana Levi',
      subtitle: 'Under monitoring by',
    },
  ],
  [CONNECTION_TABS.FOLLOWERS]: [{ ...MOCK_CONNECTION, id: '3', name: 'Avi Cohen' }],
  [CONNECTION_TABS.RECOMMENDED]: [
    {
      ...MOCK_CONNECTION,
      id: '4',
      name: 'Shira Ben-David',
      subtitle: undefined,
      monitoringAvatars: [],
    },
  ],
};
// END DEV MOCK
// ---------------------------------------------------------------------------

const BUTTON_I18N_BY_TAB = {
  [CONNECTION_TABS.IN_PROGRESS]: 'connectionsBtnSendMessage',
  [CONNECTION_TABS.FOLLOWERS]: 'connectionsBtnGoBack',
  [CONNECTION_TABS.RECOMMENDED]: 'connectionsBtnFollow',
};

// ---------------------------------------------------------------------------
// connectionAvatar
// ---------------------------------------------------------------------------
const ConnectionAvatar = ({ uri, size }) => {
  const borderWidth = 1.14;
  const outerSize = size + borderWidth * 2;

  return (
    <View
      style={[
        avatarStyles.wrapper,
        { width: outerSize, height: outerSize, borderRadius: outerSize / 2 },
      ]}
    >
      <Image
        source={{ uri }}
        style={[
          avatarStyles.image,
          { width: size, height: size, borderRadius: size / 2 },
        ]}
      />
    </View>
  );
};

ConnectionAvatar.propTypes = {
  uri: PropTypes.string.isRequired,
  size: PropTypes.number,
};
ConnectionAvatar.defaultProps = { size: 32 };

const avatarStyles = StyleSheet.create({
  wrapper: {
    backgroundColor: Colors.surface.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    resizeMode: 'cover',
  },
});

// ---------------------------------------------------------------------------
// ConnectionRowButton
// ---------------------------------------------------------------------------
const ConnectionRowButton = ({ label, onPress }) => (
  <TouchableOpacity
    style={btnStyles.button}
    onPress={onPress}
    activeOpacity={0.8}
  >
    <Text style={btnStyles.label}>{label}</Text>
  </TouchableOpacity>
);

ConnectionRowButton.propTypes = {
  label: PropTypes.string.isRequired,
  onPress: PropTypes.func,
};
ConnectionRowButton.defaultProps = { onPress: undefined };

const btnStyles = StyleSheet.create({
  button: {
    backgroundColor: Colors.primary.dark,
    borderRadius: BorderRadius.full,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 83,
    height: 36,
  },
  label: {
    fontFamily: FontFamily.primary,
    fontSize: FontSize.bodyM,
    fontWeight: FontWeight.medium,
    lineHeight: LineHeight.bodyM,
    color: Colors.text.primary,
  },
});

// ---------------------------------------------------------------------------
// ConnectionRow
// ---------------------------------------------------------------------------
const ConnectionRow = ({ connection, buttonLabel, onButtonPress }) => {
  const { name, avatarUri, subtitle, monitoringAvatars } = connection;

  return (
    <View style={rowStyles.row}>
      <View style={rowStyles.left}>
        <ConnectionAvatar uri={avatarUri} size={32} />

        <View style={rowStyles.info}>
          <View style={rowStyles.nameRow}>
            {monitoringAvatars && monitoringAvatars.length > 0 && (
              <View style={rowStyles.monitoringStack}>
                {monitoringAvatars.slice(0, 3).map((mUri, index) => (
                  <View
                    key={index}
                    style={[
                      index > 0 && { marginLeft: -6 },
                      { zIndex: monitoringAvatars.length - index },
                    ]}
                  >
                    <ConnectionAvatar uri={mUri} size={16} />
                  </View>
                ))}
              </View>
            )}
            <Text style={rowStyles.name} numberOfLines={1}>
              {name}
            </Text>
          </View>

          {subtitle ? (
            <Text style={rowStyles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>

      <ConnectionRowButton
        label={buttonLabel}
        onPress={() => onButtonPress?.(connection)}
      />
    </View>
  );
};

ConnectionRow.propTypes = {
  Connection: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    avatarUri: PropTypes.string.isRequired,
    subtitle: PropTypes.string,
    monitoringAvatars: PropTypes.arrayOf(PropTypes.string),
  }).isRequired,
  buttonLabel: PropTypes.string.isRequired,
  onButtonPress: PropTypes.func,
};
ConnectionRow.defaultProps = { onButtonPress: undefined };

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral[100],
    backgroundColor: Colors.surface.white,
    minHeight: 44,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flex: 1,
    marginRight: Spacing.md,
  },
  info: {
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  monitoringStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  name: {
    fontFamily: FontFamily.primary,
    fontSize: FontSize.bodyM,
    fontWeight: FontWeight.medium,
    lineHeight: LineHeight.bodyM,
    color: Colors.text.primary,
    flexShrink: 1,
  },
  subtitle: {
    fontFamily: FontFamily.primary,
    fontSize: FontSize.caption,
    fontWeight: FontWeight.regular,
    lineHeight: LineHeight.caption,
    color: Colors.text.secondary,
  },
});

// ---------------------------------------------------------------------------
// ConnectionsTopBar
// ---------------------------------------------------------------------------
const ConnectionsTopBar = ({ title, onBack }) => (
  // title מגיע מבחוץ (username של הפרופיל שנלחץ) - לא טקסט קבוע,
  // כי המסך הזה מציג את הקשרים של המשתמש שנצפה, לא של המנחה עצמו
  <View style={topBarStyles.container}>
    <TouchableOpacity
      onPress={onBack}
      style={topBarStyles.backButton}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <BackSvg style={topBarStyles.backArrow} />
    </TouchableOpacity>
    <Text style={topBarStyles.title} numberOfLines={1}>
      {title}
    </Text>
    <View style={topBarStyles.backButton} />
  </View>
);

ConnectionsTopBar.propTypes = {
  title: PropTypes.string.isRequired,
  onBack: PropTypes.func.isRequired,
};

const topBarStyles = StyleSheet.create({
  container: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    backgroundColor: Colors.surface.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral[100],
  },
  backButton: {
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backArrow: {
    fontSize: 20,
    color: Colors.text.primary,
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontFamily: FontFamily.primary,
    fontSize: FontSize.bodyM,
    fontWeight: FontWeight.medium,
    lineHeight: LineHeight.bodyM,
    color: Colors.text.primary,
  },
});

// ---------------------------------------------------------------------------
// ConnectionsList — main export
// ---------------------------------------------------------------------------
const ConnectionsList = ({ gameId, userId, username, onBack, initialTab }) => {
  const { t } = useTranslation('connections');
  // const dispatch = useDispatch();

  const [activeTab, setActiveTab] = useState(initialTab);
  const [searchQuery, setSearchQuery] = useState('');

  // ---------------------------------------------------------------------------
  // Redux selectors — uncomment once the slice is ready and remove mock state
  //
  // const inProgressConnections  = useSelector((s) => s.connections.inProgress.data);
  // const followersConnections   = useSelector((s) => s.connections.followers.data);
  // const recommendedConnections = useSelector((s) => s.connections.recommended.data);
  // const loading             = useSelector((s) => s.connections[activeTab].loading);
  // const error               = useSelector((s) => s.connections[activeTab].error);
  // ---------------------------------------------------------------------------

  // DEV MOCK — remove before pushing to git
  const [inProgressConnections, setInProgressConnections] = useState(
    MOCK_LISTS[CONNECTION_TABS.IN_PROGRESS]
  );
  const [followersConnections, setFollowersConnections] = useState(
    MOCK_LISTS[CONNECTION_TABS.FOLLOWERS]
  );
  const [recommendedConnections, setRecommendedConnections] = useState(
    MOCK_LISTS[CONNECTION_TABS.RECOMMENDED]
  );
  const loading = false;
  const error = null;
  // END DEV MOCK

  // ---------------------------------------------------------------------------
  // Fetch on mount and on tab change
  // ---------------------------------------------------------------------------
  useEffect(() => {
    // dispatch(fetchInProgressConnections({ gameId, userId }));
    // dispatch(fetchFollowersConnections({ gameId, userId }));
    // dispatch(fetchRecommendedConnections({ gameId, userId }));
  }, [gameId, userId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTabChange = useCallback((tab) => {
    setActiveTab(tab);
    setSearchQuery('');
  }, []);

  const getActiveList = useCallback(() => {
    switch (activeTab) {
      case CONNECTION_TABS.FOLLOWERS:
        return followersConnections;
      case CONNECTION_TABS.RECOMMENDED:
        return recommendedConnections;
      default:
        return inProgressConnections;
    }
  }, [activeTab, inProgressConnections, followersConnections, recommendedConnections]);

  const filteredList = getActiveList().filter((w) =>
    w.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ---------------------------------------------------------------------------
  // Button actions per tab
  // ---------------------------------------------------------------------------
  const handleButtonPress = useCallback(
    (connection) => {
      switch (activeTab) {
        case CONNECTION_TABS.IN_PROGRESS:
          // dispatch(sendMessage({ gameId, userId, ConnectionId: Connection.id }));
          break;
        case CONNECTION_TABS.FOLLOWERS:
          // dispatch(unfollowConnection({ gameId, userId, ConnectionId: Connection.id }));
          break;
        case CONNECTION_TABS.RECOMMENDED:
          // dispatch(followConnection({ gameId, userId, ConnectionId: Connection.id }));
          break;
        default:
          break;
      }
    },
    [activeTab, gameId, userId]
  ); // eslint-disable-line react-hooks/exhaustive-deps

  const buttonLabel = t(BUTTON_I18N_BY_TAB[activeTab]);

  return (
    <Modal animationType="slide" visible statusBarTranslucent>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ConnectionsTopBar title={username || t('ConnectionsTitle')} onBack={onBack} />

        <ConnectionsTab activeTab={activeTab} onTabChange={handleTabChange} />

        {/* Search row */}
        <View style={styles.searchWrapper}>
          <View style={styles.searchBar}>
            <View style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder={t('connectionsSearch')}
              placeholderTextColor={Colors.text.secondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
            />
          </View>
        </View>

        {/* Loading */}
        {loading && (
          <View style={styles.centered}>
            <ActivityIndicator color={Colors.primary.dark} />
          </View>
        )}

        {/* Error */}
        {!loading && error && (
          <View style={styles.centered}>
            <Text style={styles.feedbackText}>{t('connectionsError')}</Text>
          </View>
        )}

        {/* Empty */}
        {!loading && !error && filteredList.length === 0 && (
          <View style={styles.centered}>
            <Text style={styles.feedbackText}>{t('connectionsEmpty')}</Text>
          </View>
        )}

        {/* List */}
        {!loading && !error && filteredList.length > 0 && (
          <FlatList
            data={filteredList}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <ConnectionRow
                connection={item}
                buttonLabel={buttonLabel}
                onButtonPress={handleButtonPress}
              />
            )}
            style={styles.list}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          />
        )}
      </SafeAreaView>
    </Modal>
  );
};

ConnectionsList.propTypes = {
  gameId: PropTypes.string.isRequired,
  // userId - הפרופיל שנלחץ (לא המנחה!) - הרשימות (In progress/Followers/
  // Recommended) שייכות למשתמש הזה
  userId: PropTypes.string.isRequired,
  username: PropTypes.string,
  onBack: PropTypes.func.isRequired,
  initialTab: PropTypes.oneOf(Object.values(CONNECTION_TABS)),
};
ConnectionsList.defaultProps = {
  username: undefined,
  initialTab: CONNECTION_TABS.IN_PROGRESS,
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.surface.white,
  },
  searchWrapper: {
    width: '100%',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface.white,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.neutral[100],
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
    height: 40,
  },
  searchIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.text.tertiary,
  },
  searchInput: {
    flex: 1,
    fontFamily: FontFamily.primary,
    fontSize: FontSize.bodyM,
    fontWeight: FontWeight.regular,
    lineHeight: LineHeight.bodyM,
    color: Colors.text.primary,
    padding: 0,
  },
  list: {
    flex: 1,
    backgroundColor: Colors.surface.white,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedbackText: {
    fontFamily: FontFamily.primary,
    fontSize: FontSize.bodyM,
    fontWeight: FontWeight.regular,
    lineHeight: LineHeight.bodyM,
    color: Colors.text.secondary,
  },
});

export default ConnectionsList;
