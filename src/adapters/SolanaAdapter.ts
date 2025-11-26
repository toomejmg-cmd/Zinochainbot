import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress, getAccount, getMint } from '@solana/spl-token';
import bs58 from 'bs58';
import * as bip39 from 'bip39';
import { derivePath } from 'ed25519-hd-key';
import { ZinochainService } from '../services/jupiter';
import {
  ChainType,
  IChainAdapter,
  WalletCredentials,
  TokenBalance,
  SwapQuote,
  SwapParams
} from './IChainAdapter';

export class SolanaAdapter implements IChainAdapter {
  chainType: ChainType = 'solana';
  private connection: Connection;
  private jupiterService: ZinochainService;

  constructor(rpcUrl: string) {
    this.connection = new Connection(rpcUrl, 'confirmed');
    this.jupiterService = new ZinochainService(this.connection);
  }

  async createWallet(): Promise<WalletCredentials> {
    const keypair = Keypair.generate();
    return {
      publicKey: keypair.publicKey.toString(),
      privateKey: bs58.encode(keypair.secretKey)
    };
  }

  async getBalance(address: string): Promise<string> {
    try {
      const publicKey = new PublicKey(address);
      const balance = await this.connection.getBalance(publicKey);
      return (balance / LAMPORTS_PER_SOL).toString();
    } catch (error) {
      console.error('Error getting Solana balance:', error);
      return '0';
    }
  }

  async getTokenBalances(address: string): Promise<TokenBalance[]> {
    try {
      const publicKey = new PublicKey(address);
      const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(
        publicKey,
        { programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') }
      );

      const balances: TokenBalance[] = [];
      
      for (const { account } of tokenAccounts.value) {
        const parsedInfo = account.data.parsed.info;
        const balance = parsedInfo.tokenAmount.uiAmount;
        
        if (balance > 0) {
          balances.push({
            symbol: 'TOKEN',
            name: 'SPL Token',
            balance: balance.toString(),
            decimals: parsedInfo.tokenAmount.decimals,
            tokenAddress: parsedInfo.mint
          });
        }
      }

      return balances;
    } catch (error) {
      console.error('Error getting Solana token balances:', error);
      return [];
    }
  }

  async getSwapQuote(params: SwapParams): Promise<SwapQuote> {
    const quote = await this.jupiterService.getQuote(
      params.inputToken,
      params.outputToken,
      parseFloat(params.amount),
      params.slippage
    );

    return {
      inputAmount: params.amount,
      outputAmount: quote.outAmount,
      priceImpact: parseFloat(quote.priceImpactPct),
      fee: 0,
      route: JSON.stringify(quote.routePlan)
    };
  }

  async executeSwap(params: SwapParams, privateKey: string): Promise<string> {
    const secretKeyBytes = bs58.decode(privateKey);
    const keypair = Keypair.fromSecretKey(secretKeyBytes);

    const quote = await this.jupiterService.getQuote(
      params.inputToken,
      params.outputToken,
      parseFloat(params.amount),
      params.slippage
    );

    const txHash = await this.jupiterService.executeSwap(keypair, quote);

    return txHash;
  }

  validateAddress(address: string): boolean {
    try {
      new PublicKey(address);
      return true;
    } catch {
      return false;
    }
  }

  getNativeToken() {
    return {
      symbol: 'SOL',
      name: 'Solana',
      decimals: 9
    };
  }

  getExplorerUrl(txHash: string): string {
    const solanaNetwork = process.env.SOLANA_NETWORK || 'mainnet-beta';
    return `https://solscan.io/tx/${txHash}?cluster=${solanaNetwork}`;
  }

  async deriveFromMnemonic(mnemonic: string): Promise<WalletCredentials> {
    const seed = await bip39.mnemonicToSeed(mnemonic);
    const derivedSeed = derivePath("m/44'/501'/0'/0'", seed.toString('hex')).key;
    const keypair = Keypair.fromSeed(derivedSeed);
    
    return {
      publicKey: keypair.publicKey.toString(),
      privateKey: bs58.encode(keypair.secretKey)
    };
  }
}
