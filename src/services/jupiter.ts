import axios from 'axios';
import { Connection, Keypair, VersionedTransaction, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import { getMint } from '@solana/spl-token';

// Multiple Jupiter endpoints for redundancy
const JUPITER_ENDPOINTS = [
  'https://quote-api.jup.ag/v6',  // Official Jupiter endpoint
  'https://api.jup.ag/v6'           // Alternative Jupiter endpoint
];

let JUPITER_API = JUPITER_ENDPOINTS[0];

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
    slippageBps: number = 50
  ): Promise<QuoteResponse> {
    console.log(`🔍 Getting quote: ${inputMint} → ${outputMint}, amount: ${amount}, slippage: ${slippageBps}bps`);
    
    // Try multiple Jupiter endpoints with fallback
    let lastError: any = null;
    
    for (let i = 0; i < JUPITER_ENDPOINTS.length; i++) {
      try {
        const baseEndpoint = JUPITER_ENDPOINTS[i];
        const quoteUrl = `${baseEndpoint}/quote`;
        console.log(`📡 Trying Jupiter endpoint ${i + 1}/${JUPITER_ENDPOINTS.length}: ${quoteUrl}`);
        
        const response = await axios.get(quoteUrl, {
          params: {
            inputMint,
            outputMint,
            amount: amount.toString(),
            slippageBps
          },
          timeout: 15000,
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'ZinochainBot/1.0'
          }
        });

        console.log(`✅ Quote received: ${response.data.outAmount} output tokens`);
        JUPITER_API = baseEndpoint; // Update to working endpoint (without /quote)
        return response.data;
      } catch (error: any) {
        lastError = error;
        console.warn(`⚠️  Endpoint ${i + 1} failed (${error.response?.status || error.code}): ${error.message}`);
        if (i < JUPITER_ENDPOINTS.length - 1) {
          console.log(`🔄 Trying next endpoint...`);
        }
      }
    }
    
    // All endpoints failed
    const errorDetails = {
      message: lastError?.message,
      code: lastError?.code,
      status: lastError?.response?.status,
      inputMint,
      outputMint,
      amount,
      endpointsTried: JUPITER_ENDPOINTS.length
    };
    console.error('❌ All Jupiter endpoints failed:', JSON.stringify(errorDetails, null, 2));
    throw new Error(`Failed to get quote from Jupiter: ${lastError?.message}`);
  }

  async executeSwap(
    keypair: Keypair,
    quoteResponse: QuoteResponse,
    prioritizationFeeLamports: number = 10000
  ): Promise<string> {
    try {
      console.log(`💫 Executing swap: ${quoteResponse.inAmount} → ${quoteResponse.outAmount}`);
      const swapUrl = `${JUPITER_API}/swap`;
      console.log(`📡 Calling swap endpoint: ${swapUrl}`);
      
      const swapResponse = await axios.post(swapUrl, {
        quoteResponse,
        userPublicKey: keypair.publicKey.toString(),
        wrapAndUnwrapSol: true,
        prioritizationFeeLamports
      }, {
        timeout: 30000,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'User-Agent': 'ZinochainBot/1.0'
        }
      });

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
      const errorDetails = {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
        code: error.code
      };
      console.error('❌ Jupiter swap error:', JSON.stringify(errorDetails, null, 2));
      throw new Error(`Failed to execute swap: ${error.message}`);
    }
  }

  async swap(
    keypair: Keypair,
    inputMint: string,
    outputMint: string,
    amount: number,
    slippageBps: number = 50
  ): Promise<string> {
    const quote = await this.getQuote(inputMint, outputMint, amount, slippageBps);
    const signature = await this.executeSwap(keypair, quote);
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
