import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import {
  Colors,
  Spacing,
  BorderRadius,
  TextStyles,
} from '../../../../constants/design';
import { AnswerOption } from './AnswerOption';
import { PublishButton } from '../PublishButton';
import Vector1Svg from '../../../../assets/icons/vectore1.svg';

/**
 * OpenQuestionCard
 * כרטיסיית שאלה פתוחה (live) ב-OpenQuestionsList.
 * שונה מ-DraftQuestionCard: בלי אווטאר/Edit/···, יש שורת מטא
 * (participants + שעה), ובחירת תשובה היא אינטראקטיבית.
 * לחיצה על Cancel סוגרת את הכרטיס בלי לפרסם תוצאה.
 * לחיצה על Publish שולחת את התשובה שנבחרה ל-onPublish.
 *
 * Props:
 *   question — { id, text, participantsCount, time, answers: [{ id, text }] }
 *   onPublish — (questionId: string, selectedAnswerId: string) => void
 */
export function OpenQuestionCard({ question, onPublish }) {
  const { t } = useTranslation('question');
  const [expanded, setExpanded] = useState(false);
  const [selectedAnswerId, setSelectedAnswerId] = useState(null);

  const handleCancel = () => {
    setExpanded(false);
    setSelectedAnswerId(null);
  };

  const handlePublish = () => {
    if (!selectedAnswerId) return;
    onPublish(question.id, selectedAnswerId);
  };

  return (
    <View style={[styles.card, expanded && styles.cardExpanded]}>
      {/* ── שורה עליונה ─────────────────────────────────────────────────── */}
      <View style={styles.headerRow}>
        <Text
          style={styles.questionText}
          numberOfLines={expanded ? undefined : 2}
        >
          {question.text}
        </Text>
        <TouchableOpacity
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          onPress={() => (expanded ? handleCancel() : setExpanded(true))}
        >
          <Vector1Svg
            width={12}
            height={7}
            color={Colors.text.primary}
            style={expanded && styles.chevronUp}
          />
        </TouchableOpacity>
      </View>

      {/* ── שורת מטא (משתתפים + שעה) ───────────────────────────────────── */}
      {!expanded && (
        <View style={styles.metaRow}>
          <Text style={styles.metaText}>
            {t('participantsCount', {
              count: question.participantsCount,
            })}
          </Text>
          <Text style={styles.metaText}>{question.time}</Text>
        </View>
      )}

      {/* ── תוכן מורחב: תשובות + Cancel/Publish ────────────────────────── */}
      {expanded && (
        <View style={styles.expandedBody}>
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

          <View style={styles.actions}>
            <PublishButton
              label={t('cancel')}
              variant="secondary"
              onPress={handleCancel}
            />
            <PublishButton
              label={t('publish')}
              variant="primary"
              disabled={!selectedAnswerId}
              onPress={handlePublish}
            />
          </View>
        </View>
      )}
    </View>
  );
}

OpenQuestionCard.propTypes = {
  question: PropTypes.shape({
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
  }).isRequired,
  onPublish: PropTypes.func.isRequired,
};

// ─── STYLES ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: Colors.neutral[200],
    borderRadius: BorderRadius.sm,
    padding: Spacing.lg,
    backgroundColor: Colors.surface.white,
    gap: Spacing.md,
  },
  cardExpanded: {
    borderColor: Colors.primary.default,
  },

  // ── Header row ──────────────────────────────────────────────────────────────
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  questionText: {
    ...TextStyles.bodyLRegular,
    fontFamily: 'Rubik',
    color: Colors.text.primary,
    flex: 1,
  },
  chevronUp: {
    transform: [{ rotate: '180deg' }],
  },

  // ── Meta row ────────────────────────────────────────────────────────────────
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metaText: {
    ...TextStyles.captionRegular,
    fontFamily: 'Rubik',
    color: Colors.text.tertiary,
  },

  // ── Expanded body ───────────────────────────────────────────────────────────
  expandedBody: {
    gap: Spacing.md,
  },
  answersCol: {
    gap: Spacing.md,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
});
