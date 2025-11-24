// index.js - Auth server (Improved, production-ready)
// Replace your existing file with this. Keep your supabaseClient and shared modules as before.

const express = require('express');
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const cors = require('cors');
const { body, validationResult } = require('express-validator');

// local project modules - keep your existing files & paths
const supabase = require('../supabaseClient'); // must export initialized Supabase client
const { generateReferralCode } = require('../shared/auth'); // must exist
// optional helpers (you had these referenced earlier)
const { formatCurrency, convertCurrency } = require('../shared/database'); // optional

const app = express();
const PORT = process.env.PORT || 3000;

// -------------------------
// Security & Middleware
// -------------------------
app.use(helmet({
  contentSecurityPolicy: false // allow inline styles/scripts for dev (Tailwind). Change in prod.
}));

app.use(cors({
  origin: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Serve static frontend files from /public
app.use(express.static(path.join(__dirname, '../public')));

// -------------------------
// Rate limiting (auth endpoints)
// -------------------------
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8, // allow 8 attempts per window per IP
  message: { success: false, message: 'Too many attempts. Try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/auth/', authLimiter);

// -------------------------
// JWT generator
// -------------------------
const JWT_SECRET = process.env.JWT_SECRET || 'forexpro_ultra_secure_2025_change_this_in_production';
if (!process.env.JWT_SECRET) {
  console.warn('JWT_SECRET not set. Using fallback secret (insecure for production).');
}
const generateToken = (userId, role = 'user') => {
  return jwt.sign(
    { id: userId, role },
    JWT_SECRET,
    { expiresIn: '30d' } // long-lived token (stored in localStorage on client)
  );
};

// -------------------------
// Helpers
// -------------------------
const standardError = (res, status = 500, message = 'Server error') => {
  return res.status(status).json({ success: false, message });
};

// sanitize user object to send to client
const sanitizeUserForClient = (user) => {
  if (!user) return null;
  const { password, ...safe } = user;
  return safe;
};

// -------------------------
// Routes - Frontend entry
// -------------------------
app.get(['/', '/index.html'], (req, res) => {
  return res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.get(['/demo', '/demo.html'], (req, res) => {
  return res.sendFile(path.join(__dirname, '../public/demo.html'));
});

// -------------------------
// API: Signup (with bonus + referral handling)
// -------------------------
app.post(
  '/api/auth/signup',
  [
    body('name').trim().isLength({ min: 2 }).withMessage('Name too short'),
    body('email').isEmail().withMessage('Invalid email').normalizeEmail(),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('phone').optional().isMobilePhone('any').withMessage('Invalid phone'),
    body('country').optional().trim(),
    body('currency').optional().isIn(['KSH', 'USD']).withMessage('Invalid currency'),
    body('referralCode').optional().trim()
  ],
  async (req, res) => {
    // Validation
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: errors.array()[0].msg });
    }

    const { name, email, password, phone, country, currency = 'KSH', referralCode } = req.body;

    try {
      // 1) Ensure email not already registered
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .maybeSingle();

      if (existingUser) {
        return res.status(400).json({ success: false, message: 'Email already registered' });
      }

      // 2) Optionally validate referral code (if provided)
      let referrer = null;
      if (referralCode) {
        const { data: foundReferrer } = await supabase
          .from('users')
          .select('id, currency')
          .eq('referral_code', referralCode.toUpperCase())
          .maybeSingle();

        if (!foundReferrer) {
          return res.status(400).json({ success: false, message: 'Invalid referral code' });
        }
        referrer = foundReferrer;
      }

      // 3) Hash password
      const hashedPassword = await bcrypt.hash(password, 12);

      // 4) Prepare new user data
      const userReferralCode = generateReferralCode();
      const signupBonus = currency === 'KSH' ? 200 : 1.5;

      // 5) Create user (single insert)
      const { data: newUser, error: insertErr } = await supabase
        .from('users')
        .insert({
          name,
          email,
          password: hashedPassword,
          phone: phone || null,
          country: country || 'Kenya',
          currency,
          referral_code: userReferralCode,
          referred_by: referralCode || null,
          role: 'user',
          balance: signupBonus,
          profit: 0,
          active_bots: 0,
          referrals: 0,
          phone_verified: false
        })
        .select('id, name, email, role, balance, currency, referral_code')
        .single();

      if (insertErr) {
        console.error('Error inserting new user:', insertErr);
        throw insertErr;
      }

      // 6) Log signup bonus transaction
      await supabase.from('transactions').insert({
        user_id: newUser.id,
        type: 'bonus',
        method: 'signup_bonus',
        amount: signupBonus,
        currency,
        status: 'completed'
      });

      // 7) If referral exists, create referral bonus row and increment referrer counter atomically
      if (referrer) {
        const bonusForReferrer = referrer.currency === 'KSH' ? 300 : 2.3;

        await supabase.from('referral_bonuses').insert({
          referrer_id: referrer.id,
          referred_id: newUser.id,
          amount: bonusForReferrer,
          currency: referrer.currency,
          status: 'pending'
        });

        // call RPC to increment referrals counter atomically
        // NOTE: You must create this RPC in your Supabase DB (see SQL below)
        await supabase.rpc('increment_referrals', { user_id_input: referrer.id });
      }

      // 8) Create token and respond
      const token = generateToken(newUser.id, 'user');

      return res.status(201).json({
        success: true,
        message: 'Account created successfully. Welcome bonus added.',
        token,
        user: newUser
      });
    } catch (err) {
      console.error('Signup error =>', err);
      return standardError(res, 500, 'Server error. Please try again.');
    }
  }
);

// -------------------------
// API: Login
// -------------------------
app.post(
  '/api/auth/login',
  [
    body('email').trim().isEmail().withMessage('Invalid email').normalizeEmail(),
    body('password').notEmpty().withMessage('Password is required')
  ],
  async (req, res) => {
    // Validate
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: 'Invalid email or password' });
    }

    const { email, password } = req.body;

    try {
      const { data: user, error } = await supabase
        .from('users')
        .select('id, name, email, password, role, balance, profit, active_bots, referrals, referral_code, profile_image, currency, phone_verified')
        .eq('email', email)
        .limit(1)
        .single();

      if (error || !user) {
        return res.status(400).json({ success: false, message: 'Invalid credentials' });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(400).json({ success: false, message: 'Invalid credentials' });
      }

      const token = generateToken(user.id, user.role);
      const safeUser = sanitizeUserForClient(user);

      return res.json({
        success: true,
        message: 'Login successful',
        token,
        user: safeUser
      });
    } catch (err) {
      console.error('Login error =>', err);
      return standardError(res, 500, 'Something went wrong. Try again later.');
    }
  }
);

// -------------------------
// API: Demo Mode (local demo user, no DB writes)
// -------------------------
app.post('/api/auth/demo', (req, res) => {
  try {
    const demoId = `demo_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const demoUser = {
      id: demoId,
      name: 'Demo Trader',
      email: 'demo@forexpro.com',
      balance: 10000,
      profit: 0,
      active_bots: 0,
      referrals: 0,
      currency: 'USD',
      role: 'demo',
      phone_verified: false,
      referral_code: 'DEMO2025'
    };

    const token = generateToken(demoId, 'demo');

    return res.json({
      success: true,
      message: 'Demo mode activated',
      token,
      user: demoUser
    });
  } catch (err) {
    console.error('Demo error =>', err);
    return standardError(res, 500, 'Failed to activate demo mode');
  }
});

// -------------------------
// Protected route example (optional)
// -------------------------
app.get('/api/me', async (req, res) => {
  // This is a lightweight example — in production add middleware to verify token and set req.user
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    // fetch fresh user from DB if it's not a demo token
    if (String(payload.role) === 'demo' || String(payload.id).startsWith('demo_')) {
      return res.json({ success: true, user: { id: payload.id, role: payload.role, name: 'Demo Trader' } });
    }
    const { data: user } = await supabase.from('users').select('id, name, email, role, balance, currency, referral_code').eq('id', payload.id).single();
    return res.json({ success: true, user });
  } catch (err) {
    console.error('Token error =>', err);
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
});

// -------------------------
// 404 fallback - serve friendly page (static already served from /public)
// -------------------------
app.get('*', (req, res) => {
  // If a static file exists, express.static will already have served it.
  // Fallback to a small HTML 404
  res.status(404).send(`
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8"/>
        <title>404 - Not Found</title>
        <meta name="viewport" content="width=device-width,initial-scale=1"/>
        <style>
          body{margin:0;font-family:system-ui,Segoe UI,Roboto;color:#fff;background:#051027;display:grid;place-items:center;height:100vh}
          .card{padding:32px;border-radius:12px;background:rgba(255,255,255,0.03);text-align:center}
          h1{margin:0 0 8px;background:linear-gradient(90deg,#60a5fa,#8b5cf6);-webkit-background-clip:text;color:transparent;font-size:48px}
          a{color:#60a5fa}
        </style>
      </head>
      <body>
        <div class="card">
          <h1>404</h1>
          <p>Page not found</p>
          <p><a href="/">Back to home</a></p>
        </div>
      </body>
    </html>`);
});

// -------------------------
// Start server
// -------------------------
const startServer = () => {
  app.listen(PORT, () => {
    console.log('ForexPro Auth Server Running');
    console.log(`http://localhost:${PORT}`);
    console.log('Demo Mode: POST /api/auth/demo');
  });
};

if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };
