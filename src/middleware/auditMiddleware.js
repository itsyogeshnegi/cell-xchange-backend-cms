import AuditLog from '../models/AuditLog.js';

/**
 * Log activity helper to write to the AuditLog database collection.
 * @param {string} userId ID of the user performing the action
 * @param {string} action Description of the action (e.g., "DELETE_INVENTORY")
 * @param {string} details Context details
 * @param {string} ipAddress IP Address of client
 */
export const logActivity = async (userId, action, details, ipAddress = '') => {
  try {
    await AuditLog.create({
      user: userId || null,
      action,
      details,
      ipAddress,
    });
  } catch (error) {
    console.error('Audit Logging Error:', error.message);
  }
};

/**
 * Express middleware to attach activity logger to response/request context.
 */
export const auditLogger = (req, res, next) => {
  req.logActivity = async (action, details) => {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
    const userId = req.user ? req.user._id : null;
    await logActivity(userId, action, details, ip);
  };
  next();
};
