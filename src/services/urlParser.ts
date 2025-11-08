/**
 * URL Parser Service
 * Extracts token addresses from various platform URLs
 */

export interface ParsedTokenURL {
  tokenAddress: string;
  platform: 'pump.fun' | 'birdeye' | 'dexscreener' | 'moonshot' | 'unknown';
  chain?: string;
}

export class URLParserService {
  /**
   * Parse token address from pump.fun URL
   * Format: https://pump.fun/coin/{tokenAddress}
   */
  private parsePumpFun(url: string): string | null {
    const regex = /pump\.fun\/(?:coin\/)?([A-Za-z0-9]{32,44})/;
    const match = url.match(regex);
    return match ? match[1] : null;
  }

  /**
   * Parse token address from Birdeye URL
   * Format: https://birdeye.so/token/{tokenAddress}?chain=solana
   */
  private parseBirdeye(url: string): ParsedTokenURL | null {
    const regex = /birdeye\.so\/token\/([A-Za-z0-9]{32,44})/;
    const match = url.match(regex);
    if (!match) return null;

    // Extract chain parameter if present
    const chainMatch = url.match(/[?&]chain=([^&]+)/);
    const chain = chainMatch ? chainMatch[1] : 'solana';

    return {
      tokenAddress: match[1],
      platform: 'birdeye',
      chain
    };
  }

  /**
   * Parse token address from DEX Screener URL
   * Formats: 
   * - https://dexscreener.com/solana/{tokenAddress}
   * - https://dexscreener.com/ethereum/{0xAddress}
   * - https://dexscreener.com/bsc/{0xAddress}
   */
  private parseDexScreener(url: string): ParsedTokenURL | null {
    // Support both Solana base58 addresses and EVM 0x addresses
    const regex = /dexscreener\.com\/(solana|ethereum|bsc|base|arbitrum|polygon)\/(0x[a-fA-F0-9]{40}|[A-Za-z0-9]{32,44})/;
    const match = url.match(regex);
    if (!match) return null;

    return {
      tokenAddress: match[2],
      platform: 'dexscreener',
      chain: match[1]
    };
  }

  /**
   * Parse token address from Moonshot URL
   * Format: https://moonshot.money/token/{tokenAddress}
   */
  private parseMoonshot(url: string): string | null {
    const regex = /moonshot\.money\/(?:token\/)?([A-Za-z0-9]{32,44})/;
    const match = url.match(regex);
    return match ? match[1] : null;
  }

  /**
   * Main parsing method - detects platform and extracts token address
   */
  parseURL(input: string): ParsedTokenURL | null {
    // Check if it's a Solana base58 address
    if (/^[A-Za-z0-9]{32,44}$/.test(input.trim())) {
      return {
        tokenAddress: input.trim(),
        platform: 'unknown',
        chain: 'solana'
      };
    }

    // Check if it's an EVM 0x address
    if (/^0x[a-fA-F0-9]{40}$/.test(input.trim())) {
      return {
        tokenAddress: input.trim(),
        platform: 'unknown',
        chain: 'ethereum' // Default to Ethereum for 0x addresses
      };
    }

    // Normalize URL
    let url = input.trim();
    if (!url.startsWith('http')) {
      url = 'https://' + url;
    }

    // Try each platform parser
    if (url.includes('pump.fun')) {
      const address = this.parsePumpFun(url);
      return address ? { tokenAddress: address, platform: 'pump.fun', chain: 'solana' } : null;
    }

    if (url.includes('birdeye')) {
      return this.parseBirdeye(url);
    }

    if (url.includes('dexscreener')) {
      return this.parseDexScreener(url);
    }

    if (url.includes('moonshot')) {
      const address = this.parseMoonshot(url);
      return address ? { tokenAddress: address, platform: 'moonshot', chain: 'solana' } : null;
    }

    return null;
  }

  /**
   * Validate if a string could be a token address or URL
   */
  isValidInput(input: string): boolean {
    const parsed = this.parseURL(input);
    return parsed !== null;
  }

  /**
   * Get platform-specific explorer links
   */
  getExplorerLink(tokenAddress: string, chain: string = 'solana'): string {
    switch (chain.toLowerCase()) {
      case 'solana':
        return `https://solscan.io/token/${tokenAddress}`;
      case 'ethereum':
        return `https://etherscan.io/token/${tokenAddress}`;
      case 'bsc':
        return `https://bscscan.com/token/${tokenAddress}`;
      default:
        return `https://solscan.io/token/${tokenAddress}`;
    }
  }

  /**
   * Get platform-specific chart links
   */
  getChartLink(tokenAddress: string, chain: string = 'solana'): string {
    return `https://dexscreener.com/${chain}/${tokenAddress}`;
  }

  /**
   * Get platform-specific scan link
   */
  getScanLink(tokenAddress: string, platform: string, chain: string = 'solana'): string {
    switch (platform) {
      case 'pump.fun':
        return `https://pump.fun/coin/${tokenAddress}`;
      case 'birdeye':
        return `https://birdeye.so/token/${tokenAddress}?chain=${chain}`;
      case 'dexscreener':
        return `https://dexscreener.com/${chain}/${tokenAddress}`;
      case 'moonshot':
        return `https://moonshot.money/token/${tokenAddress}`;
      default:
        return `https://dexscreener.com/${chain}/${tokenAddress}`;
    }
  }
}
