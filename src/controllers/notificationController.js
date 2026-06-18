import Notification from '../models/Notification.js';

/**
 * Get active alerts (limit to latest 30)
 * Route: GET /api/notifications
 */
export const getNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({}).sort({ createdAt: -1 }).limit(30);
    return res.json(notifications);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * Mark all alerts as read
 * Route: PUT /api/notifications/read
 */
export const markAllAsRead = async (req, res) => {
  try {
    await Notification.updateMany({ isRead: false }, { $set: { isRead: true } });
    return res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
