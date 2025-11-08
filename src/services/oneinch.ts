import axios from 'axios';
import { ethers } from 'ethers';

const ONEINCH_API = 'https://api.1inch.dev/swap/v6.0';

export interface OneInchQuoteResponse {
  dstAmount: string;
  srcToken: {
    address: string;
    symbol: string;
    decimals: number;
  };
  dstToken: {
    address: string;
    symbol: string;
    decimals: number;
  };
  protocols: any[];
  estimatedGas: string;
}

export interface OneInchSwapResponse {
  tx: {
    from: string;
    to: string;
    data: string;
    value: string;
    gas: string;
    gasPrice: string;
  };
}

export class OneInchService {
  private chainId: number;
  private apiKey?: string;

  constructor(chainId: number, apiKey?: string) {
    this.chainId = chainId;
    this.apiKey = apiKey;
  }

  private getHeaders() {
    if (this.apiKey) {
      return {
        'Authorization': `Bearer ${this.apiKey}`,
        'Accept': 'application/json'
      };
    }
    return {
      'Accept': 'application/json'
    };
  }

  async getQuote(
    fromToken: string,
    toToken: string,
    amount: string
  ): Promise<OneInchQuoteResponse> {
    try {
      const response = await axios.get(
        `${ONEINCH_API}/${this.chainId}/quote`,
        {
          params: {
            src: fromToken,
            dst: toToken,
            amount: amount
          },
          headers: this.getHeaders()
        }
      );

      return response.data;
    } catch (error: any) {
      console.error('1inch quote error:', error.response?.data || error.message);
      throw new Error('Failed to get quote from 1inch');
    }
  }

  async getSwap(
    fromToken: string,
    toToken: string,
    amount: string,
    fromAddress: string,
    slippage: number = 1
  ): Promise<OneInchSwapResponse> {
    try {
      const response = await axios.get(
        `${ONEINCH_API}/${this.chainId}/swap`,
        {
          params: {
            src: fromToken,
            dst: toToken,
            amount: amount,
            from: fromAddress,
            slippage: slippage,
            disableEstimate: true,
            allowPartialFill: false
          },
          headers: this.getHeaders()
        }
      );

      return response.data;
    } catch (error: any) {
      console.error('1inch swap error:', error.response?.data || error.message);
      throw new Error('Failed to get swap data from 1inch');
    }
  }

  async executeSwap(
    provider: ethers.Provider,
    signer: ethers.Wallet,
    fromToken: string,
    toToken: string,
    amount: string,
    slippage: number = 1
  ): Promise<string> {
    try {
      const swapData = await this.getSwap(
        fromToken,
        toToken,
        amount,
        signer.address,
        slippage
      );

      const tx = await signer.sendTransaction({
        to: swapData.tx.to,
        data: swapData.tx.data,
        value: BigInt(swapData.tx.value),
        gasLimit: BigInt(swapData.tx.gas)
      });

      const receipt = await tx.wait();
      
      if (!receipt) {
        throw new Error('Transaction receipt is null');
      }

      return receipt.hash;
    } catch (error: any) {
      console.error('1inch execute swap error:', error);
      throw new Error('Failed to execute swap');
    }
  }
}

// Chain IDs
export const ETHEREUM_CHAIN_ID = 1;
export const BSC_CHAIN_ID = 56;

// Native token addresses (used for ETH/BNB in 1inch API)
export const NATIVE_ETH = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
export const NATIVE_BNB = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
