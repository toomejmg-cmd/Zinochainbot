import { Bot, Context, InlineKeyboard, InputFile } from 'grammy';
import { WalletManager } from '../wallet/walletManager';
import { JupiterService, NATIVE_SOL_MINT, USDC_MINT } from '../services/jupiter';
import { CoinGeckoService } from '../services/coingecko';
import { AdminService } from '../services/admin';
import { FeeService } from '../services/fees';
import { ReferralService } from '../services/referral';
import { TransferService } from '../services/transfer';
import { WatchlistService } from '../services/watchlist';
import { query } from '../database/db';
import { LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import * as path from 'path';
import bs58 from 'bs58';
import { MultiChainWalletService } from '../services/multiChainWallet';
import { ChainType } from '../adapters/IChainAdapter';
import { URLParserService } from '../services/urlParser';
import { TokenInfoService } from '../services/tokenInfo';
import { userSettingsService } from '../services/userSettings';
import {
  getMainMenu,
  getBackToMainMenu,
  getWalletMenu,
  getBuyMenu,
  getSellMenu,
  getSettingsMenu,
  getAdminMenu,
  getWithdrawMenu,
  getConfirmMenu,
  getChainSelectorMenu,
  getTokenManagementMenu,
  getWatchlistMenu
} from './menus';

const TERMS_MESSAGE = `🚀 *Welcome to Zinobot!*

Your AI-powered Solana trading companion for instant token swaps, transfers, and portfolio management.

⚡ *What We Offer:*
• Lightning-fast token swaps via Jupiter
• Secure P2P transfers
• Real-time portfolio tracking  
• Referral rewards program
• Bank-grade AES-256 encryption

⚠️ *Before You Continue:*
By using Zinobot, you agree to our Terms of Service and Privacy Policy.

📄 [Terms of Service](https://zinochain.com/terms)
🔒 [Privacy Policy](https://zinochain.com/privacy)

*Network:* ${process.env.SOLANA_NETWORK || 'devnet'} 🟢

Tap "Continue" to accept and proceed.`;

const MAIN_DASHBOARD_MESSAGE = (walletAddress: string, solBalance: number, solPrice: number) => `
💼 *Zinobot Trading Dashboard*

📍 *Your Wallet Address:*
\`${walletAddress}\`
_(Tap to copy)_

💰 *Balance:*
${solBalance.toFixed(4)} SOL${solPrice > 0 ? ` ($${(solBalance * solPrice).toFixed(2)})` : ''}

🎯 *Quick Actions:*
• Buy tokens with best rates via Jupiter
• Sell tokens instantly
• Transfer SOL & tokens P2P
• Track your full portfolio
• Earn rewards through referrals

⚡ *Trading Features:*
✅ Limit orders for precise entries
✅ DCA (Dollar Cost Averaging)
✅ Sniper for new token launches
✅ Real-time price alerts

🌐 [zinochain.com](https://zinochain.com) | 🐦 [@zinochain](https://x.com/zinochain)

Choose an action below to get started! 👇
`;

interface UserState {
  awaitingBuyAmount?: boolean;
  awaitingBuyToken?: boolean;
  awaitingSellAmount?: boolean;
  awaitingSellToken?: boolean;
  awaitingWithdrawAddress?: boolean;
  awaitingWithdrawAmount?: boolean;
  awaitingReferralCode?: boolean;
  awaitingWatchlistToken?: boolean;
  awaitingImportSeed?: boolean;
  currentToken?: string;
  withdrawType?: 'sol' | 'token';
  selectedChain?: 'solana' | 'ethereum' | 'bsc';
  currentChain?: 'solana' | 'ethereum' | 'bsc';
  awaitingSettingInput?: string;
}

interface NavigationHistory {
  menuName: string;
  messageId?: number;
}

const userStates = new Map<number, UserState>();
const navigationHistory = new Map<number, NavigationHistory[]>();

// Helper function to push navigation history
function pushNavigation(userId: number, menuName: string, messageId?: number) {
  const history = navigationHistory.get(userId) || [];
  history.push({ menuName, messageId });
  navigationHistory.set(userId, history);
}

// Helper function to pop navigation history
function popNavigation(userId: number): NavigationHistory | undefined {
  const history = navigationHistory.get(userId) || [];
  const previous = history.pop();
  navigationHistory.set(userId, history);
  return previous;
}

// Helper function to get last navigation
function getLastNavigation(userId: number): NavigationHistory | undefined {
  const history = navigationHistory.get(userId) || [];
  return history[history.length - 1];
}

// Helper function to get help message and keyboard
function getHelpContent(): { message: string; keyboard: InlineKeyboard } {
  const message = `❓ *Help and Support*\n\n` +
    `*How do I use Zinobot?*\n` +
    `Visit our detailed [documentation](https://zinobot.io) where we explain it all, and join our support chat @zinogroup for additional resources.\n\n` +
    `*Where can I find my referral code?*\n` +
    `Go to "Refer Friends" and click 🔗 Referrals.\n\n` +
    `*What are the fees for using Zinobot?*\n` +
    `We charge a 0.5% fee per transaction. If you refer users, you may earn a small commission. We don't charge a subscription fee or paywall any features.\n\n` +
    `*Security Tips: How can I protect my account from scammers?*\n` +
    `• *Beware of fake accounts* trying to impersonate the bot\n` +
    `• *NEVER search for bots in Telegram.* Use only official links\n` +
    `• *Always verify* token addresses and liquidity before trading\n\n` +
    `*For an additional layer of security, setup your Secure Action Password (SAP)* in Settings. Once enabled, you'll need to enter the password to perform any sensitive actions like withdrawing funds, exporting a wallet, or resetting a wallet. You can set SAP to expire after a certain time.\n\n` +
    `*Trading Tips: Common Failure Reasons*\n` +
    `• Adjust slippage for volatile pairs (see Menu → Settings)\n` +
    `• Increase balance for your transactions; you need more SOL or reduce your amount\n` +
    `• *Timed out?* Can occur with heavy network loads; consider adjusting gas/priority fees\n\n` +
    `*My PNL doesn't appear, why is that?*\n` +
    `PNL indicators compute automatically after the transaction completes. Confirm your gas fee settings and ensure your slippage aligns with your trading style. Wait 15–30 seconds, then check your trade on [Solscan](https://solscan.io) to verify net profit.\n\n` +
    `*Join our community*\n` +
    `Join our Telegram group @zinogroup and one of our admins can assist you.`;

  const keyboard = new InlineKeyboard()
    .url('📱 Join Community', 'https://t.me/zinogroup')
    .row()
    .text('🏠 Main Menu', 'menu_main')
    .text('❌ Close', 'close_menu');

  return { message, keyboard };
}

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
  
  const multiChainWalletService = new MultiChainWalletService();
  const urlParser = new URLParserService();
  const tokenInfoService = new TokenInfoService();
  const watchlistService = new WatchlistService();
  
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
       RETURNING id, onboarding_completed, current_chain`,
      [userId, username, firstName, lastName]
    );

    const dbUserId = result.rows[0].id;
    const onboardingCompleted = result.rows[0].onboarding_completed;
    const currentChain = (result.rows[0].current_chain as ChainType) || 'solana';

    // Ensure user has default settings
    await userSettingsService.getSettings(dbUserId);

    const startPayload = ctx.match;
    if (startPayload && startPayload.startsWith('ref-')) {
      try {
        await referralService.processReferral(dbUserId, startPayload);
      } catch (err) {
        console.error('Error processing referral:', err);
      }
    }

    if (onboardingCompleted) {
      // Get wallet for user's current chain
      const wallet = await multiChainWalletService.getWallet(dbUserId, currentChain);
      if (wallet) {
        const balance = await multiChainWalletService.getBalance(dbUserId, currentChain);
        const chainInfo = multiChainWalletService.getChainManager().getChainInfo(currentChain);

        const dashboardMessage = `
${chainInfo.icon} *${chainInfo.name} Dashboard*

📍 *Wallet Address:*
\`${wallet.publicKey}\`
_(Tap to copy)_

💰 *Balance:* ${parseFloat(balance).toFixed(4)} ${chainInfo.nativeToken.symbol}

🌐 *Network:* ${chainInfo.name}

Choose an action below! 👇
`;
        
        await ctx.reply(dashboardMessage, {
          parse_mode: 'Markdown',
          reply_markup: getMainMenu(currentChain)
        });
        return;
      }
    }

    const termsKeyboard = new InlineKeyboard().text('✅ Continue', 'onboarding_accept_terms');
    
    await ctx.reply(TERMS_MESSAGE, {
      parse_mode: 'Markdown',
      reply_markup: termsKeyboard
    });
  });

  bot.callbackQuery('onboarding_accept_terms', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    await ctx.answerCallbackQuery('Terms accepted!');

    const chainSelectionMessage = `
🌐 *Select Your Blockchain*

Choose which blockchain you'd like to start with:

⚡ *Solana* - Fast, low-cost transactions
🔷 *Ethereum* - Most established DeFi ecosystem  
🟡 *Binance Smart Chain* - Low fees, high speed

You can add wallets on other chains later from Settings!

Which chain would you like to use?
`;

    const chainKeyboard = new InlineKeyboard()
      .text('⚡ Solana', 'onboarding_chain_solana').row()
      .text('🔷 Ethereum', 'onboarding_chain_ethereum').row()
      .text('🟡 BSC', 'onboarding_chain_bsc');

    await ctx.editMessageText(chainSelectionMessage, {
      parse_mode: 'Markdown',
      reply_markup: chainKeyboard
    });
  });

  bot.callbackQuery(/^onboarding_chain_(solana|ethereum|bsc)$/, async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const match = ctx.callbackQuery.data.match(/^onboarding_chain_(solana|ethereum|bsc)$/);
    if (!match) return;

    const selectedChain = match[1] as 'solana' | 'ethereum' | 'bsc';
    
    await ctx.answerCallbackQuery(`Creating your ${selectedChain.toUpperCase()} wallet...`);

    const userResult = await query(`SELECT id FROM users WHERE telegram_id = $1`, [userId]);
    if (userResult.rows.length === 0) return;

    const dbUserId = userResult.rows[0].id;
    
    // Save selected chain to database (persistent)
    await query(`UPDATE users SET current_chain = $1 WHERE id = $2`, [selectedChain, dbUserId]);
    
    // Also update in-memory state for current session
    const state = userStates.get(userId) || {};
    state.currentChain = selectedChain;
    userStates.set(userId, state);
    
    let secretKey = '';
    let publicKey = '';

    // Check if wallet already exists for this chain
    const existingWallet = await multiChainWalletService.getWallet(dbUserId, selectedChain);

    if (!existingWallet) {
      // Create new wallet for the selected chain
      const newWallet = await multiChainWalletService.createWallet(dbUserId, selectedChain);
      secretKey = newWallet.privateKey;
      publicKey = newWallet.publicKey;
    } else {
      // Get existing wallet credentials
      publicKey = existingWallet.publicKey;
      secretKey = await multiChainWalletService.getPrivateKey(existingWallet.id);
    }

    const chainEmoji = selectedChain === 'solana' ? '⚡' : selectedChain === 'ethereum' ? '🔷' : '🟡';
    const chainName = selectedChain === 'solana' ? 'Solana' : selectedChain === 'ethereum' ? 'Ethereum' : 'BSC';

    const walletCredentialsMessage = `
🔐 *Your ${chainEmoji} ${chainName} Wallet Credentials*

📍 *Wallet Address:*
\`${publicKey}\`
_(Tap to copy)_

🔑 *Private Key:*
||${secretKey}||
_(Tap to reveal - KEEP SECRET!)_

⚠️ *CRITICAL SECURITY WARNING:*
🔴 NEVER share your private key with ANYONE
🔴 Screenshot and store it OFFLINE immediately
🔴 We will NEVER ask for your private key
🔴 Losing this key = losing access to your funds
🔴 This message will auto-delete in 10 minutes

✅ *Secure Backup Tips:*
• Write it down on paper (best practice)
• Store in a password manager (encrypted)
• Keep multiple secure backups
• NEVER store in cloud services or screenshots

⏰ *This sensitive information will be automatically deleted in 10 minutes for your security.*

Once you've safely backed up your private key, tap Continue! 👇
`;

    const continueKeyboard = new InlineKeyboard().text('✅ I Saved My Key - Continue', 'onboarding_continue_to_dashboard');

    await ctx.editMessageText(walletCredentialsMessage, {
      parse_mode: 'Markdown',
      reply_markup: continueKeyboard
    });

    setTimeout(async () => {
      try {
        await ctx.deleteMessage();
      } catch (error) {
        console.log('Could not delete onboarding message (may have been manually deleted)');
      }
    }, 10 * 60 * 1000);
  });

  bot.callbackQuery('onboarding_continue_to_dashboard', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    await ctx.answerCallbackQuery('Loading dashboard...');

    const userResult = await query(`SELECT id FROM users WHERE telegram_id = $1`, [userId]);
    if (userResult.rows.length === 0) return;

    const dbUserId = userResult.rows[0].id;

    await query(`UPDATE users SET onboarding_completed = TRUE WHERE id = $1`, [dbUserId]);

    // Load current chain from database
    const userChainResult = await query(`SELECT current_chain FROM users WHERE id = $1`, [dbUserId]);
    const currentChain = (userChainResult.rows[0]?.current_chain as ChainType) || 'solana';

    // Get wallet for current chain
    const wallet = await multiChainWalletService.getWallet(dbUserId, currentChain);
    if (!wallet) return;

    const balance = await multiChainWalletService.getBalance(dbUserId, currentChain);
    const chainInfo = multiChainWalletService.getChainManager().getChainInfo(currentChain);

    const dashboardMessage = `
${chainInfo.icon} *${chainInfo.name} Dashboard*

📍 *Wallet Address:*
\`${wallet.publicKey}\`
_(Tap to copy)_

💰 *Balance:* ${parseFloat(balance).toFixed(4)} ${chainInfo.nativeToken.symbol}

🌐 *Network:* ${chainInfo.name}

Choose an action below! 👇
`;

    await ctx.editMessageText(dashboardMessage, {
      parse_mode: 'Markdown',
      reply_markup: getMainMenu(currentChain)
    });
  });

  // Chain switching callbacks
  bot.callbackQuery('menu_switch_chain', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    await ctx.answerCallbackQuery();

    pushNavigation(userId, 'chain_selector');

    const chainSelectionMessage = `
🌐 *Select Blockchain*

Choose which blockchain you want to trade on:

⚡ *Solana* - Fast, low-cost transactions
🔷 *Ethereum* - Most established DeFi ecosystem  
🟡 *BSC* - Low fees, high speed

Your wallets are saved - you can switch between chains anytime!
`;

    await ctx.editMessageText(chainSelectionMessage, {
      parse_mode: 'Markdown',
      reply_markup: getChainSelectorMenu()
    });
  });

  bot.callbackQuery(/^switch_chain_(solana|ethereum|bsc)$/, async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const match = ctx.callbackQuery.data.match(/^switch_chain_(solana|ethereum|bsc)$/);
    if (!match) return;

    const selectedChain = match[1] as ChainType;

    await ctx.answerCallbackQuery(`Switching to ${selectedChain.toUpperCase()}...`);

    const userResult = await query(`SELECT id FROM users WHERE telegram_id = $1`, [userId]);
    if (userResult.rows.length === 0) return;

    const dbUserId = userResult.rows[0].id;

    // Update user's current chain in database (persistent)
    await query(`UPDATE users SET current_chain = $1 WHERE id = $2`, [selectedChain, dbUserId]);

    // Also update in-memory state for current session
    const state = userStates.get(userId) || {};
    state.currentChain = selectedChain;
    userStates.set(userId, state);

    // Check if user has a wallet on this chain
    const wallet = await multiChainWalletService.getWallet(dbUserId, selectedChain);

    if (!wallet) {
      // User doesn't have a wallet on this chain yet
      const createWalletMessage = `
⚠️ *No ${selectedChain.toUpperCase()} Wallet Found*

You don't have a wallet on ${selectedChain} yet.

Would you like to create one now?
`;

      const createKeyboard = new InlineKeyboard()
        .text('✅ Create Wallet', `create_wallet_${selectedChain}`)
        .row()
        .text('🏠 Main Menu', 'menu_main');

      await ctx.editMessageText(createWalletMessage, {
        parse_mode: 'Markdown',
        reply_markup: createKeyboard
      });
      return;
    }

    // Load dashboard for the selected chain
    const balance = await multiChainWalletService.getBalance(dbUserId, selectedChain);
    const chainInfo = multiChainWalletService.getChainManager().getChainInfo(selectedChain);

    const dashboardMessage = `
${chainInfo.icon} *${chainInfo.name} Dashboard*

📍 *Wallet Address:*
\`${wallet.publicKey}\`
_(Tap to copy)_

💰 *Balance:* ${parseFloat(balance).toFixed(4)} ${chainInfo.nativeToken.symbol}

🌐 *Network:* ${chainInfo.name}

Choose an action below! 👇
`;

    await ctx.editMessageText(dashboardMessage, {
      parse_mode: 'Markdown',
      reply_markup: getMainMenu(selectedChain)
    });
  });

  bot.callbackQuery(/^create_wallet_(solana|ethereum|bsc)$/, async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const match = ctx.callbackQuery.data.match(/^create_wallet_(solana|ethereum|bsc)$/);
    if (!match) return;

    const selectedChain = match[1] as ChainType;

    await ctx.answerCallbackQuery(`Creating ${selectedChain.toUpperCase()} wallet...`);

    const userResult = await query(`SELECT id FROM users WHERE telegram_id = $1`, [userId]);
    if (userResult.rows.length === 0) return;

    const dbUserId = userResult.rows[0].id;

    // Create new wallet for this chain
    const newWallet = await multiChainWalletService.createWallet(dbUserId, selectedChain);

    const chainEmoji = selectedChain === 'solana' ? '⚡' : selectedChain === 'ethereum' ? '🔷' : '🟡';
    const chainName = selectedChain === 'solana' ? 'Solana' : selectedChain === 'ethereum' ? 'Ethereum' : 'BSC';

    const walletCreatedMessage = `
🔐 *Your ${chainEmoji} ${chainName} Wallet Created!*

📍 *Wallet Address:*
\`${newWallet.publicKey}\`
_(Tap to copy)_

🔑 *Private Key:*
||${newWallet.privateKey}||
_(Tap to reveal - KEEP SECRET!)_

⚠️ *CRITICAL SECURITY WARNING:*
🔴 NEVER share your private key with ANYONE
🔴 Screenshot and store it OFFLINE immediately
🔴 We will NEVER ask for your private key
🔴 This message will auto-delete in 10 minutes

✅ *Secure Backup Tips:*
• Write it down on paper (best practice)
• Store in a password manager (encrypted)
• Keep multiple secure backups

⏰ *This sensitive information will be automatically deleted in 10 minutes.*

Tap Continue when ready! 👇
`;

    const continueKeyboard = new InlineKeyboard().text('✅ Continue', 'menu_main');

    await ctx.editMessageText(walletCreatedMessage, {
      parse_mode: 'Markdown',
      reply_markup: continueKeyboard
    });

    setTimeout(async () => {
      try {
        await ctx.deleteMessage();
      } catch (error) {
        console.log('Could not delete wallet credentials message');
      }
    }, 10 * 60 * 1000);
  });

  bot.callbackQuery('menu_main', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    await ctx.answerCallbackQuery();

    // Clear any active command states for clean environment
    userStates.delete(userId);

    const userResult = await query(`SELECT id, onboarding_completed, current_chain FROM users WHERE telegram_id = $1`, [userId]);
    if (userResult.rows.length === 0) return;

    const dbUserId = userResult.rows[0].id;
    const onboardingCompleted = userResult.rows[0].onboarding_completed;
    const currentChain = (userResult.rows[0].current_chain as ChainType) || 'solana';

    if (!onboardingCompleted) {
      await ctx.reply('Please complete onboarding first. Send /start to begin.');
      return;
    }

    // Get wallet for current chain
    const wallet = await multiChainWalletService.getWallet(dbUserId, currentChain);
    if (!wallet) {
      await ctx.reply(`No wallet found for ${currentChain}. Please create one from the chain selector.`);
      return;
    }

    const balance = await multiChainWalletService.getBalance(dbUserId, currentChain);
    const chainInfo = multiChainWalletService.getChainManager().getChainInfo(currentChain);

    const dashboardMessage = `
${chainInfo.icon} *${chainInfo.name} Dashboard*

📍 *Wallet Address:*
\`${wallet.publicKey}\`
_(Tap to copy)_

💰 *Balance:* ${parseFloat(balance).toFixed(4)} ${chainInfo.nativeToken.symbol}

🌐 *Network:* ${chainInfo.name}

Choose an action below! 👇
`;

    await ctx.editMessageText(dashboardMessage, {
      parse_mode: 'Markdown',
      reply_markup: getMainMenu(currentChain)
    });

    // Initialize navigation history with main menu
    navigationHistory.set(userId, [{ menuName: 'main' }]);
  });

  bot.callbackQuery('menu_refresh', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    await ctx.answerCallbackQuery('Refreshing...');

    const userResult = await query(`SELECT id, current_chain FROM users WHERE telegram_id = $1`, [userId]);
    if (userResult.rows.length === 0) return;

    const dbUserId = userResult.rows[0].id;
    const currentChain = (userResult.rows[0].current_chain as ChainType) || 'solana';

    // Get wallet for current chain
    const wallet = await multiChainWalletService.getWallet(dbUserId, currentChain);
    if (!wallet) {
      await ctx.reply(`No wallet found for ${currentChain}. Please create one from the chain selector.`);
      return;
    }

    const balance = await multiChainWalletService.getBalance(dbUserId, currentChain);
    const chainInfo = multiChainWalletService.getChainManager().getChainInfo(currentChain);

    const dashboardMessage = `
${chainInfo.icon} *${chainInfo.name} Dashboard*

📍 *Wallet Address:*
\`${wallet.publicKey}\`
_(Tap to copy)_

💰 *Balance:* ${parseFloat(balance).toFixed(4)} ${chainInfo.nativeToken.symbol}

🌐 *Network:* ${chainInfo.name}

Choose an action below! 👇
`;

    await ctx.editMessageText(dashboardMessage, {
      parse_mode: 'Markdown',
      reply_markup: getMainMenu(currentChain)
    });
  });

  bot.callbackQuery('menu_buy', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

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

    pushNavigation(userId, 'buy');
  });

  bot.callbackQuery('buy_custom', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    await ctx.answerCallbackQuery();
    await ctx.reply(
      `💰 *Buy Tokens*\n\n` +
      `Enter one of the following:\n\n` +
      `1️⃣ Token address (e.g., \`${USDC_MINT}\`)\n` +
      `2️⃣ Token ticker/symbol (e.g., \`ZCXT\`)\n` +
      `3️⃣ URL from:\n` +
      `   • pump.fun\n` +
      `   • Birdeye\n` +
      `   • DEX Screener\n` +
      `   • Moonshot\n\n` +
      `📎 *Example URLs:*\n` +
      `\`https://pump.fun/coin/3wppuw...\`\n` +
      `\`https://dexscreener.com/solana/abc...\`\n\n` +
      `I'll show you the token details before you buy! 🚀`,
      { parse_mode: 'Markdown' }
    );

    userStates.set(userId, { awaitingBuyToken: true });
  });

  bot.callbackQuery('menu_sell', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    await ctx.answerCallbackQuery('Loading your tokens...');

    try {
      const userResult = await query(`SELECT id FROM users WHERE telegram_id = $1`, [userId]);
      if (userResult.rows.length === 0) {
        await ctx.reply('Please use /start first.');
        return;
      }

      const dbUserId = userResult.rows[0].id;
      
      // Get wallet with chain info
      const walletResult = await query(
        `SELECT id, public_key, chain FROM wallets WHERE user_id = $1 AND is_active = true ORDER BY id DESC LIMIT 1`,
        [dbUserId]
      );

      if (walletResult.rows.length === 0) {
        await ctx.editMessageText(
          `💸 *Sell Tokens*\n\n` +
          `❌ No wallet found. Please create a wallet first using /create_wallet`,
          {
            parse_mode: 'Markdown',
            reply_markup: getBackToMainMenu()
          }
        );
        return;
      }

      const wallet = walletResult.rows[0];
      const chain = wallet.chain || 'solana';
      
      // Currently only Solana selling is supported
      if (chain !== 'solana') {
        await ctx.editMessageText(
          `💸 *Sell Tokens*\n\n` +
          `Your active wallet is on ${chain.toUpperCase()}.\n\n` +
          `Token selling is currently only available on Solana. Please switch to Solana or create a Solana wallet.`,
          {
            parse_mode: 'Markdown',
            reply_markup: new InlineKeyboard()
              .text('⚡ Switch to Solana', 'switch_chain_solana')
              .row()
              .text('🔙 Back', 'back')
              .text('❌ Close', 'close_menu')
          }
        );
        pushNavigation(userId, 'sell');
        return;
      }

      const portfolio = await walletManager.getPortfolio(wallet.public_key);

      if (portfolio.tokens.length === 0) {
        await ctx.editMessageText(
          `💸 *Sell*\n\n` +
          `You do not have any tokens yet. Start trading in the Buy menu.`,
          {
            parse_mode: 'Markdown',
            reply_markup: new InlineKeyboard()
              .text('🔙 Back', 'back')
              .text('🔄 Refresh', 'menu_sell')
          }
        );
        pushNavigation(userId, 'sell');
        return;
      }

      let message = `💸 *Sell Tokens*\n\n`;
      message += `Select a token to sell:\n\n`;
      message += `Current fee: ${feeService.getFeePercentage()}%\n\n`;

      const keyboard = new InlineKeyboard();
      
      for (let i = 0; i < portfolio.tokens.length && i < 10; i++) {
        const token = portfolio.tokens[i];
        const shortMint = `${token.mint.substring(0, 4)}...${token.mint.substring(token.mint.length - 4)}`;
        const buttonText = `🪙 ${shortMint} (${token.balance.toFixed(4)})`;
        keyboard.text(buttonText, `sell_token_${token.mint}`).row();
      }

      if (portfolio.tokens.length > 10) {
        message += `\n_Showing first 10 tokens only_\n`;
      }

      keyboard.text('📝 Custom Token Address', 'sell_custom').row();
      keyboard.text('🔙 Back', 'back').text('❌ Close', 'close_menu');

      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });

      pushNavigation(userId, 'sell');
    } catch (error: any) {
      console.error('Sell menu error:', error);
      await ctx.reply('❌ Error loading tokens. Please try again.');
    }
  });

  // Handle selling a specific token from the list
  bot.callbackQuery(/^sell_token_(.+)$/, async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const tokenMint = ctx.match[1];
    await ctx.answerCallbackQuery();

    try {
      const userResult = await query(`SELECT id FROM users WHERE telegram_id = $1`, [userId]);
      if (userResult.rows.length === 0) {
        await ctx.reply('Please use /start first.');
        return;
      }

      const dbUserId = userResult.rows[0].id;
      const wallet = await walletManager.getActiveWallet(dbUserId);

      if (!wallet) {
        await ctx.reply('❌ No wallet found.');
        return;
      }

      const portfolio = await walletManager.getPortfolio(wallet.publicKey);
      const token = portfolio.tokens.find((t: any) => t.mint === tokenMint);

      if (!token) {
        await ctx.reply('❌ Token not found in your wallet.');
        return;
      }

      await ctx.editMessageText(
        `💸 *Sell Token*\n\n` +
        `🪙 Token: \`${tokenMint}\`\n` +
        `💰 Available: ${token.balance.toFixed(4)}\n\n` +
        `Enter the amount you want to sell:\n\n` +
        `*Example:* \`${(token.balance / 2).toFixed(4)}\` (half)\n` +
        `or \`all\` to sell everything`,
        { parse_mode: 'Markdown' }
      );

      userStates.set(userId, { 
        awaitingSellAmount: true,
        currentToken: tokenMint
      });
    } catch (error: any) {
      console.error('Sell token error:', error);
      await ctx.reply('❌ Error processing token sale.');
    }
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

      pushNavigation(userId, 'portfolio');
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

    const settingsMessage = `
⚙️ *Settings Menu*

Configure your Zinobot experience by selecting a category below:

💱 *Trading Settings*
Set slippage, fees, and trade preferences

🤖 *AI Trader Settings*
Configure AI trading mode and risk levels

🔒 *Security & Privacy*
MEV protection, anti-rug, and confirmations

🔔 *Notifications*
Manage alerts and notifications

🎨 *Display & Preferences*
Chain, currency, and UI preferences

📊 *Advanced*
RPC endpoints, transaction speed, debug mode

Select a category to view and modify settings:
`;

    const settingsKeyboard = new InlineKeyboard()
      .text('💱 Trading', 'settings_trading').row()
      .text('🤖 AI Trader', 'settings_ai').row()
      .text('🔒 Security', 'settings_security').row()
      .text('🔔 Notifications', 'settings_notifications').row()
      .text('🎨 Display', 'settings_display').row()
      .text('📊 Advanced', 'settings_advanced').row()
      .text('🔙 Back', 'menu_main');

    await ctx.editMessageText(settingsMessage, {
      parse_mode: 'Markdown',
      reply_markup: settingsKeyboard
    });

    pushNavigation(userId, 'settings');
  });

  bot.callbackQuery('settings_trading', async (ctx) => {
    await ctx.answerCallbackQuery();
    
    const userId = ctx.from?.id;
    if (!userId) return;

    const userResult = await query(`SELECT id FROM users WHERE telegram_id = $1`, [userId]);
    if (userResult.rows.length === 0) return;

    const dbUserId = userResult.rows[0].id;
    const settings = await userSettingsService.getSettings(dbUserId);

    const tradingMessage = `
💱 *Trading Settings*

⚡ *Slippage:* ${(settings.slippageBps / 100).toFixed(2)}%
Set maximum price slippage tolerance

🎯 *Priority Fee Mode:* ${settings.priorityFeeMode.toUpperCase()}
Control transaction priority fees

${settings.autoApproveTrades ? '✅' : '❌'} *Auto-Approve Trades*
Skip confirmation for each trade

💰 *Max Trade Amount:* ${settings.maxTradeAmount ? `${settings.maxTradeAmount} SOL` : 'Unlimited'}
Maximum amount per trade

💵 *Default Buy Amount:* ${settings.defaultBuyAmount} SOL
Default amount for buy orders

Tap a setting to change it:
`;

    const tradingKeyboard = new InlineKeyboard()
      .text('⚡ Change Slippage', 'input_slippage').row()
      .text('🎯 Priority Fee Mode', 'show_priority_fee_options').row()
      .text(`${settings.autoApproveTrades ? '✅' : '❌'} Auto-Approve`, 'show_auto_approve_options').row()
      .text('💰 Max Trade Amount', 'input_maxTradeAmount').row()
      .text('💵 Default Buy Amount', 'input_defaultBuyAmount').row()
      .text('🔙 Back to Settings', 'menu_settings');

    await ctx.editMessageText(tradingMessage, {
      parse_mode: 'Markdown',
      reply_markup: tradingKeyboard
    });

    pushNavigation(userId, 'settings_trading');
  });

  bot.callbackQuery('settings_ai', async (ctx) => {
    await ctx.answerCallbackQuery();
    
    const userId = ctx.from?.id;
    if (!userId) return;

    const userResult = await query(`SELECT id FROM users WHERE telegram_id = $1`, [userId]);
    if (userResult.rows.length === 0) return;

    const dbUserId = userResult.rows[0].id;
    const settings = await userSettingsService.getSettings(dbUserId);

    const aiMessage = `
🤖 *AI Trader Settings*

🎮 *Trading Mode:* ${settings.tradingMode === 'ai' ? '🤖 AI' : '👤 Manual'}
Enable or disable AI trading

⚖️ *Risk Level:* ${settings.aiRiskLevel.charAt(0).toUpperCase() + settings.aiRiskLevel.slice(1)}
Conservative, Balanced, or Aggressive

💎 *Max Trade Size:* ${settings.aiMaxTradeSize} SOL
Maximum AI trade size

💰 *Daily Budget:* ${settings.aiDailyBudget} SOL
Daily AI trading budget

🛑 *Stop Loss:* ${settings.aiStopLossPercent}%
Automatic stop loss percentage

✋ *Require Confirmation:* ${settings.aiRequireConfirmation.replace('_', ' ').charAt(0).toUpperCase() + settings.aiRequireConfirmation.replace('_', ' ').slice(1)}
When to ask for confirmation

${settings.aiShowReasoning ? '✅' : '❌'} *Show AI Reasoning*
Display AI decision explanations

Tap a setting to change it:
`;

    const aiKeyboard = new InlineKeyboard()
      .text(`🎮 Mode: ${settings.tradingMode === 'ai' ? 'AI' : 'Manual'}`, 'show_trading_mode_options').row()
      .text('⚖️ Risk Level', 'show_risk_level_options').row()
      .text('💎 Max Trade Size', 'input_aiMaxTradeSize').row()
      .text('💰 Daily Budget', 'input_aiDailyBudget').row()
      .text('🛑 Stop Loss %', 'input_aiStopLossPercent').row()
      .text('✋ Confirmation', 'show_confirmation_options').row()
      .text(`${settings.aiShowReasoning ? '✅' : '❌'} Show Reasoning`, 'show_reasoning_options').row()
      .text('🔙 Back to Settings', 'menu_settings');

    await ctx.editMessageText(aiMessage, {
      parse_mode: 'Markdown',
      reply_markup: aiKeyboard
    });

    pushNavigation(userId, 'settings_ai');
  });

  bot.callbackQuery('settings_security', async (ctx) => {
    await ctx.answerCallbackQuery();
    
    const userId = ctx.from?.id;
    if (!userId) return;

    const userResult = await query(`SELECT id FROM users WHERE telegram_id = $1`, [userId]);
    if (userResult.rows.length === 0) return;

    const dbUserId = userResult.rows[0].id;
    const settings = await userSettingsService.getSettings(dbUserId);

    const securityMessage = `
🔒 *Security & Privacy Settings*

${settings.mevProtection ? '✅' : '❌'} *MEV Protection*
Protect against front-running

${settings.antiRugDetection ? '✅' : '❌'} *Anti-Rug Detection*
Warn about potential rug pulls

🔐 *Transaction Confirmations:* ${settings.transactionConfirmations.charAt(0).toUpperCase() + settings.transactionConfirmations.slice(1)}
Security level for confirmations

💾 *Backup Reminder:* ${settings.walletBackupReminder.charAt(0).toUpperCase() + settings.walletBackupReminder.slice(1)}
Frequency of backup reminders

Your security is our priority!

Tap a setting to change it:
`;

    const securityKeyboard = new InlineKeyboard()
      .text(`${settings.mevProtection ? '✅' : '❌'} MEV Protection`, 'show_mev_protection_options').row()
      .text(`${settings.antiRugDetection ? '✅' : '❌'} Anti-Rug`, 'show_anti_rug_options').row()
      .text('🔐 Confirmations Mode', 'show_confirmation_mode_options').row()
      .text('💾 Backup Reminder', 'show_backup_reminder_options').row()
      .text('🔙 Back to Settings', 'menu_settings');

    await ctx.editMessageText(securityMessage, {
      parse_mode: 'Markdown',
      reply_markup: securityKeyboard
    });

    pushNavigation(userId, 'settings_security');
  });

  bot.callbackQuery('settings_notifications', async (ctx) => {
    await ctx.answerCallbackQuery();
    
    const userId = ctx.from?.id;
    if (!userId) return;

    const userResult = await query(`SELECT id FROM users WHERE telegram_id = $1`, [userId]);
    if (userResult.rows.length === 0) return;

    const dbUserId = userResult.rows[0].id;
    const settings = await userSettingsService.getSettings(dbUserId);

    const notificationsMessage = `
🔔 *Notification Settings*

${settings.notificationsEnabled ? '✅' : '❌'} *Notifications Enabled*
Master notification toggle

${settings.tradeAlerts ? '✅' : '❌'} *Trade Alerts*
Notifications for completed trades

${settings.priceAlerts ? '✅' : '❌'} *Price Alerts*
Watchlist price notifications

${settings.aiTradeAlerts ? '✅' : '❌'} *AI Trade Alerts*
Notifications for AI trades

${settings.referralAlerts ? '✅' : '❌'} *Referral Alerts*
Referral rewards notifications

📊 *Portfolio Summary:* ${settings.portfolioSummary.charAt(0).toUpperCase() + settings.portfolioSummary.slice(1)}
How often to receive summaries

Stay informed about your trading activity!

Tap a setting to change it:
`;

    const notificationsKeyboard = new InlineKeyboard()
      .text(`${settings.notificationsEnabled ? '✅' : '❌'} Master Toggle`, 'show_notifications_enabled_options').row()
      .text(`${settings.tradeAlerts ? '✅' : '❌'} Trade Alerts`, 'show_trade_alerts_options').row()
      .text(`${settings.priceAlerts ? '✅' : '❌'} Price Alerts`, 'show_price_alerts_options').row()
      .text(`${settings.aiTradeAlerts ? '✅' : '❌'} AI Alerts`, 'show_ai_alerts_options').row()
      .text(`${settings.referralAlerts ? '✅' : '❌'} Referral Alerts`, 'show_referral_alerts_options').row()
      .text('📊 Portfolio Summary', 'show_portfolio_summary_options').row()
      .text('🔙 Back to Settings', 'menu_settings');

    await ctx.editMessageText(notificationsMessage, {
      parse_mode: 'Markdown',
      reply_markup: notificationsKeyboard
    });

    pushNavigation(userId, 'settings_notifications');
  });

  bot.callbackQuery('settings_display', async (ctx) => {
    await ctx.answerCallbackQuery();
    
    const userId = ctx.from?.id;
    if (!userId) return;

    const userResult = await query(`SELECT id FROM users WHERE telegram_id = $1`, [userId]);
    if (userResult.rows.length === 0) return;

    const dbUserId = userResult.rows[0].id;
    const settings = await userSettingsService.getSettings(dbUserId);

    const displayMessage = `
🎨 *Display & Preferences*

🌐 *Default Chain:* ${settings.defaultChain.charAt(0).toUpperCase() + settings.defaultChain.slice(1)}
Preferred blockchain network

💵 *Currency Display:* ${settings.currencyDisplay}
Preferred fiat currency

${settings.hideSmallBalances ? '✅' : '❌'} *Hide Small Balances*
Hide dust and small amounts

Customize your interface!

Tap a setting to change it:
`;

    const displayKeyboard = new InlineKeyboard()
      .text('🌐 Default Chain', 'show_default_chain_options').row()
      .text('💵 Currency', 'show_currency_options').row()
      .text(`${settings.hideSmallBalances ? '✅' : '❌'} Hide Small Balances`, 'show_hide_balances_options').row()
      .text('🔙 Back to Settings', 'menu_settings');

    await ctx.editMessageText(displayMessage, {
      parse_mode: 'Markdown',
      reply_markup: displayKeyboard
    });

    pushNavigation(userId, 'settings_display');
  });

  bot.callbackQuery('settings_advanced', async (ctx) => {
    await ctx.answerCallbackQuery();
    
    const userId = ctx.from?.id;
    if (!userId) return;

    const userResult = await query(`SELECT id FROM users WHERE telegram_id = $1`, [userId]);
    if (userResult.rows.length === 0) return;

    const dbUserId = userResult.rows[0].id;
    const settings = await userSettingsService.getSettings(dbUserId);

    const advancedMessage = `
📊 *Advanced Settings*

⚡ *Transaction Speed:* ${settings.transactionSpeed.charAt(0).toUpperCase() + settings.transactionSpeed.slice(1)}
Speed vs. cost trade-off

${settings.debugMode ? '✅' : '❌'} *Debug Mode*
Show detailed logs and errors

⚠️ *Warning:* Advanced settings are for experienced users only!

Tap a setting to change it:
`;

    const advancedKeyboard = new InlineKeyboard()
      .text('⚡ Transaction Speed', 'show_transaction_speed_options').row()
      .text(`${settings.debugMode ? '✅' : '❌'} Debug Mode`, 'show_debug_mode_options').row()
      .text('🔙 Back to Settings', 'menu_settings');

    await ctx.editMessageText(advancedMessage, {
      parse_mode: 'Markdown',
      reply_markup: advancedKeyboard
    });

    pushNavigation(userId, 'settings_advanced');
  });

  bot.callbackQuery('menu_referral', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    await ctx.answerCallbackQuery();

    const userResult = await query(`SELECT id FROM users WHERE telegram_id = $1`, [userId]);
    if (userResult.rows.length === 0) return;

    const dbUserId = userResult.rows[0].id;
    const dashboard = await referralService.getDashboard(dbUserId);
    const settings = await referralService.getSettings();

    const lastUpdated = new Date(dashboard.lastUpdated).toLocaleString('en-US', { 
      month: '2-digit', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' 
    });

    await ctx.editMessageText(
      `*Trade. Refer. Earn More.*\n\n` +
      `Share your unique link to get 50% cashback on trading fees and up to 55% from referred traders!\n\n` +
      `Cashback and rewards are paid out every 12 hours and airdropped to your Rewards Wallet. To qualify, maintain at least 0.005 SOL in rewards.\n\n` +
      `All Zinobot users enjoy a 15% boost to tier rewards and 25% cashback on trading fees.\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `*📊 Referral Rewards*\n` +
      `• Users referred: ${dashboard.referralRewards.usersReferred}\n` +
      `• Direct: ${dashboard.referralRewards.directReferrals}, Indirect: ${dashboard.referralRewards.indirectReferrals}\n` +
      `• Earned rewards: ${dashboard.referralRewards.earnedRewards.toFixed(4)} SOL ($${(dashboard.referralRewards.earnedRewards * 0).toFixed(2)})\n\n` +
      `*Layer Breakdown:*\n` +
      `• Layer 1 - ${settings.layer_1_percent}%: ${dashboard.layerBreakdown.layer1.count} users, ${dashboard.layerBreakdown.layer1.rewards.toFixed(4)} SOL\n` +
      `• Layer 2 - ${settings.layer_2_percent}%: ${dashboard.layerBreakdown.layer2.count} users, ${dashboard.layerBreakdown.layer2.rewards.toFixed(4)} SOL\n` +
      `• Layer 3 - ${settings.layer_3_percent}%: ${dashboard.layerBreakdown.layer3.count} users, ${dashboard.layerBreakdown.layer3.rewards.toFixed(4)} SOL\n\n` +
      `*💰 Cashback Rewards*\n` +
      `• Earned rewards: ${dashboard.cashbackRewards.earnedRewards.toFixed(4)} SOL ($${(dashboard.cashbackRewards.earnedRewards * 0).toFixed(2)})\n\n` +
      `*💎 Total Rewards*\n` +
      `• Total paid: ${dashboard.totalRewards.totalPaid.toFixed(4)} SOL ($${(dashboard.totalRewards.totalPaid * 0).toFixed(2)})\n` +
      `• Total unpaid: ${dashboard.totalRewards.totalUnpaid.toFixed(4)} SOL ($${(dashboard.totalRewards.totalUnpaid * 0).toFixed(2)})\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `*🔗 Your Referral Link*\n` +
      `${dashboard.referralLink}\n` +
      `_Your friends earn 10% more with your link_\n\n` +
      `*💼 Rewards Wallet*\n` +
      `\`${dashboard.rewardsWallet}\`\n\n` +
      `Last updated at ${lastUpdated} UTC (every 5 min)`,
      {
        parse_mode: 'Markdown',
        reply_markup: new InlineKeyboard()
          .text('🔁 Update Your Referral Link', 'referral_refresh_link').row()
          .text('🔙 Back', 'back_button')
          .text('❌ Close', 'close_menu')
      }
    );

    pushNavigation(userId, 'referral');
  });

  bot.callbackQuery('referral_refresh_link', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    await ctx.answerCallbackQuery('Generating new referral link...');

    const userResult = await query(`SELECT id FROM users WHERE telegram_id = $1`, [userId]);
    if (userResult.rows.length === 0) return;

    const dbUserId = userResult.rows[0].id;
    const newLink = await referralService.updateReferralLink(dbUserId);

    await ctx.answerCallbackQuery({ text: `✅ New link generated!` });
    
    const dashboard = await referralService.getDashboard(dbUserId);
    const settings = await referralService.getSettings();
    const lastUpdated = new Date(dashboard.lastUpdated).toLocaleString('en-US', { 
      month: '2-digit', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' 
    });

    await ctx.editMessageText(
      `*Trade. Refer. Earn More.*\n\n` +
      `Share your unique link to get 50% cashback on trading fees and up to 55% from referred traders!\n\n` +
      `Cashback and rewards are paid out every 12 hours and airdropped to your Rewards Wallet. To qualify, maintain at least 0.005 SOL in rewards.\n\n` +
      `All Zinobot users enjoy a 15% boost to tier rewards and 25% cashback on trading fees.\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `*📊 Referral Rewards*\n` +
      `• Users referred: ${dashboard.referralRewards.usersReferred}\n` +
      `• Direct: ${dashboard.referralRewards.directReferrals}, Indirect: ${dashboard.referralRewards.indirectReferrals}\n` +
      `• Earned rewards: ${dashboard.referralRewards.earnedRewards.toFixed(4)} SOL ($${(dashboard.referralRewards.earnedRewards * 0).toFixed(2)})\n\n` +
      `*Layer Breakdown:*\n` +
      `• Layer 1 - ${settings.layer_1_percent}%: ${dashboard.layerBreakdown.layer1.count} users, ${dashboard.layerBreakdown.layer1.rewards.toFixed(4)} SOL\n` +
      `• Layer 2 - ${settings.layer_2_percent}%: ${dashboard.layerBreakdown.layer2.count} users, ${dashboard.layerBreakdown.layer2.rewards.toFixed(4)} SOL\n` +
      `• Layer 3 - ${settings.layer_3_percent}%: ${dashboard.layerBreakdown.layer3.count} users, ${dashboard.layerBreakdown.layer3.rewards.toFixed(4)} SOL\n\n` +
      `*💰 Cashback Rewards*\n` +
      `• Earned rewards: ${dashboard.cashbackRewards.earnedRewards.toFixed(4)} SOL ($${(dashboard.cashbackRewards.earnedRewards * 0).toFixed(2)})\n\n` +
      `*💎 Total Rewards*\n` +
      `• Total paid: ${dashboard.totalRewards.totalPaid.toFixed(4)} SOL ($${(dashboard.totalRewards.totalPaid * 0).toFixed(2)})\n` +
      `• Total unpaid: ${dashboard.totalRewards.totalUnpaid.toFixed(4)} SOL ($${(dashboard.totalRewards.totalUnpaid * 0).toFixed(2)})\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `*🔗 Your Referral Link*\n` +
      `${dashboard.referralLink}\n` +
      `_Your friends earn 10% more with your link_\n\n` +
      `*💼 Rewards Wallet*\n` +
      `\`${dashboard.rewardsWallet}\`\n\n` +
      `Last updated at ${lastUpdated} UTC (every 5 min)`,
      {
        parse_mode: 'Markdown',
        reply_markup: new InlineKeyboard()
          .text('🔁 Update Your Referral Link', 'referral_refresh_link').row()
          .text('🔙 Back', 'back_button')
          .text('❌ Close', 'close_menu')
      }
    );
  });

  bot.callbackQuery('menu_wallet', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    await ctx.answerCallbackQuery();

    const userResult = await query(`SELECT id, current_chain FROM users WHERE telegram_id = $1`, [userId]);
    if (userResult.rows.length === 0) return;

    const dbUserId = userResult.rows[0].id;
    const currentChain = (userResult.rows[0].current_chain as ChainType) || 'solana';

    const multiChainWallet = new MultiChainWalletService();
    const wallet = await multiChainWallet.getWallet(dbUserId, currentChain);

    if (!wallet) {
      await ctx.reply(`No ${currentChain} wallet found. Please create one first.`);
      return;
    }

    const balance = await multiChainWallet.getBalance(dbUserId, currentChain);
    const chainInfo = multiChainWallet.getChainManager().getChainInfo(currentChain);

    const walletMessage = `
👛 *Your Wallet:*

*Address:*
\`${wallet.publicKey}\`
_(Tap to copy)_

*Balance:* ${parseFloat(balance).toFixed(4)} ${chainInfo.nativeToken.symbol}

💡 Tap to copy the address and send ${chainInfo.nativeToken.symbol} to deposit.
`;

    await ctx.editMessageText(walletMessage, {
      parse_mode: 'Markdown',
      reply_markup: getWalletMenu(currentChain)
    });

    pushNavigation(userId, 'wallet');
  });

  bot.callbackQuery('wallet_view_explorer', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    await ctx.answerCallbackQuery();

    const userResult = await query(`SELECT id, current_chain FROM users WHERE telegram_id = $1`, [userId]);
    const dbUserId = userResult.rows[0].id;
    const currentChain = (userResult.rows[0].current_chain as ChainType) || 'solana';

    const multiChainWallet = new MultiChainWalletService();
    const wallet = await multiChainWallet.getWallet(dbUserId, currentChain);

    if (!wallet) return;

    const adapter = multiChainWallet.getChainManager().getAdapter(currentChain);
    const explorerUrl = currentChain === 'solana' 
      ? `https://solscan.io/account/${wallet.publicKey}?cluster=${process.env.SOLANA_NETWORK || 'devnet'}`
      : currentChain === 'ethereum'
      ? `https://etherscan.io/address/${wallet.publicKey}`
      : `https://bscscan.com/address/${wallet.publicKey}`;

    await ctx.reply(`🔍 View your wallet:\n${explorerUrl}`);
  });

  bot.callbackQuery('wallet_deposit', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    await ctx.answerCallbackQuery();

    const userResult = await query(`SELECT id, current_chain FROM users WHERE telegram_id = $1`, [userId]);
    const dbUserId = userResult.rows[0].id;
    const currentChain = (userResult.rows[0].current_chain as ChainType) || 'solana';

    const multiChainWallet = new MultiChainWalletService();
    const wallet = await multiChainWallet.getWallet(dbUserId, currentChain);
    const chainInfo = multiChainWallet.getChainManager().getChainInfo(currentChain);

    if (!wallet) return;

    await ctx.reply(
      `📥 *Deposit ${chainInfo.nativeToken.symbol}*\n\n` +
      `Send ${chainInfo.nativeToken.symbol} to this address:\n\n` +
      `\`${wallet.publicKey}\`\n` +
      `_(Tap to copy)_\n\n` +
      `⚠️ Only send ${chainInfo.nativeToken.symbol} on ${chainInfo.name} network!`,
      { parse_mode: 'Markdown' }
    );
  });

  bot.callbackQuery('wallet_buy', async (ctx) => {
    await ctx.answerCallbackQuery('Coming soon!');
    await ctx.reply('💰 Buy native tokens feature is coming soon! For now, use the Buy menu to purchase tokens.');
  });

  bot.callbackQuery('wallet_withdraw_all', async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(
      '📤 *Withdraw All*\n\nEnter the destination address:',
      { parse_mode: 'Markdown' }
    );
  });

  bot.callbackQuery('wallet_withdraw_custom', async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(
      '📤 *Withdraw Custom Amount*\n\nEnter destination address and amount (separated by space):',
      { parse_mode: 'Markdown' }
    );
  });

  bot.callbackQuery('wallet_manage_tokens', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    await ctx.answerCallbackQuery();

    const userResult = await query(`SELECT id, current_chain FROM users WHERE telegram_id = $1`, [userId]);
    const dbUserId = userResult.rows[0].id;
    const currentChain = (userResult.rows[0].current_chain as ChainType) || 'solana';

    const multiChainWallet = new MultiChainWalletService();
    const balance = await multiChainWallet.getBalance(dbUserId, currentChain);
    const chainInfo = multiChainWallet.getChainManager().getChainInfo(currentChain);

    // For now, show placeholder stats - can be enhanced later to fetch real token data
    const tokenStats = {
      solBalance: parseFloat(balance),
      tokensOwned: 0,
      tokenValue: '$N/A',
      frozenTokens: 0,
      hiddenMinPosTokens: 0,
      manuallyHiddenTokens: 0
    };

    const tokenMessage = `
🪙 *Token Management*

Hide tokens to clean up your portfolio, and burn rugged tokens to speed up ${chainInfo.nativeToken.symbol}bot and reclaim ${chainInfo.nativeToken.symbol} from rent.

*${chainInfo.nativeToken.symbol} Balance:* ${tokenStats.solBalance.toFixed(4)}
*Tokens owned:* ${tokenStats.tokensOwned}
*Token Value:* ${tokenStats.tokenValue} ${chainInfo.nativeToken.symbol}

*${tokenStats.frozenTokens}* Frozen Tokens
*${tokenStats.hiddenMinPosTokens}* Hidden (Min Pos Value) Tokens
*${tokenStats.manuallyHiddenTokens}* Manually Hidden Tokens
`;

    await ctx.editMessageText(tokenMessage, {
      parse_mode: 'Markdown',
      reply_markup: getTokenManagementMenu(currentChain, tokenStats)
    });

    pushNavigation(userId, 'token_management');
  });

  bot.callbackQuery('wallet_reset', async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.reply('⚠️ *Reset All Wallets*\n\nThis feature will permanently delete all your wallets. Implementation coming soon with proper security confirmation.', { parse_mode: 'Markdown' });
  });

  bot.callbackQuery('wallet_export_seed', async (ctx) => {
    await ctx.answerCallbackQuery('Coming soon!');
    await ctx.reply('🔑 Seed phrase export feature is coming soon with enhanced security measures!');
  });

  bot.callbackQuery('wallet_refresh', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    await ctx.answerCallbackQuery('Refreshing...');

    const userResult = await query(`SELECT id, current_chain FROM users WHERE telegram_id = $1`, [userId]);
    const dbUserId = userResult.rows[0].id;
    const currentChain = (userResult.rows[0].current_chain as ChainType) || 'solana';

    const multiChainWallet = new MultiChainWalletService();
    const wallet = await multiChainWallet.getWallet(dbUserId, currentChain);

    if (!wallet) return;

    const balance = await multiChainWallet.getBalance(dbUserId, currentChain);
    const chainInfo = multiChainWallet.getChainManager().getChainInfo(currentChain);

    const walletMessage = `
👛 *Your Wallet:*

*Address:*
\`${wallet.publicKey}\`
_(Tap to copy)_

*Balance:* ${parseFloat(balance).toFixed(4)} ${chainInfo.nativeToken.symbol}

💡 Tap to copy the address and send ${chainInfo.nativeToken.symbol} to deposit.
`;

    await ctx.editMessageText(walletMessage, {
      parse_mode: 'Markdown',
      reply_markup: getWalletMenu(currentChain)
    });
  });

  bot.callbackQuery('close_menu', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    await ctx.answerCallbackQuery();
    
    // Clear any active command states
    userStates.delete(userId);
    navigationHistory.delete(userId);
    
    await ctx.deleteMessage();
  });

  // Back button handlers
  bot.callbackQuery(/^(back|back_button)$/, async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    await ctx.answerCallbackQuery();

    // Pop current menu from history
    popNavigation(userId);
    // Get previous menu
    const previous = popNavigation(userId);

    if (!previous) {
      // No history, go to main menu
      await ctx.answerCallbackQuery();
      
      const userResult = await query(`SELECT id, current_chain FROM users WHERE telegram_id = $1`, [userId]);
      const dbUserId = userResult.rows[0].id;
      const currentChain = (userResult.rows[0].current_chain as ChainType) || 'solana';

      const multiChainWallet = new MultiChainWalletService();
      const wallet = await multiChainWallet.getWallet(dbUserId, currentChain);
      const balance = await multiChainWallet.getBalance(dbUserId, currentChain);
      const chainInfo = multiChainWallet.getChainManager().getChainInfo(currentChain);

      if (!wallet) return;

      const solPrice = 0; // We can fetch from CoinGecko if needed

      const message = MAIN_DASHBOARD_MESSAGE(wallet.publicKey, parseFloat(balance), solPrice);

      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        reply_markup: getMainMenu(currentChain)
      });

      pushNavigation(userId, 'main');
      return;
    }

    // Navigate to previous menu
    const menuHandlers: Record<string, () => Promise<void>> = {
      main: async () => {
        const userResult = await query(`SELECT id, current_chain FROM users WHERE telegram_id = $1`, [userId]);
        const dbUserId = userResult.rows[0].id;
        const currentChain = (userResult.rows[0].current_chain as ChainType) || 'solana';

        const multiChainWallet = new MultiChainWalletService();
        const wallet = await multiChainWallet.getWallet(dbUserId, currentChain);
        const balance = await multiChainWallet.getBalance(dbUserId, currentChain);

        if (!wallet) return;

        const solPrice = 0;
        const message = MAIN_DASHBOARD_MESSAGE(wallet.publicKey, parseFloat(balance), solPrice);

        await ctx.editMessageText(message, {
          parse_mode: 'Markdown',
          reply_markup: getMainMenu(currentChain)
        });
      },
      wallet: async () => {
        const userResult = await query(`SELECT id, current_chain FROM users WHERE telegram_id = $1`, [userId]);
        const dbUserId = userResult.rows[0].id;
        const currentChain = (userResult.rows[0].current_chain as ChainType) || 'solana';

        const multiChainWallet = new MultiChainWalletService();
        const wallet = await multiChainWallet.getWallet(dbUserId, currentChain);
        const balance = await multiChainWallet.getBalance(dbUserId, currentChain);
        const chainInfo = multiChainWallet.getChainManager().getChainInfo(currentChain);

        if (!wallet) return;

        const walletMessage = `
👛 *Your Wallet:*

*Address:*
\`${wallet.publicKey}\`
_(Tap to copy)_

*Balance:* ${parseFloat(balance).toFixed(4)} ${chainInfo.nativeToken.symbol}

💡 Tap to copy the address and send ${chainInfo.nativeToken.symbol} to deposit.
`;

        await ctx.editMessageText(walletMessage, {
          parse_mode: 'Markdown',
          reply_markup: getWalletMenu(currentChain)
        });
      },
      buy: async () => {
        await ctx.editMessageText(
          `💰 *Buy Tokens*\n\nChoose how you want to buy tokens:`,
          { parse_mode: 'Markdown', reply_markup: getBuyMenu() }
        );
      },
      sell: async () => {
        await ctx.editMessageText(
          `💸 *Sell Tokens*\n\nChoose which token you want to sell:`,
          { parse_mode: 'Markdown', reply_markup: getSellMenu() }
        );
      },
      settings: async () => {
        await ctx.editMessageText(
          `⚙️ *Settings*\n\nConfigure your trading preferences:`,
          { parse_mode: 'Markdown', reply_markup: getSettingsMenu() }
        );
      },
      withdraw: async () => {
        await ctx.editMessageText(
          `📤 *Withdraw Funds*\n\nChoose what you want to withdraw:`,
          { parse_mode: 'Markdown', reply_markup: getWithdrawMenu() }
        );
      },
      watchlist: async () => {
        await ctx.editMessageText(
          `👀 *Watchlist*\n\nMonitor your favorite tokens across all chains.\n\nAdd tokens by contract address or URL from pump.fun, Moonshot, Birdeye, or DEX Screener.`,
          { parse_mode: 'Markdown', reply_markup: getWatchlistMenu() }
        );
      },
    };

    const handler = menuHandlers[previous.menuName];
    if (handler) {
      await handler();
    }
  });

  bot.callbackQuery('menu_withdraw', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    await ctx.answerCallbackQuery();
    await ctx.editMessageText(
      `📤 *Withdraw Funds*\n\n` +
      `Choose what you want to withdraw:`,
      {
        parse_mode: 'Markdown',
        reply_markup: getWithdrawMenu()
      }
    );

    pushNavigation(userId, 'withdraw');
  });

  // Withdraw SOL handler
  bot.callbackQuery('withdraw_sol', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    await ctx.answerCallbackQuery();

    try {
      const userResult = await query(`SELECT id FROM users WHERE telegram_id = $1`, [userId]);
      if (userResult.rows.length === 0) {
        await ctx.reply('Please use /start first.');
        return;
      }

      const state = userStates.get(userId) || {};
      const currentChain = state.currentChain || 'solana';

      await ctx.editMessageText(
        `📤 *Withdraw SOL*\n\n` +
        `Step 1: Enter the destination address\n\n` +
        `*Example:* \`5Z8FwqK...Abc123xyz\`\n\n` +
        `Paste the Solana wallet address where you want to send SOL.`,
        { parse_mode: 'Markdown' }
      );

      userStates.set(userId, { 
        ...state,
        awaitingWithdrawAddress: true,
        withdrawType: 'sol',
        currentChain 
      });
    } catch (error: any) {
      console.error('Withdraw SOL error:', error);
      await ctx.reply('❌ Error initiating withdrawal.');
    }
  });

  // Withdraw Token handler
  bot.callbackQuery('withdraw_token', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    await ctx.answerCallbackQuery();

    try {
      const userResult = await query(`SELECT id FROM users WHERE telegram_id = $1`, [userId]);
      if (userResult.rows.length === 0) {
        await ctx.reply('Please use /start first.');
        return;
      }

      const dbUserId = userResult.rows[0].id;
      
      // Get wallet with chain info
      const walletResult = await query(
        `SELECT id, public_key, chain FROM wallets WHERE user_id = $1 AND is_active = true ORDER BY id DESC LIMIT 1`,
        [dbUserId]
      );

      if (walletResult.rows.length === 0) {
        await ctx.editMessageText(
          `🪙 *Withdraw Token*\n\n` +
          `❌ No wallet found. Please create a wallet first using /create_wallet`,
          { parse_mode: 'Markdown' }
        );
        return;
      }

      const wallet = walletResult.rows[0];
      const chain = wallet.chain || 'solana';
      
      // Currently only Solana withdrawals are supported
      if (chain !== 'solana') {
        await ctx.editMessageText(
          `🪙 *Withdraw Token*\n\n` +
          `Your active wallet is on ${chain.toUpperCase()}.\n\n` +
          `Token withdrawals are currently only available on Solana. Please switch to Solana or create a Solana wallet.`,
          {
            parse_mode: 'Markdown',
            reply_markup: new InlineKeyboard()
              .text('⚡ Switch to Solana', 'switch_chain_solana')
              .row()
              .text('🔙 Back', 'back')
              .text('❌ Close', 'close_menu')
          }
        );
        return;
      }

      const portfolio = await walletManager.getPortfolio(wallet.public_key);

      if (portfolio.tokens.length === 0) {
        await ctx.editMessageText(
          `🪙 *Withdraw Token*\n\n` +
          `You don't have any tokens to withdraw.\n\n` +
          `Would you like to buy some tokens?`,
          {
            parse_mode: 'Markdown',
            reply_markup: new InlineKeyboard()
              .text('💰 Buy Tokens', 'menu_buy')
              .row()
              .text('🔙 Back', 'back')
              .text('❌ Close', 'close_menu')
          }
        );
        return;
      }

      let message = `🪙 *Withdraw Token*\n\n`;
      message += `Select the token you want to withdraw:\n\n`;

      const keyboard = new InlineKeyboard();
      
      for (let i = 0; i < portfolio.tokens.length && i < 10; i++) {
        const token = portfolio.tokens[i];
        const shortMint = `${token.mint.substring(0, 4)}...${token.mint.substring(token.mint.length - 4)}`;
        const buttonText = `🪙 ${shortMint} (${token.balance.toFixed(4)})`;
        keyboard.text(buttonText, `withdraw_token_${token.mint}`).row();
      }

      if (portfolio.tokens.length > 10) {
        message += `\n_Showing first 10 tokens only_\n`;
      }

      keyboard.text('📝 Custom Token Address', 'withdraw_token_custom').row();
      keyboard.text('🔙 Back', 'back').text('❌ Close', 'close_menu');

      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });
    } catch (error: any) {
      console.error('Withdraw Token error:', error);
      await ctx.reply('❌ Error loading tokens.');
    }
  });

  // Handle withdrawing a specific token from the list
  bot.callbackQuery(/^withdraw_token_(.+)$/, async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const tokenMint = ctx.match[1];
    if (tokenMint === 'custom') {
      await ctx.answerCallbackQuery();
      await ctx.editMessageText(
        `🪙 *Withdraw Token - Custom*\n\n` +
        `Step 1: Enter the token mint address\n\n` +
        `*Example:* \`${USDC_MINT}\``,
        { parse_mode: 'Markdown' }
      );

      const state = userStates.get(userId) || {};
      userStates.set(userId, { 
        ...state,
        awaitingWithdrawAddress: true,
        withdrawType: 'token',
        currentChain: state.currentChain || 'solana'
      });
      return;
    }

    await ctx.answerCallbackQuery();

    try {
      const userResult = await query(`SELECT id FROM users WHERE telegram_id = $1`, [userId]);
      if (userResult.rows.length === 0) {
        await ctx.reply('Please use /start first.');
        return;
      }

      const dbUserId = userResult.rows[0].id;
      const wallet = await walletManager.getActiveWallet(dbUserId);

      if (!wallet) {
        await ctx.reply('❌ No wallet found.');
        return;
      }

      const portfolio = await walletManager.getPortfolio(wallet.publicKey);
      const token = portfolio.tokens.find((t: any) => t.mint === tokenMint);

      if (!token) {
        await ctx.reply('❌ Token not found in your wallet.');
        return;
      }

      await ctx.editMessageText(
        `🪙 *Withdraw Token*\n\n` +
        `🪙 Token: \`${tokenMint}\`\n` +
        `💰 Available: ${token.balance.toFixed(4)}\n\n` +
        `Step 1: Enter the destination address\n\n` +
        `Paste the Solana wallet address where you want to send this token.`,
        { parse_mode: 'Markdown' }
      );

      const state = userStates.get(userId) || {};
      userStates.set(userId, { 
        ...state,
        awaitingWithdrawAddress: true,
        withdrawType: 'token',
        currentToken: tokenMint,
        currentChain: state.currentChain || 'solana'
      });
    } catch (error: any) {
      console.error('Withdraw specific token error:', error);
      await ctx.reply('❌ Error processing token withdrawal.');
    }
  });

  // Limit Orders Menu
  bot.callbackQuery('menu_limit', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    await ctx.answerCallbackQuery();

    try {
      const userResult = await query(`SELECT id FROM users WHERE telegram_id = $1`, [userId]);
      if (userResult.rows.length === 0) return;

      const dbUserId = userResult.rows[0].id;
      
      const ordersResult = await query(
        `SELECT o.*, w.public_key 
         FROM orders o 
         JOIN wallets w ON o.wallet_id = w.id 
         WHERE o.user_id = $1 AND o.status = 'active' 
         ORDER BY o.created_at DESC 
         LIMIT 10`,
        [dbUserId]
      );

      let message = `⏰ *Limit Orders*\n\n`;
      
      if (ordersResult.rows.length === 0) {
        message += `You have no active limit orders.\n\n`;
        message += `Limit orders let you buy or sell tokens automatically when they reach your target price.\n\n`;
        message += `To create a limit order:\n`;
        message += `1. Go to Buy or Sell menu\n`;
        message += `2. Enter token address\n`;
        message += `3. Click "Limit" button\n`;
        message += `4. Set your target price`;
      } else {
        message += `*Active Orders (${ordersResult.rows.length}):*\n\n`;
        for (const order of ordersResult.rows) {
          const createdDate = new Date(order.created_at).toLocaleDateString();
          message += `📌 ${order.order_type.toUpperCase()}\n`;
          message += `   Amount: ${parseFloat(order.amount).toFixed(4)}\n`;
          message += `   Target: $${parseFloat(order.target_price).toFixed(6)}\n`;
          message += `   Created: ${createdDate}\n\n`;
        }
      }

      const keyboard = new InlineKeyboard()
        .text('📊 View All Orders', 'limit_view_all').row()
        .text('🔙 Back', 'back_button')
        .text('❌ Close', 'close_menu');

      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });

      pushNavigation(userId, 'limit_orders');
    } catch (error: any) {
      console.error('Limit orders error:', error);
      await ctx.reply('❌ Error loading limit orders.');
    }
  });

  // DCA Orders Menu
  bot.callbackQuery('menu_dca', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    await ctx.answerCallbackQuery();

    try {
      const userResult = await query(`SELECT id FROM users WHERE telegram_id = $1`, [userId]);
      if (userResult.rows.length === 0) return;

      const dbUserId = userResult.rows[0].id;
      
      const dcaResult = await query(
        `SELECT * FROM dca_jobs 
         WHERE user_id = $1 AND is_active = true 
         ORDER BY created_at DESC 
         LIMIT 10`,
        [dbUserId]
      );

      let message = `🔄 *DCA Orders*\n\n`;
      message += `*Dollar Cost Averaging*\n`;
      message += `Automatically buy tokens at regular intervals to average your entry price.\n\n`;
      
      if (dcaResult.rows.length === 0) {
        message += `You have no active DCA orders.\n\n`;
        message += `To create a DCA order:\n`;
        message += `1. Go to Buy menu\n`;
        message += `2. Enter token address\n`;
        message += `3. Click "DCA" button\n`;
        message += `4. Set amount and frequency`;
      } else {
        message += `*Active DCA Jobs (${dcaResult.rows.length}):*\n\n`;
        for (const job of dcaResult.rows) {
          const fromToken = job.from_token ? `${job.from_token.substring(0, 6)}...` : 'Native';
          const toToken = job.to_token ? `${job.to_token.substring(0, 6)}...` : 'Token';
          const amount = job.amount ? parseFloat(job.amount) : 0;
          const nextExec = job.next_execution ? new Date(job.next_execution).toLocaleDateString() : 'Not set';
          message += `📌 ${fromToken} → ${toToken}\n`;
          message += `   Amount: ${amount.toFixed(4)} per buy\n`;
          message += `   Frequency: ${job.frequency || 'Not set'}\n`;
          message += `   Next: ${nextExec}\n\n`;
        }
      }

      const keyboard = new InlineKeyboard()
        .text('➕ Create DCA', 'dca_create').row()
        .text('📊 View All', 'dca_view_all').row()
        .text('🔙 Back', 'back_button')
        .text('❌ Close', 'close_menu');

      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });

      pushNavigation(userId, 'dca_orders');
    } catch (error: any) {
      console.error('DCA orders error:', error);
      await ctx.reply('❌ Error loading DCA orders.');
    }
  });

  // Token Sniper Menu
  bot.callbackQuery('menu_sniper', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    await ctx.answerCallbackQuery();

    let message = `🎯 *Token Sniper*\n\n`;
    message += `Auto-buy new token listings the moment they launch!\n\n`;
    message += `*Features:*\n`;
    message += `• 🚀 Instant execution on new pairs\n`;
    message += `• 💎 Buy within first block\n`;
    message += `• 🔒 Anti-rug protection\n`;
    message += `• 📊 Minimum liquidity filters\n\n`;
    message += `*How it works:*\n`;
    message += `1. Set your snipe parameters\n`;
    message += `2. Monitor DEX for new listings\n`;
    message += `3. Auto-buy when conditions met\n`;
    message += `4. Get instant notification\n\n`;
    message += `⚠️ High risk, high reward!`;

    const keyboard = new InlineKeyboard()
      .text('⚙️ Configure Sniper', 'sniper_config').row()
      .text('📜 Snipe History', 'sniper_history').row()
      .text('🔙 Back', 'back_button')
      .text('❌ Close', 'close_menu');

    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });

    pushNavigation(userId, 'sniper');
  });

  // Price Alerts Menu
  bot.callbackQuery('menu_alerts', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    await ctx.answerCallbackQuery();

    try {
      const userResult = await query(`SELECT id FROM users WHERE telegram_id = $1`, [userId]);
      if (userResult.rows.length === 0) return;

      const dbUserId = userResult.rows[0].id;

      let message = `🔔 *Price Alerts*\n\n`;
      message += `Get notified when tokens hit your target prices!\n\n`;
      message += `*Set alerts for:*\n`;
      message += `• 📈 Price increases (take profit)\n`;
      message += `• 📉 Price drops (buy the dip)\n`;
      message += `• 💰 Portfolio value milestones\n`;
      message += `• 🎯 Percentage changes\n\n`;
      message += `You currently have no active alerts.\n\n`;
      message += `Add tokens to your watchlist to set price alerts!`;

      const keyboard = new InlineKeyboard()
        .text('➕ Create Alert', 'alert_create').row()
        .text('⭐ From Watchlist', 'menu_watchlist').row()
        .text('🔙 Back', 'back_button')
        .text('❌ Close', 'close_menu');

      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });

      pushNavigation(userId, 'alerts');
    } catch (error: any) {
      console.error('Alerts error:', error);
      await ctx.reply('❌ Error loading alerts.');
    }
  });

  // Rewards Menu - redirect to referral dashboard
  bot.callbackQuery('menu_rewards', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    await ctx.answerCallbackQuery();

    const userResult = await query(`SELECT id FROM users WHERE telegram_id = $1`, [userId]);
    if (userResult.rows.length === 0) return;

    const dbUserId = userResult.rows[0].id;
    const dashboard = await referralService.getDashboard(dbUserId);
    const settings = await referralService.getSettings();

    const lastUpdated = new Date(dashboard.lastUpdated).toLocaleString('en-US', { 
      month: '2-digit', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' 
    });

    await ctx.editMessageText(
      `*Trade. Refer. Earn More.*\n\n` +
      `Share your unique link to get 50% cashback on trading fees and up to 55% from referred traders!\n\n` +
      `Cashback and rewards are paid out every 12 hours and airdropped to your Rewards Wallet. To qualify, maintain at least 0.005 SOL in rewards.\n\n` +
      `All Zinobot users enjoy a 15% boost to tier rewards and 25% cashback on trading fees.\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `*📊 Referral Rewards*\n` +
      `• Users referred: ${dashboard.referralRewards.usersReferred}\n` +
      `• Direct: ${dashboard.referralRewards.directReferrals}, Indirect: ${dashboard.referralRewards.indirectReferrals}\n` +
      `• Earned rewards: ${dashboard.referralRewards.earnedRewards.toFixed(4)} SOL ($${(dashboard.referralRewards.earnedRewards * 0).toFixed(2)})\n\n` +
      `*Layer Breakdown:*\n` +
      `• Layer 1 - ${settings.layer_1_percent}%: ${dashboard.layerBreakdown.layer1.count} users, ${dashboard.layerBreakdown.layer1.rewards.toFixed(4)} SOL\n` +
      `• Layer 2 - ${settings.layer_2_percent}%: ${dashboard.layerBreakdown.layer2.count} users, ${dashboard.layerBreakdown.layer2.rewards.toFixed(4)} SOL\n` +
      `• Layer 3 - ${settings.layer_3_percent}%: ${dashboard.layerBreakdown.layer3.count} users, ${dashboard.layerBreakdown.layer3.rewards.toFixed(4)} SOL\n\n` +
      `*💰 Cashback Rewards*\n` +
      `• Earned rewards: ${dashboard.cashbackRewards.earnedRewards.toFixed(4)} SOL ($${(dashboard.cashbackRewards.earnedRewards * 0).toFixed(2)})\n\n` +
      `*💎 Total Rewards*\n` +
      `• Total paid: ${dashboard.totalRewards.totalPaid.toFixed(4)} SOL ($${(dashboard.totalRewards.totalPaid * 0).toFixed(2)})\n` +
      `• Total unpaid: ${dashboard.totalRewards.totalUnpaid.toFixed(4)} SOL ($${(dashboard.totalRewards.totalUnpaid * 0).toFixed(2)})\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `*🔗 Your Referral Link*\n` +
      `${dashboard.referralLink}\n` +
      `_Your friends earn 10% more with your link_\n\n` +
      `*💼 Rewards Wallet*\n` +
      `\`${dashboard.rewardsWallet}\`\n\n` +
      `Last updated at ${lastUpdated} UTC (every 5 min)`,
      {
        parse_mode: 'Markdown',
        reply_markup: new InlineKeyboard()
          .text('🔁 Update Your Referral Link', 'referral_refresh_link').row()
          .text('🔙 Back', 'back_button')
          .text('❌ Close', 'close_menu')
      }
    );

    pushNavigation(userId, 'rewards');
  });

  // Sub-menu handlers for Limit Orders
  bot.callbackQuery('limit_view_all', async (ctx) => {
    await ctx.answerCallbackQuery('Viewing all limit orders...');
    
    const userId = ctx.from?.id;
    if (!userId) return;

    try {
      const userResult = await query(`SELECT id FROM users WHERE telegram_id = $1`, [userId]);
      if (userResult.rows.length === 0) return;

      const dbUserId = userResult.rows[0].id;
      const ordersResult = await query(
        `SELECT o.*, w.public_key 
         FROM orders o 
         JOIN wallets w ON o.wallet_id = w.id 
         WHERE o.user_id = $1 
         ORDER BY o.created_at DESC 
         LIMIT 50`,
        [dbUserId]
      );

      let message = `⏰ *All Limit Orders*\n\n`;
      if (ordersResult.rows.length === 0) {
        message += `No limit orders found.`;
      } else {
        message += `Total orders: ${ordersResult.rows.length}\n\n`;
        for (const order of ordersResult.rows.slice(0, 20)) {
          const status = order.status === 'active' ? '🟢' : order.status === 'executed' ? '✅' : '❌';
          message += `${status} ${order.order_type.toUpperCase()}\n`;
          message += `   Amount: ${parseFloat(order.amount).toFixed(4)}\n`;
          message += `   Target: $${parseFloat(order.target_price).toFixed(6)}\n`;
          message += `   Status: ${order.status}\n\n`;
        }
        if (ordersResult.rows.length > 20) {
          message += `\n_Showing 20 of ${ordersResult.rows.length} orders_`;
        }
      }

      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        reply_markup: new InlineKeyboard()
          .text('🔙 Back to Limit Orders', 'menu_limit')
          .text('❌ Close', 'close_menu')
      });
    } catch (error: any) {
      console.error('View all orders error:', error);
      await ctx.reply('❌ Error loading orders.');
    }
  });

  // Sub-menu handlers for DCA
  bot.callbackQuery('dca_create', async (ctx) => {
    await ctx.answerCallbackQuery();
    
    let message = `➕ *Create DCA Order*\n\n`;
    message += `Dollar Cost Averaging helps you invest gradually over time.\n\n`;
    message += `*To create a DCA order:*\n`;
    message += `1. Click "Buy" from main menu\n`;
    message += `2. Enter token contract address\n`;
    message += `3. Click "DCA" button\n`;
    message += `4. Set your parameters:\n`;
    message += `   • Amount per purchase\n`;
    message += `   • Frequency (daily/weekly/monthly)\n`;
    message += `   • Total number of purchases\n\n`;
    message += `The bot will automatically execute purchases at your chosen intervals.`;

    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      reply_markup: new InlineKeyboard()
        .text('💰 Go to Buy', 'menu_buy').row()
        .text('🔙 Back to DCA', 'menu_dca')
        .text('❌ Close', 'close_menu')
    });
  });

  bot.callbackQuery('dca_view_all', async (ctx) => {
    await ctx.answerCallbackQuery('Loading all DCA orders...');
    
    const userId = ctx.from?.id;
    if (!userId) return;

    try {
      const userResult = await query(`SELECT id FROM users WHERE telegram_id = $1`, [userId]);
      if (userResult.rows.length === 0) return;

      const dbUserId = userResult.rows[0].id;
      const dcaResult = await query(
        `SELECT * FROM dca_jobs 
         WHERE user_id = $1 
         ORDER BY created_at DESC 
         LIMIT 50`,
        [dbUserId]
      );

      let message = `🔄 *All DCA Orders*\n\n`;
      if (dcaResult.rows.length === 0) {
        message += `No DCA orders found.`;
      } else {
        const activeCount = dcaResult.rows.filter(j => j.is_active).length;
        const inactiveCount = dcaResult.rows.length - activeCount;
        message += `Active: ${activeCount} | Inactive: ${inactiveCount}\n\n`;
        
        for (const job of dcaResult.rows.slice(0, 15)) {
          const status = job.is_active ? '🟢' : '⏸️';
          const fromToken = job.from_token ? `${job.from_token.substring(0, 6)}...` : 'Native';
          const toToken = job.to_token ? `${job.to_token.substring(0, 6)}...` : 'Token';
          const amount = job.amount ? parseFloat(job.amount) : 0;
          const nextExec = job.next_execution ? new Date(job.next_execution).toLocaleDateString() : 'Not set';
          message += `${status} ${fromToken} → ${toToken}\n`;
          message += `   Amount: ${amount.toFixed(4)}\n`;
          message += `   Freq: ${job.frequency || 'Not set'}\n`;
          message += `   Next: ${nextExec}\n\n`;
        }
        if (dcaResult.rows.length > 15) {
          message += `\n_Showing 15 of ${dcaResult.rows.length} orders_`;
        }
      }

      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        reply_markup: new InlineKeyboard()
          .text('🔙 Back to DCA', 'menu_dca')
          .text('❌ Close', 'close_menu')
      });
    } catch (error: any) {
      console.error('View all DCA error:', error);
      await ctx.reply('❌ Error loading DCA orders.');
    }
  });

  // Sub-menu handlers for Sniper
  bot.callbackQuery('sniper_config', async (ctx) => {
    await ctx.answerCallbackQuery();
    
    let message = `⚙️ *Configure Token Sniper*\n\n`;
    message += `Set your auto-buy parameters for new token launches.\n\n`;
    message += `*Available Settings:*\n`;
    message += `• 💰 Buy amount per snipe\n`;
    message += `• ⛽ Maximum gas price\n`;
    message += `• 💧 Minimum liquidity required\n`;
    message += `• 🔒 Anti-rug checks (enabled/disabled)\n`;
    message += `• ⏱️ Max slippage tolerance\n\n`;
    message += `*Safety Features:*\n`;
    message += `• Contract verification\n`;
    message += `• Liquidity lock detection\n`;
    message += `• Ownership renouncement check\n`;
    message += `• Honeypot detection\n\n`;
    message += `⚠️ Sniping is high risk. Only invest what you can afford to lose.`;

    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      reply_markup: new InlineKeyboard()
        .text('💰 Set Buy Amount', 'sniper_set_amount').row()
        .text('🔒 Toggle Safety', 'sniper_toggle_safety').row()
        .text('🔙 Back to Sniper', 'menu_sniper')
        .text('❌ Close', 'close_menu')
    });
  });

  bot.callbackQuery('sniper_history', async (ctx) => {
    await ctx.answerCallbackQuery();
    
    const userId = ctx.from?.id;
    if (!userId) return;

    try {
      const userResult = await query(`SELECT id FROM users WHERE telegram_id = $1`, [userId]);
      if (userResult.rows.length === 0) return;

      const dbUserId = userResult.rows[0].id;
      
      const snipeResult = await query(
        `SELECT * FROM transactions 
         WHERE user_id = $1 AND transaction_type = 'snipe' 
         ORDER BY created_at DESC 
         LIMIT 20`,
        [dbUserId]
      );

      let message = `📜 *Snipe History*\n\n`;
      if (snipeResult.rows.length === 0) {
        message += `No snipe history found.\n\n`;
        message += `When you successfully snipe a token, it will appear here with:\n`;
        message += `• Token details\n`;
        message += `• Purchase price\n`;
        message += `• Transaction signature\n`;
        message += `• Profit/loss status`;
      } else {
        message += `Total snipes: ${snipeResult.rows.length}\n\n`;
        for (const snipe of snipeResult.rows.slice(0, 10)) {
          const date = new Date(snipe.created_at).toLocaleDateString();
          const status = snipe.status === 'confirmed' ? '✅' : '⏳';
          message += `${status} ${date}\n`;
          message += `   Token: ${snipe.to_token.substring(0, 8)}...\n`;
          message += `   Amount: ${parseFloat(snipe.from_amount).toFixed(4)} SOL\n`;
          message += `   Tx: \`${snipe.signature.substring(0, 20)}...\`\n\n`;
        }
      }

      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        reply_markup: new InlineKeyboard()
          .text('🔙 Back to Sniper', 'menu_sniper')
          .text('❌ Close', 'close_menu')
      });
    } catch (error: any) {
      console.error('Sniper history error:', error);
      await ctx.reply('❌ Error loading snipe history.');
    }
  });

  // Sub-menu handlers for Alerts
  bot.callbackQuery('alert_create', async (ctx) => {
    await ctx.answerCallbackQuery();
    
    let message = `➕ *Create Price Alert*\n\n`;
    message += `Get notified when a token reaches your target price.\n\n`;
    message += `*To create an alert:*\n`;
    message += `1. Add token to your watchlist first\n`;
    message += `2. Click "⭐ From Watchlist" button\n`;
    message += `3. Select the token\n`;
    message += `4. Set your target price\n`;
    message += `5. Choose alert type:\n`;
    message += `   • Above target (take profit)\n`;
    message += `   • Below target (buy the dip)\n\n`;
    message += `You'll receive a Telegram notification when the price is reached!`;

    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      reply_markup: new InlineKeyboard()
        .text('⭐ Add to Watchlist First', 'menu_watchlist').row()
        .text('🔙 Back to Alerts', 'menu_alerts')
        .text('❌ Close', 'close_menu')
    });
  });

  // Placeholder handlers for future features
  bot.callbackQuery(/^(sniper_set_amount|sniper_toggle_safety)$/, async (ctx) => {
    await ctx.answerCallbackQuery('Feature coming soon!');
  });

  bot.callbackQuery('menu_help', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    await ctx.answerCallbackQuery();
    
    const { message, keyboard } = getHelpContent();

    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      link_preview_options: { is_disabled: true },
      reply_markup: keyboard
    });

    pushNavigation(userId, 'help');
  });

  // Watchlist menu handler
  bot.callbackQuery('menu_watchlist', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    await ctx.answerCallbackQuery();
    await ctx.editMessageText(
      `👀 *Watchlist*\n\n` +
      `Monitor your favorite tokens across all chains.\n\n` +
      `Add tokens by contract address or URL from pump.fun, Moonshot, Birdeye, or DEX Screener.\n\n` +
      `Your watchlist is currently empty.`,
      {
        parse_mode: 'Markdown',
        reply_markup: getWatchlistMenu()
      }
    );

    pushNavigation(userId, 'watchlist');
  });

  // Watchlist action handlers
  bot.callbackQuery('watchlist_add', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    await ctx.answerCallbackQuery();
    await ctx.reply(
      `➕ *Add to Watchlist*\n\n` +
      `Send me:\n` +
      `• Token contract address (Solana/Ethereum/BSC)\n` +
      `• URL from pump.fun, Moonshot, Birdeye, or DEX Screener\n\n` +
      `I'll automatically detect the chain and add it to your watchlist!`,
      { parse_mode: 'Markdown' }
    );

    userStates.set(userId, { awaitingWatchlistToken: true });
  });

  bot.callbackQuery('watchlist_view_all', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    await ctx.answerCallbackQuery();

    const userResult = await query(`SELECT id FROM users WHERE telegram_id = $1`, [userId]);
    if (userResult.rows.length === 0) return;

    const dbUserId = userResult.rows[0].id;
    const tokens = await watchlistService.getWatchlist(dbUserId);

    if (tokens.length === 0) {
      await ctx.reply(
        `📊 *Your Watchlist*\n\n` +
        `Your watchlist is currently empty. Add some tokens to start monitoring!`,
        { 
          parse_mode: 'Markdown',
          reply_markup: new InlineKeyboard()
            .text('➕ Add Token', 'watchlist_add').row()
            .text('🔙 Back', 'back_button')
            .text('❌ Close', 'close_menu')
        }
      );
      return;
    }

    let message = `📊 *Your Watchlist* (${tokens.length} tokens)\n\n`;
    
    const keyboard = new InlineKeyboard();
    for (const token of tokens) {
      const displayName = token.tokenName 
        ? `${token.tokenName} (${token.tokenSymbol || 'TOKEN'})` 
        : `${token.tokenAddress.substring(0, 8)}...`;
      
      message += `• ${displayName} - ${token.chain.toUpperCase()}\n`;
      keyboard.text(`🗑️ ${displayName}`, `watchlist_remove_${token.id}`).row();
    }

    message += `\nTap a token to remove it from your watchlist.`;

    keyboard.text('➕ Add Token', 'watchlist_add').row();
    keyboard.text('🔙 Back', 'back_button').text('❌ Close', 'close_menu');

    await ctx.reply(message, { 
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  });

  bot.callbackQuery(/^watchlist_remove_(\d+)$/, async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    await ctx.answerCallbackQuery();

    const tokenId = parseInt(ctx.match[1]);
    const userResult = await query(`SELECT id FROM users WHERE telegram_id = $1`, [userId]);
    if (userResult.rows.length === 0) return;

    const dbUserId = userResult.rows[0].id;
    const removed = await watchlistService.removeToken(dbUserId, tokenId);

    if (removed) {
      await ctx.answerCallbackQuery({ text: '✅ Token removed from watchlist' });
      
      const tokens = await watchlistService.getWatchlist(dbUserId);
      
      if (tokens.length === 0) {
        await ctx.editMessageText(
          `📊 *Your Watchlist*\n\n` +
          `Your watchlist is currently empty. Add some tokens to start monitoring!`,
          { 
            parse_mode: 'Markdown',
            reply_markup: new InlineKeyboard()
              .text('➕ Add Token', 'watchlist_add').row()
              .text('🔙 Back', 'back_button')
              .text('❌ Close', 'close_menu')
          }
        );
        return;
      }

      let message = `📊 *Your Watchlist* (${tokens.length} tokens)\n\n`;
      
      const keyboard = new InlineKeyboard();
      for (const token of tokens) {
        const displayName = token.tokenName 
          ? `${token.tokenName} (${token.tokenSymbol || 'TOKEN'})` 
          : `${token.tokenAddress.substring(0, 8)}...`;
        
        message += `• ${displayName} - ${token.chain.toUpperCase()}\n`;
        keyboard.text(`🗑️ ${displayName}`, `watchlist_remove_${token.id}`).row();
      }

      message += `\nTap a token to remove it from your watchlist.`;

      keyboard.text('➕ Add Token', 'watchlist_add').row();
      keyboard.text('🔙 Back', 'back_button').text('❌ Close', 'close_menu');

      await ctx.editMessageText(message, { 
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });
    } else {
      await ctx.answerCallbackQuery({ text: '❌ Failed to remove token', show_alert: true });
    }
  });

  // Wallet import handler
  bot.callbackQuery('wallet_import', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    await ctx.answerCallbackQuery();
    await ctx.reply(
      `📲 *Import Wallet*\n\n` +
      `Send me your 12 or 24-word seed phrase to import your existing wallet.\n\n` +
      `⚠️ *Security Notice:*\n` +
      `• Only import wallets you trust\n` +
      `• Never share your seed phrase with anyone else\n` +
      `• This message will be deleted automatically\n\n` +
      `Type your seed phrase (words separated by spaces):`,
      { parse_mode: 'Markdown' }
    );

    userStates.set(userId, { awaitingImportSeed: true });
  });

  // Token management action handlers
  bot.callbackQuery('tokens_hide_min_value', async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.reply('🔒 Hiding tokens below minimum position value of $0.001...\n\nThis feature will automatically hide low-value tokens from your portfolio view.');
  });

  bot.callbackQuery('tokens_swap_burn', async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.reply('🔥 *Swap and Burn*\n\nThis feature allows you to:\n• Swap rugged tokens for native currency\n• Burn frozen tokens\n• Reclaim rent from dead tokens\n\nComing soon!', { parse_mode: 'Markdown' });
  });

  bot.callbackQuery('tokens_manage_hidden', async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.reply('👁️ *Manage Hidden Tokens*\n\nView and manage your hidden tokens:\n• Frozen tokens: 0\n• Hidden (Min Pos Value): 0\n• Manually hidden: 0\n\nYou can unhide tokens from here.', { parse_mode: 'Markdown' });
  });

  bot.callbackQuery('tokens_refresh', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    await ctx.answerCallbackQuery('Refreshing token data...');

    const userResult = await query(`SELECT id, current_chain FROM users WHERE telegram_id = $1`, [userId]);
    const dbUserId = userResult.rows[0].id;
    const currentChain = (userResult.rows[0].current_chain as ChainType) || 'solana';

    const multiChainWallet = new MultiChainWalletService();
    const balance = await multiChainWallet.getBalance(dbUserId, currentChain);
    const chainInfo = multiChainWallet.getChainManager().getChainInfo(currentChain);

    const tokenStats = {
      solBalance: parseFloat(balance),
      tokensOwned: 0,
      tokenValue: '$N/A',
      frozenTokens: 0,
      hiddenMinPosTokens: 0,
      manuallyHiddenTokens: 0
    };

    const tokenMessage = `
🪙 *Token Management*

Hide tokens to clean up your portfolio, and burn rugged tokens to speed up ${chainInfo.nativeToken.symbol}bot and reclaim ${chainInfo.nativeToken.symbol} from rent.

*${chainInfo.nativeToken.symbol} Balance:* ${tokenStats.solBalance.toFixed(4)}
*Tokens owned:* ${tokenStats.tokensOwned}
*Token Value:* ${tokenStats.tokenValue} ${chainInfo.nativeToken.symbol}

*${tokenStats.frozenTokens}* Frozen Tokens
*${tokenStats.hiddenMinPosTokens}* Hidden (Min Pos Value) Tokens
*${tokenStats.manuallyHiddenTokens}* Manually Hidden Tokens
`;

    await ctx.editMessageText(tokenMessage, {
      parse_mode: 'Markdown',
      reply_markup: getTokenManagementMenu(currentChain, tokenStats)
    });
  });

  // Token buy preset amount handlers - multi-chain support
  bot.callbackQuery(/buy_preset_(solana|ethereum|bsc)_(0x[a-fA-F0-9]{40}|[A-Za-z0-9]{32,44})_([\d.]+)/, async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const chain = ctx.match[1] as ChainType;
    const tokenAddress = ctx.match[2];
    const nativeAmount = parseFloat(ctx.match[3]);

    await ctx.answerCallbackQuery();
    
    try {
      const userResult = await query(`SELECT id FROM users WHERE telegram_id = $1`, [userId]);
      const dbUserId = userResult.rows[0].id;
      
      const settings = await userSettingsService.getSettings(dbUserId);
      
      if (settings.tradingMode === 'ai') {
        await ctx.reply('🤖 AI Trader is enabled. This trade will be analyzed by AI first.');
      }
      
      // Use multi-chain wallet service
      const multiChainWallet = new MultiChainWalletService();
      const wallet = await multiChainWallet.getWallet(dbUserId, chain);

      if (!wallet) {
        await ctx.reply(`❌ No ${chain} wallet found. Please switch to ${chain} chain first.`);
        return;
      }

      const nativeBalance = parseFloat(await multiChainWallet.getBalance(dbUserId, chain));
      const nativeSymbol = multiChainWallet.getChainManager().getAdapter(chain).getNativeToken().symbol;
      
      if (nativeBalance < nativeAmount) {
        await ctx.reply(`❌ Insufficient balance. You have ${nativeBalance.toFixed(4)} ${nativeSymbol} but need ${nativeAmount} ${nativeSymbol}.`);
        return;
      }

      // Only execute swaps for Solana - ETH/BSC coming soon
      if (chain !== 'solana') {
        await ctx.reply(`⏳ ${nativeSymbol} swaps are coming soon! Currently only Solana is supported.`);
        return;
      }

      await ctx.reply(`🔄 Executing swap: ${nativeAmount} ${nativeSymbol} → Token...`);

      const keypair = await walletManager.getKeypair(wallet.id);
      const feeAmount = feeService.calculateFee(nativeAmount);
      const amountAfterFee = nativeAmount - feeAmount;
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
        tokenAddress,
        amountLamportsAfterFee,
        settings.slippageBps
      );

      const txResult = await query(
        `INSERT INTO transactions (wallet_id, user_id, transaction_type, signature, from_token, to_token, from_amount, fee_amount, status)
         VALUES ($1, $2, 'buy', $3, $4, $5, $6, $7, 'confirmed')
         RETURNING id`,
        [wallet.id, dbUserId, signature, NATIVE_SOL_MINT, tokenAddress, nativeAmount, feeTransferSuccess ? feeAmount : 0]
      );

      if (feeTransferSuccess && feeAmount > 0) {
        await feeService.recordFee(txResult.rows[0].id, dbUserId, feeAmount, 'trading', NATIVE_SOL_MINT);
        await referralService.recordReferralReward(txResult.rows[0].id, dbUserId, feeAmount);
      }

      const adapter = multiChainWallet.getChainManager().getAdapter(chain);
      const explorerUrl = adapter.getExplorerUrl(signature);

      await ctx.reply(
        `✅ *Swap Successful!*\n\n` +
        `💰 Amount: ${nativeAmount} ${nativeSymbol}\n` +
        `💵 Fee: ${feeAmount.toFixed(4)} ${nativeSymbol}\n` +
        `📝 Signature: \`${signature}\`\n\n` +
        `🔗 [View Transaction](${explorerUrl})`,
        { parse_mode: 'Markdown', reply_markup: getMainMenu() }
      );
    } catch (error: any) {
      console.error('Buy preset error:', error);
      await ctx.reply(`❌ Swap failed: ${error.message}`);
    }
  });

  // Custom amount buy handler - multi-chain support
  bot.callbackQuery(/buy_custom_amount_(solana|ethereum|bsc)_(0x[a-fA-F0-9]{40}|[A-Za-z0-9]{32,44})/, async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const chain = ctx.match[1] as ChainType;
    const tokenAddress = ctx.match[2];
    
    const multiChainWallet = new MultiChainWalletService();
    const nativeSymbol = multiChainWallet.getChainManager().getAdapter(chain).getNativeToken().symbol;
    
    await ctx.answerCallbackQuery();
    await ctx.reply(
      `💰 *Custom Buy Amount*\n\n` +
      `Please enter the amount of ${nativeSymbol} you want to spend:\n\n` +
      `Example: \`2.5\``,
      { parse_mode: 'Markdown' }
    );

    userStates.set(userId, { 
      awaitingBuyAmount: true,
      currentToken: tokenAddress,
      currentChain: chain
    });
  });

  // Refresh token info handler - multi-chain support
  bot.callbackQuery(/refresh_token_(solana|ethereum|bsc)_(0x[a-fA-F0-9]{40}|[A-Za-z0-9]{32,44})/, async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const chain = ctx.match[1] as ChainType;
    const tokenAddress = ctx.match[2];
    
    await ctx.answerCallbackQuery('Refreshing...');
    
    try {
      const tokenInfo = await tokenInfoService.getTokenInfo(tokenAddress, chain);
      
      if (!tokenInfo) {
        await ctx.reply('❌ Unable to fetch token information.');
        return;
      }

      const userResult = await query(`SELECT id FROM users WHERE telegram_id = $1`, [userId]);
      const dbUserId = userResult.rows[0].id;
      
      const multiChainWallet = new MultiChainWalletService();
      const wallet = await multiChainWallet.getWallet(dbUserId, chain);

      if (!wallet) {
        await ctx.reply(`❌ No ${chain} wallet found.`);
        return;
      }

      const nativeBalance = await multiChainWallet.getBalance(dbUserId, chain);
      const nativeSymbol = multiChainWallet.getChainManager().getAdapter(chain).getNativeToken().symbol;
      const priceImpact5 = tokenInfoService.calculatePriceImpact(tokenInfo, 5.0);

      const explorerLink = urlParser.getExplorerLink(tokenInfo.address, chain);
      const chartLink = urlParser.getChartLink(tokenInfo.address, chain);
      const scanLink = urlParser.getScanLink(tokenInfo.address, 'dexscreener', chain);

      let previewMessage = `*${tokenInfo.name} | ${tokenInfo.symbol} |*\n`;
      previewMessage += `\`${tokenInfo.address}\`\n`;
      previewMessage += `[Explorer](${explorerLink}) | [Chart](${chartLink}) | [Scan](${scanLink})\n\n`;
      previewMessage += `*Price:* $${parseFloat(tokenInfo.priceUsd).toFixed(6)}\n`;
      previewMessage += `*5m:* ${tokenInfoService.formatPriceChange(tokenInfo.priceChange.m5)}, `;
      previewMessage += `*1h:* ${tokenInfoService.formatPriceChange(tokenInfo.priceChange.h1)}, `;
      previewMessage += `*6h:* ${tokenInfoService.formatPriceChange(tokenInfo.priceChange.h6)}, `;
      previewMessage += `*24h:* ${tokenInfoService.formatPriceChange(tokenInfo.priceChange.h24)}\n`;
      previewMessage += `*Market Cap:* ${tokenInfoService.formatLargeNumber(tokenInfo.marketCap)}\n\n`;
      previewMessage += `*Price Impact (5.0000 ${nativeSymbol}):* ${priceImpact5.priceImpact.toFixed(2)}%\n\n`;
      previewMessage += `*Wallet Balance:* ${parseFloat(nativeBalance).toFixed(4)} ${nativeSymbol}\n\n`;
      
      if (tokenInfo.socials?.twitter || tokenInfo.socials?.telegram) {
        previewMessage += `🔗 `;
        if (tokenInfo.socials.twitter) previewMessage += `[Twitter](${tokenInfo.socials.twitter}) `;
        if (tokenInfo.socials.telegram) previewMessage += `[Telegram](${tokenInfo.socials.telegram})`;
        previewMessage += `\n\n`;
      }
      
      previewMessage += `*To buy press one of the buttons below.*`;

      const buyKeyboard = new InlineKeyboard()
        .text('DCA', `menu_dca`)
        .text('✅ Swap', `execute_swap_${chain}_${tokenAddress}`)
        .text('Limit', `menu_limit`)
        .row()
        .text(`Buy 1.0 ${nativeSymbol}`, `buy_preset_${chain}_${tokenAddress}_1.0`)
        .text(`Buy 5.0 ${nativeSymbol}`, `buy_preset_${chain}_${tokenAddress}_5.0`)
        .row()
        .text(`Buy X ${nativeSymbol}`, `buy_custom_amount_${chain}_${tokenAddress}`)
        .row()
        .text('🔄 Refresh', `refresh_token_${chain}_${tokenAddress}`)
        .text('❌ Cancel', 'menu_main');

      await ctx.editMessageText(previewMessage, {
        parse_mode: 'Markdown',
        reply_markup: buyKeyboard,
        link_preview_options: { is_disabled: true }
      });
    } catch (error: any) {
      console.error('Refresh error:', error);
      await ctx.reply(`❌ Error: ${error.message}`);
    }
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

      try {
        await referralService.processReferral(dbUserId, referralCode);
        await ctx.reply(`✅ Referral code applied successfully! Welcome to Zinobot!`);
      } catch (err) {
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
    const { message, keyboard } = getHelpContent();

    await ctx.reply(message, { 
      parse_mode: 'Markdown',
      link_preview_options: { is_disabled: true },
      reply_markup: keyboard
    });
  });

  // ==================== TRADING SETTINGS HANDLERS ====================
  
  // Priority Fee Options Grid
  bot.callbackQuery('show_priority_fee_options', async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(
      `🎯 *Priority Fee Mode*\n\nSelect your preferred priority fee mode:`,
      {
        parse_mode: 'Markdown',
        reply_markup: new InlineKeyboard()
          .text('🟣 Auto', 'set_priority_fee_auto').text('🔵 Fast', 'set_priority_fee_fast').row()
          .text('🟢 Normal', 'set_priority_fee_normal').text('🟡 Custom', 'set_priority_fee_custom').row()
          .text('🔙 Back', 'settings_trading')
      }
    );
  });

  bot.callbackQuery(/^set_priority_fee_(auto|fast|normal|custom)$/, async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const match = ctx.callbackQuery.data.match(/^set_priority_fee_(auto|fast|normal|custom)$/);
    if (!match) return;

    const mode = match[1] === 'fast' ? 'high' : match[1] === 'normal' ? 'medium' : match[1] === 'custom' ? 'low' : 'auto';

    const userResult = await query(`SELECT id FROM users WHERE telegram_id = $1`, [userId]);
    if (userResult.rows.length === 0) return;

    const dbUserId = userResult.rows[0].id;
    await userSettingsService.updateSetting(dbUserId, 'priorityFeeMode', mode);
    await ctx.answerCallbackQuery('✅ Updated!');
    ctx.callbackQuery.data = 'settings_trading';
    // Navigate back handled by callback
  });

  // Auto-Approve Options Grid
  bot.callbackQuery('show_auto_approve_options', async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(
      `✅ *Auto-Approve Trades*\n\nEnable or disable automatic trade approval:`,
      {
        parse_mode: 'Markdown',
        reply_markup: new InlineKeyboard()
          .text('✅ On', 'set_auto_approve_on').text('❌ Off', 'set_auto_approve_off').row()
          .text('🔙 Back', 'settings_trading')
      }
    );
  });

  bot.callbackQuery(/^set_auto_approve_(on|off)$/, async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const match = ctx.callbackQuery.data.match(/^set_auto_approve_(on|off)$/);
    if (!match) return;

    const value = match[1] === 'on';

    const userResult = await query(`SELECT id FROM users WHERE telegram_id = $1`, [userId]);
    if (userResult.rows.length === 0) return;

    const dbUserId = userResult.rows[0].id;
    await userSettingsService.updateSetting(dbUserId, 'autoApproveTrades', value);
    await ctx.answerCallbackQuery('✅ Updated!');
    ctx.callbackQuery.data = 'settings_trading';
    // Navigate back handled by callback
  });

  // ==================== AI TRADER SETTINGS HANDLERS ====================
  
  // Trading Mode Options Grid
  bot.callbackQuery('show_trading_mode_options', async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(
      `🎮 *Trading Mode*\n\nSelect your preferred trading mode:`,
      {
        parse_mode: 'Markdown',
        reply_markup: new InlineKeyboard()
          .text('👤 Manual', 'set_trading_mode_manual').text('🤖 AI', 'set_trading_mode_ai').row()
          .text('🔙 Back', 'settings_ai')
      }
    );
  });

  bot.callbackQuery(/^set_trading_mode_(manual|ai)$/, async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const match = ctx.callbackQuery.data.match(/^set_trading_mode_(manual|ai)$/);
    if (!match) return;

    const mode = match[1];

    const userResult = await query(`SELECT id FROM users WHERE telegram_id = $1`, [userId]);
    if (userResult.rows.length === 0) return;

    const dbUserId = userResult.rows[0].id;
    await userSettingsService.updateSetting(dbUserId, 'tradingMode', mode);
    await ctx.answerCallbackQuery('✅ Updated!');
    ctx.callbackQuery.data = 'settings_ai';
    // Navigate back handled by callback
  });

  // Risk Level Options Grid
  bot.callbackQuery('show_risk_level_options', async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(
      `⚖️ *Risk Level*\n\nSelect your AI trading risk level:`,
      {
        parse_mode: 'Markdown',
        reply_markup: new InlineKeyboard()
          .text('🛡️ Conservative', 'set_risk_conservative').row()
          .text('⚖️ Balanced', 'set_risk_balanced').row()
          .text('⚡ Aggressive', 'set_risk_aggressive').row()
          .text('🔙 Back', 'settings_ai')
      }
    );
  });

  bot.callbackQuery(/^set_risk_(conservative|balanced|aggressive)$/, async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const match = ctx.callbackQuery.data.match(/^set_risk_(conservative|balanced|aggressive)$/);
    if (!match) return;

    const level = match[1];

    const userResult = await query(`SELECT id FROM users WHERE telegram_id = $1`, [userId]);
    if (userResult.rows.length === 0) return;

    const dbUserId = userResult.rows[0].id;
    await userSettingsService.updateSetting(dbUserId, 'aiRiskLevel', level);
    await ctx.answerCallbackQuery('✅ Updated!');
    ctx.callbackQuery.data = 'settings_ai';
    // Navigate back handled by callback
  });

  // AI Confirmation Options Grid
  bot.callbackQuery('show_confirmation_options', async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(
      `✋ *Require Confirmation*\n\nWhen should AI ask for confirmation?`,
      {
        parse_mode: 'Markdown',
        reply_markup: new InlineKeyboard()
          .text('🔴 Always', 'set_confirmation_always').row()
          .text('🟡 Large Trades', 'set_confirmation_large_trades').row()
          .text('🟢 Never', 'set_confirmation_never').row()
          .text('🔙 Back', 'settings_ai')
      }
    );
  });

  bot.callbackQuery(/^set_confirmation_(always|large_trades|never)$/, async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const match = ctx.callbackQuery.data.match(/^set_confirmation_(always|large_trades|never)$/);
    if (!match) return;

    const mode = match[1];

    const userResult = await query(`SELECT id FROM users WHERE telegram_id = $1`, [userId]);
    if (userResult.rows.length === 0) return;

    const dbUserId = userResult.rows[0].id;
    await userSettingsService.updateSetting(dbUserId, 'aiRequireConfirmation', mode);
    await ctx.answerCallbackQuery('✅ Updated!');
    ctx.callbackQuery.data = 'settings_ai';
    // Navigate back handled by callback
  });

  // AI Reasoning Options Grid
  bot.callbackQuery('show_reasoning_options', async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(
      `🧠 *Show AI Reasoning*\n\nDisplay AI decision explanations:`,
      {
        parse_mode: 'Markdown',
        reply_markup: new InlineKeyboard()
          .text('✅ On', 'set_reasoning_on').text('❌ Off', 'set_reasoning_off').row()
          .text('🔙 Back', 'settings_ai')
      }
    );
  });

  bot.callbackQuery(/^set_reasoning_(on|off)$/, async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const match = ctx.callbackQuery.data.match(/^set_reasoning_(on|off)$/);
    if (!match) return;

    const value = match[1] === 'on';

    const userResult = await query(`SELECT id FROM users WHERE telegram_id = $1`, [userId]);
    if (userResult.rows.length === 0) return;

    const dbUserId = userResult.rows[0].id;
    await userSettingsService.updateSetting(dbUserId, 'aiShowReasoning', value);
    await ctx.answerCallbackQuery('✅ Updated!');
    ctx.callbackQuery.data = 'settings_ai';
    // Navigate back handled by callback
  });

  // ==================== SECURITY SETTINGS HANDLERS ====================
  
  // MEV Protection Options Grid
  bot.callbackQuery('show_mev_protection_options', async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(
      `🔒 *MEV Protection*\n\nProtect against front-running:`,
      {
        parse_mode: 'Markdown',
        reply_markup: new InlineKeyboard()
          .text('✅ On', 'set_mev_protection_on').text('❌ Off', 'set_mev_protection_off').row()
          .text('🔙 Back', 'settings_security')
      }
    );
  });

  bot.callbackQuery(/^set_mev_protection_(on|off)$/, async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const match = ctx.callbackQuery.data.match(/^set_mev_protection_(on|off)$/);
    if (!match) return;

    const value = match[1] === 'on';

    const userResult = await query(`SELECT id FROM users WHERE telegram_id = $1`, [userId]);
    if (userResult.rows.length === 0) return;

    const dbUserId = userResult.rows[0].id;
    await userSettingsService.updateSetting(dbUserId, 'mevProtection', value);
    await ctx.answerCallbackQuery('✅ Updated!');
    ctx.callbackQuery.data = 'settings_security';
    // Navigate back handled by callback
  });

  // Anti-Rug Detection Options Grid
  bot.callbackQuery('show_anti_rug_options', async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(
      `⚠️ *Anti-Rug Detection*\n\nWarn about potential rug pulls:`,
      {
        parse_mode: 'Markdown',
        reply_markup: new InlineKeyboard()
          .text('✅ On', 'set_anti_rug_on').text('❌ Off', 'set_anti_rug_off').row()
          .text('🔙 Back', 'settings_security')
      }
    );
  });

  bot.callbackQuery(/^set_anti_rug_(on|off)$/, async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const match = ctx.callbackQuery.data.match(/^set_anti_rug_(on|off)$/);
    if (!match) return;

    const value = match[1] === 'on';

    const userResult = await query(`SELECT id FROM users WHERE telegram_id = $1`, [userId]);
    if (userResult.rows.length === 0) return;

    const dbUserId = userResult.rows[0].id;
    await userSettingsService.updateSetting(dbUserId, 'antiRugDetection', value);
    await ctx.answerCallbackQuery('✅ Updated!');
    ctx.callbackQuery.data = 'settings_security';
    // Navigate back handled by callback
  });

  // Confirmation Mode Options Grid
  bot.callbackQuery('show_confirmation_mode_options', async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(
      `🔐 *Transaction Confirmations*\n\nSelect security level:`,
      {
        parse_mode: 'Markdown',
        reply_markup: new InlineKeyboard()
          .text('⚡ Fast', 'set_confirmation_mode_fast').row()
          .text('🧠 Smart', 'set_confirmation_mode_smart').row()
          .text('🔒 Secure', 'set_confirmation_mode_secure').row()
          .text('🔙 Back', 'settings_security')
      }
    );
  });

  bot.callbackQuery(/^set_confirmation_mode_(fast|smart|secure)$/, async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const match = ctx.callbackQuery.data.match(/^set_confirmation_mode_(fast|smart|secure)$/);
    if (!match) return;

    const mode = match[1];

    const userResult = await query(`SELECT id FROM users WHERE telegram_id = $1`, [userId]);
    if (userResult.rows.length === 0) return;

    const dbUserId = userResult.rows[0].id;
    await userSettingsService.updateSetting(dbUserId, 'transactionConfirmations', mode);
    await ctx.answerCallbackQuery('✅ Updated!');
    ctx.callbackQuery.data = 'settings_security';
    // Navigate back handled by callback
  });

  // Backup Reminder Options Grid
  bot.callbackQuery('show_backup_reminder_options', async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(
      `💾 *Backup Reminder*\n\nHow often should we remind you?`,
      {
        parse_mode: 'Markdown',
        reply_markup: new InlineKeyboard()
          .text('📅 Daily', 'set_backup_reminder_daily').text('📅 Weekly', 'set_backup_reminder_weekly').row()
          .text('📅 Monthly', 'set_backup_reminder_monthly').text('❌ Never', 'set_backup_reminder_never').row()
          .text('🔙 Back', 'settings_security')
      }
    );
  });

  bot.callbackQuery(/^set_backup_reminder_(daily|weekly|monthly|never)$/, async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const match = ctx.callbackQuery.data.match(/^set_backup_reminder_(daily|weekly|monthly|never)$/);
    if (!match) return;

    const frequency = match[1];

    const userResult = await query(`SELECT id FROM users WHERE telegram_id = $1`, [userId]);
    if (userResult.rows.length === 0) return;

    const dbUserId = userResult.rows[0].id;
    await userSettingsService.updateSetting(dbUserId, 'walletBackupReminder', frequency);
    await ctx.answerCallbackQuery('✅ Updated!');
    ctx.callbackQuery.data = 'settings_security';
    // Navigate back handled by callback
  });

  // ==================== NOTIFICATIONS SETTINGS HANDLERS ====================
  
  // Master Notifications Toggle Grid
  bot.callbackQuery('show_notifications_enabled_options', async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(
      `🔔 *Master Notifications Toggle*\n\nEnable or disable all notifications:`,
      {
        parse_mode: 'Markdown',
        reply_markup: new InlineKeyboard()
          .text('✅ On', 'set_notifications_enabled_on').text('❌ Off', 'set_notifications_enabled_off').row()
          .text('🔙 Back', 'settings_notifications')
      }
    );
  });

  bot.callbackQuery(/^set_notifications_enabled_(on|off)$/, async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const match = ctx.callbackQuery.data.match(/^set_notifications_enabled_(on|off)$/);
    if (!match) return;

    const value = match[1] === 'on';

    const userResult = await query(`SELECT id FROM users WHERE telegram_id = $1`, [userId]);
    if (userResult.rows.length === 0) return;

    const dbUserId = userResult.rows[0].id;
    await userSettingsService.updateSetting(dbUserId, 'notificationsEnabled', value);
    await ctx.answerCallbackQuery('✅ Updated!');
    ctx.callbackQuery.data = 'settings_notifications';
    // Navigate back handled by callback
  });

  // Trade Alerts Options Grid
  bot.callbackQuery('show_trade_alerts_options', async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(
      `💱 *Trade Alerts*\n\nNotifications for completed trades:`,
      {
        parse_mode: 'Markdown',
        reply_markup: new InlineKeyboard()
          .text('✅ On', 'set_trade_alerts_on').text('❌ Off', 'set_trade_alerts_off').row()
          .text('🔙 Back', 'settings_notifications')
      }
    );
  });

  bot.callbackQuery(/^set_trade_alerts_(on|off)$/, async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const match = ctx.callbackQuery.data.match(/^set_trade_alerts_(on|off)$/);
    if (!match) return;

    const value = match[1] === 'on';

    const userResult = await query(`SELECT id FROM users WHERE telegram_id = $1`, [userId]);
    if (userResult.rows.length === 0) return;

    const dbUserId = userResult.rows[0].id;
    await userSettingsService.updateSetting(dbUserId, 'tradeAlerts', value);
    await ctx.answerCallbackQuery('✅ Updated!');
    ctx.callbackQuery.data = 'settings_notifications';
    // Navigate back handled by callback
  });

  // Price Alerts Options Grid
  bot.callbackQuery('show_price_alerts_options', async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(
      `📈 *Price Alerts*\n\nWatchlist price notifications:`,
      {
        parse_mode: 'Markdown',
        reply_markup: new InlineKeyboard()
          .text('✅ On', 'set_price_alerts_on').text('❌ Off', 'set_price_alerts_off').row()
          .text('🔙 Back', 'settings_notifications')
      }
    );
  });

  bot.callbackQuery(/^set_price_alerts_(on|off)$/, async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const match = ctx.callbackQuery.data.match(/^set_price_alerts_(on|off)$/);
    if (!match) return;

    const value = match[1] === 'on';

    const userResult = await query(`SELECT id FROM users WHERE telegram_id = $1`, [userId]);
    if (userResult.rows.length === 0) return;

    const dbUserId = userResult.rows[0].id;
    await userSettingsService.updateSetting(dbUserId, 'priceAlerts', value);
    await ctx.answerCallbackQuery('✅ Updated!');
    ctx.callbackQuery.data = 'settings_notifications';
    // Navigate back handled by callback
  });

  // AI Alerts Options Grid
  bot.callbackQuery('show_ai_alerts_options', async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(
      `🤖 *AI Trade Alerts*\n\nNotifications for AI trades:`,
      {
        parse_mode: 'Markdown',
        reply_markup: new InlineKeyboard()
          .text('✅ On', 'set_ai_alerts_on').text('❌ Off', 'set_ai_alerts_off').row()
          .text('🔙 Back', 'settings_notifications')
      }
    );
  });

  bot.callbackQuery(/^set_ai_alerts_(on|off)$/, async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const match = ctx.callbackQuery.data.match(/^set_ai_alerts_(on|off)$/);
    if (!match) return;

    const value = match[1] === 'on';

    const userResult = await query(`SELECT id FROM users WHERE telegram_id = $1`, [userId]);
    if (userResult.rows.length === 0) return;

    const dbUserId = userResult.rows[0].id;
    await userSettingsService.updateSetting(dbUserId, 'aiTradeAlerts', value);
    await ctx.answerCallbackQuery('✅ Updated!');
    ctx.callbackQuery.data = 'settings_notifications';
    // Navigate back handled by callback
  });

  // Referral Alerts Options Grid
  bot.callbackQuery('show_referral_alerts_options', async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(
      `🎁 *Referral Alerts*\n\nReferral rewards notifications:`,
      {
        parse_mode: 'Markdown',
        reply_markup: new InlineKeyboard()
          .text('✅ On', 'set_referral_alerts_on').text('❌ Off', 'set_referral_alerts_off').row()
          .text('🔙 Back', 'settings_notifications')
      }
    );
  });

  bot.callbackQuery(/^set_referral_alerts_(on|off)$/, async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const match = ctx.callbackQuery.data.match(/^set_referral_alerts_(on|off)$/);
    if (!match) return;

    const value = match[1] === 'on';

    const userResult = await query(`SELECT id FROM users WHERE telegram_id = $1`, [userId]);
    if (userResult.rows.length === 0) return;

    const dbUserId = userResult.rows[0].id;
    await userSettingsService.updateSetting(dbUserId, 'referralAlerts', value);
    await ctx.answerCallbackQuery('✅ Updated!');
    ctx.callbackQuery.data = 'settings_notifications';
    // Navigate back handled by callback
  });

  // Portfolio Summary Options Grid
  bot.callbackQuery('show_portfolio_summary_options', async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(
      `📊 *Portfolio Summary*\n\nHow often to receive summaries:`,
      {
        parse_mode: 'Markdown',
        reply_markup: new InlineKeyboard()
          .text('❌ Never', 'set_portfolio_summary_never').row()
          .text('📅 Daily', 'set_portfolio_summary_daily').row()
          .text('📅 Weekly', 'set_portfolio_summary_weekly').row()
          .text('📅 Monthly', 'set_portfolio_summary_monthly').row()
          .text('🔙 Back', 'settings_notifications')
      }
    );
  });

  bot.callbackQuery(/^set_portfolio_summary_(never|daily|weekly|monthly)$/, async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const match = ctx.callbackQuery.data.match(/^set_portfolio_summary_(never|daily|weekly|monthly)$/);
    if (!match) return;

    const frequency = match[1];

    const userResult = await query(`SELECT id FROM users WHERE telegram_id = $1`, [userId]);
    if (userResult.rows.length === 0) return;

    const dbUserId = userResult.rows[0].id;
    await userSettingsService.updateSetting(dbUserId, 'portfolioSummary', frequency);
    await ctx.answerCallbackQuery('✅ Updated!');
    ctx.callbackQuery.data = 'settings_notifications';
    // Navigate back handled by callback
  });

  // ==================== DISPLAY SETTINGS HANDLERS ====================
  
  // Default Chain Options Grid
  bot.callbackQuery('show_default_chain_options', async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(
      `🌐 *Default Chain*\n\nSelect your preferred blockchain:`,
      {
        parse_mode: 'Markdown',
        reply_markup: new InlineKeyboard()
          .text('⚡ Solana', 'set_default_chain_solana').row()
          .text('🔷 Ethereum', 'set_default_chain_ethereum').row()
          .text('🟡 BSC', 'set_default_chain_bsc').row()
          .text('🔙 Back', 'settings_display')
      }
    );
  });

  bot.callbackQuery(/^set_default_chain_(solana|ethereum|bsc)$/, async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const match = ctx.callbackQuery.data.match(/^set_default_chain_(solana|ethereum|bsc)$/);
    if (!match) return;

    const chain = match[1];

    const userResult = await query(`SELECT id FROM users WHERE telegram_id = $1`, [userId]);
    if (userResult.rows.length === 0) return;

    const dbUserId = userResult.rows[0].id;
    await userSettingsService.updateSetting(dbUserId, 'defaultChain', chain);
    await ctx.answerCallbackQuery('✅ Updated!');
    ctx.callbackQuery.data = 'settings_display';
    // Navigate back handled by callback
  });

  // Currency Display Options Grid
  bot.callbackQuery('show_currency_options', async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(
      `💵 *Currency Display*\n\nSelect your preferred currency:`,
      {
        parse_mode: 'Markdown',
        reply_markup: new InlineKeyboard()
          .text('💵 USD', 'set_currency_usd').text('💶 EUR', 'set_currency_eur').row()
          .text('🔙 Back', 'settings_display')
      }
    );
  });

  bot.callbackQuery(/^set_currency_(usd|eur)$/, async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const match = ctx.callbackQuery.data.match(/^set_currency_(usd|eur)$/);
    if (!match) return;

    const currency = match[1].toUpperCase();

    const userResult = await query(`SELECT id FROM users WHERE telegram_id = $1`, [userId]);
    if (userResult.rows.length === 0) return;

    const dbUserId = userResult.rows[0].id;
    await userSettingsService.updateSetting(dbUserId, 'currencyDisplay', currency);
    await ctx.answerCallbackQuery('✅ Updated!');
    ctx.callbackQuery.data = 'settings_display';
    // Navigate back handled by callback
  });

  // Hide Small Balances Options Grid
  bot.callbackQuery('show_hide_balances_options', async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(
      `💰 *Hide Small Balances*\n\nHide dust and small amounts:`,
      {
        parse_mode: 'Markdown',
        reply_markup: new InlineKeyboard()
          .text('✅ On', 'set_hide_balances_on').text('❌ Off', 'set_hide_balances_off').row()
          .text('🔙 Back', 'settings_display')
      }
    );
  });

  bot.callbackQuery(/^set_hide_balances_(on|off)$/, async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const match = ctx.callbackQuery.data.match(/^set_hide_balances_(on|off)$/);
    if (!match) return;

    const value = match[1] === 'on';

    const userResult = await query(`SELECT id FROM users WHERE telegram_id = $1`, [userId]);
    if (userResult.rows.length === 0) return;

    const dbUserId = userResult.rows[0].id;
    await userSettingsService.updateSetting(dbUserId, 'hideSmallBalances', value);
    await ctx.answerCallbackQuery('✅ Updated!');
    ctx.callbackQuery.data = 'settings_display';
    // Navigate back handled by callback
  });

  // ==================== ADVANCED SETTINGS HANDLERS ====================
  
  // Transaction Speed Options Grid
  bot.callbackQuery('show_transaction_speed_options', async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(
      `⚡ *Transaction Speed*\n\nSelect speed vs. cost trade-off:`,
      {
        parse_mode: 'Markdown',
        reply_markup: new InlineKeyboard()
          .text('🐌 Slow', 'set_transaction_speed_slow').row()
          .text('⚖️ Normal', 'set_transaction_speed_normal').row()
          .text('⚡ Fast', 'set_transaction_speed_fast').row()
          .text('🔙 Back', 'settings_advanced')
      }
    );
  });

  bot.callbackQuery(/^set_transaction_speed_(slow|normal|fast)$/, async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const match = ctx.callbackQuery.data.match(/^set_transaction_speed_(slow|normal|fast)$/);
    if (!match) return;

    const speed = match[1];

    const userResult = await query(`SELECT id FROM users WHERE telegram_id = $1`, [userId]);
    if (userResult.rows.length === 0) return;

    const dbUserId = userResult.rows[0].id;
    await userSettingsService.updateSetting(dbUserId, 'transactionSpeed', speed);
    await ctx.answerCallbackQuery('✅ Updated!');
    ctx.callbackQuery.data = 'settings_advanced';
    // Navigate back handled by callback
  });

  // Debug Mode Options Grid
  bot.callbackQuery('show_debug_mode_options', async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(
      `🐛 *Debug Mode*\n\nShow detailed logs and errors:`,
      {
        parse_mode: 'Markdown',
        reply_markup: new InlineKeyboard()
          .text('✅ On', 'set_debug_mode_on').text('❌ Off', 'set_debug_mode_off').row()
          .text('🔙 Back', 'settings_advanced')
      }
    );
  });

  bot.callbackQuery(/^set_debug_mode_(on|off)$/, async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const match = ctx.callbackQuery.data.match(/^set_debug_mode_(on|off)$/);
    if (!match) return;

    const value = match[1] === 'on';

    const userResult = await query(`SELECT id FROM users WHERE telegram_id = $1`, [userId]);
    if (userResult.rows.length === 0) return;

    const dbUserId = userResult.rows[0].id;
    await userSettingsService.updateSetting(dbUserId, 'debugMode', value);
    await ctx.answerCallbackQuery('✅ Updated!');
    ctx.callbackQuery.data = 'settings_advanced';
    // Navigate back handled by callback
  });

  // ==================== INPUT HANDLERS (unchanged) ====================
  
  bot.callbackQuery(/^input_(.+)$/, async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const match = ctx.callbackQuery.data.match(/^input_(.+)$/);
    if (!match) return;

    const field = match[1];

    await ctx.answerCallbackQuery();

    const promptMessages: Record<string, string> = {
      slippage: '⚡ *Enter Slippage Percentage*\n\nEnter a value between 0.1 and 50:\nExample: `1.5` for 1.5% slippage',
      maxTradeAmount: '💰 *Enter Max Trade Amount*\n\nEnter maximum trade amount in SOL:\nExample: `10` for 10 SOL max\nSend `0` for unlimited',
      defaultBuyAmount: '💵 *Enter Default Buy Amount*\n\nEnter default buy amount in SOL:\nExample: `1` for 1 SOL',
      aiMaxTradeSize: '💎 *Enter AI Max Trade Size*\n\nEnter maximum AI trade size in SOL:\nExample: `5` for 5 SOL max',
      aiDailyBudget: '💰 *Enter AI Daily Budget*\n\nEnter daily AI trading budget in SOL:\nExample: `10` for 10 SOL per day',
      aiStopLossPercent: '🛑 *Enter Stop Loss Percentage*\n\nEnter stop loss percentage (1-100):\nExample: `20` for 20% stop loss'
    };

    const promptMessage = promptMessages[field] || 'Enter a numeric value:';

    await ctx.reply(promptMessage, { parse_mode: 'Markdown' });

    const state = userStates.get(userId) || {};
    state.awaitingSettingInput = field;
    userStates.set(userId, state);
  });

  bot.on('message:text', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const state = userStates.get(userId);
    if (!state) return;

    const text = ctx.message.text;

    if (state.awaitingBuyToken) {
      userStates.delete(userId);
      
      try {
        await ctx.reply('🔍 Analyzing token...');
        
        const userResult = await query(`SELECT id, current_chain FROM users WHERE telegram_id = $1`, [userId]);
        const dbUserId = userResult.rows[0].id;
        const userChain = userResult.rows[0].current_chain || 'solana';
        
        const parsed = urlParser.parseURL(text);
        let tokenAddress: string | null = null;
        let chain: string = userChain;
        
        if (parsed) {
          tokenAddress = parsed.tokenAddress;
          chain = parsed.chain || userChain;
        } else {
          const searchResults = await tokenInfoService.searchToken(text, userChain);
          if (searchResults.length === 0) {
            await ctx.reply(
              `❌ Token not found on ${userChain}.\n\n` +
              `Please provide:\n` +
              `• Valid token address\n` +
              `• Token ticker/symbol\n` +
              `• URL from pump.fun, Birdeye, DEX Screener, or Moonshot`,
              { parse_mode: 'Markdown' }
            );
            return;
          }
          tokenAddress = searchResults[0].address;
        }

        const tokenInfo = await tokenInfoService.getTokenInfo(tokenAddress, chain);
        
        if (!tokenInfo) {
          await ctx.reply(
            `❌ Unable to fetch token information.\n\n` +
            `This could mean:\n` +
            `• Token doesn't exist on ${chain}\n` +
            `• No liquidity pools found\n` +
            `• Token is too new (not indexed yet)`,
            { parse_mode: 'Markdown' }
          );
          return;
        }

        const multiChainWallet = new MultiChainWalletService();
        const wallet = await multiChainWallet.getWallet(dbUserId, chain as ChainType);

        if (!wallet) {
          await ctx.reply(`❌ No ${chain} wallet found. Please switch to ${chain} chain first.`);
          return;
        }

        const nativeBalance = await multiChainWallet.getBalance(dbUserId, chain as ChainType);
        const nativeSymbol = multiChainWallet.getChainManager().getAdapter(chain as ChainType).getNativeToken().symbol;
        
        const priceImpact5 = tokenInfoService.calculatePriceImpact(tokenInfo, 5.0);

        let previewMessage = ``;
        
        if (parsed?.platform) {
          const platformEmoji: Record<string, string> = {
            'pump.fun': '🚀',
            'birdeye': '🐦',
            'dexscreener': '📊',
            'moonshot': '🌙'
          };
          previewMessage += `${platformEmoji[parsed.platform] || '💎'} `;
        }
        
        previewMessage += `*${tokenInfo.name} | ${tokenInfo.symbol} |*\n`;
        previewMessage += `\`${tokenInfo.address}\`\n`;
        
        const explorerLink = urlParser.getExplorerLink(tokenInfo.address, chain);
        const chartLink = urlParser.getChartLink(tokenInfo.address, chain);
        const scanLink = urlParser.getScanLink(tokenInfo.address, parsed?.platform || 'dexscreener', chain);
        
        previewMessage += `[Explorer](${explorerLink}) | [Chart](${chartLink}) | [Scan](${scanLink})\n\n`;
        
        previewMessage += `*Price:* $${parseFloat(tokenInfo.priceUsd).toFixed(6)}\n`;
        previewMessage += `*5m:* ${tokenInfoService.formatPriceChange(tokenInfo.priceChange.m5)}, `;
        previewMessage += `*1h:* ${tokenInfoService.formatPriceChange(tokenInfo.priceChange.h1)}, `;
        previewMessage += `*6h:* ${tokenInfoService.formatPriceChange(tokenInfo.priceChange.h6)}, `;
        previewMessage += `*24h:* ${tokenInfoService.formatPriceChange(tokenInfo.priceChange.h24)}\n`;
        previewMessage += `*Market Cap:* ${tokenInfoService.formatLargeNumber(tokenInfo.marketCap)}\n\n`;
        
        previewMessage += `*Price Impact (5.0000 ${nativeSymbol}):* ${priceImpact5.priceImpact.toFixed(2)}%\n\n`;
        
        previewMessage += `*Wallet Balance:* ${parseFloat(nativeBalance).toFixed(4)} ${nativeSymbol}\n\n`;
        
        if (tokenInfo.socials?.twitter || tokenInfo.socials?.telegram) {
          previewMessage += `🔗 `;
          if (tokenInfo.socials.twitter) previewMessage += `[Twitter](${tokenInfo.socials.twitter}) `;
          if (tokenInfo.socials.telegram) previewMessage += `[Telegram](${tokenInfo.socials.telegram})`;
          previewMessage += `\n\n`;
        }
        
        previewMessage += `*To buy press one of the buttons below.*`;

        const buyKeyboard = new InlineKeyboard()
          .text('DCA', `menu_dca`)
          .text('✅ Swap', `execute_swap_${chain}_${tokenAddress}`)
          .text('Limit', `menu_limit`)
          .row()
          .text(`Buy 1.0 ${nativeSymbol}`, `buy_preset_${chain}_${tokenAddress}_1.0`)
          .text(`Buy 5.0 ${nativeSymbol}`, `buy_preset_${chain}_${tokenAddress}_5.0`)
          .row()
          .text(`Buy X ${nativeSymbol}`, `buy_custom_amount_${chain}_${tokenAddress}`)
          .row()
          .text('🔄 Refresh', `refresh_token_${chain}_${tokenAddress}`)
          .text('❌ Cancel', 'menu_main');

        await ctx.reply(previewMessage, {
          parse_mode: 'Markdown',
          reply_markup: buyKeyboard,
          link_preview_options: { is_disabled: true }
        });
        
      } catch (error: any) {
        console.error('Token preview error:', error);
        await ctx.reply(`❌ Error: ${error.message}`);
      }
    } else if (state.awaitingBuyAmount && state.currentToken) {
      const solAmount = parseFloat(text);

      if (isNaN(solAmount) || solAmount <= 0) {
        await ctx.reply('❌ Invalid SOL amount. Please enter a positive number.');
        return;
      }

      const tokenAddress = state.currentToken;
      userStates.delete(userId);

      try {
        const userResult = await query(`SELECT id FROM users WHERE telegram_id = $1`, [userId]);
        const dbUserId = userResult.rows[0].id;
        
        const settings = await userSettingsService.getSettings(dbUserId);
        
        if (settings.tradingMode === 'ai') {
          await ctx.reply('🤖 AI Trader is enabled. This trade will be analyzed by AI first.');
        }
        
        const wallet = await walletManager.getActiveWallet(dbUserId);

        if (!wallet) {
          await ctx.reply('❌ No wallet found. Use /create_wallet first.');
          return;
        }

        const solBalance = await walletManager.getBalance(wallet.publicKey);
        
        if (solBalance < solAmount) {
          await ctx.reply(`❌ Insufficient balance. You have ${solBalance.toFixed(4)} SOL but need ${solAmount} SOL.`);
          return;
        }

        await ctx.reply(`🔄 Executing swap: ${solAmount} SOL → Token...`);

        const keypair = await walletManager.getKeypair(wallet.id);
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
          tokenAddress,
          amountLamportsAfterFee,
          settings.slippageBps
        );

        const txResult = await query(
          `INSERT INTO transactions (wallet_id, user_id, transaction_type, signature, from_token, to_token, from_amount, fee_amount, status)
           VALUES ($1, $2, 'buy', $3, $4, $5, $6, $7, 'confirmed')
           RETURNING id`,
          [wallet.id, dbUserId, signature, NATIVE_SOL_MINT, tokenAddress, solAmount, feeTransferSuccess ? feeAmount : 0]
        );

        if (feeTransferSuccess && feeAmount > 0) {
          await feeService.recordFee(txResult.rows[0].id, dbUserId, feeAmount, 'trading', NATIVE_SOL_MINT);
          await referralService.recordReferralReward(txResult.rows[0].id, dbUserId, feeAmount);
        }

        await ctx.reply(
          `✅ *Swap Successful!*\n\n` +
          `💰 Amount: ${solAmount} SOL\n` +
          `💵 Fee: ${feeAmount.toFixed(4)} SOL\n` +
          `📝 Signature: \`${signature}\`\n\n` +
          `🔗 [View on Solscan](https://solscan.io/tx/${signature}?cluster=devnet)`,
          { parse_mode: 'Markdown', reply_markup: getMainMenu() }
        );
      } catch (error: any) {
        console.error('Buy custom amount error:', error);
        await ctx.reply(`❌ Swap failed: ${error.message}`);
      }
    }
  });

  console.log('✅ Bot commands and callbacks registered');
}
