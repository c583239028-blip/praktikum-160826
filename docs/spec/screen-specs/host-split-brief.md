# בריף — פירוק מסך המארח לקומפוננטות (לריקי)

> מקורות: `HostScreen.js` הקיים · `FIGMA-SCREENS.md §2` · `.figma-shots/host/` · ניתוח 2026-07-05.
> קובץ פיגמה: `WorId-Game (Shira)` — `FBQSv16ajir03ZAtRbuHxb`. **בקישור משתמשים ב-`-` ולא ב-`:`** ב-node-id.

---

## 0 · עיקרון-העל (לקרוא לפני הכל)

1. **את הלוגיקה בזמן-אמת לא נוגעים — רק מעבירים** ל-hook אחד, שורה-לשורה.
2. **את ה-UI בונים מחדש בהיר** (design.js). מסך השידור החי **נשאר כהה**.
3. **קומפוננטה אחת נשארת "חיה" לאורך כל הזרימה.** צעדי האשף הם תת-קומפוננטות מוצגות בתוך container אחד — **לא** routes נפרדים. אחרת ה-unmount מפעיל cleanup ומאבד את ה-refs/מדיה.
4. **הסטור מחזיק זהות-סשן בלבד; הטופס נשאר מקומי.** ה-draft לא נכנס ל-redux עד ה-go-live.

---

## 1 · 🔴 שלב 0 — התלות החוסמת (לפני הכל)

`gameStream` **לא רשום** ב-`store/index.js` (רק wallet/inbox/history). לכן `useSelector(s => s.gameStream)` **קורס** היום — המסך חסום ברמת ריצה. זה **SCRUM-185**.

**מה לעשות:** לוודא ש-SCRUM-185 נחת (רישום `gameStream` reducer), או להוסיף את השורה כתלות מוצהרת. **כל טיקט של המסך הזה נושא את התלות ב-SCRUM-185 במפורש.**

---

## 2 · 🎨 מסכי הפיגמה לעיצוב (node IDs)

בסיס הקישור: `https://www.figma.com/design/FBQSv16ajir03ZAtRbuHxb/WorId-Game--Shira-?node-id=<NODE>`
(root של זרימת המארח: `7083-97876`.)

### אשף היצירה — **תמה בהירה** (לעצב מחדש):

| # | קומפוננטה | node ראשי | גרסאות מצב נוספות | מה לעצב |
|---|-----------|-----------|-------------------|---------|
| 1 | `SelectGameTypeStep` | `7083-121649` | `7083-121703` (בחירת "מקרוב"/close-up) | 2 אריחי בחירה; **רימוט disabled** השבוע |
| 2 | `GameNameStep` | `7083-121624` | `7083-121045` (`_2`) | שדה שם יחיד, required; **בלי תיאור** |
| 3 | `InviteModeratorStep` | `7083-122000` | `7083-122182` · `7083-122369` · `7083-122396` (מצבי `_1..4`) | שדה מזהה מנחה, אופציונלי; אפשר לדלג |
| 4 | `GameSummaryStep` | `7083-122508` | `7140-62037` | סיכום read-only + כפתור "עבור לשידור" |

### מסך השידור + יציאה — **תמה כהה** (מעבירים, עיצוב מינימלי):

| # | קומפוננטה | node ראשי | הערה |
|---|-----------|-----------|------|
| 5 | `LiveBroadcastScreen` | `7090-129289` | מסך ראשי של השידור (כהה) |
| 6 | `ExitConfirmModal` | `7090-129635` | אישור יציאה. כניסה: `7090-130543` (`יציאה מהשידור`) |

> **ProgressDots:** מספר הנקודות נגזר **בדיוק מהפריימים לעיל** — ספרי בשוט, אל תמציאי מספר.
>
> **מחוץ לטווח (יש בפיגמה, לא בונים):** הרשאות (`7083-121185/121332/121478`), הזמנת שחקנים (`7083-121757/122433/121809/121896`), QR (`7083-122752`), שיתוף (`7083-122821`), מצב תרגול (`7090-129203/129243/129410/129464`), איכות (`7090-129745`), ניהול (`7090-129687`), הזמנות תוך-שידור, מתנות, התראת בקרת-דיווחים (`7983-85719`).

---

## 3 · מבנה התיקיות היעד

```
packages/client/src/
├─ screens/host/
│  ├─ HostFlow.js                 ← ⭐ קומפוננטת-העל (container + state machine)
│  ├─ steps/
│  │  ├─ SelectGameTypeStep.js    ← 7083-121649
│  │  ├─ GameNameStep.js          ← 7083-121624
│  │  ├─ InviteModeratorStep.js   ← 7083-122000
│  │  └─ GameSummaryStep.js       ← 7083-122508
│  ├─ live/
│  │  ├─ LiveBroadcastScreen.js   ← 7090-129289 (כהה)
│  │  └─ ExitConfirmModal.js      ← 7090-129635 (כהה)
│  └─ components/
│     ├─ WizardShell.js           ← מסגרת בהירה + כותרת + חזור
│     ├─ ProgressDots.js          ← נקודות התקדמות
│     └─ GameTypeCard.js          ← אריח בחירה קלוז-אפ/רימוט
└─ hooks/
   ├─ useHostBroadcast.js         ← ⚙️ כל לוגיקת השידור (מעבירים, לא נוגעים)
   └─ useCreateGame.js            ← ⚙️ עוטף createAndStartGame
```

`HostScreen.js` הישן **נמחק** בסוף.

---

## 4 · ⭐ קומפוננטת-העל — `HostFlow.js` (הוראות, לא קוד)

צרי קומפוננטה שהיא **state machine, לא UI**:
- מחזיקה `step` עם המצבים `TYPE → NAME → MODERATOR → SUMMARY → LIVE`.
- מחזיקה draft ב-`useState` מקומי: `title`, `gameType` (ברירת מחדל `CLOSEUP`), `moderatorId`. **בלי `description`.**
- קוראת ל-`useHostBroadcast()` ו-`useCreateGame()`.
- מגדירה `goLive`: קוראת `createGame({title, gameType, moderatorId})`; **רק אם הצליח** מקדמת `step` ל-`LIVE`.
- מרנדרת לפי `step` את הצעד המתאים, ומעבירה לכל צעד **רק** props רלוונטיים + `onNext`/`onBack` (ל-Summary גם `loading`, `error`, `onGoLive`; ל-LIVE מה ש-`useHostBroadcast` מחזיר).
- עוטפת את הכניסה ב-`guardedAction` (auth gate).

**חוזה ניווט:** TYPE→NAME→MODERATOR→SUMMARY קדימה עם חזור; SUMMARY→LIVE **רק דרך** `goLive` מוצלח. אין מעבר ל-LIVE בלי `gameId/streamId` בסטור.

---

## 5 · שכבת הסטור (איך אנחנו עובדים כאן)

**גבול ברזל: draft ≠ session.**
- `title/gameType/moderatorId` → **state מקומי** ב-HostFlow. **לא ב-redux** (לא משותף, לא צריך לשרוד יציאה, לא server-state; ה-container הפרסיסטנטי ממילא משמר אותם בין הצעדים).
- הסטור מחזיק זהות-סשן בלבד: `gameId, streamId, role, status`. ה-draft נכנס אליו **רק** ב-go-live דרך ה-thunk.

**מי נוגע במה:**

| Hook | קורא מהסטור | כותב לסטור |
|---|---|---|
| `useCreateGame` | — | `createAndStartGame` → `initGameSession({gameId,streamId,role:'HOST'})` + `setStreamStatus('ACTIVE')` |
| `useHostBroadcast` | `gameId, streamId, status` | `setStreamStatus('ACTIVE')` (ב-startBroadcast) · `resetSession()` (ב-endAndCleanup) |

**לא נוגעים:** `isFrozen / activeProducers / updateActiveStreams` — צופה/multi-cam. חיווט socket→gameStream = SCRUM-185, מחוץ לטווח.

---

## 6 · ה-Hooks (חוזה בלבד)

**`useHostBroadcast.js`** — העבירי לתוכו את **כל** "Phase 2" מ-HostScreen (state 43-48, refs 50-55, אפקטים 57-86, `stopLocalMedia/endAndCleanup/startBroadcast/confirmEndStream`) + selector של `gameId/streamId`. **אל תשני פנימיות — רק גזרי והדביקי.**
- מחזיר את כל מה ש-`LiveBroadcastScreen` צריך: סטייטי תצוגה (`localStream, status, isLive, isClosing, viewerCount, showEndConfirm`) + פעולות (`startBroadcast`, בקשת-סיום, אישור, ביטול). **שמות ה-props הסופיים — לשיקולך**, כל עוד מכסים את כל מה שה-JSX משתמש בו היום.

**`useCreateGame.js`** — עוטף `handleCreateGame` (132-153). מקבל `{title, gameType, moderatorId}`, מריץ `dispatch(createAndStartGame(...))`, מחזיק `creating`+`createError`, **מחזיר boolean**. **בלי `description`.**

---

## 7 · צעדי האשף + מסך השידור (חוזה)

**4 צעדי אשף** — תת-קומפוננטות "טיפשות": `value / onChange / onNext / onBack` בלבד. אין מדיה, אין redux. כולן עטופות ב-`WizardShell` (רקע בהיר + כותרת + `ProgressDots`). עיצוב מ-design.js — **לא** מעתיקים `SURFACE_DARK/INPUT`.
- `SelectGameTypeStep`: 2 אריחי `GameTypeCard`, רימוט disabled.
- `GameNameStep`: שדה שם, ולידציית ריק (כמו 133-136).
- `InviteModeratorStep`: מזהה מנחה אופציונלי, אפשר לדלג.
- `GameSummaryStep`: סיכום read-only + "עבור לשידור" → `onGoLive`, מציג loading/error.

**`LiveBroadcastScreen.js`** — ה-JSX הכהה (302-350): header + LiveIndicator + videoBox + controls. **נשאר כהה** (`SURFACE_VIDEO/DARK` כאן ורק כאן). מקבל הכל כ-props מ-`useHostBroadcast`. אפס לוגיקת מדיה בפנים.
**`ExitConfirmModal.js`** — ה-Modal (352-382): `visible, onConfirm, onCancel`.

---

## 8 · פרימיטיבים

**ליצור:** `WizardShell` (מסגרת בהירה + כותרת + חזור + ProgressDots + children) · `ProgressDots` (מספר נקודות לפי פיגמה) · `GameTypeCard` (אריח יחיד, נבחר/מושבת).

**קיימים בענף** (`Btn.js`, `Field.js`, `Badge`, `LiveIndicator`): `Btn`/`Field` **כהים בהארד-קוד** — לא מתאימים לאשף הבהיר. **אל תשכפלי.** תיאמי מול K1 והפכי אותם **theme-aware** (`Btn` כבר מקבל `color`; ל-`Field` הוסיפי `variant='light'|'dark'`). `LiveIndicator` נשאר לשידור הכהה.

---

## 9 · במה לא לגעת / מה כן לשנות

**ידיים למעלה:** הרצף הפנימי של `startBroadcast` · `endAndCleanup`+guards+סדר · cleanup-on-unmount (נשאר ב-HostFlow) · `createAndStartGame`/`gameStreamSlice`/`MediasoupManager`/`socket.service`.

**כן משנים בכוונה:** שלב 0 (רישום gameStream) · שער auth בכניסה (רגרסיה מ-BroadcastScreen) · הורדת שדה תיאור · תמה בהירה + ProgressDots · פרימיטיבים theme-aware.
**עודף `setStreamStatus('ACTIVE')`** (thunk + startBroadcast) — להשאיר; ניקוי רק באישור.

---

## 10 · מפת הגירה מ-`HostScreen.js`

| שורות ישנות | לאן | פעולה |
|---|---|---|
| 43-128 | `useHostBroadcast.js` | העברה מדויקת |
| 157-216 | `useHostBroadcast.js` | העברה, לא לגעת בפנים |
| 132-153 | `useCreateGame.js` | העברה, בלי `description` |
| 35-40 | `HostFlow.js` (minus `description`) | פיצול לפי צעד |
| 221-297 | `steps/*` | עיצוב מחדש בהיר |
| 302-350 | `live/LiveBroadcastScreen.js` | העברה, כהה |
| 352-382 | `live/ExitConfirmModal.js` | העברה, כהה |
| 390-393 `SURFACE_*` | רק live/modal | שאר → design.js |
| כל הקובץ | — | נמחק בסוף |

---

## 11 · סדר עבודה (commit אחרי כל שלב)

0. ודאי `gameStream` רשום ב-store (SCRUM-185).
1. חלץ `useHostBroadcast`, חברי חזרה ל-HostScreen. אמתי שידור. *(zero-regression)*
2. חלץ `useCreateGame` (בלי description). אמתי יצירה.
3. בני `LiveBroadcastScreen` + `ExitConfirmModal`. אמתי חזותית.
4. שלד `HostFlow` עם `step` + placeholders. אמתי ניווט.
5. `WizardShell` + `ProgressDots` בהירים.
6. `GameTypeCard` + `SelectGameTypeStep` (רימוט disabled).
7. `GameNameStep` (ולידציה).
8. `InviteModeratorStep`.
9. `GameSummaryStep` + "עבור לשידור" → goLive → LIVE.
10. חברי `LiveBroadcastScreen` דרך `useHostBroadcast`.
11. שער auth בכניסה.
12. theme-aware לפרימיטיבים (תיאום K1).
13. מחקי `HostScreen.js`, כווני route ל-`HostFlow`.
14. רגרסיה מלאה (סקריפט בדיקה, Android): יצירה→4 צעדים→go-live→שידור→סיום→cleanup. אין `*_test.js` דולף.

---

## 12 · תלויות

- 🔴 **SCRUM-185** (רישום gameStream) — חוסם את כל המסך. prerequisite קשיח בכל טיקט.
- 🟠 **טיקט ROUTE נפרד** מקושר ל-SCRUM-185 (`joinGame` + socket→gameStream + מעבר `game_screen` + פרישת `live.js`) — **לא של ריקי.**
