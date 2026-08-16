# D-08 — התחברות Google: native SDK מול תיקון ממוקד ב-expo-auth-session

> בריף הכרעה, אומת מול `origin/main` ובמול PR #246 (SCRUM-269) ב-5.8.2026.
> מקור: [FINDINGS.md](../FINDINGS.md) שורת D-08 · הפולואפ (a) של SCRUM-55 ב-[google-oauth-netfree.md](../ops/google-oauth-netfree.md).
> טיקט: SCRUM-269 · PR: #246 (`fix/google-repeat-login-invalid-grant`).

---

## ההכרעה הנדרשת (משפט אחד)

**כיצד לתקן את כשל ההתחברות החוזרת ב-Google (login→logout→login בלי restart נכשל): להחליף את מנגנון האימות ל-native SDK, או לתקן נקודתית את זרימת ה-expo-auth-session הקיימת?**

זו הכרעה ארכיטקטונית ולא תיקון-באג נקודתי, כי כל בחירה קובעת שלושה דברים ברמת המערכת: את מנגנון האימות עצמו, את משטח התלויות (תלות native חדשה), ואת תהליך הבנייה של הצוות (rebuild ל-dev-client לכולן).

---

## מצב נוכחי מאומת (`origin/main`)

- `main` עדיין על `expo-auth-session`: `useGoogleSignIn.js` משתמש ב-`Google.useIdTokenAuthRequest`. המעבר לנייטיבי לא נגע ב-main, הוא ב-PR #246 בלבד.
- ה-webClientId התקין הוא של פרויקט 858 (`hypulse-app-7cb36`), כבר ב-Infisical (`dev`+`staging`) מ-SCRUM-55. ה-`613` הישן הוא פרויקט GCP זר.

## סיבת השורש (אובחן על מכשיר, logcat)

הכשל בשתי שכבות מאותו מקור מבני:

1. **`invalid_grant`** — `useIdTokenAuthRequest` ממחזר את אותו `AuthRequest` (code חד-פעמי שכבר נוצל) בהתחברות חוזרת. זה מה ש-SCRUM-55 חשף עם ה-try/catch.
2. **no-login שקט** — ה-redirect `com.hypulse.app:/oauthredirect` הוא route ב-expo-router (`src/app/oauthredirect.js`) שעושה `router.replace('/')`. ה-hook `useGoogleSignIn` יושב בתוך `LazyAuthModal` בעומק מסך-עלה (מעוגן ב-7 מסכים), כלומר **מתחת** ל-navigation Stack. הניווט מפרק את תת-העץ → ה-effect שמריץ `signInWithCredential→socialLogin` נהרס לפני שרץ. ה-teardown קורה **מעל** ה-hook, ולכן אי-אפשר לתפוס אותו מבפנים.

> סטטוס הראיה: זו היפותזה עקבית-עם-הקוד עם logcat מצוטט (`GoogleAuthButton UNMOUNTED ~112ms אחרי MainActivity START`), אך ה-logcat הגולמי טרם צורף לטיקט. לתעד כ"ממצא לפי logcat", לא כעובדה מוגמרת.

---

## האפשרויות

### A — native SDK (`@react-native-google-signin`) — נבחר
בורר חשבונות נייטיבי של GMS, מחזיר `idToken` in-process. אין דפדפן, אין redirect, אין route → כל מחלקת הבאגים (שתי השכבות) נעלמת יחד. אותו path של Firebase במורד הזרם.

### B — תיקון ממוקד ב-expo-auth-session
להרים (hoist) את ה-request/response של OAuth מעל ה-Stack (לתוך AuthContext, שיושב מעל `<Stack>`), לאחד את הכפילות ב-`GoogleSignInButton`, ולוודא ש-`oauthredirect` משלים בלי ניווט הרסני. pure-JS, בלי תלות native, הפיך. אבל **שומר את זרימת הדפדפן ואיתה את כל מס הנטפרי**, והרפקטור נוגע בחוזה `modal↔useAuthGuard` על 7 עוגנים.

---

## למה native (הרציונל)

1. **מחסל את השורש, לא סימפטום** — אין redirect → אין teardown. שתי השכבות ביחד.
2. **הנימוק החזק באמת הוא נטפרי** — `expo-auth-session` = Chrome custom tab = מחייב את כל עוקף ה-SPKI pinning של Chrome (ה-intermediate שמתחלף כל 24 שעות, ראו [google-oauth-netfree.md](../ops/google-oauth-netfree.md) חלק C). native (GMS) פונה ישירות ל-`accounts.google.com`/`oauth2.googleapis.com` (עוברים בלי יירוט) → צריך רק system-CA trust, בלי עוקף pinning. הפשטה משמעותית מאחורי נטפרי.
3. **B אינו זול יותר** — הגרסה הכנה שלו (hoist + איחוד כפילות + 7 עוגנים) ברדיוס דומה ל-A, אבל משלם מחיר דומה ונשאר עם משטח הדפדפן/נטפרי השברירי. עלות A (תלות native + rebuild) היא חד-פעמית ומתואמת; שבריריות B מתמשכת.
4. **מאחד כפילות** — `GoogleSignInButton` היה עותק שני חולה של אותה לוגיקה; ב-A הוא הופך ל-wrapper דק על ה-hook.

**מתי B היה מנצח:** אם rebuild לכל הצוות בלתי-אפשרי כרגע (לחץ ריליז) — אז B הוא interim לגיטימי, אבל נרשם כחוב כי מס הנטפרי נשאר. זה לא היה המצב.

---

## השלכות ושערים לפני מיזוג

- **תלות native חדשה** → per [[project-native-build-rigidity]]: כל הצוות צריך `expo run:android` מחדש פעם אחת אחרי מיזוג. הודעת צוות ברגע שזה על main.
- **SHA-1** — הבנייה חתומה ב-`android/app/debug.keystore` המשותף (`5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`). אומת שרשום ב-Android OAuth client של פרויקט 858. (`eas.json` ריק → אין SHA-1 שני עד שיוקם release build.)
- **שער אימות** — ה-AC דורש אימות-מכשיר, והנתיב הנייטיבי טרם רץ ירוק end-to-end (הריצה היחידה הייתה על env 613 שנפל ב-`DEVELOPER_ERROR`, שהיה env מיושן ולא באג בקוד). לפני מיזוג: build עם 858, login→logout→login בלי restart על מכשיר מאחורי נטפרי, logcat/וידאו מצורף ל-269.
- **iOS** — ה-configure מעביר רק `webClientId`; ל-iOS צריך `iosClientId` + `iosUrlScheme`. הפרויקט אנדרואיד-בלבד, אז לא חוסם — מתועד כפער ידוע.

---

## סטטוס

**הוכרע 5.8.2026 — native (A).** PR #246 סוקר (CHANGES_REQUESTED): הקוד אלגנטי, CI ירוק, נשאר שער האימות-על-מכשיר + סגירת `GoogleSignInButton` היתום. Apple/Facebook נשארים על נתיב נפרד (split מודע).
