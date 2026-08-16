import { View, TouchableOpacity, StyleSheet, Text } from 'react-native';
import { Spacing, BorderRadius, Colors, TextStyles } from '@/constants/design';
import PropTypes from 'prop-types';

export const GameNav = ({ icons }) => (
  <View style={styles.gameNav}>
    {icons.map((item) => (
      <TouchableOpacity
        key={item.id}
        style={styles.gameNavButton}
        onPress={item.onPress}
        activeOpacity={0.8}
      >
     <View style={styles.gameNavIconWrapper}>
          <item.icon width={Spacing['2xl']} height={Spacing['2xl']} />
          {!!item.badgeCount && (
            <View style={styles.badge}>
              <Text style={styles.badgeText} numberOfLines={1}>
                {item.badgeCount > 99 ? '99+' : item.badgeCount}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    ))}
  </View>
);

 const styles = StyleSheet.create({
  gameNav: {
    // ללא שינוי - זה כבר תואם לפיגמה
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.lg, // spacing/lg ✓
    paddingHorizontal: Spacing['2xl'], // spacing/2xl ✓
    paddingVertical: Spacing.md, // spacing/md ✓
    borderRadius: BorderRadius.lg, // border-radius/lg ✓
  },
  gameNavButton: {
    // TODO: אין ב-design.js טוקן שמתאים ל-62/40 (לא קיים בסקאלת Dimension).
    // חשוב להבהיר: זה שונה מהכלל "לא position:absolute עם מספרים קשיחים" -
    // זה גודל Fixed מדויק של קומפוננטה (מהפיגמה), לא מיקום מוחלט על המסך.
    width: 62,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.sm, // 4px ✓ מדויק - תואם ל-Spacing.sm (היה Spacing.md=8, שגוי - זו הסיבה לצפיפות)
  },
gameNavIconWrapper: {
    // ללא שינוי - כבר תואם (24x24)
    width: Spacing['2xl'],
    height: Spacing['2xl'],
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative', // נדרש כדי למקם את ה-badge
  },
  badge: {
    position: 'absolute',
    top: -Spacing.sm,
    right: -Spacing.sm,
    minWidth: Spacing.lg,
    height: Spacing.lg,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.error.main,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3, // no exact token match - verify with designer
  },
  badgeText: {
    ...TextStyles.captionMedium,
    color: Colors.surface.white,
    fontSize: 10, // no exact token match - verify with designer
    lineHeight: 12,
  },

});
