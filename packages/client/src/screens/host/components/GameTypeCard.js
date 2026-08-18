import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import PropTypes from 'prop-types';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/design';

// A selectable game-type card (Figma: "Close-up game" / "Remote play").
// White rounded card with icon/title/subtitle; optional "Popular" badge; turns
// lavender when selected. `disabled` dims it and blocks selection (Remote is
// disabled this week) and shows a "coming soon" hint.
export function GameTypeCard({
  title,
  subtitle,
  iconName,
  iconColor,
  popular = false,
  selected = false,
  disabled = false,
  onPress,
}) {
  const { t } = useTranslation('host');
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.card,
        selected && styles.cardSelected,
        disabled && styles.cardDisabled,
      ]}
    >
      {popular ? (
        <View style={styles.popularBadge}>
          <Text style={styles.popularText}>{t('popular', 'Popular')}</Text>
        </View>
      ) : null}

      <Ionicons name={iconName} size={32} color={iconColor} />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>

      {disabled ? (
        <Text style={styles.comingSoon}>{t('comingSoon', 'Coming soon')}</Text>
      ) : null}
    </TouchableOpacity>
  );
}

GameTypeCard.propTypes = {
  title: PropTypes.string.isRequired,
  subtitle: PropTypes.string.isRequired,
  iconName: PropTypes.string.isRequired,
  iconColor: PropTypes.string.isRequired,
  popular: PropTypes.bool,
  selected: PropTypes.bool,
  disabled: PropTypes.bool,
  onPress: PropTypes.func,
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface.white,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing['2xl'],
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.md,
    // subtle shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  cardSelected: {
    backgroundColor: Colors.secondary.extraLight, // lavender
  },
  cardDisabled: {
    opacity: 0.45,
  },
  popularBadge: {
    position: 'absolute',
    top: 0,
    left: 0,
    backgroundColor: Colors.neutral[900],
    borderTopLeftRadius: BorderRadius.lg,
    borderBottomRightRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  popularText: {
    color: Colors.surface.white,
    fontSize: FontSize.caption,
    fontWeight: '600',
  },
  title: {
    color: Colors.text.primary,
    fontSize: FontSize.bodyL,
    fontWeight: 'bold',
  },
  subtitle: {
    color: Colors.text.secondary,
    fontSize: FontSize.bodyM,
  },
  comingSoon: {
    color: Colors.text.tertiary,
    fontSize: FontSize.caption,
    fontWeight: '600',
  },
});
