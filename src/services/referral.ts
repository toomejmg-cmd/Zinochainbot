import { query } from '../database/db';

export class ReferralService {
  private rewardAmount: number = 0.001;

  generateReferralCode(telegramId: number): string {
    return `ZB${telegramId.toString(36).toUpperCase()}`;
  }

  async setReferralCode(userId: number, referralCode: string): Promise<boolean> {
    try {
      await query(
        `UPDATE users SET referral_code = $1 WHERE id = $2`,
        [referralCode, userId]
      );
      return true;
    } catch (error) {
      console.error('Error setting referral code:', error);
      return false;
    }
  }

  async getReferralCode(userId: number): Promise<string | null> {
    try {
      const result = await query(
        `SELECT referral_code FROM users WHERE id = $1`,
        [userId]
      );
      return result.rows[0]?.referral_code || null;
    } catch (error) {
      console.error('Error getting referral code:', error);
      return null;
    }
  }

  async applyReferral(referredUserId: number, referralCode: string): Promise<boolean> {
    try {
      const referrerResult = await query(
        `SELECT id FROM users WHERE referral_code = $1`,
        [referralCode]
      );

      if (referrerResult.rows.length === 0) {
        return false;
      }

      const referrerId = referrerResult.rows[0].id;

      if (referrerId === referredUserId) {
        return false;
      }

      await query(
        `UPDATE users SET referred_by = $1 WHERE id = $2`,
        [referrerId, referredUserId]
      );

      await query(
        `INSERT INTO referrals (referrer_id, referred_id, reward_amount)
         VALUES ($1, $2, $3)
         ON CONFLICT (referrer_id, referred_id) DO NOTHING`,
        [referrerId, referredUserId, this.rewardAmount]
      );

      return true;
    } catch (error) {
      console.error('Error applying referral:', error);
      return false;
    }
  }

  async getReferralStats(userId: number): Promise<any> {
    try {
      const result = await query(
        `SELECT COUNT(*) as total_referrals, 
                SUM(reward_amount) as total_rewards,
                SUM(CASE WHEN reward_paid = true THEN reward_amount ELSE 0 END) as paid_rewards
         FROM referrals WHERE referrer_id = $1`,
        [userId]
      );

      const row = result.rows[0];
      return {
        totalReferrals: parseInt(row.total_referrals || 0),
        totalRewards: parseFloat(row.total_rewards || 0),
        paidRewards: parseFloat(row.paid_rewards || 0),
        pendingRewards: parseFloat(row.total_rewards || 0) - parseFloat(row.paid_rewards || 0)
      };
    } catch (error) {
      console.error('Error getting referral stats:', error);
      return {
        totalReferrals: 0,
        totalRewards: 0,
        paidRewards: 0,
        pendingRewards: 0
      };
    }
  }
}
