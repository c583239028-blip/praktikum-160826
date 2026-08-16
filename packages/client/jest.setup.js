/**
 * jest.setup.js
 *
 * Runs after the test framework is installed (setupFilesAfterEnv).
 * Place here: global mocks for native modules that break module loading.
 * Do NOT add mocks for things no current test imports — keep it lean.
 */

// ─── AsyncStorage ─────────────────────────────────────────────────────────────
// Official mock — replaces the inline mock that lived in apiHelpers.test.js.
// birthday.service.test.js and auth.service.test.js also need this.
//
// Default getItem resolves to 'my-token' so existing tests that rely on an
// authenticated request (apiHelpers, birthday.service) keep working without
// each file having to redeclare the mock. Tests that need a different / null
// token can override per-test with:
//   AsyncStorage.getItem.mockResolvedValueOnce(null)
jest.mock('@react-native-async-storage/async-storage', () => {
  const actualMock = require('@react-native-async-storage/async-storage/jest/async-storage-mock');
  actualMock.getItem = jest.fn().mockResolvedValue('my-token');
  return actualMock;
});

// ─── Expo Router ─────────────────────────────────────────────────────────────
// expo-router's Link/useRouter/useLocalSearchParams import native modules.
// Stub only what we need so screens that import from expo-router don't crash.
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({}),
  Link: ({ children }) => children,
  Stack: { Screen: () => null },
  Tabs: { Screen: () => null },
}));

// ─── Reanimated ───────────────────────────────────────────────────────────────
// react-native-reanimated requires a Babel plugin that doesn't run in Jest.
// jest-expo ships a preset mock for it — make sure it's applied.
jest.mock('react-native-reanimated', () =>
  require('react-native-reanimated/mock')
);

// ─── expo-font ────────────────────────────────────────────────────────────────
// useFonts always resolves synchronously in tests.
jest.mock('expo-font', () => ({
  useFonts: () => [true, null],
  loadAsync: jest.fn().mockResolvedValue(true),
}));

// ─── expo-splash-screen ───────────────────────────────────────────────────────
jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(),
  hideAsync: jest.fn(),
}));

// ─── i18next ─────────────────────────────────────────────────
// Fixes: LoginScreen.test.js failing with NO_I18NEXT_INSTANCE.
// useTranslation() needs a real i18next instance initialized before any
// component under test calls it. lng is 'en' (not 'he') because tests assert
// against the English strings (e.g. "Sign In", "Continue with Apple").
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import enLogin from './src/locales/en/login.json';

i18n.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: 'en',
  resources: {
    en: {
      login: enLogin,
    },
  },
  interpolation: { escapeValue: false },
});

// ─── AppState ────────────────────────────────────────────────
// Fixes: i18n.test.js failing with "Cannot read properties of undefined
// (reading 'addEventListener')" — src/i18n.js calls AppState.addEventListener
// at import time, but RN's AppState has no test-environment implementation.
jest.mock('react-native/Libraries/AppState/AppState', () => ({
  addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  currentState: 'active',
}));
