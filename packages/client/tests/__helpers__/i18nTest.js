/**
 * tests/__helpers__/i18nTest.js
 *
 * Lightweight i18next instance for tests.
 * Returns the key as-is when no translation is found,
 * so tests can query by translation key without maintaining a full locale file.
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

i18n.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: 'en',
  ns: ['common'],
  defaultNS: 'common',
  resources: { en: { common: {} } },
  interpolation: { escapeValue: false },
  // Return the key when translation is missing — keeps tests readable
  parseMissingKeyHandler: (key) => key,
});

export default i18n;
