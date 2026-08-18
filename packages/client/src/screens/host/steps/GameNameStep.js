import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { WizardShell } from '../components/WizardShell';
import Field from '../../../components/game/ui/Field';
import Btn from '../../../components/game/ui/Btn';
import { Colors, Spacing, FontSize } from '@/constants/design';

// Step 1 — Game Name (white). Single required field; Next stays disabled while
// the name is empty. Dumb step: value/onChange/onNext/onBack (+ wizard position).
// Uses the shared Field (light) + Btn instead of local primitives.
export function GameNameStep({
  value,
  onChange,
  onNext,
  onBack,
  total,
  current,
}) {
  const { t } = useTranslation('host');
  const valid = value.trim().length > 0;

  return (
    <WizardShell
      title={t('gameName', 'Game Name')}
      total={total}
      current={current}
    >
      <View style={styles.pane}>
        <Field
          variant="light"
          value={value}
          onChangeText={onChange}
          placeholder={t('gameNamePlaceholder', 'What is your game name?')}
          autoFocus
        />
      </View>

      <View style={styles.navRow}>
        <View style={styles.nextBtn}>
          <Btn
            label={t('next', 'Next')}
            onPress={onNext}
            color={Colors.primary.default}
            disabled={!valid}
          />
        </View>
        <TouchableOpacity style={styles.prevBtn} onPress={onBack}>
          <Text style={styles.prevText}>{t('previous', 'Previous')}</Text>
        </TouchableOpacity>
      </View>
    </WizardShell>
  );
}

GameNameStep.propTypes = {
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  onNext: PropTypes.func.isRequired,
  onBack: PropTypes.func.isRequired,
  total: PropTypes.number.isRequired,
  current: PropTypes.number.isRequired,
};

const styles = StyleSheet.create({
  pane: { flex: 1, paddingHorizontal: Spacing.xl },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.xl,
  },
  nextBtn: { minWidth: 140 },
  prevBtn: { paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg },
  prevText: { color: Colors.text.secondary, fontSize: FontSize.bodyL },
});
