import { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Switch,
  StyleSheet,
} from 'react-native';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Colors, Spacing, BorderRadius, TextStyles } from '@/constants/design';

// STUB: local toggle state only. Actual OS-level permission requests
// and their wiring to the media pipeline are out of scope (S3).
export default function MicCameraPermissionsScreen({ visible, onContinue }) {
  const { t } = useTranslation('viewer');
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [micEnabled, setMicEnabled] = useState(true);

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>{t('permissions_title')}</Text>
          <Text style={styles.subtitle}>{t('permissions_subtitle')}</Text>

          <View style={styles.row}>
            <View style={styles.rowLabel}>
              <Text style={styles.rowText}>{t('camera_permission_label')}</Text>
            </View>
            <Switch
              value={cameraEnabled}
              onValueChange={setCameraEnabled}
              trackColor={{ true: Colors.primary.default }}
              thumbColor={Colors.surface.white}
            />
          </View>

          <View style={styles.row}>
            <View style={styles.rowLabel}>
              <Text style={styles.rowText}>
                {t('microphone_permission_label')}
              </Text>
            </View>
            <Switch
              value={micEnabled}
              onValueChange={setMicEnabled}
              trackColor={{ true: Colors.primary.default }}
              thumbColor={Colors.surface.white}
            />
          </View>

          <TouchableOpacity
            style={styles.continueButton}
            onPress={() => onContinue({ cameraEnabled, micEnabled })}
          >
            <Text style={styles.continueButtonText}>
              {t('continue_button')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

MicCameraPermissionsScreen.propTypes = {
  visible: PropTypes.bool.isRequired,
  onContinue: PropTypes.func.isRequired,
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: Colors.surface.white,
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    padding: Spacing['2xl'],
    gap: Spacing.lg,
  },
  title: {
    ...TextStyles.h2,
    textAlign: 'center',
  },
  subtitle: {
    ...TextStyles.bodyMRegular,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral[200],
  },
  rowLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  rowText: {
    ...TextStyles.bodyLRegular,
  },
  continueButton: {
    backgroundColor: Colors.primary.default,
    borderRadius: BorderRadius.sm,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.lg,
  },
  continueButtonText: {
    ...TextStyles.bodyLMedium,
    color: Colors.text.primary,
  },
});
