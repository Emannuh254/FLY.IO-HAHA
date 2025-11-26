const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const cors = require('cors');
const { body, validationResult } = require('express-validator');
const supabase = require('../supabaseClient');

const app = express();
const PORT = process.env.ADMIN_PORT || 3007;

// Security middleware
app.use(helmet());
app.use(cors({
    origin: ['http://localhost:3000', 'http://localhost:3006', 'http://localhost:3007', 'https://forexproo.onrender.com'],
    credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting for login
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: 'Too many login attempts, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
});

// Serve admin.html
app.get(['/admin', '/admin.html'], (req, res) => {
    const filePath = path.join(__dirname, '../public/admin.html');
    res.setHeader('Content-Type', 'text/html');
    res.sendFile(filePath);
});

// In-memory chart config
let chartConfig = {
    min: 1,         // min chart value
    max: 100,       // max chart value
    maxReach: 80,   // admin decides highest "winning" value
    profitFactor: 0.6 // 60% chance player loses, 40% wins
};

// Admin endpoint to update chart rules
app.post('/api/admin/chart', authenticateAdmin, (req, res) => {
    const { min, max, maxReach, profitFactor } = req.body;
    chartConfig = { min, max, maxReach, profitFactor };
    res.json({ message: 'Chart config updated', chartConfig });
});

// Get current chart config (frontend fetches for algorithm)
app.get('/api/chart/config', (req, res) => {
    res.json(chartConfig);
});

// Player bets
app.post('/api/chart/bet', authenticateUser, (req, res) => {
    const { betAmount } = req.body;
    if (!betAmount || betAmount <= 0) return res.status(400).json({ message: 'Invalid bet' });

    // Generate chart numbers
    const chartLength = 30; // 30 points
    const chart = [];
    let current = chartConfig.min;

    for (let i = 0; i < chartLength; i++) {
        // Random movement up/down
        let change = Math.random() * 5; // 0-5
        if (Math.random() < 0.5) change *= -1;

        current += change;
        current = Math.max(chartConfig.min, Math.min(current, chartConfig.max));

        // Apply admin maxReach bias
        if (current > chartConfig.maxReach && Math.random() < chartConfig.profitFactor) {
            current = chartConfig.maxReach - Math.random() * 5;
        }

        chart.push(parseFloat(current.toFixed(2)));
    }

    // Determine win/loss: simple if chart reaches maxReach player wins
    const didWin = chart.some(val => val >= chartConfig.maxReach);
    const payout = didWin ? betAmount * 1.8 : 0; // 80% profit if win

    res.json({ chart, didWin, payout });
});

// Verify token endpoint
app.get('/api/admin/verify', authenticateAdmin, (req, res) => {
    res.status(200).json({ valid: true });
});

// Admin login
app.post('/api/admin/login', loginLimiter, [
    body('username').isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ 
            message: 'Validation failed',
            errors: errors.array() 
        });
    }
    
    const { username, password } = req.body;

    try {
        const { data: admin, error } = await supabase
            .from('users')
            .select('*')
            .eq('email', username)
            .eq('role', 'admin')
            .single();

        if (error || !admin) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const match = await bcrypt.compare(password, admin.password);
        if (!match) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret';
        const token = jwt.sign(
            { userId: admin.id, role: 'admin' },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.status(200).json({
            message: 'Admin login successful',
            token
        });

    } catch (err) {
        console.error("ADMIN LOGIN ERROR:", err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Authentication middleware
function authenticateAdmin(req, res, next) {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Authentication required' });
    }
    
    const token = authHeader.substring(7);
    
    try {
        const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret';
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ message: 'Invalid or expired token' });
    }
}

// Authentication middleware for regular users
function authenticateUser(req, res, next) {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Authentication required' });
    }
    
    const token = authHeader.substring(7);
    
    try {
        const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret';
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ message: 'Invalid or expired token' });
    }
}

// Get dashboard stats
app.get('/api/admin/stats', authenticateAdmin, async (req, res) => {
    try {
        // Get total users
        const { count: totalUsers, error: usersError } = await supabase
            .from('users')
            .select('*', { count: 'exact', head: true });
            
        // Get total transactions
        const { count: totalTransactions, error: transactionsError } = await supabase
            .from('transactions')
            .select('*', { count: 'exact', head: true });
            
        // Get pending transactions
        const { count: pendingTransactions, error: pendingError } = await supabase
            .from('transactions')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'pending');
            
        // Get total volume
        const { data: volumeData, error: volumeError } = await supabase
            .from('transactions')
            .select('amount')
            .eq('status', 'completed');
            
        let totalVolume = 0;
        if (volumeData) {
            totalVolume = volumeData.reduce((sum, transaction) => sum + parseFloat(transaction.amount), 0);
        }
        
        res.status(200).json({
            totalUsers: totalUsers || 0,
            totalTransactions: totalTransactions || 0,
            pendingTransactions: pendingTransactions || 0,
            totalVolume: totalVolume
        });
    } catch (err) {
        console.error('Error fetching stats:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get all users
app.get('/api/admin/users', authenticateAdmin, async (req, res) => {
    try {
        const { search, page = 1, limit = 20 } = req.query;
        const offset = (page - 1) * limit;
        
        let query = supabase
            .from('users')
            .select('*', { count: 'exact' })
            .range(offset, offset + limit - 1);
            
        if (search) {
            query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
        }
        
        const { data, count, error } = await query;
        
        if (error) throw error;
        
        res.status(200).json({
            users: data || [],
            total: count || 0,
            page: parseInt(page),
            limit: parseInt(limit)
        });
    } catch (err) {
        console.error('Error fetching users:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get user details
app.get('/api/admin/users/:id', authenticateAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        
        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', id)
            .single();
            
        if (error) throw error;
        
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        res.status(200).json({ user });
    } catch (err) {
        console.error('Error fetching user:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Verify/unverify user
app.put('/api/admin/users/:id/verify', authenticateAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { verified } = req.body;
        
        const { data, error } = await supabase
            .from('users')
            .update({ verified })
            .eq('id', id)
            .select();
            
        if (error) throw error;
        
        if (!data || data.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        res.status(200).json({
            message: `User ${verified ? 'verified' : 'unverified'} successfully`,
            user: data[0]
        });
    } catch (err) {
        console.error('Error updating user verification:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get all transactions
app.get('/api/admin/transactions', authenticateAdmin, async (req, res) => {
    try {
        const { filter, search, page = 1, limit = 20 } = req.query;
        const offset = (page - 1) * limit;
        
        let query = supabase
            .from('transactions')
            .select(`
                *,
                user:users(name, email)
            `, { count: 'exact' })
            .range(offset, offset + limit - 1)
            .order('created_at', { ascending: false });
            
        if (filter && filter !== 'all') {
            query = query.eq('status', filter);
        }
        
        if (search) {
            query = query.or(`user.name.ilike.%${search}%,user.email.ilike.%${search}%,id.ilike.%${search}%`);
        }
        
        const { data, count, error } = await query;
        
        if (error) throw error;
        
        res.status(200).json({
            transactions: data || [],
            total: count || 0,
            page: parseInt(page),
            limit: parseInt(limit)
        });
    } catch (err) {
        console.error('Error fetching transactions:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get transaction details
app.get('/api/admin/transactions/:id', authenticateAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        
        const { data: transaction, error } = await supabase
            .from('transactions')
            .select(`
                *,
                user:users(name, email)
            `)
            .eq('id', id)
            .single();
            
        if (error) throw error;
        
        if (!transaction) {
            return res.status(404).json({ message: 'Transaction not found' });
        }
        
        res.status(200).json({ transaction });
    } catch (err) {
        console.error('Error fetching transaction:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Update transaction status
app.put('/api/admin/transactions/:id/status', authenticateAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        
        const { data, error } = await supabase
            .from('transactions')
            .update({ status })
            .eq('id', id)
            .select();
            
        if (error) throw error;
        
        if (!data || data.length === 0) {
            return res.status(404).json({ message: 'Transaction not found' });
        }
        
        // If transaction is completed, update user balance
        if (status === 'completed') {
            const transaction = data[0];
            if (transaction.type === 'deposit') {
                await supabase.rpc('increment_user_balance', {
                    user_id: transaction.user_id,
                    amount: parseFloat(transaction.amount)
                });
            }
        }
        
        res.status(200).json({
            message: `Transaction ${status} successfully`,
            transaction: data[0]
        });
    } catch (err) {
        console.error('Error updating transaction status:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get all deposits
app.get('/api/admin/deposits', authenticateAdmin, async (req, res) => {
    try {
        const { filter, search, page = 1, limit = 20 } = req.query;
        const offset = (page - 1) * limit;
        
        let query = supabase
            .from('deposits')
            .select(`
                *,
                user:users(name, email)
            `, { count: 'exact' })
            .range(offset, offset + limit - 1)
            .order('created_at', { ascending: false });
            
        if (filter && filter !== 'all') {
            query = query.eq('status', filter);
        }
        
        if (search) {
            query = query.or(`user.name.ilike.%${search}%,user.email.ilike.%${search}%,id.ilike.%${search}%`);
        }
        
        const { data, count, error } = await query;
        
        if (error) throw error;
        
        res.status(200).json({
            deposits: data || [],
            total: count || 0,
            page: parseInt(page),
            limit: parseInt(limit)
        });
    } catch (err) {
        console.error('Error fetching deposits:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Create deposit (admin only)
app.post('/api/admin/deposits', authenticateAdmin, [
    body('user_id').isInt().withMessage('User ID must be an integer'),
    body('amount').isFloat({ min: 1 }).withMessage('Amount must be greater than 0'),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ 
            message: 'Validation failed',
            errors: errors.array() 
        });
    }

    try {
        const { user_id, amount, currency, note, status = 'pending' } = req.body;

        // Check if user exists
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('balance, currency')
            .eq('id', user_id)
            .single();

        if (userError || !user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Create deposit
        const { data: deposit, error: depositError } = await supabase
            .from('deposits')
            .insert({
                user_id,
                amount,
                currency: currency || user.currency || 'KSH',
                note,
                status
            })
            .select()
            .single();

        if (depositError) throw depositError;

        // If deposit is completed, update user balance
        if (status === 'completed') {
            await supabase.rpc('increment_user_balance', {
                user_id,
                amount: parseFloat(amount)
            });
        }

        res.status(201).json({
            message: 'Deposit created successfully',
            deposit
        });

    } catch (err) {
        console.error('Error creating deposit:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Update deposit status (admin only)
app.put('/api/admin/deposits/:id/status', authenticateAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const { data, error } = await supabase
            .from('deposits')
            .update({ status })
            .eq('id', id)
            .select();

        if (error) throw error;
        if (!data || data.length === 0) {
            return res.status(404).json({ message: 'Deposit not found' });
        }

        // Update user balance if deposit is marked completed
        if (status === 'completed') {
            const deposit = data[0];
            await supabase.rpc('increment_user_balance', {
                user_id: deposit.user_id,
                amount: parseFloat(deposit.amount)
            });
        }

        res.status(200).json({
            message: `Deposit status updated to "${status}" successfully`,
            deposit: data[0]
        });

    } catch (err) {
        console.error('Error updating deposit status:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get all withdrawals
app.get('/api/admin/withdrawals', authenticateAdmin, async (req, res) => {
    try {
        const { filter, search, page = 1, limit = 20 } = req.query;
        const offset = (page - 1) * limit;
        
        let query = supabase
            .from('withdrawals')
            .select(`
                *,
                user:users(name, email)
            `, { count: 'exact' })
            .range(offset, offset + limit - 1)
            .order('created_at', { ascending: false });
            
        if (filter && filter !== 'all') {
            query = query.eq('status', filter);
        }
        
        if (search) {
            query = query.or(`user.name.ilike.%${search}%,user.email.ilike.%${search}%,id.ilike.%${search}%`);
        }
        
        const { data, count, error } = await query;
        
        if (error) throw error;
        
        res.status(200).json({
            withdrawals: data || [],
            total: count || 0,
            page: parseInt(page),
            limit: parseInt(limit)
        });
    } catch (err) {
        console.error('Error fetching withdrawals:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Update withdrawal status
app.put('/api/admin/withdrawals/:id/status', authenticateAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        
        const { data, error } = await supabase
            .from('withdrawals')
            .update({ status })
            .eq('id', id)
            .select();
            
        if (error) throw error;
        
        if (!data || data.length === 0) {
            return res.status(404).json({ message: 'Withdrawal not found' });
        }
        
        // If withdrawal is completed, deduct from user balance
        if (status === 'completed') {
            const withdrawal = data[0];
            await supabase.rpc('decrement_user_balance', {
                user_id: withdrawal.user_id,
                amount: parseFloat(withdrawal.amount)
            });
        }
        
        res.status(200).json({
            message: `Withdrawal ${status} successfully`,
            withdrawal: data[0]
        });
    } catch (err) {
        console.error('Error updating withdrawal status:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get all trading bots
app.get('/api/admin/bots', authenticateAdmin, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('trading_bots')
            .select(`
                *,
                user:users(name, email)
            `)
            .order('created_at', { ascending: false });
            
        if (error) throw error;
        
        res.status(200).json({ bots: data || [] });
    } catch (err) {
        console.error('Error fetching bots:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Create trading bot (admin only)
app.post('/api/admin/bots', authenticateAdmin, [
    body('name').notEmpty().withMessage('Bot name is required'),
    body('investment').isFloat({ min: 100 }).withMessage('Investment must be at least 100'),
], async (req, res) => {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ 
            message: 'Validation failed',
            errors: errors.array() 
        });
    }

    try {
        const { name, investment } = req.body;

        // Calculate profit
        const profitMultiplier = 1.8225; // 82.25% profit
        const totalProfit = investment * profitMultiplier;
        const dailyProfit = totalProfit / 30; // 30-day cycle

        // Insert bot in dormant state
        const { data: bot, error: botError } = await supabase
            .from('trading_bots')
            .insert({
                name,
                investment,
                daily_profit: dailyProfit,
                total_profit: totalProfit,
                status: 'dormant',       // Bot is inactive until purchased
                progress: 0,
                next_mining_time: null,  // Will be set when user buys the bot
                created_at: new Date().toISOString()
            })
            .select()
            .single();

        if (botError) throw botError;

        res.status(201).json({
            message: `Trading bot "${bot.name}" created successfully in dormant state.`,
            bot
        });

    } catch (err) {
        console.error('Error creating bot:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Delete a trading bot
app.delete('/api/admin/bots/:id', authenticateAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        
        const { data, error } = await supabase
            .from('trading_bots')
            .delete()
            .eq('id', id)
            .select();
            
        if (error) throw error;
        
        if (!data || data.length === 0) {
            return res.status(404).json({ message: 'Bot not found' });
        }
        
        res.status(200).json({
            message: 'Bot deleted successfully',
            bot: data[0]
        });
    } catch (err) {
        console.error('Error deleting bot:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get deposit addresses
app.get('/api/admin/deposit-addresses', authenticateAdmin, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('deposit_addresses')
            .select('*')
            .order('coin', { ascending: true });
            
        if (error) throw error;
        
        res.status(200).json({ addresses: data || [] });
    } catch (err) {
        console.error('Error fetching deposit addresses:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Create deposit address
app.post('/api/admin/deposit-addresses', authenticateAdmin, [
    body('coin').isLength({ min: 1 }).withMessage('Coin is required'),
    body('network').isLength({ min: 1 }).withMessage('Network is required'),
    body('address').isLength({ min: 1 }).withMessage('Address is required'),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ 
            message: 'Validation failed',
            errors: errors.array() 
        });
    }
    
    try {
        const { coin, network, address } = req.body;
        
        const { data, error } = await supabase
            .from('deposit_addresses')
            .insert({ coin, network, address })
            .select()
            .single();
            
        if (error) throw error;
        
        res.status(201).json({
            message: 'Deposit address created successfully',
            address: data
        });
    } catch (err) {
        console.error('Error creating deposit address:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Update deposit address
app.put('/api/admin/deposit-addresses/:id', authenticateAdmin, [
    body('address').isLength({ min: 1 }).withMessage('Address is required'),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ 
            message: 'Validation failed',
            errors: errors.array() 
        });
    }
    
    try {
        const { id } = req.params;
        const { address } = req.body;
        
        const { data, error } = await supabase
            .from('deposit_addresses')
            .update({ address })
            .eq('id', id)
            .select();
            
        if (error) throw error;
        
        if (!data || data.length === 0) {
            return res.status(404).json({ message: 'Deposit address not found' });
        }
        
        res.status(200).json({
            message: 'Deposit address updated successfully',
            address: data[0]
        });
    } catch (err) {
        console.error('Error updating deposit address:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Start server
const startServer = async () => {
    try {
        const server = app.listen(PORT, () => {
            console.log(`Admin server running on port ${PORT}`);
        });
        
        server.on('error', (error) => {
            if (error.code === 'EADDRINUSE') {
                console.error(`Port ${PORT} is already in use. Trying port ${PORT + 1}...`);
                app.listen(PORT + 1, () => {
                    console.log(`Admin server running on port ${PORT + 1}`);
                });
            } else {
                console.error('Failed to start admin server:', error);
                process.exit(1);
            }
        });
    } catch (err) {
        console.error('Failed to start admin server:', err);
        process.exit(1);
    }
};

if (require.main === module) {
    startServer();
}

module.exports = { app, startServer };