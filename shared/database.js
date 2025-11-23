const supabase = require('../supabaseClient');

// Exchange rates
const EXCHANGE_RATES = {
  USD_TO_KSH: 150.0, // Example rate
  KSH_TO_USD: 1 / 150.0
};

// Format currency function
const formatCurrency = (amount, currency) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
    minimumFractionDigits: 2
  }).format(amount);
};

// Convert currency function
const convertCurrency = (amount, fromCurrency, toCurrency) => {
  if (fromCurrency === toCurrency) return amount;
  
  // Convert to USD first if needed
  let inUSD = amount;
  if (fromCurrency !== 'USD') {
    inUSD = amount * (fromCurrency === 'KSH' ? EXCHANGE_RATES.KSH_TO_USD : 1);
  }
  
  // Convert from USD to target currency
  if (toCurrency === 'USD') return inUSD;
  if (toCurrency === 'KSH') return inUSD * EXCHANGE_RATES.USD_TO_KSH;
  
  // Unsupported currency
  throw new Error(`Unsupported currency: ${toCurrency}`);
};

// Initialize database function
const initializeDatabase = async () => {
  try {
    console.log('Initializing database with Supabase...');
    
    // Create users table
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

    // Add verified column if it doesn't exist (for existing tables)
    try {
      await supabase.rpc('exec_sql', {
        sql: `ALTER TABLE users ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT FALSE;`
      });
      console.log('Verified column added or already exists');
    } catch (err) {
      console.log('Verified column might already exist:', err.message);
    }

    // Create transactions table
    const { error: transactionsError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS transactions (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          type VARCHAR(20) NOT NULL,
          method VARCHAR(20) NOT NULL,
          amount DECIMAL(15, 2) NOT NULL,
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

    // Create trading bots table
    const { error: botsError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS trading_bots (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          name VARCHAR(100) NOT NULL,
          investment DECIMAL(15, 2) NOT NULL,
          daily_profit DECIMAL(15, 2) NOT NULL,
          total_profit DECIMAL(15, 2) NOT NULL,
          progress INTEGER DEFAULT 0,
          image_url TEXT,
          status VARCHAR(20) DEFAULT 'active',
          created_at TIMESTAMP DEFAULT NOW()
        );
      `
    });
    
    if (botsError) throw botsError;

    // Create referral bonuses table
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

    // Create deposit addresses table
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

    // Create indexes for better performance
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)',
      'CREATE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code)',
      'CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status)',
      'CREATE INDEX IF NOT EXISTS idx_bots_user_id ON trading_bots(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_referrals_referrer_id ON referral_bonuses(referrer_id)',
      'CREATE INDEX IF NOT EXISTS idx_referrals_referred_id ON referral_bonuses(referred_id)',
      'CREATE INDEX IF NOT EXISTS idx_deposit_addresses_coin_network ON deposit_addresses(coin, network)'
    ];

    for (const indexSql of indexes) {
      const { error } = await supabase.rpc('exec_sql', { sql: indexSql });
      if (error) console.log('Index might already exist:', error.message);
    }

    // Create admin user if not exists
    const { data: adminExists, error: adminCheckError } = await supabase
      .from('users')
      .select('*')
      .eq('email', 'mannuh')
      .maybeSingle();
    
    if (adminCheckError) {
      throw adminCheckError;
    }
    
    if (!adminExists) {
      const bcrypt = require('bcryptjs');
      const SALT_ROUNDS = 12;
      // Hash the password "mannuh"
      const hashedPassword = await bcrypt.hash('mannuh', SALT_ROUNDS);
      const { error } = await supabase
        .from('users')
        .insert({
          name: 'Admin User',
          email: 'mannuh',
          password: hashedPassword,
          role: 'admin',
          balance: 1000000,
          currency: 'USD',
          verified: true
        });
      
      if (error) throw error;
      console.log('Admin user created with email: mannuh');
    } else {
      console.log('Admin user already exists with email: mannuh');
    }

    // Insert default deposit address if not exists
    const { data: addressExists } = await supabase
      .from('deposit_addresses')
      .select('*')
      .eq('coin', 'USDT')
      .eq('network', 'BSC')
      .single();
    
    if (!addressExists) {
      const { error } = await supabase
        .from('deposit_addresses')
        .insert({
          coin: 'USDT',
          network: 'BSC',
          address: '0x081fc7d993439f0aa44e8d9514c00d0b560fb940'
        });
      
      if (error) throw error;
      console.log('Default deposit address created');
    }

    console.log('Database initialized successfully');
  } catch (err) {
    console.error('Error initializing database:', err);
    throw err;
  }
};

// Export all functions and constants
module.exports = {
  initializeDatabase,
  formatCurrency,
  convertCurrency,
  EXCHANGE_RATES
};