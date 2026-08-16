import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import PropTypes from 'prop-types';
// אותו נתיב יחסי כמו ב-ModeratorScreen.js (הקומפוננטה יושבת באותה תיקייה)
import { Colors, Spacing, BorderRadius, TextStyles } from '../../../../constants/design';

// ─────────────────────────────────────────────
// PublishResultToast
// טוסט קופץ שמוצג למנחה מיד אחרי לחיצה על "publishingResults" ב-OpenQuestionModal,
// מעל ה-Nav (ראו תמונת מסך: "The result has been received, data analyst...").
// לא היה קיים קודם - הטקסט הוצג בעבר כ-Text פשוט בלי רקע/עיצוב, ולכן היה כמעט
// בלתי נראה מעל שכבת הווידאו.
// ─────────────────────────────────────────────
export function PublishResultToast({ visible, message }) {
  if (!visible || !message) {
    return null;
  }

  return (
    <View style={styles.container} pointerEvents="none">
      <Text style={styles.message} numberOfLines={2}>
        {message}
      </Text>
    </View>
  );
}

PublishResultToast.propTypes = {
  visible: PropTypes.bool,
  message: PropTypes.string,
};

PublishResultToast.defaultProps = {
  visible: false,
  message: '',
};

const styles = StyleSheet.create({
  container: {
    alignSelf: 'center',
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    // Figma Inspector: Background colors #020917 · 60% - זהה ל-Colors.surface.dark
    // ב-60% אלפא (RN תומך ב-hex8: RRGGBBAA, 0.6 * 255 ≈ 0x99)
    backgroundColor: `${Colors.surface.dark}99`,
  },
  message: {
    ...TextStyles.captionMedium,
    color: Colors.surface.white,
    textAlign: 'center',
  },
});

export default PublishResultToast;
