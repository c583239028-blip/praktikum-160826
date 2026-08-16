import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { WizardShell } from '../components/WizardShell';
import { WizardNav } from '../components/WizardNav';
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
          {/* PROD: placeholder — replace with the real share URL (e.g.
              https://<host>/live/[id]) once sharing is wired. */}
          <Text style={styles.linkUrl}>https://example.com/live/[id]</Text>
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

      <WizardNav onNext={onNext} onBack={onBack} />
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
});
