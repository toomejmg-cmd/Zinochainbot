import { query } from '../database/db';
import { URLParserService } from './urlParser';
import { TokenInfoService } from './tokenInfo';

export interface WatchlistToken {
  id: number;
  userId: number;
  chain: string;
  tokenAddress: string;
  tokenName: string | null;
  tokenSymbol: string | null;
  sourceUrl: string | null;
  metadata: any;
  addedAt: Date;
}

export class WatchlistService {
  private urlParser: URLParserService;
  private tokenInfoService: TokenInfoService;
  private maxTokensPerUser: number = 50;

  constructor() {
    this.urlParser = new URLParserService();
    this.tokenInfoService = new TokenInfoService();
  }

  async addToken(
    userId: number,
    chain: string,
    input: string
  ): Promise<{ success: boolean; token?: WatchlistToken; error?: string }> {
    try {
      const countResult = await query(
        'SELECT COUNT(*) as count FROM watchlist_tokens WHERE user_id = $1',
        [userId]
      );

      const currentCount = parseInt(countResult.rows[0].count);
      if (currentCount >= this.maxTokensPerUser) {
        return { success: false, error: `Watchlist limit reached (${this.maxTokensPerUser} tokens max)` };
      }

      let tokenAddress: string | null = null;
      let sourceUrl: string | null = null;
      let detectedChain: string = chain;

      const parsed = this.urlParser.parseURL(input);
      if (parsed) {
        tokenAddress = parsed.tokenAddress;
        sourceUrl = input;
        detectedChain = parsed.chain || chain;
      } else {
        const cleanInput = input.trim();
        if (cleanInput.match(/^[A-HJ-NP-Za-km-z1-9]{32,44}$/)) {
          tokenAddress = cleanInput;
        } else {
          return { success: false, error: 'Invalid token address or URL' };
        }
      }

      const checkResult = await query(
        'SELECT id FROM watchlist_tokens WHERE user_id = $1 AND chain = $2 AND token_address = $3',
        [userId, detectedChain, tokenAddress]
      );

      if (checkResult.rows.length > 0) {
        return { success: false, error: 'Token already in watchlist' };
      }

      let tokenName: string | null = null;
      let tokenSymbol: string | null = null;
      let metadata: any = {};

      try {
        const tokenInfo = await this.tokenInfoService.getTokenInfo(tokenAddress, detectedChain);
        if (tokenInfo) {
          tokenName = tokenInfo.name;
          tokenSymbol = tokenInfo.symbol;
          metadata = {
            priceUsd: tokenInfo.priceUsd,
            marketCap: tokenInfo.marketCap,
            addedPrice: tokenInfo.priceUsd
          };
        }
      } catch (err) {
        console.log('Could not fetch token info:', err);
      }

      const result = await query(
        `INSERT INTO watchlist_tokens 
         (user_id, chain, token_address, token_name, token_symbol, source_url, metadata, added_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
         RETURNING *`,
        [userId, detectedChain, tokenAddress, tokenName, tokenSymbol, sourceUrl, JSON.stringify(metadata)]
      );

      const token: WatchlistToken = {
        id: result.rows[0].id,
        userId: result.rows[0].user_id,
        chain: result.rows[0].chain,
        tokenAddress: result.rows[0].token_address,
        tokenName: result.rows[0].token_name,
        tokenSymbol: result.rows[0].token_symbol,
        sourceUrl: result.rows[0].source_url,
        metadata: result.rows[0].metadata,
        addedAt: result.rows[0].added_at
      };

      return { success: true, token };
    } catch (error: any) {
      console.error('Error adding token to watchlist:', error);
      return { success: false, error: error.message };
    }
  }

  async getWatchlist(userId: number, chain?: string): Promise<WatchlistToken[]> {
    try {
      let result;
      
      if (chain) {
        result = await query(
          'SELECT * FROM watchlist_tokens WHERE user_id = $1 AND chain = $2 ORDER BY added_at DESC',
          [userId, chain]
        );
      } else {
        result = await query(
          'SELECT * FROM watchlist_tokens WHERE user_id = $1 ORDER BY added_at DESC',
          [userId]
        );
      }

      return result.rows.map(row => ({
        id: row.id,
        userId: row.user_id,
        chain: row.chain,
        tokenAddress: row.token_address,
        tokenName: row.token_name,
        tokenSymbol: row.token_symbol,
        sourceUrl: row.source_url,
        metadata: row.metadata,
        addedAt: row.added_at
      }));
    } catch (error) {
      console.error('Error getting watchlist:', error);
      return [];
    }
  }

  async removeToken(userId: number, tokenId: number): Promise<boolean> {
    try {
      const result = await query(
        'DELETE FROM watchlist_tokens WHERE id = $1 AND user_id = $2',
        [tokenId, userId]
      );

      return result.rowCount !== null && result.rowCount > 0;
    } catch (error) {
      console.error('Error removing token from watchlist:', error);
      return false;
    }
  }

  async clearWatchlist(userId: number): Promise<boolean> {
    try {
      await query(
        'DELETE FROM watchlist_tokens WHERE user_id = $1',
        [userId]
      );

      return true;
    } catch (error) {
      console.error('Error clearing watchlist:', error);
      return false;
    }
  }

  async getTokenCount(userId: number): Promise<number> {
    try {
      const result = await query(
        'SELECT COUNT(*) as count FROM watchlist_tokens WHERE user_id = $1',
        [userId]
      );

      return parseInt(result.rows[0].count);
    } catch (error) {
      console.error('Error getting token count:', error);
      return 0;
    }
  }
}
