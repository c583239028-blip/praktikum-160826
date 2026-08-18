# Components Documentation

## ErrorState

מציג מצב שגיאה עם אפשרות לנסות שוב.

### Props

| שם        | סוג        | חובה/רשות | תיאור                                                   |
| --------- | ---------- | --------- | ------------------------------------------------------- |
| `onRetry` | `function` | חובה      | פונקציית callback שתיקרא בעת לחיצה על כפתור "Try Again" |

### דוגמת שימוש

```jsx
<ErrorState onRetry={() => refetchFeed()} />
```

---

## EmptyFeed

מציג מצב ריק כאשר אין סטרימים פעילים.

### Props

אין props — הרכיב הוא תצוגה סטטית בלבד.

### דוגמת שימוש

```jsx
{
  streams.length === 0 && <EmptyFeed />;
}
```

---

## LoadingSkeletonCard

כרטיס skeleton להצגה בזמן טעינת נתונים. מדמה את מבנה כרטיס הסטרים עם placeholder blocks.

### Props

אין props — הרכיב הוא תצוגה סטטית בלבד.

### דוגמת שימוש

```jsx
{
  isLoading && (
    <>
      <LoadingSkeletonCard />
    </>
  );
}
```

---

## LazyAuthModal

מודל הרשמה/התחברות המוצג מהחלק התחתון של המסך, עם אפשרויות OAuth (Google, Apple, Facebook).

### Props

| שם        | סוג        | חובה/רשות | תיאור                                                  |
| --------- | ---------- | --------- | ------------------------------------------------------ |
| `visible` | `boolean`  | חובה      | קובע אם המודל מוצג או מוסתר                            |
| `onClose` | `function` | חובה      | פונקציית callback שתיקרא בעת לחיצה על כפתור הסגירה (✕) |

### דוגמת שימוש

```jsx
<LazyAuthModal
  visible={showAuthModal}
  onClose={() => setShowAuthModal(false)}
/>
```
