# HyPulse — Final Decisions Log (what's CLOSED)

> The counterpart to [DESIGNER-QUESTIONS.md](DESIGNER-QUESTIONS.md) (open items). This = **decisions already
> made** (don't re-litigate). The **per-screen analysis** itself is in
> [DEEP-DIVE.md → `## Findings`](../../notes/DEEP-DIVE.md) (Sections 1–15, one block per area).
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
- In-app **Audience Control 18+** toggle **and** store gambling rating coexist (not a conflict).
- **✅ Minimum signup age = 18 (Erez/Sara 2026-08-11; raised from 17).** **Coins are never withdrawable to real
  money** → play-money / social-casino model, **no KYC**. Under-18 DOB → neutral terminal block screen. SPEC §4.3.

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
  ⚠️ **SUPERSEDED 2026-07-27 (D-17):** the **end-of-game summary (§13) is dropped** — game end → straight to
  feed, no popup. Only the per-question overlay (§12) survives. See SPEC §6.3.
- **Per-question controls (M2/M3)** — **question-display duration → Moderator** (a default + pick from ~4
  preset times); **minimum wager per question → Host**; **composer Delete = real.** Placement decided; the
  controls have **no Figma frame → designers will create them** (🧱 below).
- **Send contact in chat (I4)** — **out of scope.** Chat is 1:1; you do not forward a contact. **Links ARE
  allowed.** Drop the "Contacts for sending / Sending contact details" frames.
- **Live broadcast delay (H3)** — ~~it is the **DVR/HLS delay to the viewer only** (§7.3).~~ 🔴 **SUPERSEDED by Erez 2026-08-10 (H-2):** the `Live broadcast delay` toggle = the **creator-away hold screen** (§6.3) with a **120s ×2** timeout, **not** a DVR delay. The per-question DVR freeze (§7.3) remains a separate mechanism. See changelog 2026-08-10.
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

### Architecture — stream socket plane & mute enforcement (TL, 2026-07-27)
> Resolves FINDINGS.md stopping-table **D-01 + D-02**. Full brief: [D-01 brief](../../notes/D-01-stream-socket-decision-brief.md).

- **D-01 — stream socket ownership = "the client is the bridge."**
  - **Video:** `STREAM.*` (JOIN/CONSUME/RESUME) go **only** on the media socket (`emitMediaPromise`); handlers live only on the media-server. ✅ already in code (SCRUM-239 / PR #203, merged).
  - **Questions to the viewer = STREAM-ROOM (SCRUM-230), NOT the game room.** The viewer joins the **`streamId`** room on the app io, and questions fan out to `io.to(streamId)`. Verified reason: the `gameId` room also carries `ECONOMY.EVENT` / `ROOM_UPDATE` / `LEADERBOARD_UPDATED` (`socketHelpers.js:130,157`, `game.handler.js:85`) — dumping viewers there is a load + data-scoping leak. Consistent with the prior "viewer stream-scoped by design" decision.
  - ⇒ **SCRUM-230 is NOT superseded — it IS the chosen path.** Needs: conflict resolution + ownership verification (Jira assignee=riky, real touchers = Devoiry/Elisheva).
  - **No Redis / shared adapter.** Both io servers stay single-instance; the client bridges the two planes. **Redis is post-MVP**, triggered only when the app-server goes multi-instance (launch viewer concurrency).
- **D-02 — mute enforcement = server-authoritative, via a direct app→media call.**
  - Model **B (server-authoritative):** the media-server force-pauses the target producer, **bypassing** the owner-check (`stream.handler.js:369`) because the caller is the trusted app-server — matching the standard KICK already meets (`socketsLeave`, app io). **NOT** self-enforced (a modified client would ignore `MUTED`).
  - Mechanism **(i) direct server→server call** (internal authenticated endpoint / privileged socket), **not Redis**.
  - **Timing: a separate phase AFTER the video is closed** (M4-05/10/11 + questions-plane first). SCRUM-164/242 stay blocked until then; **D-02 is NOT closed as "derived from D-01."**
- **Condition carried:** SCRUM-286 (reconnect room-rejoin) is a **requirement**, not a nicety — the client-bridge dies silently on reconnect without it. Needs an owner.

### Process — merge gates (TL, 2026-07-27)
> Resolves FINDINGS.md stopping-table **D-03**.

- **D-03 — "no merge without a consumer" = a BLOCKING gate (option A), with an escape hatch.** CHECKLIST.md §9 is now a ⛔ blocking reviewer gate: every new socket-event / hook / util / slice / endpoint / service must name a **real** consumer (file:line that imports / listens / dispatches / selects it). **A test is not a consumer; a mock/`MOCK_*` fallback is not a consumer.**
  - **Escape hatch (infra-first is allowed):** only if **both** (a) a linked consumer ticket (SCRUM-XXX) where the reader will be built, **and** (b) the surface is **visibly marked non-live** (Demo banner / `_dev`/`_test` / behind a flag). This is what the host wizard already does (M3-01 "Demo" marker) — and it pre-frames **D-04**.
  - Optional cheap add-on (not required): a narrow CI check for the mechanically-detectable sub-cases (a `SOCKET_EVENTS.X` never `.on()`'d; a selector never imported).
- **D-04 — mock in a production path = a BLOCKING CI gate (option A + escape hatch).** Fabricated/placeholder code (returns fake data instead of the real call) must not merge into production source. Enforced by a **grep-based CI guard** (`.github/scripts/check-no-prod-mocks.sh` + `.github/workflows/pr-no-prod-mocks-guard.yml`) — grep, not ESLint, because CI ESLint doesn't cover `packages/client` where most mock lives.
  - **Fails on:** (1) `remove before pushing/commit` comments (a forgotten-temp smell — always); (2) `mock`/`MOCK_` **identifiers** in `packages/*/src` (excluding `_dev/`, tests, `*_test.js`).
  - **Escape hatch (= D-03's):** a deliberate placeholder is allowed only if tagged `mock-allowed: SCRUM-<num>` **and** visibly marked Demo. `_dev/` is the free zone.
  - **Coverage limit (stated, not hidden):** the grep catches *named* mock; it does NOT catch disguised placeholders (hardcoded values under a `// PROD` comment, e.g. M5-07 PlayerScreen) — those are caught by the D-03 consumer gate + human review.
  - **Enact order:** clean the existing sites (below) → then turn the guard on. Do not merge the guard to `main` before the tree is clean, or CI goes red immediately.
  - **Existing sites to clear (verified on `origin/main` 27.7):**

| Site | Finding | Disposition |
|---|---|---|
| `AddQuestionForm.js` (`mockSubmitQuestion`/`mockSaveDraft`) | M6-03 🔴 data loss | **SCRUM-310** (opened 27.7) — wire real `POST /api/questions` (submit: verify `timeLimit` field) + real draft (`isDraft:true`) + drop the mock. |
| `DraftQuestionsList.js` (`MOCK_QUESTIONS`) | M6-04 | Wire to a real consumer, or move fallback to `_dev/`; if it stays a placeholder → tag + Demo. |
| `WatchersList.js` (`MOCK_LISTS`) | M7-03 | Same — wire to the slice or `_dev/` + tag. |
| `mockUsers.js` + `UserPickerStep.js` import | M3-01 (already "Demo") | Legit placeholder (no user-search API yet) → **tag `mock-allowed: SCRUM-<num>`** + keep the Demo banner. Don't delete. |
| `LoginScreen.js:81-82` | (dead commented mock FB token) | Remove the dead commented block. |
| `PlayerScreen.js` `// PROD` mock tiles | M5-07 | In **SCRUM-224** scope; guard won't catch it (not named mock) — D-03 + 224 handle it. |

- **D-05 — `screens/GameScreen.js` = move to `_dev/`, not split, not freeze.** Verified 27.7: the file is **orphaned** (0 importers; the `app/game_screen.js` route is a separate file) — the "active writing" premise was wrong, so there's no split-vs-freeze dilemma. But it is the **sole** implementation of `resolve` (`/questions/:id/resolve`), `gift` (`/economy/gifts/send`) and real betting (`/user-answers/submit`) — the role screens haven't re-implemented these.
  - **Action:** move to `_dev/GameScreen.reference.js` (orphaned → safe; removes a 1137-line "looks-like-prod" file and 46% of the project's hex from prod paths — M12-01).
  - **Deletion gate (delete the reference only once ALL close):** **SCRUM-310** (M6-03 — real question submit) · **SCRUM-189 + A4b** (moderator Resolve UI + Devoiry wires the destructive action) · **SCRUM-232** (viewer betting) · **a gift ticket — which does NOT exist yet** (gift has no migration ticket → GameScreen is the only gift impl; flag before deletion). Also `SCRUM-183` (WINNER_TAKES_ALL resolve server bug) is in this area.
  - M5-03 / M12-01 corrected in FINDINGS (orphaned; hex count inflated by dead code).

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

### 2026-08-11 — Erez/Sara escalation answers (age, cash-out, chat, Facebook owner)
- **Minimum age = 18** (raised from the 2026-07-28 "17"). Under-18 → neutral terminal block. SPEC §4.3.
- **Cash-out = never** — coins are not withdrawable to real money → play-money / social-casino, **no KYC**. Resolves the cash-out escalation.
- **Private 1:1 chat = definitively in scope** ("obviously it exists") — the old "beta vs deferred" escalation is closed; only the build gap (M9-02..06) remains, not a scope question.
- **Facebook App-Review blocker is NOT an Erez question** — it waits for **Moshe** (domain owner) to return; Sara will check with him. Don't design the Facebook screens until then.
- **Designer answers (Sara), several were already decided elsewhere — now synced:** min-wager field + composer Delete **already exist** (were stale-listed as missing) · **host/player end-of-game popup = none** (only viewer has one) · **image cropping = two-step** (rectangle = crop/reposition, circle = saved shape) · **feed overlay = host avatar + name + "Tap to switch to live game" only** · **feed next item = live video** (blur was just Netfree) · **feed order = simplistic personalized algo** (follow / clicked / bet-on-highest; exact spec to come from Sara) · **Instagram fully dropped** (login and share) · **`Partner` = "Share"** mistranslation.
- ⚠️ **Two labels Sara says were decided are NOT in any doc** — `Under monitoring by` and `4 Live Feed`: no recorded decision found; need the actual ruling to record it.

### 2026-08-10 — Erez (ר"צ) escalation rulings (folded into SPEC)
> Full per-item table at the top of [DESIGNER-QUESTIONS.md](DESIGNER-QUESTIONS.md).
- **AU-Auth-1** — the 1,000-coin incentive is **NOT** shown in the registration popup; only inside the Coin Bank on first open (B-5). SPEC §4.2/§9. *(Supersedes the earlier §4.2 "incentive on the popup" and the DESIGNER-BRIEF recommendation.)*
- **B-2** — usage-history list = **gifts only** (no wagers/winnings). SPEC §9. *(Header numbers 3,300/2580 still unlabeled.)*
- **B-4** — package prices governed from **backoffice, percentage-based**; the **actual price ladder to be provided by Erez** → still blocks SKU registration (D-20).
- **PL-2** — the player's 3rd bottom-bar icon = **mute-status indicator (red = muted)**, not a control (C1 stands). SPEC §6.2.
- **PL-4** — "not-yet-live" tile = a waiting tile; **enhance with animation + caption**; final caption still pending.
- **CAM-2** — broadcast cap = **Host+3, host-approval-gated, no entry beyond** (popup "others invited"); **camera-off = leave-game** (players only mute). ✅ **camera/mic consent = an in-app approval popup granting PERMANENT app permission** (not per-session). 🔴 still conflicts with the code's unlimited-join model (reconcile). Open: close-up camera switching. SPEC §6.2.
- **H-2** — `Live broadcast delay` = **creator-away hold screen + 120s ×2 timeout**, viewer gets no message. 🔴 **Supersedes the Zoom H3 reading** (DVR-delay-to-viewer). SPEC §6.1/§6.3.
- **CAM-6 + M1-4** — **no "kick".** Broadcast-report escalation: host popup "violated policy → under report"; at 5 → "under monitoring" + staff review; violation confirmed → **game closed**, and on severe closure **all participants incl. viewers** get a "severe violation, broadcast closed" notice; 3 such broadcasts → **1-week account ban**; chat report = report-only. SPEC §10.5.
- **MR-1** — `Viewing options` is **host-only**, not in the moderator panel. SPEC §6.4.
- 🔴 **Question-publish viewer gate — CONFIRMED 50 → 1 (Erez, "significant"):** the moderator may publish a question with **≥1 live viewer**, not 50. **Reverses the locked CU-2 / 50-viewer decision.** Code: change `MIN_VIEWERS_FOR_MODERATOR` 50→1 and add the gate on the publish path. SPEC §7.4.
- **Viewer-question author reward** — **fixed amount, on publish, published-only, no cap**; 🔴 **the fixed value is still missing** ("what amount?") → blocks SCRUM-263. SPEC §8.
- **VW-3** — Cancel window = **5s** (gift + question-suggestion); **answer locks 3s before the timer ends**; gift catalog still "to be provided". SPEC §6.3/§8.
- **VW-4a** — Suggested accounts = **any user**, personalized per viewer (follow-back / co-participation / in-app connection). SPEC §17.
- **I-Inbox-1** — mute-notifications = per-conversation, binary (until toggled back), messages still shown, **+ muted icon**. SPEC §10.3.
- **AD-6** — unblock is **via backoffice, no in-app frame**; support inquiries also via backoffice. SPEC §10.5.
- 🔴 **Three rulings that overturn prior/locked assumptions — now decided, remaining work is code reconciliation:** the 50→1 viewer gate (confirmed "significant"), H-2 vs the DVR interpretation, and CAM-2 vs the unlimited-join code model.

### 2026-07-28 — Designer answers: feed overlay, RTL buttons, bio limit (+ camera-slot mechanism documented)
- **UR-Feed-1** — the feed-overlay name/avatar = **the Host** (not the moderator). Rest of the overlay content (viewer count / title / game type / Follow) still open.
- **P-7 (RTL buttons)** — one rule: **primary action (Confirm/Update) on the END side, Cancel on the START side** → EN: Confirm-right/Cancel-left · HE: mirrored (Confirm-left/Cancel-right). Implement via a fixed logical order `[Cancel, Confirm]` + automatic RTL mirroring, not per-language right/left.
- **P-1 (bio limit)** — designer delegated to Claude: **150 chars + live `N/150` counter + hard input-cap at the limit** (Instagram convention; fits the 3.1 auto-grow mockup; the annotation's 80 = TikTok, too tight; 80↔230 gap = filler text, not spec). No silent truncation. 🔧 `bio` still absent from the `User` model (M2-03).
- **CU-CAM (camera-slot mechanism)** — documented how capture/release actually works in `stream.handler.js` (slot taken on PRODUCE, `MAX_ACTIVE_PLAYERS=4` **counts the host** → 3 players max; only `ROOM_FULL` error exists; freed slot = **implicit race, no notify**). **Still open:** CAM-1 (enumerate 4 error messages + reconcile the 4-vs-5 / host-counted cap) and CAM-3 (freed-slot policy: race vs notify/queue). See DESIGNER-QUESTIONS.md §2ג → CU-CAM.

### 2026-07-27 — Architecture: D-01 (stream socket) + D-02 (mute) locked
- **D-01** — "client is the bridge": video `STREAM.*` on the media socket (SCRUM-239, merged); viewer questions via **STREAM-ROOM (SCRUM-230, `streamId` room)**, not the game room (verified `gameId`-room data-scoping leak). SCRUM-230 = the path, not superseded. **No Redis** (post-MVP, multi-instance trigger only).
- **D-02** — mute = **server-authoritative** via a **direct app→media call** (bypass owner-check server-side), not self-enforce, not Redis. **Separate phase after video**; not derived from D-01. SCRUM-286 (reconnect rejoin) is a carried **requirement**.
- Full detail in the "Architecture — stream socket plane & mute enforcement" block above; FINDINGS.md stopping table D-01/D-02 → הוכרע.
- **D-03** — "no merge without a consumer" = **blocking gate** (CHECKLIST.md §9 hardened to ⛔) with an escape hatch (linked consumer ticket + visible Demo/`_dev` marker). Test/mock ≠ consumer. See "Process — merge gates" block.
- **D-04** — mock in a prod path = **blocking CI gate** via `.github/scripts/check-no-prod-mocks.sh` + `pr-no-prod-mocks-guard.yml` (grep, not ESLint — client isn't in CI lint). Escape hatch = `mock-allowed: SCRUM-<num>` tag + Demo. Enact order: clean 4 existing sites → turn guard on. See "Process — merge gates" block for the cleanup table.
- **D-05** — `screens/GameScreen.js` is **orphaned** (premise "active writing" was wrong) but the **sole** impl of resolve/gift/betting → **move to `_dev/GameScreen.reference.js`**; delete only after SCRUM-310 (M6-03) + SCRUM-189/A4b + SCRUM-232 + a (missing) gift ticket close. See "Process — merge gates" block.

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
