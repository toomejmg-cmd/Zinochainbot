-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    telegram_id BIGINT UNIQUE NOT NULL,
    username VARCHAR(255),
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    referral_code VARCHAR(20) UNIQUE,
    referred_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Admin users table
CREATE TABLE IF NOT EXISTS admin_users (
    id SERIAL PRIMARY KEY,
    telegram_id BIGINT UNIQUE NOT NULL,
    role VARCHAR(20) DEFAULT 'admin',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User settings table
CREATE TABLE IF NOT EXISTS user_settings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    slippage_bps INTEGER DEFAULT 100,
    notifications_enabled BOOLEAN DEFAULT TRUE,
    auto_approve_trades BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Wallets table (encrypted private keys)
CREATE TABLE IF NOT EXISTS wallets (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    public_key VARCHAR(44) UNIQUE NOT NULL,
    encrypted_private_key TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, public_key)
);

-- Transactions table
CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    wallet_id INTEGER REFERENCES wallets(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    transaction_type VARCHAR(20) NOT NULL,
    signature VARCHAR(88) UNIQUE,
    from_token VARCHAR(44),
    to_token VARCHAR(44),
    from_amount DECIMAL(20, 9),
    to_amount DECIMAL(20, 9),
    fee_amount DECIMAL(20, 9) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'pending',
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Fees collected table
CREATE TABLE IF NOT EXISTS fees_collected (
    id SERIAL PRIMARY KEY,
    transaction_id INTEGER REFERENCES transactions(id),
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    fee_amount DECIMAL(20, 9) NOT NULL,
    fee_type VARCHAR(20) DEFAULT 'trading',
    token_mint VARCHAR(44),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Referrals table
CREATE TABLE IF NOT EXISTS referrals (
    id SERIAL PRIMARY KEY,
    referrer_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    referred_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    reward_amount DECIMAL(20, 9) DEFAULT 0,
    reward_paid BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(referrer_id, referred_id)
);

-- Token cache table (for metadata and prices)
CREATE TABLE IF NOT EXISTS token_cache (
    id SERIAL PRIMARY KEY,
    mint_address VARCHAR(44) UNIQUE NOT NULL,
    symbol VARCHAR(20),
    name VARCHAR(100),
    decimals INTEGER,
    price_usd DECIMAL(20, 9),
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Orders table (for limit orders - future phase)
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    wallet_id INTEGER REFERENCES wallets(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    order_type VARCHAR(20) NOT NULL,
    from_token VARCHAR(44),
    to_token VARCHAR(44),
    amount DECIMAL(20, 9),
    target_price DECIMAL(20, 9),
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    executed_at TIMESTAMP
);

-- DCA jobs table (for recurring purchases - future phase)
CREATE TABLE IF NOT EXISTS dca_jobs (
    id SERIAL PRIMARY KEY,
    wallet_id INTEGER REFERENCES wallets(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    from_token VARCHAR(44),
    to_token VARCHAR(44),
    amount DECIMAL(20, 9),
    frequency VARCHAR(20),
    next_execution TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Jupiter tokens table (synced from Jupiter API)
CREATE TABLE IF NOT EXISTS jupiter_tokens (
    id SERIAL PRIMARY KEY,
    mint_address VARCHAR(44) UNIQUE NOT NULL,
    symbol VARCHAR(50) NOT NULL,
    name VARCHAR(255),
    decimals INTEGER,
    chain VARCHAR(20) DEFAULT 'solana',
    logo_uri TEXT,
    tags TEXT[],
    last_synced TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id);
CREATE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code);
CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_wallets_public_key ON wallets(public_key);
CREATE INDEX IF NOT EXISTS idx_transactions_wallet_id ON transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_transactions_signature ON transactions(signature);
CREATE INDEX IF NOT EXISTS idx_token_cache_mint ON token_cache(mint_address);
CREATE INDEX IF NOT EXISTS idx_admin_users_telegram_id ON admin_users(telegram_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_fees_user ON fees_collected(user_id);
CREATE INDEX IF NOT EXISTS idx_jupiter_tokens_symbol ON jupiter_tokens(symbol);
CREATE INDEX IF NOT EXISTS idx_jupiter_tokens_mint ON jupiter_tokens(mint_address);
