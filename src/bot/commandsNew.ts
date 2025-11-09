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
import bs58 from 'bs58';
import { MultiChainWalletService } from '../services/multiChainWallet';
import { ChainType } from '../adapters/IChainAdapter';
import { URLParserService } from '../services/urlParser';
import { TokenInfoService } from '../services/tokenInfo';
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

    let referralCode = await referralService.getReferralCode(dbUserId);
    if (!referralCode) {
      referralCode = referralService.generateReferralCode(userId);
      await referralService.setReferralCode(dbUserId, referralCode);
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

    pushNavigation(userId, 'sell');
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

    pushNavigation(userId, 'settings');
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

    pushNavigation(userId, 'referral');
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

  // Back button handler
  bot.callbackQuery('back', async (ctx) => {
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
    const userId = ctx.from?.id;
    if (!userId) return;

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
    await ctx.answerCallbackQuery();
    await ctx.reply('📊 Your watchlist is currently empty. Add some tokens to start monitoring!');
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
        100
      );

      const txResult = await query(
        `INSERT INTO transactions (wallet_id, user_id, transaction_type, signature, from_token, to_token, from_amount, fee_amount, status)
         VALUES ($1, $2, 'buy', $3, $4, $5, $6, $7, 'confirmed')
         RETURNING id`,
        [wallet.id, dbUserId, signature, NATIVE_SOL_MINT, tokenAddress, nativeAmount, feeTransferSuccess ? feeAmount : 0]
      );

      if (feeTransferSuccess && feeAmount > 0) {
        await feeService.recordFee(txResult.rows[0].id, dbUserId, feeAmount, 'trading', NATIVE_SOL_MINT);
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
      userStates.delete(userId);
      
      try {
        await ctx.reply('🔍 Analyzing token...');
        
        // Get user's current chain
        const userResult = await query(`SELECT id, current_chain FROM users WHERE telegram_id = $1`, [userId]);
        const dbUserId = userResult.rows[0].id;
        const userChain = userResult.rows[0].current_chain || 'solana';
        
        // Try to parse URL or token address
        const parsed = urlParser.parseURL(text);
        let tokenAddress: string | null = null;
        let chain: string = userChain;
        
        if (parsed) {
          tokenAddress = parsed.tokenAddress;
          chain = parsed.chain || userChain;
        } else {
          // Try as ticker symbol search using user's current chain
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

        // Fetch token information
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

        // Get user wallet for the detected chain
        const multiChainWallet = new MultiChainWalletService();
        const wallet = await multiChainWallet.getWallet(dbUserId, chain as ChainType);

        if (!wallet) {
          await ctx.reply(`❌ No ${chain} wallet found. Please switch to ${chain} chain first.`);
          return;
        }

        // Get balance using the appropriate chain adapter
        const nativeBalance = await multiChainWallet.getBalance(dbUserId, chain as ChainType);
        const nativeSymbol = multiChainWallet.getChainManager().getAdapter(chain as ChainType).getNativeToken().symbol;
        
        // Calculate price impact for different amounts
        const priceImpact5 = tokenInfoService.calculatePriceImpact(tokenInfo, 5.0);

        // Build token preview message
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
        
        // Explorer links
        const explorerLink = urlParser.getExplorerLink(tokenInfo.address, chain);
        const chartLink = urlParser.getChartLink(tokenInfo.address, chain);
        const scanLink = urlParser.getScanLink(tokenInfo.address, parsed?.platform || 'dexscreener', chain);
        
        previewMessage += `[Explorer](${explorerLink}) | [Chart](${chartLink}) | [Scan](${scanLink})\n\n`;
        
        // Price and market data
        previewMessage += `*Price:* $${parseFloat(tokenInfo.priceUsd).toFixed(6)}\n`;
        previewMessage += `*5m:* ${tokenInfoService.formatPriceChange(tokenInfo.priceChange.m5)}, `;
        previewMessage += `*1h:* ${tokenInfoService.formatPriceChange(tokenInfo.priceChange.h1)}, `;
        previewMessage += `*6h:* ${tokenInfoService.formatPriceChange(tokenInfo.priceChange.h6)}, `;
        previewMessage += `*24h:* ${tokenInfoService.formatPriceChange(tokenInfo.priceChange.h24)}\n`;
        previewMessage += `*Market Cap:* ${tokenInfoService.formatLargeNumber(tokenInfo.marketCap)}\n\n`;
        
        // Price impact
        previewMessage += `*Price Impact (5.0000 ${nativeSymbol}):* ${priceImpact5.priceImpact.toFixed(2)}%\n\n`;
        
        // Wallet balance
        previewMessage += `*Wallet Balance:* ${parseFloat(nativeBalance).toFixed(4)} ${nativeSymbol}\n\n`;
        
        // Social links if available
        if (tokenInfo.socials?.twitter || tokenInfo.socials?.telegram) {
          previewMessage += `🔗 `;
          if (tokenInfo.socials.twitter) previewMessage += `[Twitter](${tokenInfo.socials.twitter}) `;
          if (tokenInfo.socials.telegram) previewMessage += `[Telegram](${tokenInfo.socials.telegram})`;
          previewMessage += `\n\n`;
        }
        
        previewMessage += `*To buy press one of the buttons below.*`;

        // Build inline keyboard with buy options - chain-specific labels
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
          100
        );

        const txResult = await query(
          `INSERT INTO transactions (wallet_id, user_id, transaction_type, signature, from_token, to_token, from_amount, fee_amount, status)
           VALUES ($1, $2, 'buy', $3, $4, $5, $6, $7, 'confirmed')
           RETURNING id`,
          [wallet.id, dbUserId, signature, NATIVE_SOL_MINT, tokenAddress, solAmount, feeTransferSuccess ? feeAmount : 0]
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
        console.error('Buy custom amount error:', error);
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
