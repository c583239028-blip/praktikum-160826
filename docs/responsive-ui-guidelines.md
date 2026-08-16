# Responsive UI Guidelines — HyPulse Client (Android + iOS)

> How we build screens so the **same code looks right on every phone**, both platforms, both
> orientations of the notch/status-bar. Companion to [SPEC.md](spec/SPEC.md) (behavior) and
> [FIGMA-SCREENS.md](spec/FIGMA-SCREENS.md) (screen inventory). Stack: Expo SDK 54, RN 0.81, expo-router.

## TL;DR — there is no "magic template", there is a shared layer

There is **no Figma file or RN component you drop in once and every screen is responsive**. What
*does* work — and is the real answer to "one template for all screens" — is a **small shared design
layer that every screen reuses**:

1. **Design tokens** — already exist: **`constants/design.js`** (colors, spacing, font sizes, radii,
   `TextStyles`). Use it. Do **not** create a second token file.
2. **`<Screen>` wrapper** — one component that handles safe-area + background + base padding.
3. **`scale()` font helper** — so text/spacing breathe a little on small vs large phones.

Build #2 and #3 **once**, apply to every screen on top of the existing tokens, and you get the
"apply once, works everywhere" behavior. The Figma equivalent is Auto Layout + Constraints +
Variables — same idea, also built once.

---

## Current state (audited 2026-06-18, against the real code)

| Problem | Where | Impact |
|---|---|---|
| `SafeAreaView` imported from **`react-native`** | `BroadcastScreen.js:7`, `ViewerScreen.js:7` — **both throwaway server-test screens** | iOS-only; do **not** copy this pattern. Real issue: most real screens have **no** safe-area handling at all |
| **No theme/token file** | (none exists) | colors/sizes hardcoded in every screen; no single place to change |
| Hardcoded `position:absolute, top:50` to dodge notch | `ShopScreen.js`, `GameScreen.js` | breaks on devices with a different notch/status-bar height |
| Fixed pixel font sizes (`fontSize: 28`, `24`…) | all screens | no adaptation between small (SE) and large phones |
| **Rubik font never loaded** | no `useFonts`, no expo-font plugin, no `.ttf` | every `fontFamily:'Rubik'` in `design.js` silently falls back to the system font — **different on iOS vs Android** |
| **Two `Colors` exports collide** | `constants/design.js` (brand) vs `constants/theme.js` (Expo boilerplate) | import confusion; `theme.js` + its `.tsx` consumers are dead Expo scaffolding |
| **App is coded dark, design system is light** | `_layout.js` bg `#1a1a1a` (global) leaks into every screen | **Decided (Sara):** dark is a temporary *placeholder for the camera/video surface*, valid only on video screens. All non-video screens flip to `design.js` light tokens; remove the dark default from the root layout. Palette is also 8+ inconsistent ad-hoc darks |
| **`FIGMA_GUIDELINES.md` is stale (2026-06-07)** | contradicts `design.js`: Poppins vs Rubik, `#41424B` vs `#1F293B`, H1 30 vs 32 | devs copying from it ship wrong values |

`react-native-safe-area-context@~5.6.0` is **already installed** — we just aren't using it.
`design.js` is **already adopted** by `StreamCard`, `RegisterButton`, `LazyAuthModal` — but **no screen** uses it yet.

---

## The principles

### 1. Never hardcode the safe area — use `react-native-safe-area-context`
- Wrap the app once in `<SafeAreaProvider>` (in the root `_layout.js`).
- In screens use `SafeAreaView` **from `react-native-safe-area-context`**, never from `react-native`.
- For custom positioning (a floating button, an absolute header) use `useSafeAreaInsets()` and add
  `insets.top` / `insets.bottom` instead of a magic number like `top: 50`.

```js
// ❌ iOS-only, silently broken on Android
import { SafeAreaView } from 'react-native';

// ✅ works on both platforms
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
```

### 2. Layout = Flexbox, not fixed dimensions
- `flex: 1` to fill, `flexDirection` + `justifyContent`/`alignItems` to arrange. This is the RN
  equivalent of Figma **Auto Layout**.
- Use **percentages or `flex`** for widths that should adapt, not fixed `width: 320`.
- Reserve fixed `width`/`height` for things that are genuinely fixed-size (icons, avatars).
- Use `gap` (already used in `ShopScreen`) instead of per-child margins where possible.

### 3. One source of truth for design values — use the existing `constants/design.js`
The token file **already exists** at `packages/client/constants/design.js` (`Colors`, `Spacing`,
`BorderRadius`, `FontSize`, `TextStyles`, `Gradients`). Import from it; never re-declare literals:

```js
import { Colors, Spacing, BorderRadius, TextStyles } from '@/constants/design';
// color: Colors.primary.default, padding: Spacing['2xl'], ...styles: TextStyles.h1
```

Change a brand color once → every screen updates. **Two cleanups required first:**
- Delete the unused Expo-boilerplate `constants/theme.js` and its `.tsx` consumers
  (`use-theme-color`, `themed-text`, `themed-view`, `parallax-scroll-view`, `ui/collapsible`) so the
  duplicate `Colors` export can't be imported by mistake.
- Treat `design.js` as authoritative over `FIGMA_GUIDELINES.md` until that doc is refreshed.

### 4. Scale text & spacing to screen size (don't trust raw pixels)
A `fontSize: 28` that fills an iPhone 15 looks huge on an SE and tiny on a tablet. **Built** at
[`src/hooks/useScale.js`](../packages/client/src/hooks/useScale.js) (uses `useWindowDimensions`, so it
re-computes on rotation/resize, unlike the static `Dimensions.get`):

```js
import { useScale } from '@/hooks/useScale';
const { scale, moderateScale } = useScale();
// fontSize: scale(FontSize.h1)          — linear, for prominent typography / large spacings
// padding:  moderateScale(Spacing.lg)   — dampened (factor 0.5), avoids blow-up on tablets
```

Use it for font sizes and large spacings; keep hairlines/borders fixed.

### 5. Respect the user's OS font setting (accessibility)
Don't blanket-disable it, but cap runaway scaling on tight layouts with
`maxFontSizeMultiplier` on `<Text>` rather than `allowFontScaling={false}`.

### 6. Actually load the brand font (Rubik) — or stop referencing it
`design.js` sets `fontFamily: 'Rubik'`, but nothing loads Rubik, so it renders as the OS default
(San Francisco on iOS, Roboto on Android — i.e. inconsistent across platforms).
**Decided (Sara):** load Rubik via the **`expo-font` config plugin in `app.json`** — it embeds the
font at build time (best fit since the project already ships a custom dev client: no render-gating,
no flash of unstyled text). Add the Rubik `.ttf` files under `packages/client/assets/fonts/` and
list them in the plugin; then rebuild the dev client. The `FontFamily.primary` *declaration* stays
in `design.js` — only the *loading* lives in `app.json`.

### 7. Design & build to a single base width, verify on the two extremes
- **Base = 390 px** (matches the Figma base, iPhone 14/15).
- Always test the two ends: **small** (iPhone SE / 320–375) and **large/Android** (Pixel 412+).
  If it survives both extremes it survives everything between.

### 8. Long lists & content must scroll
Any screen whose content can exceed one viewport gets `ScrollView`/`FlatList`. `ShopScreen` centers
with `justifyContent: 'center'` — fine for 3 cards, will clip on a small phone if content grows.

### 9. RTL is first-class (Hebrew)
- Use logical props: `paddingStart`/`paddingEnd`, `marginStart`/`marginEnd` — **never** hardcode
  `left`/`right` for content that should flip with RTL.
- See the known RTL reload-loop issue tracked separately (i18n infra) before forcing RTL.

---

## The "template" in practice — a `<Screen>` wrapper

This is the closest thing to "one template applied to all screens". **Built** at
[`src/components/Screen.js`](../packages/client/src/components/Screen.js) — it wraps
`react-native-safe-area-context`'s `SafeAreaView`, applies a light `design.js` background, and adds
base horizontal padding. Every screen becomes:

```js
import Screen from '@/components/Screen';

return (
  <Screen>
    {/* content — safe-area, background and base padding already handled */}
  </Screen>
);
// <Screen padded={false}> for full-bleed lists; backgroundColor / edges props to override.
```

Now safe-area, background, and base padding are solved **in one place for all screens**. That is the
template — it just lives in code, not in Figma. (Video/camera surfaces stay full-bleed dark and do
**not** use this wrapper.)

---

## Migration order (low-risk, incremental)

1. ~~Decide light vs dark~~ **Decided:** light per `design.js`; dark only as the camera/video
   placeholder. Remove the dark default from the root `_layout.js`.
2. **Clean up duplicates:** delete `constants/theme.js` + its `.tsx` boilerplate consumers; refresh
   or retire the stale `FIGMA_GUIDELINES.md` so `design.js` is the single source.
3. **Fix the real bugs:** (a) load Rubik (or drop it); (b) swap the two `SafeAreaView` imports to
   `react-native-safe-area-context` and confirm `<SafeAreaProvider>` wraps the root `_layout.js`.
4. ✅ **Done (2026-06-19):** `src/components/Screen.js` + `src/hooks/useScale.js` built;
   `<SafeAreaProvider>` added to the root `_layout.js`.
5. Convert screens to `<Screen>` one at a time, replacing `position:absolute, top:50`-style hacks
   with `useSafeAreaInsets()`, and replacing hardcoded colors/spacings with `design.js` tokens.
6. Introduce `useScale()` for the prominent typography last.
