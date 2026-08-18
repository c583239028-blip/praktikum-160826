import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Dimensions,
} from 'react-native';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { DialogButton } from './DialogButton';
import CloseSvg from '../../../../assets/icons/close.svg';
import UserSvg from '../../../../assets/icons/user.svg';
import {
  Colors,
  Spacing,
  BorderRadius,
  TextStyles,
} from '../../../../constants/design';
// import { SCREEN_WIDTH, SCREEN_HEIGHT } from '../../constants';
const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const scaleW = SCREEN_WIDTH / 375;
const scaleH = SCREEN_HEIGHT / 812;

export function InvitationDialog({
  inviterName,
  inviterImageUri,
  onAccept,
  onReject,
  role,
  initialCountdown,
}) {
  const { t } = useTranslation('invitation');
  const [secondsLeft, setSecondsLeft] = useState(initialCountdown);

  // ── טיימר ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (secondsLeft <= 0) {
      onReject();
      return;
    }

    const id = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [secondsLeft]);

  const handleAccept = () => {
    onAccept();
  };

  const handleReject = () => {
    onReject();
  };

  return (
    <Modal transparent animationType="slide" visible={true}>
      <View style={styles.figmaOverlay}>
        <View style={styles.figmaDialogCard}>
          {/* X — סגירה */}
          <TouchableOpacity
            onPress={handleReject}
            style={styles.figmaCloseContainer}
            hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
          >
            <CloseSvg width={24} height={24} color={Colors.text.primary} />
          </TouchableOpacity>

          {/* אייקון + כותרת */}
          <View style={styles.figmaTopSection}>
            <View style={styles.figmaIconCircle}>
              <UserSvg width={24} height={24} color={Colors.primary.dark} />
            </View>
            <Text style={styles.figmaDialogTitle}>{t(`title.${role}`)}</Text>
          </View>

          {/* שם + תמונה + תיאור */}
          <View style={styles.figmaSenderBlock}>
            <View style={styles.figmaSenderRow}>
              <Text style={styles.figmaSenderName}>{inviterName}</Text>
              <View style={styles.figmaAvatarCircle}>
                {inviterImageUri ? (
                  <Image
                    source={{ uri: inviterImageUri }}
                    style={styles.figmaAvatarImage}
                  />
                ) : (
                  <View style={styles.figmaAvatarPlaceholder} />
                )}
              </View>
            </View>
            <Text style={styles.figmaDialogBody}>{t(`body.${role}`)}</Text>
          </View>

          {/* כפתורים */}
          <View style={styles.figmaActionsColumn}>
            <DialogButton
              label={t('approved')}
              variant="primary"
              onPress={handleAccept}
            />
            <DialogButton
              label={t('rejected', { seconds: secondsLeft })}
              variant="secondary"
              onPress={handleReject}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

InvitationDialog.propTypes = {
  inviterName: PropTypes.string.isRequired,
  inviterImageUri: PropTypes.string,
  onAccept: PropTypes.func.isRequired,
  onReject: PropTypes.func.isRequired,
  role: PropTypes.oneOf(['player', 'moderator']).isRequired,
  initialCountdown: PropTypes.number.isRequired,
};
const styles = StyleSheet.create({
  figmaOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  figmaDialogCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * (436 / 809),
    justifyContent: 'center',
    backgroundColor: Colors.surface.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    paddingHorizontal: Spacing['2xl'],
    gap: Spacing.xl,
  },
  // ── כפתור X ──────────────────────────────────────────────────────────────────
  figmaCloseContainer: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 24,
    height: 24,
  },
  // ── אייקון עגול + כותרת ──────────────────────────────────────────────────────
  figmaTopSection: {
    width: '100%',
    alignItems: 'center',
    gap: Spacing.xl,
    // paddingHorizontal: Spacing['2xl'],
    paddingBottom: 16,
  },
  figmaIconCircle: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary.light,
    justifyContent: 'center',
    alignItems: 'center',
  },
  figmaDialogTitle: {
    ...TextStyles.subtitleM,
    textAlign: 'center',
    width: '100%',
  },

  // ── בלוק שם מזמין ─────────────────────────────────────────────────────────────
  figmaSenderBlock: {
    width: '100%',
    borderRadius: BorderRadius.sm,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.none,
    gap: Spacing.sm,
  },
  figmaSenderRow: {
    flexDirection: 'row',
    alignSelf: 'center',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  figmaSenderName: {
    ...TextStyles.bodyLMedium,
    textAlign: 'right',
  },
  figmaAvatarCircle: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
  },
  figmaAvatarPlaceholder: {
    width: 40,
    height: 40,
    backgroundColor: '#D9D9D9', // להחליף ב-<Image> עם source={uri}
  },
  figmaAvatarImage: {
    width: 40,
    height: 40,
  },
  figmaDialogBody: {
    ...TextStyles.bodyLRegular,
    textAlign: 'center',
    width: '100%',
  },

  // ── כפתורים ───────────────────────────────────────────────────────────────────
  figmaActionsColumn: {
    gap: Spacing.md,
  },
  figmaAcceptBtn: {
    width: '100%',
    height: 44,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary.default,
    paddingVertical: 8,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  figmaAcceptBtnText: {
    ...TextStyles.bodyLMedium,
    color: Colors.text.primary,
  },
  figmaRejectBtn: {
    width: '100%',
    height: 44,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.text.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  figmaRejectBtnText: {
    ...TextStyles.bodyLMedium,
    color: Colors.text.primary,
  },
});
