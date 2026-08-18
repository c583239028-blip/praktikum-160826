import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Colors, Spacing, BorderRadius, TextStyles } from '@/constants/design';

export default function RejectedDialog({ visible, onDismiss }) {
  const { t } = useTranslation('viewer');

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* TODO: replace with real warning icon asset once added to assets/icons */}
          <Text style={styles.iconPlaceholder}>⚠️</Text>
          <Text style={styles.title}>{t('rejected_title')}</Text>
          <Text style={styles.message}>{t('rejected_message')}</Text>

          <TouchableOpacity style={styles.button} onPress={onDismiss}>
            <Text style={styles.buttonText}>{t('rejected_back_button')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

RejectedDialog.propTypes = {
  visible: PropTypes.bool.isRequired,
  onDismiss: PropTypes.func.isRequired,
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing['2xl'],
  },
  card: {
    width: '100%',
    backgroundColor: Colors.surface.white,
    borderRadius: BorderRadius.md,
    padding: Spacing['2xl'],
    alignItems: 'center',
    gap: Spacing.lg,
  },
  iconPlaceholder: {
    fontSize: 32,
    marginBottom: Spacing.sm,
  },
  title: {
    ...TextStyles.subtitleM,
    color: Colors.error.dark,
    textAlign: 'center',
  },
  message: {
    ...TextStyles.bodyMRegular,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  button: {
    marginTop: Spacing.lg,
    backgroundColor: Colors.neutral[100],
    borderRadius: BorderRadius.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing['2xl'],
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  buttonText: {
    ...TextStyles.bodyLMedium,
    color: Colors.text.primary,
  },
});
