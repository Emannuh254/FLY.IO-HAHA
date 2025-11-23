const express = require('express');
const path = require('path');
const supabase = require('../supabaseClient');
const { setupMiddleware } = require('../shared/middleware');
const { authenticateToken } = require('../shared/auth');
const { validateRequest, validationSchemas } = require('../shared/helpers');
const { formatCurrency, convertCurrency } = require('../shared/database');

const app = express();
const PORT = process.env.TRADING_PORT || 3003;

// Setup middleware
setupMiddleware(app);

// Serve trading.html
app.get(['/trading', '/trading.html'], (req, res) => {
  const filePath = path.join(__dirname, '../public/trading.html');
  res.setHeader('Content-Type', 'text/html');
  res.sendFile(filePath);
});

// Get trading bots
app.get('/api/bots', authenticateToken, async (req, res) => {
  try {
    const { data: bots, error } = await supabase
      .from('trading_bots')
      .select('*')
      .eq('user_id', req.user.userId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    // Get user's currency for display
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('currency')
      .eq('id', req.user.userId)
      .single();
    
    if (userError) throw userError;
    const userCurrency = user.currency;
    
    // Format bots with currency info
    const formattedBots = bots.map(bot => {
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
    
    res.status(200).json(formattedBots);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create trading bot with improved logic
app.post('/api/bots', validationSchemas.createBot, authenticateToken, async (req, res) => {
  if (!validateRequest(req, res)) return;
  
  const { name, investment } = req.body;
  const amount = parseFloat(investment);

  try {
    // Get user's balance and currency
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('balance, currency')
      .eq('id', req.user.userId)
      .single();
    
    if (userError) throw userError;
    
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
    const { data: bot, error: botError } = await supabase
      .from('trading_bots')
      .insert({
        user_id: req.user.userId,
        name,
        investment: investmentInKSH,
        daily_profit: dailyProfitInKSH,
        total_profit: totalProfitInKSH,
        image_url: 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0'
      })
      .select()
      .single();

    if (botError) throw botError;

    const botId = bot.id;

    // Deduct investment from user balance
    const { error: updateError } = await supabase
      .from('users')
      .update({
        balance: supabase.raw(`balance - ${amount}`),
        active_bots: supabase.raw('active_bots + 1')
      })
      .eq('id', req.user.userId);

    if (updateError) throw updateError;

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
app.post('/api/bots/:id/progress', validationSchemas.updateProgress, authenticateToken, async (req, res) => {
  if (!validateRequest(req, res)) return;
  
  const botId = req.params.id;
  const { progress } = req.body;
  
  try {
    // Check if bot belongs to user
    const { data: bot, error: botError } = await supabase
      .from('trading_bots')
      .select('*')
      .eq('id', botId)
      .eq('user_id', req.user.userId)
      .single();
    
    if (botError || !bot) {
      return res.status(404).json({ message: 'Bot not found' });
    }
    
    // Update bot progress
    const { error: updateError } = await supabase
      .from('trading_bots')
      .update({ progress })
      .eq('id', botId);
    
    if (updateError) throw updateError;
    
    // If progress is 100%, complete the bot and credit profits
    if (progress >= 100) {
      await supabase
        .from('trading_bots')
        .update({ status: 'completed' })
        .eq('id', botId);
      
      // Get user's currency
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('currency')
        .eq('id', req.user.userId)
        .single();
      
      if (userError) throw userError;
      
      // Convert profits to user's currency
      const totalProfit = convertCurrency(bot.total_profit, 'KSH', user.currency);
      
      // Credit profits to user
      const { error: creditError } = await supabase
        .from('users')
        .update({
          balance: supabase.raw(`balance + ${totalProfit}`),
          profit: supabase.raw(`profit + ${totalProfit}`),
          active_bots: supabase.raw('active_bots - 1')
        })
        .eq('id', req.user.userId);
      
      if (creditError) throw creditError;
      
      // Create transaction for the profit
      await supabase
        .from('transactions')
        .insert({
          user_id: req.user.userId,
          type: 'profit',
          method: 'bot',
          amount: totalProfit,
          currency: user.currency,
          status: 'completed'
        });
    }
    
    res.status(200).json({ message: 'Bot progress updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Start server
const startServer = async () => {
  try {
    app.listen(PORT, () => {
      console.log(`Trading server running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start trading server:', err);
    process.exit(1);
  }
};

// Only start if this file is run directly
if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };