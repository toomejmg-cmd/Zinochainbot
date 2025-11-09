import { query } from '../database/db';
import * as crypto from 'crypto';
import bs58 from 'bs58';

export interface ReferralDashboard {
  referralRewards: {
    usersReferred: number;
    directReferrals: number;
    indirectReferrals: number;
    earnedRewards: number;
  };
  cashbackRewards: {
    earnedRewards: number;
  };
  totalRewards: {
    totalPaid: number;
    totalUnpaid: number;
  };
  referralLink: string;
  rewardsWallet: string;
  lastUpdated: Date;
  layerBreakdown: {
    layer1: { count: number; rewards: number };
    layer2: { count: number; rewards: number };
    layer3: { count: number; rewards: number };
  };
}

export interface ReferralSettings {
  enabled: boolean;
  layer_1_percent: number;
  layer_2_percent: number;
  layer_3_percent: number;
  cashback_percent: number;
  min_eligibility_sol: number;
  payout_frequency_hours: number;
}

export class ReferralService {
  private botUsername: string;

  constructor(botUsername?: string) {
    this.botUsername = botUsername || process.env.BOT_USERNAME || 'zinobot';
  }

  async getOrCreateReferralAccount(userId: number): Promise<any> {
    let result = await query(
      'SELECT * FROM referral_accounts WHERE user_id = $1',
      [userId]
    );

    if (result.rows.length > 0) {
      return result.rows[0];
    }

    const userResult = await query(
      'SELECT telegram_id, referral_code FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      throw new Error('User not found');
    }

    const telegramId = userResult.rows[0].telegram_id;
    const existingCode = userResult.rows[0].referral_code;
    const referralCode = existingCode || `ref-${telegramId}`;

    result = await query(
      `INSERT INTO referral_accounts (user_id, referral_code, created_at)
       VALUES ($1, $2, NOW())
       RETURNING *`,
      [userId, referralCode]
    );

    const account = result.rows[0];

    await query(
      `INSERT INTO referral_links (referral_account_id, invite_code, is_active, created_at)
       VALUES ($1, $2, true, NOW())`,
      [account.id, referralCode]
    );

    return account;
  }

  async updateReferralLink(userId: number): Promise<string> {
    const account = await this.getOrCreateReferralAccount(userId);

    await query(
      'UPDATE referral_links SET is_active = false WHERE referral_account_id = $1',
      [account.id]
    );

    const newCode = this.generateInviteCode();

    await query(
      `INSERT INTO referral_links (referral_account_id, invite_code, is_active, created_at)
       VALUES ($1, $2, true, NOW())`,
      [account.id, newCode]
    );

    await query(
      'UPDATE referral_accounts SET last_link_update_at = NOW() WHERE id = $1',
      [account.id]
    );

    return this.formatReferralLink(newCode);
  }

  async getReferralLink(userId: number): Promise<string> {
    const account = await this.getOrCreateReferralAccount(userId);

    const result = await query(
      'SELECT invite_code FROM referral_links WHERE referral_account_id = $1 AND is_active = true ORDER BY created_at DESC LIMIT 1',
      [account.id]
    );

    const code = result.rows.length > 0 ? result.rows[0].invite_code : account.referral_code;
    return this.formatReferralLink(code);
  }

  async processReferral(newUserId: number, inviteCode: string): Promise<void> {
    const linkResult = await query(
      'SELECT referral_account_id FROM referral_links WHERE invite_code = $1 AND is_active = true',
      [inviteCode]
    );

    if (linkResult.rows.length === 0) {
      console.log('Invalid or inactive invite code:', inviteCode);
      return;
    }

    const referrerAccountId = linkResult.rows[0].referral_account_id;

    const accountResult = await query(
      'SELECT user_id FROM referral_accounts WHERE id = $1',
      [referrerAccountId]
    );

    const referrerId = accountResult.rows[0].user_id;

    if (referrerId === newUserId) {
      console.log('Self-referral attempt blocked');
      return;
    }

    await query(
      'UPDATE users SET referred_by = $1 WHERE id = $2',
      [referrerId, newUserId]
    );

    await query(
      `INSERT INTO referral_edges (referrer_account_id, referred_user_id, layer, created_at)
       VALUES ($1, $2, 1, NOW())
       ON CONFLICT (referrer_account_id, referred_user_id, layer) DO NOTHING`,
      [referrerAccountId, newUserId]
    );

    await this.propagateReferralEdges(referrerId, newUserId);
  }

  private async propagateReferralEdges(directReferrerId: number, newUserId: number): Promise<void> {
    const layer2Result = await query(
      `SELECT re.referrer_account_id 
       FROM referral_edges re
       WHERE re.referred_user_id = $1 AND re.layer = 1`,
      [directReferrerId]
    );

    if (layer2Result.rows.length > 0) {
      const layer2AccountId = layer2Result.rows[0].referrer_account_id;
      
      await query(
        `INSERT INTO referral_edges (referrer_account_id, referred_user_id, layer, created_at)
         VALUES ($1, $2, 2, NOW())
         ON CONFLICT (referrer_account_id, referred_user_id, layer) DO NOTHING`,
        [layer2AccountId, newUserId]
      );

      const layer2UserResult = await query(
        'SELECT user_id FROM referral_accounts WHERE id = $1',
        [layer2AccountId]
      );

      if (layer2UserResult.rows.length > 0) {
        const layer2UserId = layer2UserResult.rows[0].user_id;

        const layer3Result = await query(
          `SELECT re.referrer_account_id 
           FROM referral_edges re
           WHERE re.referred_user_id = $1 AND re.layer = 1`,
          [layer2UserId]
        );

        if (layer3Result.rows.length > 0) {
          const layer3AccountId = layer3Result.rows[0].referrer_account_id;
          
          await query(
            `INSERT INTO referral_edges (referrer_account_id, referred_user_id, layer, created_at)
             VALUES ($1, $2, 3, NOW())
             ON CONFLICT (referrer_account_id, referred_user_id, layer) DO NOTHING`,
            [layer3AccountId, newUserId]
          );
        }
      }
    }
  }

  async recordReferralReward(
    transactionId: number,
    traderId: number,
    feeAmount: number
  ): Promise<void> {
    const settings = await this.getSettings();
    if (!settings.enabled) {
      return;
    }

    await this.recordCashbackReward(transactionId, traderId, feeAmount, settings);
    await this.recordTierRewards(transactionId, traderId, feeAmount, settings);
  }

  private async recordCashbackReward(
    transactionId: number,
    traderId: number,
    feeAmount: number,
    settings: ReferralSettings
  ): Promise<void> {
    const cashbackAmount = feeAmount * (settings.cashback_percent / 100);

    if (cashbackAmount > 0) {
      await query(
        `INSERT INTO referral_rewards 
         (user_id, reward_type, transaction_id, trade_volume, reward_amount, reward_status, reward_period_start, reward_period_end, created_at)
         VALUES ($1, 'cashback', $2, $3, $4, 'pending', NOW(), NOW(), NOW())`,
        [traderId, transactionId, feeAmount, cashbackAmount]
      );

      await this.updateRewardBalance(traderId, 0, cashbackAmount);
    }
  }

  private async recordTierRewards(
    transactionId: number,
    traderId: number,
    feeAmount: number,
    settings: ReferralSettings
  ): Promise<void> {
    const edgesResult = await query(
      `SELECT re.id as edge_id, re.layer, ra.user_id as referrer_user_id
       FROM referral_edges re
       INNER JOIN referral_accounts ra ON ra.id = re.referrer_account_id
       WHERE re.referred_user_id = $1`,
      [traderId]
    );

    for (const edge of edgesResult.rows) {
      let rewardPercent = 0;
      
      if (edge.layer === 1) rewardPercent = settings.layer_1_percent;
      else if (edge.layer === 2) rewardPercent = settings.layer_2_percent;
      else if (edge.layer === 3) rewardPercent = settings.layer_3_percent;

      const rewardAmount = feeAmount * (rewardPercent / 100);

      if (rewardAmount > 0) {
        await query(
          `INSERT INTO referral_rewards 
           (referral_edge_id, user_id, reward_type, layer, transaction_id, trade_volume, reward_amount, reward_status, reward_period_start, reward_period_end, created_at)
           VALUES ($1, $2, 'tier', $3, $4, $5, $6, 'pending', NOW(), NOW(), NOW())`,
          [edge.edge_id, edge.referrer_user_id, edge.layer, transactionId, feeAmount, rewardAmount]
        );

        await this.updateRewardBalance(edge.referrer_user_id, 0, rewardAmount);
      }
    }
  }

  private async updateRewardBalance(userId: number, paidDelta: number, unpaidDelta: number): Promise<void> {
    await query(
      `INSERT INTO reward_wallet_balances (user_id, total_paid, total_unpaid, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         total_paid = reward_wallet_balances.total_paid + $2,
         total_unpaid = reward_wallet_balances.total_unpaid + $3,
         updated_at = NOW()`,
      [userId, paidDelta, unpaidDelta]
    );
  }

  async getDashboard(userId: number): Promise<ReferralDashboard> {
    const account = await this.getOrCreateReferralAccount(userId);
    const link = await this.getReferralLink(userId);

    const referralCountsResult = await query(
      `SELECT 
         COUNT(DISTINCT re.referred_user_id) as total_referred,
         COUNT(DISTINCT CASE WHEN re.layer = 1 THEN re.referred_user_id END) as direct_count,
         COUNT(DISTINCT CASE WHEN re.layer > 1 THEN re.referred_user_id END) as indirect_count
       FROM referral_edges re
       WHERE re.referrer_account_id = $1`,
      [account.id]
    );

    const counts = referralCountsResult.rows[0] || { total_referred: 0, direct_count: 0, indirect_count: 0 };

    const rewardsResult = await query(
      `SELECT 
         COALESCE(SUM(CASE WHEN reward_type = 'tier' THEN reward_amount ELSE 0 END), 0) as tier_rewards,
         COALESCE(SUM(CASE WHEN reward_type = 'cashback' THEN reward_amount ELSE 0 END), 0) as cashback_rewards
       FROM referral_rewards
       WHERE user_id = $1`,
      [userId]
    );

    const rewards = rewardsResult.rows[0] || { tier_rewards: 0, cashback_rewards: 0 };

    const balanceResult = await query(
      'SELECT total_paid, total_unpaid, updated_at FROM reward_wallet_balances WHERE user_id = $1',
      [userId]
    );

    const balance = balanceResult.rows[0] || { total_paid: 0, total_unpaid: 0, updated_at: new Date() };

    const layerResult = await query(
      `SELECT 
         re.layer,
         COUNT(DISTINCT re.referred_user_id) as count,
         COALESCE(SUM(rr.reward_amount), 0) as rewards
       FROM referral_edges re
       LEFT JOIN referral_rewards rr ON rr.referral_edge_id = re.id
       WHERE re.referrer_account_id = $1
       GROUP BY re.layer`,
      [account.id]
    );

    const layerBreakdown = {
      layer1: { count: 0, rewards: 0 },
      layer2: { count: 0, rewards: 0 },
      layer3: { count: 0, rewards: 0 }
    };

    for (const row of layerResult.rows) {
      if (row.layer === 1) layerBreakdown.layer1 = { count: parseInt(row.count), rewards: parseFloat(row.rewards) };
      if (row.layer === 2) layerBreakdown.layer2 = { count: parseInt(row.count), rewards: parseFloat(row.rewards) };
      if (row.layer === 3) layerBreakdown.layer3 = { count: parseInt(row.count), rewards: parseFloat(row.rewards) };
    }

    const walletResult = await query(
      'SELECT w.public_key FROM wallets w WHERE w.user_id = $1 AND w.is_active = true AND w.chain = $2 LIMIT 1',
      [userId, 'solana']
    );

    const rewardsWallet = walletResult.rows[0]?.public_key || 'No wallet';

    return {
      referralRewards: {
        usersReferred: parseInt(counts.total_referred),
        directReferrals: parseInt(counts.direct_count),
        indirectReferrals: parseInt(counts.indirect_count),
        earnedRewards: parseFloat(rewards.tier_rewards)
      },
      cashbackRewards: {
        earnedRewards: parseFloat(rewards.cashback_rewards)
      },
      totalRewards: {
        totalPaid: parseFloat(balance.total_paid),
        totalUnpaid: parseFloat(balance.total_unpaid)
      },
      referralLink: link,
      rewardsWallet: this.formatWalletAddress(rewardsWallet),
      lastUpdated: balance.updated_at,
      layerBreakdown
    };
  }

  async getSettings(): Promise<ReferralSettings> {
    const result = await query(
      'SELECT settings FROM admin_settings WHERE namespace = $1',
      ['referral_settings']
    );

    if (result.rows.length === 0) {
      return {
        enabled: true,
        layer_1_percent: 15,
        layer_2_percent: 10,
        layer_3_percent: 7,
        cashback_percent: 25,
        min_eligibility_sol: 0.005,
        payout_frequency_hours: 12
      };
    }

    return result.rows[0].settings;
  }

  private generateInviteCode(): string {
    const randomBytes = crypto.randomBytes(8);
    return 'ref-' + bs58.encode(randomBytes).substring(0, 10);
  }

  private formatReferralLink(inviteCode: string): string {
    return `https://t.me/${this.botUsername}?start=${inviteCode}`;
  }

  private formatWalletAddress(address: string): string {
    if (address === 'No wallet' || address.length < 10) {
      return address;
    }
    return `${address.substring(0, 6)}_${address.substring(address.length - 4)}`;
  }

  async getPendingRewards(): Promise<any[]> {
    const result = await query(
      `SELECT 
         rr.user_id,
         u.telegram_id,
         u.username,
         SUM(rr.reward_amount) as pending_amount,
         COUNT(*) as pending_count
       FROM referral_rewards rr
       INNER JOIN users u ON u.id = rr.user_id
       WHERE rr.reward_status = 'pending'
       GROUP BY rr.user_id, u.telegram_id, u.username
       HAVING SUM(rr.reward_amount) >= 0.001
       ORDER BY pending_amount DESC`
    );

    return result.rows;
  }
}
