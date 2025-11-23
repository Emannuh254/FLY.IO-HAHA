const express = require('express');
const path = require('path');
const supabase = require('../supabaseClient');
const { setupMiddleware } = require('../shared/middleware');
const { authenticateToken, comparePassword } = require('../shared/auth');
const { validateRequest, validationSchemas } = require('../shared/helpers');
const { formatCurrency, convertCurrency } = require('../shared/database');

const app = express();
const PORT = process.env.DEPOSIT_WITHDRAW_PORT || 3005;

// Setup middleware
setupMiddleware(app);

// Serve deposit-withdraw.html
app.get(['/deposit-withdraw', '/deposit-withdraw.html'], (req, res) => {
  const filePath = path.join(__dirname, '../public/deposit-withdraw.html');
  res.setHeader('Content-Type', 'text/html');
  res.sendFile(filePath);
});

// Get deposit address
app.get('/api/deposit/address', authenticateToken, async (req, res) => {
  try {
    // Default to USDT on BSC if no parameters provided
    const coin = req.query.coin || 'USDT';
    const network = req.query.network || 'BSC';
    
    const { data, error } = await supabase
      .from('deposit_addresses')
      .select('address')
      .eq('coin', coin)
      .eq('network', network)
      .single();
    
    if (error || !data) {
      return res.status(404).json({ message: 'Deposit address not found for this coin and network' });
    }
    
    res.status(200).json({
      coin,
      network,
      address: data.address
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Deposit API with referral bonus processing
app.post('/api/deposit', validationSchemas.deposit, authenticateToken, async (req, res) => {
  if (!validateRequest(req, res)) return;
  
  const { amount, method, currency, network, address } = req.body;
  
  try {
    // Get user's current currency
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('currency, referred_by')
      .eq('id', req.user.userId)
      .single();
    
    if (userError) throw userError;
    
    // Convert amount to user's currency if needed
    let convertedAmount = amount;
    if (currency !== user.currency) {
      convertedAmount = convertCurrency(amount, currency, user.currency);
    }
    
    // Create transaction record
    const { data: transaction, error: transactionError } = await supabase
      .from('transactions')
      .insert({
        user_id: req.user.userId,
        type: 'deposit',
        method,
        amount: convertedAmount,
        currency: user.currency,
        network,
        address
      })
      .select()
      .single();
    
    if (transactionError) throw transactionError;
    
    const transactionId = transaction.id;
    
    // Check if user was referred and deposit meets minimum requirement
    const minDeposit = user.currency === 'KSH' ? 10000 : 66.67; // 10000 KSH or ~66.67 USD
    if (parseFloat(convertedAmount) >= minDeposit) {
      if (user.referred_by) {
        // Check if referral bonus is still pending
        const { data: bonus, error: bonusError } = await supabase
          .from('referral_bonuses')
          .select('*')
          .eq('referred_id', req.user.userId)
          .eq('status', 'pending')
          .single();
        
        if (bonus && !bonusError) {
          // Update bonus status to completed
          const { error: updateError } = await supabase
            .from('referral_bonuses')
            .update({
              status: 'completed',
              completed_at: new Date().toISOString()
            })
            .eq('id', bonus.id);
          
          if (updateError) throw updateError;
          
          // Credit referrer's account
          const { error: creditError } = await supabase
            .from('users')
            .update({
              balance: supabase.raw(`balance + ${bonus.amount}`)
            })
            .eq('id', bonus.referrer_id);
          
          if (creditError) throw creditError;
          
          // Create transaction record for the bonus
          await supabase
            .from('transactions')
            .insert({
              user_id: bonus.referrer_id,
              type: 'bonus',
              method: 'referral',
              amount: bonus.amount,
              currency: bonus.currency,
              status: 'completed'
            });
        }
      }
    }
    
    // For crypto deposits, return the deposit address
    if (method === 'crypto') {
      return res.status(200).json({
        message: 'Deposit request created',
        transactionId,
        depositAddress: address,
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
app.post('/api/withdraw', validationSchemas.withdraw, authenticateToken, async (req, res) => {
  if (!validateRequest(req, res)) return;
  
  const { amount, method, currency, address, password } = req.body;
  
  try {
    // Get user's current currency and password
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('password, balance, currency')
      .eq('id', req.user.userId)
      .single();
    
    if (userError || !user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Verify password (skip for demo users)
    if (req.user.role !== 'demo') {
      const isPasswordValid = await comparePassword(password, user.password);
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
    const { data: transaction, error: transactionError } = await supabase
      .from('transactions')
      .insert({
        user_id: req.user.userId,
        type: 'withdraw',
        method,
        amount: convertedAmount,
        currency: user.currency,
        address,
        status: 'pending'
      })
      .select()
      .single();
    
    if (transactionError) throw transactionError;
    
    const transactionId = transaction.id;
    
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
    const { data: transactions, error } = await supabase
      .from('transactions')
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
    
    // Format transactions with currency info
    const formattedTransactions = transactions.map(tx => {
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
    
    res.status(200).json(formattedTransactions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Start server
const startServer = async () => {
  try {
    app.listen(PORT, () => {
      console.log(`Deposit/Withdraw server running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start deposit/withdraw server:', err);
    process.exit(1);
  }
};

// Only start if this file is run directly
if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };