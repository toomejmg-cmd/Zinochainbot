import { query } from '../database/db';

export interface UserSettings {
  id: number;
  userId: number;
  // Trading Settings
  slippageBps: number;
  priorityFeeMode: string;
  maxTradeAmount: number | null;
  defaultBuyAmount: number;
  autoApproveTrades: boolean;
  
  // AI Trader Settings
  tradingMode: 'manual' | 'ai';
  aiRiskLevel: 'conservative' | 'balanced' | 'aggressive';
  aiMaxTradeSize: number;
  aiDailyBudget: number;
  aiStopLossPercent: number;
  aiStrategy: string;
  aiRequireConfirmation: 'always' | 'large_trades' | 'never';
  aiShowReasoning: boolean;
  
  // Security & Privacy
  mevProtection: boolean;
  antiRugDetection: boolean;
  transactionConfirmations: string;
  walletBackupReminder: string;
  
  // Notifications
  notificationsEnabled: boolean;
  tradeAlerts: boolean;
  priceAlerts: boolean;
  aiTradeAlerts: boolean;
  referralAlerts: boolean;
  portfolioSummary: string;
  
  // Display & Preferences
  defaultChain: string;
  currencyDisplay: string;
  hideSmallBalances: boolean;
  language: string;
  
  // Advanced
  customRpcSolana: string | null;
  customRpcEthereum: string | null;
  customRpcBsc: string | null;
  transactionSpeed: string;
  debugMode: boolean;
}

export class UserSettingsService {
  /**
   * Get user settings, creating defaults if they don't exist
   */
  async getSettings(userId: number): Promise<UserSettings> {
    const result = await query(
      `SELECT * FROM user_settings WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return await this.createDefaultSettings(userId);
    }

    return this.mapRowToSettings(result.rows[0]);
  }

  /**
   * Create default settings for a new user
   */
  async createDefaultSettings(userId: number): Promise<UserSettings> {
    const result = await query(
      `INSERT INTO user_settings (
        user_id,
        slippage_bps,
        priority_fee_mode,
        default_buy_amount,
        auto_approve_trades,
        trading_mode,
        ai_risk_level,
        ai_max_trade_size,
        ai_daily_budget,
        ai_stop_loss_percent,
        ai_strategy,
        ai_require_confirmation,
        ai_show_reasoning,
        mev_protection,
        anti_rug_detection,
        transaction_confirmations,
        wallet_backup_reminder,
        notifications_enabled,
        trade_alerts,
        price_alerts,
        ai_trade_alerts,
        referral_alerts,
        portfolio_summary,
        default_chain,
        currency_display,
        hide_small_balances,
        language,
        transaction_speed,
        debug_mode
      ) VALUES (
        $1, 100, 'auto', 1.0, FALSE,
        'manual', 'balanced', 1.0, 5.0, 20, 'balanced', 'large_trades', TRUE,
        TRUE, TRUE, 'smart', 'weekly',
        TRUE, TRUE, TRUE, TRUE, TRUE, 'weekly',
        'solana', 'USD', FALSE, 'en',
        'normal', FALSE
      )
      RETURNING *`,
      [userId]
    );

    return this.mapRowToSettings(result.rows[0]);
  }

  /**
   * Update a specific setting
   */
  async updateSetting(userId: number, field: string, value: any): Promise<void> {
    const columnMap: Record<string, string> = {
      slippageBps: 'slippage_bps',
      priorityFeeMode: 'priority_fee_mode',
      maxTradeAmount: 'max_trade_amount',
      defaultBuyAmount: 'default_buy_amount',
      autoApproveTrades: 'auto_approve_trades',
      tradingMode: 'trading_mode',
      aiRiskLevel: 'ai_risk_level',
      aiMaxTradeSize: 'ai_max_trade_size',
      aiDailyBudget: 'ai_daily_budget',
      aiStopLossPercent: 'ai_stop_loss_percent',
      aiStrategy: 'ai_strategy',
      aiRequireConfirmation: 'ai_require_confirmation',
      aiShowReasoning: 'ai_show_reasoning',
      mevProtection: 'mev_protection',
      antiRugDetection: 'anti_rug_detection',
      transactionConfirmations: 'transaction_confirmations',
      walletBackupReminder: 'wallet_backup_reminder',
      tradeAlerts: 'trade_alerts',
      priceAlerts: 'price_alerts',
      aiTradeAlerts: 'ai_trade_alerts',
      referralAlerts: 'referral_alerts',
      portfolioSummary: 'portfolio_summary',
      defaultChain: 'default_chain',
      currencyDisplay: 'currency_display',
      hideSmallBalances: 'hide_small_balances',
      language: 'language',
      customRpcSolana: 'custom_rpc_solana',
      customRpcEthereum: 'custom_rpc_ethereum',
      customRpcBsc: 'custom_rpc_bsc',
      transactionSpeed: 'transaction_speed',
      debugMode: 'debug_mode',
      notificationsEnabled: 'notifications_enabled'
    };

    const dbColumn = columnMap[field];
    if (!dbColumn) {
      throw new Error(`Invalid settings field: ${field}`);
    }

    await query(
      `UPDATE user_settings 
       SET ${dbColumn} = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE user_id = $2`,
      [value, userId]
    );
  }

  /**
   * Update multiple settings at once
   */
  async updateSettings(userId: number, updates: Partial<UserSettings>): Promise<void> {
    for (const [key, value] of Object.entries(updates)) {
      if (key !== 'id' && key !== 'userId') {
        await this.updateSetting(userId, key, value);
      }
    }
  }

  /**
   * Toggle a boolean setting
   */
  async toggleSetting(userId: number, field: string): Promise<boolean> {
    const settings = await this.getSettings(userId);
    const currentValue = (settings as any)[field];
    
    if (typeof currentValue !== 'boolean') {
      throw new Error(`Field ${field} is not a boolean`);
    }

    const newValue = !currentValue;
    await this.updateSetting(userId, field, newValue);
    return newValue;
  }

  /**
   * Reset settings to defaults
   */
  async resetToDefaults(userId: number): Promise<void> {
    await query(`DELETE FROM user_settings WHERE user_id = $1`, [userId]);
    await this.createDefaultSettings(userId);
  }

  /**
   * Get slippage in percentage
   */
  async getSlippagePercent(userId: number): Promise<number> {
    const settings = await this.getSettings(userId);
    return settings.slippageBps / 100;
  }

  /**
   * Check if user is in AI trading mode
   */
  async isAIMode(userId: number): Promise<boolean> {
    const settings = await this.getSettings(userId);
    return settings.tradingMode === 'ai';
  }

  /**
   * Map database row to UserSettings object
   */
  private mapRowToSettings(row: any): UserSettings {
    return {
      id: row.id,
      userId: row.user_id,
      slippageBps: row.slippage_bps,
      priorityFeeMode: row.priority_fee_mode,
      maxTradeAmount: row.max_trade_amount ? parseFloat(row.max_trade_amount) : null,
      defaultBuyAmount: parseFloat(row.default_buy_amount),
      autoApproveTrades: row.auto_approve_trades,
      tradingMode: row.trading_mode,
      aiRiskLevel: row.ai_risk_level,
      aiMaxTradeSize: parseFloat(row.ai_max_trade_size),
      aiDailyBudget: parseFloat(row.ai_daily_budget),
      aiStopLossPercent: row.ai_stop_loss_percent,
      aiStrategy: row.ai_strategy,
      aiRequireConfirmation: row.ai_require_confirmation,
      aiShowReasoning: row.ai_show_reasoning,
      mevProtection: row.mev_protection,
      antiRugDetection: row.anti_rug_detection,
      transactionConfirmations: row.transaction_confirmations,
      walletBackupReminder: row.wallet_backup_reminder,
      notificationsEnabled: row.notifications_enabled,
      tradeAlerts: row.trade_alerts,
      priceAlerts: row.price_alerts,
      aiTradeAlerts: row.ai_trade_alerts,
      referralAlerts: row.referral_alerts,
      portfolioSummary: row.portfolio_summary,
      defaultChain: row.default_chain,
      currencyDisplay: row.currency_display,
      hideSmallBalances: row.hide_small_balances,
      language: row.language,
      customRpcSolana: row.custom_rpc_solana,
      customRpcEthereum: row.custom_rpc_ethereum,
      customRpcBsc: row.custom_rpc_bsc,
      transactionSpeed: row.transaction_speed,
      debugMode: row.debug_mode
    };
  }
}

export const userSettingsService = new UserSettingsService();
