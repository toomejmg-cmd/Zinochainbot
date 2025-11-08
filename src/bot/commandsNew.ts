import { Bot, Context, InlineKeyboard, InputFile } from 'grammy';
import { WalletManager } from '../wallet/walletManager';
import { JupiterService, NATIVE_SOL_MINT, USDC_MINT } from '../services/jupiter';
import { CoinGeckoService } from '../services/coingecko';
import { AdminService } from '../services/admin';
import { FeeService } from '../services/fees';
import { ReferralService } from '../services/referral';
import { TransferService } from '../services/transfer';
import { query } from '../database/db';
import { LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import * as path from 'path';
import {
  getMainMenu,
  getBackToMainMenu,
  getBuyMenu,
  getSellMenu,
  getSettingsMenu,
  getAdminMenu,
  getWithdrawMenu,
  getConfirmMenu
} from './menus';

const WELCOME_MESSAGE = `🚀 *Welcome to Zinobot!*
_Your AI-Powered Solana Trading Companion_

⚡️ *Features:*
💰 Instant swaps via Jupiter
📤 P2P transfers
📊 Portfolio tracking
🎁 Referral rewards
🔐 AES-256 encrypted

🌟 *Why Zinobot?*
✅ Best DEX rates
✅ Ultra-low fees
✅ Military-grade security
✅ 24/7 trading

🌐 [zinochain.com](https://zinochain.com) | 🐦 [@zinochain](https://x.com/zinochain)
📧 hi@zinochain.com

*Network:* ${process.env.SOLANA_NETWORK || 'devnet'} 🟢`;

interface UserState {
  awaitingBuyAmount?: boolean;
  awaitingBuyToken?: boolean;
  awaitingSellAmount?: boolean;
  awaitingSellToken?: boolean;
  awaitingWithdrawAddress?: boolean;
  awaitingWithdrawAmount?: boolean;
  awaitingReferralCode?: boolean;
  currentToken?: string;
  withdrawType?: 'sol' | 'token';
}

const userStates = new Map<number, UserState>();

export function registerCommands(
  bot: Bot,
  walletManager: WalletManager,
  jupiterService: JupiterService,
  coinGeckoService: CoinGeckoService,
  adminService: AdminService,
  feeService: FeeService,
  referralService: ReferralService,
  transferService: TransferService
) {
  
  bot.command('start', async (ctx) => {
    const userId = ctx.from?.id;
    const username = ctx.from?.username;
    const firstName = ctx.from?.first_name;
    const lastName = ctx.from?.last_name;

    if (!userId) return;

    const result = await query(
      `INSERT INTO users (telegram_id, username, first_name, last_name)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (telegram_id) DO UPDATE SET username = $2, first_name = $3, last_name = $4
       RETURNING id`,
      [userId, username, firstName, lastName]
    );

    const dbUserId = result.rows[0].id;

    let referralCode = await referralService.getReferralCode(dbUserId);
    if (!referralCode) {
      referralCode = referralService.generateReferralCode(userId);
      await referralService.setReferralCode(dbUserId, referralCode);
    }

    const logoPath = path.join(__dirname, '../../assets/zinobot-logo-original.png');
    
    try {
      await ctx.replyWithPhoto(new InputFile(logoPath), {
        caption: WELCOME_MESSAGE,
        parse_mode: 'Markdown',
        reply_markup: getMainMenu()
      });
    } catch (error) {
      console.error('Error sending logo:', error);
      await ctx.reply(WELCOME_MESSAGE, {
        parse_mode: 'Markdown',
        reply_markup: getMainMenu()
      });
    }
  });

  bot.callbackQuery('menu_main', async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(WELCOME_MESSAGE, {
      parse_mode: 'Markdown',
      reply_markup: getMainMenu()
    });
  });

  bot.callbackQuery('menu_refresh', async (ctx) => {
    await ctx.answerCallbackQuery('Refreshing...');
    await ctx.editMessageText(WELCOME_MESSAGE, {
      parse_mode: 'Markdown',
      reply_markup: getMainMenu()
    });
  });

  bot.callbackQuery('menu_buy', async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(
      `💰 *Buy Tokens*\n\n` +
      `Choose a quick option or enter a custom token address.\n\n` +
      `Current fee: ${feeService.getFeePercentage()}%`,
      {
        parse_mode: 'Markdown',
        reply_markup: getBuyMenu()
      }
    );
  });

  bot.callbackQuery('buy_custom', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    await ctx.answerCallbackQuery();
    await ctx.reply(
      `Please enter the token mint address and SOL amount:\n\n` +
      `Format: \`<token_mint> <sol_amount>\`\n` +
      `Example: \`${USDC_MINT} 0.1\``,
      { parse_mode: 'Markdown' }
    );

    userStates.set(userId, { awaitingBuyToken: true });
  });

  bot.callbackQuery('menu_sell', async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(
      `💸 *Sell Tokens*\n\n` +
      `Choose a token to sell or enter a custom token address.\n\n` +
      `Current fee: ${feeService.getFeePercentage()}%`,
      {
        parse_mode: 'Markdown',
        reply_markup: getSellMenu()
      }
    );
  });

  bot.callbackQuery('sell_custom', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    await ctx.answerCallbackQuery();
    await ctx.reply(
      `Please enter the token mint address and amount:\n\n` +
      `Format: \`<token_mint> <token_amount>\`\n` +
      `Example: \`${USDC_MINT} 100\``,
      { parse_mode: 'Markdown' }
    );

    userStates.set(userId, { awaitingSellToken: true });
  });

  bot.callbackQuery('menu_portfolio', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    await ctx.answerCallbackQuery('Loading portfolio...');

    try {
      const userResult = await query(
        `SELECT id FROM users WHERE telegram_id = $1`,
        [userId]
      );

      if (userResult.rows.length === 0) {
        await ctx.reply('Please use /start first.');
        return;
      }

      const dbUserId = userResult.rows[0].id;
      const wallet = await walletManager.getActiveWallet(dbUserId);

      if (!wallet) {
        await ctx.reply('❌ No wallet found. Use /create_wallet first.', {
          reply_markup: getBackToMainMenu()
        });
        return;
      }

      const portfolio = await walletManager.getPortfolio(wallet.publicKey);
      const solPrice = await coinGeckoService.getSolanaPrice();

      let message = `💼 *Portfolio*\n\n`;
      message += `📍 Wallet: \`${portfolio.publicKey.substring(0, 8)}...${portfolio.publicKey.substring(portfolio.publicKey.length - 8)}\`\n\n`;
      message += `💰 *SOL:* ${portfolio.solBalance.toFixed(4)} SOL`;
      
      if (solPrice > 0) {
        const usdValue = portfolio.solBalance * solPrice;
        message += ` ($${usdValue.toFixed(2)})`;
      }
      
      message += `\n\n`;

      if (portfolio.tokens && portfolio.tokens.length > 0) {
        message += `🪙 *Token Holdings:*\n`;
        for (const token of portfolio.tokens) {
          const shortMint = `${token.mint.substring(0, 6)}...${token.mint.substring(token.mint.length - 4)}`;
          message += `• ${token.balance.toFixed(4)} tokens (\`${shortMint}\`)\n`;
        }
        message += `\n`;
      } else {
        message += `No token holdings yet.\n\n`;
      }

      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        reply_markup: getBackToMainMenu()
      });
    } catch (error: any) {
      console.error('Portfolio error:', error);
      await ctx.reply('❌ Error loading portfolio.');
    }
  });

  bot.callbackQuery('menu_settings', async (ctx) => {
    await ctx.answerCallbackQuery();
    
    const userId = ctx.from?.id;
    if (!userId) return;

    const userResult = await query(`SELECT id FROM users WHERE telegram_id = $1`, [userId]);
    if (userResult.rows.length === 0) return;

    const dbUserId = userResult.rows[0].id;
    const settingsResult = await query(
      `SELECT slippage_bps, notifications_enabled, auto_approve_trades 
       FROM user_settings WHERE user_id = $1`,
      [dbUserId]
    );

    let settings = { slippage_bps: 100, notifications_enabled: true, auto_approve_trades: false };
    if (settingsResult.rows.length > 0) {
      settings = settingsResult.rows[0];
    }

    await ctx.editMessageText(
      `⚙️ *Settings*\n\n` +
      `⚡ Slippage: ${(settings.slippage_bps / 100).toFixed(2)}%\n` +
      `🔔 Notifications: ${settings.notifications_enabled ? 'ON' : 'OFF'}\n` +
      `✅ Auto-Approve: ${settings.auto_approve_trades ? 'ON' : 'OFF'}\n\n` +
      `Click an option to change it.`,
      {
        parse_mode: 'Markdown',
        reply_markup: getSettingsMenu()
      }
    );
  });

  bot.callbackQuery('menu_referral', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    await ctx.answerCallbackQuery();

    const userResult = await query(`SELECT id, referred_by FROM users WHERE telegram_id = $1`, [userId]);
    if (userResult.rows.length === 0) return;

    const dbUserId = userResult.rows[0].id;
    const hasReferrer = userResult.rows[0].referred_by;
    const referralCode = await referralService.getReferralCode(dbUserId);
    const stats = await referralService.getReferralStats(dbUserId);

    await ctx.editMessageText(
      `👥 *Referral Program*\n\n` +
      `🎁 Earn rewards by inviting friends!\n\n` +
      `*Your Referral Code:*\n\`${referralCode}\`\n\n` +
      `*Your Stats:*\n` +
      `👥 Total Referrals: ${stats.totalReferrals}\n` +
      `💰 Total Rewards: ${stats.totalRewards} SOL\n` +
      `✅ Paid: ${stats.paidRewards} SOL\n` +
      `⏳ Pending: ${stats.pendingRewards} SOL\n\n` +
      `${!hasReferrer ? '🔗 Use /applyreferral <code> to apply a referral code\n\n' : ''}` +
      `Share your code with friends to earn rewards!`,
      {
        parse_mode: 'Markdown',
        reply_markup: getBackToMainMenu()
      }
    );
  });

  bot.callbackQuery('menu_withdraw', async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(
      `📤 *Withdraw Funds*\n\n` +
      `Choose what you want to withdraw:`,
      {
        parse_mode: 'Markdown',
        reply_markup: getWithdrawMenu()
      }
    );
  });

  bot.callbackQuery(/menu_(limit|dca|sniper|alerts|rewards)/, async (ctx) => {
    const feature = ctx.match[1];
    const featureNames: any = {
      limit: 'Limit Orders',
      dca: 'DCA Orders',
      sniper: 'Token Sniper',
      alerts: 'Price Alerts',
      rewards: 'Rewards'
    };

    await ctx.answerCallbackQuery(`${featureNames[feature]} - Coming Soon!`);
    await ctx.editMessageText(
      `🚧 *${featureNames[feature]}*\n\n` +
      `This feature is coming in the next update!\n\n` +
      `We're working hard to bring you:\n` +
      `${feature === 'limit' ? '⏰ Set target prices and auto-execute trades' : ''}` +
      `${feature === 'dca' ? '🔄 Schedule recurring token purchases' : ''}` +
      `${feature === 'sniper' ? '🎯 Auto-buy new token listings instantly' : ''}` +
      `${feature === 'alerts' ? '🔔 Get notified on price targets' : ''}` +
      `${feature === 'rewards' ? '🎁 Earn rewards for trading activity' : ''}` +
      `\n\nStay tuned!`,
      {
        parse_mode: 'Markdown',
        reply_markup: getBackToMainMenu()
      }
    );
  });

  bot.callbackQuery('menu_help', async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(
      `❓ *Help & Support*\n\n` +
      `*Available Commands:*\n` +
      `/start - Main menu\n` +
      `/create_wallet - Generate wallet\n` +
      `/wallet - View wallet info\n` +
      `/history - Transaction history\n\n` +
      `*Quick Actions:*\n` +
      `Use the menu buttons for easy navigation.\n\n` +
      `*Common Token Addresses (Devnet):*\n` +
      `USDC: \`${USDC_MINT}\`\n\n` +
      `*Need Help?*\n` +
      `Check our documentation or contact support.`,
      {
        parse_mode: 'Markdown',
        reply_markup: getBackToMainMenu()
      }
    );
  });

  bot.command('admin', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const isAdmin = await adminService.isAdmin(userId);
    if (!isAdmin) {
      await ctx.reply('⛔ Admin access required.');
      return;
    }

    const stats = await adminService.getStats();

    await ctx.reply(
      `👑 *Admin Panel*\n\n` +
      `*Bot Statistics:*\n` +
      `👥 Total Users: ${stats.totalUsers}\n` +
      `💼 Active Wallets: ${stats.activeWallets}\n` +
      `📊 Total Transactions: ${stats.totalTransactions}\n` +
      `💰 Fees Collected: ${stats.totalFeesCollected.toFixed(4)} SOL\n\n` +
      `*Current Settings:*\n` +
      `💵 Trading Fee: ${feeService.getFeePercentage()}%\n\n` +
      `Use the buttons below to manage the bot.`,
      {
        parse_mode: 'Markdown',
        reply_markup: getAdminMenu()
      }
    );
  });

  bot.callbackQuery('admin_stats', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId || !(await adminService.isAdmin(userId))) {
      await ctx.answerCallbackQuery('⛔ Admin access required');
      return;
    }

    await ctx.answerCallbackQuery('Refreshing stats...');
    const stats = await adminService.getStats();

    await ctx.editMessageText(
      `📊 *Detailed Statistics*\n\n` +
      `👥 Total Users: ${stats.totalUsers}\n` +
      `💼 Active Wallets: ${stats.activeWallets}\n` +
      `📈 Total Transactions: ${stats.totalTransactions}\n` +
      `💰 Total Fees: ${stats.totalFeesCollected.toFixed(4)} SOL\n\n` +
      `💵 Current Fee: ${feeService.getFeePercentage()}%`,
      {
        parse_mode: 'Markdown',
        reply_markup: getBackToMainMenu()
      }
    );
  });

  bot.callbackQuery('admin_setfee', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId || !(await adminService.isAdmin(userId))) {
      await ctx.answerCallbackQuery('⛔ Admin access required');
      return;
    }

    await ctx.answerCallbackQuery();
    await ctx.editMessageText(
      `💵 *Set Trading Fee*\n\n` +
      `Current fee: ${feeService.getFeePercentage()}%\n\n` +
      `To change the fee, use the command:\n` +
      `/setfee <percentage>\n\n` +
      `Example: /setfee 0.75\n` +
      `(This sets the fee to 0.75%)`,
      {
        parse_mode: 'Markdown',
        reply_markup: getBackToMainMenu()
      }
    );
  });

  bot.callbackQuery('admin_manage', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId || !(await adminService.isAdmin(userId))) {
      await ctx.answerCallbackQuery('⛔ Admin access required');
      return;
    }

    await ctx.answerCallbackQuery();
    await ctx.editMessageText(
      `👑 *Manage Admins*\n\n` +
      `Current admins can:\n` +
      `• View bot statistics\n` +
      `• Manage trading fees\n` +
      `• Add/remove admins\n\n` +
      `To add an admin:\n/addadmin <telegram_id>\n\n` +
      `To remove an admin:\n/removeadmin <telegram_id>`,
      {
        parse_mode: 'Markdown',
        reply_markup: getBackToMainMenu()
      }
    );
  });

  bot.command('setfee', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId || !(await adminService.isAdmin(userId))) {
      await ctx.reply('⛔ Admin access required.');
      return;
    }

    const args = ctx.message?.text?.split(' ');
    if (!args || args.length !== 2) {
      await ctx.reply('Usage: /setfee <percentage>\nExample: /setfee 0.75');
      return;
    }

    const newFeePercent = parseFloat(args[1]);
    if (isNaN(newFeePercent) || newFeePercent < 0 || newFeePercent > 10) {
      await ctx.reply('❌ Fee must be between 0 and 10%');
      return;
    }

    feeService.setFeePercentage(newFeePercent);
    await ctx.reply(`✅ Trading fee updated to ${newFeePercent}%`);
  });

  bot.command('addadmin', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId || !(await adminService.isAdmin(userId))) {
      await ctx.reply('⛔ Admin access required.');
      return;
    }

    const args = ctx.message?.text?.split(' ');
    if (!args || args.length !== 2) {
      await ctx.reply('Usage: /addadmin <telegram_id>');
      return;
    }

    const newAdminId = parseInt(args[1]);
    if (isNaN(newAdminId)) {
      await ctx.reply('❌ Invalid Telegram ID');
      return;
    }

    await adminService.addAdmin(newAdminId);
    await ctx.reply(`✅ Admin added: ${newAdminId}`);
  });

  bot.command('removeadmin', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId || !(await adminService.isAdmin(userId))) {
      await ctx.reply('⛔ Admin access required.');
      return;
    }

    const args = ctx.message?.text?.split(' ');
    if (!args || args.length !== 2) {
      await ctx.reply('Usage: /removeadmin <telegram_id>');
      return;
    }

    const adminToRemove = parseInt(args[1]);
    if (isNaN(adminToRemove)) {
      await ctx.reply('❌ Invalid Telegram ID');
      return;
    }

    await adminService.removeAdmin(adminToRemove);
    await ctx.reply(`✅ Admin removed: ${adminToRemove}`);
  });

  bot.command('applyreferral', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const args = ctx.message?.text?.split(' ');
    if (!args || args.length !== 2) {
      await ctx.reply('Usage: /applyreferral <code>\nExample: /applyreferral ABC123');
      return;
    }

    const referralCode = args[1].trim().toUpperCase();

    try {
      const userResult = await query(`SELECT id, referred_by FROM users WHERE telegram_id = $1`, [userId]);
      if (userResult.rows.length === 0) {
        await ctx.reply('Please use /start first.');
        return;
      }

      const dbUserId = userResult.rows[0].id;
      if (userResult.rows[0].referred_by) {
        await ctx.reply('❌ You have already used a referral code.');
        return;
      }

      const result = await referralService.applyReferral(dbUserId, referralCode);
      
      if (result) {
        await ctx.reply(`✅ Referral code applied successfully! Welcome to Zinobot!`);
      } else {
        await ctx.reply(`❌ Invalid referral code or you cannot refer yourself.`);
      }
    } catch (error: any) {
      console.error('Apply referral error:', error);
      await ctx.reply('❌ Failed to apply referral code. Please try again.');
    }
  });

  bot.command('create_wallet', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    try {
      const userResult = await query(
        `SELECT id FROM users WHERE telegram_id = $1`,
        [userId]
      );

      if (userResult.rows.length === 0) {
        await ctx.reply('Please use /start first to register.');
        return;
      }

      const dbUserId = userResult.rows[0].id;

      const existingWallet = await walletManager.getActiveWallet(dbUserId);
      if (existingWallet) {
        await ctx.reply(
          `⚠️ You already have an active wallet:\n\n` +
          `Address: \`${existingWallet.publicKey}\`\n\n` +
          `Use /wallet to view details.`,
          { parse_mode: 'Markdown' }
        );
        return;
      }

      await ctx.reply('🔐 Creating your Solana wallet...');

      const wallet = await walletManager.createWallet(dbUserId);

      await ctx.reply(
        `✅ *Wallet Created Successfully!*\n\n` +
        `📍 *Public Address:*\n\`${wallet.publicKey}\`\n\n` +
        `🔑 *Secret Key (SAVE THIS):*\n||\`${wallet.secretKey}\`||\n\n` +
        `⚠️ *IMPORTANT:*\n` +
        `• This is the ONLY time you'll see your secret key\n` +
        `• Store it in a secure location\n` +
        `• Never share it with anyone\n\n` +
        `💡 Get test SOL: https://faucet.solana.com/`,
        { parse_mode: 'Markdown', reply_markup: getMainMenu() }
      );
    } catch (error: any) {
      console.error('Create wallet error:', error);
      await ctx.reply('❌ Error creating wallet. Please try again.');
    }
  });

  bot.command('wallet', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    try {
      const userResult = await query(
        `SELECT id FROM users WHERE telegram_id = $1`,
        [userId]
      );

      if (userResult.rows.length === 0) {
        await ctx.reply('Please use /start first.');
        return;
      }

      const dbUserId = userResult.rows[0].id;
      const wallet = await walletManager.getActiveWallet(dbUserId);

      if (!wallet) {
        await ctx.reply('❌ No wallet found. Use /create_wallet to create one.');
        return;
      }

      const balance = await walletManager.getBalance(wallet.publicKey);

      await ctx.reply(
        `💼 *Your Wallet*\n\n` +
        `📍 *Address:*\n\`${wallet.publicKey}\`\n\n` +
        `💰 *SOL Balance:* ${balance.toFixed(4)} SOL\n\n` +
        `Use the menu for more options.`,
        { parse_mode: 'Markdown', reply_markup: getMainMenu() }
      );
    } catch (error: any) {
      console.error('Wallet command error:', error);
      await ctx.reply('❌ Error retrieving wallet info.');
    }
  });

  bot.command('history', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    try {
      const userResult = await query(
        `SELECT id FROM users WHERE telegram_id = $1`,
        [userId]
      );

      if (userResult.rows.length === 0) {
        await ctx.reply('Please use /start first.');
        return;
      }

      const dbUserId = userResult.rows[0].id;

      const transactions = await query(
        `SELECT transaction_type, signature, from_amount, fee_amount, status, created_at
         FROM transactions
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT 10`,
        [dbUserId]
      );

      if (transactions.rows.length === 0) {
        await ctx.reply('📭 No transactions yet.', { reply_markup: getMainMenu() });
        return;
      }

      let message = `📜 *Transaction History*\n\n`;

      for (const tx of transactions.rows) {
        const date = new Date(tx.created_at).toLocaleDateString();
        const type = tx.transaction_type.toUpperCase();
        const status = tx.status === 'confirmed' ? '✅' : '⏳';
        const fee = tx.fee_amount ? ` (Fee: ${tx.fee_amount})` : '';
        
        message += `${status} *${type}* - ${tx.from_amount || 'N/A'}${fee}\n`;
        message += `   ${date} | \`${tx.signature?.substring(0, 16)}...\`\n\n`;
      }

      await ctx.reply(message, { parse_mode: 'Markdown', reply_markup: getMainMenu() });
    } catch (error: any) {
      console.error('History command error:', error);
      await ctx.reply('❌ Error loading history.');
    }
  });

  bot.command('help', async (ctx) => {
    const helpMessage = `
📚 *Zinobot Command Guide*

━━━━━━━━━━━━━━━━━━━━━━━
*🚀 Getting Started*
━━━━━━━━━━━━━━━━━━━━━━━
/start - Register & open main menu
/create_wallet - Generate new wallet
/wallet - View wallet & balance

━━━━━━━━━━━━━━━━━━━━━━━
*💰 Trading Commands*
━━━━━━━━━━━━━━━━━━━━━━━
/buy - Swap SOL for tokens
/sell - Swap tokens for SOL

*Example:*
\`/buy EPj...SSq 0.1\` (Buy with 0.1 SOL)
\`/sell EPj...SSq 10\` (Sell 10 tokens)

━━━━━━━━━━━━━━━━━━━━━━━
*📤 Transfer Commands*
━━━━━━━━━━━━━━━━━━━━━━━
/transfer - Send tokens to others

*Examples:*
\`/transfer SOL 0.1 @username\`
\`/transfer SOL 0.5 5Z8F...Abc123\`
\`/transfer EPj...SSq 10 @friend\`

━━━━━━━━━━━━━━━━━━━━━━━
*📊 Portfolio & Info*
━━━━━━━━━━━━━━━━━━━━━━━
/portfolio - View token holdings
/history - See recent transactions
/refer - Get referral code & earnings

━━━━━━━━━━━━━━━━━━━━━━━
*🎁 Referral Program*
━━━━━━━━━━━━━━━━━━━━━━━
Share your referral code with friends!
You earn ${feeService.getReferralPercentage()}% of their trading fees.

Use /refer to get your code and track earnings.

━━━━━━━━━━━━━━━━━━━━━━━
*💡 Tips*
━━━━━━━━━━━━━━━━━━━━━━━
• All wallets are encrypted (AES-256)
• Trading fee: ${feeService.getFeePercentage()}%
• Network: ${process.env.SOLANA_NETWORK || 'devnet'}
• Non-custodial (you control funds)

*Need help?* Contact support or visit our docs!
`;

    const keyboard = new InlineKeyboard()
      .text('🏠 Main Menu', 'menu_main');

    await ctx.reply(helpMessage, { 
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  });

  bot.on('message:text', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const state = userStates.get(userId);
    if (!state) return;

    const text = ctx.message.text;

    if (state.awaitingBuyToken) {
      const parts = text.split(' ');
      if (parts.length !== 2) {
        await ctx.reply('❌ Invalid format. Use: `<token_mint> <sol_amount>`', { parse_mode: 'Markdown' });
        return;
      }

      const [tokenMint, solAmountStr] = parts;
      const solAmount = parseFloat(solAmountStr);

      if (isNaN(solAmount) || solAmount <= 0) {
        await ctx.reply('❌ Invalid SOL amount.');
        return;
      }

      userStates.delete(userId);

      try {
        const userResult = await query(`SELECT id FROM users WHERE telegram_id = $1`, [userId]);
        const dbUserId = userResult.rows[0].id;
        const wallet = await walletManager.getActiveWallet(dbUserId);

        if (!wallet) {
          await ctx.reply('❌ No wallet found. Use /create_wallet first.');
          return;
        }

        await ctx.reply(`🔄 Executing swap: ${solAmount} SOL → Token...`);

        const keypair = await walletManager.getKeypair(wallet.id);
        const amountLamports = Math.floor(solAmount * LAMPORTS_PER_SOL);
        const feeAmount = feeService.calculateFee(solAmount);
        const amountAfterFee = solAmount - feeAmount;
        const amountLamportsAfterFee = Math.floor(amountAfterFee * LAMPORTS_PER_SOL);

        const feeWallet = feeService.getFeeWallet();
        let feeTransferSuccess = false;
        if (feeWallet && feeAmount > 0) {
          try {
            await walletManager.transferSOL(keypair, feeWallet, feeAmount);
            feeTransferSuccess = true;
          } catch (feeError) {
            console.error('Fee transfer failed:', feeError);
            throw new Error('Fee collection failed. Transaction aborted.');
          }
        } else {
          feeTransferSuccess = true;
        }

        const signature = await jupiterService.swap(
          keypair,
          NATIVE_SOL_MINT,
          tokenMint,
          amountLamportsAfterFee,
          100
        );

        const txResult = await query(
          `INSERT INTO transactions (wallet_id, user_id, transaction_type, signature, from_token, to_token, from_amount, fee_amount, status)
           VALUES ($1, $2, 'buy', $3, $4, $5, $6, $7, 'confirmed')
           RETURNING id`,
          [wallet.id, dbUserId, signature, NATIVE_SOL_MINT, tokenMint, solAmount, feeTransferSuccess ? feeAmount : 0]
        );

        if (feeTransferSuccess && feeAmount > 0) {
          await feeService.recordFee(txResult.rows[0].id, dbUserId, feeAmount, 'trading', NATIVE_SOL_MINT);
        }

        await ctx.reply(
          `✅ *Swap Successful!*\n\n` +
          `💰 Amount: ${solAmount} SOL\n` +
          `💵 Fee: ${feeAmount.toFixed(4)} SOL\n` +
          `📝 Signature: \`${signature}\`\n\n` +
          `🔗 View: https://solscan.io/tx/${signature}?cluster=${process.env.SOLANA_NETWORK}`,
          { parse_mode: 'Markdown', reply_markup: getMainMenu() }
        );
      } catch (error: any) {
        console.error('Buy error:', error);
        await ctx.reply(`❌ Swap failed: ${error.message}`);
      }
    } else if (state.awaitingSellToken) {
      const parts = text.split(' ');
      if (parts.length !== 2) {
        await ctx.reply('❌ Invalid format. Use: `<token_mint> <token_amount>`', { parse_mode: 'Markdown' });
        return;
      }

      const [tokenMint, tokenAmountStr] = parts;
      const tokenAmount = parseFloat(tokenAmountStr);

      if (isNaN(tokenAmount) || tokenAmount <= 0) {
        await ctx.reply('❌ Invalid token amount.');
        return;
      }

      userStates.delete(userId);

      try {
        const userResult = await query(`SELECT id FROM users WHERE telegram_id = $1`, [userId]);
        const dbUserId = userResult.rows[0].id;
        const wallet = await walletManager.getActiveWallet(dbUserId);

        if (!wallet) {
          await ctx.reply('❌ No wallet found. Use /create_wallet first.');
          return;
        }

        await ctx.reply(`🔄 Executing swap: ${tokenAmount} Token → SOL...`);

        const keypair = await walletManager.getKeypair(wallet.id);
        const decimals = await jupiterService.getTokenDecimals(tokenMint);
        const amountInSmallestUnit = Math.floor(tokenAmount * Math.pow(10, decimals));

        const balanceBefore = await walletManager.getBalance(wallet.publicKey);

        const signature = await jupiterService.swap(
          keypair,
          tokenMint,
          NATIVE_SOL_MINT,
          amountInSmallestUnit,
          100
        );

        const balanceAfter = await walletManager.getBalance(wallet.publicKey);
        const solReceived = balanceAfter - balanceBefore;
        const feeAmount = feeService.calculateFee(solReceived > 0 ? solReceived : 0);
        
        const feeWallet = feeService.getFeeWallet();
        let feeTransferSuccess = false;
        if (feeWallet && feeAmount > 0 && balanceAfter > feeAmount) {
          try {
            await walletManager.transferSOL(keypair, feeWallet, feeAmount);
            feeTransferSuccess = true;
          } catch (feeError) {
            console.error('Fee transfer failed:', feeError);
            await ctx.reply(`⚠️ Swap completed but fee collection failed. Please contact support. Tx: ${signature}`);
          }
        } else {
          feeTransferSuccess = true;
        }

        const txResult = await query(
          `INSERT INTO transactions (wallet_id, user_id, transaction_type, signature, from_token, to_token, from_amount, fee_amount, status)
           VALUES ($1, $2, 'sell', $3, $4, $5, $6, $7, 'confirmed')
           RETURNING id`,
          [wallet.id, dbUserId, signature, tokenMint, NATIVE_SOL_MINT, tokenAmount, feeTransferSuccess ? feeAmount : 0]
        );

        if (feeTransferSuccess && feeAmount > 0) {
          await feeService.recordFee(txResult.rows[0].id, dbUserId, feeAmount, 'trading', NATIVE_SOL_MINT);
        }

        await ctx.reply(
          `✅ *Swap Successful!*\n\n` +
          `💰 Amount: ${tokenAmount} tokens\n` +
          `💵 Fee: ${feeAmount.toFixed(4)} SOL\n` +
          `📝 Signature: \`${signature}\`\n\n` +
          `🔗 View: https://solscan.io/tx/${signature}?cluster=${process.env.SOLANA_NETWORK}`,
          { parse_mode: 'Markdown', reply_markup: getMainMenu() }
        );
      } catch (error: any) {
        console.error('Sell error:', error);
        await ctx.reply(`❌ Swap failed: ${error.message}`);
      }
    }
  });

  bot.command('transfer', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const dbUser = await query('SELECT id FROM users WHERE telegram_id = $1', [userId]);
    if (dbUser.rows.length === 0) {
      return ctx.reply('❌ Please /start the bot first.');
    }

    const args = ctx.message?.text?.split(' ').slice(1);
    if (!args || args.length < 3) {
      return ctx.reply(
        `📤 *Transfer Tokens*\n\n` +
        `Usage: \`/transfer <token_mint> <amount> <recipient>\`\n\n` +
        `Examples:\n` +
        `• \`/transfer SOL 0.1 @username\`\n` +
        `• \`/transfer SOL 0.1 5Z8F...Abc123\`\n` +
        `• \`/transfer EPj...SSq 10 @username\`\n\n` +
        `Notes:\n` +
        `• Use "SOL" for native Solana transfers\n` +
        `• Recipient can be @username or wallet address\n` +
        `• Make sure you have enough balance`,
        { parse_mode: 'Markdown' }
      );
    }

    try {
      const [tokenInput, amountStr, recipientStr] = args;
      const amount = parseFloat(amountStr);

      if (isNaN(amount) || amount <= 0) {
        return ctx.reply('❌ Invalid amount. Must be a positive number.');
      }

      const wallet = await query(
        'SELECT * FROM wallets WHERE user_id = $1 AND is_active = true ORDER BY created_at DESC LIMIT 1',
        [dbUser.rows[0].id]
      );

      if (wallet.rows.length === 0) {
        return ctx.reply('❌ No active wallet found. Create one with /create_wallet');
      }

      const keypair = await walletManager.getKeypair(wallet.rows[0].encrypted_key);
      
      let recipientWallet: string;
      let recipientId: number | null = null;

      if (recipientStr.startsWith('@')) {
        const username = recipientStr.substring(1);
        const recipientUser = await query(
          'SELECT u.id, w.public_key FROM users u JOIN wallets w ON w.user_id = u.id WHERE u.username = $1 AND w.is_active = true LIMIT 1',
          [username]
        );

        if (recipientUser.rows.length === 0) {
          return ctx.reply(`❌ User @${username} not found or has no wallet.`);
        }

        recipientWallet = recipientUser.rows[0].public_key;
        recipientId = recipientUser.rows[0].id;
      } else {
        try {
          new PublicKey(recipientStr);
          recipientWallet = recipientStr;
        } catch {
          return ctx.reply('❌ Invalid wallet address or username.');
        }
      }

      await ctx.reply('⏳ Processing transfer...');

      let signature: string;

      if (tokenInput.toUpperCase() === 'SOL') {
        const balance = await walletManager.getBalance(wallet.rows[0].public_key);
        if (balance < amount) {
          return ctx.reply(`❌ Insufficient balance. You have ${balance.toFixed(4)} SOL`);
        }

        signature = await transferService.transferSOL(
          keypair,
          recipientWallet,
          amount,
          dbUser.rows[0].id,
          recipientId
        );
      } else {
        const tokenMint = tokenInput;
        
        signature = await transferService.transferSPLToken(
          keypair,
          recipientWallet,
          tokenMint,
          amount,
          9,
          dbUser.rows[0].id,
          recipientId,
          'TOKEN'
        );
      }

      const recipientDisplay = recipientId ? `@${recipientStr.substring(1)}` : `${recipientWallet.slice(0, 4)}...${recipientWallet.slice(-4)}`;

      await ctx.reply(
        `✅ *Transfer Successful!*\n\n` +
        `📤 Sent: ${amount} ${tokenInput.toUpperCase()}\n` +
        `👤 To: ${recipientDisplay}\n` +
        `📝 Signature: \`${signature}\`\n\n` +
        `🔗 View: https://solscan.io/tx/${signature}?cluster=${process.env.SOLANA_NETWORK}`,
        { parse_mode: 'Markdown', reply_markup: getMainMenu() }
      );
    } catch (error: any) {
      console.error('Transfer error:', error);
      await ctx.reply(`❌ Transfer failed: ${error.message || 'Unknown error'}`);
    }
  });

  console.log('✅ Bot commands and callbacks registered');
}
