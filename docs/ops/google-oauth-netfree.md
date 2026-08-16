# התחברות Google תחת נטפרי — מה נשבר, איך תוקן, ומה צריך להריץ (SCRUM-55)

נפתר ב-2026-07-15. ההתחברות **מעולם לא הייתה "חסומה על ידי נטפרי" בלבד** — הכותרת הזאת
הסתירה **7 בעיות שהצטברו זו על זו**, כל אחת מוסתרת מאחורי הקודמת. קילפנו אותן שגיאה-אחר-שגיאה:

`redirect_uri_mismatch` ← `communicating with Google servers` ← `ERR_CERT_AUTHORITY_INVALID`
← `net_error -150` (cert pinning) ← האימות מצליח אבל לא חוזר לאפליקציה ← ניווט אחרי התחברות.

---

## חלק A — התיקונים האמיתיים (מה בעצם תוקן)

אלה התוצרים שנכנסים לאפליקציה. **כולם כבר בוצעו** — החלק הזה הוא ההסבר, לא רשימת מטלות.

### 1. ה-Web client ב-Infisical היה מפרויקט Google זר
`EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` הצביע על Web client מפרויקט GCP אחר (`613795441582-…`).
הוחלף ל-Web client של פרויקט ה-Firebase (`858791064262-rrb6nuvc…`, פרויקט `hypulse-app-7cb36`).

**למה זה חייב להיות אותו פרויקט:** `signInWithCredential` של Firebase מאמת שה-`aud` של ה-id_token
שייך ל-OAuth client **בתוך פרויקט ה-Firebase**. client מפרויקט זר נדחה.
תוקן ב-Infisical (`dev` + `staging`) — ✅ בוצע ואומת.

### 2. `applicationId` היה placeholder מטמפלט
תיקיית `android/` המקומית הכילה `applicationId = com.yourname.worldplay` (במקום `com.hypulse.app`
שב-app.json). ה-package חייב להתאים ל-package הרשום ב-**Android OAuth client** של גוגל.
תוקן ב-`expo prebuild --clean -p android`.

### 3. ⭐ סכמת `com.hypulse.app` לא הייתה רשומה — **זו הליבה**
ה-redirect של OAuth הוא `com.hypulse.app:/oauthredirect`, אבל האפליקציה טיפלה רק בסכמות
`client` / `exp+client` → **לשום דבר לא היה handler ל-redirect** → הדפדפן נפל ל-google.com
והאפליקציה לא קיבלה את ה-code לעולם.

**זה כנראה מה שהחזיק את SCRUM-55 שבור מלכתחילה** — לא נטפרי.
תוקן ב-`app.json`: `"scheme": ["client", "com.hypulse.app"]`.

### 4. אחרי התחברות — נחיתה על הפיד במקום על היעד
`LazyAuthModal.handleGoogleSuccess` קרא ל-`onClose()`, שניקה את `pendingActionRef` של
`useAuthGuard` לפני שה-effect שלו רץ → הפעולה הדחויה (הניווט) אבדה.
תוקן: הוסר ה-`onClose()` המפורש.

### 5. תיקונים מ-code review (על אותו flow)
- **`LazyAuthModal`** — `await promptGoogle()` נעטף ב-try/catch. בלי זה, דחייה של ה-exchange
  (למשל code שכבר נוצל) הייתה **uncaught rejection**: המשתמשת לא רואה שגיאה והמודל נראה תקוע.
- **`useAuthGuard`** — סגירת המודל נותקה מהתלות בקיום פעולה דחויה: עכשיו סוגר על
  `!isGuest && user && isModalVisible` ומריץ פעולה דחויה רק אם יש. בלי זה, מודל שנפתח בלי
  `guardedAction` היה נשאר פתוח לנצח אחרי התחברות מוצלחת.
- ניקוי logs של debug + `catch` binding לא בשימוש.

### איך לאמת שהכל במקום
```bash
# ה-redirect באמת מנותב לאפליקציה (אחרי build):
adb shell pm query-activities -d "com.hypulse.app:/oauthredirect"   # ← חייב להחזיר com.hypulse.app.MainActivity
```

---

## חלק B — מה כל מפתחת מריצה אצלה

```bash
git pull                                   # מושך את התיקונים (app.json, LazyAuthModal, useAuthGuard)
cd packages/client
npx expo prebuild --clean -p android       # מייצר מחדש את ה-manifest עם סכמת com.hypulse.app
infisical run --domain https://app.infisical.com -- npx expo run:android
```

**`prebuild --clean` הוא חובה פעם אחת** — prebuild רגיל (אינקרמנטלי) **לא** יכתוב מחדש
`applicationId`/scheme קיימים, וכל התיקון לא ייכנס.

Infisical כבר מתוקן (`dev` + `staging`) — לא צריך לעשות שם כלום.

### ואז — שהמכשיר יסמוך על נטפרי
ה-OAuth רץ בתוך **Chrome custom tab**, אז ה-Chrome/GMS של המכשיר צריכים להתמודד עם
יירוט ה-TLS של נטפרי. שני מצבים:

- **טלפון אמיתי מנוהל-נטפרי** — התעודה כבר מהימנה ו-Chrome לא נועל עליה. אחרי חלק B
  ההתחברות אמורה פשוט לעבוד. זה המסלול הקל.
- **emulator חשוף** (מה שהיה לנו, בהיעדר מכשיר) — צריך את ההתקנה החד-פעמית בחלק C.

---

## חלק C — הכנת emulator לבדיקה תחת נטפרי (חד-פעמי)

רק לבדיקה על emulator; לא נכנס לאפליקציה.

> **למה דווקא Android 13?** מ-Android 14 ומעלה מאגר התעודות עבר ל-conscrypt APEX, והזרקה
> בזמן ריצה שברירית — היא הפילה לנו את system_server פעמיים. API 33 משתמש ב-
> `/system/etc/security/cacerts` הקלאסי: יציב וקבוע.

### שלב 1 — ליצור AVD ב-Android Studio (חובה GUI)

`avdmanager` מה-CLI **לא מזהה** את ה-image ונכשל ("Package path is not valid"). צרי דרך ה-GUI:

**Device Manager** (אייקון הטלפון) → **Create Virtual Device** → **Pixel 7** → Next →
בטאב **System Image**:
- ⚠️ פילטר **Services = Google APIs** (לא **Google Play**! Play חוסם `adb root` וכל הסקריפט מת)
- גללי ל-**API 33**, בחרי **"Google APIs Intel x86_64 Atom System Image"** (לא "KB Page Size")
- אם יש ליד ⬇ — הורידי; אם אין — מותקן כבר

→ Next → **Show Advanced Settings** → **RAM: 4096 MB** (⚠️ ברירת המחדל 2048 חונקת את המערכת) →
שם למשל `Pixel_7_A13` → Finish. **אל תריצי אותו מ-Studio.**

> ⚠️ בדקנו: ההגדרה של RAM ב-Advanced לפעמים לא נתפסת. אם ה-emulator איטי בטירוף, ערכי ידנית
> `hw.ramSize=4096` בקובץ `~/.android/avd/<name>.avd/config.ini`.

### שלב 2 — להרים ולהריץ את הסקריפט

```powershell
# emulator לא ב-PATH → נתיב מלא.
# -gpu host חובה (בלעדיו הרינדור מת ונראה כאילו הכל תקוע).
# -no-snapshot-load = העלאה קרה. אל תבדקי על emulator שכבר רץ שעה — ה-GPU מתדרדר
# עם הזמן, וזה נראה בדיוק כמו אפליקציה שבורה. ראי "המלכודת הכי מבזבזת-זמן" למטה.
& "$env:LOCALAPPDATA\Android\Sdk\emulator\emulator.exe" -avd Pixel_7_A13 -writable-system -gpu host -no-snapshot-load

# בטרמינל נפרד — הסקריפט (idempotent, בטוח להריץ שוב):
powershell -ExecutionPolicy Bypass -File packages\client\scripts\netfree-emulator-setup.ps1
```

הסקריפט עושה הכל: מייצא את תעודות NetFree מ-trust store של Windows, נותן להן שמות `<hash>.0`,
מתקין ל-`/system/etc/security/cacerts` עם ההרשאות ו-SELinux context הנכונים, מחשב את רשימת
ה-SPKI (כולל ה-intermediate החי של נטפרי) וכותב את ה-flag ל-Chrome, ומאתחל.

**צעד ידני אחד שנשאר** (Chrome מתעלם מקובץ ה-flags עד שמפעילים אותו):
`chrome://flags` → חיפוש `command` → **"Enable command line on non-rooted devices"** → **Enabled** → **Relaunch**.
(הבאנר האדום "unsupported flag" אחרי זה — נורמלי.)

ואז: Settings → Passwords & accounts → Add account → חשבון Google → ולהתחבר מהאפליקציה.

### מה הסקריפט פותר, ולמה
1. **`ERR_CERT_AUTHORITY_INVALID`** — ה-emulator לא מכיר את תעודת השורש של נטפרי.
   התקנה ל-system store פותרת (וגם מאפשרת להוסיף חשבון Google, שזה GMS).
2. **`net_error -150` = `ERR_SSL_PINNED_KEY_NOT_IN_CERT_CHAIN`** — Chrome **נועל** (pins) את
   המפתחות של גוגל. נטפרי מיירט את רוב דומייני גוגל (issuer *NetFree Node Intermediate CA, 019 Telzar*),
   ו**תעודת מערכת לא מבטלת pinning** → הנעילה נכשלת. הפתרון: `--ignore-certificate-errors-spki-list`
   עם ה-SPKI של ה-intermediate של נטפרי (ה-flag מתאים כל תעודה בשרשרת, אז ה-intermediate מכסה את כל ה-hosts).
   מעניין: `accounts.google.com` ו-`oauth2.googleapis.com` דווקא **עוברים בלי יירוט**.

> ⚠️ **ה-intermediate של נטפרי מתחלף** — ראינו אותו משתנה תוך 24 שעות. לכן **אסור לקבע (hardcode)
> את ה-SPKI** באף מקום; הסקריפט קורא אותו חי מהשרשרת בכל הרצה. אם מישהי מעתיקה ערך מתיעוד ישן,
> ה-pinning ייכשל שוב עם `net_error -150` בלי סיבה נראית לעין.

### מכשולי תשתית (כולם צצו בגלל נטפרי)
- **`sdkmanager` לא מצליח להוריד** — ל-Java יש truststore משלו. פתרון: להעתיק
  `jbr/lib/security/cacerts`, לייבא את תעודות NetFree עם `keytool -importcert`, ולהריץ עם
  `JAVA_OPTS=-Djavax.net.ssl.trustStore=…`.
- **הורדת system image נקטעת באמצע** — להשתמש ב-**BITS** (`Start-BitsTransfer`, מתאושש מניתוקים)
  ישירות מול `dl.google.com/.../sys-img/...zip`, ולחלץ עם `tar.exe` של Windows
  (`Expand-Archive` משחית ארכיונים גדולים).
- **RAM** — לתת ל-AVD **לפחות 4GB** (`hw.ramSize`). ב-2GB ה-lowmemorykiller חונק את המערכת
  וכל ה-UI נכנס ללולאת קריסות.

### ⚠️ המלכודת הכי מבזבזת-זמן: המסך "תקוע" אבל הכל עובד

אם המסך שחור / לא מגיב / מרונדר לאט בטירוף — **זה כמעט תמיד ה-GPU של ה-emulator, לא האפליקציה
ולא נטפרי.** אימות: `adb logcat -d | Select-String app_time_stats`. אם רואים
`avg=27000ms` (פריים כל 27 שניות) — הרינדור מת, אבל הלחיצות **כן** נקלטות, פשוט לא רואים תוצאה.
זה שלח אותנו לצוד באגים שלא קיימים.

- תמיד להריץ עם **`-gpu host`**. הרינדור מתדרדר לאורך זמן ואחרי כמה restarts של ה-emulator →
  **restart למחשב** מאפס את מצב ה-GPU.
- אימות שהאפליקציה חיה למרות מסך שחור: `adb shell uiautomator dump` ואז לחפש את הטקסטים —
  אם הם שם, המסך פשוט לא מצייר.

---

## פולואפים פתוחים (לא חוסמים)

- **התחברות חוזרת בלי reload → `invalid_grant`** — ✅ **הוכרע (SCRUM-269, PR #246):** השורש
  מבני — ה-redirect `com.hypulse.app:/oauthredirect` הוא route ב-expo-router שעושה `router.replace('/')`
  ומפרק את המסך שמחזיק את ה-hook לפני ש-`socialLogin` רץ (ה-`invalid_grant` היה מיחזור ה-`AuthRequest`).
  ההכרעה: מעבר ל-native `@react-native-google-signin` (בורר נייטיבי, `idToken` in-process — בלי דפדפן/
  redirect/route). נימוק מרכזי: native עוקף את כל עוקף ה-SPKI pinning של חלק C (GMS פונה ישירות ל-
  `accounts.google.com`, שעובר בלי יירוט). רציונל מלא + חלופות: [D-08](../notes/D-08-google-signin-native-decision.md).
- **Apple / Facebook** — עדיין stubs ב-`LazyAuthModal` (יש TODOs).
- **Profile מגדר ידנית** — משתמש ב-`visible={isGuest}` במקום `useAuthGuard` המשותף; שני
  מנגנוני-גידור. שווה איחוד (מ-code review).

> תוקנו כבר בענף זה: מלכודת ה-logout ב-Profile (X מנתב לבית), והתחברות ראשונה שנפלה בשקט
> (הכפתור מושבת עד שה-request מוכן).
