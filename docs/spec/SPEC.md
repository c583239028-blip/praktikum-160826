# HyPulse — Product Specification (Source of Truth)

> **Status:** v1.0 — Draft for review · **Last updated:** 2026-08-13 · **Owner:** Sara (TL/PM)
> **Language:** English is the canonical language of this document and of the product's default UI.
> This document is the single source of truth for product behavior. Where code, Figma, and this
> document disagree, this document is the intended target — discrepancies are flagged inline as
> **⚠️ DISCREPANCY** and must be reconciled (fix code or amend this spec) rather than silently ignored.

**Primary sources this spec is built from:**
- Figma — *WorId Game (Shira)*, file `FBQSv16ajir03ZAtRbuHxb` (verified live, last modified 2026-06-10). Implement only from the **`screens for dev`** page (`6619:11957`).
- Design tokens → [packages/client/constants/design.js](../../packages/client/constants/design.js) (source of truth); icons + component node IDs + Figma API notes → [packages/client/FIGMA_GUIDELINES.md](../../packages/client/FIGMA_GUIDELINES.md); screen index → [FIGMA-SCREENS.md](FIGMA-SCREENS.md).
- [packages/server/prisma/schema.prisma](../../packages/server/prisma/schema.prisma) — data model.
- [packages/server/src/services/economy.service.js](../../packages/server/src/services/economy.service.js) + [gameRules.js](../../packages/server/src/constants/gameRules.js) — economy rules.
- [NOTES-firebase-flows.md](../notes/NOTES-firebase-flows.md) — authentication flows.
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
14a. [Terminology Glossary](#14a-terminology-glossary--binding) 🔒 **binding**
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
| Place wagers on questions | ✅ | — | — | — |
| Send gifts to players | ✅ | ✅ | ✅ | — |
| Appear on camera (grid) | — | ✅ | — | ✅ (own) |
| Open / resolve questions | — | — | ✅ | — |
| report / mute / kick participants | — | — | ✅ | ✅ |
| Create game, invite moderator, start/stop broadcast | — | — | — | ✅ |
| Approve Close-up player join | — | — | — | ✅ |

> **✅ DECISION (Sara, 2026-08-03) — wagering is Viewer-only.** Only a **Viewer** places coin
> wagers on questions, consistent with §1 (role definition), §4 (game flow) and §6 (the betting
> UI lives on the viewer screen). The prior all-four-roles ✅ in this row was an **error**: Players
> *compete*, the Moderator *resolves* the question (a bet would be a conflict of interest), and the
> Host *broadcasts*. **Enforcement is an open code gap:** the bet path (`userAnswer.service.submitAnswer`)
> currently authorizes any `GameParticipant` regardless of role — it must additionally require
> `participant.role === VIEWER`.

**Guests (unauthenticated):** browse freely as a Viewer. Any *protected action* (wager, gift, follow,
open profile, etc.) triggers **Lazy Auth** (§4). Guests are routed to the Viewer experience.

### 2.1 System-level account roles (account tier — distinct from the game roles above)

The four roles above are **context roles**: they describe a user's relationship to a *game/stream* and
are stored on `GameParticipant.role` (and the vestigial `User.role`). They say nothing about privileges
over the *application itself*.

Separately, every account carries a **system role** stored on `User.role` (enum `SystemRole`,
`USER | STAFF | ADMIN`, default `USER`). This is the account tier used for app-administration authority
(e.g. HyPulse staff, moderation of reports, backoffice). It exists in the schema
(`packages/server/prisma/schema.prisma`, `enum SystemRole`) but is **not yet exposed by any screen or
permission check** — the admin/HyPulse-team management domain is **post-MVP** and its screens are still
open designer questions (see [DESIGNER-QUESTIONS.md](screen-specs/DESIGNER-QUESTIONS.md) — "ניהול האפליקציה").
Documented here so the enum is not mistaken for missing.

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

**Providers:** email/password + **four social providers** (Google · Apple · Facebook · X) via Firebase Auth.
Server verifies the Firebase ID token with the Admin SDK (`verifyIdToken`) and issues an app JWT. Token model
and provider constructors are documented in [NOTES-firebase-flows.md](../notes/NOTES-firebase-flows.md).
> 🔴 **Instagram was DROPPED as a login provider (decision 2026-07-29).** It is not a Firebase Auth provider
> (M1-06 — would need custom OAuth + a custom token, not `signInWith*`) and Meta's Basic Display API is
> sunsetting → not viable. Its use as a *sharing* target is now **⏳ open too** (see §10.6).
> **Feasibility caveat (of the remaining four):** only **Google is wired**; Apple/Facebook/X are stubs (M1-03).
> Facebook is gated by Meta App Review 🔺. So the buildable set today is **Google/Apple/X**; Facebook is blocked
> pending management/legal.

**Account model:** `User` carries `firebaseId`, `googleId`, `appleId`, `facebookId` (each unique). Account
collision (same email, different provider) → catch `auth/account-exists-with-different-credential`, sign in
with the original provider, then `linkWithCredential` to merge.

### 4.1 Registration
- Full registration screen (Figma `Registration` `7721:90563`). Previously only Login existed; **Register**
  and social entry are required.

### 4.2 Lazy Auth (guest → member)
- A guest browses freely. On the **first active/protected action**, a popup (LazyAuthModal) appears offering
  sign-up. ✅ **Erez 2026-08-10 (AU-Auth-1): the 1,000-coin gift is NOT advertised in the registration popup.**
  The popup keeps its plain "register to continue" copy; the 1,000-coin message is surfaced **only as a popup
  inside the Coin Bank, on the first entry after registration** (B-5). *(Supersedes the earlier "+1,000 coins
  incentive on the popup" text and the DESIGNER-BRIEF §9 recommendation to add it.)*
- New users are auto-credited **1,000 coins** (`User.walletBalance` default `1000.00`).

### 4.3 Birthday gate
- A **Birthday popup** blocks the app until a date of birth is provided (stored as `User.dateOfBirth`).
  Required for the age gate — **minimum age 18 (Erez/Sara 2026-08-11; raised from the earlier 17).**
- **Trigger/dismiss — ✅ DECIDED (Sara, 2026-07-27/28, AU-Auth-2; supersedes Zoom 2026-06-23 R3):** the gate
  **appears after the 3rd app entry**, and **dismissing it exits the app** (matches Figma `7741:96354`). This
  supersedes the earlier "re-prompts on every entry" prose. Copy fix: "1000 points" → coins.

> 🔴 **Compliance gap (2026-07-22 walkthrough — M1-07):** this is a **DOB-collection field, not an age gate.**
> `BirthdayModal` accepts **any** date (`maximumDate=today`); there is **no minimum-age check, no under-age
> block screen, and no anti-retry-shopping** anywhere. Legally an age gate must **reject** under-age with a
> terminal block and use a **neutral** screen. The gate is also only **viewer-scoped** (renders in ViewerScreen
> + viewer/[id].js), not the global app block this section claims.
> ✅ **Trigger/dismiss RESOLVED (Sara, 2026-07-27/28, AU-Auth-2) = 3rd entry + exit-on-dismiss** (Figma). This
> closes the earlier three-way conflict (Figma=3rd-entry · prose=every-entry · code=every-entry+no-X). ⚠️ The
> reviewer's "immediate (age-gate before any restricted use)" note was a *recommendation*, now overridden — but
> flag it if legal counsel later requires a pre-use gate. 🔴 **Code still drifts:** it triggers on every entry
> with no X (M1-07) — align to 3rd-entry + exit. **✅ Minimum age LOCKED at 18 (Erez/Sara 2026-08-11; raised
> from the 17 of 2026-07-28 `c731db0`):** a user whose DOB is under 18 must hit a **neutral, terminal block
> screen** ("you don't meet the age requirement") — no retry-shopping a new date. Building the min-age check +
> that block is still an open **code** gap (M1-07) and an open **design** item (the block screen's copy,
> DESIGNER-QUESTIONS §2ח AU-Auth-2). ⏳ **Open design sub-question:** does the block screen carry an **action
> button** (close the app / support link) or is it a **no-action** dead-end? **✅ Cash-out RESOLVED (Erez
> 2026-08-11): coins are NEVER withdrawable to real money** → **play-money / social-casino** model, so **no KYC**;
> the 18 minimum stands on its own (chosen conservatively given real-money coin *purchases* + wager mechanics).
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
- **30-followers gate** before broadcasting *(confirmed 30 by Sara, 2026-07-27 — was 50; distinct from the
  **1-viewer** gate for question-publishing, §7.4 — Erez 2026-08-10 dropped that gate from 50 to 1).* *(New;
  needs a follower-count source.)* ⚠️ **No Figma frame yet — designers are adding it (🧱 H1).**
- **Create-game wizard — 7 steps** (frames walked 2026-07-20, close-up + remote boards):
  type → name → invite moderator → invite players → share broadcast → share done → game summary.
  ✅ **Progress dots = 7.** The three permission frames (`הרשאות לתמונות` / `לאנשי קשר` / `לפייסבוק ומייל`)
  are **OS dialogs drawn as mock-ups, not wizard steps** — the frames show the greyed-out *game-name* screen
  behind them, i.e. they are overlays. Same category as the Figma payment sheet (§12). **What we build is a
  pre-permission explainer screen before each prompt; the prompt itself belongs to the OS.**
  ⚠️ The photo-permission options in the frame (`Limited access` / `Approval of all` / `No approval`) are
  verbatim iOS's own options — further confirmation.
  🔴 **Facebook-friends permission (`user_friends`) is a product blocker, not a task:** it is one of the
  hardest Meta App Review permissions to obtain and only returns friends who already use the app. Same review
  gate that already blocks Facebook sign-in. Escalate before scoping.
- **Practice Mode:** 30-second countdown before Going Live, **for the Host and Moderator only** — ✅ **CLOSED
  2026-07-15/07-20 (Sara, D-18): Players and Viewers do NOT get practice mode and are blocked from `REHEARSAL`
  (see §6.1); the earlier player-facing practice text is dropped.** With a "silent mode" advisory and an
  explainer screen. **Specified in SCRUM-237 (`INFRA stream-rehearsal-state`) — To Do, unassigned; not in
  `main`.** ⚠️ `StreamStatus` today is `WAITING · PAUSE · LIVE · FINISHED` — **there is no `REHEARSAL`
  anywhere in the monorepo.** The UI already promises it ("you'll get 30 seconds to prepare",
  `GameSummaryStep.js:84`), so the promise ships ahead of the mechanism (M3-04).
  🔑 **Two schema fields are needed, and only one is obvious:** `REHEARSAL` in the enum, **and
  `rehearsalEndsAt DateTime?` on `Stream`** — because the countdown is server-authoritative, the end time must
  persist or a host who reconnects mid-practice restarts at 30s. `rehearsalEndsAt` appears in **no** ticket,
  doc or code — extend SCRUM-237's AC rather than opening a duplicate.
- **Game Management Settings panel** (`הגדרות ניהול המשחק`, in-broadcast) — 12 controls, **none implemented**:
  Hosts › · Players › · Video Quality › (720p / 480p sheet) · Live Gifts · Guide Settings · Viewer settings ·
  Viewing options · Camera flip · **Mute microphone** · Live broadcast delay · Audience Control (18+ ✅ matches
  the closed decision) · Settings and Privacy ›.
  ✅ **This panel confirms C1** — the mic toggle lives in Settings. ⚠️ **But the code contradicts it:**
  `LiveBroadcastScreen.js:155,167` puts `toggleMic` *and* `toggleCamera` in the bottom bar, while the Figma
  host bar is ⚙️ 👤 👥 only. Same conflict as the player side (§2ג PL-2).
  ✅ **`Live broadcast delay` DEFINED (Erez 2026-08-10 — H-2):** it is the **creator-away suspend / hold**, not
  an industry DVR delay. When the host suspends or leaves, viewers get the **broadcast-suspended hold screen**
  (§6.3) and **do not see what is happening** in the broadcast. Grace = **120s**; if the host has not returned,
  the broadcast either **closes** or the host takes **one** more extension (**+120s**) — **no further extension**
  after that, then it **closes**. **The viewer gets no notification.** *(Supersedes the Zoom H3 reading of this
  toggle as a viewer-only DVR delay; the per-question DVR freeze in §7.3 is a separate mechanism.)*
  ⏳ `Viewing options` (followers-only) — ✅ ownership resolved (host-only, §6.4 MR-1); the follower-restriction
  behaviour itself still open (§2ד).
- **In-broadcast invitations** (`Booking facilitators` / `Player Invitation` sheets): Active / previously
  invited / recommended sections, with `Remove` → `Removed` and invite → `Invited` states. New UI; the server
  already has `moderatorInvitation.handler.js`.
- **Pre-live guards:** an "Attention!" modal when invited players have not confirmed (`Wait for all players` /
  `Yes, continue broadcasting`), and a moderator-declined notice offering `Choose a new host`.
- ⚠️ **Gift display (`תצוגת מתנות עבורי ועבור שחקנים`) — STRUCTURE ONLY.** Sara, 2026-07-20: the layout is
  agreed but **the imagery and animations are not final**. Do **not** implement the frame's specific visuals.
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
  feature** shared with the remote *viewer* (§6.3), depending on multi-producer signaling that **now exists on
  `main`** with a **locked 6-field payload contract**: `stream:new_producer` emits
  `{ producerId, role, streamId, userId, kind, paused }` and `stream:join` returns `currentProducers`
  (with `role`/`userId`/`kind`/`paused`) + `currentProducerId`. Contract locked by the SCRUM-203 gate
  (server half in PR #243); **see FINDINGS M4-14** for the merge-gate. Tracked as the **Multi-camera grid
  epic** (backlog). Also blocked on missing Figma frames.
- **Floating PIP tile — ✅ CLOSED 2026-07-20 (Sara): the PIP is the MODERATOR**, not a player and not the
  self-preview. Evidence from the frames: `משחק מרחוק_2 שחקנים` shows two tiles **plus** the PIP — three
  people on a screen titled "2 players", so the PIP sits outside the player count. Present in all three
  grid frames; **absent from `StreamLayout.js` entirely** (M5-08).
- **Self-preview — the player's own tile is the highlighted one** (`isSelected` → cyan border in
  `VideoTile.js`), not a separate corner view. ⏳ Sara is confident but wants it stated explicitly by the
  designers — see [DESIGNER-QUESTIONS.md](screen-specs/DESIGNER-QUESTIONS.md) §2ג PL-1. *(The code already
  matches this reading: `PlayerScreen.js` marks the local stream's tile `isSelected: true`.)*
- **Join flow:** invite popup (Accept / Rejected-60s) **or** QR scan **(close-up players only — designers,
  Zoom 2026-06-23, C3: only close-up players can scan to join, from their own personal phone)** / external
  link needing Host approval (remote) → **live**. Entering / "Going live now" / "Waiting for the broadcast to
  start…" / rejected states. If the Host hasn't entered Practice yet, secondary players see a paused-stream
  screen (close-up) or their own camera only (remote).
- **Who invites — ✅ CLOSED 2026-07-20 (Sara): the HOST invites players, not the moderator.** ⏳ Open: whether
  the moderator *may also* invite. The Figma `rejected` frame reading "Game **mandator** invitation declined"
  is a mistranslation of **מנחה** (§14a) and is not evidence that the moderator invites — the code has always
  said `moderator` correctly (M5-11).
- ⭐ **Remote additional-player frames DELIVERED 2026-07-20** — `משחק מרחוק_2 / 3 / 4 שחקנים`. This is the C2
  gap; **the live half is now closed.** Close-up and remote player screens remain intentionally distinct.
  ⚠️ Do not confuse these with the **viewer** grid frames named `N שחקנים` (no `משחק מרחוק_` prefix).
- **Practice mode — ✅ CLOSED 2026-07-20 (Sara): players do NOT get practice mode.** It is for the Host and
  Moderator only; `PLAYER` is blocked from `REHEARSAL`. The delivered frames confirm it — the player flow is
  `dialog → entering → live`, with no practice step. This **supersedes** the earlier "Practice mode (~30 s) →
  live" text for players, and closes D-18 for the player role.
- **Default camera/mic on entry is mode-dependent** (verified vs spec `אפיון: שחקן נוסף` pp.42–45 + Figma):
  - **Close-up:** camera **OFF** + mic **OFF** by default; the player can turn them on.
  - **Remote:** camera **ON** + mic **ON** by default, and **cannot be toggled off in Practice mode**.
  - ⚠️ Supersedes the previous blanket "camera-off / mic-off on entry" (was correct for close-up only).
- **Additional Player** is a first-class secondary-player role; advanced permissions (invite players /
  moderator) are gated by a Host toggle.
- ✅ **Resolved (Zoom 2026-06-23):** mic-toggle = **Settings only** (C1, per אפיון); camera-off tile = **profile
  picture** (C4, per אפיון — implemented in `VideoTile.js`). ✅ **C2 delivered 2026-07-20** (live frames; there
  is no practice variant because players have no practice mode). ✅ **C3 resolved** — self-preview is the
  highlighted tile, and the PIP is the moderator.
- ✅ **C1 conflict RESOLVED (Erez 2026-08-10 — PL-2):** the third bottom-bar icon (`SpeakerIcon`/`id:'speaker'`)
  is a **mute-status indicator, not a control** — it turns **red to show the player is muted**. Mic *toggling*
  stays Settings-only (C1); this icon only **reflects** state (⚙️ 📷 🎤→red-when-muted).
- ✅ **Broadcast participation cap & camera control (Erez 2026-08-10 — CAM-2):**
  - **Max = Host + 3 players** in the broadcast (matches `MAX_ACTIVE_PLAYERS=4`). Joining the broadcast is
    **host-approval-gated**; once full, **no further players enter** — everyone beyond gets an automatic
    *"other players have already been invited"* popup. ⚠️ **DISCREPANCY vs the code model:** today `stream:join`
    is **unlimited** and only *camera production* is capped (players beyond 4 stay as avatars — DESIGNER-QUESTIONS
    §2ג CU-CAM point 6). Erez's ruling makes the cap a **join/participation gate**, not just a camera-slot gate —
    reconcile (FINDINGS CU-CAM / M4-13).
  - ✅ **Camera-off (remote) = leaving the game — RESOLVED (Sara 2026-08-12 chose Erez's CAM-2 over the אפיון
    reading).** In the remote game a player does **not** keep the camera off while staying in; **turning it off
    = leaving the game** → *"exit the game?"* popup. Self-mute stays available (mute ≠ leave). The אפיון's
    "temporary off keeps you in / shows a profile picture" is **overruled**, and the "how long is temporary"
    question is moot. Default entry (remote) = camera ON. *(Removed from the questions to מלכי — Erez decided.)*
  - ✅ **Camera/mic permission model DECIDED (Erez 2026-08-10):** consent = the **standard OS permission grant**,
    which is **permanent once granted** (not a per-session / "just this once" re-prompt). ⚠️ **This is the
    Android/iOS system dialog — NOT designable** (same family as H-1 / PP-1: the OS owns the text and buttons).
    The consent record is the OS grant itself. **Nothing for מלכי to design here.** *(Optional, product's call:
    a short pre-permission explainer screen BEFORE the OS asks — the PP-1 pattern — could be added for camera/mic
    to lift the accept rate, but only if wanted.)*
  - ⏳ **Still open:** **camera switching in close-up** — to verify (= D-4).
- ✅ **Player Settings panel contents (Sara 2026-08-11):** **Camera flip · Mute microphone · Pause broadcast ·
  (remote game only: Pause camera) · Settings & Privacy.** Confirms C1 (mic toggle lives in Settings, not the
  bottom bar). *(Note: "pause camera" in remote is distinct from turning the camera off — camera-**off** still =
  leaving the game, per CAM-2.)*
- 🔴 **Build status:** `StreamLayout` / `VideoTile` match the frames closely (1/2/3/4 layouts, gift counter,
  mic-off badge, camera-off→avatar, selected-tile border), but `PlayerScreen.js` feeds them **mock data** —
  the same `localStream` four times, with `console.log` stubs for every control (M5-07, owned by SCRUM-224).
  Missing entirely: the PIP (M5-08), the "טרם פתיחת השידור" tile state (M5-09), the settings panel and the
  half-profile sheet (M5-10).

### 6.3 Viewer — Figma Close-up `7014:27847`, Remote `7097:45650`
- **HLS player for mass viewing.** ⚠️ The prototype watches over WebRTC; **the HLS player is a new build**
  (recommended: ship WebRTC-based viewer first, add HLS for scale alongside load testing).
- **RTCView overlay / grid** for player cameras (remote). ⚠️ **Unbuilt — same cross-cutting concern as §6.2:**
  `ViewerScreen` is single-stream (consumes one `currentProducerId`), while the multi-cam path needs the
  `stream:new_producer` fan-out — which the server **does** emit (6-field contract locked on `main`, PR #243;
  **see FINDINGS M4-14**). The multi-camera grid (viewer + player) is a **single shared epic**, not per-screen
  UI work. Tracked in the **Multi-camera grid epic** (backlog).
- **DVR indicators:** "Question active" (playlist frozen) and "Resuming stream…" (catching up). *(UI in S2;
  real DVR behavior in integration — §7.3.)*
- **Broadcast-suspended screen (delivered 2026-07-22, "System Messages"):** when the creator is away the viewer
  sees a full-screen pause state — "The live broadcast has been suspended. The creator will return soon." —
  distinct from the per-question DVR freeze above (that one keeps the video; this is a creator-away state).
  ✅ **Timeout mechanics (Erez 2026-08-10 — H-2 / `Live broadcast delay`):** the viewer sees only this hold
  screen (not the live content). **120s** grace → host returns, or the host takes **one** extension (**+120s**);
  if still away after that, the **broadcast closes** (no further extension). The viewer receives **no separate
  notification** through this.
- **Betting UI** on the active question + results display + coin-delta animation; guarded by Lazy Auth.
  ✅ **Wager mechanic DECIDED (designers, Zoom 2026-06-23 — C5):** you pick an answer and **wager by dragging the
  matching icon from the Currency Bank onto the chosen answer** (the Figma drag mechanic, `1000217811/812`). The
  אפיון's **3-random-points picker is DROPPED** — there is no separate amount-chip screen. The bank icons/images
  may later swap to other images/animations (future, tied to the gift-value work C7).
- **Per-question in-stream result (S2, KEPT):** on each `question:resolved` the viewer sees an **in-stream
  win/loss animation** ("You won! +100 coins" / "Not this time… −100 coins" with a "the moderator chose your
  answer" toast) — Figma §12. **Currency is coins everywhere** (fix every "points"/"lossed" string). This
  per-question overlay **stays.**
- **End-of-game summary popup — ❌ DROPPED (Sara, 2026-07-27, D-17):** there is **no** end-of-game
  results/summary popup for any role. When the game ends the app goes **straight to the feed**; the אפיון's
  results popup is **not in effect.** This **supersedes** the earlier "keep both win/loss variants" text and the
  viewer frames delivered 2026-07-22 (`7816:57287`, §13 — won / lost / no-bet variants), which are **no longer
  to be built**. 🔧 **Code:** the host wizard's `GameSummaryStep` is a *pre-live* wizard step, not this popup.
  ✅ **CONFIRMED (Sara 2026-08-12): there is NO end-of-game popup for ANY role — including the viewer.** Game end
  → straight to the feed. This settles the earlier ambiguity (the 2026-08-11 "viewer version exists" comment is
  overridden); the delivered viewer frames (`7816:57287`, §13) are **not to be built.**
- **Pending-questions corner counter** is **moderator-only** (designers, Zoom — V2); viewers do not get it.
- **Exit / return (V3):** the phone **Back button exits to Home** (not back into the same stream). From Home the
  viewer sees active streams via the reduced feed/suggested algorithm and can **re-enter any stream still live.**
- **Close-up viewer layout (reviewed 2026-06-21):** single player video card + **avatars row** on top (Follow `+`
  & gift count per player) + **moderator floating PIP** (movable, **hide** via eye toggle, **resize** to a
  bottom-wide window) + **camera switcher** `1/3 📷`. Bottom nav: gift · compose-question · share · settings.
- **Layout arrangement — ✅ DECIDED (Sara, 2026-08-05, VW-2): applies to BOTH viewer and moderator.** The only
  two arrangements are (a) **drag the moderator PIP** to any position as a floating point, or (b) **split the
  screen in two** — half = all players, half = moderator. **Individual player tiles are NOT draggable.**
  ✅ **Architecture RESOLVED (Sara, 2026-08-05): the viewer receives two streams** — players+host (stream 1) and
  moderator (stream 2) — so the moderator PIP is a separate stream and IS arrangeable. See §7.3 (the two-stream
  model + its DVR-freeze rationale). This is **not** an N-streams-per-camera design, so it does not enable the
  D-4 per-camera switch.
- **Viewer in-stream settings** (`settings`): Video Quality · Live Broadcast **Report** ("Select a reason" →
  Report / Report-and-block, confidential to the HyPulse team) · Propose a question to the moderator · Giving
  gifts to players/host · Share the game · Exit Live Broadcast · **Display players details** toggle.
- **Gifts:** first-open Currency Bank shows the **1000-bonus-points** banner; drag a gift onto a player → send
  toast (+ Cancel) and a **large gift "baz" animation** (close-up sender); other viewers see a **small** sender
  bubble. Sheet closes **only via X**. ✅ **Cancel window = 5 seconds (Erez 2026-08-10 — VW-3)** — applies to
  **both** a sent gift and a submitted question-suggestion (5s to undo before it commits). ⏳ The **gift catalog
  (items + coin value each)** is still pending — Erez said a list "will be provided."
- **In-stream animation:** Figma `7816:57287` (per-question win/loss only — the **end-of-game popup in this
  frame is dropped**, D-17).

### 6.4 Moderator — Figma Close-up `7097:51662`, Remote `7148:62527`  (reviewed 2026-06-21; אפיון pp.14–21)
- **Accept / decline invitation** with a 60-second countdown (popup "Join the game as a host" — ⚠️ copy: it's a
  *moderator* invite).
- **Question Composer:** type question + **3 default answers** (`+` to add) + tabs to **Viewer Questions** /
  **Drafts**; action bar **Publish** (⚠️ Figma reads "Advertising") / **Save Draft** / **Delete** (✅ Delete is
  real — designers, Zoom 2026-06-23; 🧱 the button has no Figma frame yet, designers adding). **Viewer
  questions** → expand → pick/edit answers → Remove / **Publish** (⚠️ remote variant reads "Which publication").
- **Per-question / pre-live controls (M2/M3, decided Zoom 2026-06-23):** **question-display duration is a
  MODERATOR setting** (a default + pick from ~4 preset times); **minimum wager per question is a HOST setting.**
  ✅ **The duration control's Figma frame arrived 2026-07-21** (close-up composer → "Advanced options" →
  "Set response time for question"); it matches the built control (`AdvancedOptionsSheet` + `TimeLimitSelector`,
  closed set `[15/30/45/60]`). ✅ **Default = 45s (decided 2026-07-21, D-2/CU-1)** — client already `45`;
  ⚠️ **server `DEFAULT_QUESTION_TIMER` still `30` — align to 45** (see §8). ✅ **Figma frame to be updated 60 → 45
  (Sara 2026-08-12): no UX reason for 60 → sync frame to the 45 default (design + code + אפיון aligned).** ✅ **The
  min-wager (host) field exists** (frame `Minimum points for sending`). ⏳ **The composer Delete button (M3) still
  needs a frame** — מלכי re-listed it as a design item 2026-08-12. *(Correction: an earlier note said "both
  exist"; only the min-wager field does.)*
- **Open/pending questions** list (participants count + timestamp) → expand → pick correct answer → resolve
  ("result resolved" toast); pending questions also rotate as a **bottom banner** of pills.
- ✅ **`Viewing options` is HOST-only (Erez 2026-08-10 — MR-1):** the followers-only viewing restriction lives
  **only in the host's panel, not the moderator's.** (The moderator panel keeps its other controls.)
- 🎁 **Viewer-question author reward (Erez 2026-08-10):** a viewer whose suggested question the **moderator
  publishes** is rewarded — **structure decided:** a **fixed coin amount** (not a % of the pot), paid **on
  publish**, **only if the question is published** (a rejected suggestion earns nothing), with **no per-viewer
  cap** in a game. 🔴 **Value still pending — Erez asked "what is the amount?"** → cannot implement until the
  fixed value is given. Unblocks **SCRUM-263**. See §8.
- **Live layout:** close-up = avatars row + "Show details" → full participant list + single video + camera
  switcher; remote = **moderator PIP + 1–4 player grid** (name + gift count + speaker state per tile).
- **Gifts:** receiving → large baz animation; other viewers' gifts → small bubble (same gift display as every
  participant). ✅ **The moderator RECEIVES gifts (backend credits 65%) but does NOT send them** — there is no
  send UI for the moderator (Sara, 2026-08-04, MR-4); code gap = a `GIFT` socket event (only `balance_update`
  today). **Mute Players** → header
  speaker icon red.
- ✅ **Mute-players-while-speaking (Sara 2026-08-11):** "Mute Players" is a **manual** control the moderator
  presses **while he is speaking**, to silence the players; when he finishes, he **presses again to un-mute
  them.** (Not automatic — a deliberate press/release by the moderator.)
- ✅ **Moderator gift-receipt display (Sara 2026-08-12 — MR-4): COPY the parallel viewer gift screens** (same
  structure as the viewer's, §6.3) — no bespoke design. In scope, structure-only (visuals/animation not final).
- ⏳ **Open designer questions (H-5e / H-5f):** (H-5e) is inviting a moderator **mandatory or optional**? — the
  copy says "optional" but the wizard gives it 4 screens with no skip. (H-5f) what happens when a moderator
  invite is **declined**, and the **"invite another moderator" flow** (missing). Tracked in DESIGNER-QUESTIONS §2ד.
- **Hot moderator swap:** **"Substitute Moderator Booking"** picker (recommended viewers first, then others,
  parallel invite) → accept → "Start handover" (120-s overlap). ⚠️ **naming bug — the remote flow reads
  "Substitute *Host* Booking"; the close-up flow (2026-07-21, Ready-for-dev) reads the correct "Moderator".
  "reserve"/"To order" should be Invite (§14a).** The swap doubles as the moderator **exit** path (Exit dialog →
  picker). ✅ **Exit is NOT gated on a swap (Sara, 2026-07-21)** — a moderator may leave with no replacement; a
  **Skip** is present and the moderator simply taps Exit, so the "no substitute accepts" case is moot — no
  timeout, no stream-close (Sara, 2026-08-04, MR-2). ⚠️ The Figma picker shows *no* skip — a skip button must be
  added to the frame.
  Per the PM points-distribution doc, **with no active moderator questions cannot be sent and betting is
  disabled** (Sara 2026-07-22) — the game keeps running but its question/bet mechanic is inert. ⏳ Open to
  designers: the *experience* of a moderator-less game (is it worth continuing? any warning?) — MR-2, DQ §2ה.
- ✅ **Resolved (Zoom 2026-06-23):** swap naming = **Invite a moderator** (M1, copy fix); duration→moderator,
  min-wager→host, composer **Delete** real (M2/M3); central 🚫 = video-region placeholder (M4). **Moderator
  leaves mid-question (#38):** the next moderator does **not** answer the pending questions — **open wagers are
  refunded to the bettors and the new moderator re-asks** (per אפיון). Moderator-drop **sound alert to all**, swap
  **open-question refund + viewer notify**, and **dynamic resolution except "who wins" (resolves at end)** are
  confirmed אפיון behaviours (no frame).

### 6.5 Shared / supporting screens
- **Home/Feed** `7705:45750` — a **full-screen vertical pager** (TikTok-style), not a card list. ✅ **Answered
  by Sara 2026-08-11:**
  - **Overlay content (UR-Feed-1) = ONLY the host avatar + host name + a "Tap to switch to live game" button.**
    Nothing else — no viewer counter, no title, no Follow button in the overlay. (Figma screenshot confirmed.)
  - **The next item that peeks from below (UR-Feed-2) = a LIVE broadcast** (real live video), not a static
    thumbnail. *(Any blur seen in a screenshot is only Netfree censorship, not a design choice.)*
  - **Scroll order (UR-Feed-4) = personalized "simplistic algorithm"** — ranks by the viewer's relationship to
    the broadcast: streams by people you **follow**, streams you **clicked/entered**, and streams you **bet on**
    (bet-on ranks highest), etc. 🔧 **Sara to send the exact ranking detail from the אפיון** (needed to implement).
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

**✅ Two-stream viewer model (Sara, 2026-08-05) — THE structural reason there are two streams:** the viewer
receives **two separate streams**, not one baked composite — **(1) players + host** and **(2) moderator**. The
DVR freeze applies **only to stream 1**: during an open question the players+host stream freezes for the viewer
while the **moderator stream (2) keeps playing live** (the moderator must stay live to run the question). This
is what makes the **moderator PIP independently arrangeable** by the viewer (§6.3, VW-2). ⚠️ **Consequence for
D-4:** the players stay a **single composite** inside stream 1, so a viewer **cannot switch between individual
player cameras** — the `1/3` switcher can only be a **global/director control or an indicator**, never a
per-viewer camera choice. Several viewer-layout features assume this two-stream model — **propagate it whenever
touching viewer media/layout.**
**Status:** only **partially implemented** in the codebase today; this section is the target behavior.
- **Media server:** continuous segment buffer with rolling deletion; Viewer Playlist Manager (frozen during
  question, released on close); endpoints `POST /stream/:id/pause-viewers` and `POST /stream/:id/resume-viewers`.
- **Main server:** HTTP call to media-server → pause-viewers on question open, resume-viewers on close.
- **Client:** "Question active" / "Resuming stream…" indicators; HLS player handles catch-up automatically.

The `Stream` model already supports pause accounting: `status PAUSE`, `lastPausedAt`, `accumulatedPauseMs`.

### 7.4 Gating thresholds
- **Minimum viewers for the moderator to publish a question = 1 (Erez, 2026-08-10 — CONFIRMED, "significant").**
  A **live, continuously-evaluated** condition: the moderator may **write/publish a question only while the
  stream has ≥ 1 live viewer**; if it drops to 0 mid-broadcast, question-publishing is blocked and re-enabled
  when a viewer returns. 🔴 **This REVERSES the earlier "50 viewers" gate (CU-2 / [[project-50viewer-gate]]).**
  Erez was explicit: *"a one-viewer gate for publishing questions by the moderator — **not 50, but 1 only**"*
  (`שער צופה אחד … לא 50, אלא 1 בלבד`). Every prior "≥50 viewers" / "possible starting from 50 viewers" copy is
  now **stale — use 1.**
  ⚠️ **Code gap (both paths must be fixed):** `MIN_VIEWERS_FOR_MODERATOR = 50` (enforced only at moderator-join,
  `moderatorInvitation.handler.js:195`) must be **changed to 1** (or the join-gate dropped), **and** the
  question-create/publish path (`question.service.js`, which today gates on `ensureModerator` only, with no
  viewer-count check) must add the **≥1-viewer** live gate. CU-2 is still unimplemented — implement it against
  **1**, not 50.

---

## 8. Game Economy & Rules

All money movement goes through [economy.service.js](../../packages/server/src/services/economy.service.js) inside a
Prisma `$transaction`. Coins are `Decimal(10,2)`. **Canonical rules (as implemented):**

| Rule | Value | Source |
|---|---|---|
| New-user signup gift | **1,000 coins** | `User.walletBalance` default |
| Default question timer | **45s** (decided — designers' chat, from a closed set `[15/30/45/60]`) | `GAME_SETTINGS.DEFAULT_QUESTION_TIMER` — ⚠️ **server code still `30`; client already `45` (`DEFAULT_TIME_LIMIT`) — align server → 45 (D-2 / CU-1)** |
| Minimum wager | **10 coins** | `GAME_SETTINGS.MIN_WAGER` |
| Maximum gift | **5,000 coins** | `GAME_SETTINGS.MAX_GIFT_AMOUNT` |
| Correct answer reward (STANDARD) | **125%** of the wager | `rewardCorrectAnswers` (`× 1.25`, floored) |
| "Who wins" payout (WINNER_TAKES_ALL) | **85%** winner / **15%** moderator | `processWinnerPayout` |
| Standard pot split | players each get `floor(pot / (numPlayers + 1.15))`; moderator gets the remainder (≈ 15% premium over a player unit) | `distributeStandardPot` |
| Gift split | **35%** to player / **65%** to moderator | `sendGift` |
| No active players on a standard pot | entire pot → moderator | `distributeStandardPot` |
| Viewer question-author reward | **fixed amount** (value `X` TBD → Erez), **paid at publish**; only if published & ≥1 live viewer (aligned to the 50→1 gate); rejected = no reward | ⏳ new — not yet in code (SCRUM-263) |

**✅ RESOLVED 1 (PM, 2026-06-18) — standard-pot split is canonical:** the implemented `numPlayers + 1.15`
unit formula is correct (PM points-distribution graphic: moderator + 2 players, pot 100 → moderator 36.5,
each player 31.75). **✅ D-5 (moderator + single player, 2026-07-22):** same +15% rule → `100 / 2.15` =
**player 46.51 / moderator 53.49** (the deleted `36.51` figure was wrong). Matches the implemented formula.
⏳ **A confirm-only question to designers is pending** (verify this split is current, not a superseded graphic).
**✅ RESOLVED (SCRUM-311 / PR #215, 2026-07-28):** the unused `gameRules.js → BETTING_RULES` block
(`LOSER_POT_DISTRIBUTION` `MODERATOR_SHARE 0.4 / PLAYERS_SHARE 0.6` and `WINNER_REFUND_RATIO 1.0`) was deleted —
code + constants now agree (zero consumers confirmed across the repo).

**⚠️ DISCREPANCY 2 — invalid transaction type:** `processWinnerPayout` writes `Transaction.type = 'DIRECT_WIN'`,
but the Prisma `TransactionType` enum has no `DIRECT_WIN` (it has `WINNER_PAYOUT`, `CORRECT_ANSWER`, …). This
will throw at runtime. Use a valid enum value (likely `WINNER_PAYOUT`).

**✅ RESOLVED 3 (PM, 2026-06-18) — gift split is 35% player / 65% moderator** (PM graphic §5 "direct
split"). Implemented code already matches; no change needed.

**🎁 Viewer-question author reward (Sara, 2026-08-05; refined Erez/Sara 2026-08-10/11) — fully specified except one number:**
- **Base = a FIXED coin amount** (not a % of the pot). *Rationale: the pot only exists after the answerers
  wager, i.e. after publish, so a publish-time reward must be pot-independent → fixed.*
- **When = on PUBLISH** — the author is notified + credited the moment the moderator publishes the question.
- **Eligibility (Sara 2026-08-11):** paid **only if the question is published** (a rejected suggestion earns
  nothing); **no cap** on rewarded questions per viewer per game; **no minimum-participants threshold.**
  *(The publish action itself now requires **≥1 live viewer**, §7.4 — the 50→1 change supersedes the earlier
  "≥50 gate" that once qualified this reward.)*
- **Legal combos:** publish→fixed ✅ · close→(% of pot *or* fixed) ✅ · publish→% ❌ (pot doesn't exist yet).
- 🔴 **The ONLY open item = the fixed value X** ("how many coins per published question?") → **Erez**. If it's in
  the אפיון, a reference suffices. Blocks **SCRUM-263**; once set, add a `Question author reward` row above +
  wire `economy.service`.

**⏱️ Answer-submission lock (Erez 2026-08-10 — VW-3):** a viewer may submit/change an answer **up to 3 seconds
before the question timer ends**; at T-3s the answer **locks** (no further submit/change). Applies on top of the
per-question timer (default 45s, §6.4). *(New behavioural rule — not yet in code.)*

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
- ✅ **First-run onboarding — IN SCOPE, inside the Coin Bank (Sara 2026-08-12; reverses the 2026-07-27 B-5
  cancellation — מלכי's detailed spec wins, and these screens live in the Coin Bank, not elsewhere).** On the
  first entry to the Coin Bank:
  - **3 explainer pop-ups:** (1) "Welcome to the Coin Bank" · (2) "See it all in one place" · (3) "Manage your
    coin balance". Each = **title + short explainer text + one button** — "Next" on screens 1–2, "Got it" on 3.
  - **Then** a pop-up: "as a new user you won **1,000 coins**", with **buy-more** or **X to continue** to the
    Coin Bank main screen.
  *(Supersedes the earlier "onboarding cancelled" note. The §4.2 rule still stands: nothing about the incentive
  appears in the registration popup — it is all here, in the Coin Bank.)*
- **Purchase flow:** package list (base coins + bonus + price, low/high variants); quantity +/- adjuster;
  pay via platform IAP (§12); confirmation screen + balance refresh; cancel/error/declined states.
- **Transaction history:** `GET /wallet/transactions?from=&to=`. **✅ CLOSED 2026-07-20 (Sara): the ≤4-month
  range cap is dropped** — it was a stopgap that the Figma range picker (7 days / 30 days / 3 months /
  6 months / this year) already exceeds. Use real cursor pagination instead; any range is valid.
  Row = last-4 of method, amount, fee, date/time, status. Empty + filled states.

  **Transaction statuses — ✅ CLOSED 2026-07-20 (Sara). Canonical set is four:**

  | `TransactionStatus` | Hebrew | Meaning |
  |---|---|---|
  | `PENDING` | בטיפול | Purchase started, store has not confirmed |
  | `COMPLETED` | הושלם | Receipt validated, coins credited |
  | `FAILED` | נכשל | Purchase did not go through |
  | `REFUNDED` | הוחזר | Store refunded after the fact — **coins must be clawed back** |

  Migration: rename `SUCCESS` → `COMPLETED`, add `REFUNDED`. **`REFUNDED` is not cosmetic** — Apple and Google
  refund unilaterally days later and notify by server webhook, so the balance must be reversible.
  **`CANCELLED` is deliberately excluded:** if the user dismisses the native sheet, write no row at all.
  **`DECLINED` is excluded** too — card declines happen inside the store; we only ever learn "failed".
  ⚠️ The Figma label `Postponed` is a mistranslation of "נדחה" (*declined*, not *postponed*) — see §14a.
- **FAQ:** role-tabbed — ⏸️ **deferred** (DECISIONS: "FAQ בבנק נדחה"). Not in scope for the current build.
- **A second list exists in Figma — ✅ SCOPED (Erez 2026-08-10 — B-2):** the bank screen has two rows —
  `היסטוריית שימושים` (**usage history**) **and** `עסקאות` (**transactions**, purchases from `Transaction`,
  defined above). **Usage history contains GIFTS ONLY** — gifts the user sent (avatars + negative amounts,
  sourced from `UserPoint`). **It does NOT include question wagers or winnings** — only gifting movements.
  ⏳ Still open (not answered by Erez): the two header numbers (`3,300` / `2580`) have no confirmed label.

> 🔴 **Build status: §9 is 0% implemented.** There is no `/api/wallet` mount at all — neither
> `GET /wallet/balance` nor `GET /wallet/transactions` exists, despite being cited above. No coin-bank screen
> exists in the client either. See M8-03 in [FINDINGS.md](../FINDINGS.md).

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
🧱 **Design gap (מלכי 2026-08-12): the "Games activity" section in the user profile has NO frames yet** — needs
design (the list + card + detail described above).

**Username vs full name (✅ CLOSED 2026-07-20 — Figma frame walkthrough):** **both fields exist.** `view profile`
shows `Maor Karmi` large with `@usernoam5236` grey beneath it, and `Edit profile_1–3` carry `Full Name`,
`Username` and `Biography` as three separate inputs. So: **`fullName` = primary display name**, **`username` =
secondary handle** (profile link, search, @-mentions).
⏳ **Still open:** whether `fullName` is required or optional, and the fallback if optional — tracked as P-3 in
[DESIGNER-QUESTIONS.md](screen-specs/DESIGNER-QUESTIONS.md) §2א.

**Username uniqueness & editing (✅ CLOSED 2026-07-20 — Sara):** `username` becomes **unique and user-editable**.
`Edit profile_2` shows a red "username already taken" validation error beneath the field, which requires both.
🔧 Not yet built — needs a migration (`@unique` + de-duplicating existing rows), a `username` branch in
`updateUserProfile`, and an availability check. See M2-04 in [FINDINGS.md](../FINDINGS.md).

**Profile stats row (✅ CLOSED 2026-07-20):** three counters — **Live broadcasts · Followers · Following**.
The English `In progress` label in Figma is the known mistranslation of `Following` (see DESIGNER-QUESTIONS §4);
Hebrew reads `שידורים חיים · עוקבים · במעקב`. `followersCount` / `followingCount` exist on `User` but `GET
/users/me` does not return them yet; there is no live-broadcast counter at all.
✅ **Two Figma labels clarified (Sara 2026-08-11):**
- **`4 Live Feed` = the "live broadcasts" counter** (this profile's number of live broadcasts) — same as the
  `שידורים חיים` counter above.
- **`Under monitoring by` (`במעקב ע"י`) = social proof in the followers list:** it shows the **avatars of your
  own connections** — people **you follow / who follow you** — who also follow this account, **not** random app
  users. (So the account is "followed by [people you know]".)

**Biography (partly closed 2026-07-20):** free-text field, **auto-growing input box**. Figma annotates a
**80-character** limit — ⚠️ but the `Edit profile_3.1` mock-up holds ~230 characters, and whether a counter is
shown is unanswered. Tracked as P-1 in [DESIGNER-QUESTIONS.md](screen-specs/DESIGNER-QUESTIONS.md) §2א.
🔧 `bio` does **not exist** on the `User` model.

**Image cropping (✅ CLOSED 2026-08-11 — Sara, P-2):** the two `Image cropping` frames are **one two-step flow,
not duplicates or alternatives.** The **rectangular frame with a circular overlay** is the **crop + reposition**
step (drag/scale the photo to the exact spot inside the circle); the **plain circle** shows **how the photo is
finally saved** (the circular result). Build them as consecutive steps.

> 🔴 **Build status:** this whole flow is **0% implemented**. `UserProfileScreen.js` is 143 lines (avatar, name,
> email, logout); `updateUserProfile` accepts only `phoneNumber` + `firebaseId`; `fullName` and `bio` are absent
> from the schema; and **no avatar-upload endpoint exists anywhere** (`avatarUrl` is only ever written from the
> Google/Facebook `picture` claim). Edit-profile steps 4–8 need storage + upload before any UI work. See M2-03.

### 10.2 Inbox (categorized list — partly built)
An inbox **aggregation service already exists** (server service + Redux slice + `InboxScreen` + Socket
`new_inbox_item` + `markAsRead` for FOLLOW / GIFT / SYSTEM). Production scope = categories (new followers /
live-stream gifts / system), follow-back vs open-chat rows, gift rows (sender, coins, date; collapses
to a normal message after viewing), unread badges, empty state. ✅ **No game name on the gift row (Sara
2026-08-11 — I3):** despite the אפיון asking for it, the gift row does **not** show the game/broadcast name.

**Inbox structure (✅ CLOSED 2026-07-21 — Figma frame walkthrough, Sara):** the Inbox is the **entry screen**
and it contains three things, and Figma is canonical for this layout:
1. **DM conversation list** — the *body* of the screen: one row per conversation (peer, last-message preview,
   unread badge, timestamp). This is the entry point into the 1:1 chat (§10.3). ⚠️ Its data source is
   `ChatMessage` threads — a **separate** endpoint from the follow/gift/system aggregation, **not** part of
   `inbox.service`. (Engineering detail; the two aggregations are distinct concerns.)
2. **Three category shortcuts** at the top — **New Followers · Live Gifts · System Alerts** — each navigating
   to its **own separate screen** with its own list, empty state, and (per Figma) search. They are **not**
   badges inside one merged feed.
3. **Search** over conversations (Figma shows an active search: `Maya` → "Results for 'Maya' — 2 conversations").
   In scope because it is in Figma. (`2 calls` in the frame is a mistranslation of "2 שיחות" — see §4.)

> 🔴 **The current build does not match this.** `inbox.service.js` merges FOLLOW + GIFT + SYSTEM into **one
> flat feed**, `InboxScreen.js` renders it as badged cards with **no category screens, no conversation list,
> and no search**, and `ChatMessage` is never queried by the inbox. Aligning to Figma is a **rework** of both
> `inbox.service` and `InboxScreen`, plus a new conversation-threads endpoint. Tracked as M9-04 in
> [FINDINGS.md](../FINDINGS.md).

**Zoom 2026-06-23:**
- **New-Followers row buttons (I1) — still open:** follow Figma (Follow / "Removal") in the interim; Sara is
  corresponding separately and may escalate to the designers.
- **System Alerts (I2) — incomplete; designers are ADDING alert types** (e.g. notify the host "you were
  blocked / reported N times"). Consolidated missing-alerts list in
  [docs/screen-specs/DESIGNER-QUESTIONS.md](screen-specs/DESIGNER-QUESTIONS.md) §1.
- **Forward a contact in chat (I4) — OUT of scope.** Chat is 1:1; you do not forward a contact. **Links ARE
  allowed** (like any platform). The "Contacts for sending / Sending contact details" Figma frames are dropped.

### 10.3 Private 1:1 chat
Real-time DMs (`ChatMessage` model exists: sender/receiver/content). Text + emoji; sent/delivered/read
status; header with name, profile link, report, back; pagination + reconnect. Links may be sent (I4); contact
forwarding is **not** supported.

> 🔴 **Build status (2026-07-21):** **0% frontend** — no chat screen exists (`app/(tabs)/messages.js` just
> re-exports InboxScreen). The server `chat.service.js` is **broken against the schema** (writes/reads
> `messageText`/`messageType`, which the `ChatMessage` table does not have — it has only `content`), so both
> endpoints throw. And the schema has **no `status` and no `messageType` field**, so sent/delivered status
> (here) and media (§10.4) are not storable as written. Model to be rebuilt full (messageType + status + media
> fields) since §10.4 is in scope. See M9-02, M9-03 in [FINDINGS.md](../FINDINGS.md).
- **Chat-request approval (S1, in scope — Zoom 2026-06-23):** a **non-friend's first message requires the
  recipient's approval** before the thread opens (Approve / Delete). 🧱 The precise UI (incl. what "Delete"
  does) is being detailed by the designers.
- ⚠️ **Open (I5):** whether the input has an explicit **emoji picker** and whether **message status
  (sent/delivered/read)** is shown — designers queried.
- ✅ **Mute notifications — DEFINED (Erez 2026-08-10 — I-Inbox-1):** the chat-menu toggle **mutes notifications
  for that private conversation's messages** — it is **not** a block. (1) It silences **notifications** for
  private (1:1) chat messages; (2) scope is **per-conversation (per-user)**; (3) it is a **binary toggle** that
  stays muted **until turned back on** (no "mute for 8 hours" middle state); (4) the muted user's **messages
  still appear in the conversation** (only the notification is suppressed; the thread does not disappear).
  ✅ **Show a muted-indicator icon on the conversation (Erez: yes).**

### 10.4 Media messages & permissions
Voice notes, images, video (camera or gallery); OS permission flows (contacts, photos); upload + thumbnail +
retry-on-failure.

### 10.5 Report & block
Report-reason → block-confirm; after block the thread is disabled and input hidden with a confirming
toast/banner; system alerts the reporter if 2 distinct users report a user. **(I6, Zoom 2026-06-23 — in scope;
🧱 the designers are detailing the exact states:** block step-2 confirm modal, post-block disabled/hidden
input, "2 distinct reporters → alert", image-load-failure + retry.)
✅ **Flow order confirmed (Sara 2026-08-12 — AD-5): "choose a reason" screen (the radio list of report reasons,
already in Figma) → confirm modal → block.** So report/block always starts at the reason picker.

**✅ Broadcast report escalation ladder (Erez 2026-08-10 — CAM-6 + M1-4). There is NO "kick".** Reporting an
inappropriate broadcast escalates by report count, with these popups:
- **When reports come in → the HOST gets a popup: "the game violated policy and is therefore under report."**
- **At 5 reports → a popup that the broadcast is under monitoring** (host-facing; the case is escalated to a
  **HyPulse staff member**, who reviews the broadcast).
- **If a violation is confirmed → the game is closed.** On **immediate/severe closure, ALL participants —
  including viewers — receive a notice: "there is a severe violation and the broadcast has been closed."**
  *(Refines the earlier "viewer gets appropriate copy": on a violation-closure the viewer IS notified; only the
  benign creator-away hold, H-2, gives no viewer message.)*
- **3 such (closed-for-violation) broadcasts** by the same account → the **account is banned for one week.**
- **Report in chat = report only** (does **not** auto-block — `Report` and `Report-and-block` are distinct
  actions, consistent with I6). A participant can also be **reported from their personal profile.**
- *(Extends the existing game-scoped `moderation.service` threshold-5 mechanism; the 1-week ban, staff-review
  step, and the participant-wide severe-violation closure notice are new.)*
- 🧱 **Design gap (behaviour decided, frames NOT yet designed — מלכי):** the popups themselves need designing —
  the host "under report" popup, the "broadcast under monitoring" popup, and the participant-wide "severe
  violation — broadcast closed" notice.

**✅ Unblock (Erez 2026-08-10 — AD-6): via BACKOFFICE, not an in-app screen.** There is **no in-app
unblock/blocked-users frame** — undoing a block is a **backoffice** operation. This closes the outstanding
"unblock flow" question (I6 / DESIGNER-BRIEF §1.4): **no frame to design.** A **user support inquiry** is also
handled through the backoffice (an inbound-contact channel must exist there).

> 🔴 **This is a net-new feature — there is no block-user model in code.** The existing `moderation.service.js`
> is **game-scoped** (per-game REPORT, threshold 5, host-under-review) — a **different mechanism** that cannot
> be reused for user-to-user chat block/report. The chat report/block needs its own model (block relation +
> `status=2` chat threshold, distinct from the game's 5). Do **not** treat "reuse the moderation pattern" as
> valid. See M9-05 in [FINDINGS.md](../FINDINGS.md).

### 10.6 Sharing & deep linking
**Profile share targets (Zoom 2026-06-23; revised 2026-07-29; ✅ Instagram closed 2026-08-11):** X (Twitter) ·
WhatsApp · Facebook · Link (copy) · Email — one at a time. **No Telegram. No Instagram** (Sara 2026-08-11:
"there is no Instagram" — dropped as a *login* provider **and** as a *share* target). (Figma is canonical.)
⚠️ **`Partner` on the share-broadcast screen = a mistranslation of "Share" (שתף)** (Sara 2026-08-11) — it is
the share button, not a "partner" concept. Fixes H-5c and the "Partner" unclear-term (§14a / DESIGNER-QUESTIONS §4ה).

**Two share sheets — ✅ CLOSED 2026-07-20 (Sara): intentionally distinct, do not unify.** They serve different
functions: `Sharing` (`7435:84289`, from the profile) shares *outward* to the six social targets above;
`שתף פרופיל` (`7435:84456`, from Settings) is a **"Send to" contact picker** (contacts + copy / Email /
message / Facebook). Deep link `hypulse://game/:id` opens the game directly.
⏳ **Open:** the `HyPulse.com/@handle` line with the copy icon on the profile — no profile link scheme is
defined. Tracked as P-5 in [DESIGNER-QUESTIONS.md](screen-specs/DESIGNER-QUESTIONS.md) §2א.

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
> validated server-side. **Stripe-removal status (verified 2026-07-29):** the core payment layer is **already
> gone** — `payments.service.js`, `payment.routes.js`, `payments.webhook.js`, and `User.stripeCustomerId` were
> deleted (commit `5f49346`) and no longer exist in the repo. **Remaining Stripe remnants to clean up:**
> `ShopScreen.js` (dead `useStripe` import — the package isn't even in `package.json`, M8-04) and the
> `CreditCard` model + `finance.controller.js` / `POST /finance/*` routes (a card layer with no payment provider
> behind it under IAP, M8-06). **Authoritative: finish removing those remnants (tracked cleanup).**

**Target flow (react-native-iap):**
1. User selects a coin package (Coin Bank purchase flow, §9). **This screen is ours to design.**
2. `requestPurchase(sku)` → **the OS takes over.** The store's own sheet appears. We cannot style it, add rows
   to it, or offer payment methods inside it — it belongs to Apple/Google and bills the user's store account.
3. Server validates the store receipt, credits coins, writes a `Transaction` (`type PURCHASE`).
4. Balance refresh; confirmation screen.

> ⚠️ **The Figma payment-sheet frames contradict this, and are believed to be illustrative.** Frames
> `רכישה בסכום נמוך/גבוה` draw *our own* checkout: Apple Pay / Google Pay radio rows, a `Quantity` stepper, and
> a "For purchase" button. That cannot be built as drawn (there is no API to embed Apple's payment UI inside our
> sheet) and would be **rejected under App Store Guideline 3.1.1** — Apple Pay is a card wallet for physical
> goods, not IAP; offering it for coins is circumventing store billing. The designers' own annotation on the
> same canvas describes the correct behaviour: *"לאחר לחיצה על רכישה יעבור למסכים הפנימיים של כל אפליקציה"*.
> Awaiting confirmation — [DESIGNER-QUESTIONS.md](screen-specs/DESIGNER-QUESTIONS.md) §2ב B-1.
>
> **`Quantity` has no meaning under IAP:** each package is a separate SKU registered in App Store Connect /
> Play Console (`coins_40`, `coins_320`…) and is bought one at a time. 640 coins is another package, not 320×2.

Server gap: deploy with secrets/SSL/Sentry; sandbox testing on both stores; finish the Stripe cleanup
(M8-04 `ShopScreen.js`, M8-06 `CreditCard` + `/finance/*`).

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

**Source of truth for tokens:** [`packages/client/constants/design.js`](../../packages/client/constants/design.js)
(extracted from Design system page `4702:23825`). Icons + component node IDs + Figma API notes:
[FIGMA_GUIDELINES.md](../../packages/client/FIGMA_GUIDELINES.md). Summary (must match `design.js`):

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

## 14a. Terminology Glossary — binding

**✅ Added 2026-07-20 (Sara).** One table fixing Hebrew ↔ English ↔ code for every term that has been
mistranslated at least once. **This table wins over Figma copy.** Figma is canonical for *screens*; it is not
canonical for *terminology* — several of the rows below exist precisely because a Figma label was wrong.

> **Why this exists:** the same mistranslations kept resurfacing one flow at a time, and one of them
> (מנחה ↔ מארח) swaps two roles that have **different permissions in code**. A wrong label there is not a typo —
> it is a wrong specification, and the feature gets built for the wrong role.

| Hebrew | English (UI) | Code / enum | ⚠️ Seen wrongly as |
|---|---|---|---|
| **מארח** | **Host** | `GameParticipant.role = HOST` | *moderator*, *mentor* — 🔴 **different permissions** |
| **מנחה** | **Moderator** | `GameParticipant.role = MODERATOR` | *mendator*, *mentor*, *host* — 🔴 **different permissions** |
| שחקן | Player | `PLAYER` | — |
| צופה | Viewer | `VIEWER` | — |
| שחקן נוסף | Additional player | `PLAYER` (secondary) | — |
| **מטבעות** | **Coins** | `CurrencyType.COIN` | *points* (coin-bank titles, birthday modal) |
| נקודות | Points | `UserPoint` | *coins* — the ledger, not the currency |
| **במעקב** | **Following** | `User.followingCount` | *In progress* (profile stats) |
| עוקבים | Followers | `User.followersCount` | — |
| **נדחה** | **Declined / Failed** | `TransactionStatus.FAILED` | *Postponed* — 🔴 broke the whole status set (§9) |
| הוחזר | Refunded | `TransactionStatus.REFUNDED` | *Returned* |
| בטיפול | Pending | `TransactionStatus.PENDING` | *In treatment* |
| הושלם | Completed | `TransactionStatus.COMPLETED` | — |
| הזמנה (למשחק) | **Invite** | — | *order*, *summons*, *booking*, *reserve* |
| — | **HyPulse** | — | *Game World* (incl. OS permission prompts) |

**Rules:**
1. New user-facing term → add a row **before** it ships.
2. A PR whose copy contradicts this table is blocked (see [CHECKLIST.md](../CHECKLIST.md)).
3. Figma labels that contradict this table are **Figma bugs** — log them, do not copy them.

---

## 15. Data Model

PostgreSQL via Prisma ([schema.prisma](../../packages/server/prisma/schema.prisma)). Core entities:

- **User** — identity (`firebaseId/googleId/appleId/facebookId`, email unique), `role`, `dateOfBirth`,
  `walletBalance` (default 1000), `isFirstPurchase`, denormalized follow counts. *(The `stripeCustomerId` field
  was already removed; the `CreditCard` model is the last schema remnant to drop — §12.)*
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
- **Load targets (S7):** 6 concurrent WebRTC cameras at peak — 4 game-grid cameras (host + up to 3 players) + up to 2 moderator cameras during a moderator handover (1 moderator in steady state); HLS+DVR at
  100 / 500 / 1,000 viewers; Socket.IO rooms under concurrent load; identify + tune bottlenecks.
- **Testing:** unit (economy/game/questions), integration
  (`create → join → question → DVR pause → answer → resolve → distribute`), E2E (Detox happy path per role),
  edge cases (viewer disconnect, stream drop, mid-bet, failed payment, DVR recovery). Client Jest infra is
  currently ad-hoc (`npx jest` only) — needs a `test` script + `jest-expo` config.
- **Store compliance:** **Age Rating: simulated gambling (Apple ≥17+); app-enforced signup minimum = 18**
  (Erez/Sara 2026-08-11, no cash-out)**,** privacy labels, data-safety, Content Rating;
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
   in [DEEP-DIVE.md](../notes/DEEP-DIVE.md).

### ✅ Closed at the Zoom (2026-06-23)
6. **Birthday gate** ✅ — re-prompts every entry until a DOB is saved (§4.3 / R3).
7. **Share-target list** — X · WhatsApp · Facebook · Link · Email; **no Telegram** (§10.6). ✅ **Instagram
   fully dropped (Sara 2026-08-11): not a login provider (§4.4) and not a share target.**
   **Suggested accounts** ✅ **(Erez/Sara 2026-08-10/11 — VW-4a): ANY user, not hosts only** — a **per-viewer
   personalized, CONNECTION-BASED** list (each viewer sees a different set). ✅ **The "simple / performant" level
   (Sara 2026-08-11): suggest people via "friends of friends" OR "were in the same game" as the viewer**
   (also your own followers / people you follow — i.e. real connections, not random app users). *(Supersedes
   the vague "reduced algorithm" note; this is the concrete v1 rule.)*
8. **Player → manager/admin promotion (אפיון p.11)** — ❌ **DROPPED / not in scope** (D-16, Sara 2026-07-28;
   reconfirmed 2026-08-12: "does this remain? I don't recall discussing it"). No feature, no frame. *(Corrects
   the earlier stale "in scope" note here, which contradicted D-16.)*
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
| Viewer – In-stream Animation (per-question; end-of-game popup **dropped** — D-17) | `7816:57287` |

---

*This is a living document. Update it whenever product behavior changes; treat it as the contract that code,
Figma, and Jira tickets are measured against.*
