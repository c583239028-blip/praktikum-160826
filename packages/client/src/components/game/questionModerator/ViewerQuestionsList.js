import React from 'react';
import Vector1Svg from '../../../../assets/icons/vectore1.svg';

import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
} from 'react-native';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import {
  Colors,
  TextStyles,
  Spacing,
  BorderRadius,
} from '../../../../constants/design';
import { QuestionsScreenHeader } from './QuestionsScreenHeader';

// ─── QUESTION CARD ────────────────────────────────────────────────────────────
// NOTE: exported (only change in this file) so ViewerQuestionsListPartial.js
// can reuse it without duplicating the card markup/styles.

export function QuestionCard({ authorName, text }) {
  return (
    <View style={styles.vqCard}>
      <View style={styles.vqAvatar}>
        {/* תמונת פרופיל — להחליף ב-<Image> כשיש URI */}
        <View style={styles.vqAvatarPlaceholder} />
      </View>
      <View style={styles.vqTextCol}>
        <Text style={styles.vqAuthorName}>{authorName}</Text>
        <Text style={styles.vqQuestionText} numberOfLines={3}>
          {text}
        </Text>
      </View>
      <TouchableOpacity hitSlop={styles.hitSlop}>
        <Vector1Svg width={12} height={7} color={Colors.text.primary} />
      </TouchableOpacity>
    </View>
  );
}

QuestionCard.propTypes = {
  authorName: PropTypes.string, // optional until SCRUM-261 lands
  text: PropTypes.string.isRequired,
};

// ─── Viewer QUESTIONS LIST ────────────────────────────────────────────────────

export function ViewerQuestionsList({ questions, onClose }) {
  const { t } = useTranslation('viewer');

  return (
    <Modal animationType="slide" visible statusBarTranslucent>
      <View style={styles.screen}>
        <QuestionsScreenHeader
          title={t('viewerQuestionsTitle')}
          onBack={onClose}
        />

        <Text style={styles.vqCountLabel}>
          {t('viewerQuestionsCount', {
            count: questions.length,
          })}
        </Text>

        <ScrollView
          style={styles.vqScroll}
          contentContainerStyle={styles.vqScrollContent}
          showsVerticalScrollIndicator={false}
        >
          {questions.map((q) => (
            <QuestionCard key={q.id} authorName={q.authorName} text={q.text} />
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

ViewerQuestionsList.propTypes = {
  questions: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      authorName: PropTypes.string, // optional until SCRUM-261 lands
      text: PropTypes.string.isRequired,
    }).isRequired
  ),
  onClose: PropTypes.func.isRequired,
};

// ─── STYLES ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // ── Container ──────────────────────────────────────────────────────────────
  screen: {
    flex: 1,
    backgroundColor: Colors.surface.white,
  },

  // ── Count Label ────────────────────────────────────────────────────────────
  vqCountLabel: {
    ...TextStyles.captionMedium,
    color: Colors.text.tertiary,
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
    textAlign: 'left',
  },

  // ── Scroll ─────────────────────────────────────────────────────────────────
  vqScroll: {
    flex: 1,
  },
  vqScrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
    gap: Spacing.md,
  },

  // ── Question Card ──────────────────────────────────────────────────────────
  vqCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.neutral[200],
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
    backgroundColor: Colors.surface.white,
  },

  // ── Avatar ─────────────────────────────────────────────────────────────────
  vqAvatar: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.surface.white,
    overflow: 'hidden',
    backgroundColor: Colors.neutral[200],
  },
  vqAvatarPlaceholder: {
    flex: 1,
  },

  // ── Text Column ────────────────────────────────────────────────────────────
  vqTextCol: {
    flex: 1,
    gap: 2,
  },
  vqAuthorName: {
    ...TextStyles.captionRegular,
    fontSize: 10,
    lineHeight: 14,
    color: Colors.text.secondary,
    textAlign: 'left',
  },
  vqQuestionText: {
    ...TextStyles.bodyLRegular,
    color: Colors.text.primary,
    textAlign: 'left',
  },

  // ── Misc ───────────────────────────────────────────────────────────────────
  hitSlop: { top: 10, bottom: 10, left: 10, right: 10 },
});
