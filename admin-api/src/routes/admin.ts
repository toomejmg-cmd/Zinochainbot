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
    const { fee_wallet_address, fee_percentage, referral_percentage, min_trade_amount, max_trade_amount, enabled, maintenance_mode } = req.body;
    const adminId = (req as any).user.id;

    if (!fee_wallet_address || fee_percentage === undefined || referral_percentage === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (fee_percentage < 0 || fee_percentage > 100) {
      return res.status(400).json({ error: 'Fee percentage must be between 0 and 100' });
    }

    if (referral_percentage < 0 || referral_percentage > 100) {
      return res.status(400).json({ error: 'Referral percentage must be between 0 and 100' });
    }

    if (fee_wallet_address.length !== 44 && fee_wallet_address.length !== 32) {
      return res.status(400).json({ error: 'Invalid Solana wallet address' });
    }

    const checkResult = await query('SELECT id FROM bot_settings LIMIT 1');
    
    let result;
    if (checkResult.rows.length === 0) {
      result = await query(`
        INSERT INTO bot_settings (fee_wallet_address, fee_percentage, referral_percentage, min_trade_amount, max_trade_amount, enabled, maintenance_mode, updated_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `, [fee_wallet_address, fee_percentage, referral_percentage, min_trade_amount, max_trade_amount, enabled, maintenance_mode, adminId]);
    } else {
      result = await query(`
        UPDATE bot_settings 
        SET 
          fee_wallet_address = $1,
          fee_percentage = $2,
          referral_percentage = $3,
          min_trade_amount = $4,
          max_trade_amount = $5,
          enabled = $6,
          maintenance_mode = $7,
          updated_at = CURRENT_TIMESTAMP,
          updated_by = $8
        WHERE id = (SELECT id FROM bot_settings ORDER BY id DESC LIMIT 1)
        RETURNING *
      `, [fee_wallet_address, fee_percentage, referral_percentage, min_trade_amount, max_trade_amount, enabled, maintenance_mode, adminId]);
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
