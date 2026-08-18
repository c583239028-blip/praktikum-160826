import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, useWindowDimensions } from 'react-native';
import PropTypes from 'prop-types';
import { Colors, Spacing, BorderRadius, TextStyles, FontSize } from '../../../../constants/design';

/**
 * OpenQuestionsPillsRow
 * שורת "כדורים" (pills) לשאלות פתוחות, מוצגת מעל ה-Nav במסך המנחה.
 * הוצא מ-ModeratorScreen.js לקומפוננטה נפרדת.
 *
 * רוחב מינימלי לכל כדור מחושב כך שכל הכדורים ביחד יתפסו לפחות
 * את כל רוחב המסך (בניכוי padding/gap), עם גלילה אופקית לשאלות נוספות.
 *
 * Props:
 *   questions — [{ id, text, ... }]
 *   onSelectQuestion — (questionId) => void
 */
export function OpenQuestionsPillsRow({ questions, onSelectQuestion }) {
  const { width: screenWidth } = useWindowDimensions();

  if (questions.length === 0) return null;

  const ROW_HORIZONTAL_PADDING = Spacing.md * 2; // תואם ל-paddingHorizontal של contentContainerStyle
  const ITEM_GAP = Spacing.lg; // תואם ל-marginEnd של כל פריט
  const availableWidth =
    screenWidth - ROW_HORIZONTAL_PADDING - ITEM_GAP * Math.max(questions.length - 1, 0);
  const pillMinWidth = availableWidth / questions.length;

  return (
    <View
      style={{
        marginBottom: Spacing.md,
        backgroundColor: 'rgba(2,9,23,0.35)', // TODO: אין טוקן שקיפות מדויק ב-design.js - נגזר ידנית מ-Colors.surface.dark
        borderRadius: BorderRadius.xs,
      }}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0 }}
        contentContainerStyle={{
          alignItems: 'center',
          paddingHorizontal: Spacing.md,
          paddingVertical: Spacing.md,
        }}
      >
        {questions.map((q) => (
          <TouchableOpacity
            key={q.id}
            onPress={() => onSelectQuestion(q.id)}
            style={{
              backgroundColor: 'rgba(255,255,255,0.6)',
              borderRadius: BorderRadius.xs, // 4px ✓
              borderWidth: 1,
              borderColor: Colors.secondary.light, // bg/secondary-light ✓
              paddingHorizontal: Spacing.lg, // ⚠️ פיגמה = 10px אחיד, אין טוקן מדויק - ראי שאלה למטה
              paddingVertical: Spacing.lg,   // ⚠️ אותו דבר
              marginEnd: Spacing.lg, // gap: spacing/lg ✓ מדויק (12px)
              minWidth: pillMinWidth,
              alignItems: 'center',
            }}
          >
            <Text
              numberOfLines={1}
              style={[
                TextStyles.bodyLRegular, // 16px/regular ✓ (היה captionMedium=12px/medium - שגוי)
                { color: Colors.secondary.dark, textAlign: 'right', lineHeight: FontSize.bodyL },
              ]}
            >
              {q.text}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

OpenQuestionsPillsRow.propTypes = {
  questions: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      text: PropTypes.string.isRequired,
    })
  ).isRequired,
  onSelectQuestion: PropTypes.func.isRequired,
};