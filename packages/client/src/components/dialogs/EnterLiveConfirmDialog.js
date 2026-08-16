import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Colors, Spacing, BorderRadius, TextStyles } from '@/constants/design';

export const ENTER_LIVE_PHASES = {
  CONFIRM: 'confirm',
  ENTERING: 'entering',
  WAITING: 'waiting',
};

export default function EnterLiveConfirmDialog({
  visible,
  phase,
  hostName,
  onConfirm,
  onCancel,
}) {
  const { t } = useTranslation('viewer');

  const renderContent = () => {
    if (phase === ENTER_LIVE_PHASES.ENTERING) {
      return (
        <View style={styles.loadingContent}>
          <ActivityIndicator size="large" color={Colors.surface.white} />
          <Text style={styles.loadingText}>{t('going_live_message')}</Text>
        </View>
      );
    }

    if (phase === ENTER_LIVE_PHASES.WAITING) {
      return (
        <View style={styles.loadingContent}>
          <ActivityIndicator size="large" color={Colors.surface.white} />
          <Text style={styles.loadingText}>
            {t('waiting_broadcast_message')}
          </Text>
        </View>
      );
    }

    // Default: CONFIRM phase — TODO: replace initials-circle placeholder with real host avatar once available
    return (
      <View style={styles.card}>
        <TouchableOpacity style={styles.closeButton} onPress={onCancel}>
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>

        <View style={styles.iconCircle}>
          <Text style={styles.iconGlyph}>👤</Text>
        </View>

        <Text style={styles.title}>{t('enter_live_confirm_title')}</Text>

        <View style={styles.hostRow}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarInitial}>
              {hostName?.charAt(0)?.toUpperCase()}
            </Text>
          </View>
          <Text style={styles.hostName}>{hostName}</Text>
        </View>

        <Text style={styles.message}>{t('enter_live_confirm_message')}</Text>

        <TouchableOpacity style={styles.acceptButton} onPress={onConfirm}>
          <Text style={styles.acceptButtonText}>{t('accept_button')}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.rejectButton} onPress={onCancel}>
          <Text style={styles.rejectButtonText}>
            {t('reject_button_with_timeout')}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  const isFullScreenLoading = phase !== ENTER_LIVE_PHASES.CONFIRM;

  return (
    <Modal
      visible={visible}
      transparent={!isFullScreenLoading}
      animationType="fade"
    >
      <View
        style={isFullScreenLoading ? styles.fullScreenOverlay : styles.overlay}
      >
        {renderContent()}
      </View>
    </Modal>
  );
}

EnterLiveConfirmDialog.propTypes = {
  visible: PropTypes.bool.isRequired,
  phase: PropTypes.oneOf(Object.values(ENTER_LIVE_PHASES)),
  hostName: PropTypes.string,
  onConfirm: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
};

EnterLiveConfirmDialog.defaultProps = {
  phase: ENTER_LIVE_PHASES.CONFIRM,
  hostName: 'Host', // TODO(S3): replace with real host name from server
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing['2xl'],
  },
  fullScreenOverlay: {
    flex: 1,
    backgroundColor: Colors.neutral[900],
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    width: '100%',
    backgroundColor: Colors.surface.white,
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    padding: Spacing['2xl'],
    gap: Spacing.md,
  },
  closeButton: {
    position: 'absolute',
    top: Spacing.lg,
    right: Spacing.lg,
  },
  closeButtonText: {
    ...TextStyles.bodyLMedium,
    color: Colors.text.secondary,
  },
  iconCircle: {
    alignSelf: 'center',
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary.extraLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  iconGlyph: {
    fontSize: 18,
  },
  title: {
    ...TextStyles.subtitleM,
    textAlign: 'center',
  },
  hostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  avatarCircle: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.secondary.light,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    ...TextStyles.bodyMMedium,
    color: Colors.secondary.dark,
  },
  hostName: {
    ...TextStyles.bodyLMedium,
    color: Colors.text.primary,
  },
  message: {
    ...TextStyles.bodyMRegular,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  acceptButton: {
    backgroundColor: Colors.primary.default,
    borderRadius: BorderRadius.sm,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.lg,
  },
  acceptButtonText: {
    ...TextStyles.bodyLMedium,
    color: Colors.text.primary,
  },
  rejectButton: {
    borderWidth: 1,
    borderColor: Colors.neutral[300],
    borderRadius: BorderRadius.full,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  rejectButtonText: {
    ...TextStyles.bodyLMedium,
    color: Colors.text.primary,
  },
  loadingContent: {
    alignItems: 'center',
    gap: Spacing.lg,
  },
  loadingText: {
    ...TextStyles.bodyLMedium,
    color: Colors.surface.white,
    textAlign: 'center',
  },
});
