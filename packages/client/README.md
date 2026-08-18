# Client Package

Located at `packages/client`. This is the React Native / Expo frontend for HyPulse — a live-streaming trivia platform for iOS and Android.

**Expo SDK:** ~54 | **React Native:** 0.81.5 | **Router:** Expo Router v6 (file-based)

---

## Running

```bash
cd packages/client
npm start          # syncs .env from root then starts Expo dev server
npm run android    # build and run on Android device/emulator
npm run ios        # build and run on iOS simulator
npm run web        # start web version
```

`sync-env` runs automatically before each command — it copies `.env.development` (or `.env`) from the repo root into `packages/client/.env` so the app always has the latest secrets.

---

## Directory Layout

```
src/
  app/                          # Expo Router file-based routes
    _layout.js                  # Root layout — AuthProvider, Redux store
    (tabs)/
      _layout.js                # Bottom tab navigator
      index.js                  # Home / Feed tab
      live.js                   # Live streams tab
      friends.js                # Friends / social tab
      messages.js               # Inbox tab
      profile.js                # User profile tab
    broadcast.js                # Broadcaster screen
    game_screen.js              # Active game UI
    viewer.js                   # Stream viewer
  screens/                      # Full screen components
    FeedScreen.js
    BroadcastScreen.js
    GameScreen.js
    HistoryScreen.js
    InboxScreen.js
    LoginScreen.js
    PlayerScreen.js
    ShopScreen.js
    ViewerScreen.js
  components/                   # Reusable UI components
    BirthdayModal.js
    EmptyFeed.js
    ErrorState.js
    GoogleSignInButton.js
    LazyAuthModal.js            # Lazy-loaded auth prompt
    LoadingSkeletonCard.js
    StreamCard.js               # Feed card → navigates to ViewerScreen
  context/
    AuthContext.js              # Firebase auth state + JWT management
  services/
    apiConfig.js                # Base URL config (env-aware)
    apiHelpers.js               # Authenticated fetch wrapper
    auth.service.js             # Login / register / social auth API calls
    birthday.service.js         # Birthday PATCH endpoint calls
    feedApi.js                  # Feed and stream list API calls
    socket.service.js           # Socket.IO singleton
    userService.js              # User profile API calls
    MediasoupManager.js         # WebRTC client via mediasoup-client
  store/                        # Redux Toolkit
    index.js                    # Store config
    slices/
      gameStreamSlice.js        # Active game + stream state
      historySlice.js           # Past game history
      inboxSlice.js             # Inbox messages
      walletSlice.js            # Coin/wallet balance
    actions/
      gameActions.js            # Thunks for game flow
    middleware/
      socketMiddleware.js       # Socket.IO → Redux bridge
    mocks/
    webrtc.mock.js              # WebRTC stub for web/dev
constants/
  design.js                     # Design system tokens from Figma
  theme.js                      # Light/dark theme values
```

---

## Auth Stack

Auth is handled by **Firebase** (client SDK) with a **JWT** issued by the backend:

1. Firebase authenticates the user (Google Sign-In, Apple Sign-In, or email)
2. Firebase ID token is sent to `POST /api/auth/social` (or `/register` / `/login`)
3. Backend verifies the token via Firebase Admin SDK and returns a JWT
4. JWT is stored in `AuthContext` and attached to all API calls

**Current status:**

- Google Sign-In — implemented
- Apple Sign-In — in progress (branch `T39`)
- Facebook — removed from client (Sprint 5 target)

---

## Design System

`constants/design.js` — tokens extracted directly from Figma (PR #69, Jun 8 2026):

- `Colors` — brand palette, neutrals, states
- `TextStyles` — typography using **Rubik** font (supports RTL/LTR)
- `Gradients` — linear gradient definitions
- `Spacing` — padding/margin scale
- `BorderRadius` — corner radii

See `FIGMA_GUIDELINES.md` at repo root for Figma page map and node IDs.

---

## Real-Time

### Socket.IO (`socket.service.js`)

Connects to the app-server. Event names are imported from `@worldplay/shared` (`SOCKET_EVENTS`). Redux middleware bridges incoming events to store actions.

### WebRTC — Mediasoup (`MediasoupManager.js`)

Connects to the media-server. Handles transport creation, media production and consumption. Users join streams as `HOST`, `PLAYER`, or `VIEWER` — role determines which Mediasoup router they access.

---

## State Management (Redux)

| Slice             | Manages                                        |
| ----------------- | ---------------------------------------------- |
| `gameStreamSlice` | Active game state, stream status, participants |
| `historySlice`    | Past game results and history                  |
| `inboxSlice`      | Direct messages and notifications              |
| `walletSlice`     | Coin balance, transactions                     |

Socket events update Redux state via `socketMiddleware`.

---

## i18n

Internationalisation infrastructure (`i18next` + RTL support) is in progress (SCRUM-115). Translation files `en.json` / `he.json` are blocked until the infra lands (T58).

---

## Environment

The client reads from a `.env` file in `packages/client/` (auto-synced from repo root by `sync-env`):

```
EXPO_PUBLIC_API_URL=http://<host>:8080
EXPO_PUBLIC_MEDIA_SERVER_URL=http://<host>:8000
EXPO_PUBLIC_FIREBASE_API_KEY=...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=...
EXPO_PUBLIC_FIREBASE_PROJECT_ID=...
```

---

## Security / Android

`usesCleartextTraffic: true` (disables HTTPS enforcement) is active **only** in the `development` environment.
The flag lives in `app.config.js` behind an `APP_ENV` condition — not in the static `app.json`.
In production, the key is omitted entirely (not set to false — simply absent).

Before any production build, verify the flag is not leaking:

```bash
# Linux / macOS
APP_ENV=production npx expo config --type introspect   # usesCleartextTraffic must be absent under android
APP_ENV=development npx expo config --type introspect  # usesCleartextTraffic: true must appear under android

# Windows (PowerShell)
$env:APP_ENV="production"; npx expo config --type introspect
$env:APP_ENV="development"; npx expo config --type introspect

```

---

## Key Dependencies

| Package                       | Purpose                          |
| ----------------------------- | -------------------------------- |
| `expo-router` ~6              | File-based navigation            |
| `@reduxjs/toolkit`            | State management                 |
| `firebase` 12                 | Client-side auth                 |
| `mediasoup-client`            | WebRTC SFU client                |
| `socket.io-client`            | Real-time events                 |
| `@stripe/stripe-react-native` | In-app payments                  |
| `@worldplay/shared`           | Shared schemas + event constants |

---

_Last updated: 2026-06-08_

## Running Client Tests

```bash
cd packages/client
npm install        # חובה פעם ראשונה / אחרי שינוי תלויות
npm test           # מריץ את כל 6 suites — אמור לסיים ב-6/6 ✅
npm test -- --watch          # מצב watch לפיתוח
npm test -- --coverage       # דוח coverage
```

### מבנה הטסטים

packages/client/

jest.config.js ← קונפיג ראשי (preset, setup, transformIgnorePatterns, customExportConditions)

jest.setup.js ← mocks גלובליים (async-storage, expo-router, reanimated, expo-font)

`__mocks__/`

svgMock.js ← stub לייבוא קבצי .svg

tests/

helpers/

renderWithProviders.js ← render עם Redux + i18n + AuthContext

i18nTest.js ← מופע i18next קל לטסטים

apiHelpers.test.js

auth.service.test.js

i18n.test.js

LoginScreen.test.js

Googlesigninbutton.test.js

src/

services/

birthday.service.test.js ← co-located עם birthday.service.js

context/

AuthContext.js ← AuthContext מיוצא (export) כדי לאפשר הזרקת mock בטסטים

### הוספת mock חדש

| המודול ייבוא אותו                                | איפה לשים את ה-mock                         |
| ------------------------------------------------ | ------------------------------------------- |
| כל הטסטים (native module שבוצע import ב-service) | `jest.setup.js`                             |
| מודול שייבוא רק קובץ אחד                         | `jest.mock(...)` inline בקובץ הטסט          |
| mock שחוזר על עצמו ב-3+ קבצים                    | `packages/client/__mocks__/<moduleName>.js` |

### שימוש ב-`renderWithProviders`

```js
import {
  renderWithProviders,
  makeMockUser,
} from './__helpers__/renderWithProviders';

it('מציג מסך עם פרטי משתמש', () => {
  const user = makeMockUser({ email: 'sara@hypulse.io' });
  const { getByText } = renderWithProviders(<ProfileScreen />, {
    authValue: { user, token: 'jwt-123' },
    preloadedState: { wallet: { coins: 50 } },
  });
  expect(getByText('sara@hypulse.io')).toBeTruthy();
});
```

### Firebase / ESM resolution

ספריות מודרניות כמו Firebase v12, `react-redux`, ו-`immer` משתמשות ב-`package.json` `exports` map. תחת ה-`jest-environment-jsdom` ש-`jest-expo` משתמש בו, Jest עלול לבחור בטעות בגרסת ESM גולמית במקום CJS. זה נפתר באמצעות `testEnvironmentOptions.customExportConditions: ['browser', 'require']` ב-`jest.config.js` — אין צורך לגעת בזה שוב אלא אם מתווספת ספרייה חדשה עם אותה בעיה (השגיאה תיראה כמו `SyntaxError: Unexpected token 'export'`).

### warnings ידועים

- `console.warn('apiHelpers: logout handler not set')` מופיע בכוונה בטסט `'401 ללא handler — לא קורס'` ב-`apiHelpers.test.js` — הטסט בודק שהקוד לא קורס כש-`setUnauthorizedHandler(null)` נקרא, וה-warning הוא חלק מההתנהגות הנבדקת, לא תקלה.
