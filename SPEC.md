# HyPulse — Product Specification (Source of Truth)

> **Status:** v1.0 — Draft for review · **Last updated:** 2026-06-17 · **Owner:** Sara (TL/PM)
> **Language:** English is the canonical language of this document and of the product's default UI.
> This document is the single source of truth for product behavior. Where code, Figma, and this
> document disagree, this document is the intended target — discrepancies are flagged inline as
> **⚠️ DISCREPANCY** and must be reconciled (fix code or amend this spec) rather than silently ignored.

**Primary sources this spec is built from:**
- Figma — *WorId Game (Shira)*, file `FBQSv16ajir03ZAtRbuHxb` (verified live, last modified 2026-06-10). Implement only from the **`screens for dev`** page (`6619:11957`).
- Design tokens → [packages/client/constants/design.js](packages/client/constants/design.js) (source of truth); icons + component node IDs + Figma API notes → [packages/client/FIGMA_GUIDELINES.md](packages/client/FIGMA_GUIDELINES.md); screen index → [FIGMA-SCREENS.md](FIGMA-SCREENS.md).
- [packages/server/prisma/schema.prisma](packages/server/prisma/schema.prisma) — data model.
- [packages/server/src/services/economy.service.js](packages/server/src/services/economy.service.js) + [gameRules.js](packages/server/src/constants/gameRules.js) — economy rules.
- [NOTES-firebase-flows.md](NOTES-firebase-flows.md) — authentication flows.
- The 7-sprint roadmap and gap-closure analysis (`_planning/`, `.claude/sprint-plans/`).

---

## Table of Contents
1. [Product Overview](#1-product-overview)
2. [Roles & Permissions](#2-roles--permissions)
3. [Information Architecture & Navigation](#3-information-architecture--navigation)
4. [Authentication & Onboarding](#4-authentication--onboarding)
5. [Core Game Model & Lifecycle](#5-core-game-model--lifecycle)
6. [Production Screens by Role](#6-production-screens-by-role)
7. [Real-Time & Media Architecture](#7-real-time--media-architecture)
8. [Game Economy & Rules](#8-game-economy--rules)
9. [Wallet & Coin Bank](#9-wallet--coin-bank)
10. [Social Layer](#10-social-layer-profile-follow-inbox-chat-sharing)
11. [Notifications](#11-notifications)
12. [Payments](#12-payments)
13. [Internationalization (i18n) & RTL](#13-internationalization-i18n--rtl)
14. [Design System](#14-design-system)
15. [Data Model](#15-data-model)
16. [Non-Functional Requirements](#16-non-functional-requirements)
17. [Open Questions & To-Verify-Against-Figma](#17-open-questions--to-verify-against-figma)
18. [Appendix A — Figma Screen Index](#appendix-a--figma-screen-index)

---

## 1. Product Overview

**HyPulse** (Figma file: "WorId Game") is a live, interactive trivia/game-show streaming app. A **Host**
broadcasts a live video game show; on-camera **Players** compete; a **Moderator** runs the questions; and
**Viewers** watch the live stream, place coin wagers on questions, send gifts, and follow hosts. The product
combines real-time video (WebRTC/Mediasoup + HLS for scale), a real-time question/answer loop (Socket.IO),
and a virtual-coin economy.

**Platform & stack:** React Native (Expo Router) client; Node.js + Express server; PostgreSQL via Prisma;
Socket.IO; WebRTC via Mediasoup (a dedicated media-server package); Firebase Auth (Google/Apple/Facebook +
email); platform-native in-app purchases for buying coins. Monorepo: `packages/client`, `packages/server`,
`packages/media-server`, `packages/shared`.

**Two broadcast modes** (every game is one or the other):
- **Close-up** — players are physically near the host (single camera scene; players appear in the host feed).
- **Remote** — players join from their own devices (multi-camera grid, up to 4 player cameras).

**Goal milestone:** closed beta on App Store (TestFlight) + Google Play (Internal Testing).

---

## 2. Roles & Permissions

There are four functional roles. A user's primary role is stored on `User.role` (enum
`HOST | PLAYER | MODERATOR | VIEWER`, default `VIEWER`), and a per-game role is stored on
`GameParticipant.role`. The app routes the user to the correct screen by role (see §3, D1 role-router).

| Capability | Viewer | Player | Moderator | Host |
|---|:--:|:--:|:--:|:--:|
| Browse feed, watch live stream | ✅ | ✅ | ✅ | ✅ |
| Place wagers on questions | ✅ | ✅ | ✅ | ✅ |
| Send gifts to players | ✅ | ✅ | ✅ | — |
| Appear on camera (grid) | — | ✅ | — | ✅ (own) |
| Open / resolve questions | — | — | ✅ | — |
| report / mute / kick participants | — | — | ✅ | ✅ |
| Create game, invite moderator, start/stop broadcast | — | — | — | ✅ |
| Approve Close-up player join | — | — | — | ✅ |

**Guests (unauthenticated):** browse freely as a Viewer. Any *protected action* (wager, gift, follow,
open profile, etc.) triggers **Lazy Auth** (§4). Guests are routed to the Viewer experience.

---

## 3. Information Architecture & Navigation

**Bottom tab bar** (Expo Router), five slots — **verified against the Figma profile screen 2026-06-18:**

| Slot | Figma label | Purpose |
|---|---|---|
| 1 | **Home** | Feed of active streams (StreamCard list), pull-to-refresh. Entry point. |
| 2 | **Friends** | Friends / social (follow lists, suggested accounts). |
| 3 (center) | **LIVE** | Big gradient circular CTA → go live / role-based live experience (Host/Player/Viewer/Moderator). |
| 4 | **Messages** | Inbox: aggregated notifications + private chat threads. |
| 5 | **Profile** | Own profile, stats, edit, hamburger (Bank balance + Settings & Privacy), logout. |

> ⚠️ **Wallet/Coin Bank is NOT a bottom tab** — it is reached from the profile hamburger ("Bank balance")
> and the in-stream coin icon. Earlier drafts listed Feed/Play/Wallet/Inbox/Profile — corrected per Figma.

**Role-based routing (D1):** the router resolves Host/Player/Viewer/Moderator from `user.role`; guests →
Viewer + Lazy Auth; unknown role → safe Viewer fallback. Routing must respect `isLoading` (no auth flicker).

**Navigation source of truth (Figma):** nav bars per role — `main nav` `6337:18144`, `player nav`
`6604:45749`, `mendator nav` `6509:21470`, `Host nav` `6783:29874`.

---

## 4. Authentication & Onboarding

**Providers:** email/password + social (Google, Apple, Facebook) via Firebase Auth. Server verifies the
Firebase ID token with the Admin SDK (`verifyIdToken`) and issues an app JWT. Token model and provider
constructors are documented in [NOTES-firebase-flows.md](NOTES-firebase-flows.md).

**Account model:** `User` carries `firebaseId`, `googleId`, `appleId`, `facebookId` (each unique). Account
collision (same email, different provider) → catch `auth/account-exists-with-different-credential`, sign in
with the original provider, then `linkWithCredential` to merge.

### 4.1 Registration
- Full registration screen (Figma `Registration` `7721:90563`). Previously only Login existed; **Register**
  and social entry are required.

### 4.2 Lazy Auth (guest → member)
- A guest browses freely. On the **first active/protected action**, a popup (LazyAuthModal) appears offering
  sign-up, with the incentive: **+1,000 coins gift on registration**.
- New users are auto-credited **1,000 coins** (`User.walletBalance` default `1000.00`).

### 4.3 Birthday gate
- A **Birthday popup** blocks the app until a date of birth is provided (stored as `User.dateOfBirth`).
  Required for the 17+ (gambling) age rating.
- **Enforcement (designers, Zoom 2026-06-23 — R3):** the popup **re-prompts on every app entry until a DOB is
  saved** — dismissing it (the X) does **not** permanently skip it. Figma `7741:96354`. Copy fix: "1000 points"
  → coins.
- After saving, the auth context must refresh so the modal does not re-appear, and save errors must surface
  to the user (not be swallowed). *(Was a known S1 bug — T51.)*

### 4.4 Social provider status
- Google Sign-In is **blocked by an external Netfree content-filter** issue (not a code defect); the social
  buttons depend on it. Facebook Sign-In is scheduled later (compliance review). Apple is supported.

### 4.5 Email verification & multi-account (Figma profile section — new)
- **Email verification (OTP):** `Verify your email address` (Figma `7435:84880`, frame mis-named `סיסמה`) —
  6-digit code sent to the (masked) email, with "Send again". *(Not previously in this spec.)*
- **Multi-account / account switch:** users can switch between accounts and "Add Account" (Figma `7435:84737`).
  *(Implies the app supports multiple signed-in identities — scope/back-end impact to confirm.)*

---

## 5. Core Game Model & Lifecycle

**Entities** (see §15): a **Stream** is the live broadcast session; a **Game** is the trivia session inside a
stream; **Questions** belong to a game; **Players/Moderator/Host** are `GameParticipant`s; viewers' wagers are
`UserAnswer`s.

**Stream status:** `WAITING → LIVE → (PAUSE) → FINISHED`.
**Game status:** `WAITING → ACTIVE → FINISHED`.

**End-to-end happy path (the core product loop):**
1. Host creates a game (title, description, mode, optional moderator invite) and goes live.
2. Moderator (or host) opens a **Question**.
3. **DVR pause-for-viewers** kicks in: the live feed freezes *for viewers only* while the question is open
   (the media server keeps recording — §7.3).
4. Viewers place **wagers** (`UserAnswer`, min wager 10 coins) on options before the timer (default 30s) ends.
5. Question is **resolved**: correct answer marked, **economy distributes coins** (§8), `question:resolved`
   and `coin:delta`/`score:update` events broadcast.
6. Viewers' playlists are **released** ("resume-viewers") and the player catches up to live.
7. Players can receive **gifts** during the stream.
8. Host stops the broadcast; game and stream marked `FINISHED`.

**Question reward types:** `STANDARD` (pot split among correct answerers + moderator) and
`WINNER_TAKES_ALL` / "who will win" (a `QuestionOption.linkedPlayerId` ties an option to a player; 85/15 split).

---

## 6. Production Screens by Role

> Source of truth for visuals: Figma **`screens for dev`** sections (node IDs below and in Appendix A).
> Sprint 2 turns the working dev prototypes (`host_test.js`, `player_test.js`, `viewer_test.js`) into
> production screens. **Reality check:** HOST is a genuine port; PLAYER grid rendering and VIEWER HLS are
> **new builds**, not ports (see flags below).

### 6.1 Host  — Figma Close-up `7083:97876`, Remote `7277:113768`
- **Create-game screen:** name, description, mode (Close-up / Remote), invite moderator. *(New screen; the
  create-game API call already exists in the prototype.)*
- **50-followers gate** before broadcasting. *(New; needs a follower-count source.)* ⚠️ **No Figma frame yet —
  designers are adding it (🧱 H1).**
- **Practice Mode:** 30-second countdown before Going Live. *(New.)*
- **Live camera view + controls:** start/stop (ported), end-with-confirmation, LIVE indicator, live viewer count.
  ⚠️ **No manual Pause/Resume (designers, Zoom 2026-06-23 — H4).** Pausing is **automatic**: when the moderator
  opens a question the broadcast freezes **for viewers only**, then **auto-resumes from the frozen point** when
  the question timer ends (= the DVR behaviour, §7.3). The earlier "Pause/Resume (new)" control is **dropped.**
- **Mandatory lifecycle correctness:** on screen exit, stop camera tracks, close transport, mark game
  `FINISHED`; single WebRTC path via `MediasoupManager` (`@livekit/react-native-webrtc`) — do not mix the
  legacy `react-native-webrtc` import; guard against double-start.

### 6.2 Player / Additional Player — Figma Additional Player `7691:45749`, joining `4366:14142`
- **Up to 4 player cameras in a grid** (RTCView) — **remote only** (close-up = single host video + avatars
  row, no grid). ⚠️ **The grid is NOT a PlayerScreen-UI task** — it is a **cross-cutting, currently-unbuilt
  feature** shared with the remote *viewer* (§6.3), depending on **server multi-producer signaling that does
  not exist**: the media server never emits `stream:new_producer` and `stream:join` returns `producerIds`
  (no roles), while the client refs (`player_test.js`, `ViewerScreen`) expect `currentProducers`/
  `currentProducerId` — a contract mismatch. Tracked as the **Multi-camera grid epic** (backlog). Also blocked
  on missing Figma frames.
- **Self-preview** in a corner.
- **Join flow:** invite popup (Accept / Rejected-60s) **or** QR scan **(close-up players only — designers,
  Zoom 2026-06-23, C3: only close-up players can scan to join)** / external link needing Host approval (remote)
  → **Practice mode (~30 s)** → live. Entering / "Going live now" / "Waiting for the broadcast to start…" /
  rejected states. If the Host hasn't entered Practice yet, secondary players see a paused-stream screen
  (close-up) or their own camera only (remote).
- ⚠️ **Remote additional-player screens (practice + live with player controls) have no Figma frame yet —
  designers are adding them (🧱 C2).** Close-up and remote player screens are intentionally distinct.
- **Practice mode** (`מצב תרגול`, ~30 s self-check mirroring the live view): a countdown; if the player takes
  no action it auto-goes-live when it ends.
- **Default camera/mic on entry is mode-dependent** (verified vs spec `אפיון: שחקן נוסף` pp.42–45 + Figma):
  - **Close-up:** camera **OFF** + mic **OFF** by default; the player can turn them on.
  - **Remote:** camera **ON** + mic **ON** by default, and **cannot be toggled off in Practice mode**.
  - ⚠️ Supersedes the previous blanket "camera-off / mic-off on entry" (was correct for close-up only).
- **Additional Player** is a first-class secondary-player role; advanced permissions (invite players /
  moderator) are gated by a Host toggle.
- ✅ **Resolved (Zoom 2026-06-23):** mic-toggle = **Settings only** (C1, per אפיון); camera-off tile = **profile
  picture** (C4, per אפיון). 🧱 **Pending screens:** remote additional-player frames (C2) — designers adding;
  self-preview placement in the remote grid (C3) resolves with those frames.

### 6.3 Viewer — Figma Close-up `7014:27847`, Remote `7097:45650`
- **HLS player for mass viewing.** ⚠️ The prototype watches over WebRTC; **the HLS player is a new build**
  (recommended: ship WebRTC-based viewer first, add HLS for scale alongside load testing).
- **RTCView overlay / grid** for player cameras (remote). ⚠️ **Unbuilt — same cross-cutting blocker as §6.2:**
  `ViewerScreen` is single-stream (consumes one `currentProducerId`; server returns `producerIds`), and the
  `stream:new_producer` listener is dead (server never emits it). The multi-camera grid (viewer + player) is a
  **single shared epic**, not per-screen UI work. Tracked in the **Multi-camera grid epic** (backlog).
- **DVR indicators:** "Question active" (playlist frozen) and "Resuming stream…" (catching up). *(UI in S2;
  real DVR behavior in integration — §7.3.)*
- **Betting UI** on the active question + results display + coin-delta animation; guarded by Lazy Auth.
  ✅ **Wager mechanic DECIDED (designers, Zoom 2026-06-23 — C5):** you pick an answer and **wager by dragging the
  matching icon from the Currency Bank onto the chosen answer** (the Figma drag mechanic, `1000217811/812`). The
  אפיון's **3-random-points picker is DROPPED** — there is no separate amount-chip screen. The bank icons/images
  may later swap to other images/animations (future, tied to the gift-value work C7).
- **Result/win-loss popups (S2):** the per-question result overlay (Figma §12) and the end-of-game summary
  (Figma `7816:57287`, §13) are **win/loss variants of one idea — keep both**; **currency is coins everywhere**
  (fix every "points"/"lossed" string).
- **Pending-questions corner counter** is **moderator-only** (designers, Zoom — V2); viewers do not get it.
- **Exit / return (V3):** the phone **Back button exits to Home** (not back into the same stream). From Home the
  viewer sees active streams via the reduced feed/suggested algorithm and can **re-enter any stream still live.**
- **Close-up viewer layout (reviewed 2026-06-21):** single player video card + **avatars row** on top (Follow `+`
  & gift count per player) + **moderator floating PIP** (movable, **hide** via eye toggle, **resize** to a
  bottom-wide window) + **camera switcher** `1/3 📷`. Bottom nav: gift · compose-question · share · settings.
- **Viewer in-stream settings** (`settings`): Video Quality · Live Broadcast **Report** ("Select a reason" →
  Report / Report-and-block, confidential to the HyPulse team) · Propose a question to the moderator · Giving
  gifts to players/host · Share the game · Exit Live Broadcast · **Display players details** toggle.
- **Gifts:** first-open Currency Bank shows the **1000-bonus-points** banner; drag a gift onto a player → send
  toast (+ Cancel) and a **large gift "baz" animation** (close-up sender); other viewers see a **small** sender
  bubble. Sheet closes **only via X**.
- **In-stream animation & end-of-game popup:** Figma `7816:57287`.

### 6.4 Moderator — Figma Close-up `7097:51662`, Remote `7148:62527`  (reviewed 2026-06-21; אפיון pp.14–21)
- **Accept / decline invitation** with a 60-second countdown (popup "Join the game as a host" — ⚠️ copy: it's a
  *moderator* invite).
- **Question Composer:** type question + **3 default answers** (`+` to add) + tabs to **Viewer Questions** /
  **Drafts**; action bar **Publish** (⚠️ Figma reads "Advertising") / **Save Draft** / **Delete** (✅ Delete is
  real — designers, Zoom 2026-06-23; 🧱 the button has no Figma frame yet, designers adding). **Viewer
  questions** → expand → pick/edit answers → Remove / **Publish** (⚠️ remote variant reads "Which publication").
- **Per-question / pre-live controls (M2/M3, decided Zoom 2026-06-23):** **question-display duration is a
  MODERATOR setting** (a default + pick from ~4 preset times); **minimum wager per question is a HOST setting.**
  🧱 Neither control has a Figma frame yet — designers are adding them.
- **Open/pending questions** list (participants count + timestamp) → expand → pick correct answer → resolve
  ("result resolved" toast); pending questions also rotate as a **bottom banner** of pills.
- **Live layout:** close-up = avatars row + "Show details" → full participant list + single video + camera
  switcher; remote = **moderator PIP + 1–4 player grid** (name + gift count + speaker state per tile).
- **Gifts:** receiving → large baz animation; other viewers' gifts → small bubble. **Mute Players** → header
  speaker icon red.
- **Hot moderator swap:** **"Substitute Host Booking"** picker (recommended viewers first, then others, parallel
  invite) → accept → "Start handover" (120-s overlap). ⚠️ **naming bug — this replaces the *moderator*, not a
  host; "reserve"/"Booking" should be Invite.**
- ✅ **Resolved (Zoom 2026-06-23):** swap naming = **Invite a moderator** (M1, copy fix); duration→moderator,
  min-wager→host, composer **Delete** real (M2/M3); central 🚫 = video-region placeholder (M4). **Moderator
  leaves mid-question (#38):** the next moderator does **not** answer the pending questions — **open wagers are
  refunded to the bettors and the new moderator re-asks** (per אפיון). Moderator-drop **sound alert to all**, swap
  **open-question refund + viewer notify**, and **dynamic resolution except "who wins" (resolves at end)** are
  confirmed אפיון behaviours (no frame).

### 6.5 Shared / supporting screens
- **Home/Feed** `7705:45750` — StreamCard list, top bar, bottom nav.
- **StreamCard** `6366:20954` — thumbnail → LIVE badge (top-left, `#ff4757`) → title + host + viewer count.
- **Profile** `7435:83711`, **Coin bank** `7264:84205`, **Inbox** `7456:75162`, **System Messages**
  `7097:49329`.

---

## 7. Real-Time & Media Architecture

### 7.1 Socket.IO events (end-to-end, real-time)
Canonical event names (must be stabilized and shared client/server — avoid ad-hoc names):
- `question:open` — a question opened (freeze viewers, show betting UI).
- `question:resolved` — question resolved (release viewers, show results).
- `coin:delta` — a user's coin balance changed by a delta.
- `score:update` — a participant's game score changed.
- `new_inbox_item` — inbox aggregation push (followers / gifts / system).
- Stream/producer signaling events for WebRTC (`stream:new_producer`, etc.).

### 7.2 WebRTC / Mediasoup
- Media handled by the `media-server` package and `MediasoupManager` on the client.
- Up to **4 player cameras** enforced; **audio-only fallback** when a camera is unavailable.
- Single WebRTC path (`@livekit/react-native-webrtc`) — never mix WebRTC libraries (native crash).

### 7.3 DVR — "freeze stream for viewers during a question" (3-layer feature)
**Behavior (PM-confirmed 2026-06-18):** when a question opens, the live feed **freezes for viewers only** and
stays frozen until the question timer ends. The media server keeps **recording** the whole time. When the
question closes, viewers **resume from the exact point where they were frozen** (they are *not* jumped to
live) and play forward — so viewers run at a **delay** behind the true live point, while the
**moderator/host always see real time**. Old segments are rolling-deleted.
**This IS the host "pause" (designers, Zoom 2026-06-23 — H4): there is no manual host Pause/Resume button — the
freeze is triggered automatically by question-open and released automatically at question-close, for viewers only.**
**Status:** only **partially implemented** in the codebase today; this section is the target behavior.
- **Media server:** continuous segment buffer with rolling deletion; Viewer Playlist Manager (frozen during
  question, released on close); endpoints `POST /stream/:id/pause-viewers` and `POST /stream/:id/resume-viewers`.
- **Main server:** HTTP call to media-server → pause-viewers on question open, resume-viewers on close.
- **Client:** "Question active" / "Resuming stream…" indicators; HLS player handles catch-up automatically.

The `Stream` model already supports pause accounting: `status PAUSE`, `lastPausedAt`, `accumulatedPauseMs`.

### 7.4 Gating thresholds
- **Minimum 50 viewers** in the stream before the moderator can join. The server rejects the moderator's join request if the live viewer count is below 50. *(Verified against אפיון; the "15 viewers" and "50 followers" figures that appeared here previously were wrong and have been removed.)*

---

## 8. Game Economy & Rules

All money movement goes through [economy.service.js](packages/server/src/services/economy.service.js) inside a
Prisma `$transaction`. Coins are `Decimal(10,2)`. **Canonical rules (as implemented):**

| Rule | Value | Source |
|---|---|---|
| New-user signup gift | **1,000 coins** | `User.walletBalance` default |
| Default question timer | **30s** | `GAME_SETTINGS.DEFAULT_QUESTION_TIMER` |
| Minimum wager | **10 coins** | `GAME_SETTINGS.MIN_WAGER` |
| Maximum gift | **5,000 coins** | `GAME_SETTINGS.MAX_GIFT_AMOUNT` |
| Correct answer reward (STANDARD) | **125%** of the wager | `rewardCorrectAnswer` (`× 1.25`, floored) |
| "Who wins" payout (WINNER_TAKES_ALL) | **85%** winner / **15%** moderator | `processWinnerPayout` |
| Standard pot split | players each get `floor(pot / (numPlayers + 1.15))`; moderator gets the remainder (≈ 15% premium over a player unit) | `distributeStandardPot` |
| Gift split | **35%** to player / **65%** to moderator | `sendGift` |
| No active players on a standard pot | entire pot → moderator | `distributeStandardPot` |

**✅ RESOLVED 1 (PM, 2026-06-18) — standard-pot split is canonical:** the implemented `numPlayers + 1.15`
unit formula is correct (PM points-distribution graphic: moderator + 2 players, pot 100 → moderator 36.5,
each player 31.75). **Action:** delete the unused `gameRules.js → BETTING_RULES.LOSER_POT_DISTRIBUTION`
(`MODERATOR_SHARE 0.4 / PLAYERS_SHARE 0.6`) and `WINNER_REFUND_RATIO 1.0` constants so code + constants agree.

**⚠️ DISCREPANCY 2 — invalid transaction type:** `processWinnerPayout` writes `Transaction.type = 'DIRECT_WIN'`,
but the Prisma `TransactionType` enum has no `DIRECT_WIN` (it has `WINNER_PAYOUT`, `CORRECT_ANSWER`, …). This
will throw at runtime. Use a valid enum value (likely `WINNER_PAYOUT`).

**✅ RESOLVED 3 (PM, 2026-06-18) — gift split is 35% player / 65% moderator** (PM graphic §5 "direct
split"). Implemented code already matches; no change needed.

**Verification task (gap-closure F5):** unit-test the economy against the spec's worked examples
(125% reward; the 15/85 split; pot examples such as 31.75 / 36.51). File a bug for any divergence.

---

## 9. Wallet & Coin Bank

Figma page `בנק מטבעות` `4366:14154`; dev section `Coin bank` `7264:84205`.

- **Balance:** single source of truth — `GET /wallet/balance` returns combined purchased + winnings;
  client `walletService.getBalance()` with refresh-on-focus. Surfaced in the in-stream coin icon, profile
  menu, and the bank screen.
- **Coin Bank main screen:** balance display; return-to-main with updated balance; entry from profile
  hamburger ("בנק מטבעות") and the in-stream coin icon.
- **First-run onboarding:** 3 screens (Welcome → See it all → Manage balance) shown once; first-entry
  "+1,000 coins" popup with "purchase more" / "X to continue".
- **Purchase flow:** package list (base coins + bonus + price, low/high variants); quantity +/- adjuster;
  pay via platform IAP (§12); confirmation screen + balance refresh; cancel/error/declined states.
- **Transaction history:** `GET /wallet/transactions?from=&to=` (paginated, ≤4 months per range). Row =
  last-4 of method, amount, fee, date/time, status. Statuses: בטיפול / נדחה / הוחזר / הושלם / בוטל
  (Pending / Declined / Refunded / Completed / Cancelled). Empty + filled states.
- **FAQ:** role-tabbed (Viewers / Players / Moderators).

Data: `Transaction` (type/status/currency/amount/paymentMethod/last4Digits/failureReason) and `UserPoint`
(ledger of point movements by `PointType`). **`DIAMOND` is out of scope (PM-confirmed 2026-06-18) — remove it
from `CurrencyType` and every reference (schema + code).**

---

## 10. Social Layer (Profile, Follow, Inbox, Chat, Sharing)

Figma: Profile page `4366:14143` / dev `7435:83711`; Inbox page `4366:14144` / dev `7456:75162`.

### 10.1 Profile
avatar, username, stats (followers / following / games), Follow/Unfollow, edit profile. `User` carries
`followersCount` / `followingCount` (denormalized) and a `Follow` join model.

**Game history (PM-confirmed 2026-06-18):** two tabs — games **opened** and games **participated in**. Default
shows the **10 most recent**; games auto-delete after **30 days**; user can **pin up to 10 favorites** to keep
them. Each card: game name, participants (avatar+name), date, points earned, duration, delete/pin icon. Tapping
a card opens a detail page (points breakdown from questions vs. gifts, winner, moderator, viewer counts).

**Username vs full name (Zoom 2026-06-23 — still to reconcile):** Sara leans **username-only** ("full name isn't
in Figma, so don't build it"). ⚠️ **But the edit-profile Figma frames `7435:83752…` DO show a `Full Name`
field** — so this is a **conflict to reconcile**, not yet closed. Until resolved: `username` is the stable,
unique handle (auto profile link, search, @-mentions); `fullName` is the editable display name.
*(Note: username is currently NOT unique in the DB and not editable — both are backlog items.)*

### 10.2 Inbox (categorized list — partly built)
An inbox **aggregation service already exists** (server service + Redux slice + `InboxScreen` + Socket
`new_inbox_item` + `markAsRead` for FOLLOW / GIFT / SYSTEM). Production scope = categories (new followers /
live-stream gifts / system), follow-back vs open-chat rows, gift rows (sender, coins, date, game; collapses
to a normal message after viewing), unread badges, empty state.

**Zoom 2026-06-23:**
- **New-Followers row buttons (I1) — still open:** follow Figma (Follow / "Removal") in the interim; Sara is
  corresponding separately and may escalate to the designers.
- **System Alerts (I2) — incomplete; designers are ADDING alert types** (e.g. notify the host "you were
  blocked / reported N times"). Consolidated missing-alerts list in
  [docs/screen-specs/DESIGNER-QUESTIONS.md](docs/screen-specs/DESIGNER-QUESTIONS.md) §1.
- **Forward a contact in chat (I4) — OUT of scope.** Chat is 1:1; you do not forward a contact. **Links ARE
  allowed** (like any platform). The "Contacts for sending / Sending contact details" Figma frames are dropped.

### 10.3 Private 1:1 chat
Real-time DMs (`ChatMessage` model exists: sender/receiver/content). Text + emoji; sent/delivered/read
status; header with name, profile link, report, back; pagination + reconnect. Links may be sent (I4); contact
forwarding is **not** supported.
- **Chat-request approval (S1, in scope — Zoom 2026-06-23):** a **non-friend's first message requires the
  recipient's approval** before the thread opens (Approve / Delete). 🧱 The precise UI (incl. what "Delete"
  does) is being detailed by the designers.
- ⚠️ **Open (I5):** whether the input has an explicit **emoji picker** and whether **message status
  (sent/delivered/read)** is shown — designers queried.

### 10.4 Media messages & permissions
Voice notes, images, video (camera or gallery); OS permission flows (contacts, photos); upload + thumbnail +
retry-on-failure.

### 10.5 Report & block
Report-reason → block-confirm; after block the thread is disabled and input hidden with a confirming
toast/banner; system alerts the reporter if 2 distinct users report a user. Reuse the moderation endpoint
pattern. **(I6, Zoom 2026-06-23 — in scope; 🧱 the designers are detailing the exact states:** block step-2
confirm modal, post-block disabled/hidden input, "2 distinct reporters → alert", image-load-failure + retry.)

### 10.6 Sharing & deep linking
**Profile share targets (✅ FINAL — designers, Zoom 2026-06-23):** Instagram · X (Twitter) · WhatsApp ·
Facebook · Link (copy) · Email — one at a time. **No Telegram.** (Figma is canonical; the older PDF comment is
superseded.) ⚠️ A **second,
different** profile-share sheet exists in Settings (`שתף פרופיל` 7435:84456: "Send to" = contacts + copy /
Email / message / Facebook) — unify or keep intentionally distinct. Deep link `hypulse://game/:id` opens the
game directly.

### 10.7 Settings & Privacy (Figma profile section)
Reached from the profile hamburger → **Settings and Privacy**. Hub (`Frame 2147223760`) has two groups:
- **Account:** **Account** (`7435:84440` → Account details = phone + email; **disable/delete account**) ·
  **Share profile** · **Accessibility** · **Privacy** · **Policy & privacy**.
- **Login:** **Account switch** (`7435:84737` — multi-account: current user + "Add Account") ·
  **Logout** (`7435:84803` — "log out?" → Account Switch / Exit / Cancel).
- **Privacy (`7435:84639`):** Private Account toggle, Activity Status toggle, Recommend account, Sync FB;
  interaction controls (comments, mentions, DMs, content reuse, downloads).
- **Accessibility (`7435:84581`):** text size, animated thumbnail, faster scroll, feed-a11y (Talkback),
  directions, and **hide videos with light effects** (photosensitivity safety).
- **Privacy Policy (`7435:84723`):** static legal text (currently placeholder; ⚠️ branded "World Game" — fix).

---

## 11. Notifications

- **In-app:** `Notification` model (title, message, isRead) + real-time via Socket.IO; badge counts; mark-as-read.
- **Types:** `GAME_INVITE | REWARD | SYSTEM`.
- **Push:** Expo push + **FCM (Android)** and **APNs (iOS)** for background alerts.

---

## 12. Payments

> **✅ DECISION CONFIRMED (PM, 2026-06-18) — Apple IAP (iOS) + Google Play Billing (Android); no Stripe.** Payments will use
> **platform-native in-app purchases** — Apple IAP (iOS) + Google Play Billing (Android), via
> `react-native-iap` — because Apple/Google require platform billing for digital goods (coins). Receipts are
> validated server-side. **However, Stripe code currently exists in the repo** and must be removed/replaced:
> [payments.service.js](packages/server/src/payments/payments.service.js) (Stripe SDK, PaymentIntents,
> `stripeCustomerId`), [payment.routes.js](packages/server/src/routes/payment.routes.js) (`/create-sheet`),
> `payments.webhook.js`, `finance.controller.js`, `ShopScreen.js`, and `User.stripeCustomerId` /
> `CreditCard` in the schema. **Authoritative: remove all Stripe code + schema fields (tracked as a cleanup task).**

**Target flow (assuming react-native-iap):**
1. User selects a coin package (Coin Bank purchase flow, §9).
2. Native purchase sheet (Apple Pay / Google Pay / store account).
3. Server validates the store receipt, credits coins, writes a `Transaction` (`type PURCHASE`).
4. Balance refresh; confirmation screen.

Server gap: deploy with secrets/SSL/Sentry; sandbox testing on both stores; remove Stripe code.

---

## 13. Internationalization (i18n) & RTL

- **Stack:** i18next + expo-localization. **Default language: English; then auto-follow the device locale**
  (PM-confirmed 2026-06-18). Supported for beta: English + Hebrew. (FIGMA_GUIDELINES' "default RTL/Hebrew"
  line is superseded and should be updated.)
- **Language detection order:** AsyncStorage → expo-localization → fallback English.
- **RTL:** `I18nManager.forceRTL(true)` + `expo-updates reloadAsync()`. Every screen must use `t()` keys
  (no hard-coded strings) and be verified in both LTR and RTL.
- **⚠️ Known infra issue (SCRUM-127):** `applyRTL()` in `src/i18n.js` loops infinitely
  (`forceRTL` + `reloadAsync`) in Hebrew on Expo Go. Must be fixed before RTL can be verified; it blocks the
  translation-content task (SCRUM-116).
- **Locale files:** consolidate the duplicate locale folders — keep the one `i18n.js` actually imports and
  delete the orphan (verify the live import before deleting).
- **Figma:** components ship `RTL=True` / `RTL=False` variants; design system page `4702:23825`.

---

## 14. Design System

**Source of truth for tokens:** [`packages/client/constants/design.js`](packages/client/constants/design.js)
(extracted from Design system page `4702:23825`). Icons + component node IDs + Figma API notes:
[FIGMA_GUIDELINES.md](packages/client/FIGMA_GUIDELINES.md). Summary (must match `design.js`):

- **Font:** Rubik (Inter/Poppins are design-system labels only).
- **Type scale:** H1 32/700, H2 22/700, Subtitle/L 20/700, Subtitle/M 18/700, Body/L 16, Body/M 14,
  Caption 12. Text colors `text.primary #1F293B`, `text.secondary #63656B`, `text.tertiary #A1A7B2`.
- **Primary palette (cyan):** default `#00E5FF`, dark `#00D3F2`, light `#ACF4FF`. **Secondary (purple):**
  default `#B300FF`. *(Note: some hex labels in Figma swatches are copy-paste errors — trust the swatches.)*
- **Semantic:** Error `#E2282B`, Warning `#F29A5C`, Success `#33A815`, Info `#3B91AB` (each with dark/light).
- **LIVE brand color:** `#ff4757` — never change.
- **Radius:** xs 4 / sm 8 / md 16 / lg 24 / xl 64 / full 999. **Spacing:** 4 / 8 / 12 / 16 / 24 / 32 / 64.
- **Icons:** use the design-system `icon/*` set only (no external icon libraries for icons that exist there).
- **Components:** nav bars, StreamCard (`viewer live window` `6366:20954`), Top Bar, buttons, avatar/status,
  badge, toast, progress bar, radio, switch, text field, chat preview, tab (node IDs in FIGMA_GUIDELINES).

---

## 15. Data Model

PostgreSQL via Prisma ([schema.prisma](packages/server/prisma/schema.prisma)). Core entities:

- **User** — identity (`firebaseId/googleId/appleId/facebookId`, email unique), `role`, `dateOfBirth`,
  `walletBalance` (default 1000), `isFirstPurchase`, denormalized follow counts. *(Carries Stripe fields to be
  removed — §12.)*
- **Stream** — `title`, `hostId`, `status (WAITING/PAUSE/LIVE/FINISHED)`, pause accounting
  (`lastPausedAt`, `accumulatedPauseMs`), has many Games.
- **Game** — `title`, `description`, `hostId`, `moderatorId?`, `streamId`, `status (WAITING/ACTIVE/FINISHED)`,
  `isPinned`, participants, questions.
- **GameParticipant** — (`gameId`,`userId`) unique, per-game `role`, `score` Decimal.
- **Question** — `questionText`, `rewardType (STANDARD/WINNER_TAKES_ALL)`, `isResolved`, options.
- **QuestionOption** — `text`, `isCorrect`, `linkedPlayerId?` (for "who wins").
- **UserAnswer** — (`userId`,`questionId`) unique, `selectedOptionId`, `wager` Decimal.
- **UserPoint** — points ledger by `PointType (TRIVIA/GAME/DONATION/BONUS/PURCHASE)`.
- **Transaction** — `type`, `status (PENDING/SUCCESS/FAILED)`, `currency (COIN — DIAMOND to be removed, §17)`, `amount`,
  `paymentMethod`, `last4Digits`, `failureReason`, `metadata`.
- **Follow**, **ChatMessage**, **Notification**, **ViewLog**, **CreditCard**, **UserGameActivity**.

Enums: `UserRole`, `StreamStatus`, `GameStatus`, `PointType`, `TransactionType`, `TransactionStatus`,
`CurrencyType`, `QuestionRewardType`. (See §8 DISCREPANCY 2 re: `TransactionType` missing `DIRECT_WIN`.)

---

## 16. Non-Functional Requirements

- **Performance:** FlatList virtualization, image caching, memoization; Empty/Loading/Error state on every
  screen; Socket cleanup (`off()` in every `useEffect`) and WebRTC track cleanup on screen exit (no leaks).
- **Load targets (S7):** 6 concurrent WebRTC cameras (Host + Moderator + 4 Players); HLS+DVR at
  100 / 500 / 1,000 viewers; Socket.IO rooms under concurrent load; identify + tune bottlenecks.
- **Testing:** unit (economy/game/questions), integration
  (`create → join → question → DVR pause → answer → resolve → distribute`), E2E (Detox happy path per role),
  edge cases (viewer disconnect, stream drop, mid-bet, failed payment, DVR recovery). Client Jest infra is
  currently ad-hoc (`npx jest` only) — needs a `test` script + `jest-expo` config.
- **Store compliance:** **Age Rating 17+ (gambling)**, privacy labels, data-safety, Content Rating;
  Privacy Policy + Terms reachable in-app; EAS production builds for both platforms. Apple gambling review is
  a known release risk (budget 2–4 weeks).
- **Security & secrets:** secrets via **Infisical** — never dotenv for local dev, never secrets in
  git-tracked files. Server prod deploy: secrets, SSL, Sentry.
- **Errors:** API error messages in English, no leaked internals/stack traces.

---

## 17. Open Questions & To-Verify-Against-Figma

1. ✅ **Payments (RESOLVED 2026-06-18):** Apple IAP (iOS) + Google Play Billing (Android); remove all Stripe
   code + schema fields.
2. ✅ **Default UI direction (RESOLVED 2026-06-18):** default **English/LTR**, then auto-follow the device
   locale. Supported beta languages: English + Hebrew. (Update the FIGMA_GUIDELINES "default RTL" line.)
3. ✅ **DIAMOND currency (RESOLVED 2026-06-18):** NOT in scope and does not exist — remove `DIAMOND` from
   `CurrencyType` and every reference (schema + code).
4. ✅ **Economy splits (RESOLVED 2026-06-18):** standard pot = `numPlayers + 1.15` (moderator +15% over a
   player unit); gift = 35% player / 65% moderator. Delete the unused 0.4/0.6 + `WINNER_REFUND_RATIO` constants.
5. ✅ **Figma access (RESOLVED 2026-06-18):** Figma MCP connected; full screen index complete in
   [FIGMA-SCREENS.md](FIGMA-SCREENS.md). Per-frame acceptance-criteria **deep-dive is in progress** — tracked
   in [DEEP-DIVE.md](DEEP-DIVE.md).

### ✅ Closed at the Zoom (2026-06-23)
6. **Birthday gate** ✅ — re-prompts every entry until a DOB is saved (§4.3 / R3).
7. **Share-target list** ✅ — Instagram · X · WhatsApp · Facebook · Link · Email; **no Telegram** (§10.6).
   **Suggested accounts** ✅ — in scope, **reduced algorithm** (same surfacing as the Home feed).
8. **Player → manager/admin promotion** ✅ — in scope per אפיון p.11; no Figma frame yet (🧱).
10. **Product-name + copy/branding sweep** ✅ **approved** ("Game World"→HyPulse, moderator-naming, invite-verb,
    coins↔points, typos, "In progress"→"Following") — to be executed in a **separate dedicated session.**
- **Profile QR** ✅ removed · **Rubik font** ✅ must be loaded · **design.js** ✅ no new color tokens.

### ❓ Still open after the Zoom — designer/PM to confirm
9. **Profile "roles/personas/schedule" variants** (pp.28–31): Sara — "what is this?" → re-explain; **out-of-scope
   until defined.**
11. **Profile deep-dive new scope** (confirm in/out): email-verification OTP, multi-account switch,
    privacy/accessibility toggles, account disable/delete. See §4.5 / §10.7.
12. **Username vs full name** — Sara leans username-only, **but edit-profile Figma has a Full Name field** →
    reconcile (§10.1).
13. **Per-gift coin value (C7)** — deferred; will change with the animations.
14. **Inbox details** — New-Followers buttons (I1), gift-row game-name (I3), emoji picker + message status (I5).
15. **Viewer full participant list (V1)** — Sara: "participants of *what*?" → re-clarify.
16. **Dark broadcast-screen background hex** — not provided; needed before it can be added to design.js.
17. **Coin-bank 3 first-run onboarding screens** — Sara: "what is this?" → re-explain (אפיון p.37).

---

## Appendix A — Figma Screen Index

> **Full per-screen map (verified live 2026-06-18) is now in [FIGMA-SCREENS.md](FIGMA-SCREENS.md)** —
> every screen with its node ID and designer screen-number. The list below is the section-level summary.
> **Two corrections from the live file:** `Birthday` is a real section (`7741:96354`, screen `10`) that was
> missing here; the `screens for dev` page has **15 sections / ~355 frames**, not the 14 listed previously.

File `FBQSv16ajir03ZAtRbuHxb` · implement only from **`screens for dev`** (`6619:11957`).

**Pages:** Design `1:2` · **screens for dev `6619:11957`** · Design system `4702:23825` · השראות לעיצוב ·
שחקן פותח שידור `4154:11574` · מנחה `4349:11575` · צופה `4349:11574` · לוגו ומיתוג `6791:87619` ·
פרופיל `4366:14143` · בנק מטבעות `4366:14154` · דואר נכנס `4366:14144` · שחקן מצטרף `4366:14142` ·
תרשים זרימה `4216:12467` · בריף `3940:11090` · Archive · Page 3.

**`screens for dev` sections:**

| Section | Node ID |
|---|---|
| English Viewer – Close-up game | `7014:27847` |
| English Host – Close-up game | `7083:97876` |
| English Host – Remote play | `7277:113768` |
| English Viewer – Remote play | `7097:45650` |
| English Mendator – Close-up game | `7097:51662` |
| English Mendator – Remote play | `7148:62527` |
| Home/Feed | `7705:45750` |
| Additional Player | `7691:45749` |
| Registration | `7721:90563` |
| **Birthday (DOB gate, screen `10`)** | `7741:96354` |
| English Inbox | `7456:75162` |
| Coin bank | `7264:84205` |
| Profile | `7435:83711` |
| System Messages | `7097:49329` |
| Viewer – In-stream Animation & End-of-game Popup | `7816:57287` |

---

*This is a living document. Update it whenever product behavior changes; treat it as the contract that code,
Figma, and Jira tickets are measured against.*
