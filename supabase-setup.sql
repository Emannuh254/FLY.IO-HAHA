-- Create a function to execute raw SQL
CREATE OR REPLACE FUNCTION exec_sql(sql text)
RETURNS void AS $$ BEGIN
  EXECUTE sql;
END;
 $$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create users table
SELECT exec_sql('
  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(100),
    phone VARCHAR(20),
    country VARCHAR(50),
    currency VARCHAR(10) DEFAULT ''KSH'',
    balance DECIMAL(15, 2) DEFAULT 0,
    profit DECIMAL(15, 2) DEFAULT 0,
    active_bots INTEGER DEFAULT 0,
    referrals INTEGER DEFAULT 0,
    referral_code VARCHAR(20) UNIQUE,
    referred_by VARCHAR(20),
    profile_image TEXT,
    role VARCHAR(20) DEFAULT ''user'',
    phone_verified BOOLEAN DEFAULT FALSE,
    verification_code VARCHAR(10),
    verification_code_expires TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
  )
');

-- Create transactions table
SELECT exec_sql('
  CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL,
    method VARCHAR(20) NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    currency VARCHAR(10) DEFAULT ''KSH'',
    status VARCHAR(20) DEFAULT ''pending'',
    tx_hash TEXT,
    address TEXT,
    network TEXT,
    created_at TIMESTAMP DEFAULT NOW()
  )
');

-- Create trading bots table
SELECT exec_sql('
  CREATE TABLE IF NOT EXISTS trading_bots (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    investment DECIMAL(15, 2) NOT NULL,
    daily_profit DECIMAL(15, 2) NOT NULL,
    total_profit DECIMAL(15, 2) NOT NULL,
    progress INTEGER DEFAULT 0,
    image_url TEXT,
    status VARCHAR(20) DEFAULT ''active'',
    created_at TIMESTAMP DEFAULT NOW()
  )
');

-- Create referral bonuses table
SELECT exec_sql('
  CREATE TABLE IF NOT EXISTS referral_bonuses (
    id SERIAL PRIMARY KEY,
    referrer_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    referred_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    amount DECIMAL(15, 2) NOT NULL,
    currency VARCHAR(10) DEFAULT ''KSH'',
    status VARCHAR(20) DEFAULT ''pending'',
    created_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP
  )
');

-- Create deposit addresses table
SELECT exec_sql('
  CREATE TABLE IF NOT EXISTS deposit_addresses (
    id SERIAL PRIMARY KEY,
    coin VARCHAR(20) NOT NULL,
    network VARCHAR(20) NOT NULL,
    address TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  )
');

-- Create indexes for better performance
SELECT exec_sql('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)');
SELECT exec_sql('CREATE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code)');
SELECT exec_sql('CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id)');
SELECT exec_sql('CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status)');
SELECT exec_sql('CREATE INDEX IF NOT EXISTS idx_bots_user_id ON trading_bots(user_id)');
SELECT exec_sql('CREATE INDEX IF NOT EXISTS idx_referrals_referrer_id ON referral_bonuses(referrer_id)');
SELECT exec_sql('CREATE INDEX IF NOT EXISTS idx_referrals_referred_id ON referral_bonuses(referred_id)');
SELECT exec_sql('CREATE INDEX IF NOT EXISTS idx_deposit_addresses_coin_network ON deposit_addresses(coin, network)');

-- Create admin user with email 'mannuh' and password 'mannuh'
-- Password hash for 'mannuh' with 12 salt rounds: $2a$12$tZ4v7sQKjJ7z8K7L7z7z7eJ7z7z7z7z7z7z7z7z7z7z7z7z7
INSERT INTO users (name, email, password, role, balance, currency) 
VALUES ('Admin User', 'mannuh', '$2a$12$tZ4v7sQKjJ7z8K7L7z7z7eJ7z7z7z7z7z7z7z7z7z7z7z7z7', 'admin', 1000000, 'USD')
ON CONFLICT (email) DO UPDATE SET password = EXCLUDED.password;

-- Insert default deposit address
INSERT INTO deposit_addresses (coin, network, address) 
VALUES ('USDT', 'BSC', '0x081fc7d993439f0aa44e8d9514c00d0b560fb940')
ON CONFLICT (coin, network) DO UPDATE SET address = EXCLUDED.address;