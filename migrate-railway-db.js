const { Client } = require('pg');

async function runMigration() {
  // Use Railway DATABASE_URL from environment
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    console.log('🔌 Connecting to Railway PostgreSQL database...');
    await client.connect();
    console.log('✅ Connected successfully!');

    console.log('🔄 Running migration to add missing bot_settings columns...');

    // Add all missing columns to bot_settings table
    const migrationSQL = `
      ALTER TABLE bot_settings 
      ADD COLUMN IF NOT EXISTS withdrawal_wallet_address VARCHAR(44),
      ADD COLUMN IF NOT EXISTS withdrawal_fee_percentage NUMERIC(5,2) DEFAULT 0.10,
      ADD COLUMN IF NOT EXISTS min_withdrawal_amount NUMERIC(20,9) DEFAULT 0.01,
      ADD COLUMN IF NOT EXISTS max_withdrawal_amount NUMERIC(20,9),
      ADD COLUMN IF NOT EXISTS daily_withdrawal_limit NUMERIC(20,9),
      ADD COLUMN IF NOT EXISTS monthly_withdrawal_limit NUMERIC(20,9),
      ADD COLUMN IF NOT EXISTS withdrawal_requires_approval BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS auto_withdrawal_threshold NUMERIC(20,9),
      ADD COLUMN IF NOT EXISTS daily_trade_limit_per_user NUMERIC(20,9),
      ADD COLUMN IF NOT EXISTS max_active_orders_per_user INTEGER DEFAULT 10,
      ADD COLUMN IF NOT EXISTS trade_cooldown_seconds INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS max_trade_size_per_transaction NUMERIC(20,9),
      ADD COLUMN IF NOT EXISTS admin_ip_whitelist TEXT[],
      ADD COLUMN IF NOT EXISTS require_2fa BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS suspicious_activity_threshold NUMERIC(20,9) DEFAULT 100.0,
      ADD COLUMN IF NOT EXISTS auto_lock_suspicious_accounts BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS max_failed_login_attempts INTEGER DEFAULT 5,
      ADD COLUMN IF NOT EXISTS solana_rpc_endpoint VARCHAR(255) DEFAULT 'https://api.devnet.solana.com',
      ADD COLUMN IF NOT EXISTS solana_backup_rpc_endpoint VARCHAR(255),
      ADD COLUMN IF NOT EXISTS ethereum_rpc_endpoint VARCHAR(255),
      ADD COLUMN IF NOT EXISTS bsc_rpc_endpoint VARCHAR(255),
      ADD COLUMN IF NOT EXISTS api_rate_limit_per_minute INTEGER DEFAULT 60,
      ADD COLUMN IF NOT EXISTS auto_collect_fees BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS auto_collect_schedule_hours INTEGER DEFAULT 24,
      ADD COLUMN IF NOT EXISTS min_balance_for_auto_collect NUMERIC(20,9) DEFAULT 1.0,
      ADD COLUMN IF NOT EXISTS fee_collection_wallet_rotation BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS max_wallets_per_user INTEGER DEFAULT 5,
      ADD COLUMN IF NOT EXISTS require_kyc_above_limit NUMERIC(20,9),
      ADD COLUMN IF NOT EXISTS new_user_cooldown_hours INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS allow_new_registrations BOOLEAN DEFAULT true,
      ADD COLUMN IF NOT EXISTS global_max_slippage_bps INTEGER DEFAULT 5000,
      ADD COLUMN IF NOT EXISTS global_min_slippage_bps INTEGER DEFAULT 10,
      ADD COLUMN IF NOT EXISTS max_gas_price_gwei NUMERIC(20,9),
      ADD COLUMN IF NOT EXISTS enable_mev_protection BOOLEAN DEFAULT true,
      ADD COLUMN IF NOT EXISTS min_priority_fee_lamports BIGINT DEFAULT 1000,
      ADD COLUMN IF NOT EXISTS max_priority_fee_lamports BIGINT DEFAULT 1000000,
      ADD COLUMN IF NOT EXISTS admin_notification_email VARCHAR(255),
      ADD COLUMN IF NOT EXISTS admin_notification_telegram_id BIGINT,
      ADD COLUMN IF NOT EXISTS notify_on_large_trades BOOLEAN DEFAULT true,
      ADD COLUMN IF NOT EXISTS large_trade_threshold_sol NUMERIC(20,9) DEFAULT 10.0,
      ADD COLUMN IF NOT EXISTS notify_on_suspicious_activity BOOLEAN DEFAULT true,
      ADD COLUMN IF NOT EXISTS emergency_stop BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS emergency_stop_reason TEXT,
      ADD COLUMN IF NOT EXISTS last_health_check TIMESTAMP,
      ADD COLUMN IF NOT EXISTS auto_restart_on_error BOOLEAN DEFAULT true,
      ADD COLUMN IF NOT EXISTS max_consecutive_errors INTEGER DEFAULT 10,
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    `;

    await client.query(migrationSQL);
    console.log('✅ Migration completed successfully!');

    // Verify columns were added
    console.log('\n🔍 Verifying bot_settings table structure...');
    const result = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'bot_settings'
      ORDER BY ordinal_position;
    `);

    console.log(`✅ bot_settings table now has ${result.rows.length} columns:`);
    console.log(result.rows.map(r => `  - ${r.column_name}`).join('\n'));

    console.log('\n🎉 Database migration complete! You can now save settings in the Admin Dashboard.');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Error details:', error);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n🔌 Database connection closed.');
  }
}

runMigration();
