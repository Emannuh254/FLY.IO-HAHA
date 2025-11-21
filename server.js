require('dotenv').config();
const express = require('express');
const pg = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const { exec } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3000;

// Database connection
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: true
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  const baseUrl = 'https://fly-io-haha.onrender.com';
  const fullUrl = `${baseUrl}${req.originalUrl}`;
  console.log(`[${new Date().toISOString()}] ${req.method} ${fullUrl}`);
  next();
});

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'forexpro-secret-key';

// Helper functions
const generateToken = (userId) => {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '30d' });
};

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.status(401).json({ message: 'Authentication required' });
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: 'Invalid token' });
    req.user = user;
    next();
  });
};

// Function to kill process using a port with multiple fallback methods
const killPort = (port) => {
  return new Promise((resolve, reject) => {
    // Method 1: Try with sudo fuser
    exec(`sudo fuser -k ${port}/tcp`, (error, stdout, stderr) => {
      if (!error) {
        console.log(`Killed process using port ${port} with sudo fuser`);
        resolve();
        return;
      }
      
      // Method 2: Try without sudo fuser
      exec(`fuser -k ${port}/tcp`, (error, stdout, stderr) => {
        if (!error) {
          console.log(`Killed process using port ${port} with fuser (no sudo)`);
          resolve();
          return;
        }
        
        // Method 3: Try with lsof
        exec(`sudo lsof -ti:${port} | xargs kill -9`, (error, stdout, stderr) => {
          if (!error) {
            console.log(`Killed process using port ${port} with lsof`);
            resolve();
            return;
          }
          
          // Method 4: Try without sudo lsof
          exec(`lsof -ti:${port} | xargs kill -9`, (error, stdout, stderr) => {
            if (!error) {
              console.log(`Killed process using port ${port} with lsof (no sudo)`);
              resolve();
              return;
            }
            
            // Method 5: Try with netstat
            exec(`sudo netstat -tulpn | grep :${port} | awk '{print $7}' | cut -d'/' -f1 | xargs kill -9`, (error, stdout, stderr) => {
              if (!error) {
                console.log(`Killed process using port ${port} with netstat`);
                resolve();
                return;
              }
              
              // Method 6: Try without sudo netstat
              exec(`netstat -tulpn | grep :${port} | awk '{print $7}' | cut -d'/' -f1 | xargs kill -9`, (error, stdout, stderr) => {
                if (!error) {
                  console.log(`Killed process using port ${port} with netstat (no sudo)`);
                  resolve();
                  return;
                }
                
                // If all methods failed, check if the port is actually in use
                exec(`netstat -tulpn | grep :${port}`, (error, stdout, stderr) => {
                  if (error || !stdout) {
                    // Port is not in use, which is fine
                    console.log(`Port ${port} is not in use`);
                    resolve();
                  } else {
                    // Port is in use but we couldn't kill it
                    console.error(`Could not kill process using port ${port}. Continuing anyway...`);
                    resolve();
                  }
                });
              });
            });
          });
        });
      });
    });
  });
};

// Initialize database tables
const initializeDatabase = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(100) NOT NULL,
        phone VARCHAR(20),
        country VARCHAR(50),
        currency VARCHAR(10) DEFAULT 'USD',
        balance DECIMAL(15, 2) DEFAULT 0,
        profit DECIMAL(15, 2) DEFAULT 0,
        active_bots INTEGER DEFAULT 0,
        referrals INTEGER DEFAULT 0,
        referral_code VARCHAR(20) UNIQUE,
        referred_by VARCHAR(20),
        profile_image TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        type VARCHAR(20) NOT NULL,
        method VARCHAR(20) NOT NULL,
        amount DECIMAL(15, 2) NOT NULL,
        currency VARCHAR(10) DEFAULT 'USD',
        status VARCHAR(20) DEFAULT 'pending',
        tx_hash TEXT,
        address TEXT,
        network TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS trading_bots (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        name VARCHAR(100) NOT NULL,
        investment DECIMAL(15, 2) NOT NULL,
        daily_profit DECIMAL(15, 2) NOT NULL,
        total_profit DECIMAL(15, 2) NOT NULL,
        progress INTEGER DEFAULT 0,
        image_url TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    console.log('Database initialized successfully');
  } catch (err) {
    console.error('Error initializing database:', err);
  }
};

// Check if public directory exists, create if it doesn't
const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)) {
  console.log('Creating public directory...');
  fs.mkdirSync(publicDir, { recursive: true });
}

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.post('/api/auth/signup', async (req, res) => {
  const { name, email, password, phone, country, currency, referralCode } = req.body;
  
  try {
    // Check if user already exists
    const userExists = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userExists.rows.length > 0) {
      return res.status(400).json({ message: 'User already exists' });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Generate referral code
    const referralCodeNew = crypto.randomBytes(5).toString('hex');
    
    // Insert user
    const result = await pool.query(
      `INSERT INTO users (name, email, password, phone, country, currency, referral_code, referred_by) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [name, email, hashedPassword, phone, country, currency, referralCodeNew, referralCode]
    );
    
    const userId = result.rows[0].id;
    const token = generateToken(userId);
    
    // Update referrer if referral code was used
    if (referralCode) {
      await pool.query(
        'UPDATE users SET referrals = referrals + 1 WHERE referral_code = $1',
        [referralCode]
      );
    }
    
    res.status(201).json({ 
      message: 'User created successfully', 
      token,
      user: { id: userId, name, email, referralCode: referralCodeNew }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  
  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];
    
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }
    
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }
    
    const token = generateToken(user.id);
    
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
        profile_image: user.profile_image
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/user/profile', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.userId]);
    const user = result.rows[0];
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.status(200).json({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      country: user.country,
      currency: user.currency,
      balance: user.balance,
      profit: user.profit,
      active_bots: user.active_bots,
      referrals: user.referrals,
      referral_code: user.referral_code,
      profile_image: user.profile_image
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

app.put('/api/user/profile', authenticateToken, async (req, res) => {
  const { name, email, phone, country, currency } = req.body;
  
  try {
    await pool.query(
      `UPDATE users SET name = $1, email = $2, phone = $3, country = $4, currency = $5 
       WHERE id = $6`,
      [name, email, phone, country, currency, req.user.userId]
    );
    
    res.status(200).json({ message: 'Profile updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/deposit', authenticateToken, async (req, res) => {
  const { amount, method, currency, network, address } = req.body;
  
  try {
    // Create transaction record
    const result = await pool.query(
      `INSERT INTO transactions (user_id, type, method, amount, currency, network, address) 
       VALUES ($1, 'deposit', $2, $3, $4, $5, $6) RETURNING id`,
      [req.user.userId, method, amount, currency, network, address]
    );
    
    const transactionId = result.rows[0].id;
    
    // For crypto deposits, return the deposit address
    if (method === 'crypto') {
      return res.status(200).json({
        message: 'Deposit request created',
        transactionId,
        depositAddress: '0x081fc7d993439f0aa44e8d9514c00d0b560fb940',
        network: network || 'BSC'
      });
    }
    
    // For fiat deposits, mark as pending
    res.status(200).json({
      message: 'Deposit request submitted',
      transactionId,
      status: 'pending'
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/withdraw', authenticateToken, async (req, res) => {
  const { amount, method, currency, address, password } = req.body;
  
  try {
    // Verify password
    const userResult = await pool.query('SELECT password, balance FROM users WHERE id = $1', [req.user.userId]);
    const user = userResult.rows[0];
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ message: 'Invalid password' });
    }
    
    // Check balance
    if (parseFloat(user.balance) < parseFloat(amount)) {
      return res.status(400).json({ message: 'Insufficient balance' });
    }
    
    // Create transaction record
    const result = await pool.query(
      `INSERT INTO transactions (user_id, type, method, amount, currency, address, status) 
       VALUES ($1, 'withdraw', $2, $3, $4, $5, 'pending') RETURNING id`,
      [req.user.userId, method, amount, currency, address]
    );
    
    const transactionId = result.rows[0].id;
    
    // Deduct from balance (in real app, this would happen after confirmation)
    await pool.query(
      'UPDATE users SET balance = balance - $1 WHERE id = $2',
      [amount, req.user.userId]
    );
    
    res.status(200).json({
      message: 'Withdrawal request submitted',
      transactionId,
      status: 'pending'
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/transactions', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM transactions WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.userId]
    );
    
    res.status(200).json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/referral/stats', authenticateToken, async (req, res) => {
  try {
    const userResult = await pool.query('SELECT referrals FROM users WHERE id = $1', [req.user.userId]);
    const referrals = userResult.rows[0].referrals;
    
    const transactionsResult = await pool.query(
      `SELECT COUNT(*) as completed_referrals, SUM(amount) as total_bonus 
       FROM transactions 
       WHERE user_id = $1 AND type = 'bonus' AND status = 'completed'`,
      [req.user.userId]
    );
    
    const { completed_referrals, total_bonus } = transactionsResult.rows[0];
    
    res.status(200).json({
      total_referrals: referrals,
      completed_referrals: parseInt(completed_referrals) || 0,
      total_bonus: parseFloat(total_bonus) || 0,
      bonus_per_referral: 200 // KSH 200 per referral
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/bots', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM trading_bots WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.userId]
    );
    
    res.status(200).json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/bots', authenticateToken, async (req, res) => {
  const { name, investment } = req.body;
  
  try {
    // Check if user has enough balance
    const userResult = await pool.query('SELECT balance FROM users WHERE id = $1', [req.user.userId]);
    const user = userResult.rows[0];
    
    if (parseFloat(user.balance) < parseFloat(investment)) {
      return res.status(400).json({ message: 'Insufficient balance' });
    }
    
    // Calculate profits (2x return, not more than 2.25x)
    const totalProfit = parseFloat(investment) * 2;
    const dailyProfit = totalProfit / 30; // Assuming 30 days cycle
    
    // Create bot record
    const result = await pool.query(
      `INSERT INTO trading_bots (user_id, name, investment, daily_profit, total_profit, image_url) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [req.user.userId, name, investment, dailyProfit, totalProfit, `https://images.unsplash.com/photo-1639762681485-074b7f938ba0`]
    );
    
    const botId = result.rows[0].id;
    
    // Deduct from balance
    await pool.query(
      'UPDATE users SET balance = balance - $1, active_bots = active_bots + 1 WHERE id = $2',
      [investment, req.user.userId]
    );
    
    res.status(201).json({
      message: 'Trading bot created successfully',
      botId
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Serve the main HTML file for all other routes
app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, 'public', 'index.html');
  
  // Check if index.html exists
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
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
  }
});

// Start server
const startServer = async () => {
  try {
    // Kill any process using the port
    console.log(`Checking for processes using port ${PORT}...`);
    await killPort(PORT);
    
    // Initialize database
    await initializeDatabase();
    
    // Start the server
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Base URL: https://fly-io-haha.onrender.com`);
      console.log(`Public directory: ${publicDir}`);
      
      // List files in public directory
      const files = fs.readdirSync(publicDir);
      console.log('Files in public directory:', files);
      
      // Check if .env is in public directory (security warning)
      if (files.includes('.env')) {
        console.error('⚠️  SECURITY WARNING: .env file found in public directory!');
        console.error('   This could expose your environment variables to the public.');
        console.error('   Move .env to the root directory of your project.');
      }
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
};

startServer();