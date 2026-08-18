import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { WizardShell } from '../components/WizardShell';
import Btn from '../../../components/game/ui/Btn';
import { Colors, Spacing, FontSize } from '@/constants/design';

// Share broadcast 2 — "Well done" (white). DEMO — out of scope (sharing). The
// confirmation after sharing; buttons don't wire anywhere yet.
export function ShareBroadcastDoneStep({ onNext, onBack, total, current }) {
  const { t } = useTranslation('host');

  return (
    <WizardShell
      title={t('shareDone', 'Well done!')}
      total={total}
      current={current}
    >
      <View style={styles.pane}>
        <Image
          source={require('../../../../assets/images/trophy.png')}
          style={styles.trophy}
          resizeMode="contain"
        />
        <Text style={styles.subtitle}>
          {t('shareDoneSub', 'You shared the broadcast on social media.')}
        </Text>

        <View style={styles.partnersRow}>
          <View style={[styles.partner, { backgroundColor: '#25D366' }]}>
            <Ionicons
              name="logo-whatsapp"
              size={26}
              color={Colors.surface.white}
            />
          </View>
          <View style={[styles.partner, { backgroundColor: '#1877F2' }]}>
            <Ionicons
              name="logo-facebook"
              size={26}
              color={Colors.surface.white}
            />
          </View>
        </View>

        <Text style={styles.demo}>
          {t('demoNotice', 'Demo — wiring coming later')}
        </Text>
      </View>

      <View style={styles.bottomBar}>
        <View style={styles.btnFull}>
          <Btn
            label={t('next', 'Next')}
            onPress={onNext}
            color={Colors.primary.default}
          />
        </View>
        <TouchableOpacity style={styles.prevLink} onPress={onBack}>
          <Text style={styles.prevText}>{t('previous', 'Previous')}</Text>
        </TouchableOpacity>
      </View>
    </WizardShell>
  );
}

ShareBroadcastDoneStep.propTypes = {
  onNext: PropTypes.func.isRequired,
  onBack: PropTypes.func.isRequired,
  total: PropTypes.number.isRequired,
  current: PropTypes.number.isRequired,
};

const styles = StyleSheet.create({
  pane: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.xl,
    paddingTop: Spacing['2xl'],
  },
  trophy: {
    width: 170,
    height: 170,
  },
  subtitle: {
    color: Colors.text.secondary,
    fontSize: FontSize.bodyL,
    textAlign: 'center',
  },
  partnersRow: { flexDirection: 'row', gap: Spacing.xl },
  partner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  demo: {
    color: Colors.secondary.default,
    fontSize: FontSize.caption,
    textAlign: 'center',
  },
  bottomBar: {
    marginTop: 'auto',
    padding: Spacing.xl,
    gap: Spacing.md,
    alignItems: 'center',
  },
  btnFull: { width: '100%' },
  prevLink: { paddingVertical: Spacing.md },
  prevText: { color: Colors.text.secondary, fontSize: FontSize.bodyL },
});
