# Feed Screen Data Contract

## שדות נדרשים ל-StreamCard

| שדה | סוג | תיאור |
|-----|-----|--------|
| `id` | `string` | מזהה ייחודי של השידור |
| `title` | `string` | כותרת השידור |
| `status` | `string` | סטטוס השידור (`LIVE`, `WAITING`, `ENDED`) |
| `startTime` | `DateTime \| null` | זמן תחילת השידור |
| `host.id` | `string` | מזהה המארח |
| `host.username` | `string` | שם המשתמש של המארח |
| `host.avatarUrl` | `string \| null` | תמונת פרופיל המארח |
| `viewerCount` | `number` | מספר צופים נוכחיים |
| `thumbnailUrl` | `string \| null` | תמונת תצוגה מקדימה |

---

## מה קיים בתגובת השרת הנוכחית

`getPopularFeed` ב-`feed.service.js` מחזיר:

```js
prisma.stream.findMany({
  where: { status: 'LIVE' },
  include: { host: true, games: true },
  orderBy: { startTime: 'desc' },
});
```

### קיים ✅
| שדה | מקור |
|-----|------|
| `id` | `Stream.id` |
| `title` | `Stream.title` |
| `status` | `Stream.status` |
| `startTime` | `Stream.startTime` |
| `host.id` | `User.id` |
| `host.username` | `User.username` |

### חסר ❌
| שדה | הסבר |
|-----|------|
| `host.avatarUrl` | אין שדה `avatarUrl` במודל `User` בסכימה |
| `viewerCount` | אין מעקב אחר צופים נוכחיים בבסיס הנתונים |
| `thumbnailUrl` | אין שדה `thumbnailUrl` במודל `Stream` בסכימה |

---

## סיכום

התגובה הנוכחית מספקת את השדות הבסיסיים (`id`, `title`, `status`, `startTime`, `host`).  
כדי להציג `StreamCard` מלא צריך להוסיף לסכימה:
- `avatarUrl` ל-`User`
- `thumbnailUrl` ל-`Stream`
- מנגנון `viewerCount` (לדוגמה: טבלת `StreamViewer` או שדה counter ב-`Stream`)