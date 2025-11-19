-- =====================================================
-- RAILWAY DATABASE SETUP SCRIPT
-- Run this ONCE on your Railway PostgreSQL database
-- =====================================================

-- =====================================================
-- 1. BOT SETTINGS TABLE (MISSING FROM SCHEMA)
-- =====================================================
CREATE TABLE IF NOT EXISTS bot_settings (
    id SERIAL PRIMARY KEY,
    fee_percentage DECIMAL(5, 4) DEFAULT 0.0050,
    fee_wallet_address VARCHAR(100),
    referral_percentage DECIMAL(5, 4) DEFAULT 0.5000,
    min_trade_amount DECIMAL(20, 9) DEFAULT 0.01,
    max_trade_amount DECIMAL(20, 9),
    enabled BOOLEAN DEFAULT TRUE,
    maintenance_mode BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default bot settings
INSERT INTO bot_settings (
    fee_percentage,
    fee_wallet_address,
    referral_percentage,
    min_trade_amount,
    enabled,
    maintenance_mode
) VALUES (
    0.0050,  -- 0.5% trading fee
    '',      -- Will be set via environment variable
    0.5000,  -- 50% referral commission
    0.01,    -- Minimum trade 0.01 SOL
    TRUE,
    FALSE
) ON CONFLICT DO NOTHING;

-- =====================================================
-- 2. CORE TABLES FROM schema.sql
-- =====================================================

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
    onboarding_completed BOOLEAN DEFAULT FALSE,
    current_chain VARCHAR(20) DEFAULT 'solana',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Wallets table (encrypted private keys)
CREATE TABLE IF NOT EXISTS wallets (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    public_key VARCHAR(100) UNIQUE NOT NULL,
    encrypted_private_key TEXT NOT NULL,
    chain VARCHAR(20) DEFAULT 'solana',
    wallet_type VARCHAR(20) DEFAULT 'generated',
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
    signature VARCHAR(200) UNIQUE,
    from_token VARCHAR(100),
    to_token VARCHAR(100),
    from_amount DECIMAL(30, 9),
    to_amount DECIMAL(30, 9),
    fee_amount DECIMAL(30, 9) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'pending',
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Fees collected table
CREATE TABLE IF NOT EXISTS fees_collected (
    id SERIAL PRIMARY KEY,
    transaction_id INTEGER REFERENCES transactions(id),
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    fee_amount DECIMAL(30, 9) NOT NULL,
    fee_type VARCHAR(20) DEFAULT 'trading',
    token_mint VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Referrals table
CREATE TABLE IF NOT EXISTS referrals (
    id SERIAL PRIMARY KEY,
    referrer_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    referred_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    reward_amount DECIMAL(30, 9) DEFAULT 0,
    reward_paid BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(referrer_id, referred_id)
);

-- Token cache table (for metadata and prices)
CREATE TABLE IF NOT EXISTS token_cache (
    id SERIAL PRIMARY KEY,
    mint_address VARCHAR(100) UNIQUE NOT NULL,
    symbol VARCHAR(20),
    name VARCHAR(100),
    decimals INTEGER,
    price_usd DECIMAL(30, 9),
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Orders table (for limit orders)
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    wallet_id INTEGER REFERENCES wallets(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    order_type VARCHAR(20) NOT NULL,
    from_token VARCHAR(100),
    to_token VARCHAR(100),
    amount DECIMAL(30, 9),
    target_price DECIMAL(30, 9),
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    executed_at TIMESTAMP
);

-- DCA jobs table
CREATE TABLE IF NOT EXISTS dca_jobs (
    id SERIAL PRIMARY KEY,
    wallet_id INTEGER REFERENCES wallets(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    from_token VARCHAR(100),
    to_token VARCHAR(100),
    amount DECIMAL(30, 9),
    frequency VARCHAR(20),
    next_execution TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 3. REFERRAL & ADMIN TABLES (Migration 001)
-- =====================================================

-- Referral accounts table
CREATE TABLE IF NOT EXISTS referral_accounts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    referral_code VARCHAR(20) UNIQUE NOT NULL,
    rewards_wallet_id INTEGER REFERENCES wallets(id),
    last_link_update_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Referral links table
CREATE TABLE IF NOT EXISTS referral_links (
    id SERIAL PRIMARY KEY,
    referral_account_id INTEGER NOT NULL REFERENCES referral_accounts(id) ON DELETE CASCADE,
    invite_code VARCHAR(50) UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Referral edges table
CREATE TABLE IF NOT EXISTS referral_edges (
    id SERIAL PRIMARY KEY,
    referrer_account_id INTEGER NOT NULL REFERENCES referral_accounts(id) ON DELETE CASCADE,
    referred_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    layer SMALLINT NOT NULL CHECK(layer >= 1 AND layer <= 3),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(referrer_account_id, referred_user_id, layer)
);

-- Referral rewards table
CREATE TABLE IF NOT EXISTS referral_rewards (
    id SERIAL PRIMARY KEY,
    referral_edge_id INTEGER REFERENCES referral_edges(id) ON DELETE SET NULL,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reward_type VARCHAR(20) NOT NULL CHECK(reward_type IN ('tier', 'cashback')),
    layer SMALLINT CHECK(layer >= 1 AND layer <= 3),
    transaction_id INTEGER REFERENCES transactions(id),
    trade_volume NUMERIC(30, 9) DEFAULT 0,
    reward_amount NUMERIC(30, 9) NOT NULL,
    reward_status VARCHAR(20) NOT NULL DEFAULT 'pending',
    reward_period_start TIMESTAMP,
    reward_period_end TIMESTAMP,
    paid_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Reward wallet balances table
CREATE TABLE IF NOT EXISTS reward_wallet_balances (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    total_paid NUMERIC(30, 9) DEFAULT 0,
    total_unpaid NUMERIC(30, 9) DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Reward payout batches table
CREATE TABLE IF NOT EXISTS reward_payout_batches (
    id SERIAL PRIMARY KEY,
    triggered_by VARCHAR(20) NOT NULL CHECK(triggered_by IN ('cron', 'admin')),
    admin_id INTEGER REFERENCES admin_users(id),
    period_start TIMESTAMP NOT NULL,
    period_end TIMESTAMP NOT NULL,
    total_rewards NUMERIC(30, 9) DEFAULT 0,
    total_users INTEGER DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

-- Watchlist tokens table
CREATE TABLE IF NOT EXISTS watchlist_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    chain VARCHAR(20) NOT NULL,
    token_address VARCHAR(100) NOT NULL,
    token_name VARCHAR(100),
    token_symbol VARCHAR(20),
    source_url TEXT,
    metadata JSONB,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, chain, token_address)
);

-- Admin settings table
CREATE TABLE IF NOT EXISTS admin_settings (
    id SERIAL PRIMARY KEY,
    namespace VARCHAR(50) UNIQUE NOT NULL,
    settings JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Admin setting audits table
CREATE TABLE IF NOT EXISTS admin_setting_audits (
    id SERIAL PRIMARY KEY,
    admin_id INTEGER REFERENCES admin_users(id),
    namespace VARCHAR(50) NOT NULL,
    old_value JSONB,
    new_value JSONB,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 4. CREATE INDEXES FOR PERFORMANCE
-- =====================================================

-- Core indexes
CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id);
CREATE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code);
CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_wallets_public_key ON wallets(public_key);
CREATE INDEX IF NOT EXISTS idx_wallets_user_chain ON wallets(user_id, chain) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_transactions_wallet_id ON transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_transactions_signature ON transactions(signature);
CREATE INDEX IF NOT EXISTS idx_token_cache_mint ON token_cache(mint_address);
CREATE INDEX IF NOT EXISTS idx_admin_users_telegram_id ON admin_users(telegram_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_fees_user ON fees_collected(user_id);

-- Referral system indexes
CREATE INDEX IF NOT EXISTS idx_referral_accounts_user ON referral_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_referral_links_account ON referral_links(referral_account_id);
CREATE INDEX IF NOT EXISTS idx_referral_links_code ON referral_links(invite_code);
CREATE INDEX IF NOT EXISTS idx_referral_edges_referrer ON referral_edges(referrer_account_id);
CREATE INDEX IF NOT EXISTS idx_referral_edges_referred ON referral_edges(referred_user_id);
CREATE INDEX IF NOT EXISTS idx_referral_rewards_user ON referral_rewards(user_id);
CREATE INDEX IF NOT EXISTS idx_referral_rewards_status ON referral_rewards(reward_status);
CREATE INDEX IF NOT EXISTS idx_reward_balances_user ON reward_wallet_balances(user_id);
CREATE INDEX IF NOT EXISTS idx_payout_batches_status ON reward_payout_batches(status);

-- Watchlist indexes
CREATE INDEX IF NOT EXISTS idx_watchlist_user ON watchlist_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_chain ON watchlist_tokens(chain);
CREATE INDEX IF NOT EXISTS idx_watchlist_user_chain ON watchlist_tokens(user_id, chain);

-- Admin settings indexes
CREATE INDEX IF NOT EXISTS idx_admin_settings_namespace ON admin_settings(namespace);
CREATE INDEX IF NOT EXISTS idx_admin_audits_namespace ON admin_setting_audits(namespace);
CREATE INDEX IF NOT EXISTS idx_admin_audits_updated ON admin_setting_audits(updated_at DESC);

-- =====================================================
-- 5. INSERT DEFAULT ADMIN SETTINGS
-- =====================================================

INSERT INTO admin_settings (namespace, settings)
VALUES (
    'withdrawal_settings',
    '{"enabled": true, "min_amount": 0.01, "max_amount": 100, "fee_percent": 0, "whitelist_addresses": []}'::jsonb
) ON CONFLICT (namespace) DO NOTHING;

INSERT INTO admin_settings (namespace, settings)
VALUES (
    'referral_settings',
    '{"enabled": true, "layer_1_percent": 15, "layer_2_percent": 10, "layer_3_percent": 7, "cashback_percent": 25, "min_eligibility_sol": 0.005, "payout_frequency_hours": 12}'::jsonb
) ON CONFLICT (namespace) DO NOTHING;

INSERT INTO admin_settings (namespace, settings)
VALUES (
    'airdrop_settings',
    '{"enabled": false, "amount_per_user": 0.1, "eligibility_criteria": {"min_trades": 1}, "schedule_cron": "0 0 * * *", "last_run_at": null}'::jsonb
) ON CONFLICT (namespace) DO NOTHING;

INSERT INTO admin_settings (namespace, settings)
VALUES (
    'payout_settings',
    '{"auto_payout_enabled": true, "treasury_wallet": null, "min_payout_amount": 0.001}'::jsonb
) ON CONFLICT (namespace) DO NOTHING;

-- =====================================================
-- SETUP COMPLETE!
-- =====================================================
SELECT 'Railway Database Setup Complete!' AS status;
SELECT COUNT(*) AS total_tables FROM information_schema.tables WHERE table_schema = 'public';
