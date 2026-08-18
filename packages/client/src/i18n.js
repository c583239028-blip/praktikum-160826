import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { I18nManager, AppState } from 'react-native';
import * as Updates from 'expo-updates';
import { logger } from '@worldplay/shared';
import enQuestion from './locales/en/question.json';
import enAuth from './locales/en/auth.json';
import enFeed from './locales/en/feed.json';
import enErrors from './locales/en/errors.json';
import enBirthday from './locales/en/birthday.json';
import enViewer from './locales/en/viewer.json';
import enShop from './locales/en/shop.json';
import enLogin from './locales/en/login.json';
import enProfile from './locales/en/profile.json';
import enInbox from './locales/en/inbox.json';
import enHistory from './locales/en/history.json';
import enFriends from './locales/en/friends.json';
import enTabbar from './locales/en/tabbar.json';
import enCommon from './locales/en/common.json';
import enHost from './locales/en/host.json';
import enInvitation from './locales/en/invitation.json';
import enGame from './locales/en/game.json';
// import enModerator from './locales/en/moderator.json';
import enWatchers from './locales/en/watchers.json';
import enBroadcast from './locales/en/broadcast.json';
import enConnections from './locales/en/connections.json';

import heHost from './locales/he/host.json';
import heShop from './locales/he/shop.json';
import heInvitation from './locales/he/invitation.json';
import heGame from './locales/he/game.json';
import heAuth from './locales/he/auth.json';
import heFeed from './locales/he/feed.json';
import heErrors from './locales/he/errors.json';
import heBirthday from './locales/he/birthday.json';
import heViewer from './locales/he/viewer.json';
import heLogin from './locales/he/login.json';
import heProfile from './locales/he/profile.json';
import heInbox from './locales/he/inbox.json';
import heHistory from './locales/he/history.json';
import heFriends from './locales/he/friends.json';
import heTabbar from './locales/he/tabbar.json';
import heCommon from './locales/he/common.json';
import heQuestion from './locales/he/question.json';
import heWatchers from './locales/he/watchers.json';
// import heModerator from './locales/he/moderator.json';
import heBroadcast from './locales/he/broadcast.json';
import heConnections from './locales/he/connections.json';

const LANGUAGE_KEY = 'user-language';
const SUPPORTED_LANGUAGES = ['en', 'he'];
const RTL_LANGUAGES = ['he'];
const RTL_RELOAD_FLAG = 'rtl-reload-pending';
const RTL_RELOAD_INFLIGHT_FLAG = 'rtl-reload-inflight';
// In-memory only. A layout-direction reload is required, but it must NOT be
// triggered from here. On the New Architecture, calling Updates.reloadAsync()
// during i18next init (before the React tree has mounted) races with native
// module registration and either crashes the app on cold start
// ("Cannot find native module ExpoLinking") or freezes it when the OS
// recreates activities after a live device-locale change. The actual reload
// is triggered exactly once, later, via applyPendingRTLReload() — called
// from RootLayout after mount (see _layout.js).
let pendingRTLReload = false;

// Concurrency guard: detect() (init) and refreshLanguageOnForeground() (the
// AppState listener below) can both observe the same mismatch and call
// applyRTL at nearly the same time — e.g. a locale change that happens
// right as the app cold-starts. Without serializing them, both calls can
// read the AsyncStorage guard flag before either has written its update,
// so the second call misreads the first call's in-flight request as an
// already-handled stuck reload from a previous, unrelated event — and
// skips requesting a reload it actually still needs to request. Chaining
// all calls through a single promise ensures each call's writes are fully
// settled before the next call starts reading.
let applyRTLQueue = Promise.resolve();

function applyRTL(language, previouslyAppliedLanguage) {
  applyRTLQueue = applyRTLQueue.then(() =>
    applyRTLInternal(language, previouslyAppliedLanguage)
  );
  return applyRTLQueue;
}

async function applyRTLInternal(language, previouslyAppliedLanguage) {
  const shouldBeRTL = RTL_LANGUAGES.includes(language);
  const isCurrentlyRTL = I18nManager.isRTL;
  const targetDirection = shouldBeRTL ? 'rtl' : 'ltr';
  // previouslyAppliedLanguage comes from AsyncStorage (LANGUAGE_KEY), which
  // genuinely persists across reloads and cold starts. i18n.language is NOT
  // usable here — it is always undefined on the first detect() call of
  // every cold start (i18next hasn't resolved a language yet at this point
  // in its own init), so relying on it would make "perfect alignment" never
  // match right after a reload, pushing every following cold start back
  // into the reload branch and causing a loop.
  const isLanguageAlreadyResolved = previouslyAppliedLanguage === language;

  try {
    const inflight = await AsyncStorage.getItem(RTL_RELOAD_INFLIGHT_FLAG);
    if (inflight) {
      await AsyncStorage.removeItem(RTL_RELOAD_INFLIGHT_FLAG);
      if (isLanguageAlreadyResolved) {
        I18nManager.allowRTL(shouldBeRTL);
        I18nManager.forceRTL(shouldBeRTL);
        try {
          await AsyncStorage.removeItem(RTL_RELOAD_FLAG);
        } catch (_) {}
        return;
      }
    }
  } catch (e) {
    logger.warn(`[i18n] Failed to read RTL inflight marker: ${e.message}`);
  }

  // 1. PERFECT ALIGNMENT: Only skip the reload if BOTH the native RTL
  // direction AND the language we previously persisted already match what
  // we're applying now. Checking isRTL alone is not enough — see note above.
  if (shouldBeRTL === isCurrentlyRTL && isLanguageAlreadyResolved) {
    try {
      await AsyncStorage.removeItem(RTL_RELOAD_FLAG);
    } catch (_) {}
    return;
  }

  // 2. LOOP GUARD: The flag stores WHICH direction the pending reload was
  // for, not just whether one is pending. This matters because the flag is
  // never cleared after a successful reload (see point 3) — if it were a
  // plain boolean, a later, unrelated language switch (e.g. he -> en after
  // an earlier en -> he reload already succeeded) would be misread as "the
  // same reload is still stuck" and would be silently swallowed, leaving
  // the UI on the stale language until the app is restarted by some other
  // means. Only treat this as the SAME stuck reload — and skip requesting
  // another one — if the flag matches the direction we're trying to reach
  // right now.
  try {
    const pendingDirection = await AsyncStorage.getItem(RTL_RELOAD_FLAG);
    if (pendingDirection === targetDirection) {
      if (pendingRTLReload) {
        // A reload for this exact direction was already requested earlier
        // in the same mutex queue (e.g. detect() and the AppState listener
        // both observed the same locale change) and hasn't run yet. Do
        // nothing — applying native flags here without the reload actually
        // happening would leave the UI half-updated (RTL flag flipped, but
        // i18next still rendering the old language).
        return;
      }
      await AsyncStorage.removeItem(RTL_RELOAD_FLAG);
      I18nManager.allowRTL(shouldBeRTL);
      I18nManager.forceRTL(shouldBeRTL);
      return;
    }
  } catch (e) {
    logger.warn(`[i18n] Failed to read RTL loop guard flag: ${e.message}`);
  }

  // 3. MISMATCH REQUIRING A RELOAD: Set the guard flag to the direction
  // we're requesting and apply native layout flags immediately (safe,
  // synchronous-ish). Do NOT call Updates.reloadAsync() here — just mark a
  // reload as pending for later. The flag is intentionally left in place
  // even after a successful reload; it is only cleared by point 1 (once the
  // native layout actually matches the resolved language) or by point 2
  // (if the same direction is requested again and still doesn't match).
  try {
    await AsyncStorage.setItem(RTL_RELOAD_FLAG, targetDirection);

    I18nManager.allowRTL(shouldBeRTL);
    I18nManager.forceRTL(shouldBeRTL);

    pendingRTLReload = true;
  } catch (e) {
    logger.warn(`[i18n] Failed to persist RTL guard flag: ${e.message}`);
    try {
      await AsyncStorage.removeItem(RTL_RELOAD_FLAG);
    } catch (_) {}
  }
}

/**
 * Performs the actual app reload requested by applyRTL(), if one is
 * pending. MUST be called only after the root component has mounted
 * (e.g. from a useEffect in RootLayout) — never during i18n init.
 *
 * Idempotent: safe to call multiple times (e.g. React StrictMode's double
 * effect invocation in dev). Only the first call with a pending reload
 * actually triggers Updates.reloadAsync(); subsequent calls are no-ops.
 *
 * @returns {Promise<boolean>} true if a reload was triggered, false otherwise.
 */
export async function applyPendingRTLReload() {
  if (!pendingRTLReload) return false;
  pendingRTLReload = false;

  try {
    await AsyncStorage.setItem(RTL_RELOAD_INFLIGHT_FLAG, '1');
  } catch (e) {
    logger.warn(`[i18n] Failed to persist RTL inflight marker: ${e.message}`);
  }
  try {
    await Updates.reloadAsync();
    return true;
  } catch (e) {
    logger.warn(`[i18n] Deferred RTL reload failed: ${e.message}`);
    return false;
  }
}

/** Test-only accessor for the pending-reload flag. Not used in app code. */
export function __hasPendingRTLReload() {
  return pendingRTLReload;
}

/**
 * Reads the current device locale and resolves it to one of our supported
 * languages, falling back to the previously persisted language, then 'en'.
 * Shared by detect() (used once at i18next init) and the AppState listener
 * below (used on every foreground resume) — both need identical resolution
 * logic, just triggered at different points in the lifecycle.
 */
function resolveDeviceLanguage(previouslyAppliedLanguage) {
  let resolved = null;

  try {
    const locales = Localization.getLocales?.() ?? [];
    const deviceCode = locales[0]?.languageCode ?? null;
    const shortCode = deviceCode ? deviceCode.split('-')[0] : null;
    if (shortCode && SUPPORTED_LANGUAGES.includes(shortCode)) {
      resolved = shortCode;
    }
  } catch (e) {
    logger.warn(`[i18n] Failed to read device locale: ${e.message}`);
  }

  if (!resolved) {
    if (
      previouslyAppliedLanguage &&
      SUPPORTED_LANGUAGES.includes(previouslyAppliedLanguage)
    ) {
      resolved = previouslyAppliedLanguage;
    }
  }

  return resolved ?? 'en';
}

const languageDetector = {
  type: 'languageDetector',
  async: true,

  // Device locale is the single source of truth — the app intentionally has
  // no in-UI language switch, so it must always follow the device (see
  // ticket scope). The cached value is only a fallback for when the device
  // locale can't be read or isn't one of the supported languages.
  detect: async (callback) => {
    let previouslyAppliedLanguage = null;

    try {
      previouslyAppliedLanguage = await AsyncStorage.getItem(LANGUAGE_KEY);
    } catch (e) {
      logger.warn(
        `[i18n] Failed to read previously applied language: ${e.message}`
      );
    }

    const resolved = resolveDeviceLanguage(previouslyAppliedLanguage);

    await applyRTL(resolved, previouslyAppliedLanguage);

    // Persist AFTER applyRTL has run, not before. If we wrote this first and
    // the reload applyRTL just queued never actually completes (e.g. the
    // app is killed before RootLayout's effect fires, or it fails), the
    // next cold start would see previouslyAppliedLanguage === resolved and
    // wrongly conclude (via Branch 1) that no reload is needed anymore.
    if (resolved !== previouslyAppliedLanguage) {
      try {
        await AsyncStorage.setItem(LANGUAGE_KEY, resolved);
      } catch (e) {
        logger.warn(`[i18n] Failed to persist resolved language: ${e.message}`);
      }
    }

    callback(resolved);
  },

  init: () => {},

  cacheUserLanguage: async (language) => {
    try {
      const previouslyAppliedLanguage =
        await AsyncStorage.getItem(LANGUAGE_KEY);
      await AsyncStorage.setItem(LANGUAGE_KEY, language);
      await applyRTL(language, previouslyAppliedLanguage);
    } catch (e) {
      logger.warn(
        `[i18n] Failed to cache user language selection: ${e.message}`
      );
    }
  },
};

/**
 * On Android, expo-localization's getLocales() can return a stale snapshot
 * — the OS lets the user change the device language without restarting
 * running apps, so a value read once at init may not reflect a change made
 * while the app was backgrounded (this is a documented expo-localization
 * limitation, not specific to this app). Re-checking on every foreground
 * resume (not just at cold-start init) ensures the language is refreshed
 * even when the app's process survived the OS-level locale change.
 *
 * This only feeds into the SAME applyRTL/pendingRTLReload path that
 * detect() uses — RootLayout's existing useEffect (which calls
 * applyPendingRTLReload after InteractionManager.runAfterInteractions) is
 * the only place that actually performs a reload. This listener must never
 * apply the language directly (e.g. via i18n.changeLanguage()) as a
 * "no reload needed" shortcut — that would leave pendingRTLReload set with
 * nothing left to consume it, since RootLayout's effect only runs once at
 * mount, not on every foreground resume.
 */
function refreshLanguageOnForeground(nextAppState) {
  if (nextAppState !== 'active') return;

  AsyncStorage.getItem(LANGUAGE_KEY)
    .then(async (previouslyAppliedLanguage) => {
      const resolved = resolveDeviceLanguage(previouslyAppliedLanguage);
      await applyRTL(resolved, previouslyAppliedLanguage);
      if (resolved !== previouslyAppliedLanguage) {
        try {
          await AsyncStorage.setItem(LANGUAGE_KEY, resolved);
        } catch (e) {
          logger.warn(
            `[i18n] Failed to persist resolved language: ${e.message}`
          );
        }
      }
      // If a reload was just queued by applyRTL, perform it now — this is
      // a foreground resume, not the initial mount, so RootLayout's
      // mount-only useEffect will not pick this up on its own.
      await applyPendingRTLReload();
    })
    .catch((e) => {
      logger.warn(
        `[i18n] Failed to refresh language on foreground resume: ${e.message}`
      );
    });
}

AppState.addEventListener('change', refreshLanguageOnForeground);

i18n
  .use(languageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        question: enQuestion,
        auth: enAuth,
        feed: enFeed,
        errors: enErrors,
        birthday: enBirthday,
        viewer: enViewer,
        login: enLogin,
        profile: enProfile,
        inbox: enInbox,
        history: enHistory,
        friends: enFriends,
        tabbar: enTabbar,
        common: enCommon,
        watchers: enWatchers,
        host: enHost,
        shop: enShop,
        invitation: enInvitation,
        game: enGame,
        // moderator: enModerator,
        broadcast: enBroadcast,
        connections: enConnections,
      },
      he: {
        question: heQuestion,
        auth: heAuth,
        feed: heFeed,
        errors: heErrors,
        birthday: heBirthday,
        viewer: heViewer,
        shop: heShop,
        login: heLogin,
        profile: heProfile,
        inbox: heInbox,
        history: heHistory,
        friends: heFriends,
        tabbar: heTabbar,
        common: heCommon,
        watchers: heWatchers,
        host: heHost,
        invitation: heInvitation,
        game: heGame,
        // moderator: heModerator,
        broadcast: heBroadcast,
        connections: heConnections,
      },
    },
    ns: [
      'auth',
      'feed',
      'errors',
      'birthday',
      'viewer',
      'shop',
      'login',
      'profile',
      'inbox',
      'history',
      'friends',
      'tabbar',
      'common',
      'host',
      'watchers',
      'question',
      'game',
      'moderator',
      'broadcast',
      'connections',
    ],

    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
  });

export default i18n;
