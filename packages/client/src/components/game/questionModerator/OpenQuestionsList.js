import React, { useState, useRef } from 'react';
import { View, Text, Modal, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';
import {
  Colors,
  Spacing,
  BorderRadius,
  TextStyles,
} from '../../../../constants/design';
import { QuestionsScreenHeader } from './QuestionsScreenHeader';
import { OpenQuestionCard } from './OpenQuestionCard';

const TOAST_DURATION_MS = 2500;

/**
 * Toast
 * הודעת אישור קטנה שמופיעה בתחתית המסך אחרי פרסום תוצאה.
 * רכיב פנימי בלבד — שימוש מקומי במסך הזה, כמו QuestionCard ב-ViewerQuestionsList.
 */
function Toast({ message }) {
  if (!message) return null;
  return (
    <View style={styles.toast} pointerEvents="none">
      <Text style={styles.toastText} numberOfLines={1}>
        {message}
      </Text>
    </View>
  );
}

Toast.propTypes = {
  message: PropTypes.string,
};

Toast.defaultProps = {
  message: null,
};

/**
 * OpenQuestionsList
 * מסך "Open Questions" — שאלות פתוחות שעדיין ניתן להצביע/לפרסם תוצאה עבורן.
 * לחיצה על שאלה פותחת אותה (expanded) עם תשובות בחירה + Cancel/Publish.
 * פרסום תוצאה מוציא את השאלה מהרשימה ומציג Toast אישור.
 *
 * Props:
 *   questions — [{ id, text, participantsCount, time, answers: [{ id, text }] }]
 *   onClose   — () => void
 *   onPublish — (questionId, selectedAnswerId) => void  (אופציונלי — לוגיקה אמיתית תתווסף בהמשך)
 */
export function OpenQuestionsList({
  questions: initialQuestions,
  onClose,
  onPublish,
}) {
  const { t } = useTranslation('question');
  const [questions, setQuestions] = useState(initialQuestions);
  const [toastMessage, setToastMessage] = useState(null);
  const toastTimer = useRef(null);

  const handlePublish = (questionId, selectedAnswerId) => {
    onPublish(questionId, selectedAnswerId);
    setQuestions((prev) => prev.filter((q) => q.id !== questionId));

    setToastMessage(t('publishToast'));
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(
      () => setToastMessage(null),
      TOAST_DURATION_MS
    );
  };

  return (
    <Modal animationType="slide" visible statusBarTranslucent>
      <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
        <QuestionsScreenHeader
          title={t('openQuestionsTitle')}
          onBack={onClose}
        />

        <Text style={styles.countLabel}>
          {t('openQuestionsCount', {
            count: questions.length,
          })}
        </Text>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {questions.map((q) => (
            <OpenQuestionCard
              key={q.id}
              question={q}
              onPublish={handlePublish}
            />
          ))}
        </ScrollView>

        <Toast message={toastMessage} />
      </SafeAreaView>
    </Modal>
  );
}

OpenQuestionsList.propTypes = {
  questions: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      text: PropTypes.string.isRequired,
      participantsCount: PropTypes.number,
      time: PropTypes.string,
      answers: PropTypes.arrayOf(
        PropTypes.shape({
          id: PropTypes.string.isRequired,
          text: PropTypes.string.isRequired,
        })
      ).isRequired,
    })
  ).isRequired,
  onClose: PropTypes.func.isRequired,
  onPublish: PropTypes.func,
};

OpenQuestionsList.defaultProps = {
  onPublish: () => {},
};

// ─── STYLES ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.surface.white,
  },
  countLabel: {
    ...TextStyles.captionMedium,
    fontFamily: 'Rubik',
    color: Colors.text.tertiary,
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
    textAlign: 'left',
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
    gap: Spacing.md,
  },

  // ── Toast ───────────────────────────────────────────────────────────────────
  toast: {
    position: 'absolute',
    bottom: Spacing['2xl'],
    left: Spacing.lg,
    right: Spacing.lg,
    backgroundColor: Colors.neutral[900],
    borderRadius: BorderRadius.full,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
  },
  toastText: {
    ...TextStyles.bodyMRegular,
    fontFamily: 'Rubik',
    color: Colors.surface.white,
  },
});
