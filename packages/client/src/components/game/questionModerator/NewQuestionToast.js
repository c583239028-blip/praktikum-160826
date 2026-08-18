import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import PropTypes from 'prop-types';

// --- Design tokens ---
// אותו נתיב יחסי כמו ב-ModeratorScreen.js (הקומפוננטה יושבת באותה תיקייה)
import { Colors, Spacing, BorderRadius, TextStyles } from '../../../../constants/design';

// TODO: לאשר את השם/נתיב המדויק של האייקון בתיקיית assets/icons
// (באיקון שבתמונת ה-Figma - קובייה/יהלום סגול עם סימני שאלה, Frame 2147223633)
import MessageIcon from '@/assets/icons/question-cube.svg';

// ─────────────────────────────────────────────
// NewQuestionToast
// טוסט קופץ שמוצג למנחה כאשר צופה שולח הצעת שאלה למשחק.
// עיצוב לפי Figma: node-id 6248-54457 / הודעה "Erez sent a question proposal..."
// שכבה שקופה (position: absolute) שיושבת מעל שכבת הווידאו, ליד הקצה העליון.
// ─────────────────────────────────────────────
export function NewQuestionToast({ visible, title, message, icon }) {
  if (!visible) {
    return null;
  }

  const IconComponent = icon || MessageIcon;
  return (
    <View style={styles.container} pointerEvents="none">
      <View style={styles.iconWrapper}>
        {/* TODO: לוודא שה-SVG שיובא תומך בפרופס width/height (react-native-svg-transformer) */}
        <IconComponent width={27} height={29} />
      </View>

      <View style={styles.textWrapper}>
        {!!title && (
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
        )}
        {!!message && (
          <Text style={styles.message} numberOfLines={2}>
            {message}
          </Text>
        )}
      </View>
    </View>
  );
}

NewQuestionToast.propTypes = {
  visible: PropTypes.bool,
  title: PropTypes.string,
  message: PropTypes.string,
  // מאפשר להזריק אייקון אחר במידת הצורך (למשל בבדיקות/Storybook)
  icon: PropTypes.elementType,
};

NewQuestionToast.defaultProps = {
  visible: false,
  title: '',
  message: '',
  icon: null,
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 9,
    left: 6,
    right: 6,
    flexDirection: 'row',
    alignItems: 'center',
    // #F2F2F2 60% — לפי ה-Inspector ב-Figma; אין כרגע טוקן מוכן לצבע הזה ב-design.js
    backgroundColor: 'rgba(242, 242, 242, 0.6)',
    borderRadius: BorderRadius.lg, // border radius/lg
    padding: Spacing.md, // spacing/md
    // TODO: RN גרסה ישנה עלולה לא לתמוך ב-gap ב-StyleSheet - אם כך יש להוסיף marginStart ל-textWrapper במקום
    gap: Spacing.md, // spacing/md
    zIndex: 10,
  },
  iconWrapper: {
    width: 28,
    height: 29,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrapper: {
    flex: 1,
  },
  title: {
    // Figma: "Body/L-Medium" 14/18 — הכי קרוב בטוקנים הקיימים הוא bodyMMedium (14px/18px)
    ...TextStyles.bodyMMedium,
    color: Colors.text.primary,
  },
  message: {
    // Figma: "Body/M-Medium" 12/16 — matches captionMedium (12px/16px), עם צבע primary במקום secondary
    ...TextStyles.captionMedium,
    color: Colors.text.primary,
  },
});

export default NewQuestionToast;
