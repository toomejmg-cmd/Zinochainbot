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
      // Check if this is a SOL-based swap or token swap
      const isSolInput = inputMint === NATIVE_SOL_MINT;
      
      let amountInTokenUnits: number;
      let amountDisplayUnit: string;
      
      if (isSolInput) {
        amountInTokenUnits = amountInLamports / LAMPORTS_PER_SOL;
        amountDisplayUnit = 'SOL';
      } else {
        // For non-SOL inputs, amount is already in token units (e.g., USDC)
        amountInTokenUnits = amountInLamports;
        amountDisplayUnit = 'tokens';
      }
      
      console.log(`💰 Fee-aware swap initiated: ${amountInTokenUnits} ${amountDisplayUnit} → ${outputMint}`);
      console.log(`🔹 Input mint: ${inputMint}`);

      // Calculate fee (always 0.5% of input amount)
      const feeAmount = this.feeService.calculateFee(amountInTokenUnits);
      const swapAmount = amountInTokenUnits - feeAmount;
      const feeWallet = this.feeService.getFeeWallet();

      console.log(`📊 Fee breakdown:`);
      console.log(`   Total: ${amountInTokenUnits.toFixed(4)} ${amountDisplayUnit}`);
      console.log(`   Fee (${this.feeService.getFeePercentage()}%): ${feeAmount.toFixed(4)} ${amountDisplayUnit}`);
      console.log(`   Swap amount: ${swapAmount.toFixed(4)} ${amountDisplayUnit}`);
      console.log(`💼 Fee wallet retrieved: ${feeWallet || 'EMPTY/NULL'}`);

      // Step 1: Deduct SOL fee ONLY for SOL inputs (MANDATORY)
      if (isSolInput && feeWallet && feeAmount > 0) {
        console.log(`💸 Step 1: Transferring ${feeAmount.toFixed(6)} SOL to fee wallet ${feeWallet}...`);
        console.log(`   🔑 User keypair: ${keypair.publicKey.toString()}`);
        console.log(`   💰 Fee amount in SOL: ${feeAmount.toFixed(6)}`);
        console.log(`   📍 Fee destination: ${feeWallet}`);
        
        try {
          const feeTxSignature = await this.walletManager.transferSOL(
            keypair,
            feeWallet,
            feeAmount
          );
          console.log(`✅ Fee transfer successful!`);
          console.log(`   📝 Signature: ${feeTxSignature}`);
          console.log(`   🔗 Check: https://solscan.io/tx/${feeTxSignature}?cluster=mainnet-beta`);
        } catch (feeError: any) {
          console.error(`❌ CRITICAL: Fee transfer FAILED - Aborting swap!`);
          console.error(`   Error: ${feeError?.message || feeError}`);
          throw new Error(
            `Fee payment failed: ${feeError?.message || feeError}. ` +
            `No swap will be executed. Please check your balance and try again.`
          );
        }
      } else if (!isSolInput) {
        console.log(`ℹ️  Fee collection for non-SOL inputs (output): Will transfer ${feeAmount.toFixed(6)} SOL AFTER swap completes`);
      } else if (isSolInput && !feeWallet) {
        throw new Error(`Fee wallet not configured. Cannot proceed with swap.`);
      }

      // Step 2: Execute swap with remaining amount
      console.log(`🔄 Step 2: Executing swap with ${swapAmount.toFixed(4)} ${amountDisplayUnit}...`);
      
      // Convert swap amount based on input type
      let swapAmountInSmallestUnit: number;
      if (isSolInput) {
        swapAmountInSmallestUnit = Math.floor(swapAmount * LAMPORTS_PER_SOL);
      } else {
        swapAmountInSmallestUnit = Math.floor(swapAmount);
      }
      
      const signature = await this.jupiterService.swap(
        keypair,
        inputMint,
        outputMint,
        swapAmountInSmallestUnit,
        slippageBps
      );

      console.log(`✅ Swap successful! Signature: ${signature}`);

      // Step 3: Record transaction AND fees
      let transactionId: number | null = null;
      let feeRecorded = false;
      
      try {
        transactionId = await this.recordSwapTransaction(
          signature,
          walletId,
          userId,
          inputMint,
          outputMint,
          amountInTokenUnits,
          feeAmount
        );
        feeRecorded = transactionId !== null;
      } catch (recordError: any) {
        console.error(`⚠️  Transaction recording failed:`, recordError);
      }
      
      // Always ensure fee is recorded, even if transaction recording fails
      if (!feeRecorded && feeAmount > 0) {
        console.log(`📝 Fee recording - attempting fallback...`);
        try {
          await this.feeService.recordFee(null, userId, feeAmount, 'trading', inputMint);
          console.log(`✅ Fee recorded in fallback (${feeAmount.toFixed(6)} SOL, tx: ${signature})`);
          feeRecorded = true;
        } catch (feeRecordError: any) {
          console.error(`❌ Failed to record fee in fallback:`, feeRecordError);
        }
      }
      
      if (!feeRecorded && feeAmount > 0) {
        console.warn(`⚠️  WARNING: Fee was NOT recorded in database! Tx: ${signature}, Fee: ${feeAmount.toFixed(6)} SOL`);
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
