import React, { useState } from 'react';
import { View, Text, Modal, StyleSheet, ScrollView } from 'react-native';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Colors, Spacing } from '../../../../constants/design';
import { QuestionsScreenHeader } from './QuestionsScreenHeader';
import { DraftQuestionCard } from './DraftQuestionCard';
import { EditQuestionForm } from './EditQuestionForm';
import { AdvancedOptionsSheet } from './AdvancedOptionsSheet';
// import { questionsApi } from '../../../../services/questionsApi'; // TODO: uncomment once API client is ready

// ─── MOCK DATA ──────────────────────────────────────────────────────────────
// TEMP: used while there is no running server / no API client yet.
// DELETE this block before pushing to git, once server calls below are live.
const MOCK_QUESTIONS = [
  {
    id: '1',
    authorName: 'Shira Cohen',
    text: 'What is your favorite way to spend a weekend?',
    answers: [
      { id: '0', text: 'Outdoors / hiking' },
      { id: '1', text: 'Reading at home' },
      { id: '2', text: 'Hanging out with friends' },
      { id: '3', text: 'Watching movies' },
    ],
  },
  {
    id: '2',
    authorName: 'Dan Levi',
    text: 'Which season do you enjoy the most?',
    answers: [
      { id: '0', text: 'Summer' },
      { id: '1', text: 'Winter' },
      { id: '2', text: 'Spring' },
      { id: '3', text: 'Fall' },
    ],
  },
];
// ─────────────────────────────────────────────────────────────────────────────

/**
 * DraftQuestionsList
 * Main screen for draft questions.
 * Manages:
 *   - the questions list
 *   - opening EditQuestionForm (Modal)
 *   - opening AdvancedOptionsSheet
 *
 * Props:
 *   questions — [{ id, authorName, text, answers: [{ id, text }] }]
 *   onClose   — () => void
 */
export function DraftQuestionsList({ questions: initialQuestions, onClose }) {
  const { t } = useTranslation('question');
  // TEMP: falls back to MOCK_QUESTIONS when no prop is passed (no server yet).
  const [questions, setQuestions] = useState(
    initialQuestions ?? MOCK_QUESTIONS
  );
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [advancedQuestion, setAdvancedQuestion] = useState(null);

  // ── Load drafts from server ─────────────────────────────────────────────
  // useEffect(() => {
  //     let isMounted = true;
  //     questionsApi.getDrafts()
  //         .then((data) => {
  //             if (isMounted) setQuestions(data);
  //         })
  //         .catch((err) => console.error('Failed to load draft questions:', err));
  //     return () => { isMounted = false; };
  // }, []);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleEdit = (question) => setEditingQuestion(question);

  const handleSaveEdit = ({ questionText, answers }) => {
    const updatedAnswers = answers.map((text, i) => ({ id: String(i), text }));

    setQuestions((prev) =>
      prev.map((q) =>
        q.id === editingQuestion.id
          ? { ...q, text: questionText, answers: updatedAnswers }
          : q
      )
    );

    // questionsApi.updateQuestion(editingQuestion.id, { text: questionText, answers: updatedAnswers })
    //     .catch((err) => console.error('Failed to save question edit:', err));

    setEditingQuestion(null);
  };

  const handleDelete = (questionId) => {
    setQuestions((prev) => prev.filter((q) => q.id !== questionId));

    // questionsApi.deleteQuestion(questionId)
    //     .catch((err) => console.error('Failed to delete question:', err));
  };

  const handlePublish = (questionId) => {
    // questionsApi.publishQuestion(questionId)
    //     .then(() => {
    //         setQuestions(prev => prev.filter(q => q.id !== questionId));
    //     })
    //     .catch((err) => console.error('Failed to publish question:', err));
  };

  const handleAdvanced = (question) => setAdvancedQuestion(question);

  const handleSaveAdvanced = (seconds) => {
    // questionsApi.setTimeLimit(advancedQuestion?.id, seconds)
    //     .catch((err) => console.error('Failed to save time limit:', err));
  };

  return (
    <Modal animationType="slide" visible statusBarTranslucent>
      <View style={styles.screen}>
        <QuestionsScreenHeader
          title={t('draftQuestions.title')}
          onBack={onClose}
        />

        <Text style={styles.countLabel}>
          {t('draftQuestions.questionsCount', { count: questions.length })}
        </Text>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {questions.map((q) => (
            <DraftQuestionCard
              key={q.id}
              question={q}
              onEdit={handleEdit}
              onAdvanced={handleAdvanced}
              onDelete={handleDelete}
              onPublish={handlePublish}
            />
          ))}
        </ScrollView>

        {/* Edit Question — shown as a Modal above the current screen */}
        {editingQuestion && (
          <Modal animationType="slide" visible statusBarTranslucent>
            <EditQuestionForm
              question={{
                ...editingQuestion,
                answers: editingQuestion.answers.map((a) => a.text),
              }}
              onClose={() => setEditingQuestion(null)}
              onSave={handleSaveEdit}
            />
          </Modal>
        )}

        {/* Advanced Options Sheet */}
        <AdvancedOptionsSheet
          visible={!!advancedQuestion}
          initialSeconds={60}
          onClose={() => setAdvancedQuestion(null)}
          onSave={handleSaveAdvanced}
        />
      </View>
    </Modal>
  );
}

DraftQuestionsList.propTypes = {
  questions: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      authorName: PropTypes.string, // optional until SCRUM-261 lands - see DraftQuestionCard
      text: PropTypes.string.isRequired,
      answers: PropTypes.arrayOf(
        PropTypes.shape({
          id: PropTypes.string.isRequired,
          text: PropTypes.string.isRequired,
        })
      ).isRequired,
    })
  ),
  onClose: PropTypes.func.isRequired,
};

DraftQuestionsList.defaultProps = {
  questions: undefined,
};

// ─── STYLES ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.surface.white,
  },
  countLabel: {
    fontSize: 12, // no exact design token match - verify with designer
    fontFamily: 'Rubik',
    fontWeight: '500',
    lineHeight: 16,
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
});
