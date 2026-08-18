import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Colors, Spacing } from '../../../../constants/design';
import { QuestionsScreenHeader } from './QuestionsScreenHeader';
import { QuestionFormFields } from './QuestionFormFields';
import { PublishButton } from '../PublishButton';

/**
 * EditQuestionForm
 * Same as AddQuestionForm but receives an existing question and pre-fills the fields.
 *
 * Props:
 *   question  — { id, text, answers: string[] }
 *   onClose   — () => void
 *   onSave    — ({ questionText, answers }) => void
 */
export function EditQuestionForm({ question, onClose, onSave }) {
  const { t } = useTranslation('question');
  const [questionText, setQuestionText] = useState(question?.text ?? '');
  const [answers, setAnswers] = useState(
    question?.answers?.length ? question.answers : ['', '', '', '']
  );

  const handleAddAnswer = () => {
    if (answers.length < 6) setAnswers((prev) => [...prev, '']);
  };

  const handleChangeAnswer = (index, value) => {
    setAnswers((prev) => prev.map((a, i) => (i === index ? value : a)));
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <QuestionsScreenHeader
        title={t('draftQuestions.editQuestion')}
        onBack={onClose}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <QuestionFormFields
          questionText={questionText}
          onChangeQuestion={setQuestionText}
          answers={answers}
          onChangeAnswer={handleChangeAnswer}
          onAddAnswer={handleAddAnswer}
        />
      </ScrollView>

      <View style={styles.footer}>
        <PublishButton
          label={t('draftQuestions.cancelChanges')}
          variant="secondary"
          onPress={onClose}
        />
        <PublishButton
          label={t('draftQuestions.saveChanges')}
          variant="primary"
          onPress={() => onSave({ questionText, answers })}
        />
      </View>
    </SafeAreaView>
  );
}

EditQuestionForm.propTypes = {
  question: PropTypes.shape({
    id: PropTypes.string.isRequired,
    text: PropTypes.string.isRequired,
    answers: PropTypes.arrayOf(PropTypes.string),
  }).isRequired,
  onClose: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.surface.white,
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing['2xl'],
  },
  footer: {
    flexDirection: 'row',
    gap: Spacing.md,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.xl,
    borderTopWidth: 1,
    borderTopColor: Colors.neutral[200],
  },
});
