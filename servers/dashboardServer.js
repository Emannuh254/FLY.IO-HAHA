const express = require('express');
const path = require('path');
const { setupMiddleware } = require('../shared/middleware');
const { authenticateToken } = require('../shared/auth');
const supabase = require('../supabaseClient');

const app = express();
const PORT = process.env.DASHBOARD_PORT || 3006;

// Setup middleware
setupMiddleware(app);

// Serve dashboard.html
app.get(['/dashboard', '/dashboard.html'], (req, res) => {
  const filePath = path.join(__dirname, '../public/dashboard.html');
  res.setHeader('Content-Type', 'text/html');
  res.sendFile(filePath);
});

// Get user profile (protected route)
app.get('/api/user/profile', authenticateToken, async (req, res) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', req.user.id)
      .single();
    
    if (error) throw error;
    
    res.status(200).json({
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
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user's trading bots
app.get('/api/user/bots', authenticateToken, async (req, res) => {
  try {
    const { data: bots, error } = await supabase
      .from('trading_bots')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    res.status(200).json({ bots });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/admin/bot-templates', authenticateToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('bot_templates')
      .select('*')  // fetch everything, even NULL fields
      .order('id', { ascending: true });

    if (error) throw error;

    // Convert nulls to defaults if needed
    const safeTemplates = data.map(template => ({
      id: template.id,
      name: template.name || "Unnamed Bot",
      investment: template.investment || 0,
      daily_profit: template.daily_profit || 0,
      total_profit: template.total_profit || 0,
      image_url: template.image_url || null,
      created_at: template.created_at
    }));

    res.status(200).json({
      message: 'Bot templates fetched successfully',
      templates: safeTemplates
    });

  } catch (err) {
    console.error('Error fetching bot templates:', err);
    res.status(500).json({ message: 'Server error fetching bot templates' });
  }
});

// POST /api/user/bots/buy
app.post('/api/user/bots/buy', authenticateToken, async (req, res) => {
  try {
    const { template_id } = req.body;

    if (!template_id) {
      return res.status(400).json({ message: 'template_id is required' });
    }

    // Check if user already owns this bot
    const { data: existingBot, error: existingError } = await supabase
      .from('trading_bots')
      .select('*')
      .eq('user_id', req.user.id)
      .eq('template_id', template_id)
      .single();

    if (existingError && existingError.code !== 'PGRST116') { // PGRST116 = no rows found
      throw existingError;
    }

    if (existingBot) {
      return res.status(400).json({ message: 'You already own this bot' });
    }

    // Fetch bot template
    const { data: template, error: templateError } = await supabase
      .from('bot_templates')
      .select('*')
      .eq('id', template_id)
      .single();

    if (templateError || !template) {
      return res.status(404).json({ message: 'Bot template not found' });
    }

    // Check if user has enough balance
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('balance, currency')
      .eq('id', req.user.id)
      .single();

    if (userError || !user) throw userError || new Error('User not found');

    if (user.balance < template.investment) {
      return res.status(400).json({ message: 'Insufficient balance to buy this bot' });
    }

    // Deduct investment from user balance
    const { error: updateError } = await supabase
      .from('users')
      .update({ balance: user.balance - template.investment })
      .eq('id', req.user.id);

    if (updateError) throw updateError;

    // Create user bot
    const { data: bot, error: botError } = await supabase
      .from('trading_bots')
      .insert({
        user_id: req.user.id,
        template_id,
        name: template.name,
        investment: template.investment,
        daily_profit: 0,
        total_profit: 0,
        progress: 0,
        status: 'active',
        next_mining_time: new Date(Date.now() + 24 * 60 * 60 * 1000), // starts next day
        image_url: template.image_url
      })
      .select()
      .single();

    if (botError) throw botError;

    res.status(201).json({ message: 'Bot purchased successfully', bot });

  } catch (err) {
    console.error('Error buying bot:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user's transaction history
app.get('/api/user/transactions', authenticateToken, async (req, res) => {
  try {
    const { data: transactions, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    res.status(200).json({ transactions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user's deposit requests
app.get('/api/user/deposits', authenticateToken, async (req, res) => {
  try {
    const { data: deposits, error } = await supabase
      .from('deposits')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    res.status(200).json({ deposits });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user's withdrawal requests
app.get('/api/user/withdrawals', authenticateToken, async (req, res) => {
  try {
    const { data: withdrawals, error } = await supabase
      .from('withdrawals')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    res.status(200).json({ withdrawals });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user's referral bonuses
app.get('/api/user/referrals', authenticateToken, async (req, res) => {
  try {
    // Get referral bonuses
    const { data: bonuses, error: bonusError } = await supabase
      .from('referral_bonuses')
      .select(`
        *,
        referred_user:referred_id(name, email)
      `)
      .eq('referrer_id', req.user.id)
      .order('created_at', { ascending: false });
    
    if (bonusError) throw bonusError;
    
    res.status(200).json({ bonuses });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get forex graph data
app.get('/api/forex/graph', async (req, res) => {
  try {
    // Get forex settings
    const { data: settings, error: settingsError } = await supabase
      .from('forex_settings')
      .select('*')
      .single();
    
    if (settingsError) throw settingsError;
    
    // Generate fake forex data based on settings
    const graphData = generateForexData(settings);
    
    res.status(200).json({ 
      graphData,
      settings: {
        volatility: settings.volatility,
        trend: settings.trend
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Helper function to generate fake forex data
function generateForexData(settings) {
  const data = [];
  let currentValue = 100; // Starting value
  const volatility = settings.volatility / 100;
  const trend = settings.trend / 100;
  
  // Generate 30 data points (one for each day)
  for (let i = 0; i < 30; i++) {
    // Random change with volatility
    const change = (Math.random() - 0.5) * volatility * 10;
    
    // Apply trend
    currentValue += change + trend;
    
    // Ensure value doesn't go below 1
    currentValue = Math.max(1, currentValue);
    
    data.push({
      day: i + 1,
      value: parseFloat(currentValue.toFixed(2))
    });
  }
  
  return data;
}

// Start server
const startServer = async () => {
  try {
    app.listen(PORT, () => {
      console.log(`Dashboard server running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start dashboard server:', err);
    process.exit(1);
  }
};

// Only start if this file is run directly
if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };