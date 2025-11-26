import { Bot, InputFile } from 'grammy';
import dotenv from 'dotenv';
import * as path from 'path';
import { WalletManager } from './wallet/walletManager';
import { ZinochainService } from './services/jupiter';
import { CoinGeckoService } from './services/coingecko';
import { AdminService } from './services/admin';
import { FeeService } from './services/fees';
import { ReferralService } from './services/referral';
import { TransferService } from './services/transfer';
import { registerCommands } from './bot/commandsNew';
import jupiterTokenSync from './services/jupiterTokenSync';

dotenv.config();

const requiredEnvVars = ['TELEGRAM_BOT_TOKEN', 'DATABASE_URL', 'ENCRYPTION_KEY'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`❌ Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

async function main() {
  try {
    console.log('🚀 Starting Zinobot...\n');

    const botToken = process.env.TELEGRAM_BOT_TOKEN!;
    const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
    const network = process.env.SOLANA_NETWORK || 'devnet';

    console.log(`📡 Solana Network: ${network}`);
    console.log(`🔗 RPC URL: ${rpcUrl}\n`);

    const bot = new Bot(botToken);

    const walletManager = new WalletManager(rpcUrl);
    const jupiterService = new ZinochainService(walletManager.getConnection());
    const coinGeckoService = new CoinGeckoService(process.env.COINGECKO_API_KEY);
    
    const adminService = new AdminService();
    const feeWallet = process.env.FEE_WALLET || '';
    const tradingFeeBps = parseInt(process.env.TRADING_FEE_BPS || '50');
    
    console.log(`🔧 DEBUG: FEE_WALLET env var = "${feeWallet}"`);
    console.log(`🔧 DEBUG: TRADING_FEE_BPS env var = ${tradingFeeBps}`);
    
    const feeService = new FeeService({ 
      tradingFeeBps, 
      feeWallet,
      referralPercentage: 0.5,
      minTradeAmount: 0.01,
      enabled: true,
      maintenanceMode: false
    });
    
    await feeService.loadSettingsFromDatabase();
    console.log('⚙️  Bot settings loaded from database');
    console.log(`🔧 DEBUG: Fee wallet after DB load = "${feeService.getFeeWallet()}"`);
    
    // Initialize Jupiter token sync (fetches and caches all tokens from Jupiter)
    console.log('🚀 Initializing Jupiter token sync...');
    try {
      // Perform initial sync and wait for completion
      await jupiterTokenSync.initializeSync();
      
      // Then start the automatic 24-hour refresh
      jupiterTokenSync.startAutoSync();
      
      const tokenCount = await jupiterTokenSync.getTokenCount();
      console.log(`✅ Jupiter token database ready with ${tokenCount} tokens`);
    } catch (error) {
      console.warn('⚠️  Jupiter token sync failed, but continuing without it:', error);
    }
    
    const referralService = new ReferralService();
    const transferService = new TransferService(walletManager.getConnection());

    registerCommands(bot, walletManager, jupiterService, coinGeckoService, adminService, feeService, referralService, transferService);

    bot.catch((err) => {
      console.error('❌ Bot error:', err);
    });

    const botDescription = `🚀 Welcome to Zinochain Bot - Your AI-Powered Multi-Chain Trading Companion!

Trade smarter, not harder! Swap tokens, transfer assets, and manage your portfolio across Solana, Ethereum, and BSC directly in Telegram.

✨ Features:
• Multi-chain token swaps (Solana, Ethereum & BSC)
• P2P transfers across all chains
• Cross-chain portfolio tracking
• Referral rewards
• AES-256 encrypted wallets

🌐 zinochain.com | 🐦 @zinochain | 📧 hi@zinochain.com

Tap /start to begin or /help for commands!`;

    const shortDescription = `Your AI-powered multi-chain trading bot. Swap tokens across Solana, Ethereum & BSC - all in Telegram!`;

    try {
      await bot.api.setMyDescription(botDescription);
      await bot.api.setMyShortDescription(shortDescription);
      console.log('✅ Bot description set successfully');
    } catch (error) {
      console.error('⚠️  Failed to set bot description:', error);
    }


    console.log('✅ Bot commands and callbacks registered');
    console.log('✅ Zinochain Bot is ready!');
    console.log('📱 Open Telegram and start chatting with your bot\n');

    // Start bot with long-polling (no HTTP server needed for Railway worker)
    await bot.start({
      drop_pending_updates: true,
      onStart: (botInfo) => {
        console.log(`🤖 Bot @${botInfo.username} started successfully!`);
        console.log(`🔄 Running in polling mode (Railway worker service)`);
      }
    });
  } catch (error) {
    console.error('❌ Fatal error starting bot:', error);
    process.exit(1);
  }
}

process.on('SIGINT', () => {
  console.log('\n👋 Shutting down Zinochain Bot...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n👋 Shutting down Zinochain Bot...');
  process.exit(0);
});

main();
