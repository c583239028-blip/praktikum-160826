import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

export const useAuthGuard = () => {
  const { user, isGuest } = useAuth();
  const [isModalVisible, setIsModalVisible] = useState(false);

  // שומרים את הפעולה הממתינה (כמו "הימור") מבלי לגרום לרינדור מחדש
  const pendingActionRef = useRef(null);

  // מאזינים לשינוי במצב ההתחברות
  useEffect(() => {
    // אם המשתמשת התחברה בהצלחה (כבר לא אורחת) ויש פעולה שממתינה
    if (!isGuest && user && isModalVisible && pendingActionRef.current) {
      pendingActionRef.current(); // 1. מבצעים את הפעולה (למשל: הימור)
      pendingActionRef.current = null; // 2. מנקים את הזיכרון
      setIsModalVisible(false); // 3. סוגרים את המודל
    }
  }, [isGuest, user, isModalVisible]);

  // הפונקציה שעוטפת כל פעולה שדורשת הרשאה
  const guardedAction = useCallback(
    (action) => {
      if (!isGuest && user) {
        // אם היא מחוברת - הפעולה מתבצעת מיד
        action();
      } else {
        // אם היא אורחת - שומרים את הפעולה ופותחים את המודל
        pendingActionRef.current = action;
        setIsModalVisible(true);
      }
    },
    [isGuest, user]
  );

  // פונקציה לסגירת המודל (למקרה שהמשתמשת לחצה על X והתחרטה)
  const closeAuthModal = useCallback(() => {
    setIsModalVisible(false);
    pendingActionRef.current = null; // חשוב לנקות כדי שהפעולה לא תרוץ פתאום בהתחברות עתידית
  }, []);

  return {
    guardedAction,
    isModalVisible,
    closeAuthModal,
  };
};
