import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'super_secret_jwt_signkey_for_cell_xchange_12345');

      req.user = await User.findById(decoded.id).select('-password');
      
      if (!req.user) {
        return res.status(401).json({ message: 'User not found or token invalid' });
      }

      if (!req.user.isActive) {
        return res.status(401).json({ message: 'User account has been deactivated' });
      }

      next();
    } catch (error) {
      console.error('JWT Verification Error:', error.message);
      return res.status(401).json({ message: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token provided' });
  }
};

export const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authorized, user not loaded' });
    }

    if (req.user.role === 'super_admin' || roles.includes(req.user.role)) {
      return next();
    }

    return res.status(403).json({
      message: `Forbidden: Access restricted to roles: [${roles.join(', ')}]. Current role: [${req.user.role}]`
    });
  };
};
