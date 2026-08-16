# Contributing — מדריך כתיבת קוד (World Play)

קוד אחיד מקטין באגים, מקל על קליטת מפתחים חדשים, וממקד את ה-Code Review בלוגיקה ובארכיטקטורה במקום ברווחים וסגנון. המסמך הזה מתאר את המוסכמות שלנו ב-Monorepo המשלב צד שרת (Express + Prisma) וצד לקוח (React Native / Expo).

> **TL;DR:** הכלים האוטומטיים (ESLint + Prettier + Husky) אוכפים את הסגנון בשבילך. הפרק "עקרונות" הוא מה שהכלים _לא_ יכולים לתפוס — וזה מה שנסקור ב-PR.

---

## 1. הכלים האוטומטיים (כבר מותקנים)

אין צורך להגדיר כלום — התשתית קיימת בריפו:

| כלי                     | מה הוא עושה                               | איך מריצים                                |
| ----------------------- | ----------------------------------------- | ----------------------------------------- |
| **ESLint**              | תופס שגיאות תחביר וקוד בעייתי             | `npm run lint` / `npm run lint:fix`       |
| **Prettier**            | מעצב את הקוד אחיד (רווחים, מרכאות, שורות) | `npm run format` / `npm run format:check` |
| **Husky (pre-commit)**  | מריץ lint+format אוטומטית לפני כל commit  | רץ לבד ב-`git commit`                     |
| **CI (GitHub Actions)** | אוכף lint+format על כל PR ו-push ל-main   | `.github/workflows/lint.yml`              |

הגדרות העיצוב מרוכזות ב-[.prettierrc](.prettierrc): `singleQuote`, `semi`, `tabWidth: 2`, `trailingComma: es5`.

**אל תעקוף את ה-hook עם `--no-verify`** אלא אם יש סיבה אמיתית — ה-CI יתפוס את זה ממילא ויפיל את ה-PR.

---

## 2. עקרונות מפתח (מה שהכלים לא תופסים)

### Naming Conventions (מוסכמות שמות)

שמות תיאוריים וברורים, לפי הקונבנציה שכבר נהוגה בריפו:

| סוג                     | קונבנציה              | דוגמה מהפרויקט                                            |
| ----------------------- | --------------------- | --------------------------------------------------------- |
| משתנים ופונקציות        | `camelCase`           | `calculateUserScore`, `handleAuthError`                   |
| קומפוננטות React Native | `PascalCase`          | `UserProfileScreen`, `GoogleSignInButton`                 |
| מחלקות                  | `PascalCase`          | `UnauthorizedError`                                       |
| קבועים                  | `UPPER_SNAKE_CASE`    | `MAX_RETRY_ATTEMPTS`                                      |
| קבצי שרת (לפי שכבה)     | `<domain>.<layer>.js` | `user.controller.js`, `auth.service.js`, `feed.routes.js` |

> שמרי על הסיומת `*.routes.js` (לא `*.router.js`) כדי שכל קבצי הראוטינג ייראו אחיד.

### Single Responsibility (SRP — אחריות יחידה)

בצד השרת אנחנו מפרידים שכבות. אל תערבבי ביניהן:

```
routes/      → הגדרת endpoints + middleware בלבד (ללא לוגיקה עסקית)
controller/  → קבלת request, ולידציה, החזרת response
services/    → לוגיקה עסקית + גישה ל-Prisma
```

זרימה תקינה: `route → controller → service → Prisma`.
דוגמה: ראוטר לא מדבר עם `prisma` ישירות; הוא קורא ל-controller שקורא ל-service.

בצד הלקוח: קומפוננטה אחת = אחריות אחת. לוגיקת רשת ב-`src/services/`, state ב-`src/store/`, לוגיקה לשימוש חוזר ב-`src/hooks/`.

### עיצוב בצד הקליינט

**Design tokens — תמיד מ-`constants/design.js`:**
הקובץ `packages/client/src/constants/design.js` הוא מקור האמת לצבעים, רווחים, פונטים ו-border-radius. לא כותבים `'#ff4757'` ישירות בקוד — רק `Colors.primary.default`.

**פונט — Rubik בלבד:**
הפונט היחיד שנטען בפרויקט הוא Rubik. `fontFamily: 'Poppins'` לא יעבוד — Android ו-iOS ייפלו ל-system fallback שנראה שונה לחלוטין.

**SafeAreaView — מ-`react-native-safe-area-context`:**
לא מ-`react-native`. ה-SafeAreaView של react-native מתעלם מה-insets של Android וגורם ל-views שגולשים מתחת לסרגל הניווט.

**PropTypes — על כל קומפוננטה:**
כל קומפוננטה שמקבלת props חייבת `PropTypes`. ה-pre-commit hook ייכשל בלעדיהם.

**לא להגדיר קומפוננטה בתוך קומפוננטה:**
`const Badge = () => ...` בתוך פונקציה ראשית → React יוצר אובייקט חדש בכל render ומאבד state. תגדירי קומפוננטות בחוץ, ברמת ה-module.

**לא להשתמש ב-position absolute עם מספרים קשיחים:**
`top: 361`, `left: 61` — נשברים על מסכים שאינם 812×412px. להשתמש ב-flexbox (`justifyContent`, `alignItems`, `alignSelf: 'center'`).

### DRY (Don't Repeat Yourself)

לוגיקה שחוזרת על עצמה → הוצאה למקום משותף:

- שרת: `packages/server/src/utils/` ו-`services/`.
- לקוח: `packages/client/src/services/` (למשל `apiHelpers.js`), `src/hooks/`.
- קוד שמשותף לשרת ולקוח (קבועים, אירועי socket): `packages/shared/`.

לפני שכותבים פונקציה חדשה — בדקי אם כבר קיימת אחת דומה ב-`utils`/`services`.

### Magic Numbers & Strings

אסור ערכים קשיחים בתוך הלוגיקה. הגדירי קבוע בעל שם:

```js
// ❌
if (retries > 3) { ... }

// ✅
const MAX_RETRY_ATTEMPTS = 3;
if (retries > MAX_RETRY_ATTEMPTS) { ... }
```

קבועים משותפים → `packages/server/src/constants/` או `packages/shared/`.

### i18n — תרגום וטקסטים

אין מחרוזות טקסט גלויות למשתמש בתוך הקוד — כולן עוברות דרך `t('key')`:

```js
// ❌
<Text>Stream ended by host</Text>

// ✅
<Text>{t('status_stream_ended')}</Text>
```

**מוסכמת שמות לקובצי תרגום (`src/locales/<lang>/`):**

שם הקובץ = שם הקומפוננטה/המסך ב-lowercase, **ללא** הסיומות `Screen` / `Modal` / `Component`:

| קומפוננטה | קובץ תרגום |
|-----------|-----------|
| `ViewerScreen.js` | `viewer.json` |
| `BirthdayModal.js` | `birthday.json` |
| `ErrorState.js` | `errors.json` |

קומפוננטות מאותו תחום (למשל `EmptyFeed` + `FeedScreen`) **חולקות קובץ אחד** (`feed.json`) — אל תיצרי קובץ חדש אם כבר קיים קובץ מתאים.

כל קובץ חדש בלקוח צריך לקבל `useTranslation('namespace')` עם שם ה-namespace המתאים.

---


### Meaningful Comments (הערות משמעותיות)

קוד טוב מסביר את עצמו דרך שמות נכונים. הערות שמורות ל**למה**, לא ל**מה**:

```js
// ❌ מסביר את המובן מאליו
// מגדיל את המונה ב-1
counter += 1;

// ✅ מסביר החלטה לא טריוויאלית
// LiveKit שולח keyframe כל 2 שניות — מחכים לאחד לפני שמתחילים לשדר
```

---

## 3. צ'קליסט לפני פתיחת PR

- [ ] `npm run lint` עובר נקי
- [ ] `npm run format:check` עובר נקי
- [ ] שמות עקביים עם הקונבנציות שלמעלה
- [ ] אין לוגיקה עסקית בראוטרים; אין גישה ל-Prisma מחוץ ל-services
- [ ] אין ערכי קסם — קבועים בעלי שם
- [ ] אין מחרוזות טקסט קשיחות — כולן ב-`t('key')` עם namespace מתאים
- [ ] טסטים רלוונטיים עוברים

---

## 4. בנייה נייטיב (dev build)

האפליקציה רצה כ-**dev build** ולא ב-Expo Go — netfree/cleartext מחייבים קונפיג native מותאם (`android/app/src/main/res/xml/netfree_cert.xml`) שמחייב בינארי משלנו. המשמעות: כל מודול native "נצרב" לתוך ה-APK בזמן ה-build, וההצהרה ב-`package.json` לבדה לא מספיקה.

- ⭐ **הוספת/שינוי תלות native ב-`package.json`** (למשל `@react-native-masked-view/masked-view`, `expo-*` עם קוד native) → **חובה לבנות מחדש את ה-dev client אצל כל מי שמושכת את השינוי**. APK ישן שנבנה לפני התלות יקרוס ב-runtime — לא בגלל תלות חסרה אלא בגלל בינארי מיושן.
- הבנייה מחדש: `npx expo run:android` (או Build/Run ב-Android Studio). זה מריץ autolinking מחדש מתוך `node_modules`, מקשר את המודול ה-native לבינארי החדש — **בלי** לגעת בקוד או ב-git.
- ⭐ **אסור `npx expo prebuild --clean`.** הוא מחדש את כל תיקיית `android/` מאפס ומוחק את קונפיג ה-netfree. אם תקמטי את זה — שברת את ה-netfree לכל הצוות והחזרת את באג ה-cleartext.
- שינוי JS בלבד (ללא תלות native חדשה) → **לא** דורש rebuild; ה-dev client + Metro מרענן לבד.

> רקע: קריסת `LazyAuthModal` (MaskedView) ב-SCRUM-151 הייתה בדיוק זה — התלות הוצהרה ב-`package.json` אבל ה-dev build המותקן נבנה לפניה.

---

## 5. פריסת מיגרציות לענן

### השאלה הראשונה: backward-compatible?

לפני שנוגעים בשרת, צריך לדעת אם הקוד הישן שרץ כרגע בפרודקשן יכול לעבוד עם ה-DB החדש:

| סוג שינוי | Backward-compatible? | גישה |
|---|---|---|
| הוספת עמודה nullable | כן | migrate-first (ראי למטה) |
| הוספת טבלה חדשה | כן | migrate-first |
| מיגרציית נתונים בלבד | כן | migrate-first |
| מחיקת / שינוי שם עמודה | **לא** | שני PRs (ראי למטה) |
| הפיכת עמודה ל-NOT NULL | **לא** | שני PRs |

### migrate-first (לשינויים backward-compatible)

```
1. על השרת — לפני מיזוג ה-PR:
   docker exec -w /usr/src/app/packages/server hypulse-app-server-1 \
     npx prisma migrate deploy
2. בודקות שהשרת עדיין עולה ועונה
3. ממזגות PR → git pull + docker compose build app-server + docker compose up -d app-server
```

### שני PRs (לשינויים לא backward-compatible)

```
PR 1: מסירה את כל ה-references לשדה מהקוד — schema.prisma לא נגעת בו
      ↓ מיזוג + פריסה לענן
PR 2: migration שמוחק/משנה את השדה ב-DB
      ↓ migrate deploy + git pull + build + up
```

### כלל אחד שאסור לשכוח

**אסור `ALTER TABLE` ידנית.** כל שינוי ב-DB חייב לעבור `npx prisma migrate dev` (מקומית) כדי לייצר קובץ migration ב-`prisma/migrations/`. בלי קובץ — Prisma מאבדת מעקב, ה-image הבא נבנה עם client שלא מסונכרן עם ה-DB, והשרת נופל.

---

## 6. מקורות לימוד מומלצים

- [Airbnb JavaScript Style Guide](https://github.com/airbnb/javascript) — הסטנדרט הנפוץ ל-JS/React.
- [Clean Code / Robert C. Martin](https://www.oreilly.com/library/view/clean-code-a/9780136083238/) — קוד קריא ותחזוקתי.
- [Refactoring.Guru](https://refactoring.guru/) — Code Smells, Refactoring, Design Patterns.
- [The Twelve-Factor App](https://12factor.net/) — מתודולוגיה לארכיטקטורת צד-שרת סקיילבילית.
