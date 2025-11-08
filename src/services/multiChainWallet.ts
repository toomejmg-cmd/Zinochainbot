import { ChainManager, DEFAULT_CHAIN_CONFIG } from './chainManager';
import { ChainType } from '../adapters/IChainAdapter';
import { query } from '../database/db';
import { encrypt, decrypt } from '../utils/encryption';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY!;

if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length < 32) {
  throw new Error('ENCRYPTION_KEY must be at least 32 characters long');
}

export class MultiChainWalletService {
  private chainManager: ChainManager;

  constructor() {
    this.chainManager = new ChainManager(DEFAULT_CHAIN_CONFIG);
  }

  async createWallet(userId: number, chain: ChainType): Promise<{
    publicKey: string;
    privateKey: string;
    walletId: number;
    chain: ChainType;
  }> {
    const adapter = this.chainManager.getAdapter(chain);
    const credentials = await adapter.createWallet();

    const encryptedPrivateKey = encrypt(credentials.privateKey, ENCRYPTION_KEY);

    const result = await query(
      `INSERT INTO wallets (user_id, public_key, encrypted_private_key, chain, is_active)
       VALUES ($1, $2, $3, $4, true)
       RETURNING id`,
      [userId, credentials.publicKey, encryptedPrivateKey, chain]
    );

    return {
      publicKey: credentials.publicKey,
      privateKey: credentials.privateKey,
      walletId: result.rows[0].id,
      chain
    };
  }

  async getWallet(userId: number, chain: ChainType): Promise<{
    id: number;
    publicKey: string;
    chain: ChainType;
  } | null> {
    const result = await query(
      `SELECT id, public_key, chain FROM wallets 
       WHERE user_id = $1 AND chain = $2 AND is_active = true 
       ORDER BY created_at DESC LIMIT 1`,
      [userId, chain]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return {
      id: result.rows[0].id,
      publicKey: result.rows[0].public_key,
      chain: result.rows[0].chain
    };
  }

  async getAllWallets(userId: number): Promise<Array<{
    id: number;
    publicKey: string;
    chain: ChainType;
  }>> {
    const result = await query(
      `SELECT id, public_key, chain FROM wallets 
       WHERE user_id = $1 AND is_active = true 
       ORDER BY created_at ASC`,
      [userId]
    );

    return result.rows.map(row => ({
      id: row.id,
      publicKey: row.public_key,
      chain: row.chain
    }));
  }

  async getPrivateKey(walletId: number): Promise<string> {
    const result = await query(
      `SELECT encrypted_private_key FROM wallets WHERE id = $1`,
      [walletId]
    );

    if (result.rows.length === 0) {
      throw new Error('Wallet not found');
    }

    const encryptedPrivateKey = result.rows[0].encrypted_private_key;
    return decrypt(encryptedPrivateKey, ENCRYPTION_KEY);
  }

  async getBalance(userId: number, chain: ChainType): Promise<string> {
    const wallet = await this.getWallet(userId, chain);
    if (!wallet) {
      return '0';
    }

    const adapter = this.chainManager.getAdapter(chain);
    return await adapter.getBalance(wallet.publicKey);
  }

  getChainManager(): ChainManager {
    return this.chainManager;
  }
}
