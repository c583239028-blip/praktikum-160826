import { useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import LazyAuthModal from '../components/LazyAuthModal';
import Screen from '../components/Screen';
import {
  Colors,
  Spacing,
  BorderRadius,
  FontSize,
  FontWeight,
} from '../../constants/design';
import { useScale } from '../hooks/useScale';

export default function UserProfileScreen() {
  const { t } = useTranslation('profile');
  const { user, isGuest, isLoading, logout } = useAuth();
  const [imageError, setImageError] = useState(false);
  const { scale } = useScale();
  // מונע "flash" של LazyAuthModal בזמן טעינת הסשן
  if (isLoading) return null;

  const handleLogout = async () => {
    try {
      await logout();
    } catch (e) {
      console.error('logout failed', e);
      Alert.alert(t('logout_error_title'), t('logout_error_message'));
    }
  };

  const showImageAvatar = user?.photoURL && !imageError;

  return (
    <Screen style={styles.container}>
      {/* Avatar */}
      {showImageAvatar ? (
        <Image
          source={{ uri: user.photoURL }}
          style={styles.avatar}
          onError={() => setImageError(true)}
        />
      ) : (
        <View style={styles.avatarPlaceholder}>
          <Text style={[styles.avatarLetter, { fontSize: scale(FontSize.h1) }]}>
            {' '}
            {user?.displayName?.[0]?.toUpperCase() ?? '?'}
          </Text>
        </View>
      )}

      {/* פרטי משתמש */}
      <Text
        style={[styles.username, { fontSize: scale(FontSize.subtitleM) }]}
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {user?.displayName ?? user?.email ?? ''}
      </Text>
      <Text style={styles.email} numberOfLines={1} ellipsizeMode="tail">
        {user?.email}
      </Text>
      {/* התנתקות */}
      <TouchableOpacity style={styles.signOutButton} onPress={handleLogout}>
        <Text style={styles.buttonText}>{t('common:sign_out_button')}</Text>
      </TouchableOpacity>

      {/* אורח לא יכול לסגור את המודל — חייב לעבור אימות */}
      <LazyAuthModal visible={isGuest} onClose={() => {}} />
    </Screen>
  );
}

const AVATAR_SIZE = 96;
const AVATAR_RADIUS = AVATAR_SIZE / 2;
const AVATAR_MARGIN_BOTTOM = Spacing.md;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xl,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_RADIUS,
    marginBottom: AVATAR_MARGIN_BOTTOM,
  },
  avatarPlaceholder: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_RADIUS,
    backgroundColor: Colors.neutral[300],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: AVATAR_MARGIN_BOTTOM,
  },
  avatarLetter: {
    color: Colors.surface.white,
    fontWeight: FontWeight.semiBold,
  },
  username: {
    color: Colors.text.primary,
    fontWeight: FontWeight.semiBold,
  },
  email: {
    color: Colors.text.tertiary,
    fontSize: FontSize.bodyM,
  },
  signOutButton: {
    backgroundColor: Colors.neutral[200],
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing['3xl'],
    borderRadius: BorderRadius.lg,
    width: 200,
    alignItems: 'center',
  },
  buttonText: {
    color: Colors.text.primary,
    fontSize: FontSize.bodyL,
    fontWeight: FontWeight.semiBold,
  },
});
