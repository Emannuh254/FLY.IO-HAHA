const express = require('express');
const path = require('path');
const multer = require('multer');
const crypto = require('crypto');
const fs = require('fs').promises;
const rateLimit = require('express-rate-limit');

const { body, validationResult } = require('express-validator');
const supabase = require('../supabaseClient');
const { setupMiddleware } = require('../shared/middleware');
const { authenticateToken, hashPassword, comparePassword } = require('../shared/auth');
const { convertCurrency, formatCurrency } = require('../shared/database');

const app = express();
const PORT = process.env.PROFILE_PORT || 3001;

// Security: Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Setup shared middleware (JSON, CORS, etc.)
setupMiddleware(app);

// Multer config for profile images
const uploadDir = path.join(__dirname, '../public/uploads/profiles');
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (err) {
      cb(err);
    }
  },
  filename: (req, file, cb) => {
    const unique = crypto.randomBytes(12).toString('hex');
    const ext = path.extname(file.originalname);
    cb(null, `${req.user.id}-${Date.now()}-${unique}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 3 * 1024 * 1024 }, // 3MB
  fileFilter: (req, file, cb) => {
    if (/^image\//.test(file.mimetype)) cb(null, true);
    else cb(new Error('Only images allowed'));
  }
});

// Serve profile page
app.get(['/profile', '/profile.html'], (req, res) => {
  res.sendFile(path.join(__dirname, '../public/profile.html'));
});

// Validation helper
const validate = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: errors.array()[0].msg });
  }
  return true;
};

// GET: Current user profile
app.get('/api/user/profile', authenticateToken, async (req, res) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('id, name, email, phone, country, currency, balance, profit, active_bots, referrals, referral_code, profile_image, role, phone_verified')
      .eq('id', req.user.id)
      .single();

    if (error || !user) return res.status(404).json({ message: 'User not found' });

    const otherCurrency = user.currency === 'KSH' ? 'USD' : 'KSH';
    const convertedBalance = convertCurrency(user.balance, user.currency, otherCurrency);

    // Count referral bonuses in one query
    const { count: bonusCount = 0 } = await supabase
      .from('referral_bonuses')
      .select('*', { count: 'exact', head: true })
      .eq('referrer_id', user.id);

    const { count: completedCount = 0 } = await supabase
      .from('referral_bonuses')
      .select('*', { count: 'exact', head: true })
      .eq('referrer_id', user.id)
      .eq('status', 'completed');

    res.json({
      ...user,
      convertedBalance,
      otherCurrency,
      bonusCount,
      completedReferrals: completedCount
    });
  } catch (err) {
    console.error('Profile fetch error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT: Update profile
app.put('/api/user/profile',
  authenticateToken,
  [
    body('name').optional().trim().isLength({ min: 2 }).withMessage('Name too short'),
    body('email').optional().isEmail().withMessage('Invalid email'),
    body('phone').optional().isMobilePhone('any').withMessage('Invalid phone'),
    body('country').optional().isLength({ min: 2 }),
    body('currency').optional().isIn(['KSH', 'USD'])
  ],
  async (req, res) => {
    if (!validate(req, res)) return;

    const updates = req.body;
    let newBalance = null;

    try {
      // Get current currency if changing
      if (updates.currency) {
        const { data: current } = await supabase
          .from('users')
          .select('currency, balance')
          .eq('id', req.user.id)
          .single();

        if (updates.currency !== current.currency) {
          newBalance = convertCurrency(current.balance, current.currency, updates.currency);
          updates.balance = newBalance;
        }
      }

      const { error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', req.user.id);

      if (error) throw error;

      res.json({
        message: 'Profile updated successfully',
        currencyChanged: !!updates.currency,
        newBalance
      });
    } catch (err) {
      console.error('Profile update error:', err);
      res.status(500).json({ message: 'Update failed' });
    }
  }
);

// PUT: Change password
app.put('/api/user/password',
  authenticateToken,
  [
    body('currentPassword').notEmpty(),
    body('newPassword').isLength({ min: 8 }).withMessage('Password must be 8+ chars'),
    body('confirmPassword').custom((value, { req }) => value === req.body.newPassword).withMessage('Passwords do not match')
  ],
  async (req, res) => {
    if (!validate(req, res)) return;

    const { currentPassword, newPassword } = req.body;

    if (req.user.role === 'demo') {
      return res.status(403).json({ message: 'Demo accounts cannot change password' });
    }

    try {
      const { data: user } = await supabase
        .from('users')
        .select('password')
        .eq('id', req.user.id)
        .single();

      const valid = await comparePassword(currentPassword, user.password);
      if (!valid) return res.status(400).json({ message: 'Current password incorrect' });

      const hashed = await hashPassword(newPassword);

      const { error } = await supabase
        .from('users')
        .update({ password: hashed })
        .eq('id', req.user.id);

      if (error) throw error;

      res.json({ message: 'Password changed successfully' });
    } catch (err) {
      console.error('Password change error:', err);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// POST: Upload profile image
app.post('/api/user/profile-image', authenticateToken, upload.single('profileImage'), async (req, res) => {
  if (req.user.role === 'demo') {
    return res.status(403).json({ message: 'Demo users cannot upload images' });
  }

  if (!req.file) {
    return res.status(400).json({ message: 'No image uploaded' });
  }

  try {
    const imageUrl = `/uploads/profiles/${req.file.filename}`;

    // Delete old image if exists
    const { data: user } = await supabase
      .from('users')
      .select('profile_image')
      .eq('id', req.user.id)
      .single();

    if (user.profile_image) {
      const oldPath = path.join(__dirname, '../public', user.profile_image);
      await fs.unlink(oldPath).catch(() => {}); // Ignore if not found
    }

    const { error } = await supabase
      .from('users')
      .update({ profile_image: imageUrl })
      .eq('id', req.user.id);

    if (error) throw error;

    res.json({ message: 'Profile picture updated', imageUrl });
  } catch (err) {
    console.error('Image upload error:', err);
    res.status(500).json({ message: 'Upload failed' });
  }
});

// GET: Referral bonuses
app.get('/api/user/referral-bonuses', authenticateToken, async (req, res) => {
  try {
    const { data: user } = await supabase.from('users').select('currency').eq('id', req.user.id).single();

    const { data: bonuses } = await supabase
      .from('referral_bonuses')
      .select('*, referred_user:referred_id(name, email, created_at)')
      .eq('referrer_id', req.user.id)
      .order('created_at', { ascending: false });

    const formatted = (bonuses || []).map(b => ({
      ...b,
      formattedAmount: formatCurrency(b.amount, b.currency),
      convertedAmount: b.currency !== user.currency
        ? formatCurrency(convertCurrency(b.amount, b.currency, user.currency), user.currency)
        : null
    }));

    res.json(formatted);
  } catch (err) {
    console.error('Referral bonuses error:', err);
    res.status(500).json({ message: 'Failed to load bonuses' });
  }
});

// GET: Referred users list
app.get('/api/user/referred-users', authenticateToken, async (req, res) => {
  try {
    const { data: users } = await supabase
      .from('users')
      .select('id, name, email, created_at')
      .eq('referred_by', req.user.referral_code)
      .order('created_at', { ascending: false });

    const withStatus = await Promise.all((users || []).map(async (u) => {
      const { data } = await supabase
        .from('referral_bonuses')
        .select('status')
        .eq('referrer_id', req.user.id)
        .eq('referred_id', u.id)
        .single()
        .maybeSingle();

      return { ...u, bonusStatus: data?.status || 'pending' };
    }));

    res.json(withStatus);
  } catch (err) {
    console.error('Referred users error:', err);
    res.status(500).json({ message: 'Failed to load referrals' });
  }
});

// Start server
const startServer = async () => {
  app.listen(PORT, () => {
    console.log(`Profile server running on http://localhost:${PORT}`);
    console.log(`Serving profile page at /profile`);
  });
};

if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };