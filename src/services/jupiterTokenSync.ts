/**
 * Jupiter Token Sync Service
 * Syncs token list from Jupiter API and caches in database
 */

import axios from 'axios';
import { query } from '../database/db';

export interface JupiterToken {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  tags?: string[];
}

export class JupiterTokenSync {
  private readonly JUPITER_API = 'https://token.jup.ag/all';
  private readonly SYNC_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

  /**
   * Fetch all tokens from Jupiter API
   */
  async fetchTokensFromJupiter(): Promise<JupiterToken[]> {
    try {
      console.log('📡 Fetching tokens from Jupiter API...');
      const response = await axios.get(this.JUPITER_API, {
        timeout: 30000,
        headers: {
          'User-Agent': 'ZinochainBot/1.0'
        }
      });

      if (!Array.isArray(response.data)) {
        throw new Error('Invalid response format from Jupiter API');
      }

      console.log(`✅ Fetched ${response.data.length} tokens from Jupiter`);
      return response.data;
    } catch (error) {
      console.error('❌ Error fetching tokens from Jupiter:', error);
      throw error;
    }
  }

  /**
   * Store tokens in database
   */
  async storeTokensInDatabase(tokens: JupiterToken[]): Promise<void> {
    try {
      console.log(`💾 Storing ${tokens.length} tokens in database...`);

      // Clear old tokens
      await query('DELETE FROM jupiter_tokens');

      // Batch insert (PostgreSQL supports multiple VALUES)
      const batchSize = 100;
      for (let i = 0; i < tokens.length; i += batchSize) {
        const batch = tokens.slice(i, i + batchSize);
        
        const values = batch
          .map((_, idx) => `($${idx * 7 + 1}, $${idx * 7 + 2}, $${idx * 7 + 3}, $${idx * 7 + 4}, $${idx * 7 + 5}, $${idx * 7 + 6}, $${idx * 7 + 7})`)
          .join(',');

        const params = batch.flatMap(token => [
          token.address,
          token.symbol.toUpperCase(),
          token.name,
          token.decimals,
          'solana',
          token.logoURI || null,
          token.tags ? JSON.stringify(token.tags) : null
        ]);

        const insertQuery = `
          INSERT INTO jupiter_tokens (mint_address, symbol, name, decimals, chain, logo_uri, tags)
          VALUES ${values}
          ON CONFLICT (mint_address) DO UPDATE SET
            symbol = EXCLUDED.symbol,
            name = EXCLUDED.name,
            decimals = EXCLUDED.decimals,
            logo_uri = EXCLUDED.logo_uri,
            tags = EXCLUDED.tags,
            last_synced = CURRENT_TIMESTAMP
        `;

        await query(insertQuery, params);
        console.log(`✅ Stored batch ${i / batchSize + 1} (${batch.length} tokens)`);
      }

      console.log('✅ All tokens stored successfully!');
    } catch (error) {
      console.error('❌ Error storing tokens in database:', error);
      throw error;
    }
  }

  /**
   * Perform full sync (fetch and store)
   */
  async syncTokens(): Promise<void> {
    try {
      const tokens = await this.fetchTokensFromJupiter();
      await this.storeTokensInDatabase(tokens);
      console.log('🎉 Token sync completed!');
    } catch (error) {
      console.error('🔥 Token sync failed:', error);
      throw error;
    }
  }

  /**
   * Start automatic sync on interval (with async initial sync)
   */
  async initializeSync(): Promise<void> {
    console.log('⏰ Starting initial token sync...');
    try {
      await this.syncTokens();
      console.log('✅ Initial token sync completed successfully!');
    } catch (error) {
      console.error('❌ Initial sync failed:', error);
      throw error;
    }
  }

  /**
   * Start automatic sync on interval
   */
  startAutoSync(): void {
    console.log('⏰ Starting automatic token sync (every 24 hours)...');
    
    // Sync every 24 hours (after initial sync completes)
    setInterval(() => {
      this.syncTokens().catch(err => console.error('Scheduled sync failed:', err));
    }, this.SYNC_INTERVAL);
  }

  /**
   * Search tokens in database by symbol or name
   */
  async searchTokens(query_text: string, limit: number = 10): Promise<JupiterToken[]> {
    try {
      const searchQuery = `%${query_text.toUpperCase()}%`;
      
      const result = await query(
        `SELECT 
          mint_address as address, 
          symbol, 
          name, 
          decimals,
          logo_uri as "logoURI",
          tags
        FROM jupiter_tokens
        WHERE symbol ILIKE $1 OR name ILIKE $1
        ORDER BY 
          CASE 
            WHEN symbol ILIKE $2 THEN 0
            WHEN symbol ILIKE $3 THEN 1
            ELSE 2
          END,
          symbol ASC
        LIMIT $4`,
        [searchQuery, `${query_text.toUpperCase()}%`, `%${query_text.toUpperCase()}`, limit]
      );

      return result.rows.map(row => ({
        address: row.address,
        symbol: row.symbol,
        name: row.name,
        decimals: row.decimals,
        logoURI: row.logoURI,
        tags: row.tags
      }));
    } catch (error) {
      console.error('Error searching tokens:', error);
      return [];
    }
  }

  /**
   * Get token count in database
   */
  async getTokenCount(): Promise<number> {
    try {
      const result = await query('SELECT COUNT(*) as count FROM jupiter_tokens');
      return parseInt(result.rows[0].count);
    } catch (error) {
      console.error('Error getting token count:', error);
      return 0;
    }
  }
}

export default new JupiterTokenSync();
