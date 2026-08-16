import React, { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
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
import { AnswerOption } from './AnswerOption';
import { PublishButton } from '../PublishButton';
import Vector1Svg from '../../../../assets/icons/vectore1.svg';
import XSvg from '../../../../assets/icons/close.svg';

/**
 * OpenQuestionModal
 * מודל "שאלה פתוחה" שמופיע כ-bottom sheet מעל מסך השידור (ראו Figma: WorId Game (Shira)).
 * שונה מ-OpenQuestionCard (שנמצא ברשימה): כאן זה overlay עם כפתור סגירה (X)
 * ולינק "For all open questions" בתחתית.
 *
 * מרונדר בתוך <Modal> (react-native) ולא <View> עם position:absolute -
 * אותו דפוס כמו PlayersDetailModal.js. כך המודל יושב בשכבה native נפרדת
 * מעל כל שאר ה-UI (כולל שכבת הווידאו), ולחיצות (X / "For all open questions")
 * מגיעות תמיד ליעד הנכון בלי pointerEvents="box-none".
 *
 * כל התוכן (שאלה + תשובות) מגיע דרך ה-prop `question`.
 * onPublish נקרא עם (questionId, selectedAnswerId) בלחיצה על כפתור הפרסום.
 * onClose נקרא בלחיצה על ה-X.
 * onViewAllQuestions נקרא בלחיצה על "For all open questions".
 *
 * Props:
 *   question — { id, text, answers: [{ id, text }] }
 *   onPublish — (questionId: string, selectedAnswerId: string) => void
 *   onClose — () => void
 *   onViewAllQuestions — () => void
 */
export function OpenQuestionModal({
  question,
  onPublish,
  onClose,
  onViewAllQuestions,
})
{
  const { t } = useTranslation('question');
  const [selectedAnswerId, setSelectedAnswerId] = useState(null);
  const { height: windowHeight } = useWindowDimensions();

  const handleCancel = () => {
    setSelectedAnswerId(null);
    onClose();
  };

  const handlePublish = () => {
    if (!selectedAnswerId) return;
    onPublish(question.id, selectedAnswerId);
  };

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
            {/* ── כותרת + כפתור סגירה ─────────────────────────────────────── */}
            <View style={styles.headerRow}>
              <View style={styles.headerSpacer} />
              <Text style={styles.title}>{t('openQuestions')}</Text>
              <TouchableOpacity
                style={styles.closeButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                onPress={onClose}
              >
                <XSvg width={24} height={24} color={Colors.text.primary} />
              </TouchableOpacity>
            </View>

            {/* ── טקסט השאלה ──────────────────────────────────────────────── */}
            <Text style={styles.questionText}>{question.text}</Text>

            {/* ── עמודת תשובות ─────────────────────────────────────────────── */}
            <View style={styles.answersCol}>
              {question.answers.map((ans) => (
                <TouchableOpacity
                  key={ans.id}
                  onPress={() => setSelectedAnswerId(ans.id)}
                  activeOpacity={0.8}
                >
                  <AnswerOption
                    text={ans.text}
                    selected={ans.id === selectedAnswerId}
                  />
                </TouchableOpacity>
              ))}
            </View>

            {/* ── פעולות: Cancel / Publish ────────────────────────────────── */}
            <View style={styles.actions}>
              <PublishButton
                label={t('cancel')}
                variant="secondary"
                onPress={handleCancel}
              />
              <PublishButton
                label={t('publishingResults')}
                variant="primary"
                disabled={!selectedAnswerId}
                onPress={handlePublish}
              />
            </View>

            {/* ── לינק לכל השאלות הפתוחות ─────────────────────────────────── */}
            <TouchableOpacity
              style={styles.viewAllRow}
              onPress={onViewAllQuestions}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.viewAllText}>{t('forAllOpenQuestions')}</Text>
              <Vector1Svg
                width={12}
                height={7}
                color={Colors.text.tertiary}
                style={styles.viewAllChevron}
              />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

OpenQuestionModal.propTypes = {
  question: PropTypes.shape({
    id: PropTypes.string.isRequired,
    text: PropTypes.string.isRequired,
    answers: PropTypes.arrayOf(
      PropTypes.shape({
        id: PropTypes.string.isRequired,
        text: PropTypes.string.isRequired,
      })
    ).isRequired,
  }).isRequired,
  onPublish: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  onViewAllQuestions: PropTypes.func.isRequired,
};

// ─── STYLES ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // ── Full-screen wrapper (Modal already provides the overlay layer) that
  // pins the sheet to the bottom of the screen ──
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  safeArea: {
    backgroundColor: Colors.surface.white,
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    overflow: 'hidden',
    // צל עדין במקום בורדר צבעוני, כדי שהמודל "יצוף" מעל הווידאו
    shadowColor: Colors.neutral[900],
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 12,
  },
  card: {
    backgroundColor: Colors.surface.white,
    padding: Spacing.xl,
    gap: Spacing['2xl'],
  },

  // ── Header row ──────────────────────────────────────────────────────────
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  headerSpacer: {
    width: 24,
  },
  title: {
    ...TextStyles.h2,
    fontFamily: FontFamily.primary,
    color: Colors.text.primary,
    textAlign: 'center',
    flex: 1,
    paddingTop: 2,
  },
  closeButton: {
    width: 24,
    alignItems: 'flex-end',
  },

  // ── Question text ────────────────────────────────────────────────────────
  questionText: {
    ...TextStyles.bodyLMedium,
    fontFamily: FontFamily.primary,
    color: Colors.text.primary,
  },

  // ── Answers ───────────────────────────────────────────────────────────────
  answersCol: {
    gap: Spacing.xl,
  },

  // ── Actions ───────────────────────────────────────────────────────────────
  actions: {
    flexDirection: 'row',
    gap: Spacing.md,
  },

  // ── View all link ────────────────────────────────────────────────────────
  viewAllRow: {
    flexDirection: 'row',
    alignSelf: 'center',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  viewAllText: {
    ...TextStyles.bodyMMedium,
    fontFamily: FontFamily.primary,
    color: Colors.text.secondary,
  },
  viewAllChevron: {
    transform: [{ rotate: '-90deg' }],
  },
});
