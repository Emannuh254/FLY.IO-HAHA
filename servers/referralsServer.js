const express = require('express');
const path = require('path');
const supabase = require('../supabaseClient');
const { setupMiddleware } = require('../shared/middleware');
const { authenticateToken } = require('../shared/auth');
const { formatCurrency, convertCurrency } = require('../shared/database');

const app = express();
const PORT = process.env.REFERRALS_PORT || 3002;

// Setup middleware
setupMiddleware(app);

// Serve referrals.html
app.get(['/referrals', '/referrals.html'], (req, res) => {
  const filePath = path.join(__dirname, '../public/referrals.html');
  res.setHeader('Content-Type', 'text/html');
  res.sendFile(filePath);
});

// Get user's referral code and link
app.get('/api/referral/code', authenticateToken, async (req, res) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('referral_code')
      .eq('id', req.user.id)
      .single();
    
    if (error) throw error;
    
    // Generate referral link
    const referralLink = `${req.protocol}://${req.get('host')}/signup?ref=${user.referral_code}`;
    
    res.status(200).json({
      referral_code: user.referral_code,
      referral_link: referralLink
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get referral program details
app.get('/api/referral/program', authenticateToken, async (req, res) => {
  try {
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('currency')
      .eq('id', req.user.id)
      .single();
    
    if (userError) throw userError;
    
    // Bonus amount per referral in user's currency
    const bonusPerReferral = user.currency === 'USD' ? 1.33 : 200;
    
    // Minimum deposit requirement for bonus activation
    const minDeposit = user.currency === 'USD' ? 66.67 : 10000;
    
    res.status(200).json({
      bonus_per_referral: bonusPerReferral,
      formatted_bonus_per_referral: formatCurrency(bonusPerReferral, user.currency),
      min_deposit_requirement: minDeposit,
      formatted_min_deposit_requirement: formatCurrency(minDeposit, user.currency),
      program_description: `Refer a friend who deposits at least ${formatCurrency(minDeposit, user.currency)} and earn ${formatCurrency(bonusPerReferral, user.currency)} as a bonus!`
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get referral stats
app.get('/api/referral/stats', authenticateToken, async (req, res) => {
  try {
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('referrals, currency')
      .eq('id', req.user.id)
      .single();
    
    if (userError) throw userError;
    const totalReferrals = user.referrals;
    
    const { data: bonusData, error: bonusError } = await supabase
      .from('referral_bonuses')
      .select('status, amount, currency')
      .eq('referrer_id', req.user.id);
    
    if (bonusError) throw bonusError;
    
    const completed_referrals = bonusData.filter(b => b.status === 'completed').length;
    const pending_referrals = bonusData.filter(b => b.status === 'pending').length;
    
    // Calculate total bonus in user's currency
    let total_bonus = 0;
    bonusData.forEach(bonus => {
      if (bonus.status === 'completed') {
        if (bonus.currency === user.currency) {
          total_bonus += parseFloat(bonus.amount);
        } else {
          total_bonus += convertCurrency(bonus.amount, bonus.currency, user.currency);
        }
      }
    });
    
    // Bonus amount per referral in user's currency
    const bonusPerReferral = user.currency === 'USD' ? 1.33 : 200;
    
    res.status(200).json({
      total_referrals: totalReferrals,
      completed_referrals: completed_referrals || 0,
      pending_referrals: pending_referrals || 0,
      total_bonus: total_bonus || 0,
      formatted_total_bonus: formatCurrency(total_bonus || 0, user.currency),
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
    // First get the user's referral code
    const { data: currentUser, error: currentUserError } = await supabase
      .from('users')
      .select('referral_code, currency')
      .eq('id', req.user.id)
      .single();
    
    if (currentUserError) throw currentUserError;
    
    const { data: referrals, error: referralError } = await supabase
      .from('users')
      .select(`
        id,
        name,
        email,
        created_at as referral_date,
        referral_bonuses (
          status as bonus_status,
          completed_at as bonus_date,
          amount as bonus_amount,
          currency as bonus_currency
        )
      `)
      .eq('referred_by', currentUser.referral_code)
      .order('created_at', { ascending: false });
    
    if (referralError) throw referralError;
    
    // Get user's currency for display
    const userCurrency = currentUser.currency;
    
    // Format referral history with currency info
    const formattedReferrals = referrals.map(ref => {
      const bonus = ref.referral_bonuses[0] || {};
      const formattedRef = {
        id: ref.id,
        name: ref.name,
        email: ref.email,
        referral_date: ref.referral_date,
        bonus_status: bonus.bonus_status || 'pending',
        bonus_date: bonus.bonus_date,
        bonus_amount: bonus.bonus_amount,
        bonus_currency: bonus.bonus_currency || userCurrency,
        formatted_bonus_amount: formatCurrency(bonus.bonus_amount || 0, bonus.bonus_currency || userCurrency)
      };
      
      // Add converted amount if different from user's currency
      if (bonus.bonus_currency && bonus.bonus_currency !== userCurrency) {
        formattedRef.converted_bonus_amount = formatCurrency(
          convertCurrency(bonus.bonus_amount, bonus.bonus_currency, userCurrency), 
          userCurrency
        );
      }
      
      return formattedRef;
    });
    
    res.status(200).json(formattedReferrals);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get referral leaderboard
app.get('/api/referral/leaderboard', authenticateToken, async (req, res) => {
  try {
    // Get top referrers
    const { data: topReferrers, error } = await supabase
      .from('users')
      .select('id, name, referrals')
      .not('referral_code', 'is', null)
      .order('referrals', { ascending: false })
      .limit(10);
    
    if (error) throw error;
    
    // Format leaderboard
    const leaderboard = topReferrers.map((user, index) => {
      return {
        rank: index + 1,
        id: user.id,
        name: user.name,
        referrals: user.referrals
      };
    });
    
    res.status(200).json(leaderboard);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Start server
const startServer = async () => {
  try {
    app.listen(PORT, () => {
      console.log(`Referrals server running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start referrals server:', err);
    process.exit(1);
  }
};

// Only start if this file is run directly
if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };