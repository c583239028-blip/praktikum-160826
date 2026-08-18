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
}));

jest.mock('expo-updates', () => ({
  reloadAsync: jest.fn(),
}));

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'en' }],
}));

jest.mock('../src/assets/locales/en/common.json', () => ({}), {
  virtual: true,
});
jest.mock('../src/assets/locales/he/common.json', () => ({}), {
  virtual: true,
});

// ─── Helper ──────────────────────────────────────────────────────────────────

// relies on i18next auto-invoking detect() during init(); setImmediate lets async mocks settle.
function loadI18nAndWaitForDetection() {
  let i18nModule;
  jest.isolateModules(() => {
    i18nModule = require('../src/i18n').default;
  });
  return new Promise((resolve) => setImmediate(() => resolve(i18nModule)));
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('applyRTL – loop guard (SCRUM-127)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: no saved language, no RTL flag, device is LTR
    AsyncStorage.getItem.mockResolvedValue(null);
    AsyncStorage.setItem.mockResolvedValue(undefined);
    AsyncStorage.removeItem.mockResolvedValue(undefined);
    I18nManager.isRTL = false;
    Updates.reloadAsync.mockResolvedValue(undefined);
  });

  test('triggers at least one reload on first RTL mismatch, and sets the guard flag', async () => {
    I18nManager.isRTL = false;
    // Saved language is Hebrew, no reload flag yet → first-time mismatch
    AsyncStorage.getItem.mockImplementation((key) => {
      if (key === 'user-language') return Promise.resolve('he');
      return Promise.resolve(null); // rtl-reload-pending not set
    });

    await loadI18nAndWaitForDetection();

    // The mismatch must trigger at least one reload...
    expect(Updates.reloadAsync).toHaveBeenCalled();
    // persisting the guard flag here is what prevents the infinite loop on the next launch
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      'rtl-reload-pending',
      'true'
    );
  });

  test('does NOT call reloadAsync on the post-reload launch (flag is set)', async () => {
    I18nManager.isRTL = false;
    AsyncStorage.getItem.mockImplementation((key) => {
      if (key === 'user-language') return Promise.resolve('he');
      if (key === 'rtl-reload-pending') return Promise.resolve('true');
      return Promise.resolve(null);
    });

    await loadI18nAndWaitForDetection();

    // core regression guard for SCRUM-127: once the flag is set, no second reload should fire
    expect(Updates.reloadAsync).not.toHaveBeenCalled();
    // Flag must be cleared after the guard fires
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
