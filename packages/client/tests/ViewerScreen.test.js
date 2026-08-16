/**
 * tests/ViewerScreen.test.js — SCRUM-187 AC4 (Viewer)
 *
 * מכסה את שלושת קריטריוני הקבלה של צריכת activeQuestion במסך הצופה:
 *   1. השאלה מוצגת מה-store דרך useSelector כשהצופה בלייב (וכלום לא כשהיא null).
 *   2. המסך לא מבצע שום fetch — הנתונים מגיעים מהסוקט דרך questionsSlice.
 *   3. clearActiveQuestion נשלח ב-unmount ומאפס את ה-store.
 *
 * הערה (סara): הלוגיקה שוכתבה מול ה-mocks של ViewerScreen. אין להעתיק את
 * הטסטים של PlayerScreen כמו שהם — ה-mocks שם (MediasoupManager/RemoteGame)
 * לא רלוונטיים. האוברליי מגודר ב-viewState==='live' && activeQuestion; כאן live
 * נגזר נכון (setViewState('live') ב-JOIN), בניגוד למסך השחקן שבו הגידור נשבר.
 */

import React from 'react';
import { screen } from '@testing-library/react-native';
import { configureStore } from '@reduxjs/toolkit';

import questionsReducer from '../src/store/slices/questionsSlice';
import gameStreamReducer from '../src/store/slices/gameStreamSlice';
import ViewerScreen from '../src/screens/ViewerScreen';
import { renderWithProviders } from './__helpers__/renderWithProviders';

// ─── Mocks ────────────────────────────────────────────────────────────────
// src/i18n מייבא expo-updates (ESM לא מתומר ע"י jest) ומאתחל instance עם
// side-effects. ViewerScreen קורא ל-i18n.t ישירות מהמודול הזה (לא דרך
// I18nextProvider), אז מספיק להחזיר את המפתח.
jest.mock('../src/i18n', () => ({
  __esModule: true,
  default: { t: (key) => key },
}));

// שכבת הסוקטים — ViewerScreen פותח mediaSocket + appSocket ב-mount effect.
// מחזירים סוקטים מזויפים עם on/off כדי שה-cleanup לא יקרוס.
jest.mock('../src/services/socket.service', () => {
  const fakeSocket = { on: jest.fn(), off: jest.fn(), emit: jest.fn() };
  return {
    connectAppSocket: jest.fn().mockResolvedValue(fakeSocket),
    connectMediaSocket: jest.fn().mockResolvedValue(fakeSocket),
    // currentProducerId נוכח → ה-JOIN מעביר את ה-viewState ל-'live', מה שנדרש
    // כדי שהאוברליי יתרנדר (הגידור viewState==='live').
    emitMediaPromise: jest
      .fn()
      .mockResolvedValue({ currentProducerId: 'producer-1' }),
    watchStreamRoom: jest.fn(),
    leaveStreamRoom: jest.fn(),
  };
});

jest.mock('../src/hooks/useAuthGuard', () => ({
  useAuthGuard: () => ({
    guardedAction: (action) => action(),
    isModalVisible: false,
    closeAuthModal: jest.fn(),
  }),
}));

jest.mock('../src/services/birthday.service', () => ({
  birthdayService: {
    shouldShowPopup: jest.fn().mockReturnValue(false),
    saveBirthday: jest.fn().mockResolvedValue(true),
  },
}));

// expo-video — useVideoPlayer מוחזר כ-stub, VideoView לא מרונדר.
jest.mock('expo-video', () => ({
  useVideoPlayer: () => ({ play: jest.fn(), pause: jest.fn() }),
  VideoView: () => null,
}));

// קומפוננטות בת כבדות שאינן במוקד הבדיקה — מנוטרלות כדי לא לגרור את התלויות
// שלהן (reanimated/modals).
jest.mock('../src/components/LazyAuthModal', () => () => null);
jest.mock('../src/components/ErrorState', () => () => null);
jest.mock('../src/components/LoadingSkeletonCard', () => () => null);
jest.mock('../src/components/BirthdayModal', () => () => null);
jest.mock('../src/components/game/WinLossAnimation', () => ({
  WinLossAnimation: () => null,
}));

// ─── Helpers ──────────────────────────────────────────────────────────────
const mockQuestion = {
  id: 'q1',
  questionText: 'Test question?',
  rewardType: 'POT',
  options: [
    { id: 'o1', text: 'Option A' },
    { id: 'o2', text: 'Option B' },
  ],
  timeLimit: null,
};

const baseQuestionsState = {
  activeQuestion: null,
  isResolved: false,
  loading: false,
  error: null,
  questions: [],
};

// renderWithProviders מזריק store, i18n ו-AuthContext. ה-store הדיפולטי שלו
// לא כולל את slice ה-questions, אז מזריקים store מותאם עם questions+gameStream.
function renderViewer(questionsState) {
  const store = configureStore({
    reducer: {
      questions: questionsReducer,
      gameStream: gameStreamReducer,
    },
    preloadedState: { questions: questionsState },
  });

  return renderWithProviders(<ViewerScreen />, { store });
}

// ─── Tests ────────────────────────────────────────────────────────────────
describe('ViewerScreen — activeQuestion consumption (SCRUM-187 AC4)', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('לא מציג את השאלה כאשר activeQuestion=null', () => {
    renderViewer({ ...baseQuestionsState, activeQuestion: null });
    expect(screen.queryByText('Test question?')).toBeNull();
  });

  it('מציג את activeQuestion מה-store כאשר הצופה בלייב (AC1)', async () => {
    // preloaded streamId → auto-join → emitMediaPromise (currentProducerId) →
    // viewState='live' → האוברליי מתרנדר. findByText ממתין ל-join האסינכרוני.
    const store = configureStore({
      reducer: { questions: questionsReducer, gameStream: gameStreamReducer },
      preloadedState: {
        questions: { ...baseQuestionsState, activeQuestion: mockQuestion },
        gameStream: { streamId: 'stream-1' },
      },
    });
    renderWithProviders(<ViewerScreen />, { store });

    expect(await screen.findByText('Test question?')).toBeTruthy();
    expect(screen.getByText('Option A')).toBeTruthy();
    expect(screen.getByText('Option B')).toBeTruthy();
  });

  it('לא מבצע שום fetch — הנתונים מגיעים מהסוקט דרך ה-slice', () => {
    const fetchSpy = jest.fn();
    global.fetch = fetchSpy;
    renderViewer({ ...baseQuestionsState, activeQuestion: mockQuestion });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('שולח clearActiveQuestion ב-unmount ומאפס את ה-store (AC2)', () => {
    const { store, unmount } = renderViewer({
      ...baseQuestionsState,
      activeQuestion: mockQuestion,
    });

    expect(store.getState().questions.activeQuestion).not.toBeNull();

    unmount();

    expect(store.getState().questions.activeQuestion).toBeNull();
  });
});
