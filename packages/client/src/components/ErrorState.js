import PropTypes from 'prop-types';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  Colors,
  Spacing,
  FontSize,
  FontWeight,
  BorderRadius,
} from '../../constants/design';

export default function ErrorState({ onRetry }) {
  const { t } = useTranslation('errors');

  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>⚠️</Text>
      <Text style={styles.message}>{t('state_message')}</Text>
      <TouchableOpacity style={styles.btn} onPress={onRetry}>
        <Text style={styles.btnText}>{t('retry_button')}</Text>
      </TouchableOpacity>
    </View>
  );
}
ErrorState.propTypes = {
  onRetry: PropTypes.func.isRequired,
};

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 40, marginBottom: Spacing.lg },
  message: {
    color: Colors.text.tertiary,
    fontSize: FontSize.bodyL,
    marginBottom: Spacing['2xl'],
  },
  btn: {
    backgroundColor: Colors.neutral[600],
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.sm,
  },
  btnText: { color: Colors.surface.white, fontWeight: FontWeight.bold },
});
