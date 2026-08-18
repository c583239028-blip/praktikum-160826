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
import EditSvg from '../../../../assets/icons/edit.svg';
import MoreSvg from '../../../../assets/icons/more.svg'; // TODO: replace with correct icon

/**
 * DraftQuestionCard
 * Question card in DraftQuestionsList.
 * Tapping the arrow expands the answers + Delete/Publish buttons.
 * Tapping Edit → onEdit(question)
 * Tapping ··· → onAdvanced(question)
 *
 * Props:
 *   question   — { id, authorName? (optional until SCRUM-261), text, answers: [{ id, text }] }
 *   onEdit     — (question) => void
 *   onAdvanced — (question) => void
 *   onDelete   — (questionId) => void
 *   onPublish  — (questionId) => void
 */
export function DraftQuestionCard({
  question,
  onEdit,
  onAdvanced,
  onDelete,
  onPublish,
}) {
  const { t } = useTranslation('question');
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={[styles.card, expanded && styles.cardExpanded]}>
      {expanded ? (
        <View style={styles.expandedHeader}>
          <View style={styles.avatarSmall} />
          {question.authorName ? (
            <View style={styles.authorCol}>
              <Text style={styles.authorName}>
                {question.authorName.split(' ')[0]}
              </Text>
              <Text style={styles.authorName}>
                {question.authorName.split(' ')[1] ?? ''}
              </Text>
            </View>
          ) : null}
          <TouchableOpacity
            style={styles.editBtn}
            onPress={() => onEdit(question)}
          >
            <EditSvg width={14} height={14} color={Colors.text.secondary} />
            <Text style={styles.editLabel}>{t('draftQuestions.edit')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            onPress={() => onAdvanced(question)}
          >
            <MoreSvg width={20} height={20} color={Colors.text.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            onPress={() => setExpanded(false)}
          >
            <Vector1Svg
              width={12}
              height={7}
              color={Colors.text.primary}
              style={styles.chevronUp}
            />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.collapsedHeader}>
          <View style={styles.avatar} />
          <View style={styles.textCol}>
            {question.authorName ? (
              <Text style={styles.authorName}>{question.authorName}</Text>
            ) : null}
            <Text style={styles.questionText} numberOfLines={3}>
              {question.text}
            </Text>
          </View>
          <TouchableOpacity
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            onPress={() => setExpanded(true)}
          >
            <Vector1Svg width={12} height={7} color={Colors.text.primary} />
          </TouchableOpacity>
        </View>
      )}

      {expanded && (
        <View style={styles.expandedBody}>
          <Text style={styles.questionTextExpanded}>{question.text}</Text>

          <View style={styles.answersCol}>
            {question.answers.map((ans) => (
              <AnswerOption key={ans.id} text={ans.text} selected={false} />
            ))}
          </View>

          <View style={styles.actions}>
            <PublishButton
              label={t('draftQuestions.delete')}
              variant="secondary"
              onPress={() => onDelete(question.id)}
            />
            <PublishButton
              label={t('draftQuestions.publish')}
              variant="primary"
              onPress={() => onPublish(question.id)}
            />
          </View>
        </View>
      )}
    </View>
  );
}

DraftQuestionCard.propTypes = {
  question: PropTypes.shape({
    id: PropTypes.string.isRequired,
    authorName: PropTypes.string,
    text: PropTypes.string.isRequired,
    answers: PropTypes.arrayOf(
      PropTypes.shape({
        id: PropTypes.string.isRequired,
        text: PropTypes.string.isRequired,
      })
    ).isRequired,
  }).isRequired,
  onEdit: PropTypes.func.isRequired,
  onAdvanced: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
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

  collapsedHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  avatar: {
    width: 32, // no exact design token match - verify with designer
    height: 32,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.neutral[200],
  },
  textCol: {
    flex: 1,
    gap: 2, // no exact design token match - verify with designer
  },
  authorName: {
    ...TextStyles.captionRegular,
    fontSize: 10, // no exact design token match - verify with designer
    lineHeight: 14,
    color: Colors.text.secondary,
    fontFamily: 'Rubik',
  },
  questionText: {
    ...TextStyles.bodyLRegular,
    color: Colors.text.primary,
    fontFamily: 'Rubik',
  },

  expandedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  avatarSmall: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.neutral[200],
  },
  authorCol: {
    gap: 0,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginLeft: 'auto',
  },
  editLabel: {
    ...TextStyles.captionMedium,
    color: Colors.text.secondary,
    fontFamily: 'Rubik',
  },
  chevronUp: {
    transform: [{ rotate: '180deg' }],
  },

  expandedBody: {
    gap: Spacing.md,
  },
  questionTextExpanded: {
    ...TextStyles.bodyLRegular,
    color: Colors.text.primary,
    fontFamily: 'Rubik',
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
