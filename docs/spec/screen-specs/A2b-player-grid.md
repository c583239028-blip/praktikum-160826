# Screen Spec — A2b `feat/player-screen-grid-ui` (PlayerScreen.js)

> Ticket-ready visual spec, verified against Figma 2026-06-18, **re-verified vs the product spec
> `אפיון: שחקן נוסף` (Additional Player, pp.41–45) on 2026-06-19**. File to edit: **`PlayerScreen.js`**.
> Figma section **Additional Player `7691:45749`** (player states) + grid layouts from **Viewer–Remote
> `7097:45650`**. Companion to [SPEC.md](../SPEC.md) §6.2 and [FIGMA-SCREENS.md](../FIGMA-SCREENS.md).
>
> **Most detailed source = the product spec (`אפיון`).** Where Figma and the spec disagree, **do NOT
> auto-resolve — surface the conflict and verify with the designers (מאפיינות).** Open conflicts → **C1–C4** below.

## ⚠️ Key clarification (the ticket conflated two different things)
`PlayerScreen` has **two layout variants — and only the close-up one is this ticket:**
- **Close-up (THIS TICKET)** = ONE full-bleed video (host scene) + participant **avatars row** on top.
  **No grid** (the player is physically in the host's camera). → `מסך ראשי של השידור` `7691:45261` / `7691:45294`.
- **Remote = the 2/3/4 video grid — NOT a PlayerScreen-UI task.** It is a **cross-cutting, currently-unbuilt
  feature** (the same grid the *viewer* sees) that needs **server multi-producer signaling + a shared grid
  component**, and is blocked on missing Figma frames too. → pulled out into a separate epic (see "Remote grid
  = separate blocked epic" below). **Do not build the grid inside this ticket.**

## States (each maps to a Figma frame)

### 1. Invite popup — `7691:45389` (`dialog for enter to live`)
Centered modal over the (blurred) scene:
- Cyan circular person-icon; title **"Join the game as a player"**.
- Inviter row: inviter name (e.g. "Jackson Reed") + avatar.
- Subtitle: "Inviting you to join the live broadcast as a player".
- Primary CTA **Accept** (filled cyan pill); secondary **"Rejected (60 seconds)"** (outline pill with a
  **60s countdown** → auto-decline). *(Matches SPEC §6.2 / moderator-style invite.)*

### 2. Waiting / entering — dark navy bg, centered spinner + label
- **"Going live now"** — `7691:45327` (after Accept, transitioning into the live stream).
- **"Waiting for the broadcast to start…"** — `7691:45344` (joined but host hasn't started yet).

### 3. Rejected — `7691:45363`
Scene dimmed + toast (bottom): invitation-declined message.

### 4. Live main screen — **Close-up** variant — `7691:45261` (cam on) / `7691:45294` (default)
- Full-bleed single video (host close-up scene).
- **Top-left:** LIVE dot + game title (e.g. "Chess with Yuri").
- **Top-right:** viewer count (e.g. "23K") + coin badge (e.g. "1,520") + **participant avatars** (overlapping
  circles) + **close (X)** (on the default variant).
- **Bottom-center controls:** Settings (gear) · Camera toggle · Mic toggle.
  **Default entry = camera OFF + mic OFF (red icons)** — variant `7691:45294`. ✅ matches spec p.43.
  ⚠️ **C1 (designer):** spec p.43 says the **mic toggle is in Settings only, not on the main screen** — but
  Figma shows it on-screen (red). Resolve before wiring the control bar.

### 4b. Practice mode (`מצב תרגול`, ~30 s) — ✅ verified in Figma 2026-06-19 (close-up)
Mirrors the live view (host scene) + **self-preview PIP** + **00:30 countdown** + explainer popup
("Practice mode is available… at least 30 seconds… if you do not choose any action, the live broadcast will
start"). Frames: `מצב תרגול` (cam on) / `מצב תרגול כבוי` (cam off) / `הסבר מצב תרגול` (explainer) /
`מעבר לשידור` ("You are being transferred to a live broadcast" → auto-go-live).
- **Mode-dependent defaults (verified, spec pp.43–44):** **close-up = cam/mic OFF** (toggleable);
  **remote = cam/mic ON and NOT toggleable in Practice.**

### 5. Settings — `7691:45425`
Standard Settings & Privacy hub (identical structure to Profile — see SPEC §10.7).

## Remote grid = separate blocked epic (NOT this ticket)
**The grid is a cross-cutting feature shared by the remote *viewer* and the remote *player*, and its
foundation is not built.** Verified in code 2026-06-19:
- Server **never emits `stream:new_producer`** (the event both `PlayerScreen` and `ViewerScreen` listen for):
  the `PRODUCE` handler creates a producer but doesn't notify the room — [stream.handler.js:125-234](../../../packages/media-server/src/sockets/stream.handler.js#L125-L234).
- `stream:join` returns **`producerIds`** (strings, no role) — [stream.handler.js:281-292](../../../packages/media-server/src/sockets/stream.handler.js#L281-L292) — but the reference `player_test.js`
  reads **`data.currentProducers`** (with roles) and `ViewerScreen` reads **`currentProducerId`** (singular).
  Both are written against a **server contract that doesn't exist** → the grid populates with nothing.
- `ViewerScreen` is single-stream; its `new_producer`/`closed` listeners are dead code.
- → tracked as the **Multi-camera grid epic** (server signaling + roles + shared grid component + viewer+player
  wiring). Also blocked on **C2** (no remote additional-player frames in Figma). **Out of scope for A2b.**

### Verified tile geometry (reference for the epic, when unblocked) — Viewer–Remote frames
Multi-RTCView arrangement, **full-bleed** (no outer margin), thin gaps between tiles, `objectFit: cover`:
- **1 player** `7014:30858` — single video.
- **2 players** `7014:29794` — split (one video top + second tile below).
- **3 players** `7014:29603` — **one wide on top + two side-by-side below**.
- **4 players** `7014:29966` — **2×2 grid**.
- **Moderator = floating PIP** (rounded small draggable window; top-left in the 3-up layout, center in the
  2×2). It is **not** a grid cell and does **not** count toward the 4-camera max.

Per-tile overlay: top-right dark pill badge (viewers + gift, e.g. "21K🎁"); bottom-right mic-state icon +
player name (e.g. "דור"); **active/selected tile = cyan border** (`#00E5FF`, ~2px).

> NB: these frames are the **Viewer** remote view (bottom controls = gift / compose / share / settings).
> PlayerScreen reuses the same **tile geometry** but with its own controls (camera / mic / share / exit) and a
> **self-preview** tile.

## Implementation notes (from ticket)
- Replace mock `VideoView` (lines ~7–12) → `<RTCView streamURL={item.stream.toURL()} objectFit="cover"
  style={styles.video} />` (import `RTCView` from **`@livekit/react-native-webrtc`** — single WebRTC lib, never
  mix; see SPEC §7.2).
- Replace mock `LocalVideoView` (lines ~13–17) → `RTCView` self-preview.
- Lay out grid (≤4; `styles.grid`/`videoWrapper` exist) per the grid frames above.
- **Bug fix:** line ~87 `overflow: '#hidden'` → `'hidden'`.
- Add **entering** state + **Practice mode (30 s)** + Close-up/Remote variants.
- **Camera/mic default is mode-dependent** (NOT a blanket "off"): close-up = OFF (toggleable);
  remote = ON, not toggleable in Practice. ⚠️ corrects the original ticket wording.
- PropTypes for every prop; all strings via `t()`.
- **Out of scope:** consume logic (A2a).

## Open conflicts — blocking designer answers (C1–C4)
- **C1 — Mic-toggle placement (close-up):** spec p.43 = Settings only; Figma = on-screen (`מצב תרגול`,
  `מסך ראשי-1`, red mic icon). ❓
- **C2 — Remote additional-player frames MISSING from Figma:** spec pp.44–45 define a remote Practice screen
  (cam/mic ON, not toggleable) + a remote live screen with **player** controls (camera/mic/share/flip/exit).
  Figma's Practice frames are **close-up only**, and the remote grids (`2/3/4 שחקנים`) show **viewer** controls
  (gift/compose/share/settings). → need the remote player frames, or confirmation to design them. **🔴 biggest gap.**
- **C3 — Self-preview placement in 2×2:** the floating center PIP is the **moderator**; where is the player's
  own camera when 4 are open — one of the 4 tiles, or a separate self-PIP? ❓
- **C4 — Camera-off tile:** spec p.12 = show **profile picture**; Figma = circle-slash placeholder. ❓

## Other developer notes (non-blocking)
1. **Exact measurements** (tile sizes, gaps, PIP size/position, badge & control coordinates): read directly in
   **Figma Dev Mode** — select a grid frame (`7014:29603` etc.) → Inspect panel gives px / spacing / colors.
2. **Controls are player-context, not viewer** — don't copy the viewer bar (see C2).
3. **Tokens:** selection border = cyan `#00E5FF`; radius/spacing per FIGMA_GUIDELINES. All strings via `t()`.

## Acceptance-criteria → evidence map
| AC | Frame | Status |
|---|---|---|
| Grid up to 4 renders live video + self-preview | `7014:29794/29603/29966` + `שחקן אחד` | ✅ geometry verified |
| entering + variants | `dialog` / `Going live now` / `Waiting…` / `rejected` | ✅ verified |
| Practice mode (30 s) | `מצב תרגול` / `כבוי` / `הסבר` / `מעבר לשידור` | ✅ verified (close-up) |
| Close-up vs Remote variants | `7691:45261` (close-up) vs grid frames (remote) | ✅ verified |
| camera/mic default (mode-dependent) | close-up `7691:45294`; remote = spec pp.43–44 | ⚠️ remote frame missing (C2) |
| overflow bug fixed | code (line ~87) | — code |
| tokens / PropTypes / t() | code | — code |
