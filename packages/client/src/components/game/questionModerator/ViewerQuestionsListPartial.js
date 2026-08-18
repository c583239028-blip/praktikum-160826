import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Colors, TextStyles, Spacing, BorderRadius } from '../../../../constants/design';
import { QuestionCard } from './ViewerQuestionsList';

// ─── Viewer QUESTIONS LIST (PARTIAL / EMBEDDED PANEL) ────────────────────────
// Standalone screen: imports ONLY the exported QuestionCard from
// ViewerQuestionsList.js. That file is otherwise completely untouched.
//
// Not a Modal — a plain View. The parent screen positions it (e.g.
// absolutely, over the live video preview — see "Rectangle 3567" ref).
// Height grows/shrinks with content: minHeight + top/bottom padding only,
// no fixed height.

export function ViewerQuestionsListPartial({ questions, icon, onIconPress }) {
  const { t } = useTranslation('viewer');

  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <View style={styles.headerTextCol}>
          <Text style={styles.title}>{t('viewerQuestionsTitle')}</Text>
          <Text style={styles.subtitle}>
            {t('viewerQuestionsCount', { count: questions.length })}
          </Text>
        </View>
        {/* icon is passed in by the parent screen — X or back arrow, varies per screen */}
        <TouchableOpacity onPress={onIconPress} hitSlop={styles.hitSlop}>
          {icon}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {questions.map((q) => (
          <QuestionCard key={q.id} authorName={q.authorName} text={q.text} />
        ))}
      </ScrollView>
    </View>
  );
}

ViewerQuestionsListPartial.propTypes = {
  questions: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      authorName: PropTypes.string.isRequired,
      text: PropTypes.string.isRequired,
    }).isRequired
  ).isRequired,
  // Pass a rendered icon element, e.g. <CloseSvg width={16} height={16} />
  // or <BackArrowSvg width={16} height={16} />
  icon: PropTypes.node.isRequired,
  onIconPress: PropTypes.func.isRequired,
};

// ─── STYLES ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  panel: {
    minHeight: 180, // TODO: confirm exact minimum height from design
    backgroundColor: Colors.surface.white,
    borderRadius: BorderRadius.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
    // No fixed/flex height — panel sizes itself to content, as requested.
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  headerTextCol: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...TextStyles.bodyLBold, // TODO: confirm actual bold title token in your design constants
    color: Colors.text.primary,
    textAlign: 'left',
  },
  subtitle: {
    ...TextStyles.captionMedium,
    color: Colors.text.tertiary,
    textAlign: 'left',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  hitSlop: { top: 10, bottom: 10, left: 10, right: 10 },
});
