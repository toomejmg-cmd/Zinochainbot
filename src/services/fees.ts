import { query } from '../database/db';

export interface FeeConfig {
  tradingFeeBps: number;
  feeWallet: string;
  feeWalletSolana?: string;
  feeWalletEthereum?: string;
  feeWalletBsc?: string;
  referralPercentage: number;
  minTradeAmount: number;
  maxTradeAmount?: number;
  enabled: boolean;
  maintenanceMode: boolean;
}

export class FeeService {
  private config: FeeConfig;

  constructor(config: FeeConfig) {
    this.config = config;
  }

  async loadSettingsFromDatabase(): Promise<void> {
    try {
      const result = await query('SELECT * FROM bot_settings ORDER BY id DESC LIMIT 1');
      
      if (result.rows.length > 0) {
        const settings = result.rows[0];
        const dbFeeWallet = settings.fee_wallet_address_solana || settings.fee_wallet_address || '';
        
        // Prioritize environment variable FEE_WALLET over database
        const effectiveFeeWallet = this.config.feeWallet || dbFeeWallet;
        
        this.config = {
          tradingFeeBps: Math.floor(parseFloat(settings.fee_percentage) * 100),
          feeWallet: effectiveFeeWallet,
          feeWalletSolana: settings.fee_wallet_address_solana || effectiveFeeWallet,
          feeWalletEthereum: settings.fee_wallet_address_ethereum,
          feeWalletBsc: settings.fee_wallet_address_bsc,
          referralPercentage: parseFloat(settings.referral_percentage),
          minTradeAmount: parseFloat(settings.min_trade_amount),
          maxTradeAmount: settings.max_trade_amount ? parseFloat(settings.max_trade_amount) : undefined,
          enabled: settings.enabled,
          maintenanceMode: settings.maintenance_mode
        };
        
        console.log(`🔧 DEBUG: Effective fee wallet after DB load = "${effectiveFeeWallet}"`);
      }
    } catch (error) {
      console.error('Error loading fee settings from database:', error);
    }
  }

  calculateFee(amount: number): number {
    return (amount * this.config.tradingFeeBps) / 10000;
  }

  getFeePercentage(): string {
    return (this.config.tradingFeeBps / 100).toFixed(2);
  }

  getReferralPercentage(): number {
    return this.config.referralPercentage || 0;
  }

  getMinTradeAmount(): number {
    return this.config.minTradeAmount || 0.002;
  }

  getMaxTradeAmount(): number | undefined {
    return this.config.maxTradeAmount;
  }

  isBotEnabled(): boolean {
    return this.config.enabled !== false;
  }

  isMaintenanceMode(): boolean {
    return this.config.maintenanceMode === true;
  }

  async recordFee(
    transactionId: number | null,
    userId: number,
    feeAmount: number,
    feeType: string = 'trading',
    tokenMint?: string
  ): Promise<void> {
    try {
      await query(
        `INSERT INTO fees_collected (transaction_id, user_id, fee_amount, fee_type, token_mint)
         VALUES ($1, $2, $3, $4, $5)`,
        [transactionId, userId, feeAmount, feeType, tokenMint || null]
      );
    } catch (error) {
      console.error('Error recording fee:', error);
    }
  }

  async getTotalFees(): Promise<number> {
    try {
      const result = await query(`SELECT SUM(fee_amount) as total FROM fees_collected`);
      return parseFloat(result.rows[0].total || 0);
    } catch (error) {
      console.error('Error fetching total fees:', error);
      return 0;
    }
  }

  async getUserFees(userId: number): Promise<number> {
    try {
      const result = await query(
        `SELECT SUM(fee_amount) as total FROM fees_collected WHERE user_id = $1`,
        [userId]
      );
      return parseFloat(result.rows[0].total || 0);
    } catch (error) {
      console.error('Error fetching user fees:', error);
      return 0;
    }
  }

  setTradingFee(bps: number): void {
    this.config.tradingFeeBps = bps;
  }

  setFeePercentage(percentage: number): void {
    this.config.tradingFeeBps = Math.floor(percentage * 100);
  }

  getTradingFeeBps(): number {
    return this.config.tradingFeeBps;
  }

  getFeeWallet(): string {
    return this.config.feeWallet;
  }

  getFeeWalletByChain(chain: 'solana' | 'ethereum' | 'bsc'): string {
    switch (chain) {
      case 'ethereum':
        return this.config.feeWalletEthereum || this.config.feeWallet;
      case 'bsc':
        return this.config.feeWalletBsc || this.config.feeWallet;
      case 'solana':
      default:
        return this.config.feeWalletSolana || this.config.feeWallet;
    }
  }
}
