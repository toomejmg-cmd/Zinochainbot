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
import { ethers } from 'ethers';

export class TransferService {
  private connection: Connection;
  private ethProvider: ethers.JsonRpcProvider;
  private bscProvider: ethers.JsonRpcProvider;

  constructor(connection: Connection) {
    this.connection = connection;
    this.ethProvider = new ethers.JsonRpcProvider('https://eth.llamarpc.com');
    this.bscProvider = new ethers.JsonRpcProvider('https://bsc-dataseed.binance.org');
  }

  async transferSOL(
    senderKeypair: Keypair,
    recipientAddress: string,
    amount: number,
    senderId: number,
    recipientId: number | null,
    feeAmount: number = 0
  ): Promise<string> {
    try {
      const recipientPubkey = new PublicKey(recipientAddress);
      
      const lamports = Math.floor(amount * LAMPORTS_PER_SOL);
      const feeLamports = Math.floor(feeAmount * LAMPORTS_PER_SOL);
      const totalLamports = lamports + feeLamports;

      const balance = await this.connection.getBalance(senderKeypair.publicKey);
      if (balance < totalLamports) {
        throw new Error('Insufficient SOL balance');
      }

      const transaction = new Transaction();
      
      // Add main transfer
      transaction.add(
        SystemProgram.transfer({
          fromPubkey: senderKeypair.publicKey,
          toPubkey: recipientPubkey,
          lamports
        })
      );

      // Add fee transfer if fee wallet is set
      const feeWalletEnv = process.env.FEE_WALLET_SOLANA || process.env.FEE_WALLET;
      if (feeLamports > 0 && feeWalletEnv) {
        try {
          const feeWalletPubkey = new PublicKey(feeWalletEnv);
          transaction.add(
            SystemProgram.transfer({
              fromPubkey: senderKeypair.publicKey,
              toPubkey: feeWalletPubkey,
              lamports: feeLamports
            })
          );
        } catch (err) {
          console.warn('Invalid fee wallet address, skipping fee');
        }
      }

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

  async transferETH(
    senderPrivateKey: string,
    recipientAddress: string,
    amount: number,
    senderId: number,
    recipientId: number | null,
    feeAmount: number = 0
  ): Promise<string> {
    try {
      const wallet = new ethers.Wallet(senderPrivateKey, this.ethProvider);
      const weiAmount = ethers.parseEther(amount.toString());
      const weiFeAmount = ethers.parseEther(feeAmount.toString());

      // Send to recipient
      const tx = await wallet.sendTransaction({
        to: recipientAddress,
        value: weiAmount
      });
      
      const receipt = await tx.wait();
      const txHash = receipt?.hash || tx.hash as string;

      // Send fee if configured
      const feeWallet = process.env.FEE_WALLET_ETHEREUM || process.env.FEE_WALLET;
      if (feeAmount > 0 && feeWallet && ethers.isAddress(feeWallet)) {
        try {
          const feeTx = await wallet.sendTransaction({
            to: feeWallet,
            value: weiFeAmount
          });
          await feeTx.wait();
        } catch (err) {
          console.warn('Fee transfer failed:', err);
        }
      }

      await this.recordTransfer(
        senderId,
        recipientId,
        recipientAddress,
        'ETH',
        'ETH',
        amount,
        txHash,
        'completed'
      );

      return txHash;
    } catch (error) {
      console.error('ETH transfer error:', error);
      await this.recordTransfer(
        senderId,
        recipientId,
        recipientAddress,
        'ETH',
        'ETH',
        amount,
        null,
        'failed'
      );
      throw error;
    }
  }

  async transferBNB(
    senderPrivateKey: string,
    recipientAddress: string,
    amount: number,
    senderId: number,
    recipientId: number | null,
    feeAmount: number = 0
  ): Promise<string> {
    try {
      const wallet = new ethers.Wallet(senderPrivateKey, this.bscProvider);
      const weiAmount = ethers.parseEther(amount.toString());
      const weiFeAmount = ethers.parseEther(feeAmount.toString());

      // Send to recipient
      const tx = await wallet.sendTransaction({
        to: recipientAddress,
        value: weiAmount
      });
      
      const receipt = await tx.wait();
      const txHash = receipt?.hash || tx.hash as string;

      // Send fee if configured
      const feeWallet = process.env.FEE_WALLET_BSC || process.env.FEE_WALLET;
      if (feeAmount > 0 && feeWallet && ethers.isAddress(feeWallet)) {
        try {
          const feeTx = await wallet.sendTransaction({
            to: feeWallet,
            value: weiFeAmount
          });
          await feeTx.wait();
        } catch (err) {
          console.warn('Fee transfer failed:', err);
        }
      }

      await this.recordTransfer(
        senderId,
        recipientId,
        recipientAddress,
        'BNB',
        'BNB',
        amount,
        txHash,
        'completed'
      );

      return txHash;
    } catch (error) {
      console.error('BNB transfer error:', error);
      await this.recordTransfer(
        senderId,
        recipientId,
        recipientAddress,
        'BNB',
        'BNB',
        amount,
        null,
        'failed'
      );
      throw error;
    }
  }
}
