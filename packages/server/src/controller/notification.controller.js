// ניהול התראות מערכת — שליפה, סימון כנקרא ויצירה פנימית מ-services
import { ERROR_MESSAGES } from '@worldplay/shared';
import notificationService from '../services/notification.service.js';

export const getMyNotifications = async (req, res) => {
  const userId = req.user?.id;
  const { filter } = req.query;

  if (!userId)
    return res.status(400).json({ message: ERROR_MESSAGES.USER_ID_REQUIRED });

  try {
    const { notifications, unreadCount } =
      await notificationService.fetchUserNotifications(userId, filter);

    res.status(200).json({
      success: true,
      data: notifications,
      unreadCount,
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({
      success: false,
      message: ERROR_MESSAGES.FAILED_TO_FETCH_NOTIFICATIONS,
    });
  }
};

export const markAsRead = async (req, res) => {
  const { notificationId } = req.params;

  try {
    await notificationService.updateNotificationReadStatus(notificationId);
    res
      .status(200)
      .json({ success: true, message: 'Notification marked as read' });
  } catch (error) {
    console.error('Error marking as read:', error);
    res.status(500).json({
      success: false,
      message: ERROR_MESSAGES.FAILED_TO_UPDATE_NOTIFICATION,
    });
  }
};

export const createTestNotification = async (req, res) => {
  const { userId, title, message } = req.body;

  if (!userId || !title || !message) {
    return res.status(400).json({ message: 'Missing fields' });
  }

  try {
    const newNotification = await notificationService.createNewNotification(
      userId,
      title,
      message
    );
    res.status(201).json({ success: true, data: newNotification });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createSystemNotification = async (userId, title, message) => {
  try {
    await notificationService.createNewNotification(userId, title, message);
    console.log(`Notification created for user ${userId}: ${message}`);
  } catch (error) {
    console.error('Error creating notification:', error);
  }
};
