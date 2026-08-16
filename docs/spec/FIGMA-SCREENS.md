# HyPulse — Figma Screen Map (Source of Truth for Screens)

> **Companion to [SPEC.md](SPEC.md).** SPEC.md owns *behavior*; this file owns the *screen inventory* —
> every production screen with its Figma node ID and (where the designer numbered it) its **screen number**.
> ⭐ **Most detailed behavior spec = `אפיון אפליקציה.pdf`** (not in repo; Sara attaches it) — SPEC.md is the
> condensed derivative. ⚠️ **When Figma and the אפיון conflict, do NOT auto-resolve either way — surface the
> conflict and verify with the designers (מאפיינות).**
> **Last verified:** 2026-06-18 against the live Figma file via the `figma` MCP (Framelink); Additional Player
> re-verified vs the אפיון 2026-06-19.
>
> File: **WorId Game (Shira)** · `FBQSv16ajir03ZAtRbuHxb` · page **`screens for dev`** `6619:11957`.
> Open any node: `https://www.figma.com/design/FBQSv16ajir03ZAtRbuHxb/WorId-Game--Shira-?node-id=<id with - not :>`

## How to read this
- **Section** = a role/flow storyboard on the `screens for dev` page (the top-level frames).
- **Screen #** = the designer's frame label when it is a number (e.g. `05`). Frames labelled in Hebrew are
  the named steps of a flow; frames auto-named `1000217xxx` are unlabeled states (flagged ⬚ — need a label).
- Connector/arrow/vector layers and generic container layers (`Body`, `Screen Container`,
  `Screen with Home Indicator`, icon nodes) are **omitted** — they are not screens.
- ⚠️ = differs from / not yet in SPEC.md. ⬚ = unlabeled frame, needs a name in Figma.

---

## Section inventory (15 sections on `screens for dev`)

| # | Section | Node ID | In SPEC.md Appendix A? |
|---|---|---|---|
| 1 | English Viewer – Close-up game | `7014:27847` | ✅ |
| 2 | English Host – Close-up game | `7083:97876` | ✅ |
| 3 | English Host – Remote play | `7277:113768` | ✅ |
| 4 | English Viewer – Remote play | `7097:45650` | ✅ |
| 5 | English Mendator – Close-up game | `7097:51662` | ✅ |
| 6 | English Mendator – Remote play | `7148:62527` | ✅ |
| 7 | Coin bank | `7264:84205` | ✅ |
| 8 | Profile | `7435:83711` | ✅ |
| 9 | English Inbox | `7456:75162` | ✅ |
| 10 | Additional Player | `7691:45749` | ✅ |
| 11 | Home/Feed | `7705:45750` | ✅ |
| 12 | System Messages | `7097:49329` | ✅ |
| 13 | Viewer – In-stream Animation & End-of-game Popup | `7816:57287` | ✅ (⚠️ end-of-game popup **dropped** — D-17) |
| 14 | **Registration** | `7721:90563` | ⚠️ listed in SPEC but is a 1-frame section |
| 15 | **Birthday** | `7741:96354` | ⚠️ **NEW — not in SPEC Appendix A** (SPEC §4.3 describes the gate, no node) |

---

## 1 · English Viewer – Close-up game — `7014:27847`
The viewer close-up storyboard. Numbered screens `03`–`17` are the core watch/bet/gift loop.

- **Numbered watch loop:** `03` `7014:28192` · `04` `7014:28229` · `05` `7014:28118` · `06` `7014:28156` ·
  `07` `7014:28418` · `08` `7014:28382` · `09` `7014:28455` · `11` `7014:28993` · `12` `7014:28856` ·
  `13` `7014:29314` · `14` `7014:29453` · `15` `7073:105131` · `16` `7014:29566` · `17` `7014:28305`
  ⚠️ note `10` is absent here — it lives in the **Birthday** section (`7741:96566`).
- **Short profile preview** (tap a player) — `תצוגת פרופיל מקוצר` `7014:27903`, `7014:28023`
- **Full player profile** `view profile` `7113:69007`; tabs: `מומלץ`/suggested `7014:28634`,
  `עוקבים`/followers `7014:28614`, `במעקב`/following `7014:28590`; `Suggested Accounts` `7014:28542`
- **Already-following player** `שחקן שכבר בעוקבים שלו` `7014:27991`, `7088:62391`, `7097:46785`
- **Send gift / question loop:** answer-picked notice `הודעה לצופה ששלח את השאלה שנבחרה` `7088:48858`;
  moderator views `מנחה` `7097:47474`, `7097:47554`
- **Moderator swap (viewer side):** `החלפת מנחה` `7097:48887`, `7097:49026`, `7097:48754`
- **Settings (viewer-context)** `settings` `7513:98893` (Live Broadcast Settings) · `7513:104812` /
  `7513:105229` (Report — "Select a reason")
- ⬚ Unlabeled states (reviewed 2026-06-21, **should be named**): `1000217763` `7014:27848` +
  `…792`–`…796` (`7014:32500/32549/32595/32644/32693`) = **viewer suggest-question composer** ("Send to the
  mendator"); **`1000217811/812` `7088:61772/61913` = viewer answer-with-wager loop** (question + timer +
  numbered answers + Currency Bank wager — see 🔴 C5); `1000217813` `7097:46906` = **host-swap invite** (viewer
  side, "Live host change").

## 2 · English Host – Close-up game — `7083:97876`
Full host create→go-live→manage flow. **Confirms SPEC §6.1 is real and detailed.**

- **Create flow (in order):** choose mode `בחירת סוג משחק` `7083:121649` → `בחירת משחק מקרוב`
  (pick close-up) `7083:121703` → name `כתיבת שם המשחק` `7083:121624` / `…_2` `7083:121045`
- **Permission prompts** ⚠️(not in SPEC): photos `הרשאות לתמונות` `7083:121185`, contacts
  `הרשאות לאנשי קשר` `7083:121332`, facebook+mail `הרשאות לפייסבוק ומייל` `7083:121478`
- **Invite players** `הזמנת שחקנים_1..4` `7083:121757 / 122433 / 121809 / 121896`
- **Invite moderator** `הזמנת מנחה_1..4` `7083:122000 / 122182 / 122369 / 122396`
- **Summary** `סיכום פרטי המשחק` `7083:122508`, `7140:62037`; **broadcast QR** `ברקוד כניסה לשידור` `7083:122752`
- **Share to socials** `פרסום השידור_1/_2` `7083:122821`, `7085:124297`
- **Practice Mode** `מצב תרגול` `7090:129203` / `מצב תרגול כבוי` `7090:129243` / explainer
  `הסבר מצב תרגול` `7090:129410` → `מעבר לשידור` (go live) `7090:129464`
- **Live main screen** `מסך ראשי של השידור` `7090:129289`; quality `איכות הסרטון` `7090:129745`;
  mgmt `הגדרות ניהול המשחק` `7090:129687`
- **In-stream invites** players `הזמנת שחקנים בזמן שידור_1/2` `7090:129798/129974`; moderator
  `הזמנת מנחה בזמן שידור_1/2` `7090:130150/130343`
- **Moderator declined** `דחיית המנחה` `7090:129321`; **silent-mode alert** `התראה על מצב שקט` `7090:129364`
- ⚠️**Report-control alert** `התראה על בקרת משחק בעקבות דיווחים שונים` `7983:85719` — this is the
  *"5 reports → Hypulse staff joins"* screen (gap #15 in chat). **Confirms it exists in design.**
- **Gifts views** `תצוגת מתנות לשחקנים אחרים` `7090:130595` / `תצוגת מתנות עבורי` `7090:130635`
- **Exit** `יציאה מהשידור` `7090:130543` → `אישור יציאה מהשידור` `7090:129635`

## 3 · English Host – Remote play — `7277:113768`
Mirror of §2 for remote, plus the **multi-camera grid layouts** (the key remote-only artifact).

- **Camera grids** ⚠️(critical for SPEC §6.2): `2 שחקנים` `7277:131493` · `3 שחקנים` `7277:131458` ·
  `4 שחקנים` `7277:131524` · `שחקן 3` `7277:131552`
- **Gifts (self + players)** `תצוגת מתנות עבורי ועבור שחקנים` `7277:132001`
- Create/permissions/invite/summary/practice/live/in-stream-invite/exit flow mirrors §2
  (node IDs `7277:113823 … 117128`; same step names).
- `3 פיד ראשי` (main feed entry) `7277:113770`

## 4 · English Viewer – Remote play — `7097:45650`
Viewer side of remote, with the **grid as seen by viewers**.

- **Grid views:** `2 שחקנים` `7014:29794` · `3 שחקנים` `7014:29603` · `4 שחקנים` `7014:29966` · `שחקן 1` `7014:30858`
- **Gifts from other viewers** `תצוגת המתנות שנשלחו ע"י צופים אחרים` `7014:30025`
- Profile preview/full + follow tabs (`view profile` `7088:52926/52975`; `מומלץ/עוקבים/במעקב`
  `7088:53068/53048/53024`); **Chat from stream** `Chat Screen` `7088:53089`
- Numbered states `18` `7082:36771`, `19` `7082:36755`; moderator `מנחה` `7014:32117`, `7014:32822`
- **Settings (viewer-context)** `settings` `7513:105954/105989/106087`
- ⬚ Many unlabeled states `1000217770…810`.

## 5 · English Mendator – Close-up game — `7097:51662`
Moderator (note Figma's misspelling "Mendator"). **Confirms SPEC §6.4.**

- **Join lifecycle:** `entering` `7097:51677/51696` · `rejected` `7097:51715` ·
  `dialog for enter to live` `7097:51741`
- **Question Composer:** `new question` `7097:53517`, `7097:53677`; `drafts of questions` `7097:53654`;
  `questions from viewers` `7097:53630` + editing `7097:53566`; `waiting questions for answers`
  `7097:51953`, `7097:53726`
- **Player management:** `view all the players` `7097:51824/51862`; `mute players` `7097:51913`
- **Gifts:** `View gifts sent by other viewers` `7097:53035`; `View of gifts sent for mendator` `7097:53073`
- **Live** `live` `7097:52065`, `7149:76491`; profile preview/full + follow tabs; `settings` `7281:76456`;
  chats `7282:67827`
- ⬚ Unlabeled `1000217814…828` (reviewed 2026-06-21, **should be named**): close-up moderator main
  `…824`; viewer-questions list `…825` + expanded-edit (Remove/Publish) `…826`; questions-from-viewers (toast)
  `…827`; **Edit Question** (Cancel/Save Changes) `…828`. ⚠️ pre-live `settings` row **"Substitute Host Booking"**
  + the picker (`Substitute Host Booking`, recommended+other viewers, "reserve") = the **moderator-swap** flow →
  see 🔴 **M1**. Composer **publish="Advertising"**, viewer-Q edit **"Which publication"** → Bugs list.

## 6 · English Mendator – Remote play — `7148:62527`
Moderator remote — the richest section (many `live` grid states).

- **Join lifecycle:** `entering` `7148:62535/62552` · `rejected` `7148:62571` ·
  `dialog for enter to live` `7148:62598`
- **Live grid states:** multiple `live` frames `7148:62905 / 69449 / 69654 / 69837 / 70123 / 70326 /
  70580 / 70732 / 70927 / 71125 / 71453 / 71639`
- **Question Composer** (same set as §5): `new question` `7148:64150/64310`; `drafts` `7148:64287`;
  `questions from viewers` `7148:64263` + editing `7148:64199`; `waiting questions` `7148:64359`
- **Gifts for moderator** `View of gifts sent for mendator` `7148:71125/71283`
- `settings` `7148:64434`; chats `7148:64473`; profile + follow tabs
- ⬚ Unlabeled `1000217832…847` (reviewed 2026-06-21): remote 2×2 grid `…837`; **Edit Question** `…843`;
  **moderator-swap picker** "Substitute Host Booking" `…844`; **handover start** ("approved … Start handover")
  `…847`. ⚠️ same swap-naming bug **M1** + "as a host" copy on the moderator handover.

## 7 · Coin bank — `7264:84205`  (SPEC §9)
- **Balance / main:** `יתרת הבנק מתוך פרופיל` (balance from profile) `7264:84785`;
  back-to-main-with-updated-balance `חזרה למסך הראשי עם עדכון יתרה` `7274:99268`, `7274:102692`
- **Purchase (low):** `רכישה בסכום נמוך_1/_2` `7264:84999`, `7264:84956`
- **Purchase (high):** `רכישה בסכום גבוה_1/_2` `7264:84914`, `7264:84871`;
  add-quantity-high `הוספת כמות בסכום גבוה_3` `7274:102840`
- **Purchase steps:** `רכישת מטבעות_1` `7264:84743`; `בחירת רכישת מטבעות_2` `7274:99127`;
  `סיום רכישת מטבעות_3` (purchase done) `7264:84639`
- **Transactions:** list `עסקאות` `7264:84404`, `7274:106046`; range picker
  `בחירת טווח עסקאות` `7264:84311`, `7274:106335`; history `היסטוריית שימושים` `7264:84465`;
  empty `כאשר אין היסטוריית שימושים` `7264:84441`
- ⚠️ **No `Stripe` vs `IAP` payment-sheet screen labeled here** — resolve gap #5 (payments) before building.

## 8 · Profile — `7435:83711`  (SPEC §10.1)
- **View** `view profile` `7435:83712`; **menu (hamburger)** `menu` `7435:84163`
- **Edit profile** steps 1–8 `7435:83752 / 83782 / 83918 / 83955 / 84002 / 84029 / 84047 / 84067`
  + `Edit profile_3.1` `7435:84118`
- **Add friends** `Adding friends` `7435:84211`; **Share** `Sharing` `7435:84289` / `שתף פרופיל` `7435:84456`
- **Account & settings:** `פרטי החשבון` `7435:84864` · `חשבון` `7435:84440` · `סיסמה` `7435:84880` ·
  `החלפת חשבון` `7435:84737` · `יציאה` `7435:84803` · `נגישות` `7435:84581` · `פרטיות` `7435:84639` ·
  `מדיניות ופרטיות` `7435:84723`
- ⚠️ The PDF profile **variants (roles/personas, schedule)** the client flagged as unclear are **not**
  present as labeled frames here → gap #14 stands (designer clarification needed).

## 9 · English Inbox — `7456:75162`  (SPEC §10.2–10.5) — reviewed 2026-06-23 (see DEEP-DIVE §9)
⚠️ Frames here are **generically auto-named** (`Body`, `Screen Container`, `Main Content Area`,
`Screen with Home Indicator`) — they need a **label pass in Figma** before per-screen acceptance criteria.
Identifiable screens (verified from `.figma-shots/inbox/`):
- **Inbox main (chat list)** — 3 category chips (**New Followers / Live Gifts / System Alerts**) + search +
  rows + unread badges; **search** state ("Results for…"); **empty states** (no messages / no followers /
  no gifts).
- **Category details** — **New Followers** (Follow / Removal rows) · **Live Gifts** (sender + gift + coins +
  Follow + Message) · **System Alerts** ("joined the live broadcast" + Go Live). ⚠️ see DEEP-DIVE I1/I2/I3.
- **Private chat** — `Chats Container` `7456:76429/76509` + `Screen Container` (header: back · avatar · name ·
  flag/report · ⋯; bubbles + timestamps; image/video message + file size; input "Message…" + attach + mic).
- **Media send** — `Body` frames: Select media gallery · camera capture · video preview + caption + Send.
- **Send a contact** — `Main Content Area`: "Contacts for sending" (multi-select) → "Sending contact details".
  🆕 new scope, not in אפיון (DEEP-DIVE I4).
- **Report & block** — "Select a reason" radio list (short + long) → Report / Report-and-block (shared with §1).
- **Find friends / share** — `Search Friends` (Invite Friends · Contact Search · Search Facebook friends) +
  `Share Profile` sheet (Instagram · X · WhatsApp · Facebook · Link · Email) — shared with Profile §8.
- **Permission prompts:** contacts `הרשאה לאנשי קשר` `7456:76618` ("Give the Hypulse app permission…");
  facebook+email `הרשאה לפייסבוק` `7456:76734` (⚠️ body still branded "Game World"); photos
  `הרשאה לתמונות` `7456:77750`; contact sync `סנכרון אנשי קשר` `7456:76851`; `Contacts List Screen` `7456:76384`.
- ~7 inbox screens + ~6 content bodies + ~7 containers (still need real labels) — see `.figma-screen-index.txt`.

## 10 · Additional Player — `7691:45749`  (SPEC §6.2 secondary player · spec `אפיון: שחקן נוסף` pp.41–45)
- **Live main** `מסך ראשי של השידור` `7691:45261`, `7691:45294`
- **Join lifecycle:** `entering` `7691:45327/45344` · `rejected` `7691:45363` ·
  `dialog for enter to live` `7691:45389`
- **Settings** `הגדרות ופרטיות כללי` `7691:45425`
- 🆕 **Practice mode (~30 s)** (exported 2026-06-19, **node IDs need capture**): `מצב תרגול` /
  `מצב תרגול כבוי` / `הסבר מצב תרגול` / `מעבר לשידור`. + cross-cutting alerts `התראה על מצב שקט`,
  `התראה על בקרת משחק…` (overlays; the host versions are `7090:129364` / `7983:85719`).
- ⚠️ **Grid = remote only, and the remote frames here are MISSING** — the `2/3/4 שחקנים` exported into
  `.figma-shots/player/` are the **viewer** grid (viewer controls). No additional-player-remote frame exists.
  See C2 + the Multi-Camera Grid epic in [DEEP-DIVE.md](../notes/DEEP-DIVE.md). **Close-up has no grid** (single video
  + avatars row).

## 11 · Home/Feed — `7705:45750`  (SPEC §6.5)
- `01` `7014:32765` · `02` `7014:32749` — the two feed states (the StreamCard list entry point).

## 12 · System Messages — `7097:49329`
- Answer-picked notice `הודעה לצופה ששלח את השאלה שנבחרה` `7014:28733`
- Game paused `בזמן השהית המשחק` `7014:31018` · two message bodies `Body` `7014:31391`, `7025:99259`

## 13 · Viewer – In-stream Animation & End-of-game Popup — `7816:57287`  (SPEC §6.3)
- **In-stream animation (per-question — KEPT):** win `אנימציה תוך שידורית - זכייה` `7794:56955`; loss `…הפסד` `7794:57023`
- **End-of-game popup — ❌ DROPPED (D-17, Sara 2026-07-27):** game end → straight to feed, no summary popup. The
  frames below are **no longer to be built:** win `פופ-אפ סיום משחק - זכייה` `7794:57091`; loss/neutral
  `…הפסד / ניטרלי` `7794:57127`; no-bets `פופ-אפ סיום משחק - ללא הימורים` `7829:46377`.

## 14 · Registration — `7721:90563`  (SPEC §4.1)
- `הרשמה` (registration) `7721:90564` — single frame.

## 15 · Birthday — `7741:96354`  ⚠️ NEW
- `10` `7741:96566` — the **birthday/DOB gate** screen (SPEC §4.3 describes it but had no Figma node).
  This is screen `10`, i.e. it slots into the Viewer storyboard numbering between `09` and `11`.

---

## Open per-screen label tasks (for a future Figma pass)
1. **Inbox §9** — rename generic `Body`/`Screen Container`/`Main Content Area` frames to real screen names.
2. **Unlabeled `1000217xxx` states** across Viewer/Moderator sections — give them descriptive names.
3. Decide whether duplicate same-named frames (e.g. two `סיכום פרטי המשחק`) are RTL/LTR variants or
   distinct states, and suffix accordingly.

> The full raw index (every frame incl. noise) is in `.figma-screen-index.txt` (git-ignored scratch).
