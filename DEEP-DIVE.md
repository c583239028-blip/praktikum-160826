# HyPulse — Per-Screen Figma Deep-Dive (working tracker)

> Companion to [SPEC.md](SPEC.md) (behavior) and [FIGMA-SCREENS.md](FIGMA-SCREENS.md) (screen index).
> Goal: go **screen by screen** through `screens for dev`, compare each frame to the spec, and record exact
> gaps so the build is grounded. Started 2026-06-18.

## ▶ NEW-CHAT HANDOFF (read this first)

> ⚠️ **SOURCE-OF-TRUTH INVERSION (designers, 2026-06-23):** the **מאפיינות say FIGMA is the source of truth, not
> the אפיון.** Ranking: **Figma = canonical for screens / visual / layout / flow**; the **אפיון is secondary**
> (behaviour & copy intent only where Figma is silent). **Figma is NOT canonical for its defects** — Stripe
> (overridden to IAP), mistranslations, and **missing screens** don't become "the spec." 
>
> ✅ **ZOOM HELD (2026-06-23) — the pending verdicts are now decided.** See the **ZOOM RESOLUTIONS** block
> immediately below; the locked summary lives in [docs/screen-specs/DECISIONS.md](docs/screen-specs/DECISIONS.md).
> Where Figma won, the אפיון-only feature was **dropped** (C5 points-picker); where a real feature has no frame,
> it is flagged **🧱 Needs design — "ממתין למסכים"** (designers are adding the screens).

### ✅ ZOOM RESOLUTIONS (2026-06-23) — supersedes the pending list below
> Each code is now **Decided** or **🧱 Needs design (ממתין למסכים)**. The per-item analysis further down is kept
> for context but is no longer "open" unless listed in **Still genuinely open** at the end of this block.
- **C5** ✅ — wager = **drag the matching icon from the Currency Bank onto the answer** (Figma mechanic wins).
  **The 3-random-points picker is DROPPED** (no frame). Icons/images may later swap to animations (with C7).
- **C3 / C2** ✅/🧱 — **QR scan to join = close-up players only.** Close-up vs remote player screens are distinct;
  the **remote** player practice+live frames are **🧱 Needs design** (designers adding). Self-preview placement
  in the grid resolves with those frames.
- **C1** ✅ — stays as the אפיון verdict (mic-toggle = Settings only); not contested at the Zoom.
- **C4** ✅ — stays (camera-off tile = profile picture).
- **C7** ❓ open — per-gift coin value **deferred** (will change alongside the animations).
- **M2/M3** ✅ placement / 🧱 frames — **question-display duration → Moderator** (default + pick from ~4 presets);
  **minimum wager → Host**; **composer Delete = real.** No Figma frame → **🧱 designers will create** the controls.
- **M1** ✅ — "Substitute Host Booking/reserve" = **Invite / replace a moderator** (copy fix, part of the sweep).
- **H1** 🧱 — **50-followers gate** is real but has no frame → **designers adding.** (Description-field gap already
  dropped — אפיון create flow is name-only.)
- **H3** ✅ — "Live broadcast delay" = the **DVR/HLS delay to the viewer only** (§7.3). 18+ toggle stays (coexists with store 17+).
- **H4** ✅ — **no manual Pause/Resume.** Pause is **automatic on question-open (viewers only)** and auto-resumes
  from the frozen point when the timer ends (= DVR §7.3). The Figma "no Pause button" is correct.
- **H5** ✅ — single host stands (no co-hosts); "Request additional hosts" = mislabeled moderator-invite (H2).
- **S2** ✅ — **coins everywhere.** §12 per-question overlay + §13 end summary = win/loss variants of one idea;
  keep both, unify currency to coins.
- **S1** ✅ in scope — non-friend's first message needs the **recipient's approval**; UI detail from designers (🧱).
- **I1** ❓ open — New-Followers buttons: **follow Figma in the interim**; Sara corresponding separately, may escalate.
- **I2** 🧱 — System-Alerts is **incomplete**; **designers are ADDING alert types** (e.g. "you were blocked / reported
  N times" to the host). Consolidated missing-alerts list → [DESIGNER-QUESTIONS.md](docs/screen-specs/DESIGNER-QUESTIONS.md) §1.
- **I3** ❓ open — game-name on a gift row: Sara "what's missing?" → re-explain.
- **I4** ✅ — **out of scope.** Chat is 1:1, no contact-forwarding; **links allowed.** Drop the send-contact frames.
- **I5** ❓ open — emoji picker + message status: designers queried.
- **I6** 🧱 — report/block precise states: **in scope, designers detailing** (block step-2, post-block input, 2-reporter alert, image-retry).
- **R3** ✅ — birthday gate **re-prompts every entry until a DOB is saved** (no silent skip).
- **V1** ❓ open — viewer full participant list ("participants of *what*?") → re-clarify.
- **V2** ✅ — pending-questions counter = **moderator only**.
- **V3** ✅ — phone **Back → Home** (not the same stream); re-enter any still-live stream from the feed (reduced algorithm).
- **#38** ✅ — moderator leaves mid-question: **wagers refunded, new moderator re-asks** (not "answer the pending").
- **#55** ✅ — single player + moderator: **exactly per the אפיון** (no special equal-split).
- **Share** ✅ — final = **IG · X · WhatsApp · FB · Link · Email** (no Telegram). **Suggested accounts** ✅ in scope
  (reduced algorithm). **Profile QR** ✅ removed. **Rubik** ✅ must be loaded.
- **Colors** ✅ — **no new design.js tokens** ("only colors that appear, nothing added"). **Dark broadcast-bg hex
  still not provided** (open). **Copy/branding sweep** ✅ approved → separate session.

**Still genuinely open after the Zoom:** C7 (gift values) · I1 (followers buttons) · I3 (gift game-name) ·
I5 (emoji/msg-status) · V1 (viewer participant list) · full-name-vs-username (Figma edit-profile *has* a Full
Name field — conflicts with "not in Figma") · profile personas/schedule pp.28–31 (re-explain, OOS until defined) ·
dark-bg hex · coin-bank 3 onboarding screens (re-explain).

**Sources of truth (ranked — updated 2026-06-23):**
1. 🥇 **Figma** (`screens for dev`) — canonical for **screens/visual/flow** (designers' ruling). Bugs/missing
   screens excluded.
2. ⭐ **`אפיון אפליקציה.pdf`** — secondary; the **detailed behaviour/copy** reference where Figma is silent. Sections:
   צופה (viewer) · שחקן מארח (host) · שחקן נוסף (additional player, pp.41–45) · מנחה (moderator) · פרופיל ·
   דואר נכנס (inbox) · בנק מטבעות (coin bank). ⚠️ **NOT in the repo** — Sara attaches it per chat; **ask for it
   first.** It's the most detailed source, **but when it conflicts with Figma do NOT auto-resolve — surface the
   conflict and verify with the designers (מאפיינות).**
2. `SPEC.md` — condensed English behavior spec (a **derivative** of the אפיון; can lag it).
3. `FIGMA-SCREENS.md` — screen index (node IDs + numbers) · this file — per-screen findings ·
   `docs/screen-specs/` — ticket specs.

**Workflow:** Sara exports frames → `.figma-shots/<section>/` → Claude reads them (automated Figma reads are
blocked: API quota + Netfree). **For each screen: compare Figma ↔ אפיון ↔ SPEC.md, log conflicts here.**

**Done:** Profile ✅ · Viewer-Remote ✅ · Additional Player ✅ (re-verified vs אפיון pp.41–45, 2026-06-19) ·
Viewer Close-up ✅ · Moderator (Close-up + Remote) ✅ · Home/Feed ✅ · Host (Close-up + Remote) ✅ ·
**Coin bank ✅ (reviewed 2026-06-22 — balance/main, package grid, payment sheet, quantity stepper, success,
transactions + range picker, usage history, empty states; see findings + 🔴 B1 Stripe below).** ·
**Inbox ✅ (reviewed 2026-06-23 — main+3 categories, private chat, media/voice send, send-contact, report/block,
profile-from-chat, find-friends/share, permissions; I1–I6; label pass still owed).** ·
**System Messages · In-stream Animation · Registration · Birthday ✅ (reviewed 2026-06-23; S1/S2/R1/R2/R3).**
**🏁 ALL 15 SECTIONS REVIEWED.** **Next:** consolidate the full **C/M/H/B/I/S/R series + open decisions** into one
PM/designer list (esp. 🔴 B1 Stripe). Re-check the pending designer questions + the grid epic below.

### ⛔ Pending designer questions (block builds)
> ⚠️ **SUPERSEDED by the ZOOM RESOLUTIONS block above (2026-06-23).** Kept for the per-item analysis only —
> the *status* of each item is now in that block (Decided / 🧱 Needs design / ❓ open), not here.
- **C1** — mic-toggle placement (additional player close-up): אפיון p.43 = Settings only; Figma = on-screen.
- **C2** 🔴 — **no remote additional-player frames in Figma** (practice + live with player controls).
- **C3** — self-preview placement in the 2×2 grid (tile vs separate PIP).
- **C4** — camera-off tile = profile pic (אפיון p.12) vs circle-slash placeholder (Figma).
- **C5** 🔴 — **viewer answer-with-wager currency.** Figma (`1000217811/812`) shows the **Currency Bank gift grid**
  (פרח 800 / גלידה 500 / לב 300 …) docked under the question, and a gift dragged onto the chosen answer — i.e.
  you appear to **wager by dragging a gift item** onto an answer. אפיון §4 says answering = bet a **number of
  points** from **3 random point options**, each labelled with its **potential winnings (+25%)**. Reconcile:
  is the wager a point amount or a gift item? where are the 3 random amounts + the per-amount payout label?
- ~~**C6**~~ ✅ **RESOLVED (2026-06-21):** the central **🚫 glyph** is just the **video-region placeholder in the
  static mockups** — it appears in the exact spot the live video renders, across Feed cards, Viewer **and**
  Moderator frames (incl. the empty feed card in `feed/01`). **Not a shippable element** — render the stream
  there. (Same resolution applies to **M4**.) Low-confidence items can still confirm with the designer, but treat
  as a placeholder.
- **C7** — gift-value inconsistency: gift cards read e.g. **"גלידה 500"** but the send toast says
  **"…gift worth 100 coins…"** (`14/15`). Confirm canonical per-gift coin price.
- **M1** 🔴 — **"Substitute Host Booking" / "reserve"** is the **moderator-replacement** flow (אפיון "החלפת מנחה")
  but labelled **Host** + verb "reserve"/"Booking" (mistranslated הזמנה). Appears as a pre-live settings row **and**
  the picker title. Confirm naming → "Invite a moderator" / "Invite".
- **M2** 🔴 — **moderator pre-live settings mismatch.** אפיון (מסך הגדרות לפני שידור) = mute speaker · camera off ·
  **question-display duration** · **minimum points to wager on a question** · mute players. Figma `settings` =
  Video Quality · Substitute Host Booking · **Viewing options (followers-only)** · Camera off · Mute Microphone ·
  Mute Players · **Player Details Display**. → **missing** the question-duration + min-wager controls; **added**
  quality/followers-only/player-details. Where do answer-time + min-wager live (pre-live vs per-question)?
- **M3** — **composer action bar + the missing answer-time / min-wager controls.** אפיון = Publish / Save draft /
  **Delete** + per-question advanced settings (**answer time, min points**, p.16–17) — and **also** lists those two
  as **pre-live** settings (p.15). **Figma shows NEITHER, anywhere** (composer = only "Your question" + Answer
  1/2/3 + "+" + "Draft Saved"/"Advertising"; pre-live settings has no such rows). → Were answer-time + min-wager
  dropped? If kept, where do they live — pre-live or per-question? Also: composer has no **Delete**.
- ~~**M4**~~ ✅ **RESOLVED** — central 🚫 = video-region placeholder in static mockups (see **C6** above).
- **H1** 🔴 — **host create-game flow is missing two SPEC-required pieces:** there is **no description field**
  (only a **Game Name** step) and **no 50-followers gate** screen anywhere in the create→go-live wizard, though
  **SPEC §6.1 / §7.4** require both. → Were they dropped, or do they live elsewhere (e.g. server-side gate with
  no dedicated screen)? Confirm scope + where the gate is surfaced to the host.
- **H2** 🔴 — **moderator-naming chaos across the entire host flow** (same root as **M1**). The *invite-moderator*
  screens are titled **"Game Host Invitation"** (placeholder "Who will host your game?"); the *in-stream*
  moderator sheet is **"Booking facilitators"** with sections **"Active facilitator" / "Hosts you have booked
  before" / "Recommended Guides"**; the management-settings row is **"Hosts — Request additional hosts"**. One
  role (**מנחה / Moderator**) is called host **and** facilitator **and** guide. The summary screen even labels the
  invited moderator **"Name of the host"**. → Standardize everywhere: role = **Moderator**, verb = **Invite**
  (kill "Booking"/"reserve"/"To order"/"booked"/"facilitator"/"guide"/"host" for this flow).
- **H3** — **host in-stream "Game Management Settings"** is a *new, host-only* set distinct from the moderator
  pre-live settings (M2) and not in SPEC. Rows: **Hosts**(→invite mod) · **Players**(→invite players) · **Video
  Quality** · **Live Gifts** (toggle — viewers can send gifts) · **Guide Settings** (toggle — moderator may send
  questions) · **Viewer settings** (toggle — viewers may send questions to host) · **Viewing options**
  (followers-only) · **Camera flip** · **Mute microphone** · **Live broadcast delay** (toggle) · **Audience
  Control** ("only users **18+** can watch") · Settings & Privacy. → Confirm these toggles are in scope + map to
  backend. ⚠️ **"Audience Control 18+" vs SPEC's 17+ store rating** — reconcile the age number. ⚠️ **"Live
  broadcast delay"** — is this the DVR/HLS delay control (§7.3)?
- **H4** — host **live screen shows no explicit Pause/Resume control** that **SPEC §6.1** lists (bottom bar =
  settings · invite-players · invite-moderator only). Where does host Pause/Resume live? Also the practice
  go-live popup's button reads **"Reject"** (should be Cancel/Stay).
- **H5** — **"Hosts → Request additional hosts"** (management settings) implies **co-hosts / multiple hosts per
  stream**. That contradicts the single-`hostId` model + [[project-no-global-host-role]]. → Is multi-host in
  scope, or is this just the mislabeled moderator-invite (H2)?
- **B1** 🔴 — **the payment sheet includes Stripe.** The purchase bottom-sheet (`רכישה בסכום נמוך/גבוה`) offers
  **Apple Pay · Google Play · Stripe** as three selectable methods. This **directly contradicts SPEC §12** (Apple
  IAP + Google Play Billing, **no Stripe**; Stripe code is being removed). It is also **not how native IAP works**
  — the OS owns the purchase sheet, you don't render in-app payment-method radios. **This IS the payment-sheet
  screen FIGMA-SCREENS §7 flagged as "not labeled" — it exists.** → Almost certainly the Figma predates the
  no-Stripe decision: confirm **drop Stripe + the 3-way radio**, and decide what (if anything) the sheet shows
  under store IAP.
- **B2** 🔴 — **transactions are card-based, conflicting with IAP.** Transaction rows show **"Card 1234" +
  "Service fee" + status**; the range picker shows failure reason **"הכרטיס פג תוקף" (card expired)**. SPEC §9
  row = "last-4 of *method*". Under store IAP there are no card numbers / last-4 to surface. → Reconcile what a
  transaction row displays once payments are IAP.
- **B3** 🔴 — **transaction-status copy is mistranslated + incomplete.** **"In treatment"** (= בטיפול) →
  **Pending/Processing**; **"Postponed"** (= נדחה) → **Declined**; **"Returned"** (= הוחזר) → **Refunded**. SPEC
  §9 statuses = Pending / Declined / Refunded / Completed / Cancelled — **Completed & Cancelled never appear** in
  the frames. → Standardize labels + add the missing states.
- **B4** — **range picker conflicts with the 4-month cap.** Picker offers **7 days / 30 days / 3 months /
  6 months / Year back**, but SPEC §9 + `GET /wallet/transactions` cap a range at **≤4 months**. The 6-month and
  year options break that. → Reconcile the allowed ranges.
- **B5** — **pricing is placeholder.** Almost every package reads **₪0.60** regardless of size (40 coins ₪0.60 …
  4800 coins ₪0.60); only 320 shows ₪12. → Need the real per-package price ladder before build. Also confirm
  the **first-run onboarding (3 screens)** + **role-tabbed FAQ** SPEC §9 describes — **neither is in this export**
  (dropped, or just not exported?).
- **I1** 🔴 — **New-Followers row buttons/state.** Figma = **Follow / "Removal"**; אפיון p.33 = **follow-back**
  (if not yet friends) **vs go-to-chat** (if already friends), plus the **exact follow-start date** per row.
  Figma has no date, no go-to-chat variant, and an unexplained **"Removal"** button. → reconcile.
- **I2** 🔴 — **System-Alerts category content mismatch.** Figma shows **"X joined the live broadcast" + Go
  Live** (a social activity alert); אפיון defines System-notifications as **reports / block messages / system
  updates**. → what does this category actually carry, and is "joined live" a separate notification type?
- **I3** — **Live-Gifts row missing the game name** (אפיון row = sender + coins + date + **game name**); also the
  "viewed gift → demotes to a regular message" behaviour can't be seen in a static frame (confirm in build).
- **I4** 🆕 — **send/forward a CONTACT inside chat** ("Contacts for sending" → "Sending contact details") is
  **not in the אפיון Inbox spec** → new scope; confirm in/out.
- **I5** — **private-chat input is missing the emoji picker** (Figma = attach/text/mic only) and **message
  status (sent/delivered/read)** is not shown anywhere; both are אפיון p.33 requirements. → confirm.
- **I6** — **block/report states not fully in frames:** block **step-2 confirm modal**, **post-block
  disabled/hidden input**, **"2 distinct reporters → alert the reporter"**, and edge-cases **image-load-failure +
  retry** / **blocked-user status strip** (אפיון p.34) → confirm the states exist.
- **V1** — viewer **"open full participant list"** (אפיון p.3 "בכל שלב ניתן לפתוח רשימה מלאה") — seen as the
  moderator "Show details", not as a dedicated viewer frame. Sara: same as viewer → **verify w/ designers**.
- **V2** — viewer **"pending questions" corner icon w/ count** (אפיון p.4) — likely the **moderator** pending-Q
  screen (Sara's recollection); **verify w/ designers** whether the viewer also gets a corner count.
- **V3** — viewer **exit/return behaviour** (אפיון p.2): exit = full exit + return via contacts/followers
  mid-stream; phone **Back** = return to the same stream on reopen. Behaviour (no frame) — implement + confirm.
- **S1** — **chat-request approval gate** (System Messages overlay: a non-friend's first DM → Approve/Delete) —
  not in SPEC; ties to Inbox §10.3. Confirm scope.
- **S2** 🔴 — **two competing result-popup designs** + coins-vs-points: §12 "600 points / continue playing" vs
  §13 "won/loss/no-bets coins summary → Full details". Pick one.
- **R1** ✅ **RESOLVED (PM, 2026-06-23) — FINAL: registration = exactly the Figma providers
  (Google · Apple · Facebook · X · Instagram), NO email/password.** Update SPEC §4 (drop email/password; add
  X + Instagram). ⚠️ **Build implication:** X (Twitter) is a native Firebase provider; **Instagram is NOT** a
  Firebase Auth provider → needs custom OAuth (Instagram Basic Display / Facebook Login) — flag for the auth
  ticket, but the **product decision is final.**
- **R2** — Registration modal is **missing the "+1,000 coins" incentive** (SPEC §4.2). Confirm copy.
- **R3** 🔴 — **Birthday gate dismiss must close the app** + re-prompt every entry until DOB set (אפיון p.2);
  Figma popup has a plain X. Confirm enforcement (= the open Q6 timing item).
- (older, still open) add-friends "Suggested accounts" algorithm; Bio character counter.

### ✅ אפיון PDF reconciliation (2026-06-22 — the authoritative PDF was finally provided)
> Until now every section was reviewed against **SPEC.md** (a derivative) + the chat handoff. With the real
> **`אפיון אפליקציה.pdf`** in hand, here is the verdict on each open item. **Page/comment refs are to the PDF.**
> Golden rule still holds (Figma↔אפיון conflicts go to the מאפיינות) — but the אפיון now gives the *intended*
> behaviour, so most of these are no longer "unknown", they're "Figma diverged from a known spec".

**Resolved BY the אפיון (Figma is wrong / incomplete — build per אפיון):**
- **C1** ✅ — mic-toggle is **Settings-only** (p.43: "פתיחת מיקרופון תתאפשר דרך מסך ההגדרות בלבד"). Figma's
  on-screen mic toggle is wrong for the additional player.
- **C4** ✅ — camera-off tile shows the **profile picture** (p.12: "שחקן שמכבה מצלמה רואים את תמונת הפרופיל").
  Not the circle-slash. (Separate from the C6/🚫 placeholder, which is just empty-tile video region.)
- **C5** ✅ **mechanic decided (Figma diverges):** answering = **pick an answer + bet a NUMBER of points**, chosen
  from **3 random point options**, each label showing its **payout (+25%)** (p.4 + comments [16]/[17]:
  "יהיה 3 אופציות של ניקוד באופן רנדומלי"). Figma's "drag a gift onto the answer" is **not** the bet — build the
  3-random-amount picker. Confirm visual with designers, but behaviour is now authoritative.
- **M1** ✅ — the feature is **"החלפת מנחה" = replace the moderator** (pp.16, 20–21). Figma "Substitute Host
  Booking / reserve / Host" is a mistranslation → **Invite / replace a moderator**.
- **M2 + M3** ✅ — **question-display duration + minimum-points-to-wager are real, and live in BOTH places:**
  **pre-live** moderator settings (p.15) **and** per-question **composer advanced settings** (p.17). The composer
  action bar is **Publish / Save draft / Delete** (p.17) — **Delete is real.** Figma shows none of these →
  design gap, not a dropped feature.
- **H1 (50-followers gate)** ✅ — **real** (p.7: "תנאי לעלות לשידור: מינימום 50 שעוקבים"). No Figma screen for it
  → design gap. **⚠️ CORRECTION:** the "missing **description** field" I flagged is **NOT** an אפיון requirement —
  the אפיון create flow is **game *name* only** (pp.7–8); SPEC.md's "name + description" over-specified. **Drop
  the description-gap.**
- **H3 (host management settings)** ✅ — matches אפיון p.10–11 almost 1:1, **including "בקרות קהל (גיל 18 והלאה)"**
  → the **18+** audience-control toggle is intended (distinct from the store **17+** rating; both coexist).
  ("Live broadcast delay" is the one row **not** in the אפיון list → keep as a small open Q.)
- **H4 (Pause/Resume)** ✅ required — **"השהיית המשחק"** is an explicit host action (p.10) and must also be in
  settings ("כל פעולה במסך הראשי זמינה גם בהגדרות"). Missing from the Figma main screen → gap stands.
- **H5** ✅ reframed — there is **no "co-host"/multi-host**. The real feature is **"הפיכת שחקן למנהל"** (promote a
  player to manager in your place — p.11 + comment [37], a *new* update). Figma's "Request additional **hosts**"
  is the mislabeled **moderator-invite (H2)**. Single `hostId` stands.
- **B3** ✅ — canonical statuses are **5**: בטיפול=**Pending** · נדחה=**Declined** · הוחזר=**Refunded** ·
  הושלם/שולם=**Completed** · בוטל=**Cancelled** (pp.38–39). Figma mistranslates ("In treatment"/"Postponed") and
  omits Completed/Cancelled. *(Comment [53]: whether to surface a status at all is still being checked w/ devs.)*
- **B4** ✅ — the **≤4-month** range cap is from the אפיון itself (p.38: "כל טווח מציג עד 4 חודשי עסקאות").
  Figma's 6-month/Year options are wrong.
- **B5 (onboarding/FAQ)** ✅ split — the **3 onboarding screens are required** (p.37) → export/design gap; the
  **role-tabbed FAQ is intentionally DEFERRED** (comment [54]: "בשלב מתקדם... כרגע להוריד") → Figma correctly
  omits it, drop it from scope for now.
- **Moderator behaviours I flagged as "not in any frame"** ✅ all **confirmed real** by the אפיון: moderator
  drop/leave → **sound alert to everyone incl. host** (p.19); moderator swap → **open questions deleted, wagers
  refunded + viewers notified** (p.21); **resolution is dynamic during the game, EXCEPT "who will win" which
  resolves at the end** (comment [39] — answers the dynamic-vs-end question).
- **Older Q6 (birthday gate)** ✅ — fires on the user's **2nd/3rd app entry**; if ignored **the app closes** and
  re-prompts every entry until DOB is set (p.2). **Q8 (player→manager promotion)** ✅ — **in scope** (p.11 /
  comment [37]). **Bio character counter** ✅ — **required** (p.25: "יופיע מספר אותיות שאפשר להכניס") → Figma gap.

**✅ RESOLVED by PM (2026-06-23) — was elevated, now decided:**
- **B1 + B2** ✅ **FINAL: IAP (Apple) + Google Play Billing only. No Stripe, no in-app card sheet.** The אפיון's
  Stripe/saved-card (p.38) and the Figma payment sheet (Apple Pay/Google Play/**Stripe** radios) + card-based
  transaction rows ("Card 1234" / "last-4" / "card expired") are **superseded.** **Build actions:** (1) drop the
  3-method radio sheet — the OS owns the purchase sheet; (2) redraw transaction rows for store IAP (no card
  numbers/last-4 — order id / store / amount / status instead); (3) remove all Stripe code + schema fields per
  SPEC §12. **No longer an open question.**

**Still genuinely open (even the אפיון/designers don't resolve them):**
- **C2** — remote additional-player frames: the **spec exists** (pp.44–45) but **Figma frames are missing**.
- **C7** — per-gift coin value: no canonical number in the אפיון.
- **Share-target list (Q7)** — unsettled *in the אפיון too*: body text includes Instagram (p.5), but comment [19]
  says **drop Instagram + Telegram**; Figma = IG/X/WA/FB/Email/Link (no Telegram). Figma (newer) likely wins —
  confirm.
- **Profile QR (Q1 follow-up)** — the **אפיון wants QR in the profile hamburger** (pp.22, 26) but the designer
  said (2026-06-19) **remove it from profile**; Figma omits it. Designer (newer) wins → אפיון is stale here.
- **Username + full name** — the designer **questions needing both** (comment [42]); still open.
- **Profile roles/personas/schedule (Q9)** — **unclear even to the designers** ("נשמח להסבר... לא דובר לפני כן",
  comments [45]–[49]) → newly-introduced, undefined; treat as out-of-scope until specified.
- **"Suggested accounts" algorithm** — still "בבדיקה מול הפיתוח" (pp.3, 25).
- **H3 "Live broadcast delay"** toggle — not in the אפיון management list; clarify (DVR-related?).
- **Comment [38]** — if a moderator leaves mid-question, must the next moderator answer all the pending ones?
- **Comment [55]** — 1-player + moderator: equal split instead of the +15% premium?

### 🧱 Multi-Camera Grid — unbuilt cross-cutting epic (backlog)
The remote video grid is shared by **viewer + player** and its **foundation is not built**: media server never
emits `stream:new_producer`, `stream:join` returns `producerIds` (no roles) while client refs expect
`currentProducers`/`currentProducerId` (**contract mismatch** → grid stays empty). The sprint plan assumed
this signaling existed in `player_test.js` — it does not. Scope: server (new_producer+roles+cleanup) →
shared `<CameraGrid>` → wire viewer + player. Also blocked on C2 frames. **Not a PlayerScreen-UI task.**

### 🎫 PlayerScreen ticket split (decided 2026-06-19)
- **A2a (Ruti)** — camera-signaling engine (consume → MediaStream + self-preview). ⚠️ depends on the fixed
  server contract above, else consumes nothing.
- **A2b (Sara Volpo)** — **close-up ONLY**: RTCView swap + avatars row (no grid) + entering + practice mode
  (30 s) + cam/mic OFF default + overflow fix + PropTypes/`t()`. Buildable now.
- **Grid (remote)** — pulled into the Multi-Camera Grid epic (backlog), **not** A2b.

### 🐞 Bugs / copy fixes to file (collected across sections)
- i18n: profile stat **"In progress" → "Following"**.
- Placeholder copy: **"Message Title / Lorem ipsum"** (viewer message bubble).
- Host-swap accept button reads **"which"** → "Accept".
- Suggest-question button: **"Send to mentor"** vs **"Send to the host"** vs **"Send to the mendator"** (Close-up
  `763/792–796`, `811`) → pick one (target = Moderator).
- Contacts permission/sync buttons: **"There is approval / No approval"**, **"Approval / Don't Allow"** →
  "Allow / Don't Allow".
- Terminology: **mentor / Mendator / host → Moderator**. **Moderator-section additions (2026-06-21):**
  - Composer **publish** button reads **"Advertising"** (פרסום mistranslated) → **Publish**.
  - Composer draft button **"Draft Saved"** (reads as a status) → action **"Save Draft"**.
  - Viewer-question edit (remote) button **"Which publication"** → **Publish** (same "which" bug as host-swap).
  - Resolve-question button **"Publishing results"** (live-4) → confirm **"Publish results"**.
  - List headers inconsistent: **"Viewer Questions" / "Questions from the viewers" / "Draft Questions"** (the last
    wrongly shown when editing a *viewer* question, remote variant) → standardize.
  - Composer tab **"viewers' questions" / "For viewer questions"** + card title **"Entering a new question" /
    "Typing a new question"** → standardize.
  - Profile-preview stat **"215 in progress"** → **Following** (the recurring i18n bug, confirmed here too).
  - Join popup says **"Join the game as a host"** for a **moderator** invite → "Join as moderator".
  - Drafts list renders a viewer avatar+name (**"Danny Senior"**) on the moderator's **own** drafts → confirm
    drafts should show the author/moderator, not reuse the viewer-question card.
- Branding: **"World Game" → HyPulse** (Privacy Policy + Accessibility footer **+ all 3 host permission popups**
  "Give the **Game World** app permission…"). Confirmed: HyPulse only.
- Nav (already fixed in SPEC §3): **Home / Friends / LIVE / Messages / Profile** (Wallet via hamburger).
  ⚠️ but the host **feed entry** (`3 פיד ראשי`) labels the 4th slot **"Inbox"**, not **"Messages"** — pick one.
- **Host-section copy bugs (2026-06-22):** the **הזמנה (invite) family is mistranslated everywhere** as
  *order / summons / booking / reserve* →
  - Game-type subtitle: **"Remote play" also reads "Play face to face"** (copy-pasted from Close-up) → "Play
    from anywhere / remotely".
  - **"Send a summons"** (invite-players/moderator CTA) → **"Send invitation"**; CTA also appears as
    "Confirm" / "Next" elsewhere → standardize.
  - Toast **"Order sent successfully"** → **"Invitation sent"**.
  - In-stream invite buttons **"To order"** → **"Invite"**.
  - Invite-moderator titles **"Game Host Invitation" / "Game host invitation"** → **"Invite a moderator"**;
    in-stream moderator sheet **"Booking facilitators" / "Active facilitator" / "Hosts you have booked before" /
    "Recommended Guides"** → Moderator wording (see **H2**).
  - Summary row **"Name of the host"** actually shows the **invited moderator** → **"Moderator"**.
  - Header inconsistencies: game-name **"Game Name" / "The name of the game"**; invite-players **"Player
    invitation for the game" / "Inviting players to the game"** → standardize.
  - Search placeholders: **"Search guide" / "Guided Search" / "Player Search" / "Search for a player"** →
    standardize ("Search moderator" / "Search players").
  - Permission-popup buttons: **"Limited access permission / Approval of all / No approval"** (photos);
    **"There is approval / No approval"** (contacts, Facebook) → standardize **"Allow / Don't Allow"** (+limited).
  - Summary share banner typo **"watsapp"** → WhatsApp.
  - Publish: section header **"A passage to be presented"** → "Caption / post text"; share URL placeholder
    **"yourgame.com/live"** → real HyPulse deep link.
  - Publish-success: **"✓ Partner"** (badge on shared networks) → **"✓ Shared"**; **duplicate Instagram card**
    (two "Instagram — Click to share").
  - Practice go-live popup button **"Reject"** → **"Cancel"** (see **H4**).
  - Exit-confirm button **"Exit Approval"** → **"Exit" / "Confirm"**.
  - Player profile-preview: **"215 in progress" → "Following"** (recurring i18n bug, confirmed again);
    following-state button **"Remove Follow" → "Unfollow"**.
- **Coin-bank copy bugs (2026-06-22):**
  - **coins vs points** terminology mixed on one screen: "Choose a **points** package" / "Purchase **points**" /
    "use **coins**" / balance "Total **coins**" / button "Purchase 400 **points**" → pick **coins**.
  - Balance header capitalization **"Total coins amount" / "Total Coins Amount"**; package bonus **"+10 Gift" /
    "+20 gift"**; **"Service fee" / "Service Fee"** + ₪ placement (`28.32 ₪` vs `₪22.10`) → normalize.
  - Payment button typo **"לרכישה בעאל Googel Play"** (Googel → Google).
  - **"Quant ity"** stepper label wraps/truncates → "Quantity".
  - Empty-state for **usage history** reads **"No transactions yet"** (wrong list → "No usage history yet").
  - Transaction **date placeholders incoherent**: range "Feb 17 – May 17 **2020**" but rows dated "April" (no
    year) — use real/coherent dates.
  - Whole section ships **parallel Hebrew(RTL) + English frames** (bank body rows `הסטוריית שימושים`/`עסקאות`
    under English headers) → ensure full i18n, no mixed-language screens.
- **Inbox copy/branding bugs (2026-06-23):**
  - **Facebook+email permission** body branded **"Game World"** ("enhance your experience on **Game World**") →
    **HyPulse** (same family as the host permission popups; contacts/sync popups are already correctly HyPulse).
  - Contacts permission buttons **"There is approval / No approval"** → **"Allow / Don't Allow"** (recurring).
  - New-Followers **"Removal"** button copy unclear (remove-follower?) → clarify/rename (see **I1**).
  - Nav 4th slot here is **"Messages"** ✅ (host feed entry says **"Inbox"** — pick one, already flagged).
  - Frames generically named (`Body`/`Screen Container`/`Main Content Area`/`Chats Container`) → **label pass**
    (FIGMA-SCREENS §9 task #1).
- **System/Animation/Registration/Birthday copy bugs (2026-06-23):**
  - Result popup **"You lossed 600 points"** → "lost" + **coins** (not points) — and reconcile vs the §13 coins
    summary (S2).
  - End-popup frame **`ניטרלי` is actually a LOSS** ("Not this time…") → rename (not "neutral").
  - **Birthday "1000 points"** → coins (points-vs-coins, recurring).
  - **Registration** title/body generic ("you need to register") — add the **+1,000 incentive** copy (R2).
  - Game-paused screen ships **RTL nav under English copy** → full i18n.
  - Placeholder frames `1000212400 2 (…)` (System Messages) are background grids → exclude from the build set.

## Method & current blocker
Automated reads are blocked in this environment:
- **Figma layer JSON** (`get_figma_data`) — API quota exhausted (~4.5-day backoff; low Viewer/Collaborator seat).
- **Figma PNG render** (`download_figma_images`) — **Netfree** content filter intercepts the image bytes.

**Chosen path: local exports.** Sara exports each section's frames from Figma (PNG @2x or screenshots) into
`.figma-shots/<section>/` (git-ignored, local → not filtered by Netfree, no API quota). Claude reads the
images and writes per-screen findings here. We proceed one section at a time ("לאט לאט"), Profile first.

> Filenames: any clear name works; keeping the **screen number** or **node id** in the name (e.g.
> `profile_view_7435-83712.png`) lets Claude map back to FIGMA-SCREENS.md precisely.

## Per-screen finding template
```
### <screen name / number> — <node id>
- Purpose:
- Elements actually in Figma:
- Maps to SPEC §:
- ✅ Matches spec / ⚠️ Gap / ❓ Question for Sara:
- Action (code/spec/design):
```

## Section progress
| # | Section | Node ID | Frames | Status |
|---|---|---|---|---|
| 8 | **Profile** (priority) | `7435:83711` | 22 | ✅ 22/22 reviewed — COMPLETE |
| 1 | Viewer – Close-up | `7014:27847` | 42 | ✅ reviewed 2026-06-21 (main, mod-PIP, gifts, answer/wager, suggest-Q, settings/report, host-swap) |
| 4 | Viewer – Remote | `7097:45650` | 43 | ✅ reviewed (grid, host-swap, gifts, suggest-Q; answer/wager loop → Close-up) |
| 2 | Host – Close-up | `7083:97876` | 40 | ✅ reviewed 2026-06-22 (create wizard, permissions, invite players/mod, summary+QR, share/publish, practice→live, live main, in-stream invites, mgmt settings, alerts, gifts, exit) |
| 3 | Host – Remote | `7277:113768` | 42 | ✅ reviewed 2026-06-22 (same flow + 1–4 player grid, moderator PIP, remote gift view) |
| 5 | Moderator – Close-up | `7097:51662` | 45 | ✅ reviewed 2026-06-21 (join, pre-live settings, composer, viewer-Qs, pending-Qs, live+participant-list, gifts, swap) |
| 6 | Moderator – Remote | `7148:62527` | 50 | ✅ reviewed 2026-06-21 (same flows on the 1–4 player grid + moderator PIP) |
| 10 | Additional Player | `7691:45749` | 7 | ✅ 7/7 → spec: docs/screen-specs/A2b-player-grid.md (grid layouts 1/2/3/4 verified) |
| 7 | Coin bank | `7264:84205` | 17 | ✅ reviewed 2026-06-22 (balance/main, package grid, payment sheet 🔴B1 Stripe, qty stepper, success, transactions+range picker, usage history, empty) |
| 9 | Inbox | `7456:75162` | 34 | ✅ reviewed 2026-06-23 (main+3 categories, empty states, private chat, media/voice send, send-contact, report/block, profile-from-chat, find-friends/share, permissions); label pass still owed |
| 11 | Home/Feed | `7705:45750` | 2 | ✅ reviewed 2026-06-21 (vertical-scroll live cards + "Tap to switch to live game") |
| 12 | System Messages | `7097:49329` | 5 | ✅ reviewed 2026-06-23 (game-paused, chat-request overlay S1, result popups S2) |
| 13 | In-stream Animation & End popup | `7816:57287` | 5 | ✅ reviewed 2026-06-23 (in-stream win/loss + end popups won/loss/no-bets → Full details) |
| 14 | Registration | `7721:90563` | 1 | ✅ reviewed 2026-06-23 (LazyAuth modal; R1 providers, R2 missing +1000) |
| 15 | Birthday | `7741:96354` | 1 | ✅ reviewed 2026-06-23 (DOB gate; R3 dismiss-closes-app) |

**🏁 ALL 15 SECTIONS REVIEWED (2026-06-23).** Next: consolidate C/M/H/B/I/S/R + open decisions into one
PM/designer list (🔴 B1 Stripe is the headline).

## Flow-level review (storyboards `.figma-shots/flow/`) · 2026-06-23
Reviewed all 11 section storyboards (the wired flows w/ arrows, not single screens). Resolution only allows the
**macro structure** (sub-flow grouping + order + branches), not per-screen text — but that's the point here.
**Verdict: navigation is consistent with the per-screen findings; no new flow-level blocker.** Notes:
- **Viewer close-up ≡ remote** — identical sub-flow skeleton (main → gift → player-profile → suggest-Q →
  answer-Q → share → settings → host-swap). Remote only swaps the single video for the 1–4 grid. ✅ parity.
- **Host close-up ≡ remote** — linear create wizard (type → name → invite players → invite moderator →
  permissions → summary+QR → share/publish → practice → live → in-stream invites/settings/gifts/exit). Remote
  adds the grid. ✅ confirms the wizard order.
- **Moderator close-up ≡ remote** — invite → in-stream actions → gift-receipt → compose-Q → pending-Q →
  viewer-Q → settings → invite-new-moderator+handover. ✅ matches אפיון order (pp.14–21).
- **Host/moderator swap is a multi-outcome branch** (accept → wait → won-handover **or** lost-race "someone else
  was selected" **or** cancelled). ✅ as documented.
- **Coin bank flow** = profile → bank main → purchase packages → payment sheet → success → back-to-main (updated
  balance); side branches = transactions (list + range picker) + usage history + empty. ⚠️ **reconfirms B5** —
  the **3 onboarding screens are absent** (flow jumps profile→bank→purchase with no onboarding interstitial).
- **System Messages flow** ⚠️ **reconfirms S2 structurally** — the **"You won/lossed 600 points / start again"**
  popups live here **alongside** the §13 "coins summary / Full details" end popups = two result designs coexist.
- **In-stream flow** — per-question win/loss overlay (annotated "the moderator closes **your** answer" vs
  "closes a **different** answer — not this time") + the 3 end popups (won / not-this-time / no-bet → Full
  details). ✅ clarifies the per-question result trigger.
- **Profile flow** — edit-profile chain → add-friends/share → permissions → Settings & Privacy hub → account
  details. ✅ consistent.

## Decisions already folded into SPEC.md (2026-06-18)
Payments = Apple IAP + Google Play Billing (no Stripe) · Gift split 35/65 · Standard pot `n+1.15` · "Who
wins" 85/15 · Default lang English→device locale · DIAMOND removed from scope · Game-history rules · Settings
are per-role-in-game (no global role) · DVR freeze-for-viewers behavior clarified.

## Still open — Sara checking with designers
> ✅ Mostly closed at the Zoom (2026-06-23) — see the **ZOOM RESOLUTIONS** block at the top.
> Birthday gate ✅ (re-prompt every entry until DOB) · share-target list ✅ (IG/X/WA/FB/Link/Email, no Telegram).
**Still open:** profile roles/personas/schedule variants (pp.28–31 — Sara: "what is this?", re-explain; OOS until
defined) · player→manager/admin promotion (in scope per אפיון p.11; no Figma frame yet).

---
## Findings

### Section 8 — Profile (`7435:83711`) · reviewed 2026-06-18 (13 of 22 frames exported)

**view profile — `7435:83712`**
- Header: back arrow + hamburger (☰). Avatar w/ cyan→purple gradient ring. Full name + ✏️ + `@username`. Bio.
- 3 stat cards: **Live broadcasts (8)** · **Followers (13.6K)** · **Following (24,586)**.
- Actions: **Share Profile** (outline) + **Add Friends** (filled). Bottom nav present.
- ⚠️ **GAP (HIGH) — bottom nav differs from SPEC §3.** Figma nav = **Home · Friends · LIVE (center
  gradient CTA) · Messages · Profile**. SPEC said Feed/Play/Wallet/Inbox/Profile. → Wallet is **not** a tab
  (it's in the hamburger); there **is** a Friends tab; center is the **LIVE** go-live button. *(SPEC §3 updated.)*
- ⚠️ **GAP (i18n) — "In progress" should be "Following".** The 3rd stat is `במעקב` (following) in the Hebrew
  variant but rendered **"In progress"** in English. Mistranslation in the en locale.
- ⚠️ Stat #1 is **Live broadcasts** (not "games" as SPEC §10.1 said). Minor wording fix in spec.

**menu (hamburger) — `7435:84163`** (RTL variant)
- Bottom sheet with **Bank balance** + **Settings and Privacy** only.
- ✅ Confirms Wallet/Coin Bank is reached here, not via a tab.
- ⚠️ **GAP — QR code entry missing.** SPEC §9 / PDF said the hamburger also has "QR code (my code)". Not in
  this sheet. → confirm whether QR moved elsewhere or was dropped.

**Adding friends ("Find friends") — `7435:84211`**
- Search by name/username · **Invite Friends** (share profile) · **Contact Search** (badge "234") ·
  **Facebook Friends Search**.
- ⚠️ **GAP — no QR-scan and no "Suggested accounts"** here (PDF listed both for add-friends). → confirm scope.

**Sharing — `7435:84289`**
- Targets: **Instagram · X · WhatsApp · Facebook · Link (copy) · Email**.
- ❓ **RESOLVES share-list (#7) for profile, but CONTRADICTS the PDF comment** (which dropped Instagram and
  added Telegram). Figma = Instagram + Email, **no Telegram**. → confirm Figma wins (likely, it's newer);
  also confirm whether **stream** sharing uses the same set.

**Edit profile flow — `7435:83752 / 83782 / 83918 / 84118 / 83955 / 84002 / 84029 / 84047 / 84067`**
- Fields: Full Name, Username (`@` prefix), Biography; avatar with camera overlay → "Replace/Change image".
- Auto profile link **`HyPulse.com/@<username>`** + copy icon → "Link copied" toast (`Edit profile_5`).
- ✅ Username helper (red): **"Username can contain only letters and numbers"** (`Edit profile_2`).
- ✅ Avatar: gallery picker "Choose a picture" (`_6`) → "Image cropping" circular crop + "Save photo" (`_7`).
- ✅ Save → "Profile has been saved successfully" toast (`_8`). Bio expands inline for long text (`_3.1`).
- ⚠️ Minor: **no visible character counter** on Biography (PDF said one should appear). Confirm.

**Settings & Privacy sub-screens (all 9 reviewed at hi-res — section COMPLETE)**
- **Settings and Privacy hub** (`Frame 2147223760`): group **Account** = `חשבון` Account · `שתף פרופיל` Share
  profile · `נגישות` Accessibility · `פרטיות` Privacy · `מדיניות ופרטיות` Policy. group **Login** =
  `החלפת חשבון` Account switch · `יציאה` Logout.
- **Account `7435:84440`** — 2 rows: `פרטי החשבון` (account details) + highlighted `להשבית או למחוק את החשבון`
  (disable/delete account).
- **Account details `7435:84864`** — `מספר טלפון` (phone) + `מייל` (email, masked `m***92@gmail.com`). 🆕 not in SPEC.
- **Verify email (OTP) `7435:84880`** — frame is **mis-named `סיסמה`/password** but content is "Verify your
  email address": 6 OTP boxes + "Did you not receive a code? Send again". 🆕 email-verification not in SPEC.
  ⚠️ rename frame.
- **שתף פרופיל `7435:84456`** — "Send to" sheet: contacts row + `עוד`/more · `העתק קישור`/copy · Email ·
  `הודעה`/message · Facebook. ⚠️ **differs from the `Sharing` sheet** (Instagram/X/WA/FB/Link/Email) — two
  different profile-share UIs; unify or decide intentionally.
- **נגישות / Accessibility `7435:84581`** — `גודל הטקסט` (text size) · `תמונה ממוזערת מונפשת` (animated
  thumbnail, off) · `מהירות גלילה גבוהה יותר` (faster scroll, on) · `כלי נגישות הפיד` (feed a11y buttons when
  Talkback on) · `כיוונים` (directions in app language) · section "videos with light effects" →
  `הסתר סרטונים עם אפקטים של אור` (hide for photosensitivity). ⚠️ footer "World Game" branding.
- **פרטיות / Privacy `7435:84639`** — Discovery: **Private Account** (off) · **Activity Status** (on) ·
  Recommend your account to others · Sync contacts & friends on Facebook. Interactions: `תגובות` comments ·
  `אזכורים` mentions · `הודעות ישירות` DMs (כולם/everyone) · `שימוש חוזר בתוכן` content reuse · `הורדות`
  downloads (מופעל/on). 🆕 none in SPEC.
- **מדיניות ופרטיות / Privacy Policy `7435:84723`** — placeholder text; ⚠️ **branding bug "World Game /
  Game World", not HyPulse**; "Last updated June 2, 2025".
- **החלפת חשבון / Account Switch `7435:84737`** — modal: current `user6332` + "Add Account". 🆕 multi-account.
- **יציאה / Logout `7435:84803`** — "Are you sure you want to log out?" → Account Switch / **Exit** (red) / Cancel.

**Cross-cutting findings folded into SPEC:** ⚠️ product-name inconsistency (World Game vs HyPulse) → §16/§17;
🆕 email-verification OTP, multi-account switch → §4; 🆕 settings & privacy structure + toggles → §10.7.

✅ **Profile section COMPLETE (22/22 frames reviewed).**

### Section 10 — Additional Player (`7691:45749`) · reviewed 2026-06-18, **re-verified vs spec `אפיון: שחקן נוסף` pp.41–45 on 2026-06-19** → see [docs/screen-specs/A2b-player-grid.md](docs/screen-specs/A2b-player-grid.md)
- Invite popup `7691:45389` (Join as player, Accept / Rejected-60s); waiting "Going live now" `7691:45327`
  & "Waiting for the broadcast to start…" `7691:45344`; rejected `7691:45363`; close-up live main
  `7691:45261/45294` (full video + avatars top + controls; **default cam/mic OFF**); settings `7691:45425`.
- 🆕 **Practice mode (~30 s) confirmed** (`מצב תרגול` / `כבוי` / `הסבר מצב תרגול` / `מעבר לשידור`): self-preview
  PIP + countdown + explainer → auto-go-live. **Defaults are mode-dependent** (close-up cam/mic OFF; remote
  cam/mic ON, not toggleable) — corrects the old blanket "off". SPEC §6.2 + A2b doc updated.
- Grid (remote, from Viewer-Remote): 1/2/3/4 = `7014:30858 / 29794 / 29603 / 29966`; moderator = floating PIP,
  not a grid cell; selected tile = cyan border. ✅ geometry verified.
- ❓ **Open conflicts C1–C4 (designer):** C1 mic-toggle placement (spec=settings vs Figma=on-screen);
  **C2 remote additional-player frames MISSING in Figma** (biggest gap); C3 self-preview in 2×2; C4 camera-off
  tile = profile pic (spec) vs circle-slash (Figma). Full detail in the A2b doc.

### Section 4 — Viewer – Remote (`7097:45650`) · 🟡 in progress (grid + host-swap done; betting loop pending)
- **Grid layouts** — see Additional Player above (same frames).
- **Host/moderator swap (viewer = invitee):** `Live host change` "Erez invites you to a live host swap" →
  Accept / Rejected (60s) → "Please wait" → "approved / Now broadcasting" **or** "The request no longer
  exists — someone else has been selected / I understand". ✅ confirms SPEC §6.4 from the receiving side.
  ⚠️ **copy bug: the accept button says "which"** (placeholder) — should be Accept/אישור.
- **Handover start** (`מנחה`): "Adi Kito approved the request to join as a host / **Start handover**" (begins
  the ~2-min overlap).
- **Gifts from other viewers** (`תצוגת המתנות…`): small animation bubble + sender name over a player tile. ✅
- **Answer/message notice** (`הודעה לצופה…`): bubble — ⚠️ **placeholder "Message Title / Lorem ipsum"**, needs real copy.
- ⚠️ **Role-dependent top bar:** viewer = title + viewers + coins + X; host/new-host = power-off + invite +
  viewers + gift-count + title.
- **Shared profile-preview / follow tabs** (`view profile`, `במעקב`, `עוקבים`, `שחקן שכבר בעוקבים שלו`,
  `תצוגת פרופיל מקוצר`) — same component already documented (Profile §1).
- **Gift bank (Currency Bank)** (`1000217770/777`): opens from bottom; grid of gift items each with a coin
  price (e.g. 500). Selecting → gift animation on the target player tile (`1000217776/778/780` — large gift
  "baz", e.g. ice-cream, over the recipient's window). ✅ matches SPEC §6 / remote "large gift in player window".
- **Suggest question to moderator** (`1000217806/809` — "Send to mentor"): question text + answer-option rows
  + tag players (@name); includes a "Who will win the game?" template. ✅ matches "הצעת שאלה למנחה".
- ⚠️ **Terminology bug:** moderator is called **"mentor"** (Send to mentor), **"Mendator"** (section names),
  and "moderator" — standardize (likely **Moderator**).
- **Gift bank variants** (`1000217803/804`) + **suggest-question variants** (`1000217805/808/810`): question
  text + answer rows + **player tagging** (@username dropdown, e.g. for "Who will win the game?").
  ⚠️ **Copy inconsistency:** the send button reads **"Send to mentor"** (805/810) vs **"Send to the host"**
  (808) — and the question actually goes to the **moderator**; standardize.
- ✅ **Viewer-Remote effectively covered.** The viewer **answer-with-wager** loop (question → pick option →
  choose coins → result/coin-delta) is **NOT in this section** — it lives in **Viewer Close-up** (numbered
  frames 03–17) + the win/loss popups (§13). Review there.

✅ **Viewer – Remote reviewed** (grid, host-swap, gifts, suggest-question). Answer/wager loop → Viewer Close-up.

### Section 1 — Viewer – Close-up (`7014:27847`) · reviewed 2026-06-21 (42 frames in `.figma-shots/viewer-close-up/`)

**Main close-up screen — `03–09`, `16`, `17`**
- Top bar: live dot + title (`Chess with Yuri`) · **viewers `23K 👁`** · **coins `1,520 🪙`** · **X** (close/exit).
- **Avatars row** (players, not video tiles — matches אפיון "משחק מקרוב: אווטרים בחלק העליון"): each chip = avatar
  + name + **gift count `🎁 0`** + **Follow `+`** (cyan = followable, grey/disabled = already following). Row has a
  **`+3` overflow** chip and **expand/collapse arrows** (`05`→`03` toggles compact vs full grid of chips).
- **Single player video** = a rounded card (top-left), **not** full-bleed; shows a small **`🎁 0`** badge.
- **Moderator = floating PIP** (`03/16`): movable window with the moderator's face. Controls on tap (`07`):
  **expand** (resize) + **eye-slash = hide moderator**. Hidden state (`08`) leaves a **show-moderator eye** button
  top-left. Expanded state (`09`) = moderator window **spread wide across the bottom**. ✅ Matches אפיון close-up:
  "שינוי גודל חלון מנחה / הסתרת חלון מנחה / מעבר דינמי".
- **Camera switcher** bottom-left **`1/3 📷`** (current/total open cameras) — matches "מעבר דינמי בין מצלמות +
  אינדיקציה למספר מצלמות פתוחות".
- **Bottom nav (4):** gift 🎁 · compose-question 📝 · share ➦ · settings ⚙️.
- ⚠️ **C6** — a central **🚫 prohibited glyph** is present on every main frame; intent unclear (see pending Q).

**Gift flow — `11`–`15`**
- Tap 🎁 → **Currency Bank** sheet from bottom. First-time banner: **"You have received 1000 bonus points from
  HyPulse"** ✅ (אפיון §7). Gift grid, each card = emoji + name + coin price (**מתנה 1000 · פנדה 3000 · פרח 800 ·
  גלידה 500 · דונאט 500 · לב מחייך 300**) + **Load more**. Sheet **closes only via X** ✅ (אפיון: "רק ע"י X").
- The **player avatars row stays on top** so you **drag a gift onto a player** (`13`) ✅ ("לגרור לכל שחקן").
- Send → toast **"Ice cream gift worth 100 coins has been sent to player Ziv Baruch"** + **Cancel** + a **large
  gift "baz" animation** fills the lower screen (`14/15`) ✅ (close-up sender sees the large baz).
- ⚠️ **C7** — value mismatch: card "גלידה **500**" vs toast "worth **100** coins".

**Gifts from other viewers — `17`**
- Small bubbles: avatar + **"Hila Aviram · Sent to player 3 a red heart"** + emoji ✅ ("שאר הצופים: אנימציה קטנה
  עם שם ותמונה").

**Answer-with-wager loop — `1000217811` / `1000217812`  ⬚ (unlabeled — give them names)**
- Question card **"Who will win the game?"** with a **countdown timer badge** (`45s`) top-right.
- **4 numbered answer options** (1–4), each a pill ("Player 1 sitting to the right with a white hat?"). Selecting
  one **highlights it** (purple gradient, `811` option 3).
- **Currency Bank gift grid docked beneath the question**; in `812` a **gift box is dragged onto the selected
  answer** = placing the wager.
- 🔴 **C5 conflict** — Figma wagers via **gift items**; אפיון §4 wagers a **point amount** from **3 random
  options** each showing **payout (+25%)**. Neither the 3 amount-chips nor the per-amount payout label appear in
  Figma. **Do not build until resolved.** (Result/animation states → §13 win/loss popups, already mapped.)

**Suggest-question composer (viewer → moderator) — `1000217763` / `792`–`796`**
- Sheet: question field (placeholder **"Enter a question for the host"**) + **3 default answer rows**
  ("Write an answer / a reply or tag friends") + a **`+`** to add rows + **"Send to the mendator"** CTA.
  ✅ matches "הצעת שאלה למנחה". ⚠️ copy: **"mendator"** typo + **"host"** in placeholder vs **moderator** target.

**Answer-picked notice — `הודעה לצופה ששלח את השאלה שנבחרה`**
- Top toast w/ HyPulse logo: ⚠️ **placeholder "Message Title / Lorem ipsum…"** (needs real copy — animation shown
  to a viewer whose suggested question the moderator picked; אפיון §6 "הודעת אנימציה שהשאלה נבחרה").

**Settings (viewer in-stream) — `settings*`**
- **Live Broadcast Settings** ("apply to the current live broadcast"): **Video Quality** › · **Live Broadcast
  Report** › · **Propose a question to the moderator** › · **Giving gifts to players/host** › · **Share the game
  with friends** › · **Exit Live Broadcast** · **Display players details** (toggle, off). + **Save / Cancel**.
  ✅ confirms אפיון "כל פעולה זמינה גם דרך ההגדרות". Note: here the label is **"moderator"** (correct) — unify.
- **Report** (`settings-1/2`): **"Select a reason"** radio list (two lengths — long list adds self-harm,
  unhealthy-eating, high-risk, copyright, personal-details, Other) → **"Report and block"** / **"Report"**.
  Banner: "sent to the HYpulse team … remains confidential and is stored only in the system" ✅ (אפיון §10 דיווח).

**Host/moderator swap (viewer side) — `1000217813`, `מנחה`, `מנחה-1`, `החלפת מנחה*`**
- Invite **"Live host change — Erez invites you to a live host swap"** → **Accept / Rejected (60 seconds)** →
  **"Please wait"** (dots) → **"Adi Kito approved … Start handover"** (begins ~2-min overlap) **or** lost-race
  **"The request no longer exists — Someone else has been selected / I understand"**, plus cancelled toast
  **"The request was canceled"**. ✅ same component as Viewer-Remote, confirms SPEC §6.4 from the viewer side.

**Shared components (already documented):** player profile preview `תצוגת פרופיל מקוצר`, full `view profile`,
follow tabs `מומלץ/עוקבים/במעקב`, `Suggested Accounts`, already-following `שחקן שכבר בעוקבים שלו` — identical to
Profile §8 / Viewer-Remote §4; no close-up-specific deltas.

✅ **Viewer – Close-up reviewed.** Blocking items before any build: **C5** (wager currency), **C6** (central glyph),
**C7** (gift price). Copy bugs (mendator / Lorem ipsum) folded into the Bugs list above.

### Section 11 — Home/Feed (`7705:45750`) · reviewed 2026-06-21 (`.figma-shots/feed/`)
- **Vertical-scroll feed of live-game cards** (TikTok-style): each card = the **live video** (e.g. chess) filling
  the card + host **name + avatar** (with a live dot) overlaid at the bottom. `01` = mid-scroll (one card playing,
  next card below); `02`/`02-1` = a single focused card with a **"Tap to switch to live game"** pill + tap-hint →
  enters the broadcast as a viewer. Device frame 375×812; no separate landscape variant (the "height-width"
  composite just shows the same two states at device size).
- **Bottom nav confirmed** = **Home · Friends · LIVE (center gradient) · Messages · Profile** ✅ (SPEC §3).
- The central **🚫** here is the **empty-card video placeholder** — confirms the C6/M4 resolution above.
- Maps to **SPEC §6.5 / §3**. ✅ no conflicts.

### Sections 5 & 6 — Moderator Close-up (`7097:51662`) + Remote (`7148:62527`) · reviewed 2026-06-21 (`.figma-shots/moderator/`)
> אפיון source: **מנחה (Moderator) pp.14–21.** Close-up and Remote share every flow; the only difference is the
> live video layout (close-up = avatars row + single video; remote = 1–4 player grid + moderator PIP).

**Join lifecycle — `מסכי קבלת הזמנה`, `dialog for enter to live`, `entering`, `rejected`**
- Invite popup **"Join the game as a host"** + inviter (`Jackson Reed`) + **Approved / Rejected (60 seconds)** →
  `entering` loaders ("Going live now" / "Waiting for the broadcast to start…") → live. ✅ matches אפיון (60-s
  auto-decline). ⚠️ copy: says **"as a host"** for a **moderator** invite.

**Pre-live settings — `settings`**
- **Live Broadcast Settings:** Video Quality › · **Substitute Host Booking** › · Viewing options (followers-only,
  on) · Camera off (on) · Mute Microphone · Mute Players · Player Details Display. + Video-quality sub-screen
  (720p recommended / 480p). 🔴 **M2 conflict** — missing question-duration + min-wager controls the אפיון lists
  here; has extras. (Same component as the viewer/host in-stream settings.)

**Question Composer — `new question`, `drafts of questions`**
- Header **"New question"** + LIVE badge; tabs **viewers' questions** + **Drafts**. Card: "Your question" field +
  **Optional answers** (default **Answer 1/2/3**) + **`+`** to add more. Action bar: **"Draft Saved"** +
  **"Advertising"** (= Publish). 🔴 **M3** (no Delete / no per-question advanced settings). ⚠️ copy bugs above.
- **Draft Questions** list: "5 Questions", cards = avatar + name + question text + chevron.

**Viewer questions — `questions for viewers`, `…-editing`, `1000217825/826/827/828`, `1000217843`**
- **Viewer Questions** list ("5 Questions"): viewer avatar + name + truncated text + chevron → expand. ✅ אפיון.
- Expanded → **Edit** link + **radio answer options** (up to 4: First/Second/Third/Fourth) + **Remove** + publish.
  ✅ אפיון "פרסום / עריכה / מחיקה". ⚠️ remote variant button = **"Which publication"**; close-up variant =
  **"Publish"** (correct) — inconsistent. Full edit screen = **"Edit Question"** + Cancel Changes / Save Changes
  (correct). Toast **"Changes saved successfully"**.

**Pending / open questions — `waiting questions for answers`, `מסכי שאלות ממתינות`, `live-4`**
- **Open Questions** list: "3 open questions" + 3-dot menu; cards = question text + **participants count
  ("250 participants")** + timestamp (14:19) + chevron. ✅ אפיון "שאלות ממתינות (פעיל)".
- Expand → radio answers → **Cancel / Publish** → **"The result has been resolved…"** toast. From the live screen
  the same sheet is **"Questions waiting for an answer"** + **Cancel / Publishing results** + "For all open
  questions ›". ✅ resolve = pick correct answer + share. ⚠️ copy "Publishing results".
- Pending questions also surface as a **rotating banner of pills** at the bottom of the live screen. ✅ אפיון.

**Live — close-up (`view all the players`, `mute players`, `1000217824`)**
- Top bar: title + viewers `23K 👁` + coins `1,520 🪙` + **exit**. **Avatars row** + **speaker icon** (left) +
  **"Show details"**. Single player **video card** with **mic-mute** button. **Camera switcher `1/3 📷`**. Central
  **🚫** (M4). Bottom nav (4): **settings · create-question · pending-questions · invite/swap**.
- **"Show details"** → full **participant list** modal (avatars + name + gift count + Follow `+`, X to close). ✅
- **Mute Players** active → header speaker icon turns **red**. ✅ אפיון "השתקת שחקנים".

**Live — remote (`live`, `live-1`, `live-4`, `1000217837/847`, `מסכי מנחה remote-play`)**
- **Moderator PIP** floating top-left (with mic-mute) + **player grid** (1–4); each tile = video + name + **gift
  count** + **speaker/mic state**; tile gift badge `23K 🎁`. Same 1/2/3/4 geometry as host/viewer remote. ✅
- Tap a player tile → **profile preview** (Maor Karmi / @user / "215 in progress" / 13.6K followers / bio /
  **Follow** / **Go to profile**). ⚠️ "in progress" → Following.

**Gifts — `View of gifts sent for mendator`, `View gifts sent by other viewers`**
- Moderator **receives** a gift → **large baz animation** over the screen (remote: over the grid). ✅ אפיון.
- Other viewers' gifts → **small bubble** ("Hila Aviram · Sent to player 3 a red heart" + emoji). ✅

**Moderator swap — `מסכי הזמנת מנחה חדש`, `1000217844`, `1000217847`, `מנחה`-handover**
- **"Substitute Host Booking"** sheet: Search + **"Recommended for you"** (algorithm: contacts/followers/
  following first) each with **"reserve"**, then **"The other viewers"**. Multi-invite. ✅ matches אפיון
  priority order + parallel invite. 🔴 **M1** label/verb ("Host"/"reserve" for a **moderator** swap).
- Accept → **"Adi Kito approved the request to join as a host / Start handover"** (begins ~120-s overlap). ✅
  matches Viewer/Host swap component. ⚠️ "as a host" copy again.

**Shared components (already documented):** profile preview/full + follow tabs (`view profile`, `מומלץ/עוקבים/
במעקב`), chats — identical to Profile §8 / Viewer §1/§4.

✅ **Moderator (Close-up + Remote) reviewed.** Blocking before build: **M1** (swap naming), **M2** (pre-live
settings set), **M3** (composer actions + where per-question time/min-wager live), **M4** (central glyph). Copy
bugs folded into the Bugs list. Behaviour from אפיון not yet visible in any frame (flag to designers): moderator
**drop/leave → sound alert to all** (comment [38]); swap **open-questions refund + viewer notification**;
**dynamic vs end resolution** of "who wins" (comment [39]).

**Designer answers (2026-06-19):**
1. ✅ **QR is only in game-open (host flow), NOT in profile / add-friends** — remove the QR expectation from profile.
2. ❓ Add-friends "Suggested accounts" — **not answered yet** (re-ask).
3. ✅ Share set = Figma **Instagram/X/WA/FB/Link/Email, no Telegram**. **Two share contexts exist & have
   their own screens:** (a) invite additional players, (b) general app share (FB etc.).
4. ❓ Bio character counter — **not answered yet** (re-ask).
- ✅ Product name = **HyPulse only**.
- 🆕 **Contacts screens added** (add-friends): permission `Give Hypulse permission to access your contacts?`;
  **Contacts list** ("231 contacts", Follow per contact) `contacts screen list`; **Sync** ("more fun with
  friends…"). ⚠️ bad button copy → see Bugs list. ✅ Profile **game-history tabs** (opened / participated) visible here.
- The "two profile-share sheets" point = these are the **two contexts** above (invite-players vs general
  share), not a true conflict — keep both, just ensure consistent styling.

### Sections 2 & 3 — Host Close-up (`7083:97876`) + Remote (`7277:113768`) · reviewed 2026-06-22 (`.figma-shots/host/`)
> אפיון source: **שחקן מארח (Host).** Close-up and Remote share the whole create→go-live→manage flow; the only
> difference is the live layout (close-up = single host video + avatars row; remote = 1–4 player grid + moderator
> PIP). This is the **most complete storyboard in the file** and confirms **SPEC §6.1 is real & detailed.**

**Create wizard — `בחירת סוג משחק` / `בחירת משחק מקרוב` / `כתיבת שם המשחק(_2)`**
- **Select Game Type:** two cards **Close-up game** / **Remote play** (selected card = lilac fill) → Next. ⚠️ both
  subtitles read **"Play face to face"** (Remote is a copy-paste bug).
- **Game Name:** single text field. ⚠️ header swings **"Game Name" / "The name of the game"**. 🔴 **H1 — no
  description field** (SPEC §6.1 wants name **+ description**).
- 6-dot progress wizard across the whole create flow.

**Permission prompts — `הרשאות לתמונות` / `…לאנשי קשר` / `…לפייסבוק ומייל`**
- Bottom-sheet OS-style prompts for photos, contacts, Facebook+email. ⚠️ **all branded "Game World"** + bad
  button copy (see Bugs list). These mirror the host-create permission set already in FIGMA-SCREENS §2.

**Invite players — `הזמנת שחקנים_1..4` (+`_1-1`)**
- Dropdown "Who will be your players?" → **player search list** (multi-select, ✓/X) + a **"Friends can scan" QR**
  + Confirm. Sent → green ✓ per player + toast. ✅ matches "הזמנת שחקנים". ⚠️ header/CTA/toast copy bugs.

**Invite moderator — `הזמנת מנחה_1..4`**
- Same picker pattern, **titled "Game Host Invitation"**, placeholder "Who will host your game?", **"Search
  guide"/"Guided Search"**, CTA "Send a summons". 🔴 **H2** — this is the **moderator** invite mislabeled as
  *host/guide* throughout.

**Summary + broadcast QR — `סיכום פרטי המשחק(-1)` / `ברקוד כניסה לשידור`**
- **Game Details:** QR icon (top-right) · purple **"Share the game with friends facebook, watsapp, and more"**
  banner · game name + ✏️ · **"Name of the host"** row (= the invited **moderator**, 🔴 H2) · **player rows with
  pending-spinner / green-✓ confirm state** · **+** to add · footer **"In the transition to a live broadcast you
  will be given 30 seconds to prepare"** (✅ confirms 30-s Practice) · **Live broadcast** CTA.
- **"Attention!"** popup when players haven't confirmed: **"Wait for all players" / "Yes, continue
  broadcasting"** ✅ (go-live-with-unconfirmed behavior).
- **Broadcast QR** `ברקוד כניסה לשידור`: "Friends can scan and easily join the game!" — **correctly branded
  "HyPulse"** ✅ (only the permission popups still say Game World).

**Share / publish — `פרסום השידור_1/_2`**
- **_1** "Invite friends to the live broadcast – now!": preview card ("broadcast has not yet gone live") +
  **"A passage to be presented"** (caption header, ⚠️ copy) + prefilled post w/ placeholder URL
  **yourgame.com/live** + share apps (IG/X/WA/FB). **_2** "Well done! You shared…": shared networks badged
  **"✓ Partner"** (⚠️ → Shared) + **duplicate Instagram card** + "Shared on 2 out of 4 networks 50%" + Live
  broadcast CTA. ✅ Share set = IG/X/WA/FB/Email/Link (no Telegram), consistent with designer answer.

**Practice mode → go-live — `מצב תרגול` / `מצב תרגול כבוי` / `הסבר מצב תרגול` / `מעבר לשידור`**
- Live-style screen w/ **self-preview PIP + avatars row + cam/mic toggle (ON state; "כבוי"=OFF variant) +
  00:30 countdown**. Explainer popup = **"Practice mode… available only for you for at least 30 seconds… if you
  do not choose any action, the live broadcast will start immediately after the countdown ends"** ✅ (matches
  SPEC Practice). Go-live popup **"You are being transferred to a live broadcast… Good luck!"** + progress bar +
  ⚠️ button **"Reject"** (→ Cancel, **H4**).

**Live main (close-up) — `מסך ראשי של השידור`**
- Full-bleed host video; top bar **title `Chess with Yuri` · viewers `23K 👁` · coins `1,520 🪙` · X**; **avatars
  row** top-right. **Bottom bar = 3 controls: settings ⚙️ · invite-players · invite-moderator** — **no
  question-composer** (correct: host ≠ moderator) and 🔴 **no Pause/Resume** (SPEC §6.1 wants it — **H4**). No
  central 🚫 here (real photo).

**In-stream invites — `הזמנת שחקנים בזמן שידור_1/2`, `הזמנת מנחה בזמן שידור_1/2`**
- **Player Invitation** sheet: QR · search · **Active players** (Remove) · **Recommended Players** (**"To order"**
  → Invite); states **Removed / Invited**. ✅ behavior. **Moderator** version = **"Booking facilitators"** with
  **"Active facilitator / Hosts you have booked before / Recommended Guides"** — 🔴 **H2** naming catastrophe
  (one role called facilitator + host + guide on one screen).

**Game Management Settings (host in-stream) — `הגדרות ניהול המשחק`**
- New host-only set ("apply to the current live broadcast"): **Hosts**(→invite mod) · **Players**(→invite
  players) · **Video Quality** (720p recommended / 480p) · **Live Gifts** · **Guide Settings** (moderator may
  send Qs) · **Viewer settings** (viewers may send Qs to host) · **Viewing options** (followers-only) · **Camera
  flip** · **Mute microphone** · **Live broadcast delay** · **Audience Control (18+)** · Settings & Privacy.
  🔴 **H3** (scope + backend mapping; **18+ vs 17+**; what is "Live broadcast delay"). 🔴 **H5** ("Request
  additional **hosts**" ⇒ co-hosts? vs single-`hostId` + [[project-no-global-host-role]]).

**Alerts — `דחיית המנחה` / `התראה על מצב שקט` / `התראה על בקרת משחק…`**
- **Moderator declined** invite (host stays live). **Silent-mode alert:** "The phone is not in silent mode… Go
  to settings / I understand, continue" ✅. **Report-control monitoring:** "Your live broadcast is under
  monitoring… if found problematic, the live broadcast will be closed immediately / I understand, continue" ✅ —
  **this is the 5-reports → staff-monitoring screen (chat gap #15); confirmed it exists in design.**

**Gifts — `תצוגת מתנות עבורי` / `…לשחקנים אחרים` / `…עבורי ועבור שחקנים` (remote)**
- Host receives → **large baz** over screen; other viewers' gifts → **small sender bubbles** ("Hila Aviram ·
  Sent to player 3 a red heart"). Remote variant = baz/badges over the **2×2 grid** + moderator PIP. ✅ matches
  אפיון gift model. ⚠️ this remote frame is the **Hebrew/RTL** variant (top bar `שחמט עם יורי`) while the rest of
  the section is English — RTL variants exist.

**Remote grids — `משחק מרחוק_2/3/4 שחקנים` / `…שחקן 3`**
- 1–4 player **grid + moderator floating PIP** (mic icon); each tile = video + name + **gift badge `23K`** +
  mic-mute state; **selected tile = cyan border**; same geometry as viewer/moderator remote. ✅ **Reinforces
  C6/M4:** the central 🚫 shows **only in empty/not-yet-joined grid tiles** = camera-region placeholder, never on
  a filled tile.

**Exit — `יציאה מהשידור` / `אישור יציאה מהשידור`**
- Bottom sheet **"✕ Exit live broadcast"** → confirm **"Are you sure you want to exit the game as the host?"** +
  **"Exit Approval"** (⚠️ → Exit/Confirm) / Cancel. ✅ end-with-confirmation (SPEC §6.1).

**Feed entry — `3 פיד ראשי`**
- Live card (host "Ethan Marom") + **"Tap to switch to live game"** pill + bottom nav. ⚠️ nav 4th slot labeled
  **"Inbox"** (vs "Messages" elsewhere).

✅ **Host (Close-up + Remote) reviewed.** Blocking before build: **H1** (missing description + 50-followers gate),
**H2** (moderator naming across the whole flow = M1 at scale), **H3** (host management-settings scope + 18-vs-17
+ broadcast-delay), **H4** (Pause/Resume location + "Reject"→Cancel), **H5** (co-hosts vs single host). Copy bugs
folded into the Bugs list. **Confirmed in design (resolves chat gaps):** Practice 30-s + auto-go-live · go-live
with unconfirmed players · silent-mode alert · **5-reports monitoring screen (gap #15)** · share set (no
Telegram) · C6/M4 placeholder. **אפיון behaviours still not in any frame (flag to designers):** host
Pause/Resume control; explicit 50-followers gate UI.

### Section 7 — Coin bank (`7264:84205`) · reviewed 2026-06-22 (`.figma-shots/coin-bank/`)
> אפיון source: **בנק מטבעות (coin bank).** Section ships parallel Hebrew(RTL)+English frames.

**Entry + main — `יתרת הבנק מתוך פרופיל` / `חזרה למסך הראשי עם עדכון יתרה(-1)`**
- Reached from **profile hamburger → "Bank balance"** ✅ (SPEC §9). Coin Bank main = avatar + name + **"Total
  coins amount" gradient card** (1,000 / 1,400 variants = balance refresh) + **"To purchase additional coins"**
  CTA + two rows **Usage history (`הסטוריית שימושים`)** + **Transactions (`עסקאות`)**. Bottom nav present.

**Purchase packages — `רכישת מטבעות_1` / `בחירת רכישת מטבעות_2`**
- **Coin Purchase:** balance pill + "Choose a points package" + "Purchase points and receive a bonus gift! In
  live broadcasts you can use coins." + grid **40+10 / 80+20 / 160+40 / 320+80 / 600+150 / 1200+300 / 2400+600 /
  4800+1200** (base + bonus gift). Selected card greyed; CTA "Purchase 400 points for 12 ₪" (320 base + 80 bonus
  = 400 ✓). 🔴 **B5 placeholder pricing** (mostly ₪0.60). ⚠️ coins/points + capitalization copy bugs.

**Payment sheet — `רכישה בסכום נמוך_1/2` / `רכישה בסכום גבוה_1/2` / `הוספת כמות בסכום גבוה_3`**
- Bottom sheet: avatar + **"₪170 / 57 coins"** + **HyPulse** + methods **Apple Pay · Google Play · Stripe** +
  "Clicking 'Purchase' constitutes agreement to … Privacy Notices, Terms of Service…" + **For purchase** CTA.
  **Low-amount** = fixed quantity; **high-amount** = **Quantity +/- stepper** (qty 3 → ₪400×3 = ₪1200, price
  scales ✅). 🔴 **B1 — Stripe present** + in-app method radios contradict SPEC §12 IAP-only. ⚠️ "Googel Play"
  typo, "Quant ity" wrap.

**Success — `סיום רכישת מטבעות_3`**
- **"Yay! 🎉 Your purchase was successful"** + mascot + "Make another purchase" → returns to main with **updated
  balance** (1,400). ✅ SPEC §9 confirmation + balance refresh.

**Transactions — `עסקאות(-1)` / `בחירת טווח עסקאות(-1)`**
- List: **"Card 1234" + "Service fee: 28.32 ₪" + status + date** per row. Statuses seen: **In treatment**
  (=בטיפול), **Returned** (=הוחזר), **Postponed** (=נדחה). **Range picker** = 7 days / 30 days / 3 months /
  6 months / Year back; failure reason "card expired". 🔴 **B2** (card-based vs IAP), 🔴 **B3** (status copy +
  missing Completed/Cancelled), **B4** (6-mo/year break the ≤4-month cap). ⚠️ incoherent placeholder dates.

**Usage history — `היסטוריית שימושים` / `כאשר אין היסטוריית שימושים`**
- Point ledger (UserPoint): two stat pills **coins received (3,300)** + **gifts distributed (2,580)** + per-event
  rows (avatar + "X sent a pink ice cream" + context + time + **±delta** −50/+75/−75). ✅ SPEC §9 UserPoint
  ledger. Empty state = box icon + ⚠️ **"No transactions yet"** (wrong copy for the *usage* list).

✅ **Coin bank reviewed.** Blocking before build: **B1** (Stripe in sheet vs IAP-only §12 — the headline
finding), **B2** (card-based transactions vs IAP), **B3** (status copy + missing states), **B4** (range cap),
**B5** (real prices). **Not in this export (confirm scope):** first-run **onboarding 3 screens** + role-tabbed
**FAQ** that SPEC §9 describes. The in-stream coin icon + **"+1000 bonus" popup** live in the Viewer section,
already documented.

### Section 9 — Inbox (`7456:75162`) · reviewed 2026-06-23 (`.figma-shots/inbox/`)
> אפיון source: **דואר נכנס (Inbox) pp.32–34.** SPEC §10.2–10.5. ⚠️ Frames are **generically auto-named**
> (`Body` / `Screen Container` / `Main Content Area` / `Chats Container`) — **label pass still needed in Figma**
> before per-screen acceptance criteria (FIGMA-SCREENS §9 task #1 stands). Identifiable screens below.

**Inbox main (chat list) — `screen 234250`**
- Top **3 category chips** with avatars + unread **badge** counts: **New Followers · Live Gifts · System
  Alerts** ✅ (אפיון "עוקבים חדשים / מתנות בשידור חי / התראות מערכת"). **Search** icon → search field
  ("Results for 'Maya' – 2 colls"). Then **chat-list rows** (avatar + name + preview + timestamp + unread
  **badge**) ✅. Bottom nav = Home · Friends · LIVE · Messages · Profile ✅.
- **Empty states** ✅ (אפיון edge-case "אין הודעות"): **"You have no messages yet"** · **"You don't have any
  followers yet"** · **"You have not received or sent gifts."**
- ⚠️ each row has a small **camera icon** (quick photo/video to that thread?) — **not in אפיון**; confirm intent.
- ⚠️ אפיון wants a **FAB** to "open new chat or search" + swipe actions **delete / mark-as-read / pin (per
  Telegram)** — only header-search is visible; FAB + swipe actions **not in static frames** (confirm they exist).

**Category details — `screen 234258`**
- **New Followers:** rows = avatar + name + "Following you" + **Follow / Removal** buttons. 🔴 **I1** — אפיון
  (p.33) wants **follow-back** (if not yet friends) **vs go-to-chat** (if already friends), plus the **exact
  date** the follow started. Figma instead shows **Follow + "Removal"** (remove a follower?), **no date**, and
  **no go-to-chat variant**. → reconcile.
- **Live Gifts:** rows = sender + gift ("Send a pink ice cream") + **"3 minutes ago · 75 coins"** + **Follow** +
  **Message** ✅ (sender, coins, time, follow). ⚠️ **I3** — אפיון also lists **game name** per row (missing); and
  the behaviour "once the gift message is **viewed** it leaves this category and becomes a **regular message**"
  isn't representable in a static frame (confirm in build).
- **System Alerts:** rows = **"Boris Hoffmann joined the live broadcast"** + **Go Live** button. 🔴 **I2** —
  mismatch: אפיון System-notifications = **reports / block messages / system updates**; Figma shows a **social
  "joined live" activity alert** instead. → reconcile what this category actually carries (and whether
  "joined live + Go Live" is a 4th notification type).

**Private chat — `screen container (2)` / report in `234306`**
- Header: **back · avatar · name (Sarah Cohen) · flag (report) · ⋯ (3-dot)** ✅ (אפיון "שם, כפתור פרופיל, דיווח,
  חזרה" — profile likely via name/⋯). L/R **bubbles** + **timestamps** + sender name. **Image/video message**
  with caption + **file size** ("IMG_0481.PNG · 2.8 MB") ✅. Input = **"Message…" + (+) attach + 🎙 mic** + Send.
- ⚠️ **I5** — אפיון input also wants an explicit **emoji picker** button (Figma input = attach/text/mic only),
  and **message status sent/delivered/read** — **not visible** in any frame. → confirm both.

**Media message flow — `234322` + `body (3)`**
- **Select media** gallery · **camera capture** · **video preview + caption + Send** ✅ (אפיון "תמונות/וידאו
  ע"י צילום עצמי או גלריה"). Voice = mic in input ✅. Matches the four send-types in אפיון p.33.

**Send a contact — `Contacts for sending` (`main context area`) → `Sending contact details` (`234332`)**
- Multi-select **"Contacts for sending"** (checkboxes, "115 Contacts") → **"Sending contact details"** (selected
  contacts + phone numbers, "2 selected"). 🆕 **I4** — **sharing/forwarding a CONTACT inside chat is NOT in the
  אפיון Inbox spec** → new scope; confirm in/out.

**Report & block — `234306` (right)**
- **"Select a reason"** radio list (two lengths; long adds self-harm / unhealthy-eating / high-risk / copyright
  / personal-details / Other) → **Report / Report and block** ✅ (אפיון report step 1). **Same component** as the
  viewer in-stream report (§1). ⚠️ **I6** — block **step-2 confirm modal**, post-block **disabled/hidden input**,
  and **"2 distinct reporters → alert the reporter"** (אפיון step 2 + p.34) are **not clearly in these frames** →
  confirm the states exist. Also edge-cases **image-load-failure + retry** and **blocked-user status strip** (p.34)
  unverified.

**Profile-from-chat / find-friends / share (shared components) — `234344`, `234337`, `Chats Container`**
- **User profile from chat** (`234344`, Hebrew `גיא טוריס` card + stats) ✅ (אפיון item 3) — mute-notifications /
  report-block via it unverified. **Find Friends** (`Search Friends`: Invite Friends · Contact Search · Search
  Facebook friends) + **Share Profile** sheet (**Instagram · X · WhatsApp · Facebook · Link · Email**, no
  Telegram) — **same components as Profile §8**, consistent share set ✅. Reachable from the Inbox find-friends
  flow.
- **Permissions:** contacts **"Give the Hypulse app permission to access your contacts?"** (✅ branded HyPulse)
  with buttons **"There is approval / No approval"** (⚠️ copy → Allow / Don't Allow); contact **sync** ("In
  Hypulse, it's more fun with friends…", Approval / Don't Allow); **Facebook+email** permission body ⚠️ branded
  **"Game World"** ("enhance your experience on **Game World**") → HyPulse (same branding bug family as the host
  permission popups). → Bugs list.

✅ **Inbox reviewed.** Mostly **confirms** אפיון (3 categories, unread badges, search, empty states,
profile-from-chat, the report-reason component, media+voice send, share set). Blocking/confirm before build:
**I1** (New-Followers buttons/date/friend-state), **I2** (System-Alerts content mismatch), **I4** (send-contact
new scope), plus confirm **I5** (msg status + emoji), **I6** (block step-2 + post-block + 2-reporter alert +
edge-cases), **I3** (game-name on gift rows). **Label pass** for the generic frame names still owed.

### Section 12 — System Messages (`7097:49329`) · reviewed 2026-06-23 (`.figma-shots/system massage/`)
> אפיון: scattered (viewer pp.2–4, pause behaviour). Mostly **overlays shown over the live stream.**
- **Game paused (`בזמן השהית המשחק`)** — dark full screen **⏸ "The live broadcast has been suspended. The
  creator will return soon."** + Hebrew bottom nav (שאלות·מטבעות·הצעה·שתף). ✅ the **viewer's view while the host
  pauses** (SPEC §6.1 host Pause / §7.3). ⚠️ RTL nav while copy is English (i18n mix).
- **Message-request overlay (`הודעה לצופה…`, mis-labelled)** — toast **"Request to send messages — This user has
  started following you and sent you a message. Accept the request to start chatting, or delete to ignore."** +
  **Approve Request / Delete request**, over the stream. 🆕 **S1** — a **chat-request approval** gate (a
  non-friend's first DM needs approval) — **not in SPEC**; ties to Inbox §10.3. Confirm scope. ⚠️ file is
  mis-named "answer-picked notice" (that one lives in Viewer §1).
- **Result popups (`Body`/`Body (1)`)** — **"You won 600 points"** / **"You lossed 600 points"** + magician-hat
  art + **"להמשיך לשחק"** (continue). 🔴 **S2** — this is a **second, competing end/result popup design** vs the
  §13 end-of-game summary (coins + breakdown). Also **"lossed" typo**, **points-vs-coins**, RTL button under
  English title. → pick ONE result-popup design + coins terminology.
- `1000212400 2 (…).png` = placeholder/background grids (🚫 video-region), **not screens** — ignore.

### Section 13 — In-stream Animation & End-of-game Popup (`7816:57287`) · reviewed 2026-06-23 (`.figma-shots/in stream animation…/`)
> אפיון §4 (viewer): "הודעת אנימציה קופצת ונפרשת על חצי המסך" after a question resolves. These are **viewer-side**.
- **In-stream animation (`…זכייה`/`…הפסד`)** — overlay **"You won! +100 coins"** (purple) over the live screen
  (top bar + ice-cream gift still visible). ✅ matches the half-screen win/loss animation. (loss variant = same w/
  negative.)
- **End-of-game popup — 3 states:**
  - **Won (`פופ-אפ סיום משחק - זכייה`)** — "Game over / **Yay! You won!** / game summary: **Question bet +200
    coins** · **Gifts sent 3 gifts (-50 coins)** · **Current balance 1,570 coins**" + **Full details**.
  - **Loss (`ניטרלי`)** — ⚠️ file says *neutral* but content is a **loss**: "Not this time… / Question bet **-100
    coins** · Gifts sent 2 (-30) · 1,390" + Full details. → rename frame (it's a loss, not neutral).
  - **No-bets (`…ללא הימורים`)** — "No bet on question / Gifts sent 4 (-140) · 1,390" + Full details (extra state,
    already noted in FIGMA-SCREENS).
  ✅ This is the **viewer's** end summary (bet ± + gifts sent + balance), **Full details → game detail page**.
  🔴 conflicts with the **§12 "600 points / continue playing"** popup = **S2** (two designs + coins vs points).
- Note: the אפיון **host/player** end popup (p.13: duration, viewer counts, who won) is a **different** screen and
  is **not in this export** (host-side) — flag if needed.

### Section 14 — Registration / Lazy-Auth (`7721:90563`) · reviewed 2026-06-23 (`.figma-shots/הרשמה.png`)
- **Modal over the coin-purchase screen:** **"Registration — To continue enjoying the app, You need to register
  in the system. Sign up with:"** → **Continue with Google · Apple · Facebook · X · Instagram**. ✅ this is the
  **LazyAuth modal** triggered on a protected action (SPEC §4.1/§4.2).
- 🔴 **R1 — auth-provider mismatch.** Figma offers **X (Twitter) + Instagram** as login providers and shows **no
  email/password** option. SPEC §4 = **email/password + Google/Apple/Facebook** (Firebase). X/Instagram-as-auth
  is **new/unconfirmed**; email/password is **missing** from the modal. → confirm the real provider set (note
  §4.4: Google is Netfree-blocked, Facebook is later, Apple supported — showing all 5 may be aspirational).
- ⚠️ **R2 — the "+1,000 coins on registration" incentive (SPEC §4.2 / אפיון) is NOT on this modal** (generic
  title only). Confirm whether the incentive copy should appear here (it drives the sign-up FOMO).

### Section 15 — Birthday / DOB gate (`7741:96354`, screen `10`) · reviewed 2026-06-23 (`.figma-shots/birthday.png`)
- **Popup:** balloons icon + **"When is your birthday? HyPulse wants to give you 1000 points and reward you with
  many benefits on your upcoming birthday."** + **"My date of birth"** field (01/01/1999) + **wheel date-picker**
  + **Approval** button + **X** (top-right). Bottom nav behind it. ✅ matches SPEC §4.3 + אפיון p.2 (copy is a
  near-exact translation of the אפיון birthday text).
- 🔴 **R3 — the X/dismiss must enforce the gate.** אפיון p.2: it fires on the **2nd/3rd entry**, and if the user
  **ignores it the app CLOSES** and re-prompts **every** entry until a DOB is saved. The Figma popup has a plain
  **X** — confirm that dismissing triggers the **app-close + re-prompt** behaviour, not a silent skip. (This is
  the still-open Q6 timing item.)
- ⚠️ **"1000 points"** — points-vs-coins terminology again (SPEC = coins).

✅ **System Messages · In-stream Animation · Registration · Birthday reviewed — section sweep COMPLETE (15/15).**
New flags: **S1** (chat-request approval gate), **S2** (two competing result-popup designs + coins/points),
**R1** (auth providers: X/IG added, email/password missing), **R2** (missing +1000 incentive on the modal),
**R3** (birthday dismiss must close the app per אפיון).
