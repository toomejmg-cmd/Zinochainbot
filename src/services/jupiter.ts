import axios from 'axios';
import { Connection, Keypair, VersionedTransaction, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import { getMint } from '@solana/spl-token';

// Jupiter free public API endpoint
const JUPITER_QUOTE_API = 'https://api.jup.ag/quote';
const JUPITER_SWAP_API = 'https://api.jup.ag/swap';

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
    
    try {
      console.log(`📡 Calling Jupiter public API: ${JUPITER_QUOTE_API}`);
      
      const response = await axios.get(JUPITER_QUOTE_API, {
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
        throw new Error('No quote received from Jupiter');
      }

      console.log(`✅ Quote received: ${response.data.outAmount} output tokens`);
      return response.data;
    } catch (error: any) {
      const errorDetails = {
        message: error?.message,
        code: error?.code,
        status: error?.response?.status,
        inputMint,
        outputMint,
        amount
      };
      console.error('❌ Jupiter quote error:', JSON.stringify(errorDetails, null, 2));
      throw new Error(`Failed to get quote from Jupiter: ${error?.message || error}`);
    }
  }

  async executeSwap(
    keypair: Keypair,
    quoteResponse: QuoteResponse,
    prioritizationFeeLamports: number = 10000
  ): Promise<string> {
    try {
      console.log(`💫 Executing swap: ${quoteResponse.inAmount} → ${quoteResponse.outAmount}`);
      
      console.log(`📡 Calling Jupiter swap API: ${JUPITER_SWAP_API}`);
      
      const swapResponse = await axios.post(JUPITER_SWAP_API, {
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

      if (!swapResponse?.data?.swapTransaction) {
        throw new Error('No swap transaction received from Jupiter');
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
