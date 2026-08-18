# Shared Game Components — Sprint 2 Build Plan

> **Why this document exists:** Sprint 2 builds 4 role screens in parallel (Host / Player / Viewer / Moderator).
> Without shared atoms, each team member will invent their own `QuestionCard` / `VideoTile` / etc. inline —
> exactly what happened with `Badge`, `Card`, `Btn` in `GameScreen.js`. This doc prevents that.
>
> **Owner:** Sara (TL) — gates PR merges on this contract.
> **Target folder:** `packages/client/src/components/game/`

---

## The problem in one picture

```
GameScreen.js (today)
  └── Badge     ← defined inline, line 31
  └── Card      ← defined inline, line 54
  └── Btn       ← defined inline, line 120

PlayerScreen.js, ViewerScreen.js, BroadcastScreen.js
  └── will each re-invent these if we don't act now
```

---

## Priority 1 — Build before any role screen is finished (blocking 3+ screens)

### `VideoTile`
**Who needs it:** PlayerScreen (camera grid), ViewerScreen (remote overlay), ModeratorScreen (remote grid)
**What it renders:** single RTCView tile — player name + gift count + speaker-state icon + camera-off fallback (profile picture per Figma/אפיון C4)

```js
<VideoTile
  stream={rtcStream}         // MediaStream | null
  label="Player Name"
  giftCount={3}
  isSpeaking={false}
  isCameraOff={false}
  size="full" | "grid"       // full = close-up single, grid = 2×2 remote
/>
```

**Figma refs:** Moderator Remote live grid `7148:62905+`, Viewer Remote grid `7014:29794+`, Additional Player grid (missing frame, C2 — use Viewer as proxy)

---

### `JoinLifecycle`
**Who needs it:** PlayerScreen (entering → rejected → dialog), ModeratorScreen (entering → rejected → 60s countdown)
**What it renders:** full-screen overlay with 3 states — `entering` / `rejected` / `dialog`

```js
<JoinLifecycle
  state="entering" | "rejected" | "dialog"
  role="player" | "moderator"
  countdown={60}             // only for state="dialog"
  onAccept={fn}
  onDecline={fn}
/>
```

**Figma refs:**
- Moderator close-up: `7097:51677` (entering), `7097:51715` (rejected), `7097:51741` (dialog)
- Additional Player: `7691:45327` (entering), `7691:45363` (rejected), `7691:45389` (dialog)

---

### `QuestionCard`
**Who needs it:** ViewerScreen (betting UI), ModeratorScreen (question display + resolve list)
**Two modes — controlled by `mode` prop:**

```js
// Viewer mode: shows options + wager drag mechanic (C5 Zoom decision)
<QuestionCard
  mode="viewer"
  question={{ id, text, options, rewardType }}
  onWager={(optionId, amount) => {}}
/>

// Moderator mode: shows options + resolve button + pending-question pills
<QuestionCard
  mode="moderator"
  question={{ id, text, options, rewardType }}
  onResolve={(optionId) => {}}
/>
```

**Figma refs:**
- Viewer wager: `1000217811` / `1000217812` (wager drag mechanic — see SPEC §6.3 C5)
- Moderator composer: `7097:53517`, resolve: `7097:51953`

**⚠️ Wager mechanic (SPEC §6.3 C5 — Zoom decision):** viewer picks answer and **drags the matching Currency Bank icon onto it**. The old "3-random points picker" is dropped. Keep `mode="viewer"` as a placeholder with a `Button` for now; the drag mechanic is S3 scope.

---

## Priority 2 — Build in parallel with the screens (shared but not blocking)

### `TimerBar`
**Who needs it:** ViewerScreen (wager deadline countdown), ModeratorScreen (open-question timer)

```js
<TimerBar
  totalSeconds={30}
  remainingSeconds={12}
  color="warning" | "danger"  // changes at 10s remaining
/>
```

**Figma refs:** `icon/clock-filled` + progress-bar component `6544:35108`

---

### `LiveIndicator`
**Who needs it:** HostScreen (top bar), ViewerScreen (LIVE badge), ModeratorScreen

```js
<LiveIndicator
  isLive={true}
  viewerCount={142}
/>
```

**Design:** red pill `#ff4757` + "LIVE" text + viewer count. **Never change this color** (SPEC §14).

---

### `AvatarsRow`
**Who needs it:** ViewerScreen close-up layout (top avatars row), ModeratorScreen close-up

```js
<AvatarsRow
  players={[{ id, username, avatarUrl, giftCount }]}
  onFollow={(playerId) => {}}
  onGift={(playerId) => {}}
/>
```

**Figma refs:** Viewer close-up layout (avatars row + Follow `+` + gift count per player), `7014:28192`

---

## Priority 2.5 — Add to the plan (confirmed by DEEP-DIVE)

### `ReportModal`
**Who needs it:** ViewerScreen (Settings → Live Broadcast Report), InboxScreen (Report & block)
**Confirmed same component:** `7513:104812` (Viewer) == `234306` (Inbox) — identical "Select a reason" radio list

```js
<ReportModal
  visible={true}
  onReport={(reason) => {}}
  onReportAndBlock={(reason) => {}}
  onClose={fn}
/>
```

### `ProfilePreviewCard`
**Who needs it:** ViewerScreen (tap a player), ModeratorScreen (tap a tile), HostScreen (tap a player)
**Confirmed same component** across §1/§4 (Viewer), §5/§6 (Moderator), §2/§3 (Host)
Fields: avatar + name + stat chips + Follow/Unfollow + "Go to profile"

```js
<ProfilePreviewCard
  user={{ id, username, avatarUrl, followersCount, followingCount }}
  isFollowing={false}
  onFollow={fn}
  onGoToProfile={fn}
  onClose={fn}
/>
```

**⚠️ Copy bug to fix:** "215 in progress" → "Following" (i18n `t('profile.following')`)

---

## Priority 3 — Defer / build inline first, extract in S3

| Component | Reason to defer |
|---|---|
| `GiftBazAnimation` | Large baz + small bubble — complex native animation; S2 = static gift button. But extract the **component shell** now so all 3 screens don't wire their own animation trigger differently |
| `ModeratorPIP` | Viewer-specific; floating/resizable PIP needs gesture library — S3 |
| `PracticeMode` | Already deferred to S3 in sprint-2-deferred.md |

---

## Extract now — GameScreen inline components

`GameScreen.js` has 4 usable primitives defined inline. **Extract before A4 (ModeratorScreen) starts** — Hedva will need them.

| Inline in GameScreen | Extract to |
|---|---|
| `Badge` (line 31) | `components/game/Badge.js` |
| `Card` (line 54) | `components/game/Card.js` |
| `Btn` (line 120) | `components/game/Btn.js` |
| `Field` (line 73) | `components/game/Field.js` |

These are generic enough to live in `components/game/` — not `components/` root (they're dark-theme game UI, not app-wide).

---

## Folder structure

```
packages/client/src/components/
├── game/                          ← NEW — Sprint 2 shared game atoms
│   ├── VideoTile.js               ← Priority 1
│   ├── JoinLifecycle.js           ← Priority 1
│   ├── QuestionCard.js            ← Priority 1
│   ├── TimerBar.js                ← Priority 2
│   ├── LiveIndicator.js           ← Priority 2
│   ├── AvatarsRow.js              ← Priority 2
│   ├── Badge.js                   ← Extract from GameScreen
│   ├── Card.js                    ← Extract from GameScreen
│   ├── Btn.js                     ← Extract from GameScreen
│   └── Field.js                   ← Extract from GameScreen
├── Screen.js                      ← existing
├── StreamCard.js                  ← existing
└── LazyAuthModal.js               ← existing
```

---

## Who builds what

| Component | Suggested builder | Timing |
|---|---|---|
| Extract Badge/Card/Btn/Field | Hedva (A4 first task) | Before A4 PR opens |
| `VideoTile` | Sari Volpo (A2 design half) | Week 1 |
| `JoinLifecycle` | Ruti (A2 code half) | Week 1 |
| `QuestionCard` | Sara Artzel (A3) | Week 1 |
| `TimerBar` | Sara Artzel (A3) | Week 1–2 |
| `LiveIndicator` | Riki (A1) | Week 1 |
| `AvatarsRow` | Sari Volpo (A2 design half) | Week 2 |

---

## PR merge gate

> **No role screen (A1–A4) merges if it contains a game-UI primitive defined inline.**
> If you need `QuestionCard` and it doesn't exist yet — open a stub PR for the component first, then build the screen on top of it.

---

*Last updated: 2026-06-24 · Owner: Sara*
