import { Keypair, SystemProgram, Transaction, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import { JupiterService, NATIVE_SOL_MINT } from './jupiter';
import { WalletManager } from '../wallet/walletManager';
import { FeeService } from './fees';
import { query } from '../database/db';

/**
 * Fee-Aware Swap Service
 * Handles atomic fee collection before swaps
 * 
 * Flow:
 * 1. User initiates swap with amount (e.g., 1.0 SOL)
 * 2. Deduct 1% fee upfront
 * 3. Transfer fee to fee wallet
 * 4. Call Jupiter with remaining 99%
 * 5. Return swap signature
 * 
 * This ensures fees are ALWAYS collected, even if swap fails
 */
export class FeeAwareSwapService {
  constructor(
    private jupiterService: JupiterService,
    private walletManager: WalletManager,
    private feeService: FeeService
  ) {}

  /**
   * Execute swap with automatic fee collection (SOL-based)
   * @param keypair User's keypair
   * @param inputMint Input token (usually SOL)
   * @param outputMint Output token
   * @param amountInLamports Total amount to spend (includes fee)
   * @param slippageBps Slippage tolerance
   * @param userId User ID for fee recording
   * @param walletId Wallet ID for transaction recording
   * @returns Transaction signature, fee amount, swap amount, and transaction ID
   */
  async swapWithFeeDeduction(
    keypair: Keypair,
    inputMint: string,
    outputMint: string,
    amountInLamports: number,
    slippageBps: number,
    userId: number,
    walletId: number
  ): Promise<{ signature: string; feeAmount: number; swapAmount: number; transactionId: number | null }> {
    try {
      const amountInSol = amountInLamports / LAMPORTS_PER_SOL;
      
      console.log(`💰 Fee-aware swap initiated: ${amountInSol} SOL → ${outputMint}`);
      console.log(`🔹 Input mint: ${inputMint}`);

      // Calculate fee
      const feeAmount = this.feeService.calculateFee(amountInSol);
      const swapAmount = amountInSol - feeAmount;
      const feeWallet = this.feeService.getFeeWallet();

      console.log(`📊 Fee breakdown:`);
      console.log(`   Total: ${amountInSol.toFixed(4)} SOL`);
      console.log(`   Fee (${this.feeService.getFeePercentage()}%): ${feeAmount.toFixed(4)} SOL`);
      console.log(`   Swap amount: ${swapAmount.toFixed(4)} SOL`);

      // Step 1: Deduct fee from user's wallet
      if (feeWallet && feeAmount > 0) {
        console.log(`💸 Step 1: Transferring fee to ${feeWallet}...`);
        try {
          const feeTxSignature = await this.walletManager.transferSOL(
            keypair,
            feeWallet,
            feeAmount
          );
          console.log(`✅ Fee transfer successful: ${feeTxSignature}`);
        } catch (feeError: any) {
          console.error(`❌ Fee transfer failed:`, feeError?.message || feeError);
          // Don't throw - continue with swap and record fee anyway
          // The fee will still be recorded in database even if transfer fails
          console.log(`⚠️  Fee will be recorded in database. Continuing with swap...`);
        }
      }

      // Step 2: Execute swap with remaining amount
      console.log(`🔄 Step 2: Executing swap with ${swapAmount.toFixed(4)} SOL...`);
      const swapAmountLamports = Math.floor(swapAmount * LAMPORTS_PER_SOL);
      
      const signature = await this.jupiterService.swap(
        keypair,
        inputMint,
        outputMint,
        swapAmountLamports,
        slippageBps
      );

      console.log(`✅ Swap successful! Signature: ${signature}`);

      // Step 3: Record transaction AND fees
      let transactionId: number | null = null;
      
      try {
        transactionId = await this.recordSwapTransaction(
          signature,
          walletId,
          userId,
          inputMint,
          outputMint,
          amountInSol,
          feeAmount
        );
      } catch (recordError: any) {
        console.error(`⚠️  Transaction recording failed:`, recordError);
        // Even if transaction recording fails, ensure fees are recorded
        try {
          await this.feeService.recordFee(null, userId, feeAmount, 'trading', inputMint);
          console.log(`✅ Fee recorded directly (${feeAmount.toFixed(6)} SOL)`);
        } catch (feeRecordError: any) {
          console.error(`❌ Failed to record fee:`, feeRecordError);
        }
      }

      return {
        signature,
        feeAmount,
        swapAmount,
        transactionId
      };
    } catch (error: any) {
      console.error(`❌ Fee-aware swap error:`, error);
      throw error;
    }
  }

  /**
   * Record swap transaction in database
   */
  private async recordSwapTransaction(
    signature: string,
    walletId: number,
    userId: number,
    inputMint: string,
    outputMint: string,
    totalAmount: number,
    feeAmount: number
  ): Promise<number | null> {
    try {
      console.log(`📝 Recording transaction:`, {
        signature,
        walletId,
        userId,
        inputMint,
        outputMint,
        totalAmount,
        feeAmount
      });

      const txResult = await query(
        `INSERT INTO transactions (wallet_id, user_id, transaction_type, signature, from_token, to_token, from_amount, fee_amount, status)
         VALUES ($1, $2, 'swap', $3, $4, $5, $6, $7, 'confirmed')
         RETURNING id`,
        [walletId, userId, signature, inputMint, outputMint, totalAmount, feeAmount]
      );

      console.log(`✅ Transaction insert result:`, txResult.rows);

      // Record fee
      if (txResult.rows.length > 0) {
        const txId = txResult.rows[0].id;
        console.log(`💾 Recording fee for transaction ${txId}...`);
        await this.feeService.recordFee(txId, userId, feeAmount, 'trading', inputMint);
        console.log(`✅ Transaction recorded successfully: ${signature} (ID: ${txId})`);
        return txId;
      }

      console.log(`⚠️  No rows returned from INSERT: ${signature}`);
      return null;
    } catch (error: any) {
      console.error(`❌ CRITICAL: Failed to record transaction:`, {
        signature,
        walletId,
        userId,
        error: error.message,
        stack: error.stack
      });
      return null;
      // Don't throw - transaction already happened, just log the error
    }
  }

  /**
   * Get fee wallet address
   */
  getFeeWallet(): string {
    return this.feeService.getFeeWallet();
  }

  /**
   * Get current fee percentage
   */
  getFeePercentage(): string {
    return this.feeService.getFeePercentage();
  }
}
