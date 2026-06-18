import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { logActivity } from '../middleware/auditMiddleware.js';

// Helper to generate JWT
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'super_secret_jwt_signkey_for_cell_xchange_12345', {
    expiresIn: '30d',
  });
};

/**
 * Login user
 * Route: POST /api/auth/login
 */
export const loginUser = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });

    if (user && (await user.comparePassword(password))) {
      if (!user.isActive) {
        return res.status(401).json({ message: 'User account has been deactivated.' });
      }

      const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
      await logActivity(user._id, 'USER_LOGIN', `User ${user.email} logged in successfully`, ip);

      return res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        token: generateToken(user._id),
      });
    } else {
      const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
      await logActivity(null, 'LOGIN_FAILED', `Failed login attempt for email: ${email}`, ip);
      
      return res.status(401).json({ message: 'Invalid email or password' });
    }
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * Change own password
 * Route: PUT /api/auth/change-password
 */
export const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  try {
    const user = await User.findById(req.user._id);

    if (user && (await user.comparePassword(currentPassword))) {
      user.password = newPassword;
      await user.save();

      await req.logActivity('CHANGE_PASSWORD', 'User updated password successfully');
      return res.json({ message: 'Password updated successfully' });
    } else {
      return res.status(400).json({ message: 'Incorrect current password' });
    }
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * Get profile
 * Route: GET /api/auth/profile
 */
export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    if (user) {
      return res.json(user);
    } else {
      return res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * Get all store users (Admin only)
 * Route: GET /api/auth/users
 */
export const getUsers = async (req, res) => {
  try {
    const users = await User.find({}).select('-password').sort({ createdAt: -1 });
    return res.json(users);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * Create a new user (Admin only)
 * Route: POST /api/auth/users
 */
export const createUser = async (req, res) => {
  const { name, email, password, role } = req.body;

  try {
    const userExists = await User.findOne({ email });

    if (userExists) {
      return res.status(400).json({ message: 'User already exists with this email' });
    }

    if (role === 'super_admin') {
      return res.status(400).json({ message: 'Cannot create another Super Admin account' });
    }

    // Derive name from email if not provided
    const userName = name || (email ? email.split('@')[0] : 'User');

    const newUser = await User.create({
      name: userName,
      email,
      password,
      role: role || 'staff',
      isActive: true,
    });

    await req.logActivity('CREATE_USER', `Created new user ${newUser.email} with role: ${newUser.role}`);

    return res.status(201).json({
      _id: newUser._id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      isActive: newUser.isActive,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * Toggle user active status (Admin only)
 * Route: PATCH /api/auth/users/:id/status
 */
export const toggleUserStatus = async (req, res) => {
  const { id } = req.params;
  const { isActive } = req.body;

  try {
    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'You cannot deactivate your own account' });
    }

    user.isActive = isActive;
    await user.save();

    await req.logActivity(
      'UPDATE_USER_STATUS',
      `Toggled user ${user.email} active status to: ${isActive}`
    );

    return res.json({ message: `User account status updated to ${isActive ? 'Active' : 'Deactivated'}` });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
