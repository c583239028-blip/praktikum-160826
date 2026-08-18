// streamStatsSlice.js
// TODO: מיקום סופי בפרויקט - כנראה packages/client/src/store/streamStatsSlice.js
// (לוודא מול Sara / מבנה ה-store הקיים)
//
// TODO (סוכם עם Sara): כרגע אין מקור נתונים אמיתי ל-streamTitle/viewerCount/giftCount.
// זהו מוק זמני בלבד. בהמשך (טיקט נפרד) צריך לחווט את זה למקור אמיתי -
// "מאומת: ROOM_UPDATE (לפי game.handler.js) לא כולל בכלל נתוני צפייה/מתנות — נדרש מקור חדש לגמרי, לא רק אישור payload."
import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  streamTitle: '',
  viewerCount: 0, // ברירת מחדל 0 כשאין נתונים - כמבוקש
  giftCount: 0, // ברירת מחדל 0 כשאין נתונים - כמבוקש
};

const streamStatsSlice = createSlice({
  name: 'streamStats',
  initialState,
  reducers: {
    // Partial update - אפשר לשלוח רק שדה אחד או כמה
    updateStreamStats: (state, action) => {
      const { streamTitle, viewerCount, giftCount } = action.payload || {};
      if (streamTitle !== undefined) state.streamTitle = streamTitle;
      if (viewerCount !== undefined) state.viewerCount = viewerCount;
      if (giftCount !== undefined) state.giftCount = giftCount;
    },

    resetStreamStats: () => initialState,
  },
});

export const { updateStreamStats, resetStreamStats } = streamStatsSlice.actions;
export default streamStatsSlice.reducer;

// TODO: להוסיף ל-combineReducers / rootReducer הראשי:
// streamStats: streamStatsReducer
