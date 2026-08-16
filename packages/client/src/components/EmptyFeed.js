import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

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
  emoji: { fontSize: 48, marginBottom: 16 },
  title: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  subtitle: { color: '#9ca3af', fontSize: 14, marginTop: 8 },
});
