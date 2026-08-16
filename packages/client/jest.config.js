/** @type {import('jest').Config} */
const config = {
  preset: 'jest-expo',

  // ─── Setup ──────────────────────────────────────────────────────────────────
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],

  // ─── Transform ──────────────────────────────────────────────────────────────
  // jest-expo's default pattern covers most of expo/RN. We extend it only for
  // packages that ship un-transpiled ESM and are actually imported by our tests.
  transformIgnorePatterns: [
    'node_modules/(?!(' +
      'expo|' +
      'expo-auth-session|' +
      'expo-apple-authentication|' +
      'expo-crypto|' +
      'expo-web-browser|' +
      'expo-localization|' +
      'expo-constants|' +
      'expo-modules-core|' +
      '@expo/vector-icons|' +
      'react-native|' +
      '@react-native|' +
      '@react-native-async-storage|' +
      '@react-navigation|' +
      'firebase|' +
      '@firebase|' +
      '@firebase/app|' +
      '@firebase/auth|' +
      '@firebase/component|' +
      '@firebase/util|' +
      '@firebase/logger|' +
      'react-native-reanimated|' +
      'react-native-gesture-handler|' +
      'react-native-screens|' +
      'react-native-safe-area-context|' +
      'react-native-svg|' +
      'react-redux|' +
      '@reduxjs/toolkit|' +
      'immer' +
      ')/)',
  ],

  // ─── Module aliases ──────────────────────────────────────────────────────────
  moduleNameMapper: {
    // SVG files — stub them so import X from './icon.svg' doesn't break
    '\\.svg$': '<rootDir>/__mocks__/svgMock.js',
  },

  // ─── Export conditions ─────────────────────────────────────────────────────────
  testEnvironmentOptions: {
    customExportConditions: ['browser', 'require'],
  },

  // ─── Test discovery ──────────────────────────────────────────────────────────
  testMatch: [
    '<rootDir>/tests/**/*.test.[jt]s?(x)',
    '<rootDir>/src/**/*.test.[jt]s?(x)',
  ],

  // ─── Coverage (opt-in via --coverage flag) ────────────────────────────────────
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/app/**', // expo-router entry files — hard to unit-test
    '!src/**/*.d.ts',
  ],
};

module.exports = config;
