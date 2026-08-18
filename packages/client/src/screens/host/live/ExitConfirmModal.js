import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/design';

// Exit-live-broadcast confirmation (Figma 7090-129635). White card over the dark
// live screen: title + host-exit question + cyan "Exit Approval" + Cancel link.
// Pure presentation: visible + onConfirm/onCancel come from the broadcast hook.
export function ExitConfirmModal({ visible, onConfirm, onCancel }) {
  const { t } = useTranslation('host');

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.close}
            onPress={onCancel}
            accessibilityLabel={t('cancel', 'Cancel')}
          >
            <Ionicons name="close" size={22} color={Colors.text.tertiary} />
          </TouchableOpacity>

          <Text style={styles.title}>
            {t('exitBroadcast', 'Exit live broadcast')}
          </Text>
          <Text style={styles.body}>
            {t(
              'exitConfirmQuestion',
              'Are you sure you want to exit the game as the host?'
            )}
          </Text>

          <TouchableOpacity style={styles.confirmPill} onPress={onConfirm}>
            <Text style={styles.confirmText}>
              {t('exitApproval', 'Exit Approval')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelLink} onPress={onCancel}>
            <Text style={styles.cancelText}>{t('cancel', 'Cancel')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

ExitConfirmModal.propTypes = {
  visible: PropTypes.bool,
  onConfirm: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
};

const styles = StyleSheet.create({
  // Bottom sheet — slides up and sits flush to the bottom edge.
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  card: {
    backgroundColor: Colors.surface.white,
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    paddingTop: Spacing['2xl'],
    paddingBottom: Spacing['3xl'],
    paddingHorizontal: Spacing.xl,
    width: '100%',
    alignItems: 'center',
    gap: Spacing.lg,
  },
  close: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
    padding: Spacing.sm,
  },
  title: {
    color: Colors.text.primary,
    fontSize: FontSize.subtitleM,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: Spacing.md,
  },
  body: {
    color: Colors.text.secondary,
    fontSize: FontSize.bodyM,
    textAlign: 'center',
  },
  confirmPill: {
    backgroundColor: Colors.primary.default,
    borderRadius: BorderRadius.xl,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    width: '100%',
    marginTop: Spacing.sm,
  },
  confirmText: {
    color: Colors.text.primary,
    fontSize: FontSize.bodyL,
    fontWeight: 'bold',
  },
  cancelLink: { paddingVertical: Spacing.sm },
  cancelText: { color: Colors.text.secondary, fontSize: FontSize.bodyM },
});
