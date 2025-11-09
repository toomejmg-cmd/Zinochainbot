export type ChainType = 'solana' | 'ethereum' | 'bsc';

export interface WalletCredentials {
  publicKey: string;
  privateKey: string;
}

export interface TokenBalance {
  symbol: string;
  name: string;
  balance: string;
  decimals: number;
  usdValue?: number;
  tokenAddress: string;
}

export interface SwapQuote {
  inputAmount: string;
  outputAmount: string;
  priceImpact: number;
  fee: number;
  route?: string;
}

export interface SwapParams {
  inputToken: string;
  outputToken: string;
  amount: string;
  slippage: number;
}

export interface IChainAdapter {
  chainType: ChainType;
  
  createWallet(): Promise<WalletCredentials>;
  
  deriveFromMnemonic?(mnemonic: string): Promise<WalletCredentials>;
  
  getBalance(address: string): Promise<string>;
  
  getTokenBalances(address: string): Promise<TokenBalance[]>;
  
  getSwapQuote(params: SwapParams): Promise<SwapQuote>;
  
  executeSwap(
    params: SwapParams,
    privateKey: string
  ): Promise<string>;
  
  validateAddress(address: string): boolean;
  
  getNativeToken(): { symbol: string; name: string; decimals: number };
  
  getExplorerUrl(txHash: string): string;
}
