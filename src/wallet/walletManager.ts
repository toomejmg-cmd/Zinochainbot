import { Keypair, PublicKey, Connection, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { getAssociatedTokenAddress, getAccount, getMint, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import bs58 from 'bs58';
import { query } from '../database/db';
import { encrypt, decrypt } from '../utils/encryption';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY!;

if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length < 32) {
  throw new Error('ENCRYPTION_KEY must be at least 32 characters long');
}

export interface WalletInfo {
  id: number;
  publicKey: string;
  balance?: number;
}

export class WalletManager {
  private connection: Connection;

  constructor(rpcUrl: string) {
    this.connection = new Connection(rpcUrl, 'confirmed');
  }

  async createWallet(userId: number): Promise<{ publicKey: string; secretKey: string; walletId: number }> {
    const keypair = Keypair.generate();
    const publicKey = keypair.publicKey.toString();
    const secretKey = bs58.encode(keypair.secretKey);

    const encryptedPrivateKey = encrypt(secretKey, ENCRYPTION_KEY);

    const result = await query(
      `INSERT INTO wallets (user_id, public_key, encrypted_private_key, is_active)
       VALUES ($1, $2, $3, true)
       RETURNING id`,
      [userId, publicKey, encryptedPrivateKey]
    );

    return {
      publicKey,
      secretKey,
      walletId: result.rows[0].id
    };
  }

  async getActiveWallet(userId: number): Promise<WalletInfo | null> {
    const result = await query(
      `SELECT id, public_key FROM wallets WHERE user_id = $1 AND is_active = true ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const wallet = result.rows[0];
    return {
      id: wallet.id,
      publicKey: wallet.public_key
    };
  }

  async getKeypair(walletId: number): Promise<Keypair> {
    const result = await query(
      `SELECT encrypted_private_key FROM wallets WHERE id = $1`,
      [walletId]
    );

    if (result.rows.length === 0) {
      throw new Error('Wallet not found');
    }

    const encryptedPrivateKey = result.rows[0].encrypted_private_key;
    const secretKey = decrypt(encryptedPrivateKey, ENCRYPTION_KEY);
    const secretKeyBytes = bs58.decode(secretKey);

    return Keypair.fromSecretKey(secretKeyBytes);
  }

  async getBalance(publicKey: string): Promise<number> {
    try {
      const pubKey = new PublicKey(publicKey);
      const balance = await this.connection.getBalance(pubKey);
      return balance / LAMPORTS_PER_SOL;
    } catch (error: any) {
      console.warn(`⚠️ Balance fetch error for ${publicKey}:`, error?.message || error);
      return 0;
    }
  }

  async getTokenBalance(walletPublicKey: string, tokenMint: string): Promise<number> {
    try {
      const walletPubKey = new PublicKey(walletPublicKey);
      const mintPubKey = new PublicKey(tokenMint);

      const tokenAccount = await getAssociatedTokenAddress(mintPubKey, walletPubKey);
      
      const accountInfo = await getAccount(this.connection, tokenAccount);
      
      return Number(accountInfo.amount);
    } catch (error) {
      console.log(`No token account found for ${tokenMint}`);
      return 0;
    }
  }

  async getPortfolio(publicKey: string): Promise<any> {
    const solBalance = await this.getBalance(publicKey);
    const walletPubKey = new PublicKey(publicKey);
    
    const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(
      walletPubKey,
      { programId: TOKEN_PROGRAM_ID }
    );

    const tokens: any[] = [];
    for (const account of tokenAccounts.value) {
      const parsedInfo = account.account.data.parsed.info;
      const mintAddress = parsedInfo.mint;
      const balance = parsedInfo.tokenAmount.uiAmount;
      const decimals = parsedInfo.tokenAmount.decimals;

      if (balance > 0) {
        tokens.push({
          mint: mintAddress,
          balance,
          decimals
        });
      }
    }
    
    return {
      publicKey,
      solBalance,
      tokens
    };
  }

  async transferSOL(fromKeypair: Keypair, toPublicKey: string, amountSOL: number): Promise<string> {
    const {
      SystemProgram,
      Transaction,
      sendAndConfirmTransaction
    } = await import('@solana/web3.js');
    
    const toPubKey = new PublicKey(toPublicKey);
    const lamports = Math.floor(amountSOL * LAMPORTS_PER_SOL);
    
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: fromKeypair.publicKey,
        toPubkey: toPubKey,
        lamports
      })
    );
    
    const signature = await sendAndConfirmTransaction(
      this.connection,
      transaction,
      [fromKeypair],
      { commitment: 'confirmed' }
    );
    
    return signature;
  }

  getConnection(): Connection {
    return this.connection;
  }
}
