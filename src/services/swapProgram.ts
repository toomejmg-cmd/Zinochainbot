/**
 * Zinochain Swap Program Integration
 * Handles atomic swaps with fee collection via smart contract
 * 
 * NOTE: This service integrates with the deployed Zinochain smart contract
 * to enable atomic fee collection + swaps. Deploy the contract first.
 * See: SMART_CONTRACT_DEPLOYMENT.md
 */

import { Connection, PublicKey, Keypair, Transaction, SystemProgram, TransactionInstruction } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createAssociatedTokenAccountIdempotentInstruction } from '@solana/spl-token';

interface SwapProgramConfig {
  programId: string;
  configPda: string;
  connection: Connection;
}

export class SwapProgramService {
  private programId: PublicKey;
  private configPda: PublicKey;
  private connection: Connection;

  constructor(config: SwapProgramConfig) {
    this.programId = new PublicKey(config.programId);
    this.configPda = new PublicKey(config.configPda);
    this.connection = config.connection;
  }

  /**
   * Execute swap with automatic fee deduction via smart contract
   * @param userKeypair - User's keypair
   * @param inputMint - Input token mint (usually SOL)
   * @param outputMint - Output token mint
   * @param amountIn - Amount to swap (includes fees)
   * @param minAmountOut - Minimum output amount after fees
   * @returns Transaction signature
   */
  async swapWithFee(
    userKeypair: Keypair,
    inputMint: PublicKey,
    outputMint: PublicKey,
    amountIn: number,
    minAmountOut: number,
    feeBps: number = 100 // 1% default
  ): Promise<string> {
    try {
      const user = userKeypair.publicKey;
      
      // Calculate actual amounts
      const feeAmount = Math.floor((amountIn * feeBps) / 10000);
      const tradeAmount = amountIn - feeAmount;

      // Get token accounts
      const userInputAta = await getAssociatedTokenAddress(inputMint, user);
      const configFeeAta = await this.getConfigFeeAccount(outputMint);

      // Check if output ATA exists, create if needed
      const userOutputAta = await getAssociatedTokenAddress(outputMint, user);

      // Build transaction
      const transaction = new Transaction();

      // Add create ATA instruction if needed
      const userOutputAtaInfo = await this.connection.getAccountInfo(userOutputAta);
      if (!userOutputAtaInfo) {
        transaction.add(
          createAssociatedTokenAccountIdempotentInstruction(
            user,
            userOutputAta,
            user,
            outputMint
          )
        );
      }

      // Create swap instruction
      const swapInstruction = await this.createSwapWithFeeInstruction(
        user,
        userInputAta,
        configFeeAta,
        amountIn,
        minAmountOut
      );

      transaction.add(swapInstruction);

      // Set recent blockhash
      const { blockhash } = await this.connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = user;

      // Sign transaction
      transaction.sign(userKeypair);

      // Send transaction
      const signature = await this.connection.sendTransaction(transaction, [userKeypair], {
        skipPreflight: false,
        maxRetries: 3,
      });

      // Wait for confirmation
      await this.connection.confirmTransaction(signature, 'confirmed');

      console.log(`✅ Swap executed: ${signature}`);
      return signature;
    } catch (error) {
      console.error('Swap failed:', error);
      throw error;
    }
  }

  /**
   * Create swap with fee instruction
   */
  private async createSwapWithFeeInstruction(
    user: PublicKey,
    userInputAta: PublicKey,
    feeAta: PublicKey,
    amountIn: number,
    minAmountOut: number
  ): Promise<Transaction> {
    // Encode amounts for the instruction
    const amountInBuf = Buffer.allocUnsafe(8);
    amountInBuf.writeBigUInt64LE(BigInt(amountIn));
    const minAmountOutBuf = Buffer.allocUnsafe(8);
    minAmountOutBuf.writeBigUInt64LE(BigInt(minAmountOut));

    // Swap with fee discriminator (8 bytes)
    const discriminator = Buffer.from([0xc7, 0x73, 0x4a, 0x5a, 0x47, 0x73, 0x82, 0xa3]);

    const data = Buffer.concat([
      discriminator,
      amountInBuf,
      minAmountOutBuf,
    ]);

    const tx = new Transaction();
    tx.add(
      new TransactionInstruction({
        programId: this.programId,
        keys: [
          { pubkey: this.configPda, isSigner: false, isWritable: false },
          { pubkey: userInputAta, isSigner: false, isWritable: true },
          { pubkey: feeAta, isSigner: false, isWritable: true },
          { pubkey: user, isSigner: true, isWritable: false },
          { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        ],
        data,
      })
    );

    return tx;
  }

  /**
   * Get the config fee account PDA
   */
  private async getConfigFeeAccount(outputMint: PublicKey): Promise<PublicKey> {
    // This would be derived from the program's state account
    // For now, placeholder implementation
    return new PublicKey('11111111111111111111111111111111');
  }

  /**
   * Update fee percentage (admin only)
   */
  async updateFee(adminKeypair: Keypair, newFeeBps: number): Promise<string> {
    // This would create an update_fee instruction
    // Placeholder for now
    console.log(`Fee update pending: ${newFeeBps} bps`);
    return 'pending';
  }

  /**
   * Verify swap was executed correctly
   */
  async verifySwan(signature: string): Promise<boolean> {
    try {
      const tx = await this.connection.getTransaction(signature);
      return tx !== null && tx.meta?.err === null;
    } catch (error) {
      console.error('Failed to verify swap:', error);
      return false;
    }
  }
}

/**
 * Create swap program service from environment
 */
export function createSwapProgramService(connection: Connection): SwapProgramService {
  const programId = process.env.SWAP_PROGRAM_ID || '';
  const configPda = process.env.SWAP_CONFIG_PDA || '';

  if (!programId || !configPda) {
    throw new Error('Missing SWAP_PROGRAM_ID or SWAP_CONFIG_PDA environment variables');
  }

  return new SwapProgramService({
    programId,
    configPda,
    connection,
  });
}
