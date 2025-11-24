const supabase = require('../supabaseClient');

// Exchange rates
const EXCHANGE_RATES = {
  USD_TO_KSH: 129.76,
  KSH_TO_USD: 1 / 150.0
};

// Format currency
const formatCurrency = (amount, currency) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
    minimumFractionDigits: 2
  }).format(amount);
};

// Convert currency
const convertCurrency = (amount, fromCurrency, toCurrency) => {
  if (fromCurrency === toCurrency) return amount;
  let inUSD = amount;
  if (fromCurrency !== 'USD') {
    inUSD = amount * (fromCurrency === 'KSH' ? EXCHANGE_RATES.KSH_TO_USD : 1);
  }
  if (toCurrency === 'USD') return inUSD;
  if (toCurrency === 'KSH') return inUSD * EXCHANGE_RATES.USD_TO_KSH;
  throw new Error(`Unsupported currency: ${toCurrency}`);
};

// Initialize database
const initializeDatabase = async () => {
  try {
    console.log('Initializing database with Supabase...');

    // Users table
    const { error: usersError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          email VARCHAR(100) UNIQUE NOT NULL,
          password VARCHAR(100),
          phone VARCHAR(20),
          country VARCHAR(50),
          currency VARCHAR(10) DEFAULT 'KSH',
          balance DECIMAL(15, 2) DEFAULT 0,
          profit DECIMAL(15, 2) DEFAULT 0,
          active_bots INTEGER DEFAULT 0,
          referrals INTEGER DEFAULT 0,
          referral_code VARCHAR(20) UNIQUE,
          referred_by VARCHAR(20),
          profile_image TEXT,
          role VARCHAR(20) DEFAULT 'user',
          phone_verified BOOLEAN DEFAULT FALSE,
          verified BOOLEAN DEFAULT FALSE,
          verification_code VARCHAR(10),
          verification_code_expires TIMESTAMP,
          created_at TIMESTAMP DEFAULT NOW()
        );
      `
    });
    if (usersError) throw usersError;

    // Transactions table
    const { error: transactionsError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS transactions (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          type VARCHAR(20) NOT NULL,
          method VARCHAR(20) NOT NULL,
          amount DECIMAL(15,2) NOT NULL,
          currency VARCHAR(10) DEFAULT 'KSH',
          status VARCHAR(20) DEFAULT 'pending',
          tx_hash TEXT,
          address TEXT,
          network TEXT,
          created_at TIMESTAMP DEFAULT NOW()
        );
      `
    });
    if (transactionsError) throw transactionsError;

    // Bot templates (admin-created)
    const { error: templatesError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS bot_templates (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          investment DECIMAL(15,2) NOT NULL,
          daily_profit DECIMAL(15,2) NOT NULL,
          total_profit DECIMAL(15,2) NOT NULL,
          image_url TEXT,
          created_at TIMESTAMP DEFAULT NOW()
        );
      `
    });
    if (templatesError) throw templatesError;

    // User-owned bots
    const { error: botsError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS trading_bots (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          template_id INTEGER REFERENCES bot_templates(id) ON DELETE CASCADE,
          status VARCHAR(20) DEFAULT 'active',
          progress INTEGER DEFAULT 0,
          daily_profit DECIMAL(15,2) DEFAULT 0,
          total_profit DECIMAL(15,2) DEFAULT 0,
          next_mining_time TIMESTAMP DEFAULT NOW(),
          created_at TIMESTAMP DEFAULT NOW()
        );
      `
    });
    if (botsError) throw botsError;

    // Referral bonuses
    const { error: referralError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS referral_bonuses (
          id SERIAL PRIMARY KEY,
          referrer_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          referred_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          amount DECIMAL(15, 2) NOT NULL,
          currency VARCHAR(10) DEFAULT 'KSH',
          status VARCHAR(20) DEFAULT 'pending',
          created_at TIMESTAMP DEFAULT NOW(),
          completed_at TIMESTAMP
        );
      `
    });
    if (referralError) throw referralError;

    // Deposit addresses
    const { error: depositError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS deposit_addresses (
          id SERIAL PRIMARY KEY,
          coin VARCHAR(20) NOT NULL,
          network VARCHAR(20) NOT NULL,
          address TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );
      `
    });
    if (depositError) throw depositError;

    console.log('Database initialized successfully');
  } catch (err) {
    console.error('Error initializing database:', err);
    throw err;
  }
};

module.exports = {
  initializeDatabase,
  formatCurrency,
  convertCurrency,
  EXCHANGE_RATES
};
