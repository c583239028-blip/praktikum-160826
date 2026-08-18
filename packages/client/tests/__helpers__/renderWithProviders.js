/**
 * tests/__helpers__/renderWithProviders.js
 *
 * Central render helper — wraps the component under test with every Provider
 * the app's screens require (Redux store, i18n, AuthContext).
 *
 * Usage:
 *   import { renderWithProviders } from './__helpers__/renderWithProviders';
 *   const { getByText } = renderWithProviders(<MyScreen />);
 *
 *   // Custom store state:
 *   renderWithProviders(<MyScreen />, { preloadedState: { wallet: { coins: 100 } } });
 *
 *   // Custom auth context:
 *   renderWithProviders(<MyScreen />, { authValue: { user: mockUser } });
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { I18nextProvider } from 'react-i18next';
import i18n from './i18nTest';
import { AuthContext } from '../../src/context/AuthContext';

// ─── Default mock slices ──────────────────────────────────────────────────────
// Import the real slice reducers so the store shape matches production exactly.
// Tests that don't care about a slice just get an empty-but-valid initial state.
import gameStreamReducer from '../../src/store/slices/gameStreamSlice';
import historyReducer from '../../src/store/slices/historySlice';
import inboxReducer from '../../src/store/slices/inboxSlice';
import walletReducer from '../../src/store/slices/walletSlice';

// ─── Default auth context value ───────────────────────────────────────────────
const DEFAULT_AUTH = {
  user: null,
  token: null,
  login: jest.fn(),
  logout: jest.fn(),
  isLoading: false,
};

// ─── Factory: makeMockUser ────────────────────────────────────────────────────
/**
 * Returns a mock user object. Override any field via the `overrides` param.
 *
 * @param {Partial<{id,email,username,dateOfBirth}>} overrides
 */
export function makeMockUser(overrides = {}) {
  return {
    id: 'user-test-1',
    email: 'test@example.com',
    username: 'testuser',
    dateOfBirth: null,
    ...overrides,
  };
}

// ─── Main helper ──────────────────────────────────────────────────────────────
/**
 * @param {React.ReactElement} ui         — component to render
 * @param {object}             options
 * @param {object}             options.preloadedState  — partial Redux state
 * @param {object}             options.store           — use a pre-built store instead
 * @param {object}             options.authValue       — override AuthContext value
 * @param {object}             options.renderOptions   — extra options forwarded to render()
 */
export function renderWithProviders(
  ui,
  { preloadedState = {}, store, authValue = {}, ...renderOptions } = {}
) {
  const testStore =
    store ??
    configureStore({
      reducer: {
        gameStream: gameStreamReducer,
        history: historyReducer,
        inbox: inboxReducer,
        wallet: walletReducer,
      },
      preloadedState,
    });

  const auth = { ...DEFAULT_AUTH, ...authValue };

  function Wrapper({ children }) {
    return (
      <Provider store={testStore}>
        <I18nextProvider i18n={i18n}>
          <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>
        </I18nextProvider>
      </Provider>
    );
  }

  return {
    store: testStore,
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
  };
}

// ─── Utility: flushPromises ───────────────────────────────────────────────────
/**
 * Flushes all pending promises (useful after act() for async side-effects).
 *
 * @returns {Promise<void>}
 */
export function flushPromises() {
  return new Promise((resolve) => setImmediate(resolve));
}
