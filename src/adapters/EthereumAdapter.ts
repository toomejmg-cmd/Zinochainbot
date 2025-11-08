import { ethers } from 'ethers';
import {
  ChainType,
  IChainAdapter,
  WalletCredentials,
  TokenBalance,
  SwapQuote,
  SwapParams
} from './IChainAdapter';
import { OneInchService, ETHEREUM_CHAIN_ID, NATIVE_ETH } from '../services/oneinch';

const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function name() view returns (string)'
];

export class EthereumAdapter implements IChainAdapter {
  chainType: ChainType = 'ethereum';
  private provider: ethers.JsonRpcProvider;
  private oneInchService: OneInchService;

  constructor(rpcUrl: string, oneInchApiKey?: string) {
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.oneInchService = new OneInchService(ETHEREUM_CHAIN_ID, oneInchApiKey);
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
      console.error('Error getting Ethereum balance:', error);
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
      console.error('Error getting Ethereum quote:', error);
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
      console.error('Error executing Ethereum swap:', error);
      throw error;
    }
  }

  validateAddress(address: string): boolean {
    return ethers.isAddress(address);
  }

  getNativeToken() {
    return {
      symbol: 'ETH',
      name: 'Ethereum',
      decimals: 18
    };
  }

  getExplorerUrl(txHash: string): string {
    return `https://etherscan.io/tx/${txHash}`;
  }
}
