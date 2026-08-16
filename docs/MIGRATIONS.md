# מדריך מיגרציות — Database Migrations

> כל שינוי ב‑schema של ה‑DB עובר רק דרך git: **branch → migration file → PR → main → deploy**.
> אסור לערוך קוד או להריץ מיגרציות ישירות על שרת הפרודקשן או על ה‑DB של הפרודקשן.

---

## מודל הסביבות

| סביבה | DB | פקודה | מי מריץ | מטרה |
|---|---|---|---|---|
| **Local dev** | postgres מקומי (שירות `db` ב‑docker-compose) | `prisma migrate dev` | המפתחת | **לכתוב** את המיגרציה (יוצר קובץ) |
| **Production** | ה‑DB בענן (DigitalOcean) | `prisma migrate deploy` | ה‑pipeline אוטומטית | להחיל מיגרציות שכבר קומטו |

> ה‑`prisma migrate deploy` רץ אוטומטית ב‑`CMD` של ה‑Dockerfile בכל עליית container.
> מפתחת **אף פעם** לא נוגעת ב‑DB של פרודקשן בעצמה.

**עיקרון מרכזי:** קובץ המיגרציה נוצר **פעם אחת** מקומית ונשמר ב‑git. פרודקשן רק **מריץ מחדש** את אותו קובץ. אף אחד לא "כותב מיגרציה" על פרודקשן.

---

## ✅ Runbook — איך מוסיפים שינוי schema

```
1. branch:                git checkout -b feat/xxx
2. לערוך schema.prisma     (packages/server/prisma/schema.prisma)
3. ליצור מיגרציה:          npm run db:migrate    # = prisma migrate dev
                          → נוצרת תיקייה חדשה תחת prisma/migrations/<timestamp>_xxx/
4. לעדכן את הקוד שמשתמש בשדה (controllers / services)
5. לבדוק מקומית שהכל רץ
6. לוודא שהתיקייה החדשה נוספה: git status   → חייבת להופיע migrations/<...>
7. לקמט הכל ביחד:          schema.prisma + תיקיית migrations + שינויי הקוד
8. push → PR → review → merge ל-main
9. ה-deploy עושה את השאר:  migrate deploy על פרודקשן + rebuild
```

---

## ⛔ כללי ברזל

1. **לעולם לא `prisma db push`** לשינוי שמיועד לפרודקשן — הוא **לא יוצר קובץ מיגרציה**, ולכן השינוי לא מגיע ל‑git ול‑prod. `db push` = רק לפרוטוטייפ מקומי זמני שנזרק.
2. **לעולם לא לערוך קוד ישירות על שרת הפרודקשן.** הדיפלוי מאפס את השרת ל‑`main` בכל פעם (`git reset --hard`), אז עריכה ידנית פשוט תימחק — ובינתיים תחסום/תשבור.
3. **לעולם לא להריץ `migrate dev` / `db push` מול ה‑DB של פרודקשן.** רק מול ה‑DB המקומי.
4. **תמיד לקמט את תיקיית `prisma/migrations/<...>` יחד** עם שינוי ה‑schema. schema בלי migration = drift.

---

## 🛡️ הגנות אוטומטיות

- **CI drift check** (`.github/workflows/db-drift.yml`): אם `schema.prisma` השתנה בלי מיגרציה תואמת — ה‑PR **נכשל ולא ניתן למזג**.
- **Deploy = `git reset --hard FETCH_HEAD`** (`.github/workflows/deploy.yml`): השרת תמיד משקף את `main` בדיוק. working tree "מלוכלך" לא יכול לחסום דיפלוי.

---

## למה זה קיים (תקלת 2026-06-23)

מיגרציה שהסירה את `User.role` הוחלה ישירות על ה‑DB של פרודקשן, אבל קובץ המיגרציה ושינויי ה‑schema/קוד לא קומטו כראוי. בנוסף, קבצים נערכו ידנית על השרת — מה שיצר working tree "מלוכלך" שחסם כל `git pull` והפיל את הדיפלוי. שני ההגנות למעלה הופכות את שני הכשלים האלה לבלתי אפשריים.
