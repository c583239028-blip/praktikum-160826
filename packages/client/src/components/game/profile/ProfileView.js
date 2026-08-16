import React from 'react';
import PropTypes from 'prop-types';
import { View, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Spacing } from '../../../../constants/design';
import TopBar from './TopBar';
import ProfileInfo from './ProfileInfo';
import ProfileActionButtons from './ProfileActionButtons';
import SuggestedAccounts from './SuggestedAccounts';

export default function ProfileView({
  user,
  suggestedAccounts,
  onBack,
  onAddToGroup,
  onShare,
  onReport,
  onMessage,
  onRemoveFollow,
  onShowAllSuggested,
  onDismissSuggested,
  onFollowSuggested,
}) {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <TopBar
        avatarUrl={user.avatarUrl}
        onBack={onBack}
        onAddToGroup={onAddToGroup}
        onShare={onShare}
        onReport={onReport}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <ProfileInfo user={user} />

        <ProfileActionButtons onMessage={onMessage} onRemoveFollow={onRemoveFollow} />

        <View style={styles.suggestedWrapper}>
          <SuggestedAccounts
            accounts={suggestedAccounts}
            onShowAll={onShowAllSuggested}
            onDismiss={onDismissSuggested}
            onFollow={onFollowSuggested}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

ProfileView.propTypes = {
  user: PropTypes.shape({
    avatarUrl: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    username: PropTypes.string.isRequired,
    bio: PropTypes.string,
    inProgressCount: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    followersLabel: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    liveFeedCount: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  }).isRequired,
  suggestedAccounts: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
      avatarUrl: PropTypes.string.isRequired,
    })
  ),
  onBack: PropTypes.func.isRequired,
  onAddToGroup: PropTypes.func.isRequired,
  onShare: PropTypes.func.isRequired,
  onReport: PropTypes.func.isRequired,
  onMessage: PropTypes.func.isRequired,
  onRemoveFollow: PropTypes.func.isRequired,
  onShowAllSuggested: PropTypes.func.isRequired,
  onDismissSuggested: PropTypes.func.isRequired,
  onFollowSuggested: PropTypes.func.isRequired,
};

ProfileView.defaultProps = {
  suggestedAccounts: [],
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.surface.white,
  },
  scroll: {
    flex: 1,
    backgroundColor: Colors.surface.white,
  },
  content: {
    paddingHorizontal: Spacing['2xl'],
    paddingBottom: Spacing['3xl'],
    gap: Spacing['2xl'],
  },
  suggestedWrapper: {
    marginTop: Spacing.sm,
  },
});
