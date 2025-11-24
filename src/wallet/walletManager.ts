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
      // Return 0 instead of throwing, so UI can still show the page
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
    try {
      console.log(`📊 Fetching portfolio for: ${publicKey}`);
      const solBalance = await this.getBalance(publicKey);
      console.log(`💰 SOL Balance: ${solBalance}`);

      const walletPubKey = new PublicKey(publicKey);
      console.log(`🔍 Fetching token accounts...`);
      
      const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(
        walletPubKey,
        { programId: TOKEN_PROGRAM_ID }
      );

      console.log(`✅ Found ${tokenAccounts.value.length} token accounts`);

      const tokens: any[] = [];
      for (const account of tokenAccounts.value) {
        try {
          const parsedInfo = account.account.data.parsed.info;
          const mintAddress = parsedInfo.mint;
          const balance = parsedInfo.tokenAmount.uiAmount;
          const decimals = parsedInfo.tokenAmount.decimals;

          if (balance > 0) {
            console.log(`  🪙 Token: ${mintAddress} - Balance: ${balance}`);
            tokens.push({
              mint: mintAddress,
              balance,
              decimals
            });
          }
        } catch (tokenError) {
          console.warn(`⚠️  Error parsing token account:`, tokenError);
        }
      }

      console.log(`📋 Portfolio complete: ${tokens.length} tokens with balance`);
      return {
        publicKey,
        solBalance,
        tokens
      };
    } catch (error: any) {
      console.error(`❌ Portfolio fetch error:`, error?.message || error);
      // Return empty portfolio instead of crashing
      return {
        publicKey,
        solBalance: 0,
        tokens: []
      };
    }
  }

  async transferSOL(fromKeypair: Keypair, toPublicKey: string, amountSOL: number): Promise<string> {
    const {
      SystemProgram,
      Transaction,
      sendAndConfirmTransaction
    } = await import('@solana/web3.js');
    
    const toPubKey = new PublicKey(toPublicKey);
    const lamports = Math.floor(amountSOL * LAMPORTS_PER_SOL);
    
    // Get rent exemption minimum
    const rentMinimum = await this.connection.getMinimumBalanceForRentExemption(0);
    console.log(`💾 Rent exemption minimum: ${rentMinimum} lamports (${rentMinimum / LAMPORTS_PER_SOL} SOL)`);
    
    // Check if destination account exists
    const destInfo = await this.connection.getAccountInfo(toPubKey);
    if (!destInfo) {
      console.log(`📍 Destination account doesn't exist, need to account for rent: ${rentMinimum} lamports`);
    }
    
    // Check sender balance
    const senderBalance = await this.connection.getBalance(fromKeypair.publicKey);
    console.log(`💰 Sender balance: ${senderBalance} lamports (${senderBalance / LAMPORTS_PER_SOL} SOL)`);
    
    if (senderBalance < lamports + 5000) {  // 5000 lamports for transaction fee
      throw new Error(`Insufficient balance: need ${(lamports + 5000) / LAMPORTS_PER_SOL} SOL, have ${senderBalance / LAMPORTS_PER_SOL} SOL`);
    }
    
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
    
    console.log(`✅ SOL transfer successful: ${amountSOL} SOL to ${toPublicKey}`);
    return signature;
  }

  getConnection(): Connection {
    return this.connection;
  }
}
