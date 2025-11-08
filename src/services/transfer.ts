import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL, Keypair } from '@solana/web3.js';
import { 
  getAssociatedTokenAddress, 
  createTransferInstruction, 
  createAssociatedTokenAccountInstruction,
  getAccount,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID
} from '@solana/spl-token';
import { query } from '../database/db';

export class TransferService {
  private connection: Connection;

  constructor(connection: Connection) {
    this.connection = connection;
  }

  async transferSOL(
    senderKeypair: Keypair,
    recipientAddress: string,
    amount: number,
    senderId: number,
    recipientId: number | null
  ): Promise<string> {
    try {
      const recipientPubkey = new PublicKey(recipientAddress);
      
      const lamports = Math.floor(amount * LAMPORTS_PER_SOL);

      const balance = await this.connection.getBalance(senderKeypair.publicKey);
      if (balance < lamports) {
        throw new Error('Insufficient SOL balance');
      }

      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: senderKeypair.publicKey,
          toPubkey: recipientPubkey,
          lamports
        })
      );

      const signature = await this.connection.sendTransaction(transaction, [senderKeypair]);
      await this.connection.confirmTransaction(signature);

      await this.recordTransfer(
        senderId,
        recipientId,
        recipientAddress,
        'So11111111111111111111111111111111111111112',
        'SOL',
        amount,
        signature,
        'completed'
      );

      return signature;
    } catch (error) {
      console.error('SOL transfer error:', error);
      
      await this.recordTransfer(
        senderId,
        recipientId,
        recipientAddress,
        'So11111111111111111111111111111111111111112',
        'SOL',
        amount,
        null,
        'failed'
      );
      
      throw error;
    }
  }

  async transferSPLToken(
    senderKeypair: Keypair,
    recipientAddress: string,
    tokenMint: string,
    amount: number,
    decimals: number,
    senderId: number,
    recipientId: number | null,
    tokenSymbol?: string
  ): Promise<string> {
    try {
      const recipientPubkey = new PublicKey(recipientAddress);
      const mintPubkey = new PublicKey(tokenMint);

      const senderTokenAccount = await getAssociatedTokenAddress(
        mintPubkey,
        senderKeypair.publicKey
      );

      const recipientTokenAccount = await getAssociatedTokenAddress(
        mintPubkey,
        recipientPubkey
      );

      const tokenAmount = Math.floor(amount * Math.pow(10, decimals));

      const senderBalance = await this.connection.getTokenAccountBalance(senderTokenAccount);
      if (parseInt(senderBalance.value.amount) < tokenAmount) {
        throw new Error(`Insufficient ${tokenSymbol || 'token'} balance`);
      }

      const transaction = new Transaction();

      let recipientAccountExists = true;
      try {
        await getAccount(this.connection, recipientTokenAccount);
      } catch (error) {
        recipientAccountExists = false;
      }

      if (!recipientAccountExists) {
        transaction.add(
          createAssociatedTokenAccountInstruction(
            senderKeypair.publicKey,
            recipientTokenAccount,
            recipientPubkey,
            mintPubkey,
            TOKEN_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID
          )
        );
      }

      transaction.add(
        createTransferInstruction(
          senderTokenAccount,
          recipientTokenAccount,
          senderKeypair.publicKey,
          tokenAmount,
          [],
          TOKEN_PROGRAM_ID
        )
      );

      const signature = await this.connection.sendTransaction(transaction, [senderKeypair]);
      await this.connection.confirmTransaction(signature);

      await this.recordTransfer(
        senderId,
        recipientId,
        recipientAddress,
        tokenMint,
        tokenSymbol || 'UNKNOWN',
        amount,
        signature,
        'completed'
      );

      return signature;
    } catch (error) {
      console.error('SPL token transfer error:', error);
      
      await this.recordTransfer(
        senderId,
        recipientId,
        recipientAddress,
        tokenMint,
        tokenSymbol || 'UNKNOWN',
        amount,
        null,
        'failed'
      );
      
      throw error;
    }
  }

  private async recordTransfer(
    senderId: number,
    recipientId: number | null,
    recipientWallet: string,
    tokenMint: string,
    tokenSymbol: string,
    amount: number,
    signature: string | null,
    status: string
  ): Promise<void> {
    try {
      await query(
        `INSERT INTO transfers (sender_id, recipient_id, recipient_wallet, token_mint, token_symbol, amount, transaction_signature, status, completed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          senderId,
          recipientId,
          recipientWallet,
          tokenMint,
          tokenSymbol,
          amount,
          signature,
          status,
          status === 'completed' ? new Date() : null
        ]
      );
    } catch (error) {
      console.error('Error recording transfer:', error);
    }
  }

  async getTransferHistory(userId: number): Promise<any[]> {
    try {
      const result = await query(
        `SELECT t.*, 
                recipient.username as recipient_username,
                recipient.telegram_id as recipient_telegram_id
         FROM transfers t
         LEFT JOIN users recipient ON recipient.id = t.recipient_id
         WHERE t.sender_id = $1
         ORDER BY t.created_at DESC
         LIMIT 20`,
        [userId]
      );
      return result.rows;
    } catch (error) {
      console.error('Error fetching transfer history:', error);
      return [];
    }
  }
}
