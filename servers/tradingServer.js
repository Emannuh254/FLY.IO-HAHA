const express = require('express');
const path = require('path');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const cors = require('cors');
const supabase = require('../supabaseClient');
const { setupMiddleware } = require('../shared/middleware');
const { authenticateToken } = require('../shared/auth');
const { validateRequest, validationSchemas } = require('../shared/helpers');
const { formatCurrency, convertCurrency } = require('../shared/database');

const app = express();
const PORT = process.env.TRADING_PORT || 3003;

// Security middleware
app.use(helmet());
app.use(cors({
    origin: ['http://localhost:3000', 'http://localhost:3006'],
    credentials: true
}));

// Rate limiting for bot operations
const botLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 requests per window
    message: 'Too many bot operations, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
});

// Setup middleware
setupMiddleware(app);

// Serve trading.html
app.get(['/trading', '/trading.html'], (req, res) => {
    const filePath = path.join(__dirname, '../public/trading.html');
    res.setHeader('Content-Type', 'text/html');
    res.sendFile(filePath);
});

// Get available trading bots for purchase
app.get('/api/bots/available', authenticateToken, async (req, res) => {
    try {
        const { data: bots, error } = await supabase
            .from('available_bots')
            .select('*')
            .eq('is_active', true);
        
        if (error) throw error;
        
        res.status(200).json({ bots });
    } catch (err) {
        console.error('Get available bots error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Create trading bot
app.post('/api/bots', botLimiter, authenticateToken, async (req, res) => {
    // Block demo users
    if (req.user.role === 'demo') {
        return res.status(403).json({ 
            message: 'Demo users cannot purchase real bots' 
        });
    }
    
    const { botId, name } = req.body;

    try {
        // Get bot details
        const { data: bot, error: botError } = await supabase
            .from('available_bots')
            .select('*')
            .eq('id', botId)
            .eq('is_active', true)
            .single();
        
        if (botError || !bot) {
            return res.status(404).json({ message: 'Bot not found or not available' });
        }
        
        // Get user's balance and currency
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('balance, currency')
            .eq('id', req.user.id)
            .single();
        
        if (userError) throw userError;
        
        // Check if user has sufficient balance
        if (user.balance < bot.price) {
            return res.status(400).json({ 
                message: 'Insufficient balance',
                balance: formatCurrency(user.balance, user.currency),
                required: formatCurrency(bot.price, user.currency)
            });
        }

        // Calculate profit using fixed 82.25% per cycle
        const profitMultiplier = 1.8225; // 100% (original) + 82.25% (profit)
        const totalProfit = bot.price * profitMultiplier;
        const dailyProfit = totalProfit / 30; // 30-day cycle

        // Create user bot record
        const { data: userBot, error: createError } = await supabase
            .from('user_bots')
            .insert({
                user_id: req.user.id,
                bot_id: bot.id,
                name: name || bot.name,
                investment_amount: bot.price,
                daily_profit: dailyProfit,
                total_profit: totalProfit,
                status: 'active',
                progress: 0,
                last_profit_update: new Date(),
                next_mining_time: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now
            })
            .select()
            .single();
        
        if (createError) throw createError;
        
        // Deduct bot price from user balance and increment active bots count
        const { error: updateError } = await supabase
            .from('users')
            .update({
                balance: supabase.raw(`balance - ${bot.price}`),
                active_bots: supabase.raw('active_bots + 1')
            })
            .eq('id', req.user.id);
        
        if (updateError) throw updateError;
        
        // Record transaction
        await supabase
            .from('transactions')
            .insert({
                user_id: req.user.id,
                type: 'purchase',
                method: 'bot',
                amount: bot.price,
                currency: user.currency,
                status: 'completed',
                reference_id: userBot.id
            });
        
        res.status(201).json({
            message: 'Bot purchased successfully',
            botId: userBot.id,
            expectedReturn: formatCurrency(totalProfit, user.currency),
            dailyProfit: formatCurrency(dailyProfit, user.currency),
            investment: formatCurrency(bot.price, user.currency),
            currency: user.currency,
            nextMiningTime: userBot.next_mining_time
        });
    } catch (err) {
        console.error('Create bot error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Start server with error handling
const startServer = async () => {
    try {
        const server = app.listen(PORT, () => {
            console.log(`Trading server running on port ${PORT}`);
        });
        
        server.on('error', (error) => {
            if (error.code === 'EADDRINUSE') {
                console.error(`Port ${PORT} is already in use. Trying port ${PORT + 1}...`);
                app.listen(PORT + 1, () => {
                    console.log(`Trading server running on port ${PORT + 1}`);
                });
            } else {
                console.error('Failed to start trading server:', error);
                process.exit(1);
            }
        });
    } catch (err) {
        console.error('Failed to start trading server:', err);
        process.exit(1);
    }
};

if (require.main === module) {
    startServer();
}

module.exports = { app, startServer };