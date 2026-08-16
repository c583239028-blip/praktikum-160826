# D-01 — בעלות אירועי סטרים: איזה מישור io נושא `STREAM.*`?

> בריף הכרעה, אומת מול `origin/main` ב-26.7.2026. נכתב לקראת סשן ההכרעה (TL + Devoiry).
> מקור: [FINDINGS.md](../FINDINGS.md) טבלת עצירה משותפת D-01. תלויים: M4-03, M4-04, M4-06, M4-09, M7-01.

---

## ההכרעה הנדרשת (משפט אחד)

**על איזה מישור socket.io נשלחים אירועי `STREAM.*` (JOIN/CONSUME/RESUME), וכיצד לקוח מגיע לחדר הנכון בכל מישור כך ש*גם* השאלות *וגם* הווידאו יגיעו אליו — כאשר קיימים שני שרתי io נפרדים בלי adapter משותף.**

---

## מצב נוכחי מאומת (`origin/main`)

### שני שרתי io נפרדים, אין adapter משותף
| מישור | קובץ | מה מצרף (rooms) | מה נושא |
|---|---|---|---|
| **APP io** | `server/src/services/socket.service.js:23` | `user.id` (:34) · `gameId` (`game.handler.js:61,80`) | GAME.* · שאלות (`question.controller.js:41` `io.to(gameId).emit(NEW_QUESTION)`) · הימור (`PLACE_BET`) · `game_status_update` (:46) |
| **MEDIA io** | `media-server/index.js:21` | `streamId` דרך `streams[streamId]` map + `socket.join(streamId)` | **כל** ה-`STREAM.*` (INIT_BROADCAST/CREATE_ROOM/CREATE_TRANSPORT/PRODUCE/JOIN/CONSUME/RESUME/ENDED) — `stream.handler.js` |

### 🔧 עדכון 26.7 — SCRUM-239 מוזג במהלך היום; מישור הווידאו נסגר בכיוון ג'
PR #203 (SCRUM-239, `7234991`) מוזג **מעל** #205 במהלך 26.7. מצב `origin/main` **עכשיו**:
- ✅ **וידאו פתור (Option C):** `ViewerScreen.js:18,78` = `emitMediaPromise(STREAM.JOIN)`; `BroadcastScreen.js:11,38,44` = `emitMediaPromise`; handlers רק על media-server.
- ⏳ **PlayerScreen עדיין `emitPromise`** (`:39,47`, CONSUME/RESUME על app) — מכוון, סקופ SCRUM-224.
- 🔴 **מישור השאלות לצופה לא מחווט (החצי השני של D-01):** ViewerScreen לא מצטרף לחדר `gameId`, לא מאזין ל-`GAME.NEW_QUESTION`; השאלות נפלטות ל-`io.to(gameId)` בלבד → הצופה מקבל וידאו אך לא שאלות.
- ⚠️ Jira 239 עדיין "In Review" למרות המיזוג — להעביר ל-Done.

> ⇒ **D-01 הוכרע חלקית בקוד לטובת ג' (וידאו).** נותר להכריע רק את **מישור השאלות לצופה**: (א) הצופה מצטרף ל-`gameId` room בעזרת ה-`gameId` שחוזר מ-`STREAM.JOIN` (ג' טהור, שינוי לקוח קטן) — מומלץ; או (ב) 230 (fan-out ל-`streamId`, נעדר מ-main, לא עקבי עם ג').

**מצב היסטורי (בתחילת 26.7, main=#205 — לפני מיזוג 239):**
- **מסכי פרודקשן** `ViewerScreen`/`PlayerScreen`: שלחו `STREAM.JOIN/CONSUME/RESUME` דרך `emitPromise` = **סוקט האפליקציה** → אין שם handler → ה-ack לא חוזר → נתקע.
- **קוד תקין** `useRemoteStreams`/`useHostBroadcast`/`viewer_test`: `emitMediaPromise` = **סוקט המדיה** → נכון.
- כלומר: **אותם קבועי `STREAM.*` נפלטים על שני סוקטים שונים ע"י קוראים שונים.** זו לא רק תיאוריה — זו סתירה חיה בקוד.

### רמזים ארכיטקטוניים קיימים
- `STREAM.JOIN` על המדיה **כבר מחזיר `gameId`** (`stream.handler.js`: `gameId: game?.id`) — הלקוח יכול להשתמש בו כדי להצטרף לחדר ה-`gameId` על ה-app io לצורך שאלות. **זהו בדיוק החוליה החסרה של אפשרות ג'.**
- **`STREAM.WATCH` לא קיים** בשום מקום (grep = 0). השאלות נפלטות ל-`io.to(gameId)` בלבד, לא ל-`streamId`.

### ⚠️ פער חדש שצץ באימות (26.7) — תוכנית SCRUM-230 אינה על `main`
SCRUM-230 מסומן **Done** ב-Jira, והתכנון היה: הצופה מצטרף דרך אירוע `STREAM.WATCH` → `socket.join(streamId)` על ה-app io + fan-out שאלות לחדר ה-`streamId` (Option B). **אך על `origin/main` (26.7):**
- אין `socket.join(streamId)` על שרת האפליקציה · אין handler ל-`WATCH` · אין `stream_paused`/`io.to(streamId)` על ה-app io (grep = 0 לכולם).
- השאלות נפלטות ל-`io.to(gameId)` (`question.controller.js:41`), לא ל-`streamId`.

כלומר **מישור ה-"stream-room" של 230 נעדר מ-main** — עוד מקרה של "Done ב-Jira אך לא במיזוג" (זהה לדפוס M4-06). ⇒ **בפועל היום, הצופה זקוק לחברות בחדר ה-`gameId` על ה-app io** כדי לקבל שאלות. זה מחזק את אפשרות ג' (הלקוח מצטרף ל-`gameId` room עם ה-gameId שחוזר מ-`STREAM.JOIN`), ומייתר את מסלול ה-`streamId`-room/WATCH. **טעון וידוא נפרד: האם 230 נסוג בשכתוב ה-HLS (#205) או שמעולם לא מוזג בצורה זו.**

- **הפרדת הדרופלטים מכוונת** — mediasoup צרכן כבד, פוצל מראש לדרופלט מדיה ייעודי (ראו `project-media-server-droplet-architecture`). איחוד ל-io אחד סותר את החלטת הפריסה.

---

## שלוש האפשרויות

| # | גישה | מה נדרש | יתרונות | חסרונות / סיכון |
|---|---|---|---|---|
| **א** | **איחוד ל-io אחד** | למזג mediasoup לשרת האפליקציה (או להפך) | פשטות מנטלית; fan-out יחיד | סותר את הפרדת הדרופלטים המכוונת; mediasoup כבד על שרת האפליקציה; שכתוב נרחב |
| **ב** | **גשר server→server + adapter משותף** (Redis) | Redis adapter לשני ה-io + ערוץ app→media | פותר גם `STREAM.*` וגם fan-out חוצה-שרת (כולל D-02 mute) | תשתית חדשה (Redis) + ops; over-engineering אם רק הלקוח צריך לגשר |
| **ג** | **הלקוח הוא הגשר** (מומלץ) | `STREAM.*` **אך ורק** ל-`emitMediaPromise`; השאלות נשארות על ה-app socket; הלקוח משתמש ב-`gameId` שחוזר מ-`STREAM.JOIN` כדי להצטרף גם לחדר ה-`gameId` על ה-app io | תואם את מיקום ה-handlers הקיים · תואם את `gameId`-החוזר · תואם הפרדת הדרופלטים · **בלי תשתית חדשה** · זה כבר הכיוון של SCRUM-239 | הלקוח מנהל שני סוקטים; חובה rejoin לשניהם ב-reconnect (SCRUM-286); **לא פותר D-02** (mute server→media) — נשאר ערוץ server-side נפרד |

---

## מצב הטיקטים (מאומת מול Jira, 26.7)

| טיקט | סטטוס | בעלים | רלוונטיות |
|---|---|---|---|
| **SCRUM-239** `INFRA/fix/stream-socket-routing` | **מוזג** (PR #203, `7234991`, 26.7) — Jira עדיין "In Review" | ריקי | **מימש את אפשרות ג' למישור הווידאו** (ViewerScreen+BroadcastScreen). לא כולל PlayerScreen (224) ולא את מישור השאלות לצופה. |
| SCRUM-230 `fix/fan-out-questions-to-stream-room` | Done | ריקי | שאלות נפלטות ל-`gameId` room (app io) |
| SCRUM-224 `J2/feat/player-stream-integration` | Approved with comments | שרי וולפא | מעביר consume ל-`useRemoteStreams` (media socket) — תלוי בהכרעה |
| SCRUM-203 `tl/review-camera-grid-signaling` | To Do | **שרה אבר (את)** | **זהו כלי ההכרעה שלך כ-TL** |
| SCRUM-286 `INFRA/fix/socket-room-rejoin-on-reconnect` | To Do | **ללא בעלים** | תנאי עמידות לאפשרות ג' — צריך בעלים |

---

## המלצה

**אפשרות ג' (הלקוח כגשר)** — מהסיבות: ה-handlers כבר יושבים על המדיה, `STREAM.JOIN` כבר מחזיר `gameId`, הפריסה כבר מפוצלת, ואין צורך בתשתית חדשה. זה גם הכיוון של SCRUM-239 שכבר ב-review — ההכרעה בעיקר **מאשררת ומנעילה** אותו כדי ש-224 ו-203 יוכלו להתקדם.

**שתי אזהרות שההכרעה חייבת לכלול:**
1. **D-02 (mute, M7-01) לא נפתר ע"י אפשרות ג'.** אכיפת השתקה היא server(app)→server(media), לא לקוח→מדיה. גם אחרי ג' צריך ערוצ server-side נפרד (או Redis של אפשרות ב' רק לזה). לא לסגור D-02 כ"נגזר מ-D-01".
2. **עמידות reconnect (SCRUM-286) היא תנאי, לא נוחות.** באפשרות ג' הלקוח חייב rejoin לשני החדרים (gameId על app, streamId על media) אחרי כל ניתוק, אחרת שאלות/וידאו מתים בשקט. צריך בעלים ל-286.

---

## מי מכריע / מי מושפע
- **מכריעים:** TL (שרה אבר) + Devoiry (בעלת שכבת ה-WebRTC/media).
- **מושפעים ישירות:** SCRUM-224 (שרי וולפא — מסכים צורכים) · SCRUM-239 (ריקי) · SCRUM-286 (חסר בעלים).
- **אחרי ההכרעה:** להעביר ל-[DECISIONS.md](../spec/screen-specs/DECISIONS.md), ולשחרר את M4-03/04/06/09 להמשך.
