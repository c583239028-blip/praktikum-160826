import React from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';
import {
  Colors,
  Spacing,
  BorderRadius,
  TextStyles,
} from '../../../../constants/design';

const CARD_WIDTH = 291;
const ICON_SIZE = 40;
const ICON_INNER_SIZE = 24;
const BUTTON_HEIGHT = 44;

// Small "X" icon built from two rotated bars — avoids depending on an icon
// library that may not be wired into the project.
function CloseIcon() {
  return (
    <View style={styles.closeIconWrapper}>
      <View style={[styles.closeIconBar, styles.closeIconBarPlus]} />
      <View style={[styles.closeIconBar, styles.closeIconBarMinus]} />
    </View>
  );
}

// "No entry" icon built from a circle + diagonal slash — matches icon/blocked
// from the design without depending on an external icon set.
function BlockedIcon() {
  return (
    <View style={styles.blockedIconCircle}>
      <View style={styles.blockedIconRing}>
        <View style={styles.blockedIconSlash} />
      </View>
    </View>
  );
}

export function NoPermissionToWriteModal({ onClose }) {
  const { t } = useTranslation();

  const handleBackToGame = () => {
    onClose?.();
  };

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={handleBackToGame}
    >
      <SafeAreaView style={styles.overlay}>
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={handleBackToGame}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={t('broadcast.noPermissionToWriteClose')}
          >
            <CloseIcon />
          </TouchableOpacity>

          <BlockedIcon />

          <Text style={styles.heading}>
            {t('broadcast.noPermissionToWriteTitle')}
          </Text>

          <Text style={styles.body}>
            {t('broadcast.noPermissionToWriteBody')}
          </Text>

          <TouchableOpacity
            style={styles.button}
            onPress={handleBackToGame}
            accessibilityRole="button"
          >
            <Text style={styles.buttonText}>
              {t('broadcast.backToGame')}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

NoPermissionToWriteModal.propTypes = {
  onClose: PropTypes.func,
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(2, 9, 23, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  card: {
    width: CARD_WIDTH,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surface.white,
    padding: Spacing['2xl'],
    alignItems: 'center',
    gap: Spacing['2xl'],
  },
  closeButton: {
    alignSelf: 'flex-end',
    width: ICON_INNER_SIZE,
    height: ICON_INNER_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIconWrapper: {
    width: ICON_INNER_SIZE,
    height: ICON_INNER_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIconBar: {
    position: 'absolute',
    width: ICON_INNER_SIZE * 0.7,
    height: 2,
    borderRadius: BorderRadius.xs,
    backgroundColor: Colors.neutral[600],
  },
  closeIconBarPlus: {
    transform: [{ rotate: '45deg' }],
  },
  closeIconBarMinus: {
    transform: [{ rotate: '-45deg' }],
  },
  blockedIconCircle: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary.light,
    alignItems: 'center',
    justifyContent: 'center',
  },
  blockedIconRing: {
    width: ICON_INNER_SIZE,
    height: ICON_INNER_SIZE,
    borderRadius: BorderRadius.full,
    borderWidth: 2,
    borderColor: Colors.primary.dark,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  blockedIconSlash: {
    width: 2,
    height: ICON_INNER_SIZE + 2,
    backgroundColor: Colors.primary.dark,
    transform: [{ rotate: '45deg' }],
  },
  heading: {
    ...TextStyles.subtitleM,
    textAlign: 'center',
  },
  body: {
    ...TextStyles.bodyMMedium,
    textAlign: 'center',
    width: 235,
  },
  button: {
    width: '100%',
    height: BUTTON_HEIGHT,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary.default,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    ...TextStyles.bodyLMedium,
    color: Colors.text.primary,
  },
});

export default NoPermissionToWriteModal;
