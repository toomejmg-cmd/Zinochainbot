import axios from 'axios';
import { Connection, Keypair, VersionedTransaction, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import { getMint } from '@solana/spl-token';

const JUPITER_API = process.env.JUPITER_API_URL || 'https://quote-api.jup.ag/v6';

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
    try {
      console.log(`🔍 Getting quote: ${inputMint} → ${outputMint}, amount: ${amount}, slippage: ${slippageBps}bps`);
      const response = await axios.get(`${JUPITER_API}/quote`, {
        params: {
          inputMint,
          outputMint,
          amount: amount.toString(),
          slippageBps
        },
        timeout: 30000
      });

      console.log(`✅ Quote received: ${response.data.outAmount} output tokens`);
      return response.data;
    } catch (error: any) {
      const errorDetails = {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
        inputMint,
        outputMint,
        amount
      };
      console.error('❌ Jupiter quote error:', JSON.stringify(errorDetails, null, 2));
      throw new Error(`Failed to get quote from Jupiter: ${error.message}`);
    }
  }

  async executeSwap(
    keypair: Keypair,
    quoteResponse: QuoteResponse,
    prioritizationFeeLamports: number = 10000
  ): Promise<string> {
    try {
      console.log(`💫 Executing swap: ${quoteResponse.inAmount} → ${quoteResponse.outAmount}`);
      const swapResponse = await axios.post(`${JUPITER_API}/swap`, {
        quoteResponse,
        userPublicKey: keypair.publicKey.toString(),
        wrapAndUnwrapSol: true,
        prioritizationFeeLamports
      }, {
        timeout: 30000
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
