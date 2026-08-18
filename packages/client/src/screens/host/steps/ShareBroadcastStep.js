import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { WizardShell } from '../components/WizardShell';
import Btn from '../../../components/game/ui/Btn';
import {
  Colors,
  Spacing,
  FontSize,
  BorderRadius,
  Gradients,
} from '@/constants/design';

// Social apps to share to (Figma). Demo only — tapping does nothing yet.
const APPS = [
  { key: 'instagram', icon: 'logo-instagram', color: '#E1306C' },
  { key: 'x', icon: 'logo-twitter', color: '#111827' },
  { key: 'whatsapp', icon: 'logo-whatsapp', color: '#25D366' },
  { key: 'facebook', icon: 'logo-facebook', color: '#1877F2' },
];

// Share broadcast 1 (white). DEMO — out of scope (sharing) per the brief, kept
// so the designed screen stays visible. Buttons don't wire anywhere yet.
export function ShareBroadcastStep({ onNext, onBack, total, current }) {
  const { t } = useTranslation('host');

  return (
    <WizardShell
      title={t('inviteFriends', 'Invite friends to the live broadcast — now!')}
      total={total}
      current={current}
    >
      <View style={styles.pane}>
        <LinearGradient
          colors={Gradients.brand}
          start={{ x: 1, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.liveCard}
        >
          <View style={styles.liveBadge}>
            <Text style={styles.liveBadgeText}>{t('liveStatus', 'LIVE')}</Text>
          </View>
          <Text style={styles.liveCardText}>
            {t('notLiveYet', 'The broadcast has not gone live yet. Enjoy!')}
          </Text>
        </LinearGradient>

        <Text style={styles.sectionLabel}>
          {t('passageToPresent', 'A passage to be presented')}
        </Text>
        <View style={styles.linkCard}>
          <Text style={styles.linkText}>
            🎮 {t('shareMessage', 'A new game starts now! Come play with me')}
          </Text>
          <Text style={styles.linkUrl}>https://yourgame.com/live</Text>
        </View>

        <Text style={styles.sectionLabel}>
          {t('chooseApp', 'Choose an app to share the post')}
        </Text>
        <View style={styles.appsRow}>
          {APPS.map((a) => (
            <View
              key={a.key}
              style={[styles.appIcon, { backgroundColor: a.color }]}
            >
              <Ionicons name={a.icon} size={26} color={Colors.surface.white} />
            </View>
          ))}
        </View>

        <Text style={styles.demo}>
          {t('demoNotice', 'Demo — wiring coming later')}
        </Text>
      </View>

      <View style={styles.navRow}>
        <View style={styles.nextBtn}>
          <Btn
            label={t('next', 'Next')}
            onPress={onNext}
            color={Colors.primary.default}
          />
        </View>
        <TouchableOpacity style={styles.prevBtn} onPress={onBack}>
          <Text style={styles.prevText}>{t('previous', 'Previous')}</Text>
        </TouchableOpacity>
      </View>
    </WizardShell>
  );
}

ShareBroadcastStep.propTypes = {
  onNext: PropTypes.func.isRequired,
  onBack: PropTypes.func.isRequired,
  total: PropTypes.number.isRequired,
  current: PropTypes.number.isRequired,
};

const styles = StyleSheet.create({
  pane: { flex: 1, paddingHorizontal: Spacing.xl, gap: Spacing.lg },
  liveCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    gap: Spacing.md,
    minHeight: 120,
    justifyContent: 'space-between',
  },
  liveBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.live,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: 2,
  },
  liveBadgeText: {
    color: Colors.surface.white,
    fontSize: FontSize.caption,
    fontWeight: 'bold',
  },
  liveCardText: { color: Colors.surface.white, fontSize: FontSize.bodyM },
  sectionLabel: {
    color: Colors.text.secondary,
    fontSize: FontSize.bodyM,
    fontWeight: '600',
  },
  linkCard: {
    backgroundColor: Colors.neutral[100],
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  linkText: { color: Colors.text.primary, fontSize: FontSize.bodyM },
  linkUrl: {
    color: Colors.info.main,
    fontSize: FontSize.caption,
  },
  appsRow: { flexDirection: 'row', gap: Spacing.lg, justifyContent: 'center' },
  appIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  demo: {
    color: Colors.secondary.default,
    fontSize: FontSize.caption,
    textAlign: 'center',
  },
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
