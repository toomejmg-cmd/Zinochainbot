/**
 * Token Info Service
 * Fetches token metadata and pricing from DEX Screener API
 */

import axios from 'axios';

export interface TokenPriceChange {
  m5: number;    // 5 minutes
  h1: number;    // 1 hour
  h6: number;    // 6 hours
  h24: number;   // 24 hours
}

export interface TokenInfo {
  address: string;
  name: string;
  symbol: string;
  price: number;
  priceUsd: string;
  marketCap: number;
  liquidity: number;
  volume24h: number;
  priceChange: TokenPriceChange;
  chain: string;
  dexId?: string;
  pairAddress?: string;
  imageUrl?: string;
  websites?: string[];
  socials?: {
    twitter?: string;
    telegram?: string;
    discord?: string;
  };
}

export interface PriceImpact {
  amount: number;
  priceImpact: number;
  expectedPrice: number;
  expectedTokens: number;
}

export class TokenInfoService {
  private readonly DEX_SCREENER_API = 'https://api.dexscreener.com/latest/dex';

  /**
   * Fetch token information by pair address (when URL points to a pair)
   */
  private async getTokenInfoByPair(pairAddress: string, chain: string = 'solana'): Promise<TokenInfo | null> {
    try {
      const response = await axios.get(
        `${this.DEX_SCREENER_API}/pairs/${chain}/${pairAddress}`,
        {
          timeout: 10000,
          headers: {
            'User-Agent': 'ZinochainBot/1.0'
          }
        }
      );

      if (!response.data || !response.data.pair) {
        return null;
      }

      const pair = response.data.pair;
      // Get the base token (usually the non-stablecoin token)
      const token = pair.baseToken;
      const tokenAddress = token.address;

      return {
        address: tokenAddress,
        name: token.name || 'Unknown',
        symbol: token.symbol || 'UNKNOWN',
        price: parseFloat(pair.priceNative || '0'),
        priceUsd: pair.priceUsd || '0',
        marketCap: pair.marketCap || 0,
        liquidity: pair.liquidity?.usd || 0,
        volume24h: pair.volume?.h24 || 0,
        priceChange: {
          m5: pair.priceChange?.m5 || 0,
          h1: pair.priceChange?.h1 || 0,
          h6: pair.priceChange?.h6 || 0,
          h24: pair.priceChange?.h24 || 0,
        },
        chain: pair.chainId,
        dexId: pair.dexId,
        pairAddress: pair.pairAddress,
        imageUrl: token.imageUrl,
        websites: pair.info?.websites || [],
        socials: {
          twitter: pair.info?.socials?.find((s: any) => s.type === 'twitter')?.url,
          telegram: pair.info?.socials?.find((s: any) => s.type === 'telegram')?.url,
          discord: pair.info?.socials?.find((s: any) => s.type === 'discord')?.url,
        }
      };
    } catch (error) {
      console.error('Error fetching pair info from DEX Screener:', error);
      return null;
    }
  }

  /**
   * Fetch token information from DEX Screener
   * Tries token lookup first, then falls back to pair lookup if token address doesn't exist
   */
  async getTokenInfo(tokenAddress: string, chain: string = 'solana'): Promise<TokenInfo | null> {
    try {
      // Try token lookup first
      const response = await axios.get(
        `${this.DEX_SCREENER_API}/tokens/${tokenAddress}`,
        {
          timeout: 10000,
          headers: {
            'User-Agent': 'ZinochainBot/1.0'
          }
        }
      );

      if (response.data && response.data.pairs && response.data.pairs.length > 0) {
        // Get the most liquid pair for this token
        const pairs = response.data.pairs.filter((p: any) => 
          p.chainId.toLowerCase() === chain.toLowerCase()
        );

        if (pairs.length > 0) {
          // Sort by liquidity and get the best pair
          const bestPair = pairs.sort((a: any, b: any) => 
            (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0)
          )[0];

          const token = bestPair.baseToken.address.toLowerCase() === tokenAddress.toLowerCase()
            ? bestPair.baseToken
            : bestPair.quoteToken;

          return {
            address: tokenAddress,
            name: token.name || 'Unknown',
            symbol: token.symbol || 'UNKNOWN',
            price: parseFloat(bestPair.priceNative || '0'),
            priceUsd: bestPair.priceUsd || '0',
            marketCap: bestPair.marketCap || 0,
            liquidity: bestPair.liquidity?.usd || 0,
            volume24h: bestPair.volume?.h24 || 0,
            priceChange: {
              m5: bestPair.priceChange?.m5 || 0,
              h1: bestPair.priceChange?.h1 || 0,
              h6: bestPair.priceChange?.h6 || 0,
              h24: bestPair.priceChange?.h24 || 0,
            },
            chain: bestPair.chainId,
            dexId: bestPair.dexId,
            pairAddress: bestPair.pairAddress,
            imageUrl: token.imageUrl,
            websites: bestPair.info?.websites || [],
            socials: {
              twitter: bestPair.info?.socials?.find((s: any) => s.type === 'twitter')?.url,
              telegram: bestPair.info?.socials?.find((s: any) => s.type === 'telegram')?.url,
              discord: bestPair.info?.socials?.find((s: any) => s.type === 'discord')?.url,
            }
          };
        }
      }
    } catch (error) {
      console.error('Token lookup failed, trying pair lookup:', error);
    }

    // Fallback: Try treating the input as a pair address
    console.log(`Token lookup failed for ${tokenAddress}. Attempting pair address lookup...`);
    return this.getTokenInfoByPair(tokenAddress, chain);
  }

  /**
   * Calculate price impact for different SOL amounts
   * Note: This is a simplified calculation. For accurate price impact,
   * you should use Jupiter's quote API
   */
  calculatePriceImpact(
    tokenInfo: TokenInfo,
    solAmount: number,
    jupiterQuote?: any
  ): PriceImpact {
    // If we have a Jupiter quote, use it for accurate price impact
    if (jupiterQuote) {
      const inputAmount = parseFloat(jupiterQuote.inAmount);
      const outputAmount = parseFloat(jupiterQuote.outAmount);
      const priceImpact = jupiterQuote.priceImpactPct || 0;

      return {
        amount: solAmount,
        priceImpact: priceImpact * 100, // Convert to percentage
        expectedPrice: inputAmount / outputAmount,
        expectedTokens: outputAmount
      };
    }

    // Fallback: Simple estimation based on liquidity
    // Price impact ≈ (trade_size / liquidity) * 100
    const tradeSizeUsd = solAmount * 150; // Assume ~$150 per SOL (should get from CoinGecko)
    const liquidityUsd = tokenInfo.liquidity || 1000;
    
    const estimatedImpact = Math.min((tradeSizeUsd / liquidityUsd) * 100, 99);
    const expectedTokens = (solAmount * tokenInfo.price) * (1 - estimatedImpact / 100);

    return {
      amount: solAmount,
      priceImpact: estimatedImpact,
      expectedPrice: tokenInfo.price,
      expectedTokens
    };
  }

  /**
   * Format price change with color indicator
   */
  formatPriceChange(change: number): string {
    const sign = change >= 0 ? '+' : '';
    return `${sign}${change.toFixed(2)}%`;
  }

  /**
   * Format large numbers (market cap, volume)
   */
  formatLargeNumber(num: number): string {
    if (num >= 1_000_000_000) {
      return `$${(num / 1_000_000_000).toFixed(2)}B`;
    } else if (num >= 1_000_000) {
      return `$${(num / 1_000_000).toFixed(2)}M`;
    } else if (num >= 1_000) {
      return `$${(num / 1_000).toFixed(2)}K`;
    }
    return `$${num.toFixed(2)}`;
  }

  /**
   * Search token by symbol or name
   */
  async searchToken(query: string, chain: string = 'solana'): Promise<TokenInfo[]> {
    try {
      const response = await axios.get(
        `${this.DEX_SCREENER_API}/search/?q=${encodeURIComponent(query)}`,
        {
          timeout: 10000,
          headers: {
            'User-Agent': 'ZinochainBot/1.0'
          }
        }
      );

      if (!response.data || !response.data.pairs) {
        return [];
      }

      // Filter by chain and map to TokenInfo
      const pairs = response.data.pairs
        .filter((p: any) => p.chainId.toLowerCase() === chain.toLowerCase())
        .slice(0, 5); // Limit to 5 results

      return pairs.map((pair: any) => {
        const token = pair.baseToken;
        return {
          address: token.address,
          name: token.name || 'Unknown',
          symbol: token.symbol || 'UNKNOWN',
          price: parseFloat(pair.priceNative || '0'),
          priceUsd: pair.priceUsd || '0',
          marketCap: pair.marketCap || 0,
          liquidity: pair.liquidity?.usd || 0,
          volume24h: pair.volume?.h24 || 0,
          priceChange: {
            m5: pair.priceChange?.m5 || 0,
            h1: pair.priceChange?.h1 || 0,
            h6: pair.priceChange?.h6 || 0,
            h24: pair.priceChange?.h24 || 0,
          },
          chain: pair.chainId,
          dexId: pair.dexId,
          pairAddress: pair.pairAddress,
          imageUrl: token.imageUrl,
        };
      });
    } catch (error) {
      console.error('Error searching tokens:', error);
      return [];
    }
  }
}
