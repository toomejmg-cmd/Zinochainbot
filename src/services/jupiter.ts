import axios from 'axios';
import { Connection, Keypair, VersionedTransaction, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import { getMint } from '@solana/spl-token';

// Jupiter FREE Lite API endpoint (no authentication required)
const JUPITER_LITE_API = 'https://lite-api.jup.ag/swap/v1';

export interface QuoteResponse {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  priceImpactPct: string;
  routePlan: any[];
}

export class JupiterService {
  private connection: Connection;

  constructor(connection: Connection) {
    this.connection = connection;
  }

  async getQuote(
    inputMint: string,
    outputMint: string,
    amount: number,
    slippageBps: number = 200,
    retries: number = 3
  ): Promise<QuoteResponse> {
    console.log(`🔍 Getting quote: ${inputMint} → ${outputMint}, amount: ${amount}, slippage: ${slippageBps}bps`);
    
    let lastError: any;
    
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const quoteUrl = `${JUPITER_LITE_API}/quote`;
        console.log(`📡 Calling swap service (attempt ${attempt}/${retries}): ${quoteUrl}`);
        
        const response = await axios.get(quoteUrl, {
          params: {
            inputMint,
            outputMint,
            amount: amount.toString(),
            slippageBps,
            onlyDirectRoutes: false,
            maxAccounts: 64
          },
          timeout: 15000,
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'ZinochainBot/1.0'
          }
        });

        if (!response.data) {
          throw new Error('No quote received from swap service');
        }

        console.log(`✅ Quote received: ${response.data.outAmount} output tokens`);
        return response.data;
      } catch (error: any) {
        lastError = error;
        const status = error?.response?.status;
        
        // 429 = Rate Limited, 503 = Service Unavailable - retry with backoff
        if ((status === 429 || status === 503) && attempt < retries) {
          const delay = Math.pow(2, attempt - 1) * 1000; // Exponential backoff: 1s, 2s, 4s
          console.log(`⏳ Rate limited or service unavailable. Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        const errorDetails = {
          message: error?.message,
          code: error?.code,
          status: status,
          inputMint,
          outputMint,
          amount,
          attempt
        };
        console.error(`❌ Swap quote error (attempt ${attempt}/${retries}):`, JSON.stringify(errorDetails, null, 2));
        
        // If it's the last attempt, throw
        if (attempt === retries) {
          throw error;
        }
      }
    }
    
    throw new Error(`Failed to get quote after ${retries} attempts: ${lastError?.message || lastError}`);
  }

  async executeSwap(
    keypair: Keypair,
    quoteResponse: QuoteResponse,
    prioritizationFeeLamports: number = 50000,
    retries: number = 3
  ): Promise<string> {
    let lastError: any;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        console.log(`💫 Executing swap (attempt ${attempt}/${retries}): ${quoteResponse.inAmount} → ${quoteResponse.outAmount}`);
        
        const swapUrl = `${JUPITER_LITE_API}/swap`;
        console.log(`📡 Calling swap service: ${swapUrl}`);
        
        const swapResponse = await axios.post(swapUrl, {
          quoteResponse,
          userPublicKey: keypair.publicKey.toString(),
          wrapAndUnwrapSol: true,
          autoCreateUserAssociatedTokenAccount: true,
          prioritizationFeeLamports: prioritizationFeeLamports
        }, {
          timeout: 30000,
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'User-Agent': 'ZinochainBot/1.0'
          }
        });

        if (!swapResponse?.data?.swapTransaction) {
          throw new Error('No swap transaction received from service');
        }

        console.log(`✅ Swap transaction created`);
        const swapTransactionBuf = Buffer.from(swapResponse.data.swapTransaction, 'base64');
        const transaction = VersionedTransaction.deserialize(swapTransactionBuf);

        transaction.sign([keypair]);

        const latestBlockHash = await this.connection.getLatestBlockhash();
        
        const rawTransaction = transaction.serialize();
        const txid = await this.connection.sendRawTransaction(rawTransaction, {
          skipPreflight: true,
          maxRetries: 3
        });

        console.log(`📝 Transaction sent: ${txid}`);

        const confirmation = await this.connection.confirmTransaction({
          blockhash: latestBlockHash.blockhash,
          lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
          signature: txid
        }, 'confirmed');

        if (confirmation.value.err) {
          throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
        }

        console.log(`✅ Swap confirmed!`);
        return txid;
      } catch (error: any) {
        lastError = error;
        const status = error?.response?.status;

        // 429 = Rate Limited, 503 = Service Unavailable - retry with backoff
        if ((status === 429 || status === 503) && attempt < retries) {
          const delay = Math.pow(2, attempt - 1) * 1000; // Exponential backoff: 1s, 2s, 4s
          console.log(`⏳ Rate limited or service unavailable. Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        const errorDetails = {
          status: status,
          data: error?.response?.data,
          message: error?.message,
          code: error?.code,
          attempt
        };
        console.error(`❌ Swap execution error (attempt ${attempt}/${retries}):`, JSON.stringify(errorDetails, null, 2));

        // If it's the last attempt, throw
        if (attempt === retries) {
          throw error;
        }
      }
    }
    
    throw new Error(`Failed to execute swap after ${retries} attempts: ${lastError?.message || lastError}`);
  }

  async swap(
    keypair: Keypair,
    inputMint: string,
    outputMint: string,
    amount: number,
    slippageBps: number = 50
  ): Promise<string> {
    // Increase slippage for reliability
    const effectiveSlippage = Math.max(slippageBps, 200);
    console.log(`🔧 Using effective slippage: ${effectiveSlippage}bps (requested: ${slippageBps}bps)`);
    
    const quote = await this.getQuote(inputMint, outputMint, amount, effectiveSlippage);
    const signature = await this.executeSwap(keypair, quote, 100000);
    return signature;
  }

  async getTokenDecimals(mintAddress: string): Promise<number> {
    try {
      if (mintAddress === NATIVE_SOL_MINT) {
        return 9;
      }
      
      const mintPubKey = new PublicKey(mintAddress);
      const mintInfo = await getMint(this.connection, mintPubKey);
      return mintInfo.decimals;
    } catch (error) {
      console.error('Error fetching token decimals:', error);
      return 9;
    }
  }
}

export const NATIVE_SOL_MINT = 'So11111111111111111111111111111111111111112';
export const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
export const USDT_MINT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';
