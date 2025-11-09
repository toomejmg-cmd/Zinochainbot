import { query } from '../database/db';

interface BotSettings {
  id: number;
  fee_wallet_address: string;
  fee_percentage: number;
  referral_percentage: number;
  min_trade_amount: number;
  max_trade_amount: number | null;
  enabled: boolean;
  maintenance_mode: boolean;
  allow_new_registrations: boolean;
  withdrawal_wallet_address: string | null;
  withdrawal_fee_percentage: number;
  min_withdrawal_amount: number;
  max_withdrawal_amount: number | null;
  daily_withdrawal_limit: number | null;
  monthly_withdrawal_limit: number | null;
  withdrawal_requires_approval: boolean;
  auto_collect_fees: boolean;
  daily_trade_limit_per_user: number | null;
  max_trade_size_per_transaction: number | null;
  max_active_orders_per_user: number;
  max_wallets_per_user: number;
  trade_cooldown_seconds: number;
  suspicious_activity_threshold: number;
  require_2fa: boolean;
  auto_lock_suspicious_accounts: boolean;
  notify_on_suspicious_activity: boolean;
  notify_on_large_trades: boolean;
  max_failed_login_attempts: number;
  large_trade_threshold_sol: number;
  admin_notification_email: string | null;
  admin_notification_telegram_id: number | null;
  solana_rpc_endpoint: string;
  solana_backup_rpc_endpoint: string | null;
  ethereum_rpc_endpoint: string | null;
  bsc_rpc_endpoint: string | null;
  api_rate_limit_per_minute: number;
  global_max_slippage_bps: number;
  global_min_slippage_bps: number;
  min_priority_fee_lamports: number;
  max_priority_fee_lamports: number;
  max_consecutive_errors: number;
  enable_mev_protection: boolean;
  auto_restart_on_error: boolean;
  emergency_stop: boolean;
  emergency_stop_reason: string | null;
  updated_at: Date;
  updated_by: number | null;
}

let cachedSettings: BotSettings | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL_MS = 5000; // 5 seconds cache

export async function getBotSettings(): Promise<BotSettings> {
  const now = Date.now();
  
  if (cachedSettings && (now - cacheTimestamp) < CACHE_TTL_MS) {
    return cachedSettings;
  }

  const result = await query('SELECT * FROM bot_settings ORDER BY id DESC LIMIT 1');
  
  if (result.rows.length === 0) {
    throw new Error('Bot settings not found. Please configure the bot via admin dashboard.');
  }

  cachedSettings = result.rows[0] as BotSettings;
  cacheTimestamp = now;
  
  return cachedSettings;
}

export function invalidateSettingsCache(): void {
  cachedSettings = null;
  cacheTimestamp = 0;
}

export async function checkEmergencyStop(): Promise<void> {
  const settings = await getBotSettings();
  
  if (settings.emergency_stop) {
    const reason = settings.emergency_stop_reason || 'Emergency stop activated';
    throw new Error(`🚨 EMERGENCY STOP: ${reason}`);
  }
}

export async function checkMaintenanceMode(): Promise<void> {
  const settings = await getBotSettings();
  
  if (settings.maintenance_mode) {
    throw new Error('⚠️ Bot is currently in maintenance mode. Please try again later.');
  }
}

export async function checkBotEnabled(): Promise<void> {
  const settings = await getBotSettings();
  
  if (!settings.enabled) {
    throw new Error('🔒 Trading is currently disabled. Contact support for more information.');
  }
}

export async function checkNewRegistrations(): Promise<void> {
  const settings = await getBotSettings();
  
  if (!settings.allow_new_registrations) {
    throw new Error('🚫 New user registrations are currently disabled.');
  }
}

export async function validateTradeAmount(amount: number): Promise<void> {
  const settings = await getBotSettings();
  
  if (amount < settings.min_trade_amount) {
    throw new Error(`Minimum trade amount is ${settings.min_trade_amount} SOL`);
  }
  
  if (settings.max_trade_amount && amount > settings.max_trade_amount) {
    throw new Error(`Maximum trade amount is ${settings.max_trade_amount} SOL`);
  }
  
  if (settings.max_trade_size_per_transaction && amount > settings.max_trade_size_per_transaction) {
    throw new Error(`Maximum transaction size is ${settings.max_trade_size_per_transaction} SOL`);
  }
}

export async function validateWithdrawalAmount(amount: number): Promise<void> {
  const settings = await getBotSettings();
  
  if (amount < settings.min_withdrawal_amount) {
    throw new Error(`Minimum withdrawal amount is ${settings.min_withdrawal_amount} SOL`);
  }
  
  if (settings.max_withdrawal_amount && amount > settings.max_withdrawal_amount) {
    throw new Error(`Maximum withdrawal amount is ${settings.max_withdrawal_amount} SOL`);
  }
}

export async function checkTradingAllowed(): Promise<void> {
  await checkEmergencyStop();
  await checkMaintenanceMode();
  await checkBotEnabled();
}

export async function getSlippageLimits(): Promise<{ min: number; max: number }> {
  const settings = await getBotSettings();
  
  return {
    min: settings.global_min_slippage_bps,
    max: settings.global_max_slippage_bps
  };
}

export async function getPriorityFeeLimits(): Promise<{ min: number; max: number }> {
  const settings = await getBotSettings();
  
  return {
    min: settings.min_priority_fee_lamports,
    max: settings.max_priority_fee_lamports
  };
}

export async function getRpcEndpoint(chain: 'solana' | 'ethereum' | 'bsc'): Promise<string> {
  const settings = await getBotSettings();
  
  switch (chain) {
    case 'solana':
      return settings.solana_rpc_endpoint;
    case 'ethereum':
      if (!settings.ethereum_rpc_endpoint) {
        throw new Error('Ethereum RPC endpoint not configured');
      }
      return settings.ethereum_rpc_endpoint;
    case 'bsc':
      if (!settings.bsc_rpc_endpoint) {
        throw new Error('BSC RPC endpoint not configured');
      }
      return settings.bsc_rpc_endpoint;
    default:
      throw new Error(`Unsupported chain: ${chain}`);
  }
}

export async function checkWithdrawalApprovalRequired(): Promise<boolean> {
  const settings = await getBotSettings();
  return settings.withdrawal_requires_approval;
}

export async function getFeeWalletAddress(): Promise<string> {
  const settings = await getBotSettings();
  return settings.fee_wallet_address;
}

export async function getFeePercentage(): Promise<number> {
  const settings = await getBotSettings();
  return settings.fee_percentage;
}

export async function getWithdrawalFeePercentage(): Promise<number> {
  const settings = await getBotSettings();
  return settings.withdrawal_fee_percentage;
}

export async function getReferralPercentage(): Promise<number> {
  const settings = await getBotSettings();
  return settings.referral_percentage;
}

export async function isMevProtectionEnabled(): Promise<boolean> {
  const settings = await getBotSettings();
  return settings.enable_mev_protection;
}

export async function checkSuspiciousActivity(amount: number): Promise<boolean> {
  const settings = await getBotSettings();
  return amount >= settings.suspicious_activity_threshold;
}

export async function checkLargeTrade(amount: number): Promise<boolean> {
  const settings = await getBotSettings();
  return amount >= settings.large_trade_threshold_sol;
}
