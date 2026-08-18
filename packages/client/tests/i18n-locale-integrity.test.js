import { describe, it, expect } from 'vitest';

import enAuth from '../src/locales/en/auth.json';
import enFeed from '../src/locales/en/feed.json';
import enErrors from '../src/locales/en/errors.json';
import enBirthday from '../src/locales/en/birthday.json';
import enViewer from '../src/locales/en/viewer.json';
import enShop from '../src/locales/en/shop.json';
import enLogin from '../src/locales/en/login.json';
import enProfile from '../src/locales/en/profile.json';
import enInbox from '../src/locales/en/inbox.json';
import enHistory from '../src/locales/en/history.json';
import enFriends from '../src/locales/en/friends.json';
import enTabbar from '../src/locales/en/tabbar.json';
import enCommon from '../src/locales/en/common.json';

import heAuth from '../src/locales/he/auth.json';
import heFeed from '../src/locales/he/feed.json';
import heErrors from '../src/locales/he/errors.json';
import heBirthday from '../src/locales/he/birthday.json';
import heViewer from '../src/locales/he/viewer.json';
import heShop from '../src/locales/he/shop.json';
import heLogin from '../src/locales/he/login.json';
import heProfile from '../src/locales/he/profile.json';
import heInbox from '../src/locales/he/inbox.json';
import heHistory from '../src/locales/he/history.json';
import heFriends from '../src/locales/he/friends.json';
import heTabbar from '../src/locales/he/tabbar.json';
import heCommon from '../src/locales/he/common.json';

// Map of namespace name -> { en, he } resource objects.
// Add a new entry here whenever a new namespace/locale file pair is introduced.
const NAMESPACES = {
  auth: { en: enAuth, he: heAuth },
  feed: { en: enFeed, he: heFeed },
  errors: { en: enErrors, he: heErrors },
  birthday: { en: enBirthday, he: heBirthday },
  viewer: { en: enViewer, he: heViewer },
  shop: { en: enShop, he: heShop },
  login: { en: enLogin, he: heLogin },
  profile: { en: enProfile, he: heProfile },
  inbox: { en: enInbox, he: heInbox },
  history: { en: enHistory, he: heHistory },
  friends: { en: enFriends, he: heFriends },
  tabbar: { en: enTabbar, he: heTabbar },
  common: { en: enCommon, he: heCommon },
};

describe('i18n locale integrity (B3b)', () => {
  Object.entries(NAMESPACES).forEach(([namespace, { en, he }]) => {
    describe(`namespace: ${namespace}`, () => {
      it('has at least one key defined', () => {
        expect(Object.keys(en).length).toBeGreaterThan(0);
      });

      it('every English key has a matching Hebrew key (no missing keys)', () => {
        const enKeys = Object.keys(en);
        const heKeys = new Set(Object.keys(he));
        const missingInHe = enKeys.filter((key) => !heKeys.has(key));

        expect(
          missingInHe,
          `Missing Hebrew translations for keys: ${missingInHe.join(', ')} in namespace "${namespace}"`
        ).toEqual([]);
      });

      it('every Hebrew key has a matching English key (no orphan keys)', () => {
        const heKeys = Object.keys(he);
        const enKeys = new Set(Object.keys(en));
        const missingInEn = heKeys.filter((key) => !enKeys.has(key));

        expect(
          missingInEn,
          `Orphan Hebrew keys with no English counterpart: ${missingInEn.join(', ')} in namespace "${namespace}"`
        ).toEqual([]);
      });

      it('no key has an empty string value in either language', () => {
        const emptyEnKeys = Object.entries(en)
          .filter(
            ([, value]) => typeof value === 'string' && value.trim() === ''
          )
          .map(([key]) => key);
        const emptyHeKeys = Object.entries(he)
          .filter(
            ([, value]) => typeof value === 'string' && value.trim() === ''
          )
          .map(([key]) => key);

        expect(emptyEnKeys, `Empty EN values in "${namespace}"`).toEqual([]);
        expect(emptyHeKeys, `Empty HE values in "${namespace}"`).toEqual([]);
      });

      it('interpolation placeholders match between EN and HE for every key', () => {
        const placeholderPattern = /\{\{(\w+)\}\}/g;

        const extractPlaceholders = (str) =>
          [...str.matchAll(placeholderPattern)].map((m) => m[1]).sort();

        const mismatches = [];

        Object.keys(en).forEach((key) => {
          if (!(key in he)) return; // already caught by the "missing keys" test above
          const enPlaceholders = extractPlaceholders(en[key]);
          const hePlaceholders = extractPlaceholders(he[key]);

          if (
            JSON.stringify(enPlaceholders) !== JSON.stringify(hePlaceholders)
          ) {
            mismatches.push(
              `${key} (en: [${enPlaceholders}], he: [${hePlaceholders}])`
            );
          }
        });

        expect(
          mismatches,
          `Interpolation placeholder mismatch in "${namespace}": ${mismatches.join('; ')}`
        ).toEqual([]);
      });
    });
  });

  it('all expected B3b namespaces are present', () => {
    const requiredB3bNamespaces = [
      'shop',
      'login',
      'profile',
      'inbox',
      'history',
      'friends',
      'tabbar',
      'common',
    ];

    requiredB3bNamespaces.forEach((ns) => {
      expect(
        NAMESPACES,
        `Namespace "${ns}" is missing from NAMESPACES map`
      ).toHaveProperty(ns);
    });
  });
});
