import express from 'express';
import { query } from '../database/db';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

router.use(authenticateToken);

router.get('/stats', async (req, res) => {
  try {
    const [usersResult, walletsResult, transactionsResult, feesResult] = await Promise.all([
      query('SELECT COUNT(*) as count FROM users'),
      query('SELECT COUNT(*) as count FROM wallets WHERE is_active = true'),
      query('SELECT COUNT(*) as count FROM transactions'),
      query('SELECT COALESCE(SUM(fee_amount), 0) as total FROM fees_collected')
    ]);

    res.json({
      totalUsers: parseInt(usersResult.rows[0].count),
      activeWallets: parseInt(walletsResult.rows[0].count),
      totalTransactions: parseInt(transactionsResult.rows[0].count),
      totalFeesCollected: parseFloat(feesResult.rows[0].total)
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

router.get('/users', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;
    const search = req.query.search as string;

    let queryText = `
      SELECT u.id, u.telegram_id, u.username, u.first_name, u.last_name, 
             u.created_at, u.referral_code, u.referred_by,
             COUNT(w.id) as wallet_count,
             COUNT(t.id) as transaction_count
      FROM users u
      LEFT JOIN wallets w ON w.user_id = u.id
      LEFT JOIN transactions t ON t.user_id = u.id
    `;

    const params: any[] = [];
    
    if (search) {
      queryText += ` WHERE u.username ILIKE $1 OR u.telegram_id::text LIKE $1 OR u.first_name ILIKE $1`;
      params.push(`%${search}%`);
    }

    queryText += ` GROUP BY u.id ORDER BY u.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await query(queryText, params);
    
    const countResult = await query(
      `SELECT COUNT(*) as total FROM users ${search ? 'WHERE username ILIKE $1 OR telegram_id::text LIKE $1 OR first_name ILIKE $1' : ''}`,
      search ? [`%${search}%`] : []
    );

    res.json({
      users: result.rows,
      pagination: {
        page,
        limit,
        total: parseInt(countResult.rows[0].total),
        pages: Math.ceil(parseInt(countResult.rows[0].total) / limit)
      }
    });
  } catch (error) {
    console.error('Users list error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

router.get('/users/:id', async (req, res) => {
  try {
    const userId = parseInt(req.params.id);

    const userResult = await query(
      `SELECT u.*, 
              COUNT(DISTINCT w.id) as wallet_count,
              COUNT(DISTINCT t.id) as transaction_count,
              COALESCE(SUM(t.fee_amount), 0) as total_fees_paid
       FROM users u
       LEFT JOIN wallets w ON w.user_id = u.id
       LEFT JOIN transactions t ON t.user_id = u.id
       WHERE u.id = $1
       GROUP BY u.id`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const walletsResult = await query(
      'SELECT id, public_key, is_active, created_at FROM wallets WHERE user_id = $1',
      [userId]
    );

    const transactionsResult = await query(
      `SELECT id, transaction_type, signature, from_token, to_token, 
              from_amount, fee_amount, status, created_at 
       FROM transactions 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT 20`,
      [userId]
    );

    res.json({
      user: userResult.rows[0],
      wallets: walletsResult.rows,
      recentTransactions: transactionsResult.rows
    });
  } catch (error) {
    console.error('User detail error:', error);
    res.status(500).json({ error: 'Failed to fetch user details' });
  }
});

router.get('/transactions', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;
    const type = req.query.type as string;

    let queryText = `
      SELECT t.*, u.username, u.telegram_id, u.first_name
      FROM transactions t
      LEFT JOIN users u ON u.id = t.user_id
    `;

    const params: any[] = [];

    if (type && ['buy', 'sell'].includes(type)) {
      queryText += ` WHERE t.transaction_type = $1`;
      params.push(type);
    }

    queryText += ` ORDER BY t.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await query(queryText, params);

    const countResult = await query(
      `SELECT COUNT(*) as total FROM transactions ${type && ['buy', 'sell'].includes(type) ? 'WHERE transaction_type = $1' : ''}`,
      type && ['buy', 'sell'].includes(type) ? [type] : []
    );

    res.json({
      transactions: result.rows,
      pagination: {
        page,
        limit,
        total: parseInt(countResult.rows[0].total),
        pages: Math.ceil(parseInt(countResult.rows[0].total) / limit)
      }
    });
  } catch (error) {
    console.error('Transactions list error:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

router.get('/fees', async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as transaction_count,
        SUM(fee_amount) as total_fees
      FROM fees_collected
      GROUP BY DATE(created_at)
      ORDER BY date DESC
      LIMIT 30
    `);

    res.json({ fees: result.rows });
  } catch (error) {
    console.error('Fees error:', error);
    res.status(500).json({ error: 'Failed to fetch fees' });
  }
});

router.get('/referrals', async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        u.id, u.username, u.telegram_id, u.first_name, u.referral_code,
        COUNT(r.id) as total_referrals,
        SUM(r.reward_amount) as total_rewards
      FROM users u
      LEFT JOIN referrals r ON r.referrer_id = u.id
      WHERE u.referral_code IS NOT NULL
      GROUP BY u.id
      HAVING COUNT(r.id) > 0
      ORDER BY total_referrals DESC
      LIMIT 50
    `);

    res.json({ referrals: result.rows });
  } catch (error) {
    console.error('Referrals error:', error);
    res.status(500).json({ error: 'Failed to fetch referrals' });
  }
});

router.get('/settings', async (req, res) => {
  try {
    const result = await query('SELECT * FROM bot_settings ORDER BY id DESC LIMIT 1');
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Settings not found' });
    }

    res.json({ settings: result.rows[0] });
  } catch (error) {
    console.error('Settings error:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

router.put('/settings', async (req, res) => {
  try {
    const adminId = (req as any).user.id;
    const s = req.body;

    // Validate required fields
    if (!s.fee_wallet_address || s.fee_percentage === undefined || s.referral_percentage === undefined) {
      return res.status(400).json({ error: 'Missing required fields: fee_wallet_address, fee_percentage, referral_percentage' });
    }

    // Validate percentages
    if (s.fee_percentage < 0 || s.fee_percentage > 100) {
      return res.status(400).json({ error: 'Fee percentage must be between 0 and 100' });
    }
    if (s.referral_percentage < 0 || s.referral_percentage > 100) {
      return res.status(400).json({ error: 'Referral percentage must be between 0 and 100' });
    }
    if (s.withdrawal_fee_percentage !== undefined && (s.withdrawal_fee_percentage < 0 || s.withdrawal_fee_percentage > 100)) {
      return res.status(400).json({ error: 'Withdrawal fee percentage must be between 0 and 100' });
    }

    // Validate RPC endpoint
    if (!s.solana_rpc_endpoint || !s.solana_rpc_endpoint.startsWith('http')) {
      return res.status(400).json({ error: 'Valid Solana RPC endpoint is required' });
    }

    const checkResult = await query('SELECT id FROM bot_settings LIMIT 1');
    
    let result;
    if (checkResult.rows.length === 0) {
      // INSERT ALL fields for new record
      result = await query(`
        INSERT INTO bot_settings (
          fee_wallet_address, fee_percentage, referral_percentage, min_trade_amount, max_trade_amount, 
          enabled, maintenance_mode, allow_new_registrations,
          withdrawal_wallet_address, withdrawal_fee_percentage, min_withdrawal_amount, max_withdrawal_amount,
          daily_withdrawal_limit, monthly_withdrawal_limit, withdrawal_requires_approval, auto_withdrawal_threshold,
          auto_collect_fees, auto_collect_schedule_hours, min_balance_for_auto_collect, fee_collection_wallet_rotation,
          daily_trade_limit_per_user, max_trade_size_per_transaction, max_active_orders_per_user,
          max_wallets_per_user, trade_cooldown_seconds, suspicious_activity_threshold,
          require_2fa, auto_lock_suspicious_accounts, notify_on_suspicious_activity, notify_on_large_trades,
          max_failed_login_attempts, large_trade_threshold_sol, admin_notification_email, admin_notification_telegram_id,
          admin_ip_whitelist, require_kyc_above_limit, new_user_cooldown_hours,
          solana_rpc_endpoint, solana_backup_rpc_endpoint, ethereum_rpc_endpoint, bsc_rpc_endpoint, api_rate_limit_per_minute,
          global_max_slippage_bps, global_min_slippage_bps, max_gas_price_gwei,
          min_priority_fee_lamports, max_priority_fee_lamports, enable_mev_protection,
          max_consecutive_errors, auto_restart_on_error, emergency_stop, emergency_stop_reason,
          updated_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38, $39, $40, $41, $42, $43, $44, $45, $46, $47, $48, $49, $50, $51, $52, $53)
        RETURNING *
      `, [
        s.fee_wallet_address, s.fee_percentage, s.referral_percentage, s.min_trade_amount, s.max_trade_amount,
        s.enabled !== false, s.maintenance_mode || false, s.allow_new_registrations !== false,
        s.withdrawal_wallet_address, s.withdrawal_fee_percentage || 0.10, s.min_withdrawal_amount || 0.01, s.max_withdrawal_amount,
        s.daily_withdrawal_limit, s.monthly_withdrawal_limit, s.withdrawal_requires_approval || false, s.auto_withdrawal_threshold,
        s.auto_collect_fees || false, s.auto_collect_schedule_hours || 24, s.min_balance_for_auto_collect || 1.0, s.fee_collection_wallet_rotation || false,
        s.daily_trade_limit_per_user, s.max_trade_size_per_transaction, s.max_active_orders_per_user || 10,
        s.max_wallets_per_user || 5, s.trade_cooldown_seconds || 0, s.suspicious_activity_threshold || 100,
        s.require_2fa || false, s.auto_lock_suspicious_accounts || false, s.notify_on_suspicious_activity !== false, s.notify_on_large_trades !== false,
        s.max_failed_login_attempts || 5, s.large_trade_threshold_sol || 10, s.admin_notification_email, s.admin_notification_telegram_id,
        s.admin_ip_whitelist || null, s.require_kyc_above_limit, s.new_user_cooldown_hours || 0,
        s.solana_rpc_endpoint, s.solana_backup_rpc_endpoint, s.ethereum_rpc_endpoint, s.bsc_rpc_endpoint, s.api_rate_limit_per_minute || 60,
        s.global_max_slippage_bps || 5000, s.global_min_slippage_bps || 10, s.max_gas_price_gwei,
        s.min_priority_fee_lamports || 1000, s.max_priority_fee_lamports || 1000000, s.enable_mev_protection !== false,
        s.max_consecutive_errors || 10, s.auto_restart_on_error !== false, s.emergency_stop || false, s.emergency_stop_reason,
        adminId
      ]);
    } else {
      // UPDATE ALL fields for existing record
      result = await query(`
        UPDATE bot_settings 
        SET 
          fee_wallet_address = $1, fee_percentage = $2, referral_percentage = $3, min_trade_amount = $4, max_trade_amount = $5,
          enabled = $6, maintenance_mode = $7, allow_new_registrations = $8,
          withdrawal_wallet_address = $9, withdrawal_fee_percentage = $10, min_withdrawal_amount = $11, max_withdrawal_amount = $12,
          daily_withdrawal_limit = $13, monthly_withdrawal_limit = $14, withdrawal_requires_approval = $15, auto_withdrawal_threshold = $16,
          auto_collect_fees = $17, auto_collect_schedule_hours = $18, min_balance_for_auto_collect = $19, fee_collection_wallet_rotation = $20,
          daily_trade_limit_per_user = $21, max_trade_size_per_transaction = $22, max_active_orders_per_user = $23,
          max_wallets_per_user = $24, trade_cooldown_seconds = $25, suspicious_activity_threshold = $26,
          require_2fa = $27, auto_lock_suspicious_accounts = $28, notify_on_suspicious_activity = $29, notify_on_large_trades = $30,
          max_failed_login_attempts = $31, large_trade_threshold_sol = $32, admin_notification_email = $33, admin_notification_telegram_id = $34,
          admin_ip_whitelist = $35, require_kyc_above_limit = $36, new_user_cooldown_hours = $37,
          solana_rpc_endpoint = $38, solana_backup_rpc_endpoint = $39, ethereum_rpc_endpoint = $40, bsc_rpc_endpoint = $41, api_rate_limit_per_minute = $42,
          global_max_slippage_bps = $43, global_min_slippage_bps = $44, max_gas_price_gwei = $45,
          min_priority_fee_lamports = $46, max_priority_fee_lamports = $47, enable_mev_protection = $48,
          max_consecutive_errors = $49, auto_restart_on_error = $50, emergency_stop = $51, emergency_stop_reason = $52,
          updated_at = CURRENT_TIMESTAMP, updated_by = $53
        WHERE id = (SELECT id FROM bot_settings ORDER BY id DESC LIMIT 1)
        RETURNING *
      `, [
        s.fee_wallet_address, s.fee_percentage, s.referral_percentage, s.min_trade_amount, s.max_trade_amount,
        s.enabled !== false, s.maintenance_mode || false, s.allow_new_registrations !== false,
        s.withdrawal_wallet_address, s.withdrawal_fee_percentage || 0.10, s.min_withdrawal_amount || 0.01, s.max_withdrawal_amount,
        s.daily_withdrawal_limit, s.monthly_withdrawal_limit, s.withdrawal_requires_approval || false, s.auto_withdrawal_threshold,
        s.auto_collect_fees || false, s.auto_collect_schedule_hours || 24, s.min_balance_for_auto_collect || 1.0, s.fee_collection_wallet_rotation || false,
        s.daily_trade_limit_per_user, s.max_trade_size_per_transaction, s.max_active_orders_per_user || 10,
        s.max_wallets_per_user || 5, s.trade_cooldown_seconds || 0, s.suspicious_activity_threshold || 100,
        s.require_2fa || false, s.auto_lock_suspicious_accounts || false, s.notify_on_suspicious_activity !== false, s.notify_on_large_trades !== false,
        s.max_failed_login_attempts || 5, s.large_trade_threshold_sol || 10, s.admin_notification_email, s.admin_notification_telegram_id,
        s.admin_ip_whitelist || null, s.require_kyc_above_limit, s.new_user_cooldown_hours || 0,
        s.solana_rpc_endpoint, s.solana_backup_rpc_endpoint, s.ethereum_rpc_endpoint, s.bsc_rpc_endpoint, s.api_rate_limit_per_minute || 60,
        s.global_max_slippage_bps || 5000, s.global_min_slippage_bps || 10, s.max_gas_price_gwei,
        s.min_priority_fee_lamports || 1000, s.max_priority_fee_lamports || 1000000, s.enable_mev_protection !== false,
        s.max_consecutive_errors || 10, s.auto_restart_on_error !== false, s.emergency_stop || false, s.emergency_stop_reason,
        adminId
      ]);
    }

    res.json({ 
      message: 'Settings updated successfully',
      settings: result.rows[0]
    });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

router.get('/transfers', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;

    const result = await query(`
      SELECT 
        t.*,
        sender.username as sender_username,
        sender.telegram_id as sender_telegram_id,
        recipient.username as recipient_username,
        recipient.telegram_id as recipient_telegram_id
      FROM transfers t
      LEFT JOIN users sender ON sender.id = t.sender_id
      LEFT JOIN users recipient ON recipient.id = t.recipient_id
      ORDER BY t.created_at DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);

    const countResult = await query('SELECT COUNT(*) as total FROM transfers');

    res.json({
      transfers: result.rows,
      pagination: {
        page,
        limit,
        total: parseInt(countResult.rows[0].total),
        pages: Math.ceil(parseInt(countResult.rows[0].total) / limit)
      }
    });
  } catch (error) {
    console.error('Transfers list error:', error);
    res.status(500).json({ error: 'Failed to fetch transfers' });
  }
});

export default router;
