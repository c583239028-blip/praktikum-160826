import React from 'react';
import PropTypes from 'prop-types';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { Colors, Spacing } from '../../../../constants/design';
import HeaderIconButton from '../ui/HeaderIconButton';
import Avatar from './Avatar';
import { BackIcon, UserGroupAddIcon, ShareIcon, FlagIcon } from './index';

const TOP_BAR_HEIGHT = 124;
const AVATAR_SIZE = 96;

// Renders the gradient header AND the profile avatar, which visually
// straddles the boundary between the gradient and the white content below.
// It lives outside the page's ScrollView (see ProfileView) so the overlap
// isn't clipped by the scroll container.
export default function TopBar({ avatarUrl, onBack, onAddToGroup, onShare, onReport }) {
  const { t } = useTranslation();

  return (
    <View style={styles.wrapper}>
      <LinearGradient
        colors={[Colors.primary.default, Colors.secondary.default]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <View style={styles.row}>
          <TouchableOpacity
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel={t('watchers.goBack')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <BackIcon color={Colors.surface.white} />
          </TouchableOpacity>

          <View style={styles.actions}>
            <HeaderIconButton onPress={onAddToGroup} accessibilityLabel={t('watchers.addToGroup')}>
              <UserGroupAddIcon size={20} color={Colors.surface.white} />
            </HeaderIconButton>
            <HeaderIconButton onPress={onShare} accessibilityLabel={t('watchers.shareProfile')}>
              <ShareIcon size={20} color={Colors.surface.white} />
            </HeaderIconButton>
            <HeaderIconButton onPress={onReport} accessibilityLabel={t('watchers.reportProfile')}>
              <FlagIcon size={20} color={Colors.surface.white} />
            </HeaderIconButton>
          </View>
        </View>
      </LinearGradient>

      <Avatar uri={avatarUrl} size={AVATAR_SIZE} borderWidth={3} style={styles.avatar} />
    </View>
  );
}

TopBar.propTypes = {
  avatarUrl: PropTypes.string.isRequired,
  onBack: PropTypes.func.isRequired,
  onAddToGroup: PropTypes.func.isRequired,
  onShare: PropTypes.func.isRequired,
  onReport: PropTypes.func.isRequired,
};

const styles = StyleSheet.create({
  wrapper: {
    // overflow visible (RN default) so the avatar can overlap the edge below
  },
  gradient: {
    height: TOP_BAR_HEIGHT,
    paddingHorizontal: Spacing.xl,
    justifyContent: 'flex-start',
    paddingTop: Spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
  },
  avatar: {
    position: 'absolute',
    left: Spacing['2xl'],
    bottom: -(AVATAR_SIZE / 2),
  },
});
