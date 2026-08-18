import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { WizardShell } from '../components/WizardShell';
import { UserPickerRow } from '../../../components/game/UserPickerRow';
import { Avatar } from '../../../components/game/Avatar';
import Btn from '../../../components/game/ui/Btn';
import { filterUsers } from './mockUsers';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/design';

// Step 2 — Invite Moderator (white). DEMO: shows the designed picker (mock
// friends + search) so the UI is visible, but the selection is NOT sent to the
// server and the step is skippable. Real wiring lands with the users API.
// Self-contained demo state — does not feed the create-game draft.
export function InviteModeratorStep({
  value,
  onChange,
  onNext,
  onBack,
  total,
  current,
}) {
  const { t } = useTranslation('host');
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const pick = (u) => {
    onChange(u);
    setOpen(false);
    setSearch('');
  };

  return (
    <WizardShell
      title={t('hostInvitation', 'Game Host Invitation')}
      total={total}
      current={current}
    >
      <View style={styles.pane}>
        <TouchableOpacity
          style={styles.dropdownField}
          onPress={() => setOpen((o) => !o)}
          activeOpacity={0.8}
        >
          {value ? (
            <View style={styles.selectedRow}>
              <Avatar size={28} />
              <Text style={styles.selectedName}>{value.name}</Text>
            </View>
          ) : (
            <Text style={styles.placeholder}>
              {t('whoWillHost', 'Who will host your game?')}
            </Text>
          )}
          <Ionicons
            name={open ? 'chevron-up' : 'chevron-down'}
            size={20}
            color={Colors.text.secondary}
          />
        </TouchableOpacity>

        {open ? (
          <View style={styles.dropdownList}>
            <View style={styles.searchBox}>
              <Ionicons name="search" size={18} color={Colors.text.tertiary} />
              <TextInput
                style={styles.searchInput}
                value={search}
                onChangeText={setSearch}
                placeholder={t('searchPlaceholder', 'Search')}
                placeholderTextColor={Colors.text.tertiary}
              />
            </View>
            <ScrollView keyboardShouldPersistTaps="handled">
              {filterUsers(search).map((u) => (
                <UserPickerRow
                  key={u.id}
                  name={u.name}
                  selected={value?.id === u.id}
                  onPress={() => pick(u)}
                />
              ))}
            </ScrollView>
          </View>
        ) : null}

        <Text style={styles.hint}>
          {t('moderatorOptional', 'Optional — you can skip this')}
        </Text>
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

InviteModeratorStep.propTypes = {
  value: PropTypes.object,
  onChange: PropTypes.func.isRequired,
  onNext: PropTypes.func.isRequired,
  onBack: PropTypes.func.isRequired,
  total: PropTypes.number.isRequired,
  current: PropTypes.number.isRequired,
};

const styles = StyleSheet.create({
  pane: { flex: 1, paddingHorizontal: Spacing.xl },
  dropdownField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderColor: Colors.primary.default,
    borderRadius: BorderRadius.xl,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
  },
  placeholder: { color: Colors.text.tertiary, fontSize: FontSize.bodyL },
  selectedRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  selectedName: { color: Colors.text.primary, fontSize: FontSize.bodyL },
  dropdownList: {
    marginTop: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.neutral[200],
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    maxHeight: 280,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral[100],
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
    marginBottom: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    color: Colors.text.primary,
    fontSize: FontSize.bodyM,
  },
  hint: {
    color: Colors.text.tertiary,
    fontSize: FontSize.caption,
    textAlign: 'center',
    marginTop: Spacing.lg,
  },
  demo: {
    color: Colors.secondary.default,
    fontSize: FontSize.caption,
    textAlign: 'center',
    marginTop: Spacing.sm,
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
