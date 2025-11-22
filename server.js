// ==================== DEPENDENCIES ====================
require('dotenv').config();
const express = require('express');
const pg = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const { exec } = require('child_process');
const { rateLimit } = require('express-rate-limit');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const { body, validationResult } = require('express-validator');

// ==================== CONFIGURATION ====================
const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'forexpro-secret-key';
const NODE_ENV = process.env.NODE_ENV || 'development';
const SALT_ROUNDS = 12; // Increased salt rounds for better security

// Exchange rates (in a real app, these would be fetched from an API)
const EXCHANGE_RATES = {
  USD_TO_KSH: 150.0, // 1 USD = 150 KSH
  KSH_TO_USD: 1/150.0 // 1 KSH = 0.00667 USD
};

// Currency formatting helper functions
function formatCurrency(amount, currency = 'KSH') {
  if (currency === 'USD') {
    return `$${parseFloat(amount).toFixed(2)}`;
  } else {
    return `KSH ${parseFloat(amount).toLocaleString()}`;
  }
}

function convertCurrency(amount, fromCurrency, toCurrency) {
  if (fromCurrency === toCurrency) return amount;
  
  if (fromCurrency === 'USD' && toCurrency === 'KSH') {
    return amount * EXCHANGE_RATES.USD_TO_KSH;
  } else if (fromCurrency === 'KSH' && toCurrency === 'USD') {
    return amount * EXCHANGE_RATES.KSH_TO_USD;
  }
  
  return amount; // Fallback
}

// Database connection with optimized pool settings
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: NODE_ENV === 'production' ? { rejectUnauthorized: true } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Handle database errors
pool.on('error', (err) => {
  console.error('Database error:', err);
  process.exit(-1);
});

// ==================== MIDDLEWARE ====================
// Replace your current helmet configuration with this:
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'", "data:", "blob:", "https:"],
      styleSrc: ["'self'", "'unsafe-inline'", "https:", "data:"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https:"],
      fontSrc: ["'self'", "https:", "data:"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https:"],
      mediaSrc: ["'self'", "https:", "data:"],
      objectSrc: ["'none'"],
      childSrc: ["'self'", "https:"],
      workerSrc: ["'self'", "blob:"],
      frameSrc: ["'self'", "https:"],
      formAction: ["'self'", "https:"],
    },
  },
}));

app.use(compression());
app.use(cors({
  origin: process.env.FRONTEND_URL || ['http://localhost:3000', 'https://fly-io-haha.onrender.com'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Enhanced logging middleware
app.use(morgan(NODE_ENV === 'production' ? 'combined' : 'dev', {
  skip: (req, res) => NODE_ENV === 'production' && res.statusCode < 400
}));

// Enhanced rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many authentication attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/auth/', authLimiter);

// Request logging middleware
app.use((req, res, next) => {
  const baseUrl = 'https://fly-io-haha.onrender.com';
  const fullUrl = `${baseUrl}${req.originalUrl}`;
  console.log(`[${new Date().toISOString()}] ${req.method} ${fullUrl}`);
  next();
});

// ==================== DATABASE INITIALIZATION ====================
const initializeDatabase = async () => {
  try {
    console.log('Initializing database...');
    
    // Create users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(100),
        phone VARCHAR(20),
        country VARCHAR(50),
        currency VARCHAR(10) DEFAULT 'KSH',
        balance DECIMAL(15, 2) DEFAULT 0,
        profit DECIMAL(15, 2) DEFAULT 0,
        active_bots INTEGER DEFAULT 0,
        referrals INTEGER DEFAULT 0,
        referral_code VARCHAR(20) UNIQUE,
        referred_by VARCHAR(20),
        profile_image TEXT,
        role VARCHAR(20) DEFAULT 'user',
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Create transactions table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(20) NOT NULL,
        method VARCHAR(20) NOT NULL,
        amount DECIMAL(15, 2) NOT NULL,
        currency VARCHAR(10) DEFAULT 'KSH',
        status VARCHAR(20) DEFAULT 'pending',
        tx_hash TEXT,
        address TEXT,
        network TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Create trading bots table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS trading_bots (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        investment DECIMAL(15, 2) NOT NULL,
        daily_profit DECIMAL(15, 2) NOT NULL,
        total_profit DECIMAL(15, 2) NOT NULL,
        progress INTEGER DEFAULT 0,
        image_url TEXT,
        status VARCHAR(20) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Create referral bonuses table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS referral_bonuses (
        id SERIAL PRIMARY KEY,
        referrer_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        referred_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        amount DECIMAL(15, 2) NOT NULL,
        currency VARCHAR(10) DEFAULT 'KSH',
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT NOW(),
        completed_at TIMESTAMP
      );
    `);

    // Create indexes for better performance
    try {
      await pool.query('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code)');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id)');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status)');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_bots_user_id ON trading_bots(user_id)');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_referrals_referrer_id ON referral_bonuses(referrer_id)');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_referrals_referred_id ON referral_bonuses(referred_id)');
      console.log('Database indexes created');
    } catch (err) {
      console.log('Indexes might already exist:', err.message);
    }

    // Create admin user if not exists
    const adminExists = await pool.query('SELECT * FROM users WHERE email = $1', ['admin@forexpro.com']);
    if (adminExists.rows.length === 0) {
      const hashedPassword = await bcrypt.hash('admin123', SALT_ROUNDS);
      await pool.query(
        `INSERT INTO users (name, email, password, role, balance, currency) 
         VALUES ($1, $2, $3, $4, $5, $6)`,
        ['Admin User', 'admin@forexpro.com', hashedPassword, 'admin', 1000000, 'USD']
      );
      console.log('Admin user created');
    }

    console.log('Database initialized successfully');
  } catch (err) {
    console.error('Error initializing database:', err);
    throw err;
  }
};

// ==================== HELPER FUNCTIONS ====================
const generateToken = (userId, role = 'user') => {
  return jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: '30d' });
};

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

const authenticateAdmin = (req, res, next) => {
  authenticateToken(req, res, () => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }
    next();
  });
};

// Function to kill process using a port
const killPort = (port) => {
  return new Promise((resolve, reject) => {
    const commands = [
      `sudo fuser -k ${port}/tcp`,
      `fuser -k ${port}/tcp`,
      `sudo lsof -ti:${port} | xargs kill -9`,
      `lsof -ti:${port} | xargs kill -9`,
      `sudo netstat -tulpn | grep :${port} | awk '{print $7}' | cut -d'/' -f1 | xargs kill -9`,
      `netstat -tulpn | grep :${port} | awk '{print $7}' | cut -d'/' -f1 | xargs kill -9`
    ];

    const tryCommand = (index) => {
      if (index >= commands.length) {
        console.log(`Port ${port} is not in use or couldn't be killed`);
        return resolve();
      }

      exec(commands[index], (error) => {
        if (!error) {
          console.log(`Killed process using port ${port} with command: ${commands[index]}`);
          return resolve();
        }
        tryCommand(index + 1);
      });
    };

    tryCommand(0);
  });
};

// ==================== FILE SYSTEM SETUP ====================
const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)) {
  console.log('Creating public directory...');
  fs.mkdirSync(publicDir, { recursive: true });
}

// Serve static files
app.use(express.static(path.join(__dirname, 'public'), {
  dotfiles: 'ignore',
  etag: true,
  maxAge: '1h',
  setHeaders: (res, path) => {
    if (path.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  }
}));

// ==================== HTML PAGE ROUTES ====================

// Serve specific HTML pages based on route
const htmlRoutes = [
  ['/dashboard', 'dashboard.html'],
  ['/admin', 'admin.html'],
  ['/demo', 'demo.html'],
  ['/trading', 'trading.html'],
  ['/deposit-withdraw', 'deposit-withdraw.html'],
  ['/profile', 'profile.html'],
  ['/referrals', 'referrals.html']
];

htmlRoutes.forEach(([route, file]) => {
  app.get([route, `/${file}`], (req, res) => {
    res.sendFile(path.join(publicDir, file));
  });
});

// Serve index.html for root path
app.get(['/', '/index.html'], (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

// ==================== AUTHENTICATION ROUTES ====================

// Signup API with 200 KSH sign-up bonus
app.post('/api/auth/signup', [
  body('name').notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('phone').optional().isMobilePhone().withMessage('Invalid phone number'),
  body('country').optional().isLength({ min: 2 }).withMessage('Country must be at least 2 characters'),
  body('currency').optional().isIn(['KSH', 'USD']).withMessage('Currency must be KSH or USD'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { name, email, password, phone, country, currency = 'KSH', referralCode, isDemo = false } = req.body;
  
  try {
    // Check if user already exists
    const userExists = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userExists.rows.length > 0) {
      return res.status(400).json({ message: 'User already exists' });
    }
    
    // Hash password (skip for demo accounts)
    let hashedPassword = null;
    if (!isDemo) {
      hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    }
    
    // Generate referral code
    const referralCodeNew = crypto.randomBytes(5).toString('hex');
    
    // Set bonus amount based on currency
    const bonusAmount = currency === 'USD' ? 1.33 : 200; // 200 KSH or ~1.33 USD
    
    // Insert user
    const result = await pool.query(
      `INSERT INTO users (name, email, password, phone, country, currency, referral_code, referred_by, role, balance) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
      [name, email, hashedPassword, phone, country, currency, referralCodeNew, referralCode, isDemo ? 'demo' : 'user', isDemo ? 66.67 : bonusAmount]
    );
    
    const userId = result.rows[0].id;
    const token = generateToken(userId, isDemo ? 'demo' : 'user');
    
    // Create sign-up bonus transaction (for non-demo users)
    if (!isDemo) {
      await pool.query(
        `INSERT INTO transactions (user_id, type, method, amount, currency, status) 
         VALUES ($1, 'bonus', 'signup', $2, $3, 'completed')`,
        [userId, bonusAmount, currency]
      );
    }
    
    // Create referral bonus record if referral code was used
    if (referralCode && !isDemo) {
      const referrerResult = await pool.query('SELECT id, currency FROM users WHERE referral_code = $1', [referralCode]);
      if (referrerResult.rows.length > 0) {
        const referrerId = referrerResult.rows[0].id;
        const referrerCurrency = referrerResult.rows[0].currency;
        
        // Convert bonus amount to referrer's currency if needed
        let referralBonus = bonusAmount;
        if (currency !== referrerCurrency) {
          referralBonus = convertCurrency(bonusAmount, currency, referrerCurrency);
        }
        
        await pool.query(
          `INSERT INTO referral_bonuses (referrer_id, referred_id, amount, currency, status)
           VALUES ($1, $2, $3, $4, 'pending')`,
          [referrerId, userId, referralBonus, referrerCurrency]
        );
        
        // Update referrer's referral count
        await pool.query(
          'UPDATE users SET referrals = referrals + 1 WHERE id = $1',
          [referrerId]
        );
      }
    }
    
    res.status(201).json({ 
      message: isDemo ? 'Demo account created successfully' : 'User created successfully', 
      token,
      user: { 
        id: userId, 
        name, 
        email, 
        role: isDemo ? 'demo' : 'user',
        referralCode: referralCodeNew,
        balance: isDemo ? 66.67 : bonusAmount,
        currency: currency
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Login API
app.post('/api/auth/login', [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { email, password } = req.body;
  
  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];
    
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }
    
    // Skip password check for demo accounts
    let isPasswordValid = true;
    if (user.role !== 'demo') {
      isPasswordValid = await bcrypt.compare(password, user.password);
    }
    
    if (!isPasswordValid) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }
    
    const token = generateToken(user.id, user.role);
    
    res.status(200).json({ 
      message: 'Login successful', 
      token,
      user: { 
        id: user.id, 
        name: user.name, 
        email: user.email, 
        balance: user.balance,
        profit: user.profit,
        active_bots: user.active_bots,
        referrals: user.referrals,
        referral_code: user.referral_code,
        profile_image: user.profile_image,
        role: user.role,
        currency: user.currency
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Demo mode login (no credentials required)
app.post('/api/auth/demo', async (req, res) => {
  try {
    // Generate a unique demo email
    const demoEmail = `demo-${crypto.randomBytes(5).toString('hex')}@forexpro.demo`;
    
    // Create demo user
    const result = await pool.query(
      `INSERT INTO users (name, email, role, balance, currency) 
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      ['Demo User', demoEmail, 'demo', 66.67, 'USD']
    );
    
    const userId = result.rows[0].id;
    const token = generateToken(userId, 'demo');
    
    res.status(200).json({ 
      message: 'Demo mode activated', 
      token,
      user: { 
        id: userId, 
        name: 'Demo User', 
        email: demoEmail, 
        balance: 66.67,
        profit: 0,
        active_bots: 0,
        referrals: 0,
        role: 'demo',
        currency: 'USD'
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ==================== USER PROFILE ROUTES ====================

// Get user profile
app.get('/api/user/profile', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.userId]);
    const user = result.rows[0];
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Get exchange rate info
    const otherCurrency = user.currency === 'KSH' ? 'USD' : 'KSH';
    const convertedBalance = convertCurrency(user.balance, user.currency, otherCurrency);
    
    res.status(200).json({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      country: user.country,
      currency: user.currency,
      balance: user.balance,
      convertedBalance: convertedBalance,
      otherCurrency: otherCurrency,
      profit: user.profit,
      active_bots: user.active_bots,
      referrals: user.referrals,
      referral_code: user.referral_code,
      profile_image: user.profile_image,
      role: user.role
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update user profile
app.put('/api/user/profile', [
  body('name').optional().notEmpty().withMessage('Name cannot be empty'),
  body('email').optional().isEmail().withMessage('Valid email is required'),
  body('phone').optional().isMobilePhone().withMessage('Invalid phone number'),
  body('country').optional().isLength({ min: 2 }).withMessage('Country must be at least 2 characters'),
  body('currency').optional().isIn(['KSH', 'USD']).withMessage('Currency must be KSH or USD'),
], authenticateToken, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { name, email, phone, country, currency } = req.body;
  
  try {
    // Get current user data to check if currency is changing
    const currentUserResult = await pool.query('SELECT currency, balance FROM users WHERE id = $1', [req.user.userId]);
    const currentUser = currentUserResult.rows[0];
    
    let newBalance = currentUser.balance;
    
    // If currency is changing, convert the balance
    if (currency && currency !== currentUser.currency) {
      newBalance = convertCurrency(currentUser.balance, currentUser.currency, currency);
    }
    
    await pool.query(
      `UPDATE users SET 
        name = COALESCE($1, name), 
        email = COALESCE($2, email), 
        phone = COALESCE($3, phone), 
        country = COALESCE($4, country), 
        currency = COALESCE($5, currency),
        balance = COALESCE($6, balance)
       WHERE id = $7`,
      [name, email, phone, country, currency, newBalance, req.user.userId]
    );
    
    res.status(200).json({ 
      message: 'Profile updated successfully',
      currencyChanged: currency && currency !== currentUser.currency,
      newCurrency: currency || currentUser.currency,
      convertedBalance: newBalance
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ==================== TRANSACTION ROUTES ====================

// Deposit API with referral bonus processing
app.post('/api/deposit', [
  body('amount').isFloat({ gt: 0 }).withMessage('Amount must be greater than 0'),
  body('method').notEmpty().withMessage('Deposit method is required'),
  body('currency').isIn(['KSH', 'USD']).withMessage('Currency must be KSH or USD'),
], authenticateToken, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { amount, method, currency, network, address } = req.body;
  
  try {
    // Get user's current currency
    const userResult = await pool.query('SELECT currency, referred_by FROM users WHERE id = $1', [req.user.userId]);
    const user = userResult.rows[0];
    
    // Convert amount to user's currency if needed
    let convertedAmount = amount;
    if (currency !== user.currency) {
      convertedAmount = convertCurrency(amount, currency, user.currency);
    }
    
    // Create transaction record
    const result = await pool.query(
      `INSERT INTO transactions (user_id, type, method, amount, currency, network, address) 
       VALUES ($1, 'deposit', $2, $3, $4, $5, $6) RETURNING id`,
      [req.user.userId, method, convertedAmount, user.currency, network, address]
    );
    
    const transactionId = result.rows[0].id;
    
    // Check if user was referred and deposit meets minimum requirement
    const minDeposit = user.currency === 'KSH' ? 10000 : 66.67; // 10000 KSH or ~66.67 USD
    if (parseFloat(convertedAmount) >= minDeposit) {
      if (user.referred_by) {
        // Check if referral bonus is still pending
        const bonusResult = await pool.query(
          `SELECT * FROM referral_bonuses 
           WHERE referred_id = $1 AND status = 'pending'`,
          [req.user.userId]
        );
        
        if (bonusResult.rows.length > 0) {
          const bonus = bonusResult.rows[0];
          
          // Update bonus status to completed
          await pool.query(
            `UPDATE referral_bonuses 
             SET status = 'completed', completed_at = NOW() 
             WHERE id = $1`,
            [bonus.id]
          );
          
          // Credit referrer's account
          await pool.query(
            'UPDATE users SET balance = balance + $1 WHERE id = $2',
            [bonus.amount, bonus.referrer_id]
          );
          
          // Create transaction record for the bonus
          await pool.query(
            `INSERT INTO transactions (user_id, type, method, amount, currency, status)
             VALUES ($1, 'bonus', 'referral', $2, $3, 'completed')`,
            [bonus.referrer_id, bonus.amount, bonus.currency]
          );
        }
      }
    }
    
    // For crypto deposits, return the deposit address
    if (method === 'crypto') {
      return res.status(200).json({
        message: 'Deposit request created',
        transactionId,
        depositAddress: '0x081fc7d993439f0aa44e8d9514c00d0b560fb940',
        network: network || 'BSC',
        amount: formatCurrency(convertedAmount, user.currency),
        originalAmount: formatCurrency(amount, currency)
      });
    }
    
    // For fiat deposits, mark as pending
    res.status(200).json({
      message: 'Deposit request submitted',
      transactionId,
      status: 'pending',
      amount: formatCurrency(convertedAmount, user.currency),
      originalAmount: formatCurrency(amount, currency)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Withdraw API (creates pending request for admin approval)
app.post('/api/withdraw', [
  body('amount').isFloat({ gt: 0 }).withMessage('Amount must be greater than 0'),
  body('method').notEmpty().withMessage('Withdrawal method is required'),
  body('currency').isIn(['KSH', 'USD']).withMessage('Currency must be KSH or USD'),
  body('address').notEmpty().withMessage('Withdrawal address is required'),
  body('password').notEmpty().withMessage('Password is required'),
], authenticateToken, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { amount, method, currency, address, password } = req.body;
  
  try {
    // Get user's current currency and password
    const userResult = await pool.query('SELECT password, balance, currency FROM users WHERE id = $1', [req.user.userId]);
    const user = userResult.rows[0];
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Verify password (skip for demo users)
    if (req.user.role !== 'demo') {
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return res.status(400).json({ message: 'Invalid password' });
      }
    }
    
    // Convert amount to user's currency if needed
    let convertedAmount = amount;
    if (currency !== user.currency) {
      convertedAmount = convertCurrency(amount, currency, user.currency);
    }
    
    // Check balance
    if (parseFloat(user.balance) < parseFloat(convertedAmount)) {
      return res.status(400).json({ 
        message: 'Insufficient balance',
        balance: formatCurrency(user.balance, user.currency),
        requestedAmount: formatCurrency(convertedAmount, user.currency)
      });
    }
    
    // Create transaction record (pending)
    const result = await pool.query(
      `INSERT INTO transactions (user_id, type, method, amount, currency, address, status) 
       VALUES ($1, 'withdraw', $2, $3, $4, $5, 'pending') RETURNING id`,
      [req.user.userId, method, convertedAmount, user.currency, address]
    );
    
    const transactionId = result.rows[0].id;
    
    res.status(200).json({
      message: 'Withdrawal request submitted for approval',
      transactionId,
      status: 'pending',
      amount: formatCurrency(convertedAmount, user.currency),
      originalAmount: formatCurrency(amount, currency)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get transactions
app.get('/api/transactions', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM transactions WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.userId]
    );
    
    // Get user's currency for display
    const userResult = await pool.query('SELECT currency FROM users WHERE id = $1', [req.user.userId]);
    const userCurrency = userResult.rows[0].currency;
    
    // Format transactions with currency info
    const transactions = result.rows.map(tx => {
      const formattedTx = {
        ...tx,
        formattedAmount: formatCurrency(tx.amount, tx.currency)
      };
      
      // Add converted amount if different from user's currency
      if (tx.currency !== userCurrency) {
        formattedTx.convertedAmount = formatCurrency(
          convertCurrency(tx.amount, tx.currency, userCurrency), 
          userCurrency
        );
      }
      
      return formattedTx;
    });
    
    res.status(200).json(transactions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ==================== REFERRAL SYSTEM ROUTES ====================

// Get referral stats
app.get('/api/referral/stats', authenticateToken, async (req, res) => {
  try {
    const userResult = await pool.query('SELECT referrals, currency FROM users WHERE id = $1', [req.user.userId]);
    const user = userResult.rows[0];
    const totalReferrals = user.referrals;
    
    const bonusResult = await pool.query(
      `SELECT 
        COUNT(*) FILTER (WHERE status = 'completed') as completed_referrals,
        COUNT(*) FILTER (WHERE status = 'pending') as pending_referrals,
        SUM(amount) FILTER (WHERE status = 'completed') as total_bonus
      FROM referral_bonuses
      WHERE referrer_id = $1`,
      [req.user.userId]
    );
    
    const { completed_referrals, pending_referrals, total_bonus } = bonusResult.rows[0];
    
    // Bonus amount per referral in user's currency
    const bonusPerReferral = user.currency === 'USD' ? 1.33 : 200;
    
    res.status(200).json({
      total_referrals: totalReferrals,
      completed_referrals: parseInt(completed_referrals) || 0,
      pending_referrals: parseInt(pending_referrals) || 0,
      total_bonus: parseFloat(total_bonus) || 0,
      formatted_total_bonus: formatCurrency(parseFloat(total_bonus) || 0, user.currency),
      bonus_per_referral: bonusPerReferral,
      formatted_bonus_per_referral: formatCurrency(bonusPerReferral, user.currency)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get referral history
app.get('/api/referral/history', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        u.id,
        u.name,
        u.email,
        u.created_at as referral_date,
        rb.status as bonus_status,
        rb.completed_at as bonus_date,
        rb.amount as bonus_amount,
        rb.currency as bonus_currency
      FROM users u
      LEFT JOIN referral_bonuses rb ON u.id = rb.referred_id
      WHERE u.referred_by = (SELECT referral_code FROM users WHERE id = $1)
      ORDER BY u.created_at DESC`,
      [req.user.userId]
    );
    
    // Get user's currency for display
    const userResult = await pool.query('SELECT currency FROM users WHERE id = $1', [req.user.userId]);
    const userCurrency = userResult.rows[0].currency;
    
    // Format referral history with currency info
    const referrals = result.rows.map(ref => {
      const formattedRef = {
        ...ref,
        formatted_bonus_amount: formatCurrency(ref.bonus_amount, ref.bonus_currency)
      };
      
      // Add converted amount if different from user's currency
      if (ref.bonus_currency !== userCurrency) {
        formattedRef.converted_bonus_amount = formatCurrency(
          convertCurrency(ref.bonus_amount, ref.bonus_currency, userCurrency), 
          userCurrency
        );
      }
      
      return formattedRef;
    });
    
    res.status(200).json(referrals);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ==================== TRADING BOTS ROUTES ====================

// Get trading bots
app.get('/api/bots', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM trading_bots WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.userId]
    );
    
    // Get user's currency for display
    const userResult = await pool.query('SELECT currency FROM users WHERE id = $1', [req.user.userId]);
    const userCurrency = userResult.rows[0].currency;
    
    // Format bots with currency info
    const bots = result.rows.map(bot => {
      // Convert bot amounts to user's currency if needed
      const investment = convertCurrency(bot.investment, 'KSH', userCurrency);
      const dailyProfit = convertCurrency(bot.daily_profit, 'KSH', userCurrency);
      const totalProfit = convertCurrency(bot.total_profit, 'KSH', userCurrency);
      
      return {
        ...bot,
        investment: investment,
        daily_profit: dailyProfit,
        total_profit: totalProfit,
        formatted_investment: formatCurrency(investment, userCurrency),
        formatted_daily_profit: formatCurrency(dailyProfit, userCurrency),
        formatted_total_profit: formatCurrency(totalProfit, userCurrency),
        currency: userCurrency
      };
    });
    
    res.status(200).json(bots);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create trading bot with improved logic
app.post('/api/bots', [
  body('name').notEmpty().withMessage('Bot name is required'),
  body('investment').isFloat({ gt: 0 }).withMessage('Investment must be greater than 0'),
], authenticateToken, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { name, investment } = req.body;
  const amount = parseFloat(investment);

  try {
    // Get user's balance and currency
    const userResult = await pool.query('SELECT balance, currency FROM users WHERE id = $1', [req.user.userId]);
    const user = userResult.rows[0];
    
    // Convert investment to KSH for internal storage
    const investmentInKSH = convertCurrency(amount, user.currency, 'KSH');

    if (amount > parseFloat(user.balance)) {
      return res.status(400).json({ 
        message: 'Insufficient balance',
        balance: formatCurrency(user.balance, user.currency),
        investment: formatCurrency(amount, user.currency)
      });
    }

    // Define investment brackets (sorted descending for easy matching)
    const brackets = [
      { min: 100000, multiplier: 2.5 },
      { min: 70000, multiplier: 2.8 },
      { min: 50000, multiplier: 2.25 },
      { min: 45000, multiplier: 2.3 },
      { min: 40000, multiplier: 2.3 },
      { min: 30000, multiplier: 2.6 },
      { min: 20000, multiplier: 2.5 },
      { min: 15000, multiplier: 2.4 },
      { min: 10000, multiplier: 2.3 },
      { min: 7000, multiplier: 2.65 },
      { min: 2000, multiplier: 2.33 },
      { min: 0, multiplier: 2.2 } // default for small investments
    ];

    // Find the right multiplier based on investment
    let profitMultiplier = brackets.find(br => investmentInKSH >= br.min).multiplier;

    const totalProfitInKSH = investmentInKSH * profitMultiplier;
    const dailyProfitInKSH = totalProfitInKSH / 30; // 30-day cycle

    // Convert profits back to user's currency for display
    const totalProfit = convertCurrency(totalProfitInKSH, 'KSH', user.currency);
    const dailyProfit = convertCurrency(dailyProfitInKSH, 'KSH', user.currency);

    // Insert trading bot (store values in KSH internally)
    const result = await pool.query(
      `INSERT INTO trading_bots (user_id, name, investment, daily_profit, total_profit, image_url) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [
        req.user.userId,
        name,
        investmentInKSH,
        dailyProfitInKSH,
        totalProfitInKSH,
        'https://images.unsplash.com/photo-1639762681485-074b7f938ba0'
      ]
    );

    const botId = result.rows[0].id;

    // Deduct investment from user balance
    await pool.query(
      'UPDATE users SET balance = balance - $1, active_bots = active_bots + 1 WHERE id = $2',
      [amount, req.user.userId]
    );

    res.status(201).json({
      message: 'Trading bot created successfully',
      botId,
      expectedReturn: formatCurrency(totalProfit, user.currency),
      dailyProfit: formatCurrency(dailyProfit, user.currency),
      investment: formatCurrency(amount, user.currency),
      currency: user.currency
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Simulate bot progress (for demo purposes)
app.post('/api/bots/:id/progress', [
  body('progress').isInt({ min: 0, max: 100 }).withMessage('Progress must be between 0 and 100'),
], authenticateToken, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const botId = req.params.id;
  const { progress } = req.body;
  
  try {
    // Check if bot belongs to user
    const botResult = await pool.query('SELECT * FROM trading_bots WHERE id = $1 AND user_id = $2', [botId, req.user.userId]);
    if (botResult.rows.length === 0) {
      return res.status(404).json({ message: 'Bot not found' });
    }
    
    const bot = botResult.rows[0];
    
    // Update bot progress
    await pool.query(
      'UPDATE trading_bots SET progress = $1 WHERE id = $2',
      [progress, botId]
    );
    
    // If progress is 100%, complete the bot and credit profits
    if (progress >= 100) {
      await pool.query(
        'UPDATE trading_bots SET status = $1 WHERE id = $2',
        ['completed', botId]
      );
      
      // Get user's currency
      const userResult = await pool.query('SELECT currency FROM users WHERE id = $1', [req.user.userId]);
      const userCurrency = userResult.rows[0].currency;
      
      // Convert profits to user's currency
      const totalProfit = convertCurrency(bot.total_profit, 'KSH', userCurrency);
      
      // Credit profits to user
      await pool.query(
        'UPDATE users SET balance = balance + $1, profit = profit + $1, active_bots = active_bots - 1 WHERE id = $2',
        [totalProfit, req.user.userId]
      );
      
      // Create transaction for the profit
      await pool.query(
        `INSERT INTO transactions (user_id, type, method, amount, currency, status) 
         VALUES ($1, 'profit', 'bot', $2, $3, 'completed')`,
        [req.user.userId, totalProfit, userCurrency]
      );
    }
    
    res.status(200).json({ message: 'Bot progress updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ==================== ADMIN ROUTES ====================

// Admin login
app.post('/api/admin/login', [
  body('username').notEmpty().withMessage('Username is required'),
  body('password').notEmpty().withMessage('Password is required'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { username, password } = req.body;
  
  try {
    // Check admin credentials
    const result = await pool.query('SELECT * FROM users WHERE email = $1 AND role = $2', ['admin@forexpro.com', 'admin']);
    const admin = result.rows[0];
    
    if (!admin) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    const isPasswordValid = await bcrypt.compare(password, admin.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    const token = jwt.sign({ userId: admin.id, role: 'admin' }, JWT_SECRET, { expiresIn: '24h' });
    
    res.status(200).json({ 
      message: 'Admin login successful', 
      token 
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all transactions (admin only)
app.get('/api/admin/transactions', authenticateAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT t.*, u.name as user_name, u.email as user_email, u.currency as user_currency FROM transactions t JOIN users u ON t.user_id = u.id ORDER BY t.created_at DESC',
      []
    );
    
    // Format transactions with currency info
    const transactions = result.rows.map(tx => {
      return {
        ...tx,
        formatted_amount: formatCurrency(tx.amount, tx.currency)
      };
    });
    
    res.status(200).json(transactions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update transaction status (admin only)
app.put('/api/admin/transactions/:id', [
  body('status').isIn(['pending', 'completed', 'failed']).withMessage('Invalid status'),
], authenticateAdmin, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { status } = req.body;
  const transactionId = req.params.id;
  
  try {
    // Get transaction details
    const transactionResult = await pool.query('SELECT * FROM transactions WHERE id = $1', [transactionId]);
    if (transactionResult.rows.length === 0) {
      return res.status(404).json({ message: 'Transaction not found' });
    }
    
    const transaction = transactionResult.rows[0];
    
    // Update transaction status
    await pool.query(
      'UPDATE transactions SET status = $1 WHERE id = $2',
      [status, transactionId]
    );
    
    // If transaction is completed and type is deposit, update user balance
    if (status === 'completed' && transaction.type === 'deposit') {
      await pool.query(
        'UPDATE users SET balance = balance + $1 WHERE id = $2',
        [transaction.amount, transaction.user_id]
      );
    }
    
    // If transaction is completed and type is withdraw, deduct from user balance
    if (status === 'completed' && transaction.type === 'withdraw') {
      await pool.query(
        'UPDATE users SET balance = balance - $1 WHERE id = $2',
        [transaction.amount, transaction.user_id]
      );
    }
    
    res.status(200).json({ 
      message: 'Transaction updated successfully',
      formatted_amount: formatCurrency(transaction.amount, transaction.currency)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin deposit to user (admin only)
app.post('/api/admin/deposit', [
  body('userId').isInt().withMessage('Valid user ID is required'),
  body('amount').isFloat({ gt: 0 }).withMessage('Amount must be greater than 0'),
  body('currency').isIn(['KSH', 'USD']).withMessage('Currency must be KSH or USD'),
], authenticateAdmin, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { userId, amount, currency, note } = req.body;
  
  try {
    // Check if target user exists
    const targetUserResult = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    if (targetUserResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const targetUser = targetUserResult.rows[0];
    
    // Convert amount to user's currency if needed
    let convertedAmount = amount;
    if (currency !== targetUser.currency) {
      convertedAmount = convertCurrency(amount, currency, targetUser.currency);
    }
    
    // Create transaction record
    const transactionResult = await pool.query(
      `INSERT INTO transactions (user_id, type, method, amount, currency, status) 
       VALUES ($1, 'deposit', 'admin', $2, $3, 'completed') RETURNING id`,
      [userId, convertedAmount, targetUser.currency]
    );
    
    // Update user balance
    await pool.query(
      'UPDATE users SET balance = balance + $1 WHERE id = $2',
      [convertedAmount, userId]
    );
    
    res.status(200).json({ 
      message: 'Deposit successful', 
      transactionId: transactionResult.rows[0].id,
      formatted_amount: formatCurrency(convertedAmount, targetUser.currency),
      original_amount: formatCurrency(amount, currency)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all users (admin only)
app.get('/api/admin/users', authenticateAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, email, balance, profit, active_bots, referrals, currency, created_at FROM users ORDER BY created_at DESC',
      []
    );
    
    // Format users with currency info
    const users = result.rows.map(user => {
      return {
        ...user,
        formatted_balance: formatCurrency(user.balance, user.currency),
        formatted_profit: formatCurrency(user.profit, user.currency)
      };
    });
    
    res.status(200).json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update user balance (admin only)
app.put('/api/admin/users/:id/balance', [
  body('balance').isFloat({ min: 0 }).withMessage('Balance must be a positive number'),
], authenticateAdmin, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { balance } = req.body;
  const userId = req.params.id;
  
  try {
    // Get user's currency
    const userResult = await pool.query('SELECT currency FROM users WHERE id = $1', [userId]);
    const userCurrency = userResult.rows[0].currency;
    
    // Update user balance
    await pool.query(
      'UPDATE users SET balance = $1 WHERE id = $2',
      [balance, userId]
    );
    
    res.status(200).json({ 
      message: 'Balance updated successfully',
      formatted_balance: formatCurrency(balance, userCurrency)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get pending withdrawals (admin only)
app.get('/api/admin/withdrawals/pending', authenticateAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT t.*, u.name as user_name, u.email as user_email, u.currency as user_currency 
       FROM transactions t 
       JOIN users u ON t.user_id = u.id 
       WHERE t.type = 'withdraw' AND t.status = 'pending' 
       ORDER BY t.created_at DESC`,
      []
    );
    
    // Format transactions with currency info
    const transactions = result.rows.map(tx => {
      return {
        ...tx,
        formatted_amount: formatCurrency(tx.amount, tx.currency)
      };
    });
    
    res.status(200).json(transactions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get exchange rates
app.get('/api/exchange-rates', (req, res) => {
  try {
    res.status(200).json({
      USD_TO_KSH: EXCHANGE_RATES.USD_TO_KSH,
      KSH_TO_USD: EXCHANGE_RATES.KSH_TO_USD,
      last_updated: new Date().toISOString()
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ==================== ERROR HANDLING MIDDLEWARE ====================

// 404 handler for all other routes
app.get('*', (req, res) => {
  res.status(404).send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>ForexPro - Page Not Found</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #0a0a0a 100%);
          color: white;
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100vh;
          margin: 0;
          text-align: center;
        }
        .container {
          max-width: 600px;
          padding: 2rem;
        }
        h1 {
          font-size: 3rem;
          margin-bottom: 1rem;
        }
        p {
          font-size: 1.2rem;
          margin-bottom: 2rem;
        }
        a {
          color: #3b82f6;
          text-decoration: none;
          font-weight: bold;
        }
        a:hover {
          text-decoration: underline;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>404 - Page Not Found</h1>
        <p>The page you are looking for does not exist.</p>
        <p><a href="/">Go to Homepage</a></p>
      </div>
    </body>
    </html>
  `);
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

// ==================== SERVER STARTUP ====================

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('SIGINT signal received: closing HTTP server');
  await pool.end();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: closing HTTP server');
  await pool.end();
  process.exit(0);
});

// Start server
const startServer = async () => {
  try {
    // Kill any process using the port
    console.log(`Checking for processes using port ${PORT}...`);
    await killPort(PORT);
    
    // Initialize database
    await initializeDatabase();
    
    // Start the server
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Base URL: https://fly-io-haha.onrender.com`);
      console.log(`Public directory: ${publicDir}`);
      console.log(`Exchange rate: 1 USD = ${EXCHANGE_RATES.USD_TO_KSH} KSH`);
      
      // List files in public directory
      const files = fs.readdirSync(publicDir);
      console.log('Files in public directory:', files);
      
      // Check if .env is in public directory (security warning)
      if (files.includes('.env')) {
        console.error('⚠️  SECURITY WARNING: .env file found in public directory!');
        console.error('   This could expose your environment variables to the public.');
        console.error('   Move .env to the root directory of your project.');
      }
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
};

startServer();