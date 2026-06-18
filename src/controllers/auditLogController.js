import AuditLog from '../models/AuditLog.js';

/**
 * Get system activities/logs (paginated, Admin only)
 * Route: GET /api/auditlogs
 */
export const getAuditLogs = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;

  try {
    const total = await AuditLog.countDocuments({});
    const logs = await AuditLog.find({})
      .populate('user', 'name email role')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    return res.json({
      logs,
      page,
      pages: Math.ceil(total / limit),
      total,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
