const express = require('express');
const path = require('path');
const supabase = require('../supabaseClient');
const { setupMiddleware } = require('../shared/middleware');
const { authenticateToken, generateToken, comparePassword, generateReferralCode } = require('../shared/auth');
const { validateRequest, validationSchemas } = require('../shared/helpers');
const { formatCurrency, convertCurrency } = require('../shared/database');

const app = express();
const PORT = process.env.PORT || 3000;

// Setup middleware
setupMiddleware(app);

// Serve index.html for root path
app.get(['/', '/index.html'], (req, res) => {
  const filePath = path.join(__dirname, '../public/index.html');
  res.setHeader('Content-Type', 'text/html');
  res.sendFile(filePath);
});

// Signup API with 200 KSH sign-up bonus
app.post('/api/auth/signup', validationSchemas.signup, async (req, res) => {
  if (!validateRequest(req, res)) return;
  
  const { name, email, password, phone, country, currency = 'KSH', referralCode, isDemo = false } = req.body;
  
  try {
    // Check if user already exists
    const { data: userExists, error: checkError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();
    
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }
    
    // Hash password (skip for demo accounts)
    let hashedPassword = null;
    if (!isDemo) {
      hashedPassword = await comparePassword.hash(password);
    }
    
    // Generate referral code
    const referralCodeNew = generateReferralCode();
    
    // Set bonus amount based on currency
    const bonusAmount = currency === 'USD' ? 1.33 : 200; // 200 KSH or ~1.33 USD
    
    // Insert user
    const { data: user, error: insertError } = await supabase
      .from('users')
      .insert({
        name,
        email,
        password: hashedPassword,
        phone,
        country,
        currency,
        referral_code: referralCodeNew,
        referred_by: referralCode,
        role: isDemo ? 'demo' : 'user',
        balance: isDemo ? 66.67 : bonusAmount
      })
      .select()
      .single();
    
    if (insertError) throw insertError;
    
    const userId = user.id;
    const token = generateToken(userId, isDemo ? 'demo' : 'user');
    
    // Create sign-up bonus transaction (for non-demo users)
    if (!isDemo) {
      await supabase
        .from('transactions')
        .insert({
          user_id: userId,
          type: 'bonus',
          method: 'signup',
          amount: bonusAmount,
          currency,
          status: 'completed'
        });
    }
    
    // Create referral bonus record if referral code was used
    if (referralCode && !isDemo) {
      const { data: referrer } = await supabase
        .from('users')
        .select('id, currency')
        .eq('referral_code', referralCode)
        .single();
      
      if (referrer) {
        const referrerId = referrer.id;
        const referrerCurrency = referrer.currency;
        
        // Convert bonus amount to referrer's currency if needed
        let referralBonus = bonusAmount;
        if (currency !== referrerCurrency) {
          referralBonus = convertCurrency(bonusAmount, currency, referrerCurrency);
        }
        
        await supabase
          .from('referral_bonuses')
          .insert({
            referrer_id: referrerId,
            referred_id: userId,
            amount: referralBonus,
            currency: referrerCurrency,
            status: 'pending'
          });
        
        // Update referrer's referral count
        await supabase
          .from('users')
          .update({ referrals: supabase.raw('referrals + 1') })
          .eq('id', referrerId);
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
app.post('/api/auth/login', validationSchemas.login, async (req, res) => {
  if (!validateRequest(req, res)) return;
  
  const { email, password } = req.body;
  
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();
    
    if (error || !user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }
    
    // Skip password check for demo accounts
    let isPasswordValid = true;
    if (user.role !== 'demo') {
      isPasswordValid = await comparePassword(password, user.password);
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
        currency: user.currency,
        phone_verified: user.phone_verified
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
    const { data: user, error } = await supabase
      .from('users')
      .insert({
        name: 'Demo User',
        email: demoEmail,
        role: 'demo',
        balance: 66.67,
        currency: 'USD'
      })
      .select()
      .single();
    
    if (error) throw error;
    
    const userId = user.id;
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
        currency: 'USD',
        phone_verified: false
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

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

// Start server
const startServer = async () => {
  try {
    app.listen(PORT, () => {
      console.log(`Index server running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start index server:', err);
    process.exit(1);
  }
};

// Only start if this file is run directly
if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };