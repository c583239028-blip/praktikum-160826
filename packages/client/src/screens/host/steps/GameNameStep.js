import { View, StyleSheet } from 'react-native';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { WizardShell } from '../components/WizardShell';
import { WizardNav } from '../components/WizardNav';
import Field from '../../../components/game/ui/Field';
import { Spacing } from '@/constants/design';

// Step 1 — Game Name (white). Single required field; Next stays disabled while
// the name is empty. Dumb step: value/onChange/onNext/onBack (+ wizard position).
// Uses the shared Field (light) + WizardNav instead of local primitives.
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

      <WizardNav onNext={onNext} onBack={onBack} nextDisabled={!valid} />
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
});
