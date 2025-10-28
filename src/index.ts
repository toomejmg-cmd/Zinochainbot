import { Bot } from 'grammy';
import dotenv from 'dotenv';
import { WalletManager } from './wallet/walletManager';
import { JupiterService } from './services/jupiter';
import { CoinGeckoService } from './services/coingecko';
import { AdminService } from './services/admin';
import { FeeService } from './services/fees';
import { ReferralService } from './services/referral';
import { registerCommands } from './bot/commandsNew';

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
    const jupiterService = new JupiterService(walletManager.getConnection());
    const coinGeckoService = new CoinGeckoService(process.env.COINGECKO_API_KEY);
    
    const adminService = new AdminService();
    const feeWallet = process.env.FEE_WALLET || '';
    const tradingFeeBps = parseInt(process.env.TRADING_FEE_BPS || '50');
    const feeService = new FeeService({ tradingFeeBps, feeWallet });
    const referralService = new ReferralService();

    registerCommands(bot, walletManager, jupiterService, coinGeckoService, adminService, feeService, referralService);

    bot.catch((err) => {
      console.error('❌ Bot error:', err);
    });

    console.log('✅ Zinobot is ready!');
    console.log('📱 Open Telegram and start chatting with your bot\n');

    await bot.start({
      drop_pending_updates: true,
      onStart: (botInfo) => {
        console.log(`🤖 Bot @${botInfo.username} started successfully!`);
      }
    });
  } catch (error) {
    console.error('❌ Fatal error starting bot:', error);
    process.exit(1);
  }
}

process.on('SIGINT', () => {
  console.log('\n👋 Shutting down Zinobot...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n👋 Shutting down Zinobot...');
  process.exit(0);
});

main();
