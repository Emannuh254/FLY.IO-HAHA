const express = require('express');
const path = require('path');
const { body } = require('express-validator');
const rateLimit = require('express-rate-limit');
const supabase = require('../supabaseClient');
const { setupMiddleware } = require('../shared/middleware');
const { authenticateAdmin, comparePassword } = require('../shared/auth');
const { validateRequest, validationSchemas } = require('../shared/helpers');
const { formatCurrency, convertCurrency, EXCHANGE_RATES } = require('../shared/database');

const app = express();
const PORT = process.env.ADMIN_PORT || 3007;

// Setup middleware
setupMiddleware(app);

// Apply rate limiting to login endpoint
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 login attempts per windowMs
  message: 'Too many login attempts, please try again later'
});

// Serve admin.html
app.get(['/admin', '/admin.html'], (req, res) => {
  const filePath = path.join(__dirname, '../public/admin.html');
  res.setHeader('Content-Type', 'text/html');
  res.sendFile(filePath);
});

// Admin login with rate limiting
app.post('/api/admin/login', loginLimiter, validationSchemas.adminLogin, async (req, res) => {
  if (!validateRequest(req, res)) return;
  
  const { username, password } = req.body;

  try {
    // Lookup admin account
    const { data: admin, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', username)
      .eq('role', 'admin')
      .single();

    if (error || !admin) {
      console.log(`Admin not found for email: ${username}`);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Verify password
    const match = await comparePassword(password, admin.password);
    if (!match) {
      console.log(`Password mismatch for admin: ${username}`);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Create token
    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET;
    if (!JWT_SECRET) {
      console.error('JWT_SECRET is not defined in environment variables');
      return res.status(500).json({ message: 'Server configuration error' });
    }
    
    const token = jwt.sign(
      { userId: admin.id, role: 'admin' },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    console.log(`Admin login successful for: ${username}`);
    return res.status(200).json({
      message: 'Admin login successful',
      token
    });

  } catch (err) {
    console.error("ADMIN LOGIN ERROR:", err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Get all transactions (admin only)
app.get('/api/admin/transactions', authenticateAdmin, async (req, res) => {
  try {
    // First get all transactions
    const { data: transactions, error: transactionsError } = await supabase
      .from('transactions')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (transactionsError) throw transactionsError;
    
    // Get user IDs from transactions
    const userIds = [...new Set(transactions.map(t => t.user_id))];
    
    // Get user data for each user ID
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, name, email, currency')
      .in('id', userIds);
    
    if (usersError) throw usersError;
    
    // Create a map of user ID to user data
    const userMap = {};
    users.forEach(user => {
      userMap[user.id] = user;
    });
    
    // Combine transaction data with user data
    const formattedTransactions = transactions.map(tx => {
      const user = userMap[tx.user_id] || {};
      return {
        ...tx,
        user_name: user.name || 'N/A',
        user_email: user.email || 'N/A',
        user_currency: user.currency || 'KSH',
        formatted_amount: formatCurrency(tx.amount, tx.currency)
      };
    });
    
    res.status(200).json(formattedTransactions);
  } catch (err) {
    console.error('GET TRANSACTIONS ERROR:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update transaction status (admin only)
app.put('/api/admin/transactions/:id', validationSchemas.updateTransaction, authenticateAdmin, async (req, res) => {
  if (!validateRequest(req, res)) return;
  
  const { status } = req.body;
  const transactionId = req.params.id;
  
  try {
    // Get transaction details
    const { data: transaction, error: transactionError } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', transactionId)
      .single();
    
    if (transactionError || !transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }
    
    // Update transaction status
    const { error: updateError } = await supabase
      .from('transactions')
      .update({ status })
      .eq('id', transactionId);
    
    if (updateError) throw updateError;
    
    // If transaction is completed and type is deposit, update user balance
    if (status === 'completed' && transaction.type === 'deposit') {
      const { error: balanceError } = await supabase
        .from('users')
        .update({
          balance: supabase.raw(`balance + ${transaction.amount}`)
        })
        .eq('id', transaction.user_id);
      
      if (balanceError) throw balanceError;
    }
    
    // If transaction is completed and type is withdraw, deduct from user balance
    if (status === 'completed' && transaction.type === 'withdraw') {
      const { error: balanceError } = await supabase
        .from('users')
        .update({
          balance: supabase.raw(`balance - ${transaction.amount}`)
        })
        .eq('id', transaction.user_id);
      
      if (balanceError) throw balanceError;
    }
    
    res.status(200).json({ 
      message: 'Transaction updated successfully',
      formatted_amount: formatCurrency(transaction.amount, transaction.currency)
    });
  } catch (err) {
    console.error('UPDATE TRANSACTION ERROR:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin deposit to user (admin only)
app.post('/api/admin/deposit', validationSchemas.adminDeposit, authenticateAdmin, async (req, res) => {
  if (!validateRequest(req, res)) return;
  
  const { userId, amount, currency, note } = req.body;
  
  try {
    // Check if target user exists
    const { data: targetUser, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (userError || !targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Convert amount to user's currency if needed
    let convertedAmount = amount;
    if (currency !== targetUser.currency) {
      try {
        convertedAmount = convertCurrency(amount, currency, targetUser.currency);
      } catch (conversionError) {
        console.error('CURRENCY CONVERSION ERROR:', conversionError);
        return res.status(400).json({ message: 'Currency conversion failed' });
      }
    }
    
    // Create transaction record
    const { data: transaction, error: transactionError } = await supabase
      .from('transactions')
      .insert({
        user_id: userId,
        type: 'deposit',
        method: 'admin',
        amount: convertedAmount,
        currency: targetUser.currency,
        status: 'completed',
        note: note || 'Admin deposit'
      })
      .select()
      .single();
    
    if (transactionError) throw transactionError;
    
    // Update user balance
    const { error: balanceError } = await supabase
      .from('users')
      .update({
        balance: supabase.raw(`balance + ${convertedAmount}`)
      })
      .eq('id', userId);
    
    if (balanceError) throw balanceError;
    
    res.status(200).json({ 
      message: 'Deposit successful', 
      transactionId: transaction.id,
      formatted_amount: formatCurrency(convertedAmount, targetUser.currency),
      original_amount: formatCurrency(amount, currency)
    });
  } catch (err) {
    console.error('ADMIN DEPOSIT ERROR:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all users (admin only) - Enhanced version with column check
app.get('/api/admin/users', authenticateAdmin, async (req, res) => {
  try {
    // First check if the verified column exists
    const { data: columns, error: columnError } = await supabase
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_name', 'users')
      .eq('column_name', 'verified');
    
    const hasVerifiedColumn = !columnError && columns && columns.length > 0;
    
    // Build the query based on whether the verified column exists
    const query = hasVerifiedColumn 
      ? 'id, name, email, balance, profit, active_bots, referrals, currency, phone_verified, verified, created_at'
      : 'id, name, email, balance, profit, active_bots, referrals, currency, phone_verified, created_at';
    
    const { data: users, error } = await supabase
      .from('users')
      .select(query)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    // Format users with currency info
    const formattedUsers = users.map(user => {
      return {
        ...user,
        verified: hasVerifiedColumn ? user.verified : false,
        formatted_balance: formatCurrency(user.balance, user.currency),
        formatted_profit: formatCurrency(user.profit, user.currency)
      };
    });
    
    res.status(200).json(formattedUsers);
  } catch (err) {
    console.error('GET USERS ERROR:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update user balance (admin only)
app.put('/api/admin/users/:id/balance', validationSchemas.updateUserBalance, authenticateAdmin, async (req, res) => {
  if (!validateRequest(req, res)) return;
  
  const { balance } = req.body;
  const userId = req.params.id;
  
  try {
    // Get user's currency
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('currency')
      .eq('id', userId)
      .single();
    
    if (userError) throw userError;
    
    // Update user balance
    const { error: updateError } = await supabase
      .from('users')
      .update({ balance })
      .eq('id', userId);
    
    if (updateError) throw updateError;
    
    res.status(200).json({ 
      message: 'Balance updated successfully',
      formatted_balance: formatCurrency(balance, user.currency)
    });
  } catch (err) {
    console.error('UPDATE USER BALANCE ERROR:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Verify user (admin only)
app.put('/api/admin/users/:id/verify', authenticateAdmin, async (req, res) => {
  const userId = req.params.id;
  const { verified } = req.body;
  
  if (typeof verified !== 'boolean') {
    return res.status(400).json({ message: 'Verified status must be a boolean' });
  }
  
  try {
    // First check if the verified column exists
    const { data: columns, error: columnError } = await supabase
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_name', 'users')
      .eq('column_name', 'verified');
    
    const hasVerifiedColumn = !columnError && columns && columns.length > 0;
    
    if (!hasVerifiedColumn) {
      return res.status(400).json({ message: 'Verified column does not exist in users table' });
    }
    
    // Update user verification status
    const { error: updateError } = await supabase
      .from('users')
      .update({ verified })
      .eq('id', userId);
    
    if (updateError) throw updateError;
    
    res.status(200).json({ 
      message: `User ${verified ? 'verified' : 'unverified'} successfully`
    });
  } catch (err) {
    console.error('VERIFY USER ERROR:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all trading bots (admin only)
app.get('/api/admin/bots', authenticateAdmin, async (req, res) => {
  try {
    // First get all bots
    const { data: bots, error: botsError } = await supabase
      .from('trading_bots')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (botsError) throw botsError;
    
    // Get user IDs from bots
    const userIds = [...new Set(bots.map(b => b.user_id))];
    
    // Get user data for each user ID
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, name, email, currency')
      .in('id', userIds);
    
    if (usersError) throw usersError;
    
    // Create a map of user ID to user data
    const userMap = {};
    users.forEach(user => {
      userMap[user.id] = user;
    });
    
    // Combine bot data with user data
    const formattedBots = bots.map(bot => {
      const user = userMap[bot.user_id] || {};
      return {
        ...bot,
        user_name: user.name || 'N/A',
        user_email: user.email || 'N/A',
        user_currency: user.currency || 'KSH',
        formatted_investment: formatCurrency(bot.investment, user.currency || 'KSH'),
        formatted_daily_profit: formatCurrency(bot.daily_profit, user.currency || 'KSH'),
        formatted_total_profit: formatCurrency(bot.total_profit, user.currency || 'KSH')
      };
    });
    
    res.status(200).json(formattedBots);
  } catch (err) {
    console.error('GET BOTS ERROR:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create a trading bot for a user (admin only)
app.post('/api/admin/bots', [
  body('userId').isInt().withMessage('Valid user ID is required'),
  body('name').notEmpty().withMessage('Bot name is required'),
  body('investment').isFloat({ gt: 0 }).withMessage('Investment must be greater than 0'),
], authenticateAdmin, async (req, res) => {
  if (!validateRequest(req, res)) return;
  
  const { userId, name, investment } = req.body;
  const amount = parseFloat(investment);

  try {
    // Get user's balance and currency
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('balance, currency')
      .eq('id', userId)
      .single();
    
    if (userError) throw userError;
    
    // Convert investment to KSH for internal storage
    let investmentInKSH;
    try {
      investmentInKSH = convertCurrency(amount, user.currency, 'KSH');
    } catch (conversionError) {
      console.error('CURRENCY CONVERSION ERROR:', conversionError);
      return res.status(400).json({ message: 'Currency conversion failed' });
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

    // Insert trading bot (store values in KSH internally)
    const { data: bot, error: botError } = await supabase
      .from('trading_bots')
      .insert({
        user_id: userId,
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

    // Update user's active bots count
    const { error: updateError } = await supabase
      .from('users')
      .update({
        active_bots: supabase.raw('active_bots + 1')
      })
      .eq('id', userId);

    if (updateError) throw updateError;

    res.status(201).json({
      message: 'Trading bot created successfully',
      botId,
      expectedReturn: formatCurrency(totalProfitInKSH, user.currency),
      dailyProfit: formatCurrency(dailyProfitInKSH, user.currency),
      investment: formatCurrency(amount, user.currency),
      currency: user.currency
    });
  } catch (err) {
    console.error('CREATE BOT ERROR:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete a trading bot (admin only)
app.delete('/api/admin/bots/:id', authenticateAdmin, async (req, res) => {
  const botId = req.params.id;
  
  try {
    // Get bot details
    const { data: bot, error: botError } = await supabase
      .from('trading_bots')
      .select('*')
      .eq('id', botId)
      .single();
    
    if (botError || !bot) {
      return res.status(404).json({ message: 'Bot not found' });
    }
    
    // Delete bot
    const { error: deleteError } = await supabase
      .from('trading_bots')
      .delete()
      .eq('id', botId);
    
    if (deleteError) throw deleteError;
    
    // Update user's active bots count
    const { error: updateError } = await supabase
      .from('users')
      .update({
        active_bots: supabase.raw('active_bots - 1')
      })
      .eq('id', bot.user_id);
    
    if (updateError) throw updateError;
    
    res.status(200).json({ 
      message: 'Bot deleted successfully'
    });
  } catch (err) {
    console.error('DELETE BOT ERROR:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get pending withdrawals (admin only)
app.get('/api/admin/withdrawals/pending', authenticateAdmin, async (req, res) => {
  try {
    // First get all pending withdrawals
    const { data: transactions, error: transactionsError } = await supabase
      .from('transactions')
      .select('*')
      .eq('type', 'withdraw')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    
    if (transactionsError) throw transactionsError;
    
    // Get user IDs from transactions
    const userIds = [...new Set(transactions.map(t => t.user_id))];
    
    // Get user data for each user ID
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, name, email, currency')
      .in('id', userIds);
    
    if (usersError) throw usersError;
    
    // Create a map of user ID to user data
    const userMap = {};
    users.forEach(user => {
      userMap[user.id] = user;
    });
    
    // Combine transaction data with user data
    const formattedTransactions = transactions.map(tx => {
      const user = userMap[tx.user_id] || {};
      return {
        ...tx,
        user_name: user.name || 'N/A',
        user_email: user.email || 'N/A',
        user_currency: user.currency || 'KSH',
        formatted_amount: formatCurrency(tx.amount, tx.currency)
      };
    });
    
    res.status(200).json(formattedTransactions);
  } catch (err) {
    console.error('GET PENDING WITHDRAWALS ERROR:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update deposit address (admin only)
app.put('/api/admin/deposit/address', validationSchemas.updateDepositAddress, authenticateAdmin, async (req, res) => {
  if (!validateRequest(req, res)) return;
  
  const { coin, network, address } = req.body;
  
  try {
    // Check if address already exists
    const { data: existingAddress, error: checkError } = await supabase
      .from('deposit_addresses')
      .select('*')
      .eq('coin', coin)
      .eq('network', network)
      .single();
    
    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = not found
      throw checkError;
    }
    
    if (existingAddress) {
      // Update existing address
      const { error: updateError } = await supabase
        .from('deposit_addresses')
        .update({
          address,
          updated_at: new Date().toISOString()
        })
        .eq('coin', coin)
        .eq('network', network);
      
      if (updateError) throw updateError;
      console.log(`Updated deposit address for ${coin} on ${network} network`);
    } else {
      // Insert new address
      const { error: insertError } = await supabase
        .from('deposit_addresses')
        .insert({
          coin,
          network,
          address
        });
      
      if (insertError) throw insertError;
      console.log(`Created new deposit address for ${coin} on ${network} network`);
    }
    
    res.status(200).json({ 
      message: 'Deposit address updated successfully',
      coin,
      network,
      address
    });
  } catch (err) {
    console.error('UPDATE DEPOSIT ADDRESS ERROR:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get deposit addresses (admin only)
app.get('/api/admin/deposit/addresses', authenticateAdmin, async (req, res) => {
  try {
    const { data: addresses, error } = await supabase
      .from('deposit_addresses')
      .select('*')
      .order('coin', { ascending: true });
    
    if (error) throw error;
    
    res.status(200).json(addresses);
  } catch (err) {
    console.error('GET DEPOSIT ADDRESSES ERROR:', err);
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
    console.error('GET EXCHANGE RATES ERROR:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Start server
const startServer = async () => {
  try {
    app.listen(PORT, () => {
      console.log(`Admin server running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start admin server:', err);
    process.exit(1);
  }
};

// Only start if this file is run directly
if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };