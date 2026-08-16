# HyPulse — מסמך Onboarding לצוות הפרקטיקום

ברוכות הבאות לפרויקט! המסמך הזה נועד לתת לכן תמונה ראשונית על מה שבנינו ולאיפה הולכים.  
קראו לאט, חפרו, ושאלו.

---

## מה זה HyPulse?

HyPulse היא פלטפורמה אינטראקטיבית בזמן אמת שמשלבת **סטרימינג ווידאו** עם **משחק טריוויה עם כסף אמיתי**.

### הזרימה הבסיסית:
```
Host פותח משחק ומתחיל לשדר
        ↓
Moderator מצטרף ומנהל שאלות
        ↓
Players משחקים (מצולמים ומשדרים — הם מושא המשחק)
        ↓
Viewers צופים, מהמרים מטבעות על תשובות, ושולחים מתנות לשחקנים
        ↓
תשובה נכונה של viewer = זכייה (125%). תשובה שגויה = הפסד.
        ↓
בסיום — חלוקת פרסים אוטומטית
```

---

## ארכיטקטורה — 4 חבילות

הפרויקט הוא **monorepo** — ריפו אחד שמכיל כמה packages עצמאיים:

```
packages/
  client/        ← האפליקציה (React Native / Expo)
  server/        ← שרת (Node.js, Express, Socket.IO, Prisma, Stripe)
  media-server/  ← סטרימינג (Mediasoup WebRTC + FFmpeg → HLS)
  shared/        ← קוד משותף (schemas, socket event constants)
```

כל package מריץ בתוך **Docker container** נפרד.  
`docker-compose.yml` בשורש מאחד את הכל.

---

## טכנולוגיות מרכזיות

| טכנולוגיה | למה? |
|---|---|
| **Node.js + Express** | שרת ה-API |
| **Socket.IO** | תקשורת real-time בין שרת ל-client |
| **Prisma** | ORM — שכבה בין הקוד לבסיס הנתונים |
| **PostgreSQL** | בסיס הנתונים |
| **Mediasoup** | WebRTC — וידאו host → שרת |
| **FFmpeg** | המרת WebRTC → HLS (פורמט סטרימינג לצופים) |
| **Stripe** | תשלומים אמיתיים בכרטיס אשראי |
| **Redux** | ניהול state באפליקציה |
| **Expo / React Native** | אפליקציית מובייל |
| **Docker** | הרצת כל השירותים יחד |
| **JWT** | אוטנטיקציה — כל request חייב token | ישתנה בהמשך לאוטנטיקציה עם שירותי גוגל/פייסבוק/טוויטר וכד'

---

## תפקידי משתמש במערכת

| תפקיד | מה עושה |
|---|---|
| **HOST** | פותח משחק, משדר ווידאו, מנהל הגדרות |
| **MODERATOR** | מנהל שאלות, מכריז על תשובות נכונות |
| **PLAYER** | משחק במשחק (מצולם), מקבל מתנות ונקודות מצופים |
| **VIEWER** | צופה, **מהמר מטבעות על תשובות**, שולח מתנות לשחקנים ולמנחה |

---

## מטבעות וממשק הכסף

- המטבע הוא **COIN** (1 coin = 1 ₪ בקנייה)
- משתמש חדש מקבל 1,000 מטבעות בהצטרפות ראשונה
- בכל שאלה: **viewer** בוחר תשובה ומהמר כמות coins
- חלוקת פרסים אוטומטית בסיום שאלה:
  - viewer שענה **נכון**: מקבל חזרה 125% מסכום ההימור
  - viewer שענה **לא נכון**: מפסיד את ההימור — מתחלק בין מנחה ושחקנים
  - המנחה מקבל 15% יותר מכל שחקן מהסכום שנגבה
  - בשאלת "מי ינצח במשחק": שחקן זוכה 85%, מנחה 15%

---

## קבצים חשובים לדעת איפה הם

| קובץ | נמצא ב |
|---|---|
| סכמת DB (כל המודלים) | `packages/server/prisma/schema.prisma` |
| כל ה-routes | `packages/server/src/routes/` |
| לוגיקת משחק | `packages/server/src/services/game.service.js` |
| לוגיקת כסף | `packages/server/src/services/economy.service.js` |
| socket events (server) | `packages/server/src/sockets/game.handler.js` |
| socket events (media) | `packages/media-server/src/sockets/stream.handler.js` |
| קבועי socket משותפים | `packages/shared/src/socketEvents.js` |
| ניהול WebRTC ב-client | `packages/client/src/services/MediasoupManager.js` |
| Redux state | `packages/client/src/store/slices/` |
| מסכי האפליקציה | `packages/client/src/screens/` |

---

## מה עוד לא גמור (וזה חלק מהעבודה שלכן)

- מסכי האפליקציה בנויים בצורה חלקית — הלוגיקה קיימת, ה-UI דורש עבודה
- flow ה-Moderator הוא אחד הדברים שדורש השלמה
- טסטים — כמעט אין
- UX / design — בפיגמה

---

## הוראות להרצה מקומית (אם תרצו לנסות)
לאחר התקנה של הכלים 
```bash
# 1. שכפלו את הרפו
git clone <repo-url>
cd World-Play-Backend

# 2. צרו קובץ .env בשורש 
# 3. הריצו את כל השירותים
docker-compose up --build -d

# 4. בדקו שהשרת עובד
curl http://localhost:8080/

# 5. פתחו את Prisma Studio לראות את  הDB
http://localhost:5557
```

---

## לפני שמתחילים לקרוא קוד — שאלות כלליות לחשוב עליהן

1. איך player מצטרף למשחק? מה קורה ב-backend כשהוא לוחץ "הצטרף"?
2. מי שולח ומי מקבל ב-Socket.IO?
3. אם viewer מנתק באמצע — מה קורה למטבעות שהמר?
4. איך הווידאו של ה-Host מגיע לצופים?
5. מה ההבדל בין REST endpoint לבין socket event? מתי משתמשים בכל אחד?

---

## לפני שמעלים PR — בדיקה עצמית

לפני שמעלים קוד, עוברים על רשימת תיוג מערכתית כדי לא לפספס שכבות והשפעות:

- **[CHECKLIST.md](CHECKLIST.md)** — המסמך המלא עם הסבר לכל סעיף (DB, שרת, שגיאות, real-time, קליינט, סודות, צרכן לתשתית חדשה, איכות). קוראים פעם אחת כדי להבין.
- **טופס לפני PR** — מופיע **אוטומטית בתיאור כל PR חדש** (מקורו ב-`.github/pull_request_template.md`). ממלאים את התשובות **בתוך תיאור ה-PR** — לא מעלים קובץ, אז אין קונפליקטים ולא נצברים מסמכים בריפו. לכל סעיף: סימון V + שורת הוכחה אחת.
- **שפה:** את ה-Description כותבים באנגלית (כמו בעולם האמיתי); את תשובות הצ'קליסט מותר בעברית — המטרה היא בדיקה עצמית כנה.
- **דוגמה ל-PR ממולא:** [#93](https://github.com/ABERsara/HyPulse-rep/pull/93).

---
בהצלחה:)