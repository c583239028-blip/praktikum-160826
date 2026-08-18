import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import {
  Colors,
  Spacing,
  BorderRadius,
  TextStyles,
} from '../../../../constants/design';
import CloseSvg from '../../../../assets/icons/close.svg';
import { PublishButton } from '../PublishButton';
import {
  TIME_LIMIT_OPTIONS,
  DEFAULT_TIME_LIMIT,
} from '../../../../constants/timeLimits';
import { TimeLimitSelector } from './TimeLimitSelector';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/**
 * AdvancedOptionsSheet
 * Bottom sheet for setting a response time limit for a question.
 *
 * Props:
 *   visible         — boolean
 *   initialSeconds  — number (default: 60)
 *   onClose         — () => void
 *   onSave          — (seconds: number) => void
 */
export function AdvancedOptionsSheet({
  visible,
  initialSeconds,
  onClose,
  onSave,
}) {
  const { t } = useTranslation('question');
  const [seconds, setSeconds] = useState(initialSeconds ?? DEFAULT_TIME_LIMIT);

  // No parsing needed anymore — the selector only ever produces one of the fixed values.
  const handleSave = () => {
    onSave(seconds);
    onClose();
  };

  return (
    <Modal transparent animationType="slide" visible={visible}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>
              {t('draftQuestions.advancedOptions')}
            </Text>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <CloseSvg width={24} height={24} color={Colors.text.primary} />
            </TouchableOpacity>
          </View>

          <View style={styles.row}>
            <View style={styles.rowTextCol}>
              <Text style={styles.rowLabel}>
                {t('draftQuestions.setResponseTime')}
              </Text>
              <Text style={styles.rowSub}>
                {t('draftQuestions.setTimeInSeconds')}
              </Text>
            </View>
            <TimeLimitSelector
              options={TIME_LIMIT_OPTIONS}
              value={seconds}
              onChange={setSeconds}
              unitLabel={t('draftQuestions.secondsUnit')}
            />
          </View>

          {/* Save/Cancel — was missing, handleSave existed but had no trigger */}
          <View style={styles.footer}>
            <PublishButton
              label={t('common.cancel')}
              variant="secondary"
              onPress={onClose}
            />
            <PublishButton
              label={t('common.save')}
              variant="primary"
              onPress={handleSave}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

AdvancedOptionsSheet.propTypes = {
  visible: PropTypes.bool.isRequired,
  initialSeconds: PropTypes.number,
  onClose: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  sheet: {
    width: SCREEN_WIDTH,
    backgroundColor: Colors.surface.white,
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    paddingHorizontal: Spacing['2xl'],
    paddingTop: Spacing.xl,
    paddingBottom: Spacing['3xl'],
    gap: Spacing.xl,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    ...TextStyles.subtitleM,
    color: Colors.text.primary,
    fontFamily: 'Rubik',
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.lg,
  },
  rowTextCol: {
    flex: 1,
    gap: 2, // no exact design token match - verify with designer
  },
  rowLabel: {
    ...TextStyles.bodyMRegular,
    color: Colors.text.primary,
    fontFamily: 'Rubik',
  },
  rowSub: {
    ...TextStyles.captionRegular,
    color: Colors.text.tertiary,
    fontFamily: 'Rubik',
  },
  footer: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
});
