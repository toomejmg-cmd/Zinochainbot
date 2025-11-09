-- Expand user_settings table with comprehensive trading and AI settings
-- Migration 002: Add AI trader, security, and advanced settings

-- Add columns if they don't exist
DO $$ 
BEGIN
    -- Trading Settings
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_settings' AND column_name='priority_fee_mode') THEN
        ALTER TABLE user_settings ADD COLUMN priority_fee_mode VARCHAR(20) DEFAULT 'auto';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_settings' AND column_name='max_trade_amount') THEN
        ALTER TABLE user_settings ADD COLUMN max_trade_amount DECIMAL(20, 9);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_settings' AND column_name='default_buy_amount') THEN
        ALTER TABLE user_settings ADD COLUMN default_buy_amount DECIMAL(20, 9) DEFAULT 1.0;
    END IF;
    
    -- AI Trader Settings
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_settings' AND column_name='trading_mode') THEN
        ALTER TABLE user_settings ADD COLUMN trading_mode VARCHAR(20) DEFAULT 'manual';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_settings' AND column_name='ai_risk_level') THEN
        ALTER TABLE user_settings ADD COLUMN ai_risk_level VARCHAR(20) DEFAULT 'balanced';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_settings' AND column_name='ai_max_trade_size') THEN
        ALTER TABLE user_settings ADD COLUMN ai_max_trade_size DECIMAL(20, 9) DEFAULT 1.0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_settings' AND column_name='ai_daily_budget') THEN
        ALTER TABLE user_settings ADD COLUMN ai_daily_budget DECIMAL(20, 9) DEFAULT 5.0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_settings' AND column_name='ai_stop_loss_percent') THEN
        ALTER TABLE user_settings ADD COLUMN ai_stop_loss_percent INTEGER DEFAULT 20;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_settings' AND column_name='ai_strategy') THEN
        ALTER TABLE user_settings ADD COLUMN ai_strategy VARCHAR(20) DEFAULT 'balanced';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_settings' AND column_name='ai_require_confirmation') THEN
        ALTER TABLE user_settings ADD COLUMN ai_require_confirmation VARCHAR(20) DEFAULT 'large_trades';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_settings' AND column_name='ai_show_reasoning') THEN
        ALTER TABLE user_settings ADD COLUMN ai_show_reasoning BOOLEAN DEFAULT TRUE;
    END IF;
    
    -- Security & Privacy
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_settings' AND column_name='mev_protection') THEN
        ALTER TABLE user_settings ADD COLUMN mev_protection BOOLEAN DEFAULT TRUE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_settings' AND column_name='anti_rug_detection') THEN
        ALTER TABLE user_settings ADD COLUMN anti_rug_detection BOOLEAN DEFAULT TRUE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_settings' AND column_name='transaction_confirmations') THEN
        ALTER TABLE user_settings ADD COLUMN transaction_confirmations VARCHAR(20) DEFAULT 'smart';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_settings' AND column_name='wallet_backup_reminder') THEN
        ALTER TABLE user_settings ADD COLUMN wallet_backup_reminder VARCHAR(20) DEFAULT 'weekly';
    END IF;
    
    -- Notifications
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_settings' AND column_name='trade_alerts') THEN
        ALTER TABLE user_settings ADD COLUMN trade_alerts BOOLEAN DEFAULT TRUE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_settings' AND column_name='price_alerts') THEN
        ALTER TABLE user_settings ADD COLUMN price_alerts BOOLEAN DEFAULT TRUE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_settings' AND column_name='ai_trade_alerts') THEN
        ALTER TABLE user_settings ADD COLUMN ai_trade_alerts BOOLEAN DEFAULT TRUE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_settings' AND column_name='referral_alerts') THEN
        ALTER TABLE user_settings ADD COLUMN referral_alerts BOOLEAN DEFAULT TRUE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_settings' AND column_name='portfolio_summary') THEN
        ALTER TABLE user_settings ADD COLUMN portfolio_summary VARCHAR(20) DEFAULT 'weekly';
    END IF;
    
    -- Display & Preferences
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_settings' AND column_name='default_chain') THEN
        ALTER TABLE user_settings ADD COLUMN default_chain VARCHAR(20) DEFAULT 'solana';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_settings' AND column_name='currency_display') THEN
        ALTER TABLE user_settings ADD COLUMN currency_display VARCHAR(10) DEFAULT 'USD';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_settings' AND column_name='hide_small_balances') THEN
        ALTER TABLE user_settings ADD COLUMN hide_small_balances BOOLEAN DEFAULT FALSE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_settings' AND column_name='language') THEN
        ALTER TABLE user_settings ADD COLUMN language VARCHAR(10) DEFAULT 'en';
    END IF;
    
    -- Advanced
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_settings' AND column_name='custom_rpc_solana') THEN
        ALTER TABLE user_settings ADD COLUMN custom_rpc_solana TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_settings' AND column_name='custom_rpc_ethereum') THEN
        ALTER TABLE user_settings ADD COLUMN custom_rpc_ethereum TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_settings' AND column_name='custom_rpc_bsc') THEN
        ALTER TABLE user_settings ADD COLUMN custom_rpc_bsc TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_settings' AND column_name='transaction_speed') THEN
        ALTER TABLE user_settings ADD COLUMN transaction_speed VARCHAR(20) DEFAULT 'normal';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_settings' AND column_name='debug_mode') THEN
        ALTER TABLE user_settings ADD COLUMN debug_mode BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- Add comments to describe the table
COMMENT ON TABLE user_settings IS 'Comprehensive user trading preferences and AI settings';
COMMENT ON COLUMN user_settings.trading_mode IS 'manual or ai - determines who controls trades';
COMMENT ON COLUMN user_settings.ai_risk_level IS 'conservative, balanced, or aggressive';
COMMENT ON COLUMN user_settings.slippage_bps IS 'Slippage tolerance in basis points (100 = 1%)';
