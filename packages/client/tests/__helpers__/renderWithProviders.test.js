/**
 * tests/__helpers__/renderWithProviders.test.js
 *
 * Proof-of-use for renderWithProviders + makeMockUser.
 * Verifies the helper wires all Providers correctly so future screen tests
 * can rely on it without assembling the provider tree manually.
 */

import React from 'react';
import { Text, View } from 'react-native';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { renderWithProviders, makeMockUser } from './renderWithProviders';

// ── Minimal test component that touches Redux + i18n ──────────────────────────
function TestWidget() {
  const { t } = useTranslation();
  // Access any slice just to prove the store is wired
  const wallet = useSelector((s) => s.wallet);
  return (
    <View>
      <Text testID="i18n-key">{t('hello')}</Text>
      <Text testID="wallet-ready">{wallet !== undefined ? 'yes' : 'no'}</Text>
    </View>
  );
}

describe('renderWithProviders', () => {
  it('renders a component without throwing', () => {
    expect(() => renderWithProviders(<TestWidget />)).not.toThrow();
  });

  it('provides a working Redux store', () => {
    const { getByTestId } = renderWithProviders(<TestWidget />);
    expect(getByTestId('wallet-ready').props.children).toBe('yes');
  });

  it('provides i18next (missing key falls back to key string)', () => {
    const { getByTestId } = renderWithProviders(<TestWidget />);
    // parseMissingKeyHandler returns the key itself
    expect(getByTestId('i18n-key').props.children).toBe('hello');
  });

  it('accepts preloadedState to seed store slices', () => {
    const { store } = renderWithProviders(<TestWidget />, {
      preloadedState: { wallet: { coins: 42 } },
    });
    expect(store.getState().wallet.coins).toBe(42);
  });
});

describe('makeMockUser', () => {
  it('returns a user with default fields', () => {
    const user = makeMockUser();
    expect(user.email).toBe('test@example.com');
    expect(user.dateOfBirth).toBeNull();
  });

  it('merges overrides correctly', () => {
    const user = makeMockUser({
      email: 'sara@hypulse.io',
      dateOfBirth: '1995-06-15',
    });
    expect(user.email).toBe('sara@hypulse.io');
    expect(user.dateOfBirth).toBe('1995-06-15');
    // untouched fields preserved
    expect(user.username).toBe('testuser');
  });
});
