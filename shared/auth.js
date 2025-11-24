// shared/auth.js
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt'); // ← Use native bcrypt (much faster than bcryptjs)
const crypto = require('crypto');

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production-2025';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '30d';
const REFRESH_EXPIRES_IN = '90d';
const SALT_ROUNDS = 12;

// Validate JWT secret in production
if (process.env.NODE_ENV === 'production' && JWT_SECRET === 'your-super-secret-jwt-key-change-in-production-2025') {
  console.error('CRITICAL: JWT_SECRET is using default value in production!');
  process.exit(1);
}

// Generate access token
const generateAccessToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

// Generate refresh token
const generateRefreshToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: REFRESH_EXPIRES_IN });
};

// Generate both tokens
const generateTokens = (user) => {
  const payload = {
    id: user.id,
    email: user.email,
    role: user.role || 'user',
    phone_verified: !!user.phone_verified
  };

  return {
    accessToken: generateAccessToken(payload),
    refreshToken: generateRefreshToken(payload),
    expiresIn: JWT_EXPIRES_IN
  };
};

// Verify token (sync version for reuse)
const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
};

// Middleware: Authenticate JWT
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) {
    return res.status(401).json({ 
      success: false,
      message: 'Access token required' 
    });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(403).json({ 
      success: false,
      message: 'Invalid or expired token' 
    });
  }

  req.user = {
    id: decoded.id,
    email: decoded.email,
    role: decoded.role,
    phone_verified: decoded.phone_verified
  };

  next();
};

// Middleware: Admin only
const authenticateAdmin = (req, res, next) => {
  authenticateToken(req, res, () => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false,
        message: 'Admin access required' 
      });
    }
    next();
  });
};

// Hash password (async)
const hashPassword = async (password) => {
  if (!password || typeof password !== 'string') {
    throw new Error('Password must be a non-empty string');
  }
  return await bcrypt.hash(password.trim(), SALT_ROUNDS);
};

// Compare password
const comparePassword = async (plainPassword, hashedPassword) => {
  if (!plainPassword || !hashedPassword) return false;
  return await bcrypt.compare(plainPassword.trim(), hashedPassword);
};

// Generate secure referral code (8 chars, uppercase)
const generateReferralCode = () => {
  return crypto.randomBytes(4).toString('hex').toUpperCase(); // 8 chars
};

// Generate secure random string (for reset tokens, etc.)
const generateSecureToken = (bytes = 32) => {
  return crypto.randomBytes(bytes).toString('hex');
};

module.exports = {
  generateTokens,
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
  authenticateToken,
  authenticateAdmin,
  hashPassword,
  comparePassword,
  generateReferralCode,
  generateSecureToken,
  JWT_SECRET // Only for testing — never expose in frontend!
};