import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

export const useAuthGuard = () => {
  const { user, isGuest } = useAuth();
  const [isModalVisible, setIsModalVisible] = useState(false);

  // שומרים את הפעולה הממתינה (כמו "הימור") מבלי לגרום לרינדור מחדש
  const pendingActionRef = useRef(null);

  // מאזינים לשינוי במצב ההתחברות
  useEffect(() => {
    // התחברה בהצלחה (כבר לא אורחת) — סוגרים את המודל בכל מקרה, ומריצים פעולה דחויה אם יש
    if (!isGuest && user && isModalVisible) {
      if (pendingActionRef.current) {
        pendingActionRef.current();
        pendingActionRef.current = null;
      }
      setIsModalVisible(false);
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
