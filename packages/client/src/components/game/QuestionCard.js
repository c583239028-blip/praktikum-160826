import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import Card from './ui/Card';
import Btn from './ui/Btn';
import {
  Colors,
  FontFamily,
  FontSize,
  Spacing,
  BorderRadius,
} from '../../../constants/design';

const QuestionCard = ({ question, onWager }) => {
  const { t } = useTranslation('question');
  const [selectedOptionId, setSelectedOptionId] = useState(null);

  // Guard: מניעת קריסה אם הנתונים טרם הגיעו בזמן ה-Hydration של הסוקט
  if (!question) {
    return null;
  }

  const handleOptionPress = (optionId) => {
    setSelectedOptionId(optionId);
  };

  const handlePlaceholderWagerPress = () => {
    // TODO S4: SCRUM-282 wager drag mechanic (SPEC §6.3 C5). Viewer will drag the
    // matching Currency Bank icon onto the chosen option instead of tapping
    // this button. Do not build the drag mechanic here — placeholder only.
    if (selectedOptionId && onWager) {
      onWager(selectedOptionId);
    }
  };

  return (
    <Card>
      <View style={styles.questionHeader}>
        <Text style={styles.questionText}>{question.questionText}</Text>

        {/* TODO S4:SCRUM-283 .TimerBar countdown ring goes here (Priority 2, Out of scope for S4)  */}
      </View>

      <View style={styles.optionsList}>
        {question.options?.map((option, index) => {
          const isSelected = option.id === selectedOptionId;
          return (
            <TouchableOpacity
              key={option.id}
              style={[styles.optionRow, isSelected && styles.optionRowSelected]}
              onPress={() => handleOptionPress(option.id)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
            >
              <View style={styles.optionBadge}>
                <Text style={styles.optionBadgeText}>{index + 1}</Text>
              </View>
              <Text style={styles.optionText}>{option.text}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* כפתור זמני - טקסט נמשך מקובץ התרגום */}
      <Btn
        label={t('questionCard.placeBetPlaceholder')}
        onPress={handlePlaceholderWagerPress}
        disabled={!selectedOptionId}
        color={Colors.primary.default}
      />
    </Card>
  );
};

QuestionCard.propTypes = {
  question: PropTypes.shape({
    id: PropTypes.string,
    questionText: PropTypes.string.isRequired,
    options: PropTypes.arrayOf(
      PropTypes.shape({
        id: PropTypes.string.isRequired,
        text: PropTypes.string.isRequired,
      })
    ).isRequired,
  }).isRequired,
  onWager: PropTypes.func,
};

QuestionCard.defaultProps = {
  onWager: null,
};

const styles = StyleSheet.create({
  questionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.surface.white,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing['2xl'],
  },
  questionText: {
    fontFamily: FontFamily.primary,
    fontSize: FontSize.bodyL,
    fontWeight: '700',
    color: Colors.surface.white,
    flex: 1,
  },
  optionsList: {
    marginBottom: Spacing['2xl'],
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    backgroundColor: `${Colors.surface.white}99`,
    borderWidth: 2,
    borderColor: 'transparent',
    marginBottom: Spacing.md,
  },
  optionRowSelected: {
    backgroundColor: Colors.primary.light,
    borderColor: Colors.primary.dark,
  },
  optionBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.neutral[900],
    alignItems: 'center',
    justifyContent: 'center',
    marginEnd: Spacing.md,
  },
  optionBadgeText: {
    fontFamily: FontFamily.primary,
    fontSize: FontSize.caption,
    fontWeight: '700',
    color: Colors.surface.white,
  },
  optionText: {
    fontFamily: FontFamily.primary,
    fontSize: FontSize.bodyM,
    color: Colors.text.primary,
    fontWeight: '600',
    flex: 1,
  },
});

export default QuestionCard;
