import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import {
  Colors,
  Spacing,
  BorderRadius,
  TextStyles,
} from '../../../../constants/design';
import PlusSvg from '../../../../assets/icons/plus.svg';

const MAX_ANSWERS = 6;

/**
 * QuestionFormFields
 * החלק המשותף בין AddQuestionForm ו-EditQuestionForm:
 *   - שדה שאלה
 *   - רשימת שדות תשובות
 *   - כפתור + הוסף תשובה
 *
 * Props:
 *   questionText    — string (controlled)
 *   onChangeQuestion — (text: string) => void
 *   answers         — string[]  (controlled)
 *   onChangeAnswer  — (index: number, value: string) => void
 *   onAddAnswer     — () => void
 */
export function QuestionFormFields({
  questionText,
  onChangeQuestion,
  answers,
  onChangeAnswer,
  onAddAnswer,
}) {
  const { t } = useTranslation('question');

  return (
    <View style={styles.container}>
      {/* שאלה */}
      <View style={styles.section}>
        <Text style={styles.label}>{t('yourQuestion')}</Text>
        <TextInput
          style={styles.questionInput}
          placeholder={t('questionPlaceholder')}
          placeholderTextColor={Colors.text.tertiary}
          value={questionText}
          onChangeText={onChangeQuestion}
          multiline
        />
      </View>

      {/* תשובות */}
      <View style={styles.section}>
        <Text style={styles.label}>{t('optionalAnswers')}</Text>
        {answers.map((ans, idx) => (
          <TextInput
            key={idx}
            style={styles.answerInput}
            placeholder={t('answerPlaceholder', {
              number: idx + 1,
            })}
            placeholderTextColor={Colors.text.tertiary}
            value={ans}
            onChangeText={(v) => onChangeAnswer(idx, v)}
          />
        ))}

        {answers.length < MAX_ANSWERS && (
          <TouchableOpacity style={styles.addAnswerBtn} onPress={onAddAnswer}>
            <PlusSvg width={16} height={16} color={Colors.primary.default} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

QuestionFormFields.propTypes = {
  questionText: PropTypes.string.isRequired,
  onChangeQuestion: PropTypes.func.isRequired,
  answers: PropTypes.arrayOf(PropTypes.string).isRequired,
  onChangeAnswer: PropTypes.func.isRequired,
  onAddAnswer: PropTypes.func.isRequired,
};

const styles = StyleSheet.create({
  container: {
    gap: Spacing.xl,
  },
  section: {
    gap: Spacing.md,
  },
  label: {
    ...TextStyles.captionMedium,
    color: Colors.text.tertiary,
  },
  questionInput: {
    borderWidth: 1,
    borderColor: Colors.primary.default,
    borderRadius: BorderRadius.sm,
    padding: Spacing.lg,
    ...TextStyles.bodyMRegular,
    color: Colors.text.primary,
    minHeight: 80,
    textAlignVertical: 'top',
    fontFamily: 'Rubik',
  },
  answerInput: {
    borderWidth: 1,
    borderColor: Colors.neutral[200],
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    ...TextStyles.bodyMRegular,
    color: Colors.text.primary,
    height: 50,
    fontFamily: 'Rubik',
  },
  addAnswerBtn: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.primary.default,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
});
