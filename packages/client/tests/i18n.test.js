const AsyncStorage = require('@react-native-async-storage/async-storage');
const { I18nManager } = require('react-native');
const Updates = require('expo-updates');

// ─── Mocks ───────────────────────────────────────────────────────────────────

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

jest.mock('react-native', () => ({
  I18nManager: {
    isRTL: false,
    allowRTL: jest.fn(),
    forceRTL: jest.fn(),
  },
  AppState: {
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
    currentState: 'active',
  },
}));

jest.mock('expo-updates', () => ({
  reloadAsync: jest.fn(),
}));

jest.mock('expo-localization', () => ({
  // Device locale is Hebrew so these tests exercise the RTL path (SCRUM-127):
  // resolveDeviceLanguage() follows the device locale first, so an 'en' device
  // here would resolve to LTR and never hit the branch under test.
  getLocales: () => [{ languageCode: 'he' }],
}));

jest.mock('../src/assets/locales/en/common.json', () => ({}), {
  virtual: true,
});
jest.mock('../src/assets/locales/he/common.json', () => ({}), {
  virtual: true,
});

// ─── Helper ──────────────────────────────────────────────────────────────────

// relies on i18next auto-invoking detect() during init(); setImmediate lets async mocks settle.
// Returns the whole module (not just .default) so tests can also reach
// applyPendingRTLReload — the post-mount trigger that actually performs the reload.
function loadI18nAndWaitForDetection() {
  let i18nModule;
  jest.isolateModules(() => {
    // jest.setup.js initializes the shared i18next singleton globally, once, before
    // every suite runs (so LoginScreen.test.js etc. get real translated strings).
    // isolateModules gives src/i18n.js a fresh module registry, but the i18next
    // *instance* it pulls in is still the one already initialized in jest.setup.js —
    // isolateModules doesn't clear that. As a result, src/i18n.js's own
    // i18n.use(...).init(...) call becomes a no-op re-init on an already-initialized
    // instance, and the language-detection callback (which drives the RTL-mismatch
    // reload logic under test here) never fires.
    //
    // Force isInitialized back to false so src/i18n.js's init() actually runs its
    // detection/callback chain fresh, the way it would on a real cold app launch.
    const i18nSingleton = require('i18next');
    i18nSingleton.isInitialized = false;

    i18nModule = require('../src/i18n');
  });
  return new Promise((resolve) => setImmediate(() => resolve(i18nModule)));
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('applyRTL – loop guard (SCRUM-127)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: no saved language, no RTL flag, native direction LTR
    AsyncStorage.getItem.mockResolvedValue(null);
    AsyncStorage.setItem.mockResolvedValue(undefined);
    AsyncStorage.removeItem.mockResolvedValue(undefined);
    I18nManager.isRTL = false;
    Updates.reloadAsync.mockResolvedValue(undefined);
  });

  test('defers the reload on first RTL mismatch, then fires it once post-mount', async () => {
    I18nManager.isRTL = false;
    // Saved language is Hebrew, no reload flag yet → first-time mismatch
    AsyncStorage.getItem.mockImplementation((key) => {
      if (key === 'user-language') return Promise.resolve('he');
      return Promise.resolve(null); // rtl-reload-pending not set
    });

    const i18nModule = await loadI18nAndWaitForDetection();

    // init() must NOT reload directly — doing so during i18next init races with
    // native module registration on the New Architecture (see src/i18n.js). It
    // only marks a pending reload and persists the guard flag as the target
    // DIRECTION ('rtl'/'ltr'), not a boolean.
    expect(Updates.reloadAsync).not.toHaveBeenCalled();
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      'rtl-reload-pending',
      'rtl'
    );

    // The actual reload is triggered later, once, from RootLayout after mount.
    await i18nModule.applyPendingRTLReload();
    expect(Updates.reloadAsync).toHaveBeenCalledTimes(1);
  });

  test('does NOT call reloadAsync on the post-reload launch (flag matches target)', async () => {
    I18nManager.isRTL = false;
    AsyncStorage.getItem.mockImplementation((key) => {
      if (key === 'user-language') return Promise.resolve('he');
      // Guard flag stores the target direction, not a boolean.
      if (key === 'rtl-reload-pending') return Promise.resolve('rtl');
      return Promise.resolve(null);
    });

    await loadI18nAndWaitForDetection();

    // core regression guard for SCRUM-127: once the flag matches the target
    // direction, the loop guard fires and no second reload is requested
    expect(Updates.reloadAsync).not.toHaveBeenCalled();
    // Flag must be cleared once the guard fires
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('rtl-reload-pending');
  });

  test('does NOT call reloadAsync when direction already matches', async () => {
    // Device is already RTL and saved language is Hebrew → no mismatch
    I18nManager.isRTL = true;
    AsyncStorage.getItem.mockImplementation((key) => {
      if (key === 'user-language') return Promise.resolve('he');
      return Promise.resolve(null);
    });

    await loadI18nAndWaitForDetection();

    expect(Updates.reloadAsync).not.toHaveBeenCalled();
  });
});
