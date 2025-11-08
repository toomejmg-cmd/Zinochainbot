import { ethers } from 'ethers';
import {
  ChainType,
  IChainAdapter,
  WalletCredentials,
  TokenBalance,
  SwapQuote,
  SwapParams
} from './IChainAdapter';
import { OneInchService, BSC_CHAIN_ID, NATIVE_BNB } from '../services/oneinch';

export class BSCAdapter implements IChainAdapter {
  chainType: ChainType = 'bsc';
  private provider: ethers.JsonRpcProvider;
  private oneInchService: OneInchService;

  constructor(rpcUrl: string, oneInchApiKey?: string) {
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.oneInchService = new OneInchService(BSC_CHAIN_ID, oneInchApiKey);
  }

  async createWallet(): Promise<WalletCredentials> {
    const wallet = ethers.Wallet.createRandom();
    return {
      publicKey: wallet.address,
      privateKey: wallet.privateKey
    };
  }

  async getBalance(address: string): Promise<string> {
    try {
      const balance = await this.provider.getBalance(address);
      return ethers.formatEther(balance);
    } catch (error) {
      console.error('Error getting BSC balance:', error);
      return '0';
    }
  }

  async getTokenBalances(address: string): Promise<TokenBalance[]> {
    // For now, return empty array - proper implementation would require
    // token list or event parsing
    return [];
  }

  async getSwapQuote(params: SwapParams): Promise<SwapQuote> {
    try {
      const quote = await this.oneInchService.getQuote(
        params.inputToken,
        params.outputToken,
        params.amount
      );

      const inputDecimals = quote.srcToken.decimals;
      const outputDecimals = quote.dstToken.decimals;

      const inputAmount = parseFloat(params.amount) / Math.pow(10, inputDecimals);
      const outputAmount = parseFloat(quote.dstAmount) / Math.pow(10, outputDecimals);

      return {
        inputAmount: inputAmount.toString(),
        outputAmount: outputAmount.toString(),
        priceImpact: 0, // 1inch doesn't provide this directly
        fee: parseFloat(quote.estimatedGas) || 0
      };
    } catch (error) {
      console.error('Error getting BSC quote:', error);
      throw error;
    }
  }

  async executeSwap(params: SwapParams, privateKey: string): Promise<string> {
    try {
      const wallet = new ethers.Wallet(privateKey, this.provider);

      const txHash = await this.oneInchService.executeSwap(
        this.provider,
        wallet,
        params.inputToken,
        params.outputToken,
        params.amount,
        params.slippage
      );

      return txHash;
    } catch (error) {
      console.error('Error executing BSC swap:', error);
      throw error;
    }
  }

  validateAddress(address: string): boolean {
    return ethers.isAddress(address);
  }

  getNativeToken() {
    return {
      symbol: 'BNB',
      name: 'Binance Coin',
      decimals: 18
    };
  }

  getExplorerUrl(txHash: string): string {
    return `https://bscscan.com/tx/${txHash}`;
  }
}
