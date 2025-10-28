import { query } from '../database/db';

export interface FeeConfig {
  tradingFeeBps: number;
  feeWallet: string;
}

export class FeeService {
  private config: FeeConfig;

  constructor(config: FeeConfig) {
    this.config = config;
  }

  calculateFee(amount: number): number {
    return (amount * this.config.tradingFeeBps) / 10000;
  }

  getFeePercentage(): string {
    return (this.config.tradingFeeBps / 100).toFixed(2);
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

  getTradingFeeBps(): number {
    return this.config.tradingFeeBps;
  }

  getFeeWallet(): string {
    return this.config.feeWallet;
  }
}
