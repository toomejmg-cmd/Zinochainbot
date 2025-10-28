import { query } from '../database/db';

export class AdminService {
  async isAdmin(telegramId: number): Promise<boolean> {
    try {
      const result = await query(
        `SELECT id FROM admin_users WHERE telegram_id = $1`,
        [telegramId]
      );
      return result.rows.length > 0;
    } catch (error) {
      console.error('Error checking admin status:', error);
      return false;
    }
  }

  async addAdmin(telegramId: number, role: string = 'admin'): Promise<boolean> {
    try {
      await query(
        `INSERT INTO admin_users (telegram_id, role) VALUES ($1, $2)
         ON CONFLICT (telegram_id) DO UPDATE SET role = $2`,
        [telegramId, role]
      );
      return true;
    } catch (error) {
      console.error('Error adding admin:', error);
      return false;
    }
  }

  async removeAdmin(telegramId: number): Promise<boolean> {
    try {
      await query(
        `DELETE FROM admin_users WHERE telegram_id = $1`,
        [telegramId]
      );
      return true;
    } catch (error) {
      console.error('Error removing admin:', error);
      return false;
    }
  }

  async getAllAdmins(): Promise<any[]> {
    try {
      const result = await query(
        `SELECT telegram_id, role, created_at FROM admin_users ORDER BY created_at ASC`
      );
      return result.rows;
    } catch (error) {
      console.error('Error fetching admins:', error);
      return [];
    }
  }

  async getStats(): Promise<any> {
    try {
      const usersResult = await query(`SELECT COUNT(*) as count FROM users`);
      const walletsResult = await query(`SELECT COUNT(*) as count FROM wallets WHERE is_active = true`);
      const transactionsResult = await query(`SELECT COUNT(*) as count FROM transactions WHERE status = 'confirmed'`);
      const feesResult = await query(`SELECT SUM(fee_amount) as total FROM fees_collected`);
      
      return {
        totalUsers: parseInt(usersResult.rows[0].count),
        activeWallets: parseInt(walletsResult.rows[0].count),
        totalTransactions: parseInt(transactionsResult.rows[0].count),
        totalFeesCollected: parseFloat(feesResult.rows[0].total || 0)
      };
    } catch (error) {
      console.error('Error fetching stats:', error);
      return {
        totalUsers: 0,
        activeWallets: 0,
        totalTransactions: 0,
        totalFeesCollected: 0
      };
    }
  }
}
