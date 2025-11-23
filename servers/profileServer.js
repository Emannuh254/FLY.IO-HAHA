const express = require('express');
const path = require('path');
const { body } = require('express-validator'); // Missing import
const supabase = require('../supabaseClient');
const { setupMiddleware } = require('../shared/middleware');
const { authenticateToken, comparePassword } = require('../shared/auth');
const { validateRequest, validationSchemas } = require('../shared/helpers');
const { formatCurrency, convertCurrency } = require('../shared/database');

const app = express();
const PORT = process.env.PROFILE_PORT || 3001;

// Setup middleware
setupMiddleware(app);

// Serve profile.html
app.get(['/profile', '/profile.html'], (req, res) => {
  const filePath = path.join(__dirname, '../public/profile.html');
  res.setHeader('Content-Type', 'text/html');
  res.sendFile(filePath);
});

// Get user profile
app.get('/api/user/profile', authenticateToken, async (req, res) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', req.user.userId)
      .single();
    
    if (error || !user) {
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
      role: user.role,
      phone_verified: user.phone_verified
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
  if (!validateRequest(req, res)) return;
  
  const { name, email, phone, country, currency } = req.body;
  
  try {
    // Get current user data to check if currency is changing
    const { data: currentUser, error: currentUserError } = await supabase
      .from('users')
      .select('currency, balance')
      .eq('id', req.user.userId)
      .single();
    
    if (currentUserError) throw currentUserError;
    
    let newBalance = currentUser.balance;
    
    // If currency is changing, convert the balance
    if (currency && currency !== currentUser.currency) {
      newBalance = convertCurrency(currentUser.balance, currentUser.currency, currency);
    }
    
    const { error } = await supabase
      .from('users')
      .update({
        name: name || supabase.raw('name'),
        email: email || supabase.raw('email'),
        phone: phone || supabase.raw('phone'),
        country: country || supabase.raw('country'),
        currency: currency || supabase.raw('currency'),
        balance: newBalance
      })
      .eq('id', req.user.userId);
    
    if (error) throw error;
    
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

// Start server
const startServer = async () => {
  try {
    app.listen(PORT, () => {
      console.log(`Profile server running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start profile server:', err);
    process.exit(1);
  }
};

// Only start if this file is run directly
if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };