import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import Btn from '../../../components/game/ui/Btn';
import { Colors, Spacing, FontSize } from '@/constants/design';

// Shared wizard footer. `nextDisabled` gates the Game Name step until it is
// filled; `showBack` drops Previous on the first step; `nextLabel` lets the
// final step relabel Next.
export function WizardNav({
  onNext,
  onBack,
  nextDisabled = false,
  showBack = true,
  nextLabel,
}) {
  const { t } = useTranslation('host');

  return (
    <View style={styles.navRow}>
      <View style={styles.nextBtn}>
        <Btn
          label={nextLabel ?? t('next', 'Next')}
          onPress={onNext}
          color={Colors.primary.default}
          disabled={nextDisabled}
        />
      </View>
      {showBack ? (
        <TouchableOpacity style={styles.prevBtn} onPress={onBack}>
          <Text style={styles.prevText}>{t('previous', 'Previous')}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

WizardNav.propTypes = {
  onNext: PropTypes.func.isRequired,
  // Required whenever Previous is shown; optional only when showBack={false}.
  onBack: (props, propName, componentName) =>
    props.showBack !== false && typeof props[propName] !== 'function'
      ? new Error(
          `${propName} is required in ${componentName} unless showBack is false`
        )
      : null,
  nextDisabled: PropTypes.bool,
  showBack: PropTypes.bool,
  nextLabel: PropTypes.string,
};

const styles = StyleSheet.create({
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

export default WizardNav;
