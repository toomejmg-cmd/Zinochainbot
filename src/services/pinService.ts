import bcrypt from 'bcrypt';
import { query } from '../database/db';

const SALT_ROUNDS = 10;

export class PinService {
  /**
   * Set or update user's PIN
   */
  static async setPin(userId: number, newPin: string): Promise<void> {
    if (!newPin || newPin.length < 4 || newPin.length > 6) {
      throw new Error('PIN must be 4-6 digits');
    }

    if (!/^\d+$/.test(newPin)) {
      throw new Error('PIN must contain only numbers');
    }

    const pinHash = await bcrypt.hash(newPin, SALT_ROUNDS);
    
    await query(
      `UPDATE user_settings 
       SET pin_encrypted = $1, pin_enabled = TRUE 
       WHERE user_id = $2`,
      [pinHash, userId]
    );
  }

  /**
   * Verify user's PIN
   */
  static async verifyPin(userId: number, pin: string): Promise<boolean> {
    const result = await query(
      `SELECT pin_encrypted FROM user_settings 
       WHERE user_id = $1 AND pin_enabled = TRUE`,
      [userId]
    );

    if (result.rows.length === 0) {
      throw new Error('PIN not set for this user');
    }

    const pinHash = result.rows[0].pin_encrypted;
    return await bcrypt.compare(pin, pinHash);
  }

  /**
   * Check if user has PIN enabled
   */
  static async hasPinEnabled(userId: number): Promise<boolean> {
    const result = await query(
      `SELECT pin_enabled FROM user_settings 
       WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return false;
    }

    return result.rows[0].pin_enabled === true;
  }

  /**
   * Disable PIN for user
   */
  static async disablePin(userId: number): Promise<void> {
    await query(
      `UPDATE user_settings 
       SET pin_encrypted = NULL, pin_enabled = FALSE 
       WHERE user_id = $1`,
      [userId]
    );
  }
}
