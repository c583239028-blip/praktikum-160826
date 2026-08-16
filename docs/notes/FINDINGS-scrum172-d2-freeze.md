# FINDINGS — SCRUM-172 (D2): freeze/resume פיד הצופה

> נכתב 2026-07-20 בעקבות שאלת דבורי (19.7) על SCRUM-172.
> מבוסס על שליפה **חיה** מ-Jira (REST v3) של 172/230/239/232/244 + קריאת קוד ישירה.
> כל הפניה לקוד אומתה בקריאה, לא דרך סוכן.

---

## 0. סטטוס השאלות — מה כבר סגור ומה פתוח

| שאלה של דבורי | סטטוס |
|---|---|
| **#4 (16.7): ניקוי `FINISHED` ב-`updateGameStatus`/`cancelOldGames`** | ✅ **כבר נענתה על ידך ב-Jira, 16.7 10:23.** ההחלטה: `cancelFreeze` (לא `performResume`), לקרוא בשני המקומות, לולאה על streamId ב-`cancelOldGames`. ניתוח עצמאי שלי הגיע לאותו פתרון. **אין צורך לענות שוב.** |
| **מגבלת setTimeout-לא-שורד-restart (14.7)** | ✅ כבר נענתה 15.7 → **SCRUM-257** (recovery job + `pauseExpiresAt`). מחוץ ל-D2. |
| **#1-#3 (19.7): JOIN באמצע freeze — auth / מיקום endpoint / סקופ** | 🟡 **פתוחה. זו השאלה היחידה שדורשת תשובה.** ראה §2. |

---

## 1. מה D2 (172) אמור לעשות — לפי התיאור החי + הבהרות ה-TL

"טריגר בלבד" (הבהרת TL, 10.7). לא המדיה (244), לא הנגן (171).

- `addQuestion` לא-טיוטה → `performFreeze`: `status=PAUSE`, `lastPausedAt=now`, טיימר `timeLimit`, איתות main→media.
- תום הזמן → `performResume`: `status=LIVE`, `accumulatedPauseMs+=`, `lastPausedAt=null`, איתות main→media.
- resume לפי סיום הזמן בלבד, לא `resolveQuestion`.
- **AC5 (מאושר 16.7):** למחוק בפועל את `POST /question-pause` (`stream.routes.js:13`) ואת `handleQuestionPause` — לא רק להוסיף במקום השני. אחרת שני מסלולי freeze מתחרים.
- **מקרי יציאה (מאושר 16.7):** `cancelFreeze(streamId)` = לבטל טיימר + לסגור `accumulatedPauseMs` ב-DB + **לא לגעת בסטטוס** (game.service כבר מסמן FINISHED). לא פולט אירועים, לא מאתת למדיה.

**מודל ה"הלקוח לא עושה כלום" (TL, 10.7 09:38):** freeze = 244 מפסיק להוסיף סגמנטים ל-playlist → נגן ה-HLS נתקע מעצמו. resume = 244 מוסיף את הנצבר → catch-up. הלקוח לא מפעיל שום pause. `accumulatedPauseMs` = ה-lag שמזין את גודל ה-buffer של 244.

⇒ **D2 = server-only. אפס נגיעה בלקוח / Redux / UI.**

---

## 2. השאלה הפתוחה (JOIN באמצע freeze) — התשובה

דבורי מצאה ש-`STREAM.JOIN` (media-server) לא מחזיר מצב סטרים, והציעה endpoint חדש `GET /streams/:id/status` ש-media→main קורא לו, + צירוף `streamStatus` ל-callback. משם 3 שאלות: auth, מיקום, סקופ.

**כל השלוש נשענות על הנחה אחת — ש-media-server חייב לשאול את main. ההנחה קורסת:**

1. **תחת מודל ה-TL עצמו (הלקוח לא עושה כלום), אין AC שדורש שדה ב-JOIN ack.** late-joiner מושך את אותו `index.m3u8` הקפוא → הנגן תוקע מעצמו. ה-freeze **אינהרנטי לפלייליסט** (244), לא שדה שהלקוח קורא. "מאיזו נקודה" = `accumulatedPauseMs`, שנצרך ע"י **244** (המדיה), לא הלקוח.

2. **ל-media-server יש Prisma משלו והוא כבר קורא `Stream` ישירות** (`stream.handler.js:6`, `:420`, `:496`). גם אם 244 יצטרך את המצב — הוא קורא אותו **מה-DB ישירות**, לא דרך endpoint חדש על main. ⇒ **שלוש השאלות (auth/מיקום/סקופ) מתייתרות: אין מה לבנות.**

3. **בלבול מישורים:** ה-`STREAM.JOIN` שדבורי מסתכלת עליו (media-server) הוא **מישור הווידאו** (mediasoup). לצופה ההמוני הווידאו הוא HLS (244), וה-JOIN הזה ממילא עובר ל-media socket ב-**SCRUM-239**. לתלות מצב-freeze על ה-mediasoup JOIN ack = מישור שגוי + מיותר.

4. **"late-joiner רואה את כרטיס השאלה"** — דרישה אמיתית, אבל היא **230 (fan-out) + 232 (viewer consume)**, לא D2.

**מסקנה:** AC6 מסופק ע"י (א) D2 כותב `status/lastPausedAt/accumulatedPauseMs` ל-DB + (ב) 244 קורא אותם לבניית פלייליסט קפוא + buffer. **בלי endpoint, בלי JOIN-ack, בלי auth, בלי שינוי לקוח.** דבורי עוצרת בשרת — וגם שלב 2 שהציעה מיותר.

⚠️ נקודת תיאום יחידה: לוודא מול אלישבע (244) שהיא קוראת `lastPausedAt`/`accumulatedPauseMs` מה-DB. אם כן — D2 = "state + signal", וסגור.

---

## 3. מפת הטיקטים החיה (מ-Jira, 20.7)

| טיקט | מה | בעלים | סטטוס | רלוונטי כי |
|---|---|---|---|---|
| **172** D2 | טריגר freeze/resume | Devoiry | Questions&Clarification | הטיקט הנדון |
| **230** | fan-out שאלות ל-stream room + `STREAM.WATCH` (app socket) | ריקי | To Do | מספק את "late-joiner רואה שאלה". **צ'קליסט נעול 4 קבצים.** חוסם 232 |
| **239** | routing: `STREAM.JOIN`/CONSUME/RESUME → media socket (`emitMediaPromise`) | ריקי | In Progress | מתקן את התקיעה שזיהיתי; **מישור הווידאו** |
| **232** | ViewerScreen צורך activeQuestion | Sara Artzel | To Do | חסום ע"י 230; חסום ע"י **273** (QuestionCard import שבור) |
| **244** | media-server HLS: קומפוזיטינג + catch-up buffer | Elisheva | In Progress | קורא את מצב ה-DB של D2; מספק את ה-freeze בפועל לצופה |
| **257** | recovery job ל-freeze שלא שורד restart | — | (נפתח 15.7) | ה-follow-up של setTimeout |

**הפרדת המישורים (מאושר TL ב-230+239):**
- **מישור וידאו** (239): `STREAM.JOIN` → `emitMediaPromise` (media socket). In Progress.
- **מישור שאלות/סטטוס** (230): אירוע **חדש** `STREAM.WATCH` → `emitPromise` (app socket) → `socket.join(streamId)`. זה מה שמחיה את `stream_paused` המת.
- "streamId room" קיים בשני המישורים על **שני io נפרדים** — זו לא סתירה ולא דורש איחוד (TL, 14.7).

---

## 4. תיקונים לעצמי (איפה טעיתי בשיחה)

1. **תור קודם אמרתי "`emitPromise→emitMediaPromise` היה שגוי".** ❌ התיקון-העצמי עצמו שגוי. 239 (In Progress) **עושה בדיוק את השינוי הזה** לנתיב הווידאו. Option B/230 הוא אירוע נפרד (`STREAM.WATCH`) על ה-app socket — לא שמירת `STREAM.JOIN` על ה-app socket. בלבלתי שני מישורים. ההצעה המקורית שלי (JOIN→media) הייתה **נכונה** ותואמת 239.
2. **הצעתי "למחוק `ViewerScreen:143-148` ב-D2".** ❌ 239 קובע במפורש: המאזינים המתים של `STREAM_PAUSED/RESUMED` — "משאירים כמו שהם; אני [שרה] מטפלת בזה בנפרד". לא סקופ D2.
3. **סיווגתי את התקיעה של ViewerScreen כ"ממצא חדש".** חלקית — הליבה כבר מתועדת ב-230 וב-232 (הערת שרה 9.7: "ה-JOIN על ה-app socket לא מטופל"). לא תגלית.

---

## 5. ממצאים שכן חדשים (לא בטיקטים) — מועמדים לטיקט

| ממצא | ראיה | חומרה |
|---|---|---|
| **`streamService.createStream` לא קיים → `POST /api/streams` מחזיר 500** | `stream.controller.js:47` קורא לפונקציה שלא מיוצאת ב-`stream.service.js`. קוד מת: הזרימה החיה = `createGame` יוצר stream+game בטרנזקציה (`game.service.js:50-93`). הצרכן היחיד = `INIT_BROADCAST` מ-`BroadcastScreen` (legacy "WebRTC Disabled") | נמוכה (קוד מת, לניקוי) |
| **פורט 8000 חשוף בלי auth** | `media-server/index.js:32-45` — `POST /live/stop/:streamId` בלי middleware, פורט פומבי (ref `project-media-server-public-exposure.md`) | גבוהה (אבטחה) |
| **media-server בלי Prisma singleton** | `new PrismaClient()` נקודתי ב-`stream.handler.js:6` + `socketAuth.js:5`; אין `lib/prisma.js`. בשרת: 21 מייבאים סינגלטון מול 10 יוצרים. `socketHelpers.js:33,96` יוצר לקוח בתוך גוף פונקציה (pool per call) | נמוכה (חוב) |

---

## 6. לא-מאומת (לא להגיש כעובדה)

- התקיעה של ViewerScreen ב-`loading` — הוסקה מקריאת קוד; שווה אימות על אנדרואיד. (אבל 239 In Progress מתקן ממילא את הנתיב.)
- עיצוב 244 — האם קורא `lastPausedAt`/`accumulatedPauseMs` מה-DB. משפיע על §2. לתאם עם אלישבע.
