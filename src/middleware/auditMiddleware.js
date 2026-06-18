/**
 * Log activity helper (No-op - Audit logging disabled)
 */
export const logActivity = async (userId, action, details, ipAddress = '') => {
  // Audit logging disabled
};

/**
 * Express middleware to attach no-op activity logger to response/request context.
 */
export const auditLogger = (req, res, next) => {
  req.logActivity = async (action, details) => {
    // No-op
  };
  next();
};
