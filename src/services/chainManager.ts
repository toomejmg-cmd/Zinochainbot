import { IChainAdapter, ChainType } from '../adapters/IChainAdapter';
import { SolanaAdapter } from '../adapters/SolanaAdapter';
import { EthereumAdapter } from '../adapters/EthereumAdapter';
import { BSCAdapter } from '../adapters/BSCAdapter';

export interface ChainConfig {
  solana: {
    rpcUrl: string;
  };
  ethereum: {
    rpcUrl: string;
    oneInchApiKey?: string;
  };
  bsc: {
    rpcUrl: string;
    oneInchApiKey?: string;
  };
}

export class ChainManager {
  private adapters: Map<ChainType, IChainAdapter>;
  private config: ChainConfig;

  constructor(config: ChainConfig) {
    this.config = config;
    this.adapters = new Map();
    this.initializeAdapters();
  }

  private initializeAdapters() {
    // Solana adapter
    this.adapters.set(
      'solana',
      new SolanaAdapter(this.config.solana.rpcUrl)
    );

    // Ethereum adapter
    this.adapters.set(
      'ethereum',
      new EthereumAdapter(
        this.config.ethereum.rpcUrl,
        this.config.ethereum.oneInchApiKey
      )
    );

    // BSC adapter
    this.adapters.set(
      'bsc',
      new BSCAdapter(
        this.config.bsc.rpcUrl,
        this.config.bsc.oneInchApiKey
      )
    );
  }

  getAdapter(chain: ChainType): IChainAdapter {
    const adapter = this.adapters.get(chain);
    if (!adapter) {
      throw new Error(`Adapter for chain ${chain} not found`);
    }
    return adapter;
  }

  getSupportedChains(): ChainType[] {
    return Array.from(this.adapters.keys());
  }

  getChainInfo(chain: ChainType) {
    const adapter = this.getAdapter(chain);
    return {
      chainType: chain,
      nativeToken: adapter.getNativeToken(),
      name: this.getChainDisplayName(chain),
      icon: this.getChainIcon(chain)
    };
  }

  getChainDisplayName(chain: ChainType): string {
    const names: Record<ChainType, string> = {
      solana: 'Solana',
      ethereum: 'Ethereum',
      bsc: 'Binance Smart Chain'
    };
    return names[chain];
  }

  getChainIcon(chain: ChainType): string {
    const icons: Record<ChainType, string> = {
      solana: '⚡',
      ethereum: '🔷',
      bsc: '🟡'
    };
    return icons[chain];
  }

  getAllChainsInfo() {
    return this.getSupportedChains().map(chain => this.getChainInfo(chain));
  }
}

// Default RPC URLs
export const DEFAULT_CHAIN_CONFIG: ChainConfig = {
  solana: {
    rpcUrl: process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com'
  },
  ethereum: {
    rpcUrl: process.env.ETHEREUM_RPC_URL || 'https://eth.public-rpc.com',
    oneInchApiKey: process.env.ONEINCH_API_KEY
  },
  bsc: {
    rpcUrl: process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org',
    oneInchApiKey: process.env.ONEINCH_API_KEY
  }
};
