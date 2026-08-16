import { MIN_WAGER } from '../../../shared/src/constants/gameRules.js';

// --- הגדרות משחק כלליות ---
// הערה: BETTING_RULES (WINNER_REFUND_RATIO / LOSER_POT_DISTRIBUTION) נמחק —
// קוד מת ללא צרכנים, בהתאם ל-SPEC §445.
export const GAME_SETTINGS = {
  DEFAULT_QUESTION_TIMER: 45, // שניות לכל שאלה (ברירת מחדל, מתוך הסט [15/30/45/60])
  MIN_WAGER, // הימור מינימלי לשאלה
  MAX_GIFT_AMOUNT: 5000, // סכום מתנה מקסימלי (למניעת הונאה)
};
