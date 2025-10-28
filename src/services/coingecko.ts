import axios from 'axios';
import { query } from '../database/db';

const COINGECKO_API = 'https://api.coingecko.com/api/v3';
const CACHE_DURATION_MS = 5 * 60 * 1000;

export interface TokenPrice {
  mint: string;
  symbol?: string;
  name?: string;
  priceUsd: number;
  lastUpdated: Date;
}

export class CoinGeckoService {
  private apiKey?: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey;
  }

  async getTokenPrice(symbol: string): Promise<number | null> {
    try {
      const cachedPrice = await this.getCachedPrice(symbol);
      if (cachedPrice) {
        return cachedPrice;
      }

      const params: any = {
        ids: symbol.toLowerCase(),
        vs_currencies: 'usd'
      };

      if (this.apiKey) {
        params.x_cg_demo_api_key = this.apiKey;
      }

      const response = await axios.get(`${COINGECKO_API}/simple/price`, { params });

      const price = response.data[symbol.toLowerCase()]?.usd;
      
      if (price) {
        await this.cachePrice(symbol, price);
      }

      return price || null;
    } catch (error: any) {
      console.error('CoinGecko API error:', error.message);
      return null;
    }
  }

  async getSolanaPrice(): Promise<number> {
    const price = await this.getTokenPrice('solana');
    return price || 0;
  }

  private async getCachedPrice(symbol: string): Promise<number | null> {
    try {
      const result = await query(
        `SELECT price_usd, last_updated FROM token_cache 
         WHERE symbol = $1 AND last_updated > NOW() - INTERVAL '5 minutes'
         LIMIT 1`,
        [symbol.toUpperCase()]
      );

      if (result.rows.length > 0) {
        return parseFloat(result.rows[0].price_usd);
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  private async cachePrice(symbol: string, price: number): Promise<void> {
    try {
      await query(
        `INSERT INTO token_cache (mint_address, symbol, price_usd, last_updated)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (mint_address) 
         DO UPDATE SET price_usd = $3, last_updated = NOW()`,
        [`${symbol}_mint`, symbol.toUpperCase(), price]
      );
    } catch (error) {
      console.error('Error caching price:', error);
    }
  }
}
