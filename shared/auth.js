const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const JWT_SECRET = process.env.JWT_SECRET || 'forexpro-secret-key';
const SALT_ROUNDS = 12;

// Generate JWT token
const generateToken = (userId, role = 'user') => {
  return jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: '30d' });
};

// Authenticate token middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.status(401).json({ message: 'Authentication required' });
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: 'Invalid token' });
    req.user = user;
    next();
  });
};

// Authenticate admin middleware
const authenticateAdmin = (req, res, next) => {
  authenticateToken(req, res, () => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }
    next();
  });
};

// Hash password
const hashPassword = async (password) => {
  return await bcrypt.hash(password, SALT_ROUNDS);
};

// Compare password
const comparePassword = async (password, hashedPassword) => {
  return await bcrypt.compare(password, hashedPassword);
};

// Generate referral code
const generateReferralCode = () => {
  return crypto.randomBytes(5).toString('hex');
};

module.exports = {
  generateToken,
  authenticateToken,
  authenticateAdmin,
  hashPassword,
  comparePassword,
  generateReferralCode
};