import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { WizardShell } from '../components/WizardShell';
import { Avatar } from '../../../components/game/Avatar';
import Btn from '../../../components/game/ui/Btn';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/design';

// Final wizard step — Game Details (white). Read-only recap of the draft (name,
// type, host, players) + a "go to broadcast" button that triggers create → LIVE.
// Host/players come from the demo selections (display only). Shows loading/error.
export function GameSummaryStep({
  title,
  gameType,
  moderator,
  players,
  onGoLive,
  loading,
  error,
  total,
  current,
}) {
  const { t } = useTranslation('host');
  const typeLabel =
    gameType === 'REMOTE'
      ? t('remotePlay', 'Remote play')
      : t('closeUpGame', 'Close-up game');

  return (
    <WizardShell
      title={t('gameSummary', 'Game Details')}
      total={total}
      current={current}
    >
      <View style={styles.pane}>
        {/* Share banner — demo (out of scope per the brief). */}
        <TouchableOpacity style={styles.shareBanner} activeOpacity={0.85}>
          <Ionicons
            name="share-social"
            size={18}
            color={Colors.surface.white}
          />
          <Text style={styles.shareBannerText}>
            {t('shareBanner', 'Share the game with friends')}
          </Text>
          <Ionicons
            name="chevron-back"
            size={18}
            color={Colors.surface.white}
          />
        </TouchableOpacity>

        <Row label={t('gameName', 'Game Name')} value={title} />
        <Row label={t('broadcastType', 'Broadcast type')} value={typeLabel} />

        {/* Host */}
        <View style={styles.block}>
          <Text style={styles.blockLabel}>{t('hostLabel', 'Host')}</Text>
          {moderator ? (
            <PersonRow name={moderator.name} />
          ) : (
            <Text style={styles.value}>—</Text>
          )}
        </View>

        {/* Players */}
        <View style={styles.block}>
          <Text style={styles.blockLabel}>{t('playersLabel', 'Players')}</Text>
          {players.length ? (
            players.map((p) => <PersonRow key={p.id} name={p.name} />)
          ) : (
            <Text style={styles.value}>—</Text>
          )}
          <View style={styles.addBtn}>
            <Ionicons name="add" size={22} color={Colors.primary.default} />
          </View>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>

      <View style={styles.bottomBar}>
        {/* TODO: the "30 seconds to prepare" promise depends on the practice
            mode, which is still being built in parallel. Revisit once it ships. */}
        <Text style={styles.prepNote}>
          {t(
            'prepNote',
            "In the transition to a live broadcast, you'll get 30 seconds to prepare."
          )}
        </Text>
        <View style={styles.btnFull}>
          <Btn
            label={t('goToBroadcast', 'Go to broadcast')}
            onPress={onGoLive}
            color={Colors.primary.default}
            loading={loading}
          />
        </View>
      </View>
    </WizardShell>
  );
}

// A person line: avatar + name on one side, a confirmed checkmark on the other.
// The avatar is a placeholder now; the real profile photo lands with the API.
function PersonRow({ name }) {
  return (
    <View style={styles.personRow}>
      <View style={styles.personInfo}>
        <Avatar size={40} />
        <Text style={styles.personName}>{name}</Text>
      </View>
      <Ionicons name="checkmark-circle" size={22} color={Colors.success.main} />
    </View>
  );
}

PersonRow.propTypes = { name: PropTypes.string.isRequired };

function Row({ label, value }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

Row.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.string,
};

GameSummaryStep.propTypes = {
  title: PropTypes.string.isRequired,
  gameType: PropTypes.string.isRequired,
  moderator: PropTypes.object,
  players: PropTypes.array,
  onGoLive: PropTypes.func.isRequired,
  loading: PropTypes.bool,
  error: PropTypes.string,
  total: PropTypes.number.isRequired,
  current: PropTypes.number.isRequired,
};

const styles = StyleSheet.create({
  pane: { flex: 1, paddingHorizontal: Spacing.xl },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral[100],
    gap: Spacing.lg,
  },
  label: { color: Colors.text.tertiary, fontSize: FontSize.bodyM },
  value: {
    color: Colors.text.primary,
    fontSize: FontSize.bodyL,
    fontWeight: '600',
    flexShrink: 1,
  },
  shareBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.secondary.default,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  shareBannerText: {
    flex: 1,
    color: Colors.surface.white,
    fontSize: FontSize.bodyM,
    fontWeight: '600',
  },

  block: { paddingTop: Spacing.lg },
  blockLabel: {
    color: Colors.text.tertiary,
    fontSize: FontSize.bodyM,
    marginBottom: Spacing.sm,
  },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral[100],
  },
  personInfo: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  personName: {
    color: Colors.text.primary,
    fontSize: FontSize.bodyL,
    fontWeight: '500',
  },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: Colors.primary.default,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    marginTop: Spacing.md,
  },
  error: {
    color: Colors.error.main,
    textAlign: 'center',
    marginTop: Spacing.lg,
  },
  bottomBar: {
    padding: Spacing.xl,
    gap: Spacing.md,
    alignItems: 'center',
  },
  prepNote: {
    color: Colors.text.tertiary,
    fontSize: FontSize.caption,
    textAlign: 'center',
  },
  btnFull: { width: '100%' },
});
