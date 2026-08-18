import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, useWindowDimensions, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import {
  Colors,
  Spacing,
  BorderRadius,
  TextStyles,
  FontFamily,
} from '../../../../constants/design';
import { PublishButton } from '../PublishButton';

import ReportSvg from '../../../../assets/icons/report.svg';

// TODO: קבוע placeholder זהה לזה שכבר קיים ב-ModeratorScreen.js (DEFAULT_AVATAR_URL) -
// לשקול להוציא למקום משותף אחד כדי לא לשכפל.
const DEFAULT_AVATAR_URL = 'https://placehold.co/112x112/png?text=%20';
/**
 * PlayerProfilePanel
 * Bottom sheet שמציג כרטיס פרופיל שחקן (אווטאר, שם, יוזרניים, סטטיסטיקות,
 * ביו וכפתורי פעולה) - נפתח למשל בלחיצה על שחקן ברשימת המשתתפים.
 * דומה בעיצוב ל-OpenQuestionModal (אותו pattern של overlay + safeArea + card
 * לבן עם פינות עגולות למעלה), אך עם תוכן שונה לגמרי.
 *
 * מרונדר בתוך <Modal> (react-native) ולא <View> עם position:absolute -
 * אותו דפוס בדיוק כמו OpenQuestionModal.js/PlayersDetailModal.js. כך הפאנל
 * יושב בשכבה native נפרדת מעל כל שאר ה-UI (כולל שכבת הווידאו, ה-NAV ופאנל
 * השאלות הפתוחות), ולחיצות על הכפתורים מגיעות תמיד ליעד הנכון.
 *
 * מיקום: components/game/ - רמה אחת מעל questionModerator/ (בכוונה, לפי הנחיה).
 *
 * כל התוכן מגיע דרך ה-prop `player`; יש ברירת מחדל מלאה כדי שאפשר יהיה
 * להרים את הקומפוננטה גם בלי להעביר props (לצורך בדיקה/פיתוח).
 *
 * Props:
 *   player — {
 *     name, username, avatarUri,
 *     inProgressCount, followersCount, bio,
 *     isFollowing,
 *   }
 *   onClose — () => void
 *   onReport — () => void
 *   onFollow — () => void
 *   onGoToProfile — () => void
 *   onRemoveTracking — () => void
 */
export function PlayerProfilePanel({
  player,
  onClose,
  onReport,
  onFollow,
  onGoToProfile,
  onRemoveTracking,
}) {
  const { t } = useTranslation('game');
  const { height: windowHeight } = useWindowDimensions();

  const {
    name,
    username,
    avatarUri,
    inProgressCount,
    followersCount,
    bio,
    isFollowing,
  } = player;

  return (
    <Modal
      transparent
      visible
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <SafeAreaView
          edges={['bottom']}
          style={[styles.safeArea, { maxHeight: windowHeight * 0.85 }]}
        >
          <View style={styles.card}>
            {/* ── שורת אווטאר + שם/יוזרניים + כפתור דיווח ─────────────────── */}
            <View style={styles.playerCardRow}>
              <Image
                source={{ uri: avatarUri || DEFAULT_AVATAR_URL }}
                style={styles.avatar}
              />

              <View style={styles.nameCol}>
                <Text style={styles.name} numberOfLines={1}>
                  {name}
                </Text>
                <Text style={styles.username} numberOfLines={1}>
                  {username}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.reportButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                onPress={onReport}
              >
                <ReportSvg width={20} height={20} color={Colors.text.tertiary} />
              </TouchableOpacity>

              {/* כפתור סגירה (X) - בתמונות הדוגמה מופיע בפינה, לא חלק מה-Player Card
                  עצמו אלא מה-Action Panel - ממוקם absolute כדי לא להשפיע על הרוחב */}
              <TouchableOpacity
                style={styles.closeButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                onPress={onClose}
              >
                <Text style={styles.closeIcon}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* ── סטטיסטיקות (pills) + ביו ─────────────────────────────────── */}
            <View style={styles.statsAndBio}>
              <View style={styles.badgesRow}>
                <View style={styles.badge}>
                  <Text style={styles.badgeText} numberOfLines={1}>
                    {t('playerProfile.inProgress', {
                      defaultValue: '{{count}} in progress',
                      count: inProgressCount,
                    })}
                  </Text>
                </View>
                <View style={styles.badge}>
                  <Text style={styles.badgeText} numberOfLines={1}>
                    {t('playerProfile.followers', {
                      defaultValue: '{{count}} followers',
                      count: followersCount,
                    })}
                  </Text>
                </View>
              </View>

              {!!bio && (
                <Text style={styles.bio} numberOfLines={3}>
                  {bio}
                </Text>
              )}
            </View>

            {/* ── כפתורי פעולה: Follow+Go to profile / Remove tracking ────── */}
            <View style={styles.actions}>
              {isFollowing ? (
                <PublishButton
                  label={t('playerProfile.removeTracking', 'Remove tracking')}
                  variant="secondary"
                  onPress={onRemoveTracking}
                />
              ) : (
                <>
                  <PublishButton
                    label={t('playerProfile.follow', 'Follow')}
                    variant="primary"
                    onPress={onFollow}
                  />
                  <PublishButton
                    label={t('playerProfile.goToProfile', 'Go to profile')}
                    variant="secondary"
                    onPress={onGoToProfile}
                  />
                </>
              )}
            </View>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

PlayerProfilePanel.propTypes = {
  player: PropTypes.shape({
    name: PropTypes.string,
    username: PropTypes.string,
    avatarUri: PropTypes.string,
    inProgressCount: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    followersCount: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    bio: PropTypes.string,
    isFollowing: PropTypes.bool,
  }),
  onClose: PropTypes.func,
  onReport: PropTypes.func,
  onFollow: PropTypes.func,
  onGoToProfile: PropTypes.func,
  onRemoveTracking: PropTypes.func,
};

// ברירות מחדל - בעיקר לצורך בדיקה/פיתוח, לפי הדוגמה מה-Figma (Maor Karmi)
PlayerProfilePanel.defaultProps = {
  player: {
    name: 'Maor Karmi',
    username: '@usernoam5236',
    avatarUri: '',
    inProgressCount: 215,
    followersCount: '13.6K',
    bio:
      'Noam is a graphic designer and illustrator from Tel Aviv. He loves to create whimsical characters and bring them to life through animation.',
    isFollowing: false,
  },
  onClose: () => {},
  onReport: () => {},
  onFollow: () => {},
  onGoToProfile: () => {},
  onRemoveTracking: () => {},
};

// ─── STYLES ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // ── Full-screen wrapper (Modal כבר מספק את שכבת ה-overlay) שממקם את
  // הפאנל צמוד לתחתית המסך - אותו pattern בדיוק כמו OpenQuestionModal.js ──
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  safeArea: {
    backgroundColor: Colors.surface.white,
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  card: {
    backgroundColor: Colors.surface.white,
    // Figma: Padding Top spacing/3xl, Right 16, Bottom spacing/2xl, Left 16, Gap spacing/2xl
    paddingTop: Spacing['3xl'],
    paddingRight: Spacing.xl,
    paddingBottom: Spacing['2xl'],
    paddingLeft: Spacing.xl,
    gap: Spacing['2xl'],
  },

  // ── Player Card Row (avatar + name/username + report) ───────────────────
  playerCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg, // 12px
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.full,
    borderWidth: 2,
    borderColor: Colors.surface.white,
    backgroundColor: Colors.neutral[100],
  },
  nameCol: {
    flex: 1,
    justifyContent: 'center',
  },
  name: {
    // Figma "Subtitle/L" 18/24 bold -> תואם ל-subtitleM בטוקנים הקיימים
    ...TextStyles.subtitleM,
    fontFamily: FontFamily.primary,
    color: Colors.text.primary,
  },
  username: {
    // Figma "Subtitle/M" 16/20 -> תואם למידות bodyL, בצבע tertiary
    ...TextStyles.bodyLRegular,
    fontFamily: FontFamily.primary,
    color: Colors.text.tertiary,
  },
  reportButton: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.neutral[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: -Spacing.xl,
    right: 0,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIcon: {
    fontSize: 16,
    color: Colors.text.primary,
  },

  // ── Stats badges + bio ───────────────────────────────────────────────────
  statsAndBio: {
    gap: Spacing.md, // 8px
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  badge: {
    backgroundColor: Colors.neutral[100],
    borderRadius: BorderRadius.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  badgeText: {
    ...TextStyles.bodyMMedium,
    fontFamily: FontFamily.primary,
    color: Colors.text.primary,
    textAlign: 'center',
  },
  bio: {
    ...TextStyles.captionRegular,
    fontFamily: FontFamily.primary,
    color: Colors.text.secondary,
  },

  // ── Actions ───────────────────────────────────────────────────────────────
  actions: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
});

export default PlayerProfilePanel;