import { View, StyleSheet } from 'react-native';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { WizardShell } from '../components/WizardShell';
import { GameTypeCard } from '../components/GameTypeCard';
import Btn from '../../../components/game/ui/Btn';
import { Colors, Spacing } from '@/constants/design';

// Step 0 — Select Game Type (gradient). Close-up is selectable; Remote is
// disabled this week. Dumb step: value/onChange/onNext (+ wizard position).
export function SelectGameTypeStep({
  value,
  onChange,
  onNext,
  total,
  current,
}) {
  const { t } = useTranslation('host');

  return (
    <WizardShell
      title={t('selectGameType', 'Select Game Type')}
      total={total}
      current={current}
      gradient
    >
      <View style={styles.cards}>
        <GameTypeCard
          title={t('closeUpGame', 'Close-up game')}
          subtitle={t('playFaceToFace', 'Play face to face')}
          iconName="people"
          iconColor={Colors.secondary.default}
          popular
          selected={value === 'CLOSEUP'}
          onPress={() => onChange('CLOSEUP')}
        />
        <GameTypeCard
          title={t('remotePlay', 'Remote play')}
          subtitle={t('playFaceToFace', 'Play face to face')}
          iconName="globe"
          iconColor={Colors.info.main}
          disabled
        />
      </View>

      <View style={styles.bottomBar}>
        <Btn
          label={t('next', 'Next')}
          onPress={onNext}
          color={Colors.primary.default}
        />
      </View>
    </WizardShell>
  );
}

SelectGameTypeStep.propTypes = {
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  onNext: PropTypes.func.isRequired,
  total: PropTypes.number.isRequired,
  current: PropTypes.number.isRequired,
};

const styles = StyleSheet.create({
  cards: { paddingHorizontal: Spacing.xl, gap: Spacing.xl },
  bottomBar: { marginTop: 'auto', padding: Spacing.xl },
});
