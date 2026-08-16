# Auth Gaps Notes

## 1. איפה אפשר להמר
- `packages/client/src/screens/GameScreen.js`, שורה 843 — פונקציה `handleBet` שולחת POST ל-`/api/user-answers/submit` עם questionId, selectedOptionId ו-wager
- `packages/client/src/screens/GameScreen.js`, שורה 884 — כפתורי ההימור (TouchableOpacity) שקוראים ל-handleBet בלחיצה

## 2. כפתורים שיצטרכו בדיקת הרשאה
- כפתור הימור על תשובה — `packages/client/src/screens/GameScreen.js` שורה 884 (BettingSection)
- כפתור "Close question & distribute rewards" — `packages/client/src/screens/GameScreen.js` שורה 763 (ResolveQuestionSection)
- כפתורי בחירת מנצח — `packages/client/src/screens/GameScreen.js` שורה 741 (ResolveQuestionSection)
- כפתור "Send gift" — `packages/client/src/screens/GameScreen.js` שורה 1029 (SendGiftSection)
- כפתור "Start watching" — `packages/client/src/app/viewer_test.js` שורה 94 (ViewerTestScreen)

## 3. האם קיימת כבר בדיקת התחברות
לא.

- `packages/client/src/screens/GameScreen.js` — קיימת פונקציה `getAuthHeaders` (שורה 20) שמצרפת טוקן לבקשות, אך אין בדיקה אם המשתמש אכן מחובר לפני ביצוע פעולות (המרה, resolve, gift)
- `packages/client/src/app/viewer_test.js` — אין ייבוא של authService בכלל. כפתור "Start watching" נגיש לכל משתמש ללא בדיקה
- `packages/client/src/store/slices/gameStreamSlice.js` — reducer `initGameSession` (שורה 21) מקבל role מה-client ללא אימות. סיכון: כל dispatch יכול לקבוע role=HOST