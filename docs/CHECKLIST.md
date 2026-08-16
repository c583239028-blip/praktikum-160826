# רשימת תיוג מערכתית - HyPulse 

מסמך ייחוס: לפני כל PR עוברים על הסעיפים. כל שורה היא שאלה - אם התשובה "לא חשבתי על זה", יש שם פער.
⭐ = הסעיפים שהכי הרבה פעמים נופלים עליהם בפרויקט הזה (לפי באגים והערות שכבר תועדו).

> הטופס שממלאים ועונים עליו לפני העלאה מופיע **אוטומטית בתיאור כל PR** (מקורו ב-`.github/pull_request_template.md`). אין צורך להעלות קובץ — ממלאים בתוך תיאור ה-PR.
> כללי הקוד המחייבים (שמות, SRP, DRY, הערות) נמצאים ב-[CONTRIBUTING.md](CONTRIBUTING.md).

---

## 0. מיפוי השפעה — "באילו שכבות נגעתי?"
הפרויקט הוא monorepo עם 4 חבילות. כל משימה מתחילה בשאלה: אילו מהן משתנות?

- [ ] `packages/client` (React Native / Expo Router) — מסכים, hooks, store, services
- [ ] `packages/server` (Express + Prisma/PostgreSQL + Socket.io) — routes / controller / service / DB
- [ ] `packages/media-server` (Mediasoup WebRTC + FFmpeg→HLS) — שידור, transport, recording
- [ ] `packages/shared` — קבועים ו-Zod schemas משותפים (למשל `socketEvents.js`)

⭐ **כלל הזהב:** אם נגעת ב-2 חבילות, ודאי שהשנייה באמת עודכנה. הבאג הנפוץ ביותר הוא שינוי בצד אחד בלי הצד השני.

---

## 1. קונבנציות קוד (נאכפות אוטומטית ב-CI)
- [ ] ⭐ עברתי על [CONTRIBUTING.md](CONTRIBUTING.md)? (שמות: `camelCase` / `PascalCase` / `UPPER_SNAKE_CASE`)
- [ ] ⭐ קובץ שרת חדש בשם `<domain>.<layer>.js` — וקובץ route הוא `*.routes.js` (**לא** `*.router.js`)?
- [ ] SRP נשמר: `route → controller → service → Prisma`, בלי לוגיקה עסקית ב-route?
- [ ] DRY: קוד חוזר הוצא ל-`utils/` / `services/` / `shared`?
- [ ] אין "מספרי קסם" (magic numbers) — קבועים עם שם?
- [ ] הערות מסבירות **למה**, לא **מה**?

---

## 2. שכבת ה-DB / מודל הנתונים
- [ ] שיניתי את `packages/server/prisma/schema.prisma`? אם כן — יצרתי migration (`npm run migrate`)?
- [ ] הוספתי שדה חדש? מי ממלא אותו? יש ערך ברירת מחדל למשתמשים קיימים?
- [ ] ⭐ השדה צריך להיות `unique`? (תזכורת: `username` היום **לא** ייחודי ב-DB — אל תניחי שהוא כן)
- [ ] ה-migration רץ גם דרך Docker (`db:push` / `migrate`) ולא רק מקומית? הרצתי `npx prisma generate`?
- [ ] seed (`db:seed`) עדיין עובד אחרי השינוי?
- [ ] ⭐ **לא רצתי `ALTER TABLE` ידנית** — כל שינוי ב-DB חייב לעבור `npx prisma migrate dev` ולייצר קובץ migration, אחרת Prisma מאבדת מעקב.
- [ ] ⭐ **פריסה לענן — האם המיגרציה backward-compatible?** ראי [CONTRIBUTING.md §5](CONTRIBUTING.md) לפני שנוגעת בשרת.

---

## 3. שכבת השרת — Route → Controller → Service
- [ ] ה-route החדש רשום ב-`packages/server/src/app.js`?
- [ ] ⭐ הלוגיקה העסקית בתוך ה-**service**, לא ב-route? (route דק)
- [ ] route שדורש אימות מקבל `authenticateToken` מ-`middleware/auth.middleware.js`?
- [ ] קלט מהמשתמש עובר validation? (Zod schemas מ-`shared`, או `services/validation.service.js`)
- [ ] ⭐ קוראת ל-`userId` נכון? ה-middleware תומך גם ב-`decoded.id` וגם ב-`decoded.userId` — אל תניחי פורמט אחד.

---

## 4. הרשאות ותפקידים — אין "HOST גלובלי"
זה הסעיף הכי לא-אינטואיטיבי בפרויקט. **תפקיד הוא תמיד בהקשר**, לא תכונה של החשבון.

- [ ] ⭐ **אסור** לחסום route לפי `req.user.role === 'HOST'`. שדה `User.role` הוא שריד — ברירת מחדל בלבד (ולא עקבי: VIEWER מול PLAYER), אף פעם לא מועלה ל-HOST, ולא משמש כ-gate.
- [ ] הרשאת **stream** = בעלות: `req.user.id === Stream.hostId`.
- [ ] הרשאת **game** = השתתפות: `GameParticipant.role` (HOST/PLAYER/MODERATOR/VIEWER) דרך `services/permissions.service.js` (`ensureHost` / `validateRole`).
- [ ] בדקת מה קורה כשמשתמש **ללא** ההרשאה מנסה את הפעולה (לא רק ה-Happy Flow של הבעלים)?

---

## 5. Real-Time / Socket.io / Media (WebRTC)
- [ ] ⭐ שם האירוע מגיע מ-`packages/shared/src/constants/socketEvents.js` (`SOCKET_EVENTS`) ולא מחרוזת קשיחה? שני הצדדים משתמשים באותו קבוע.
- [ ] אירוע חדש — הוספת אותו ל-`shared` והרצת `npm run build:shared`?
- [ ] ה-socket מאומת? (`middleware/socketAuth.js` בשרת)
- [ ] מה קורה ב-`disconnect`? יש ניקוי חדר/state? (למשל: viewer שמתנתק באמצע — מה עם המטבעות שהמר?)
- [ ] ⭐ **מלכודת WebRTC:** משתמשים **רק** ב-`MediasoupManager.getLocalStream()`. אסור לערבב את `react-native-webrtc` הישן עם `@livekit/react-native-webrtc` — ערבוב מקריס native.
- [ ] ⭐ לא משכפלים קוד מקבצי `*_test.js` (host/player/viewer) — הם scratch לפריסה, לא לפרודקשן.
- [ ] נגעת בסטרים/וידאו — בדקת מול `media-server` בנפרד? בדקת עם **כמה משתמשים במקביל** באותו חדר?

---

## 6. שכבת הקליינט — State / Navigation / Roles
ארבעה תפקידים בפרודקשן, וכל אחד הוא מסך/זרימה אחרת:
**HOST** (משדר + יוצר משחק) · **PLAYER** (גריד מצלמות, מצולם) · **MODERATOR** (מנהל שאלות) · **VIEWER** (צופה + מהמר מטבעות).

- [ ] שינוי state עובר דרך ה-store הנכון (`store/slices/*`) ולא state מקומי שאמור להיות גלובלי?
- [ ] ⭐ פעולה שמחייבת התחברות עטופה ב-`hooks/useAuthGuard.js`?
- [ ] ניווט: התנהגות נכונה גם למשתמש מחובר וגם לאורח?
- [ ] ⭐ בדקת את ההשפעה על **כל התפקיד הרלוונטי** (Host/Player/Moderator/Viewer), לא רק על זה שעבדת עליו?
- [ ] טקסטים חדשים עוברים דרך i18n (`assets/locales`) ולא מחרוזת אנגלית קשיחה?
- [ ] ⭐ בדקת ב-**עברית/RTL** ולא רק באנגלית? (יש באג ידוע של reload-loop ב-RTL — אם נתקעת שם, כנראה לא הקוד שלך)
- [ ] ⭐ הוספת/שינית **תלות native** ב-`package.json`? כל הצוות צריכה לבנות מחדש את ה-dev client (APK ישן קורס ב-runtime). ראי [CONTRIBUTING.md §4](CONTRIBUTING.md#4-בנייה-נייטיב-dev-build).
- [ ] ⭐ **Design tokens:** צבעים/רווחים/גדלים מגיעים מ-`constants/design.js` ולא כ-strings קשיחים (`'#ff4757'` → `Colors.primary.default`)?
- [ ] **פונט:** רק `fontFamily: 'Rubik'` — לא Poppins, לא System, לא כלום אחר?
- [ ] **SafeAreaView** מיובא מ-`react-native-safe-area-context` ולא מ-`react-native`?
- [ ] **PropTypes** מוגדרים על כל קומפוננטה שמקבלת props?
- [ ] אין קומפוננטה שמוגדרת בתוך קומפוננטה אחרת (`const X = () =>` בתוך פונקציה ראשית)?
- [ ] אין `position: absolute` עם מספרים קשיחים (`top: 361`, `left: 61`) — שימוש ב-flexbox במקום?

---

## 7. טיפול בשגיאות (Error Handling) — לכל האורך
- [ ] **שרת:** מה קורה אם הפעולה נכשלת? status code נכון (400/401/403/404/500) + message?
- [ ] ⭐ **קליינט:** קריאות שרת עוברות דרך `services/apiHelpers.js` (`apiFetch`)?
- [ ] ⭐ **מלכודת 401:** `apiFetch` עושה **logout אוטומטי** על 401. ל-endpoint שאמור לעבוד גם למשתמש לא-מחובר (כמו public feed) — **אל תשתמשי ב-`apiFetch`**, אלא ב-`fetch` רגיל.
- [ ] מה רואה המשתמש ב-UI כשיש שגיאה? יש state של error/loading או שהמסך נתקע?
- [ ] לא רק Happy Flow — מה קורה ב: רשת נופלת, טוקן פג תוקף, רשימה ריקה, תשובת שרת חלקית?

---

## 8. סודות, סביבה ו-Config
- [ ] ⭐ סוד חדש (key/token/סיסמה) נכנס ל-**Infisical**, לא לקובץ git-tracked ו**לא** ל-`dotenv`.
- [ ] לא הוספת מפתח אמיתי ל-`.env.example` או לקוד. לא קימטת `.env`.
- [ ] ⭐ אין IP/URL קשיח בקוד? (יש באג ידוע של hardcoded IP שנשבר כשה-DHCP מתחלף; media-server משתמש ב-`ANNOUNCED_IP`)
- [ ] config נקרא ממקום מרכזי (`config/`, `apiConfig.js`) ולא משוכפל.

---

## 9. תשתית חדשה — יש לה צרכן אמיתי? ⛔ חוסם מיזוג
חל על **כל שכבה**, לא רק real-time. הכלל המלא: [CONTRIBUTING.md §2 — "תשתית לא נסגרת בלי צרכן"](CONTRIBUTING.md).
> **הכרעה D-03 (27.7): זהו שער חוסם, לא המלצה.** הדפוס הכי חוזר ביומן (M3-01, M6-03, M6-04, M7-03, M9-01, M10-03) — קוד שעבר ריוויו כי הוא תקין תחבירית, אבל אף שכבה לא צורכת אותו. **הריוויו דוחה PR שלא עונה על הסעיף הזה.**

- [ ] ⭐ ⛔ הוספת אירוע-סוקט / hook / util / **slice** / **endpoint** / **service** חדש — **מי צורך אותו?** נקבי **קובץ+שורה של קוד אמיתי** שמייבא / מאזין / dispatch-ר / בוחר ממנו. **טסט אינו צרכן. mock אינו צרכן** (fallback ל-`MOCK_*` מסווה חוסר-צרכן כצרכן — בדיוק M6-04/M7-03).
- [ ] **פתח מילוט — תשתית-קודם מותרת** רק אם מתקיימים *שני* התנאים: (א) **טיקט-צרכן מקושר** (SCRUM-XXX) שבו ייבנה הקורא; **וגם** (ב) המשטח **מסומן גלוי כלא-חי** — באנר "Demo" ב-UI, קובץ ב-`_dev`/`_test`, או מאחורי flag — כך שאי אפשר לטעות בו כפרודקשן. (מתחבר ל-D-04.)

---

## 10. איכות ומוכנות למיזוג לפני PR
- [ ] ⭐ רץ `npm run lint` **וגם** `npm run format:check` בלי שגיאות? (CI `lint.yml` חוסם PR שנכשל)
- [ ] שים לב: ESLint ב-CI עדיין **לא** מכסה את `packages/client` — הריצי lint על קוד קליינט ידנית.
- [ ] בדיקות שרת שכתבת עוברות? (אין עדיין CI + test-DB מבודד — הריצי ידנית)
- [ ] ⭐ בדיקות קליינט רצות רק דרך `npx jest` (אין עדיין `test` script) — אל תניחי שירוצו אוטומטית.
- [ ] ⭐ **הבראנץ' מעודכן מול `main`** (משכת/מיזגת את האחרון), והקונפליקטים נפתרו?
- [ ] ⭐ לא נשארו **סימני קונפליקט** בקוד (`<<<<<<<`, `=======`, `>>>>>>>`), ולא נכנסו קבצים לא קשורים ל-PR?
- [ ] ה-PR מקושר לטיקט JIRA (SCRUM-XXX) ולמשימה (Txx)?

---

## 11. שאלות "ראייה כוללת" לפני סימון סיום
1. **"תארי לי את מסלול הנתונים המלא"** — מהלחיצה במסך, דרך `apiFetch`/socket, ל-route, service, DB, וחזרה ל-UI. קטע שמדלגים עליו = שם לא בדקו.
2. **"מה נשבר אצל מישהו אחר בגלל השינוי?"** — איזה מסך/תפקיד/שירות אחר משתמש באותו endpoint / שדה / socket event.
3. **"מה קורה כשזה נכשל, ומי לא אמור להיות מורשה לעשות את זה?"** — אם התשובה רק על מצב שהכל עובד ולמשתמש המורשה, חסר חצי מהעבודה.
