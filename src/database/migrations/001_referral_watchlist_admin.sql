-- =====================================================
-- MIGRATION 001: Referral System, Watchlist, Admin Settings
-- =====================================================

-- =====================================================
-- 1. MULTI-CHAIN WALLET SUPPORT
-- =====================================================
-- Extend wallets table to support multiple chains
ALTER TABLE wallets 
ADD COLUMN IF NOT EXISTS chain VARCHAR(20) DEFAULT 'solana',
ADD COLUMN IF NOT EXISTS wallet_type VARCHAR(20) DEFAULT 'generated';

-- Update existing wallets to be Solana wallets
UPDATE wallets SET chain = 'solana', wallet_type = 'generated' WHERE chain IS NULL;

-- Create unique constraint for user+chain combination
CREATE UNIQUE INDEX IF NOT EXISTS idx_wallets_user_chain ON wallets(user_id, chain) WHERE is_active = true;

-- =====================================================
-- 2. REFERRAL SYSTEM TABLES
-- =====================================================

-- Referral accounts table (one per user)
CREATE TABLE IF NOT EXISTS referral_accounts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    referral_code VARCHAR(20) UNIQUE NOT NULL,
    rewards_wallet_id INTEGER REFERENCES wallets(id),
    last_link_update_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Referral links table (supports multiple invite codes per user)
CREATE TABLE IF NOT EXISTS referral_links (
    id SERIAL PRIMARY KEY,
    referral_account_id INTEGER NOT NULL REFERENCES referral_accounts(id) ON DELETE CASCADE,
    invite_code VARCHAR(50) UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Referral edges table (tracks referral relationships with layers)
CREATE TABLE IF NOT EXISTS referral_edges (
    id SERIAL PRIMARY KEY,
    referrer_account_id INTEGER NOT NULL REFERENCES referral_accounts(id) ON DELETE CASCADE,
    referred_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    layer SMALLINT NOT NULL CHECK(layer >= 1 AND layer <= 3),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(referrer_account_id, referred_user_id, layer)
);

-- Referral rewards table (tracks all rewards - tier rewards and cashback)
CREATE TABLE IF NOT EXISTS referral_rewards (
    id SERIAL PRIMARY KEY,
    referral_edge_id INTEGER REFERENCES referral_edges(id) ON DELETE SET NULL,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reward_type VARCHAR(20) NOT NULL CHECK(reward_type IN ('tier', 'cashback')),
    layer SMALLINT CHECK(layer >= 1 AND layer <= 3),
    transaction_id INTEGER REFERENCES transactions(id),
    trade_volume NUMERIC(30, 9) DEFAULT 0,
    reward_amount NUMERIC(30, 9) NOT NULL,
    reward_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK(reward_status IN ('pending', 'queued', 'paid', 'failed')),
    reward_period_start TIMESTAMP,
    reward_period_end TIMESTAMP,
    paid_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Reward wallet balances table (aggregated view of user rewards)
CREATE TABLE IF NOT EXISTS reward_wallet_balances (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    total_paid NUMERIC(30, 9) DEFAULT 0,
    total_unpaid NUMERIC(30, 9) DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Reward payout batches table (tracks automated and manual payout runs)
CREATE TABLE IF NOT EXISTS reward_payout_batches (
    id SERIAL PRIMARY KEY,
    triggered_by VARCHAR(20) NOT NULL CHECK(triggered_by IN ('cron', 'admin')),
    admin_id INTEGER REFERENCES admin_users(id),
    period_start TIMESTAMP NOT NULL,
    period_end TIMESTAMP NOT NULL,
    total_rewards NUMERIC(30, 9) DEFAULT 0,
    total_users INTEGER DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'completed', 'failed')),
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

-- =====================================================
-- 3. WATCHLIST TABLES
-- =====================================================

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

-- =====================================================
-- 4. ADMIN SETTINGS TABLES
-- =====================================================

-- Admin settings table (namespace-based configuration storage)
CREATE TABLE IF NOT EXISTS admin_settings (
    id SERIAL PRIMARY KEY,
    namespace VARCHAR(50) UNIQUE NOT NULL,
    settings JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Admin setting audits table (tracks changes to settings)
CREATE TABLE IF NOT EXISTS admin_setting_audits (
    id SERIAL PRIMARY KEY,
    admin_id INTEGER REFERENCES admin_users(id),
    namespace VARCHAR(50) NOT NULL,
    old_value JSONB,
    new_value JSONB,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 5. INDEXES FOR PERFORMANCE
-- =====================================================

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
-- 6. DATA MIGRATION FROM LEGACY REFERRAL SYSTEM
-- =====================================================

-- Backfill referral_accounts from existing users
INSERT INTO referral_accounts (user_id, referral_code, created_at)
SELECT 
    id, 
    COALESCE(referral_code, 'ref-' || telegram_id),
    created_at
FROM users
ON CONFLICT (user_id) DO NOTHING;

-- Update users.referral_code if NULL
UPDATE users 
SET referral_code = 'ref-' || telegram_id 
WHERE referral_code IS NULL;

-- Create initial referral_links for each account
INSERT INTO referral_links (referral_account_id, invite_code, created_at)
SELECT 
    ra.id,
    ra.referral_code,
    ra.created_at
FROM referral_accounts ra
ON CONFLICT (invite_code) DO NOTHING;

-- Backfill referral_edges from users.referred_by (Layer 1 only)
INSERT INTO referral_edges (referrer_account_id, referred_user_id, layer, created_at)
SELECT 
    ra.id,
    u.id,
    1,
    u.created_at
FROM users u
INNER JOIN referral_accounts ra ON ra.user_id = u.referred_by
WHERE u.referred_by IS NOT NULL
ON CONFLICT (referred_user_id) DO NOTHING;

-- Initialize reward_wallet_balances for all users
INSERT INTO reward_wallet_balances (user_id, total_paid, total_unpaid)
SELECT 
    id,
    0,
    0
FROM users
ON CONFLICT (user_id) DO NOTHING;

-- =====================================================
-- 7. DEFAULT ADMIN SETTINGS
-- =====================================================

-- Withdrawal settings
INSERT INTO admin_settings (namespace, settings)
VALUES (
    'withdrawal_settings',
    '{"enabled": true, "min_amount": 0.01, "max_amount": 100, "fee_percent": 0, "whitelist_addresses": []}'::jsonb
) ON CONFLICT (namespace) DO NOTHING;

-- Referral settings (Layer 1: 15%, Layer 2: 10%, Layer 3: 7%, Cashback: 25%)
INSERT INTO admin_settings (namespace, settings)
VALUES (
    'referral_settings',
    '{"enabled": true, "layer_1_percent": 15, "layer_2_percent": 10, "layer_3_percent": 7, "cashback_percent": 25, "min_eligibility_sol": 0.005, "payout_frequency_hours": 12}'::jsonb
) ON CONFLICT (namespace) DO NOTHING;

-- Airdrop settings
INSERT INTO admin_settings (namespace, settings)
VALUES (
    'airdrop_settings',
    '{"enabled": false, "amount_per_user": 0.1, "eligibility_criteria": {"min_trades": 1}, "schedule_cron": "0 0 * * *", "last_run_at": null}'::jsonb
) ON CONFLICT (namespace) DO NOTHING;

-- Payout settings
INSERT INTO admin_settings (namespace, settings)
VALUES (
    'payout_settings',
    '{"auto_payout_enabled": true, "treasury_wallet": null, "min_payout_amount": 0.001}'::jsonb
) ON CONFLICT (namespace) DO NOTHING;

-- =====================================================
-- 8. TRIGGERS FOR UPDATED_AT TIMESTAMPS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to relevant tables
DROP TRIGGER IF EXISTS update_referral_accounts_updated_at ON referral_accounts;
CREATE TRIGGER update_referral_accounts_updated_at
    BEFORE UPDATE ON referral_accounts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_admin_settings_updated_at ON admin_settings;
CREATE TRIGGER update_admin_settings_updated_at
    BEFORE UPDATE ON admin_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_reward_balances_updated_at ON reward_wallet_balances;
CREATE TRIGGER update_reward_balances_updated_at
    BEFORE UPDATE ON reward_wallet_balances
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE referral_accounts IS 'Stores referral account metadata for each user';
COMMENT ON TABLE referral_links IS 'Stores active and historical referral invite codes';
COMMENT ON TABLE referral_edges IS 'Tracks referrer-referred relationships with layer depth';
COMMENT ON TABLE referral_rewards IS 'Records all referral and cashback rewards with payout status';
COMMENT ON TABLE reward_wallet_balances IS 'Aggregated paid/unpaid reward balances per user';
COMMENT ON TABLE reward_payout_batches IS 'History of automated and manual reward distribution runs';
COMMENT ON TABLE watchlist_tokens IS 'User watchlist tokens across all supported chains';
COMMENT ON TABLE admin_settings IS 'System-wide admin configuration stored as JSONB by namespace';
COMMENT ON TABLE admin_setting_audits IS 'Audit trail for all admin setting changes';
