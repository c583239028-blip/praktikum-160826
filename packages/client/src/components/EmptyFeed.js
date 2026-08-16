import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Colors, FontSize, FontWeight, Spacing } from '../../constants/design';

export default function EmptyFeed() {
  const { t } = useTranslation('feed');

  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>📡</Text>
      <Text style={styles.title}>{t('empty_title')}</Text>
      <Text style={styles.subtitle}>{t('empty_subtitle')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 48, marginBottom: Spacing.xl },
  title: {
    color: Colors.surface.white,
    fontSize: FontSize.subtitleM,
    fontWeight: FontWeight.bold,
  },
  subtitle: {
    color: Colors.text.tertiary,
    fontSize: FontSize.bodyM,
    marginTop: Spacing.md,
  },
});
