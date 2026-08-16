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
import { WizardShell } from './WizardShell';
import { WizardNav } from './WizardNav';
import { UserPickerRow } from '../../../components/game/UserPickerRow';
import { Avatar } from '../../../components/game/Avatar';
import { filterUsers } from './mockUsers';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/design';

// DEMO only — the selection is self-contained and never sent to the server.
// mock-allowed: SCRUM-316 — consumes the mockUsers placeholder until the real
// user-search API lands; a "Demo" banner is shown below (D-04 escape hatch).
export function UserPickerStep({
  mode,
  value,
  onChange,
  title,
  placeholder,
  hint,
  onNext,
  onBack,
  total,
  current,
}) {
  const { t } = useTranslation('host');
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const multi = mode === 'multi';
  // value may be undefined if a future caller omits the (non-required) prop —
  // fall back to [] so multi mode never reads .length off undefined.
  const selected = multi ? (value ?? []) : [];

  const isSelected = (u) =>
    multi ? selected.some((p) => p.id === u.id) : value?.id === u.id;

  const pick = (u) => {
    if (multi) {
      onChange(
        selected.some((p) => p.id === u.id)
          ? selected.filter((p) => p.id !== u.id)
          : [...selected, u]
      );
    } else {
      onChange(u);
      setOpen(false);
      setSearch('');
    }
  };

  return (
    <WizardShell title={title} total={total} current={current}>
      <View style={styles.pane}>
        <TouchableOpacity
          style={styles.dropdownField}
          onPress={() => setOpen((o) => !o)}
          activeOpacity={0.8}
        >
          {multi ? (
            <Text
              style={selected.length ? styles.selectedName : styles.placeholder}
            >
              {selected.length
                ? `${t('selectPlayers', 'Select players')} (${selected.length})`
                : placeholder}
            </Text>
          ) : value ? (
            <View style={styles.selectedRow}>
              <Avatar size={28} />
              <Text style={styles.selectedName}>{value.name}</Text>
            </View>
          ) : (
            <Text style={styles.placeholder}>{placeholder}</Text>
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
                  selected={isSelected(u)}
                  onPress={() => pick(u)}
                />
              ))}
            </ScrollView>
          </View>
        ) : multi ? (
          selected.map((p) => (
            <View key={p.id} style={styles.chipRow}>
              <View style={styles.selectedRow}>
                <Avatar size={28} />
                <Text style={styles.selectedName}>{p.name}</Text>
              </View>
              <TouchableOpacity onPress={() => pick(p)}>
                <Ionicons
                  name="close"
                  size={20}
                  color={Colors.text.secondary}
                />
              </TouchableOpacity>
            </View>
          ))
        ) : null}

        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
        <Text style={[styles.demo, hint ? styles.demoTight : null]}>
          {t('demoNotice', 'Demo — wiring coming later')}
        </Text>
      </View>

      <WizardNav onNext={onNext} onBack={onBack} />
    </WizardShell>
  );
}

UserPickerStep.propTypes = {
  mode: PropTypes.oneOf(['single', 'multi']).isRequired,
  // single: object|null ; multi: array
  value: PropTypes.oneOfType([PropTypes.object, PropTypes.array]),
  onChange: PropTypes.func.isRequired,
  title: PropTypes.string.isRequired,
  placeholder: PropTypes.string.isRequired,
  hint: PropTypes.string,
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
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral[100],
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
    // No hint above (multi/players): larger gap, matching the original screen.
    marginTop: Spacing.lg,
  },
  // With a hint above (single/moderator): the demo sits tighter under it.
  demoTight: { marginTop: Spacing.sm },
});

export default UserPickerStep;
