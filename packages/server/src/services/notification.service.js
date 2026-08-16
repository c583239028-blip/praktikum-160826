/**
 * notification.service.js
 *
 * שכבת השירות לניהול התראות מערכת למשתמשים.
 * מטפל ביצירה, שליפה וסימון קריאה של התראות.
 *
 * פונקציות:
 *   fetchUserNotifications(userId, filter)          — שליפת התראות + ספירת לא-נקראות (filter: 'unread' | undefined)
 *   updateNotificationReadStatus(notificationId, userId) — סימון התראה כנקראה (מאמת בעלות)
 *   createNewNotification(userId, title, message)    — יצירת התראה חדשה ('SYSTEM' | 'GAME_INVITE' | 'REWARD')
 *
 * מתקשר עם: Prisma → Notification
 * תלוי ב:   validation.service.js (קיום משתמש, ולידציית טקסט)
 * משמש את:  notification.controller.js
 */
import prisma from '../lib/prisma.js';
import { ERROR_MESSAGES } from '@worldplay/shared';
import * as gameRules from '../services/validation.service.js';

const notificationService = {
  async fetchUserNotifications(userId, filter) {
    await gameRules.ensureUserExists(userId);

    const whereCondition = { userId };
    if (filter === 'unread') {
      whereCondition.isRead = false;
    }

    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: whereCondition,
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      prisma.notification.count({
        where: { userId, isRead: false },
      }),
    ]);

    return { notifications, unreadCount };
  },

  async updateNotificationReadStatus(notificationId, userId) {
    // עדכון מתוחם-בעלות אטומי: מאמת בעלות ומעדכן במכה אחת, בלי TOCTOU
    // בין בדיקת-קיום לעדכון. count === 0 מכסה גם "לא קיים" וגם "שייך למשתמש אחר".
    const { count } = await prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { isRead: true },
    });

    if (count === 0) {
      throw new Error(ERROR_MESSAGES.NOTIFICATION_NOT_FOUND);
    }
  },

  async createNewNotification(userId, title, message) {
    await gameRules.ensureUserExists(userId);
    gameRules.validateNonEmptyText(message, 'Notification message');

    return await prisma.notification.create({
      data: {
        userId,
        title,
        message,
        isRead: false,
      },
    });
  },
};

export default notificationService;
