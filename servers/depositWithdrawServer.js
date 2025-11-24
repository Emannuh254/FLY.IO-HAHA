const express = require('express');
const path = require('path');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const cors = require('cors');
const supabase = require('../supabaseClient');
const { setupMiddleware } = require('../shared/middleware');
const { authenticateToken, comparePassword } = require('../shared/auth');
const { validateRequest, validationSchemas } = require('../shared/helpers');
const { formatCurrency, convertCurrency } = require('../shared/database');

const app = express();
const PORT = process.env.DEPOSIT_WITHDRAW_PORT || 3005;

// Security middleware
app.use(helmet());
app.use(cors({
    origin: ['http://localhost:3000', 'http://localhost:3006'],
    credentials: true
}));

// Rate limiting for sensitive operations
const sensitiveLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 requests per window
    message: 'Too many requests, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
});

// In-memory cache for deposit addresses with TTL
const depositAddressCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Setup middleware
setupMiddleware(app);

// Serve static page
app.get(['/deposit-withdraw', '/deposit-withdraw.html'], (req, res) => {
    res.sendFile(path.join(__dirname, '../public/deposit-withdraw.html'));
});

// Get deposit address (cached)
app.get('/api/deposit/address', authenticateToken, sensitiveLimiter, async (req, res) => {
    try {
        const coin = (req.query.coin || 'USDT').toUpperCase();
        const network = (req.query.network || 'BSC').toUpperCase();
        const cacheKey = `${coin}_${network}`;

        // Check cache first
        const now = Date.now();
        const cached = depositAddressCache.get(cacheKey);

        if (cached && cached.expiry > now) {
            return res.json({ coin, network, address: cached.address });
        }

        // Fetch from database if not in cache
        const { data, error } = await supabase
            .from('deposit_addresses')
            .select('address')
            .eq('coin', coin)
            .eq('network', network)
            .single();

        if (error || !data) {
            return res.status(404).json({ message: 'Deposit address not found' });
        }

        // Update cache
        depositAddressCache.set(cacheKey, {
            address: data.address,
            expiry: now + CACHE_TTL,
        });

        res.json({ coin, network, address: data.address });
    } catch (err) {
        console.error('Deposit address error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get user with minimal fields (optimized)
const getUserMinimal = async (userId) => {
    const { data, error } = await supabase
        .from('users')
        .select('currency, referred_by, balance, password, active_bots, role')
        .eq('id', userId)
        .single();

    if (error || !data) throw new Error('User not found');
    return data;
};

// Deposit endpoint
app.post('/api/deposit', sensitiveLimiter, validationSchemas.deposit, authenticateToken, async (req, res) => {
    if (req.user.role === 'demo') {
        return res.status(403).json({ message: 'Demo users cannot make deposits' });
    }

    if (!validateRequest(req, res)) return;

    const { amount, method, currency, network, address } = req.body;

    try {
        const user = await getUserMinimal(req.user.id);

        // Convert amount to user's currency if needed
        const convertedAmount = currency === user.currency
            ? amount
            : convertCurrency(amount, currency, user.currency);

        // Insert deposit record
        const { data: deposit, error: depErr } = await supabase
            .from('deposits')
            .insert({
                user_id: req.user.id,
                amount: convertedAmount,
                currency: user.currency,
                method,
                network,
                address,
                status: 'pending',
            })
            .select('id')
            .single();

        if (depErr) throw depErr;

        // Process referral bonus if applicable
        const minDeposit = user.currency === 'KSH' ? 10000 : 66.67;
        if (parseFloat(convertedAmount) >= minDeposit && user.referred_by) {
            try {
                const { data: pendingBonus } = await supabase
                    .from('referral_bonuses')
                    .select('id, amount, currency, referrer_id')
                    .eq('referred_id', req.user.id)
                    .eq('status', 'pending')
                    .single();

                if (pendingBonus) {
                    await Promise.all([
                        // Mark bonus as completed
                        supabase
                            .from('referral_bonuses')
                            .update({ status: 'completed', completed_at: new Date().toISOString() })
                            .eq('id', pendingBonus.id),

                        // Credit referrer's balance
                        supabase
                            .from('users')
                            .update({ balance: supabase.raw(`balance + ${pendingBonus.amount}`) })
                            .eq('id', pendingBonus.referrer_id),

                        // Log transaction
                        supabase.from('transactions').insert({
                            user_id: pendingBonus.referrer_id,
                            type: 'bonus',
                            method: 'referral',
                            amount: pendingBonus.amount,
                            currency: pendingBonus.currency,
                            status: 'completed',
                        }),
                    ]);
                }
            } catch (bonusError) {
                console.error('Referral bonus processing error:', bonusError);
                // Continue even if bonus processing fails
            }
        }

        // Prepare response
        const response = {
            message: method === 'crypto' ? 'Deposit request created' : 'Deposit request submitted',
            depositId: deposit.id,
            amount: formatCurrency(convertedAmount, user.currency),
            originalAmount: formatCurrency(amount, currency),
        };

        if (method === 'crypto') {
            Object.assign(response, {
                depositAddress: address,
                network: network || 'BSC',
            });
        } else {
            response.status = 'pending';
        }

        res.json(response);
    } catch (err) {
        console.error('Deposit error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Withdraw endpoint
app.post('/api/withdraw', sensitiveLimiter, validationSchemas.withdraw, authenticateToken, async (req, res) => {
    if (req.user.role === 'demo') {
        return res.status(403).json({ message: 'Demo users cannot make withdrawals' });
    }

    if (!validateRequest(req, res)) return;

    const { amount, method, currency, address, password } = req.body;

    try {
        const user = await getUserMinimal(req.user.id);

        // Verify password
        if (!(await comparePassword(password, user.password))) {
            return res.status(400).json({ message: 'Invalid password' });
        }

        // Convert amount to user's currency if needed
        const convertedAmount = currency === user.currency
            ? amount
            : convertCurrency(amount, currency, user.currency);

        // Validate withdrawal requirements
        if (parseFloat(convertedAmount) < 1200) {
            return res.status(400).json({ message: 'Minimum withdrawal amount is 1200' });
        }
        if (user.active_bots < 1) {
            return res.status(400).json({ message: 'You must own at least one bot to withdraw' });
        }
        if (parseFloat(user.balance) < parseFloat(convertedAmount)) {
            return res.status(400).json({ message: 'Insufficient balance' });
        }

        // Check if user has at least one completed deposit
        const { count } = await supabase
            .from('deposits')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', req.user.id)
            .eq('status', 'completed');

        if (count === 0) {
            return res.status(400).json({ message: 'You must have made at least one deposit to withdraw' });
        }

        // Create withdrawal record
        const { data: withdrawal, error } = await supabase
            .from('withdrawals')
            .insert({
                user_id: req.user.id,
                amount: convertedAmount,
                currency: user.currency,
                method,
                address,
                status: 'pending',
            })
            .select('id')
            .single();

        if (error) throw error;

        res.json({
            message: 'Withdrawal request submitted for approval',
            withdrawalId: withdrawal.id,
            status: 'pending',
            amount: formatCurrency(convertedAmount, user.currency),
            originalAmount: formatCurrency(amount, currency),
        });
    } catch (err) {
        console.error('Withdraw error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Format history items with currency conversion
const formatHistory = (items, userCurrency) =>
    items.map(item => {
        const formatted = {
            ...item,
            formattedAmount: formatCurrency(item.amount, item.currency),
        };
        if (item.currency !== userCurrency) {
            formatted.convertedAmount = formatCurrency(
                convertCurrency(item.amount, item.currency, userCurrency),
                userCurrency
            );
        }
        return formatted;
    });

// History endpoints (optimized)
app.get('/api/transactions', authenticateToken, async (req, res) => {
    try {
        const { data: user } = await supabase.from('users').select('currency').eq('id', req.user.id).single();
        const { data, error } = await supabase
            .from('transactions')
            .select('*')
            .eq('user_id', req.user.id)
            .order('created_at', { ascending: false });

        if (error) return res.status(500).json({ message: 'Server error' });
        res.json(formatHistory(data, user.currency));
    } catch (err) {
        console.error('Transactions history error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

app.get('/api/deposits', authenticateToken, async (req, res) => {
    try {
        const { data: user } = await supabase.from('users').select('currency').eq('id', req.user.id).single();
        const { data, error } = await supabase
            .from('deposits')
            .select('*')
            .eq('user_id', req.user.id)
            .order('created_at', { ascending: false });

        if (error) return res.status(500).json({ message: 'Server error' });
        res.json(formatHistory(data, user.currency));
    } catch (err) {
        console.error('Deposits history error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

app.get('/api/withdrawals', authenticateToken, async (req, res) => {
    try {
        const { data: user } = await supabase.from('users').select('currency').eq('id', req.user.id).single();
        const { data, error } = await supabase
            .from('withdrawals')
            .select('*')
            .eq('user_id', req.user.id)
            .order('created_at', { ascending: false });

        if (error) return res.status(500).json({ message: 'Server error' });
        res.json(formatHistory(data, user.currency));
    } catch (err) {
        console.error('Withdrawals history error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

app.get('/api/referrals', authenticateToken, async (req, res) => {
    try {
        const { data: user } = await supabase.from('users').select('currency').eq('id', req.user.id).single();
        const { data, error } = await supabase
            .from('referral_bonuses')
            .select('*, referred_user:referred_id(name, email)')
            .eq('referrer_id', req.user.id)
            .order('created_at', { ascending: false });

        if (error) return res.status(500).json({ message: 'Server error' });
        res.json(formatHistory(data, user.currency));
    } catch (err) {
        console.error('Referrals history error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Start server with error handling
const startServer = async () => {
    try {
        const server = app.listen(PORT, () => {
            console.log(`Deposit/Withdraw server running on port ${PORT}`);
        });
        
        server.on('error', (error) => {
            if (error.code === 'EADDRINUSE') {
                console.error(`Port ${PORT} is already in use. Trying port ${PORT + 1}...`);
                app.listen(PORT + 1, () => {
                    console.log(`Deposit/Withdraw server running on port ${PORT + 1}`);
                });
            } else {
                console.error('Failed to start deposit/withdraw server:', error);
                process.exit(1);
            }
        });
    } catch (err) {
        console.error('Failed to start deposit/withdraw server:', err);
        process.exit(1);
    }
};

if (require.main === module) startServer();

module.exports = { app, startServer };