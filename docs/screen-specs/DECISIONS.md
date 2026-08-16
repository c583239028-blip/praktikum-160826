# HyPulse — Final Decisions Log (what's CLOSED)

> The counterpart to [DESIGNER-QUESTIONS.md](DESIGNER-QUESTIONS.md) (open items). This = **decisions already
> made** (don't re-litigate). The **per-screen analysis** itself is in
> [DEEP-DIVE.md → `## Findings`](../../DEEP-DIVE.md) (Sections 1–15, one block per area).
> **Updated:** 2026-06-23.

## 🧭 Map — where everything lives
| Need | File / anchor |
|---|---|
| **Per-screen analysis** (precise, every screen) | `DEEP-DIVE.md` → `## Findings` (Sec. 8/10/4/1/11/5&6/2&3/7/9/12/13/14/15) |
| **Flow-level analysis** (storyboards) | `DEEP-DIVE.md` → `## Flow-level review` |
| **Open questions for designers** | `DESIGNER-QUESTIONS.md` |
| **Zoom fill-in + post-call prompt** | `ZOOM-DECISIONS.md` |
| **Final decisions** (this file) | `DECISIONS.md` |
| **Screen index (node IDs)** | `FIGMA-SCREENS.md` |
| **Behaviour spec** | `SPEC.md` |
| **Screenshots** | `.figma-shots/<section>/` |

---

## ✅ Final decisions (locked)

### Source of truth
- **Figma is canonical** for screens / visual / layout / flow (designers, 2026-06-23). The **אפיון is secondary**
  (behaviour/copy where Figma is silent). Figma **bugs / missing screens are NOT canonical.**
  ✅ **Confirmed at the Zoom (2026-06-23).** The "build per אפיון" verdicts were re-confirmed item-by-item — see
  the **Zoom decisions** block below; אפיון-only features Figma omitted are either dropped (C5 points-picker) or
  flagged 🧱 *Needs design* (the designers are adding the frames).

### Payments (PM, final 2026-06-23 — was B1/B2)
- **Apple IAP + Google Play Billing only. No Stripe, no in-app card sheet, no card-based transaction rows.**
- Remove all Stripe code + schema fields (SPEC §12). Redraw the payment sheet + transaction rows for store IAP.

### Registration / auth (PM, final 2026-06-23 — was R1)
- Providers = **Google · Apple · Facebook · X · Instagram. NO email/password.** (exactly the Figma modal.)
- Build note: X = native Firebase; **Instagram needs custom OAuth** (not a Firebase provider).

### Roles (final)
- **Single host per stream** (no co-hosts). "Request additional hosts" = mislabeled invite-moderator (H5).
- Role naming: **מנחה = Moderator**, **מארח = Host** (separate roles), invite verb = **Invite**. All other
  labels (host/facilitator/guide/booking/mendator/mentor for a moderator) = copy bugs to fix.
- **No global User.role gate** — authz is per-game (`GameParticipant.role`) + per-stream ownership
  ([[project-no-global-host-role]]).

### Age / compliance (final)
- In-app **Audience Control 18+** toggle **and** store **17+ gambling rating** coexist (not a conflict).

### Economy (PM, 2026-06-18 — SPEC §8)
- New-user gift **1,000 coins** · question timer **30s** · min wager **10** · correct-answer reward **125%** ·
  "who wins" **85/15** · standard pot **`n + 1.15`** (moderator +15%) · gift split **35% player / 65% moderator** ·
  **DIAMOND removed** from scope.

### Product (PM, 2026-06-18)
- Default language **English → device locale** (beta: EN + HE).
- **Game history:** 10 most recent, auto-delete after 30 days, pin up to 10.
- **Settings are per-role-in-game** (no global role).
- **DVR:** live feed **freezes for viewers only** during an open question; moderator/host stay real-time.

### Profile / social (designers, 2026-06-19)
- **QR is NOT in profile / add-friends** (only in the host game-open flow) — אפיון is stale here.
- **Share set = Instagram · X · WhatsApp · Facebook · Link · Email (no Telegram).** Two share contexts (invite
  players / general share) intentionally have separate screens.
- Product name = **HyPulse only** (fix all "World Game / Game World" copy).

### Zoom decisions (Z, final 2026-06-23 — codes map to DEEP-DIVE)
- **Wager mechanic (C5)** — wager by **dragging the matching icon from the Currency Bank onto the chosen
  answer** (the Figma drag mechanic wins). **The 3-random-points picker is DROPPED** — no frame needed. The
  bank icons/images may later swap to other images/animations (future, with C7).
- **Result currency (S2)** — **coins everywhere** (fix every "points" string). The per-question result overlay
  (§12) and the end-of-game summary (§13) are win/loss variants of the same idea — keep both, unify to coins.
- **Per-question controls (M2/M3)** — **question-display duration → Moderator** (a default + pick from ~4
  preset times); **minimum wager per question → Host**; **composer Delete = real.** Placement decided; the
  controls have **no Figma frame → designers will create them** (🧱 below).
- **Send contact in chat (I4)** — **out of scope.** Chat is 1:1; you do not forward a contact. **Links ARE
  allowed.** Drop the "Contacts for sending / Sending contact details" frames.
- **Live broadcast delay (H3)** — it is the **DVR/HLS delay to the viewer only** (§7.3).
- **Host Pause/Resume (H4)** — **no manual control.** Pause is **automatic** when the moderator opens a question
  (freezes the broadcast for **viewers only**) and **auto-resumes from the frozen point** when the question
  timer ends (= the DVR behaviour, §7.3). Remove the "Pause/Resume" control expectation.
- **Additional-player QR + screens (C3/C2)** — **QR scan to join = close-up players only.** Close-up and remote
  player screens are **distinct**; the **remote** practice+live frames are missing → **designers will add** (🧱).
  Exact self-preview placement in the remote grid comes with those frames.
- **Birthday gate (R3)** — the DOB popup **re-prompts on every app entry until a DOB is saved** (no silent skip).
- **Invitation popup — X button (2026-06-29)** — closing the invitation popup via the **X button = Rejected** (not just dismissed). Treat it identically to pressing the explicit "Decline/Reject" action.
- **Speaker / mute controls (2026-06-29)** — **Player** has one speaker control: **self-mute only**. **Host** has two options: (1) **self-mute** + (2) **mute players**. ⚠️ Partial answer: whether the speaker icon also acts as an **active-speaker indicator** (lights up when someone is talking) was not explicitly confirmed — see open item below.
- **Pending-questions counter (V2)** — **moderator only** (viewers do not get the corner count).
- **Viewer exit/return (V3)** — phone **Back exits to Home**, not back into the same stream; from Home the viewer
  sees active streams (the reduced feed/suggested algorithm) and can re-enter **any stream still live**.
- **Moderator leaves mid-question (#38)** — the next moderator does **not** answer the pending questions:
  **open wagers are refunded to the bettors and the new moderator re-asks** (per אפיון).
- **Single player + moderator (#55)** — **exactly per the אפיון** (keep the specified split; no equal-split rule).
- **Share targets** — **final = Instagram · X · WhatsApp · Facebook · Link · Email** (Figma set; no Telegram).
- **Suggested accounts** — **in scope; use the reduced algorithm** (same surfacing as the Home feed).
- **Profile QR** — **confirmed removed** from profile / add-friends.
- **Rubik font** — **confirmed: must be loaded** in the build (declared in design.js; loading task stands —
  [[project-rubik-font-loading]]).
- **Chat-request approval (S1)** — **in scope:** a non-friend's first message needs the **recipient's
  approval**; the precise UI (incl. "delete") comes from the designers later.
- **Report/block states (I6)** — **in scope; designers will detail** the exact states.
- **Colors / design.js** — **no new tokens.** Only colors that already appear are used; **nothing added.** (The
  dark broadcast-bg hex was not provided → still pending, see open items.)
- **Copy/branding sweep** — **approved** ("Game World"→HyPulse, moderator-naming, invite-verb, coins↔points,
  typos). To be executed in a **separate dedicated session.**

---

## ⏳ Still pending (after the Zoom — see [DESIGNER-QUESTIONS.md](DESIGNER-QUESTIONS.md))

**🧱 Awaiting updated screens from the designers ("ממתין למסכים"):**
- **C2** — remote additional-player frames (practice + live with player controls).
- **H1** — 50-followers gate screen.
- **M2/M3** — moderator question-duration picker ✅ **values decided 2026-07-05: chips, 15/30/45/60 s, default 45** · host min-wager field · composer **Delete** — frame still needed from designers.
- **I2** — new System-Alert types (designers adding — consolidated missing list in DESIGNER-QUESTIONS.md §1).
- **I6** — precise report/block states (block step-2 confirm · post-block disabled input · 2-reporter alert · image-retry).
- **S1** — chat-request approval UI detail.
- **Coin-bank onboarding** — 3 first-run screens (pending Sara's confirmation of what they are).

**❓ Open questions (need an answer / clarification):**
- **I1** — New-Followers row buttons (Follow/Removal/date/go-to-chat) — Sara corresponding separately; interim = follow Figma.
- **C7** — per-gift coin value (deferred; changes with the animations).
- **I3** — game-name on a gift row (Sara: "what's missing?" — re-explain).
- **I5** — ✅ **decided 2026-07-05: emoji picker = YES; status = sent + delivered only; read receipt = out of scope.**
- **V1** — viewer full participant list ("participants of *what*?" — re-clarify).
- **Full name vs username** — Sara leans username-only ("not in Figma"), **but the edit-profile Figma frames DO
  show a Full Name field** → reconcile.
- **Profile roles/personas/schedule (pp.28–31)** — Sara: "what is this?" — re-explain; out-of-scope until defined.
- **Dark broadcast-bg hex** — not provided; needed before adding to design.js.

---

## 📝 Changelog

### 2026-06-29 — Designer answers: invitation popup X + mute controls
- **Invitation popup X = Rejected** (not dismiss) — confirmed by מאפיינות; added to Zoom decisions block.
- **Mute controls** — Player: self-mute only. Host: self-mute + mute players. **Still open:** does the speaker icon also indicate "currently speaking" visually? Added to DESIGNER-QUESTIONS.md.

### 2026-06-23 — Zoom decisions embedded
- **DECISIONS.md:** added the **Zoom decisions (Z)** locked block (C5, S2, M2/M3, I4, H3, H4, C2/C3, R3, V2,
  V3, #38, #55, share-list, suggested-accounts, profile-QR, Rubik, S1, I6, colors, copy-sweep); rewrote
  **Still pending** into 🧱 Needs-design vs ❓ Open-questions; flipped the source-of-truth note to "Confirmed at the Zoom".
- **DEEP-DIVE.md:** added a top **ZOOM RESOLUTIONS (2026-06-23)** block that supersedes the old pending list
  (each code → Decided / 🧱 Needs design / ❓ open); marked the legacy "Pending designer questions" list and the
  "Still open — Sara checking" section as superseded.
- **SPEC.md:** folded behaviours — §4.3 birthday re-prompt (R3); §6.1 no manual Pause/Resume → auto (H4) +
  50-followers gate has no frame (H1); §6.2 QR=close-up only (C3) + remote frames pending (C2), C1/C4 resolved;
  §6.3 wager = drag-icon (C5), coins everywhere (S2), pending-Q counter moderator-only (V2), Back→Home (V3);
  §6.4 composer Delete real + duration→moderator/min-wager→host (M2/M3) + moderator-leave refund (#38);
  §7.3 the host "pause" is automatic/viewer-only (H4); §10.1 username-vs-fullname conflict; §10.2 I1/I2/I4;
  §10.3 chat-request approval (S1) + I5; §10.5 report/block states (I6); §10.6 share-list final + suggested
  accounts; §17 reorganised into Closed-at-Zoom vs Still-open.
- **DESIGNER-QUESTIONS.md:** trimmed to remaining-open-only; added the **consolidated missing-system-alerts
  list (I2)** for the designers to build from.
- **design.js:** **no change** — "only colors that appear, nothing added"; dark broadcast-bg hex still pending.
