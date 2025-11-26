import { Bot, Context, InlineKeyboard, InputFile } from 'grammy';
import { WalletManager } from '../wallet/walletManager';
import { JupiterService, NATIVE_SOL_MINT, USDC_MINT } from '../services/jupiter';
import { FeeAwareSwapService } from '../services/feeAwareSwap';
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
import { TokenInfoService, TokenInfo } from '../services/tokenInfo';
import { userSettingsService } from '../services/userSettings';
import { PinService } from '../services/pinService';
import {
  getMainMenu,
  getBackToMainMenu,
  getWalletMenu,
  getBuyMenu,
  getSettingsMenu,
  getAdminMenu,
  getWithdrawMenu,
  getConfirmMenu,
  getChainSelectorMenu,
  getTokenManagementMenu,
  getWatchlistMenu,
  getPinEntryKeyboard,
  getPinDisplayKeyboard
} from './menus';
import { checkMaintenanceMode } from '../services/botSettings';

const TERMS_MESSAGE = `🚀 *Welcome to Zinochain Bot!*

Your AI-powered multi-chain trading companion for instant token swaps, transfers, and portfolio management across Solana, Ethereum, and BSC.

🌐 *Multi-Chain Support:*
⚡ Solana - Lightning-fast token swaps
🔷 Ethereum - ERC-20 token trading
🟡 BSC - BEP-20 token trading

✨ *What We Offer:*
• Instant token swaps across all chains
• Secure P2P transfers
• Real-time multi-chain portfolio tracking
• Referral rewards program
• Bank-grade AES-256 encryption
• Non-custodial wallet management

⚠️ *Before You Continue:*
By using Zinochain Bot, you agree to our Terms of Service and Privacy Policy.

📄 [Terms of Service](https://zinochain.com/terms)
🔒 [Privacy Policy](https://zinochain.com/privacy)

Tap "Continue" to accept and proceed.`;

const MAIN_DASHBOARD_MESSAGE = (walletAddress: string, balance: number, price: number, chain: string, nativeSymbol: string) => {
  const chainEmoji = chain === 'ethereum' ? '🔷' : chain === 'bsc' ? '🟡' : '⚡';
  const chainName = chain === 'ethereum' ? 'Ethereum' : chain === 'bsc' ? 'BSC' : 'Solana';
  
  return `💼 *Zinochain Bot Trading Dashboard* ${chainEmoji}

🌐 *Active Chain:* ${chainName}

📍 *Your Wallet Address:*
\`${walletAddress}\`
_(Tap to copy)_

💰 *Balance:*
${balance.toFixed(4)} ${nativeSymbol}${price > 0 ? ` ($${(balance * price).toFixed(2)})` : ''}

🎯 *Multi-Chain Features:*
⚡ Solana - Fast & secure token swaps
🔷 Ethereum - Optimized token swaps
🟡 BSC - Optimized token swaps

✨ *Trading Features:*
✅ Cross-chain portfolio tracking
✅ Limit orders & DCA strategies
✅ Token sniper & price alerts
✅ P2P transfers on all chains
✅ Referral rewards program

🔄 Switch between chains anytime using the menu!

🌐 [zinochain.com](https://zinochain.com) | 🐦 [@zinochain](https://x.com/zinochain)

Choose an action below to get started! 👇
`;
};

interface UserState {
  awaitingBuyAmount?: boolean;
  awaitingBuyToken?: boolean;
  awaitingSellAmount?: boolean;
  awaitingWithdrawAddress?: boolean;
  awaitingWithdrawAmount?: boolean;
  awaitingReferralCode?: boolean;
  awaitingWatchlistToken?: boolean;
  awaitingImportSeed?: boolean;
  awaitingTransferAddress?: boolean;
  awaitingTransferAmount?: boolean;
  currentToken?: string;
  currentTokenInfo?: TokenInfo;
  currentChain?: 'solana' | 'ethereum' | 'bsc';
  withdrawType?: 'sol' | 'token';
  selectedChain?: 'solana' | 'ethereum' | 'bsc';
  transferChain?: 'solana' | 'ethereum' | 'bsc';
  transferAddress?: string;
  withdrawAddress?: string;
  withdrawAmount?: number;
  transferType?: 'sol' | 'token';
  awaitingSettingInput?: string;
  awaitingPin?: boolean;
  pinInput?: string;
  pendingWithdrawal?: {
    address: string;
    amount: number;
    type: 'sol' | 'token';
    tokenMint?: string;
    chain: 'solana' | 'ethereum' | 'bsc';
  };
  awaitingNewPin?: boolean;
  newPinInput?: string;
  pendingSwap?: {
    type: 'buy' | 'sell';
    inputMint?: string;
    outputMint?: string;
    amount: number;
    amountLamports?: number;
    feeAmount: number;
    swapAmount: number;
    walletId: number;
    tokenSymbol?: string;
    nativeSymbol?: string;
    tokenAddress?: string;
    chain?: 'solana' | 'ethereum' | 'bsc';
    signature?: string;
    swappedTokens?: number;
  };
  pendingSell?: {
    tokenMint: string;
    tokenSymbol: string;
    sellAmount: number;
    chain: 'solana' | 'ethereum' | 'bsc';
    walletId: number;
    token: any;
  };
  pendingTransfer?: {
    type: 'native' | 'token';
    tokenAddress?: string;
    tokenSymbol?: string;
    recipientAddress: string;
    amount: number;
    feeAmount: number;
    chain: 'solana' | 'ethereum' | 'bsc';
    walletId: number;
  };
  awaitingLimitPrice?: boolean;
  limitOrderType?: 'buy' | 'sell';
  limitOrderAmount?: number;
  pendingLimitOrder?: {
    type: 'buy' | 'sell';
    tokenAddress: string;
    tokenSymbol: string;
    amount: number;
    targetPrice: number;
    chain: 'solana' | 'ethereum' | 'bsc';
    walletId: number;
    feeAmount: number;
  };
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

// Helper function to convert error messages to user-friendly format
function getErrorMessage(error: any): string {
  const errorStr = error?.message || error?.toString() || 'Unknown error';
  if (errorStr.includes('Insufficient lamports') || errorStr.includes('insufficient lamports')) return '💰 Your SOL balance is too low. Please deposit more SOL to your wallet.';
  if (errorStr.includes('insufficient balance') || errorStr.includes('Insufficient balance')) return '💰 Your balance is insufficient for this transaction.';
  if (errorStr.includes('InstructionError') || errorStr.includes('Custom')) return '⚠️ Transaction failed. Your balance might be too low or the network is congested. Please try again.';
  if (errorStr.includes('blockhash') || errorStr.includes('expired')) return '⏱️ Transaction expired. Please try again.';
  if (errorStr.includes('already in use')) return '⏳ Another transaction is in progress. Please wait a moment and try again.';
  if (errorStr.includes('status code 429') || errorStr.includes('Rate limited')) return '⏳ Zinochain swap service is temporarily busy. Retrying automatically... Please wait a moment.';
  if (errorStr.includes('Failed to get quote') || errorStr.includes('Failed to execute swap') || errorStr.includes('swap failed')) return '⚠️ Swap failed. Check balance or try with higher slippage. Please try again.';
  if (errorStr.includes('Fee transfer failed')) return '💸 Fee transfer failed. Ensure you have enough SOL for the transaction and platform fee.';
  return '⚠️ Transaction failed. Please check your balance and try again.';
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
  const feeAwareSwapService = new FeeAwareSwapService(jupiterService, walletManager, feeService);

  // Maintenance Mode Middleware
  bot.use(async (ctx, next) => {
    const userId = ctx.from?.id;
    
    try {
      await checkMaintenanceMode();
      // If no error, maintenance mode is off - continue with normal processing
      await next();
    } catch (error: any) {
      // Maintenance mode is enabled - check if user is admin
      if (error.message && error.message.includes('maintenance mode')) {
        // Check if user is an admin
        if (userId) {
          try {
            const adminCheck = await query(
              `SELECT id FROM admin_users WHERE telegram_id = $1`,
              [userId]
            );
            
            if (adminCheck.rows.length > 0) {
              // Admin user - bypass maintenance mode and continue
              await next();
              return;
            }
          } catch (err) {
            console.error('Error checking admin status:', err);
          }
        }
        
        // Not an admin - show maintenance message and stop processing
        await ctx.reply(`⚠️ ${error.message}\n\nThe bot is currently undergoing maintenance. Please try again later.`);
      } else {
        // Re-throw other errors
        await next();
      }
    }
  });
  
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

  bot.callbackQuery('buy_moonpay', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    await ctx.answerCallbackQuery();

    const userResult = await query(`SELECT id, current_chain FROM users WHERE telegram_id = $1`, [userId]);
    if (userResult.rows.length === 0) {
      await ctx.reply('Please use /start first.');
      return;
    }

    const dbUserId = userResult.rows[0].id;
    const currentChain = userResult.rows[0].current_chain || 'solana';

    const wallet = await multiChainWalletService.getWallet(dbUserId, currentChain);
    const walletAddress = wallet?.publicKey || '';

    const disclaimerMessage = `⚠️ *Important Disclaimer*\n\n` +
      `You are about to be redirected to *Moonpay*, an external third-party service.\n\n` +
      `🔒 *Please Note:*\n` +
      `• Moonpay is *NOT owned or affiliated* with Zinochain\n` +
      `• Zinochain is not responsible for Moonpay's services, fees, or policies\n` +
      `• Your transaction will be processed by Moonpay directly\n` +
      `• All payment information is handled by Moonpay\n\n` +
      `💡 *Your Wallet Address:*\n` +
      `\`${walletAddress}\`\n` +
      `_(Copy this and paste it on Moonpay when asked for your wallet address)_\n\n` +
      `Choose which cryptocurrency you want to buy:`;

    const moonpayKeyboard = new InlineKeyboard()
      .url('💰 Buy SOL', `https://www.moonpay.com/buy/sol?walletAddress=${walletAddress}`)
      .row()
      .url('💵 Buy USDC', `https://www.moonpay.com/buy/usdc_sol?walletAddress=${walletAddress}`)
      .row()
      .text('🔙 Back to Buy Menu', 'menu_buy')
      .text('❌ Close', 'close_menu');

    await ctx.editMessageText(disclaimerMessage, {
      parse_mode: 'Markdown',
      reply_markup: moonpayKeyboard
    });
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

  // State-based preset buy handlers (1.0 SOL) - SHOW CONFIRMATION FIRST
  bot.callbackQuery('buy_preset_1.0', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    await ctx.answerCallbackQuery();
    const state = userStates.get(userId);

    if (!state?.currentToken || !state?.currentChain) {
      await ctx.reply('❌ Session expired. Please search for a token again.');
      return;
    }

    const nativeAmount = 1.0;
    const tokenAddress = state.currentToken;
    const chain = state.currentChain as ChainType;

    // Only Solana swaps are supported
    if (chain !== 'solana') {
      await ctx.reply(`⏳ ${chain} swaps are coming soon! Currently only Solana is supported.`);
      userStates.delete(userId);
      return;
    }

    try {
      const userResult = await query(`SELECT id FROM users WHERE telegram_id = $1`, [userId]);
      const dbUserId = userResult.rows[0].id;
      
      const walletResult = await query(
        `SELECT id FROM wallets WHERE user_id = $1 AND chain = 'solana' AND is_active = true LIMIT 1`,
        [dbUserId]
      );

      if (walletResult.rows.length === 0) {
        await ctx.reply(`❌ No Solana wallet found.`);
        userStates.delete(userId);
        return;
      }

      const wallet = walletResult.rows[0];
      const multiChainWallet = new MultiChainWalletService();
      const nativeBalance = parseFloat(await multiChainWallet.getBalance(dbUserId, chain));
      
      // Calculate total needed (amount + 0.5% fee)
      const feeAmount = nativeAmount * 0.005; // 0.5% fee
      const swapAmount = nativeAmount - feeAmount;
      const totalNeeded = nativeAmount + feeAmount;

      if (nativeBalance < totalNeeded) {
        await ctx.reply(
          `❌ *Insufficient Balance*\n\n` +
          `⚠️  *WARNING: YOU MIGHT LOSE FEES!*\n\n` +
          `💰 Total needed: ${totalNeeded.toFixed(6)} SOL\n` +
          `   • Swap: ${nativeAmount.toFixed(4)} SOL\n` +
          `   • Fee (0.5%): ${feeAmount.toFixed(6)} SOL\n\n` +
          `You have: ${nativeBalance.toFixed(6)} SOL (Short: ${(totalNeeded - nativeBalance).toFixed(6)} SOL)\n\n` +
          `If you attempt to swap with insufficient balance:\n` +
          `• Fee will be transferred FIRST\n` +
          `• Swap will FAIL\n` +
          `• You lose the fee! 💔\n\n` +
          `Please top up your wallet and try again.`,
          { parse_mode: 'Markdown' }
        );
        userStates.delete(userId);
        return;
      }

      // Show confirmation BEFORE executing any transactions
      const confirmMessage = 
        `🔄 *Confirm Swap*\n\n` +
        `📊 *Swap Details:*\n` +
        `• Input: ${nativeAmount.toFixed(4)} SOL\n` +
        `• Platform fee (0.5%): ${feeAmount.toFixed(6)} SOL\n` +
        `• Swap amount: ${swapAmount.toFixed(4)} SOL\n\n` +
        `💰 Your balance: ${nativeBalance.toFixed(6)} SOL\n` +
        `✅ After swap: ${(nativeBalance - nativeAmount - feeAmount).toFixed(6)} SOL\n\n` +
        `⚠️  Fee will only be deducted if swap succeeds.\n\n` +
        `Tap "Confirm" to execute this swap or "Cancel" to abort.`;
      
      // Store pending swap in state
      userStates.set(userId, {
        ...userStates.get(userId),
        pendingSwap: {
          type: 'buy',
          inputMint: NATIVE_SOL_MINT,
          outputMint: tokenAddress,
          amount: nativeAmount,
          amountLamports: Math.floor(nativeAmount * LAMPORTS_PER_SOL),
          feeAmount,
          swapAmount,
          walletId: wallet.id,
          nativeSymbol: 'SOL'
        }
      });

      await ctx.reply(confirmMessage, {
        parse_mode: 'Markdown',
        reply_markup: new InlineKeyboard()
          .text('✅ Confirm Swap', 'confirm_swap_buy')
          .row()
          .text('❌ Cancel', 'menu_main')
      });
    } catch (error: any) {
      console.error('Preset buy error:', error);
      await ctx.reply(
        `❌ *Error*\n\n` +
        `${getErrorMessage(error)}`,
        { parse_mode: 'Markdown' }
      );
      userStates.delete(userId);
    }
  });

  // State-based preset buy handlers (5.0 SOL) - SHOW CONFIRMATION FIRST
  bot.callbackQuery('buy_preset_5.0', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    await ctx.answerCallbackQuery();
    const state = userStates.get(userId);

    if (!state?.currentToken || !state?.currentChain) {
      await ctx.reply('❌ Session expired. Please search for a token again.');
      return;
    }

    const nativeAmount = 5.0;
    const tokenAddress = state.currentToken;
    const chain = state.currentChain as ChainType;

    // Only Solana swaps are supported
    if (chain !== 'solana') {
      await ctx.reply(`⏳ ${chain} swaps are coming soon! Currently only Solana is supported.`);
      userStates.delete(userId);
      return;
    }

    try {
      const userResult = await query(`SELECT id FROM users WHERE telegram_id = $1`, [userId]);
      const dbUserId = userResult.rows[0].id;
      
      const walletResult = await query(
        `SELECT id FROM wallets WHERE user_id = $1 AND chain = 'solana' AND is_active = true LIMIT 1`,
        [dbUserId]
      );

      if (walletResult.rows.length === 0) {
        await ctx.reply(`❌ No Solana wallet found.`);
        userStates.delete(userId);
        return;
      }

      const wallet = walletResult.rows[0];
      const multiChainWallet = new MultiChainWalletService();
      const nativeBalance = parseFloat(await multiChainWallet.getBalance(dbUserId, chain));
      
      // Calculate total needed (amount + 0.5% fee)
      const feeAmount = nativeAmount * 0.005; // 0.5% fee
      const swapAmount = nativeAmount - feeAmount;
      const totalNeeded = nativeAmount + feeAmount;

      if (nativeBalance < totalNeeded) {
        await ctx.reply(
          `❌ *Insufficient Balance*\n\n` +
          `⚠️  *WARNING: YOU MIGHT LOSE FEES!*\n\n` +
          `💰 Total needed: ${totalNeeded.toFixed(6)} SOL\n` +
          `   • Swap: ${nativeAmount.toFixed(4)} SOL\n` +
          `   • Fee (0.5%): ${feeAmount.toFixed(6)} SOL\n\n` +
          `You have: ${nativeBalance.toFixed(6)} SOL (Short: ${(totalNeeded - nativeBalance).toFixed(6)} SOL)\n\n` +
          `If you attempt to swap with insufficient balance:\n` +
          `• Fee will be transferred FIRST\n` +
          `• Swap will FAIL\n` +
          `• You lose the fee! 💔\n\n` +
          `Please top up your wallet and try again.`,
          { parse_mode: 'Markdown' }
        );
        userStates.delete(userId);
        return;
      }

      // Show confirmation BEFORE executing any transactions
      const confirmMessage = 
        `🔄 *Confirm Swap*\n\n` +
        `📊 *Swap Details:*\n` +
        `• Input: ${nativeAmount.toFixed(4)} SOL\n` +
        `• Platform fee (0.5%): ${feeAmount.toFixed(6)} SOL\n` +
        `• Swap amount: ${swapAmount.toFixed(4)} SOL\n\n` +
        `💰 Your balance: ${nativeBalance.toFixed(6)} SOL\n` +
        `✅ After swap: ${(nativeBalance - nativeAmount - feeAmount).toFixed(6)} SOL\n\n` +
        `⚠️  Fee will only be deducted if swap succeeds.\n\n` +
        `Tap "Confirm" to execute this swap or "Cancel" to abort.`;
      
      // Store pending swap in state
      userStates.set(userId, {
        ...userStates.get(userId),
        pendingSwap: {
          type: 'buy',
          inputMint: NATIVE_SOL_MINT,
          outputMint: tokenAddress,
          amount: nativeAmount,
          amountLamports: Math.floor(nativeAmount * LAMPORTS_PER_SOL),
          feeAmount,
          swapAmount,
          walletId: wallet.id,
          nativeSymbol: 'SOL'
        }
      });

      await ctx.reply(confirmMessage, {
        parse_mode: 'Markdown',
        reply_markup: new InlineKeyboard()
          .text('✅ Confirm Swap', 'confirm_swap_buy')
          .row()
          .text('❌ Cancel', 'menu_main')
      });
    } catch (error: any) {
      console.error('Preset buy error:', error);
      await ctx.reply(
        `❌ *Error*\n\n` +
        `${getErrorMessage(error)}`,
        { parse_mode: 'Markdown' }
      );
      userStates.delete(userId);
    }
  });

  // State-based custom buy amount handler
  bot.callbackQuery('buy_custom_amount', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    await ctx.answerCallbackQuery();
    let state = userStates.get(userId);

    if (!state?.currentToken || !state?.currentChain) {
      await ctx.reply('❌ Session expired. Please search for a token again.');
      return;
    }

    state.awaitingBuyAmount = true;
    userStates.set(userId, state);
    
    const nativeSymbol = new MultiChainWalletService().getChainManager().getAdapter(state.currentChain as ChainType).getNativeToken().symbol;
    
    await ctx.reply(`💰 How much ${nativeSymbol} do you want to spend?\n\nEnter an amount (e.g., 0.5, 1.0, 10.5)`);
  });

  // State-based execute swap handler
  bot.callbackQuery('execute_swap_custom', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    await ctx.answerCallbackQuery();
    const state = userStates.get(userId);

    if (!state?.currentTokenInfo || !state?.currentToken || !state?.currentChain) {
      await ctx.reply('❌ Session expired. Please search for a token again.');
      return;
    }

    await ctx.reply(
      `🔄 *Swap*\n\n` +
      `This feature is coming soon! For now, use the preset amounts (Buy 1.0, Buy 5.0) or Buy X to swap custom amounts.`,
      { parse_mode: 'Markdown' }
    );
  });

  // State-based refresh token handler
  bot.callbackQuery('refresh_token_custom', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    await ctx.answerCallbackQuery('Refreshing...');
    const state = userStates.get(userId);

    if (!state?.currentToken || !state?.currentChain) {
      await ctx.reply('❌ Session expired. Please search for a token again.');
      return;
    }

    try {
      const chain = state.currentChain as ChainType;
      const tokenAddress = state.currentToken;
      const tokenInfo = await tokenInfoService.getTokenInfo(tokenAddress, chain);

      if (!tokenInfo) {
        await ctx.reply('❌ Unable to fetch updated token information.');
        return;
      }

      if (state) {
        state.currentTokenInfo = tokenInfo;
      }

      const userResult = await query(`SELECT id FROM users WHERE telegram_id = $1`, [userId]);
      const dbUserId = userResult.rows[0].id;
      
      const multiChainWallet = new MultiChainWalletService();
      const nativeBalance = await multiChainWallet.getBalance(dbUserId, chain);
      const nativeSymbol = multiChainWallet.getChainManager().getAdapter(chain).getNativeToken().symbol;
      const priceImpact5 = tokenInfoService.calculatePriceImpact(tokenInfo, 5.0);

      let previewMessage = `*${tokenInfo.name} | ${tokenInfo.symbol} |*\n`;
      previewMessage += `\`${tokenInfo.address}\`\n`;
      
      const explorerLink = new URLParserService().getExplorerLink(tokenInfo.address, chain);
      const chartLink = new URLParserService().getChartLink(tokenInfo.address, chain);
      const scanLink = new URLParserService().getScanLink(tokenInfo.address, 'dexscreener', chain);
      
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
        .text('✅ Swap', `execute_swap_custom`)
        .text('Limit', `menu_limit`)
        .row()
        .text(`Buy 1.0 ${nativeSymbol}`, `buy_preset_1.0`)
        .text(`Buy 5.0 ${nativeSymbol}`, `buy_preset_5.0`)
        .row()
        .text(`Buy X ${nativeSymbol}`, `buy_custom_amount`)
        .row()
        .text('🔄 Refresh', `refresh_token_custom`)
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
      
      // Query database directly for wallet public_key
      const walletResult = await query(
        `SELECT id, public_key, chain FROM wallets WHERE user_id = $1 AND chain = $2 AND is_active = true LIMIT 1`,
        [dbUserId, 'solana']
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

      const walletPublicKey = walletResult.rows[0].public_key;
      const walletId = walletResult.rows[0].id;
      const chain = 'solana' as ChainType;
      
      // Get chain adapter for native token info
      const adapter = multiChainWalletService.getChainManager().getAdapter(chain);
      
      // Get token balances (chain-specific method)
      let tokenBalances: any[] = [];
      try {
        if (chain === 'solana') {
          // For Solana: use walletManager portfolio with correct key format
          const portfolio = await walletManager.getPortfolio(walletPublicKey);
          tokenBalances = portfolio.tokens || [];
          console.log(`[SELL_MENU] Got portfolio for ${walletPublicKey}, tokens count: ${tokenBalances.length}`);
        } else {
          // For Ethereum/BSC: query purchased tokens from transactions table
          const tokenTxResult = await query(
            `SELECT DISTINCT to_token FROM transactions 
             WHERE wallet_id = $1 AND transaction_type = 'swap' AND status = 'success' AND to_token IS NOT NULL AND to_token != ''`,
            [walletId]
          );
          
          // Convert to TokenBalance format with placeholder names
          tokenBalances = tokenTxResult.rows.map((row: any) => ({
            tokenAddress: row.to_token,
            symbol: `${row.to_token.substring(0, 6)}...`,
            name: 'Token',
            balance: '0',  // Placeholder - would need contract calls to get real balance
            decimals: 18
          }));
        }
      } catch (portfolioError: any) {
        console.error('[SELL_MENU] Portfolio fetch error:', portfolioError);
        tokenBalances = [];
      }

      // Get chain emoji
      const chainEmoji = chain === 'ethereum' ? '🔷' : chain === 'bsc' ? '🟡' : '⚡';
      const chainName = chain === 'ethereum' ? 'Ethereum' : chain === 'bsc' ? 'BSC' : 'Solana';
      const nativeSymbol = adapter.getNativeToken().symbol;

      if (tokenBalances.length === 0) {
        await ctx.editMessageText(
          `💸 *Sell Tokens* ${chainEmoji}\n\n` +
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

      let message = `💸 *Sell Tokens* ${chainEmoji} ${chainName}\n\n`;
      message += `Select a token to sell for ${nativeSymbol}:\n\n`;
      message += `Current fee: ${feeService.getFeePercentage()}%\n\n`;

      const keyboard = new InlineKeyboard();
      
      // Fetch token symbols in parallel but with timeout
      const tokenSymbols: Record<string, string> = {};
      const symbolPromises = tokenBalances.slice(0, 10).map(async (token) => {
        const tokenAddress = token.tokenAddress || token.mint || '';
        try {
          const tokenInfo = (await Promise.race([
            tokenInfoService.getTokenInfo(tokenAddress, chain),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
          ])) as TokenInfo | null;
          if (tokenInfo?.symbol) {
            tokenSymbols[tokenAddress] = tokenInfo.symbol.toUpperCase();
          }
        } catch (err) {
          // Silently fail - will use fallback below
        }
      });
      
      await Promise.all(symbolPromises);
      
      for (let i = 0; i < tokenBalances.length && i < 10; i++) {
        const token = tokenBalances[i];
        const tokenAddress = token.tokenAddress || token.mint || '';
        
        let displaySymbol = tokenSymbols[tokenAddress] || `${tokenAddress.substring(0, 4)}...${tokenAddress.substring(tokenAddress.length - 4)}`;
        
        const buttonText = `🪙 ${displaySymbol} (${parseFloat(token.balance).toFixed(4)})`;
        keyboard.text(buttonText, `sell_token_${chain}_${tokenAddress}`).row();
      }

      if (tokenBalances.length > 10) {
        message += `\n_Showing first 10 tokens only_\n`;
      }

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
  // Fixed regex: [^_]+ matches chain (stops at first underscore), .+ matches token address
  bot.callbackQuery(/^sell_token_([^_]+)_(.+)$/, async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const chain = ctx.match[1] as ChainType;
    const tokenAddress = ctx.match[2];
    await ctx.answerCallbackQuery();

    try {
      const userResult = await query(`SELECT id FROM users WHERE telegram_id = $1`, [userId]);
      if (userResult.rows.length === 0) {
        await ctx.reply('Please use /start first.');
        return;
      }

      const dbUserId = userResult.rows[0].id;
      
      // Get wallet for this chain
      const walletResult = await query(
        `SELECT id, public_key, chain FROM wallets WHERE user_id = $1 AND chain = $2 AND is_active = true LIMIT 1`,
        [dbUserId, chain]
      );

      if (walletResult.rows.length === 0) {
        await ctx.reply('❌ Wallet not found for this chain.');
        return;
      }

      const walletPublicKey = walletResult.rows[0].public_key;
      const walletId = walletResult.rows[0].id;
      const adapter = multiChainWalletService.getChainManager().getAdapter(chain);
      const nativeSymbol = adapter.getNativeToken().symbol;
      
      // Get token balances (chain-specific method)
      let tokenList: any[] = [];
      if (chain === 'solana') {
        const portfolio = await walletManager.getPortfolio(walletPublicKey);
        tokenList = portfolio.tokens || [];
      } else {
        // For Ethereum/BSC: query from transactions table
        const tokenTxResult = await query(
          `SELECT DISTINCT to_token FROM transactions 
           WHERE wallet_id = $1 AND transaction_type = 'swap' AND status = 'success' AND to_token IS NOT NULL AND to_token != ''`,
          [walletId]
        );
        tokenList = tokenTxResult.rows.map((row: any) => ({
          tokenAddress: row.to_token,
          symbol: `${row.to_token.substring(0, 6)}...`,
          name: 'Token',
          balance: '0',
          decimals: 18
        }));
        
        if (tokenList.length === 0) {
          await ctx.reply('❌ No tokens found in your wallet.');
          return;
        }
      }
      
      const token = tokenList.find((t: any) => 
        (t.tokenAddress === tokenAddress) || (t.mint === tokenAddress)
      );

      if (!token) {
        await ctx.reply('❌ Token not found in your wallet.');
        return;
      }

      const chainEmoji = chain === 'ethereum' ? '🔷' : chain === 'bsc' ? '🟡' : '⚡';
      
      // Fetch token metadata to get proper symbol/name
      let displayName = `${tokenAddress.substring(0, 6)}...${tokenAddress.substring(tokenAddress.length - 4)}`;
      try {
        const tokenInfo = await tokenInfoService.getTokenInfo(tokenAddress, chain);
        if (tokenInfo?.symbol) {
          displayName = tokenInfo.symbol.toUpperCase();
        }
      } catch (err) {
        // Silently fail - will use fallback address
      }

      await ctx.editMessageText(
        `💸 *Sell Token* ${chainEmoji}\n\n` +
        `🪙 Token: ${displayName}\n` +
        `📍 Address: \`${tokenAddress}\`\n` +
        `💰 Available: ${parseFloat(token.balance).toFixed(4)}\n` +
        `💵 Target: ${nativeSymbol}\n\n` +
        `Enter the amount you want to sell:\n\n` +
        `*Example:* \`${(parseFloat(token.balance) / 2).toFixed(4)}\` (half)\n` +
        `or \`all\` to sell everything`,
        { parse_mode: 'Markdown' }
      );

      const state = userStates.get(userId) || {};
      userStates.set(userId, { 
        ...state,
        awaitingSellAmount: true,
        currentToken: tokenAddress,
        currentChain: chain
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

    userStates.set(userId, { awaitingSellAmount: true });
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
      
      // Query database directly for wallet public_key
      const walletResult = await query(
        `SELECT id, public_key FROM wallets WHERE user_id = $1 AND chain = $2 AND is_active = true LIMIT 1`,
        [dbUserId, 'solana']
      );

      if (walletResult.rows.length === 0) {
        await ctx.reply('❌ No Solana wallet found. Use /create_wallet first.', {
          reply_markup: getBackToMainMenu()
        });
        return;
      }

      const walletPublicKey = walletResult.rows[0].public_key;
      const portfolio = await walletManager.getPortfolio(walletPublicKey);
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
    const userId = ctx.from?.id;
    if (!userId) return;

    await ctx.answerCallbackQuery();

    const userResult = await query(`SELECT id, current_chain FROM users WHERE telegram_id = $1`, [userId]);
    if (userResult.rows.length === 0) {
      await ctx.reply('Please use /start first.');
      return;
    }

    const dbUserId = userResult.rows[0].id;
    const currentChain = userResult.rows[0].current_chain || 'solana';

    const wallet = await multiChainWalletService.getWallet(dbUserId, currentChain);
    const walletAddress = wallet?.publicKey || '';

    const nativeSymbol = currentChain === 'ethereum' ? 'ETH' : currentChain === 'bsc' ? 'BNB' : 'SOL';
    const currencyCode = currentChain === 'ethereum' ? 'eth' : currentChain === 'bsc' ? 'bnb_bsc' : 'sol';

    const disclaimerMessage = `⚠️ *Important Disclaimer*\n\n` +
      `You are about to be redirected to *Moonpay*, an external third-party service.\n\n` +
      `🔒 *Please Note:*\n` +
      `• Moonpay is *NOT owned or affiliated* with Zinochain\n` +
      `• Zinochain is not responsible for Moonpay's services, fees, or policies\n` +
      `• Your transaction will be processed by Moonpay directly\n` +
      `• All payment information is handled by Moonpay\n\n` +
      `💡 *Your Wallet Address:*\n` +
      `\`${walletAddress}\`\n` +
      `_(Copy this and paste it on Moonpay when asked for your wallet address)_\n\n` +
      `Ready to buy ${nativeSymbol}?`;

    const moonpayKeyboard = new InlineKeyboard()
      .url(`💰 Buy ${nativeSymbol} with Card`, `https://www.moonpay.com/buy/${currencyCode}?walletAddress=${walletAddress}`)
      .row()
      .text('🔙 Back to Wallet', 'menu_wallet')
      .text('❌ Close', 'close_menu');

    await ctx.editMessageText(disclaimerMessage, {
      parse_mode: 'Markdown',
      reply_markup: moonpayKeyboard
    });
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
      const adapter = multiChainWallet.getChainManager().getAdapter(currentChain);
      const nativeToken = adapter.getNativeToken();
      const price = await coinGeckoService.getNativePrice(currentChain);

      if (!wallet) return;

      const message = MAIN_DASHBOARD_MESSAGE(
        wallet.publicKey, 
        parseFloat(balance), 
        price, 
        currentChain, 
        nativeToken.symbol
      );

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
        const adapter = multiChainWallet.getChainManager().getAdapter(currentChain);
        const nativeToken = adapter.getNativeToken();
        const price = await coinGeckoService.getNativePrice(currentChain);

        if (!wallet) return;

        const message = MAIN_DASHBOARD_MESSAGE(
          wallet.publicKey, 
          parseFloat(balance), 
          price, 
          currentChain, 
          nativeToken.symbol
        );

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
        // Show dynamic sell menu with user's actual tokens from portfolio
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
          
          // Query database directly for wallet public_key
          const walletResult = await query(
            `SELECT id, public_key, chain FROM wallets WHERE user_id = $1 AND chain = $2 AND is_active = true LIMIT 1`,
            [dbUserId, 'solana']
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

          const walletPublicKey = walletResult.rows[0].public_key;
          const walletId = walletResult.rows[0].id;
          const chain = 'solana' as ChainType;
          const adapter = multiChainWalletService.getChainManager().getAdapter(chain);
          const portfolio = await walletManager.getPortfolio(walletPublicKey);
          const tokenBalances = portfolio.tokens || [];
          const chainEmoji = '⚡';
          const chainName = 'Solana';
          const nativeSymbol = adapter.getNativeToken().symbol;

          if (tokenBalances.length === 0) {
            await ctx.editMessageText(
              `💸 *Sell Tokens* ${chainEmoji}\n\n` +
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

          let message = `💸 *Sell Tokens* ${chainEmoji} ${chainName}\n\n`;
          message += `Select a token to sell for ${nativeSymbol}:\n\n`;
          message += `Current fee: ${feeService.getFeePercentage()}%\n\n`;

          const keyboard = new InlineKeyboard();
          
          const tokenSymbols: Record<string, string> = {};
          const symbolPromises = tokenBalances.slice(0, 10).map(async (token: any) => {
            const tokenAddress = token.tokenAddress || token.mint || '';
            try {
              const tokenInfo = (await Promise.race([
                tokenInfoService.getTokenInfo(tokenAddress, chain),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
              ])) as TokenInfo | null;
              if (tokenInfo?.symbol) {
                tokenSymbols[tokenAddress] = tokenInfo.symbol.toUpperCase();
              }
            } catch (err) {
              // Silently fail
            }
          });
          
          await Promise.all(symbolPromises);
          
          for (let i = 0; i < tokenBalances.length && i < 10; i++) {
            const token = tokenBalances[i];
            const tokenAddress = token.tokenAddress || token.mint || '';
            let displaySymbol = tokenSymbols[tokenAddress] || `${tokenAddress.substring(0, 4)}...${tokenAddress.substring(tokenAddress.length - 4)}`;
            const buttonText = `🪙 ${displaySymbol} (${parseFloat(token.balance).toFixed(4)})`;
            keyboard.text(buttonText, `sell_token_solana_${tokenAddress}`).row();
          }

          if (tokenBalances.length > 10) {
            message += `\n_Showing first 10 tokens only_\n`;
          }

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

      const portfolio = await walletManager.getPortfolio(wallet.publicKey);

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

  // ==================== P2P TRANSFER HANDLERS ====================

  // P2P Transfer Main Menu
  bot.callbackQuery('menu_p2p_transfer', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    try {
      await ctx.answerCallbackQuery();

      const userResult = await query(`SELECT id, current_chain FROM users WHERE telegram_id = $1`, [userId]);
      if (userResult.rows.length === 0) {
        await ctx.reply('Please use /start first.');
        return;
      }

      const dbUserId = userResult.rows[0].id;
      const currentChain = (userResult.rows[0].current_chain as ChainType) || 'solana';
      const chainEmoji = currentChain === 'ethereum' ? '🔷' : currentChain === 'bsc' ? '🟡' : '⚡';
      const chainName = currentChain === 'ethereum' ? 'Ethereum' : currentChain === 'bsc' ? 'BSC' : 'Solana';
      const nativeSymbol = currentChain === 'ethereum' ? 'ETH' : currentChain === 'bsc' ? 'BNB' : 'SOL';

      // Get wallet for current chain
      const walletResult = await query(
        `SELECT id, public_key, chain FROM wallets WHERE user_id = $1 AND chain = $2 AND is_active = true LIMIT 1`,
        [dbUserId, currentChain]
      );

      if (walletResult.rows.length === 0) {
        await ctx.editMessageText(
          `📤 *P2P Transfer*\n\n` +
          `❌ No wallet found for ${chainName}. Please create a wallet first.`,
          {
            parse_mode: 'Markdown',
            reply_markup: getBackToMainMenu()
          }
        );
        return;
      }

      const wallet = walletResult.rows[0];

      // Get native token balance
      const multiChain = new MultiChainWalletService();
      const adapter = multiChain.getChainManager().getAdapter(currentChain);
      let nativeBalance = '0';
      
      try {
        nativeBalance = await multiChain.getBalance(dbUserId, currentChain);
      } catch (err) {
        console.warn('Balance fetch error:', err);
      }

      // Get token balances (for showing token transfer options)
      let tokenBalances: any[] = [];
      try {
        tokenBalances = await adapter.getTokenBalances(wallet.public_key);
      } catch (err) {
        console.warn('Token balance fetch error:', err);
      }

      let message = `📤 *P2P Transfer* ${chainEmoji} ${chainName}\n\n`;
      message += `Select what to send:\n\n`;
      message += `*Native Token:*\n`;
      message += `💰 ${nativeSymbol}: ${parseFloat(nativeBalance).toFixed(4)}\n\n`;

      const keyboard = new InlineKeyboard();
      
      // Add native token transfer button
      keyboard.text(`📤 Send ${nativeSymbol}`, `p2p_transfer_${currentChain}`).row();

      // Add token transfer options if available
      if (tokenBalances.length > 0) {
        message += `*Your Tokens:*\n`;
        
        for (let i = 0; i < tokenBalances.length && i < 5; i++) {
          const token = tokenBalances[i];
          
          // Fetch token metadata to get proper symbol
          let displayName = 'TOKEN';
          try {
            const tokenMetadata = await tokenInfoService.getTokenInfo(token.tokenAddress, currentChain);
            if (tokenMetadata && tokenMetadata.symbol) {
              displayName = tokenMetadata.symbol;
            } else if (token.symbol && token.symbol !== 'TOKEN') {
              displayName = token.symbol;
            } else {
              displayName = `${token.tokenAddress.substring(0, 4)}...${token.tokenAddress.substring(token.tokenAddress.length - 4)}`;
            }
          } catch (metaError: any) {
            console.warn('Could not fetch token metadata for P2P menu:', metaError.message);
            displayName = token.symbol !== 'TOKEN' ? token.symbol : 
              `${token.tokenAddress.substring(0, 4)}...${token.tokenAddress.substring(token.tokenAddress.length - 4)}`;
          }
          
          message += `🪙 ${displayName}: ${parseFloat(token.balance).toFixed(4)}\n`;
          keyboard.text(`📤 Send ${displayName}`, `p2p_token_${currentChain}_${token.tokenAddress}`).row();
        }

        if (tokenBalances.length > 5) {
          message += `\n_Showing first 5 tokens only_\n`;
        }
      }

      message += `\n_A transfer fee of 1% will be deducted._`;
      keyboard.text('🔙 Back', 'back').text('❌ Close', 'close_menu');

      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      }).catch(async () => {
        // If edit fails, send as new message
        await ctx.reply(message, {
          parse_mode: 'Markdown',
          reply_markup: keyboard
        });
      });

      pushNavigation(userId, 'p2p_transfer');
    } catch (error: any) {
      console.error('P2P Transfer menu error:', error);
      await ctx.reply('❌ Error loading P2P transfer menu: ' + error.message);
    }
  });

    // P2P Transfer for Solana
  bot.callbackQuery('p2p_transfer_solana', async (ctx) => {
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

      // Set state FIRST so message handler catches address input
      userStates.set(userId, {
        ...state,
        awaitingTransferAddress: true,
        transferChain: 'solana',
        currentChain: 'solana'
      });

      await ctx.editMessageText(
        `📤 *P2P Transfer - SOL*\n\n` +
        `Step 1: Enter the destination wallet address\n\n` +
        `*Example:* \`5Z8FwqK...Abc123xyz\`\n\n` +
        `Paste the Solana wallet address where you want to send SOL.`,
        { parse_mode: 'Markdown' }
      ).catch(async () => {
        await ctx.reply(
          `📤 *P2P Transfer - SOL*\n\n` +
          `Step 1: Enter the destination wallet address\n\n` +
          `*Example:* \`5Z8FwqK...Abc123xyz\`\n\n` +
          `Paste the Solana wallet address where you want to send SOL.`,
          { parse_mode: 'Markdown' }
        );
      });
    } catch (error: any) {
      console.error('P2P Transfer Solana error:', error);
      await ctx.reply('❌ Error initiating transfer.');
    }
  });

  // P2P Transfer for Ethereum
  bot.callbackQuery('p2p_transfer_ethereum', async (ctx) => {
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

      // Set state FIRST so message handler catches address input
      userStates.set(userId, {
        ...state,
        awaitingTransferAddress: true,
        transferChain: 'ethereum',
        currentChain: 'ethereum'
      });

      await ctx.editMessageText(
        `📤 *P2P Transfer - ETH*\n\n` +
        `Step 1: Enter the destination wallet address\n\n` +
        `*Example:* \`0x742d35Cc6634C0532925a3b844Bc58e8bcccEAF7\`\n\n` +
        `Paste the Ethereum wallet address where you want to send ETH.`,
        { parse_mode: 'Markdown' }
      ).catch(async () => {
        await ctx.reply(
          `📤 *P2P Transfer - ETH*\n\n` +
          `Step 1: Enter the destination wallet address\n\n` +
          `*Example:* \`0x742d35Cc6634C0532925a3b844Bc58e8bcccEAF7\`\n\n` +
          `Paste the Ethereum wallet address where you want to send ETH.`,
          { parse_mode: 'Markdown' }
        );
      });
    } catch (error: any) {
      console.error('P2P Transfer Ethereum error:', error);
      await ctx.reply('❌ Error initiating transfer.');
    }
  });

  // P2P Transfer for BSC
  bot.callbackQuery('p2p_transfer_bsc', async (ctx) => {
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

      // Set state FIRST so message handler catches address input
      userStates.set(userId, {
        ...state,
        awaitingTransferAddress: true,
        transferChain: 'bsc',
        currentChain: 'bsc'
      });

      await ctx.editMessageText(
        `📤 *P2P Transfer - BNB*\n\n` +
        `Step 1: Enter the destination wallet address\n\n` +
        `*Example:* \`0x742d35Cc6634C0532925a3b844Bc58e8bcccEAF7\`\n\n` +
        `Paste the BSC wallet address where you want to send BNB.`,
        { parse_mode: 'Markdown' }
      ).catch(async () => {
        await ctx.reply(
          `📤 *P2P Transfer - BNB*\n\n` +
          `Step 1: Enter the destination wallet address\n\n` +
          `*Example:* \`0x742d35Cc6634C0532925a3b844Bc58e8bcccEAF7\`\n\n` +
          `Paste the BSC wallet address where you want to send BNB.`,
          { parse_mode: 'Markdown' }
        );
      });
    } catch (error: any) {
      console.error('P2P Transfer BSC error:', error);
      await ctx.reply('❌ Error initiating transfer.');
    }
  });

  // P2P Token Transfer Handler
  bot.callbackQuery(/^p2p_token_(.+)_(.+)$/, async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const chain = ctx.match[1] as ChainType;
    const tokenAddress = ctx.match[2];

    await ctx.answerCallbackQuery();

    try {
      const userResult = await query(`SELECT id FROM users WHERE telegram_id = $1`, [userId]);
      if (userResult.rows.length === 0) {
        await ctx.reply('Please use /start first.');
        return;
      }

      // Fetch token metadata to get proper symbol
      let tokenSymbol = 'TOKEN';
      try {
        const tokenMetadata = await tokenInfoService.getTokenInfo(tokenAddress, chain);
        if (tokenMetadata && tokenMetadata.symbol) {
          tokenSymbol = tokenMetadata.symbol;
        }
      } catch (metaError: any) {
        console.warn('Could not fetch token metadata:', metaError.message);
        tokenSymbol = tokenAddress.substring(0, 8);
      }

      const state = userStates.get(userId) || {};

      // Set state to await transfer address for token
      userStates.set(userId, {
        ...state,
        awaitingTransferAddress: true,
        transferChain: chain,
        currentChain: chain,
        currentToken: tokenAddress,
        transferType: 'token'
      });

      const chainName = chain === 'ethereum' ? 'Ethereum' : chain === 'bsc' ? 'BSC' : 'Solana';

      await ctx.editMessageText(
        `📤 *P2P Transfer - ${tokenSymbol}*\n\n` +
        `Token: ${tokenSymbol}\n` +
        `Chain: ${chainName}\n\n` +
        `Step 1: Enter the destination wallet address\n\n` +
        `Paste the wallet address on ${chainName}.`,
        { parse_mode: 'Markdown' }
      ).catch(async () => {
        await ctx.reply(
          `📤 *P2P Transfer - ${tokenSymbol}*\n\n` +
          `Token: ${tokenSymbol}\n` +
          `Chain: ${chainName}\n\n` +
          `Step 1: Enter the destination wallet address\n\n` +
          `Paste the wallet address on ${chainName}.`,
          { parse_mode: 'Markdown' }
        );
      });
    } catch (error: any) {
      console.error('P2P Token Transfer setup error:', error);
      await ctx.reply('❌ Error initiating token transfer.');
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
        const activeCount = dcaResult.rows.filter((j: any) => j.is_active).length;
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
      const amountLamports = Math.floor(nativeAmount * LAMPORTS_PER_SOL);

      // Execute swap with automatic fee deduction
      const swapResult = await feeAwareSwapService.swapWithFeeDeduction(
        keypair,
        NATIVE_SOL_MINT,
        tokenAddress,
        amountLamports,
        settings.slippageBps,
        dbUserId,
        wallet.id
      );

      // Record referral reward
      if (swapResult.transactionId) {
        await referralService.recordReferralReward(swapResult.transactionId, dbUserId, swapResult.feeAmount);
      }

      const adapter = multiChainWallet.getChainManager().getAdapter(chain);
      const explorerUrl = adapter.getExplorerUrl(swapResult.signature);

      await ctx.reply(
        `✅ *Swap Successful!*\n\n` +
        `💰 Amount: ${nativeAmount} ${nativeSymbol}\n` +
        `💵 Fee: ${swapResult.feeAmount.toFixed(4)} ${nativeSymbol}\n` +
        `🔄 Swapped: ${swapResult.swapAmount.toFixed(4)} ${nativeSymbol}\n` +
        `📝 Signature: \`${swapResult.signature}\`\n\n` +
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

      // Store token info in state for button callbacks
      if (userStates.has(userId)) {
        const state = userStates.get(userId);
        if (state) {
          state.currentTokenInfo = tokenInfo;
          state.currentChain = chain as ChainType;
          state.currentToken = tokenAddress;
        }
      } else {
        userStates.set(userId, {
          currentTokenInfo: tokenInfo,
          currentChain: chain as ChainType,
          currentToken: tokenAddress
        });
      }

      const buyKeyboard = new InlineKeyboard()
        .text('DCA', `menu_dca`)
        .text('✅ Swap', `execute_swap_custom`)
        .text('Limit', `menu_limit`)
        .row()
        .text(`Buy 1.0 ${nativeSymbol}`, `buy_preset_1.0`)
        .text(`Buy 5.0 ${nativeSymbol}`, `buy_preset_5.0`)
        .row()
        .text(`Buy X ${nativeSymbol}`, `buy_custom_amount`)
        .row()
        .text('🔄 Refresh', `refresh_token_custom`)
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
        await ctx.reply(`✅ Referral code applied successfully! Welcome to Zinochain Bot!`);
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

    // ===== LIMIT ORDER: Handle amount input for buy limit =====
    if (state.awaitingLimitPrice === true && state.limitOrderType === 'buy' && state.currentToken) {
      const amount = parseFloat(text);
      if (isNaN(amount) || amount <= 0) {
        await ctx.reply('❌ Invalid amount. Please enter a positive number.');
        return;
      }

      const chain = state.currentChain || 'solana';
      const nativeSymbol = chain === 'ethereum' ? 'ETH' : chain === 'bsc' ? 'BNB' : 'SOL';
      const currentPrice = parseFloat(state.currentTokenInfo?.priceUsd || '0');
      
      await ctx.reply(
        `⏰ *Set Target Price*\n\n` +
        `📊 Token: ${state.currentTokenInfo?.symbol || 'TOKEN'}\n` +
        `💰 Spend Amount: ${amount} ${nativeSymbol}\n` +
        `📈 Current Price: $${currentPrice.toFixed(6)}\n\n` +
        `Step 2: Enter the target price in USD:\n\n` +
        `*Example:* \`0.000001\` (lower = buy when price drops)\n\n` +
        `Platform fee: 0.5% will be applied`,
        { parse_mode: 'Markdown' }
      );

      userStates.set(userId, {
        ...state,
        limitOrderAmount: amount,
        awaitingLimitPrice: 'target_price' as any
      });
      return;
    }

    // ===== LIMIT ORDER: Handle target price input for BUY =====
    if (state.limitOrderType === 'buy' && (state.awaitingLimitPrice === 'target_price' as any) && state.currentToken && state.limitOrderAmount) {
      const targetPrice = parseFloat(text);
      if (isNaN(targetPrice) || targetPrice <= 0) {
        await ctx.reply('❌ Invalid price. Please enter a positive number.');
        return;
      }

      try {
        const userResult = await query(`SELECT id FROM users WHERE telegram_id = $1`, [userId]);
        const dbUserId = userResult.rows[0].id;
        const chain = state.currentChain || 'solana';
        const nativeSymbol = chain === 'ethereum' ? 'ETH' : chain === 'bsc' ? 'BNB' : 'SOL';
        const feeAmount = state.limitOrderAmount * 0.005;

        const multiChainWallet = new MultiChainWalletService();
        const wallet = await multiChainWallet.getWallet(dbUserId, chain as ChainType);

        if (!wallet) {
          await ctx.reply(`❌ No ${chain} wallet found.`);
          userStates.delete(userId);
          return;
        }

        const confirmMessage = 
          `✅ *Confirm Limit Order*\n\n` +
          `📊 Limit Buy Order\n` +
          `• Token: ${state.currentTokenInfo?.symbol || 'TOKEN'}\n` +
          `• Amount: ${state.limitOrderAmount} ${nativeSymbol}\n` +
          `• Target Price: $${targetPrice.toFixed(6)}\n` +
          `• Platform fee (0.5%): ${feeAmount.toFixed(6)} ${nativeSymbol}\n\n` +
          `This order will execute when ${state.currentTokenInfo?.symbol || 'TOKEN'} price reaches $${targetPrice.toFixed(6)}`;

        userStates.set(userId, {
          ...state,
          awaitingLimitPrice: false,
          pendingLimitOrder: {
            type: 'buy',
            tokenAddress: state.currentToken,
            tokenSymbol: state.currentTokenInfo?.symbol || 'TOKEN',
            amount: state.limitOrderAmount,
            targetPrice,
            chain: chain as ChainType,
            walletId: wallet.id,
            feeAmount
          }
        });

        await ctx.reply(confirmMessage, {
          parse_mode: 'Markdown',
          reply_markup: new InlineKeyboard()
            .text('✅ Create Limit Order', 'confirm_limit_order')
            .row()
            .text('❌ Cancel', 'menu_main')
        });
      } catch (error: any) {
        console.error('Limit order processing error:', error);
        await ctx.reply('❌ Error processing limit order.');
        userStates.delete(userId);
      }
      return;
    }


    // ===== LIMIT ORDER SELL: Handle amount input =====
    if (state.limitOrderType === 'sell' && (state.awaitingLimitPrice === 'sell_amount' as any) && state.currentToken) {
      const amount = parseFloat(text);
      if (isNaN(amount) || amount <= 0) {
        await ctx.reply('❌ Invalid amount. Please enter a positive number.');
        return;
      }

      const chain = state.currentChain || 'solana';
      const currentPrice = parseFloat(state.currentTokenInfo?.priceUsd || '0');

      await ctx.reply(
        `⏰ *Sell Limit Order - Target Price*\n\n` +
        `📊 Token: ${state.currentTokenInfo?.symbol || 'TOKEN'}\n` +
        `💰 Sell Amount: ${amount} ${state.currentTokenInfo?.symbol || 'TOKEN'}\n` +
        `📈 Current Price: $${currentPrice.toFixed(6)}\n\n` +
        `Step 3: Enter the target price in USD:\n\n` +
        `*Example:* \`0.000005\` (higher = sell when price rises)\n\n` +
        `Platform fee: 0.5% will be applied`,
        { parse_mode: 'Markdown' }
      );

      userStates.set(userId, {
        ...state,
        limitOrderAmount: amount,
        awaitingLimitPrice: 'sell_target_price' as any
      });
      return;
    }

    // ===== LIMIT ORDER SELL: Handle target price input =====
    if (state.limitOrderType === 'sell' && (state.awaitingLimitPrice === 'sell_target_price' as any) && state.currentToken && state.limitOrderAmount) {
      const targetPrice = parseFloat(text);
      if (isNaN(targetPrice) || targetPrice <= 0) {
        await ctx.reply('❌ Invalid price. Please enter a positive number.');
        return;
      }

      try {
        const userResult = await query(`SELECT id FROM users WHERE telegram_id = $1`, [userId]);
        const dbUserId = userResult.rows[0].id;
        const chain = state.currentChain || 'solana';
        const feeAmount = state.limitOrderAmount * 0.005;

        const multiChainWallet = new MultiChainWalletService();
        const wallet = await multiChainWallet.getWallet(dbUserId, chain as ChainType);

        if (!wallet) {
          await ctx.reply(`❌ No ${chain} wallet found.`);
          userStates.delete(userId);
          return;
        }

        const confirmMessage = 
          `✅ *Confirm Limit Order*\n\n` +
          `📊 Limit Sell Order\n` +
          `• Token: ${state.currentTokenInfo?.symbol || 'TOKEN'}\n` +
          `• Amount: ${state.limitOrderAmount} ${state.currentTokenInfo?.symbol || 'TOKEN'}\n` +
          `• Target Price: $${targetPrice.toFixed(6)}\n` +
          `• Platform fee (0.5%): ${feeAmount.toFixed(6)} ${state.currentTokenInfo?.symbol || 'TOKEN'}\n\n` +
          `This order will execute when ${state.currentTokenInfo?.symbol || 'TOKEN'} price reaches $${targetPrice.toFixed(6)}`;

        userStates.set(userId, {
          ...state,
          awaitingLimitPrice: false,
          pendingLimitOrder: {
            type: 'sell',
            tokenAddress: state.currentToken,
            tokenSymbol: state.currentTokenInfo?.symbol || 'TOKEN',
            amount: state.limitOrderAmount,
            targetPrice,
            chain: chain as ChainType,
            walletId: wallet.id,
            feeAmount
          }
        });

        await ctx.reply(confirmMessage, {
          parse_mode: 'Markdown',
          reply_markup: new InlineKeyboard()
            .text('✅ Create Limit Order', 'confirm_limit_order')
            .row()
            .text('❌ Cancel', 'menu_main')
        });
      } catch (error: any) {
        console.error('Sell limit order processing error:', error);
        await ctx.reply('❌ Error processing limit order.');
        userStates.delete(userId);
      }
      return;
    }

    // ===== P2P TRANSFER: Handle transfer amount input FIRST =====
    if (state.awaitingTransferAmount && state.transferAddress) {
      const amount = parseFloat(text);
      if (isNaN(amount) || amount <= 0) {
        await ctx.reply('❌ Invalid amount. Please enter a positive number.');
        return;
      }

      try {
        const userResult = await query(`SELECT id FROM users WHERE telegram_id = $1`, [userId]);
        if (userResult.rows.length === 0) {
          await ctx.reply('Please use /start first.');
          return;
        }

        const dbUserId = userResult.rows[0].id;
        const chain = state.transferChain || 'solana';
        const chainName = chain === 'ethereum' ? 'Ethereum' : chain === 'bsc' ? 'BSC' : 'Solana';
        const nativeSymbol = chain === 'ethereum' ? 'ETH' : chain === 'bsc' ? 'BNB' : 'SOL';
        const recipientAddress = state.transferAddress;

        const walletResult = await query(
          `SELECT id, public_key FROM wallets WHERE user_id = $1 AND chain = $2 AND is_active = true ORDER BY id DESC LIMIT 1`,
          [dbUserId, chain]
        );

        if (walletResult.rows.length === 0) {
          await ctx.reply(`❌ No ${chainName} wallet found. Please create one first.`);
          return;
        }

        const wallet = walletResult.rows[0];
        const feePercentage = 0.01;
        const feeAmount = amount * feePercentage;
        const totalAmount = amount + feeAmount;

        // Get token name if transferring token
        let tokenSymbol = nativeSymbol;
        if (state.transferType === 'token' && state.currentToken) {
          try {
            const tokenMetadata = await tokenInfoService.getTokenInfo(state.currentToken, chain);
            if (tokenMetadata && tokenMetadata.symbol) {
              tokenSymbol = tokenMetadata.symbol;
            }
          } catch (metaError: any) {
            console.warn('Could not fetch token metadata:', metaError.message);
          }
        }

        // Show confirmation BEFORE executing
        const confirmMessage = 
          `🔄 *Confirm P2P Transfer*\n\n` +
          `📊 Transfer Details:\n` +
          `• Token: ${tokenSymbol}\n` +
          `• Amount: ${amount} ${tokenSymbol}\n` +
          `• Platform fee (1%): ${feeAmount.toFixed(6)} ${nativeSymbol}\n` +
          `• Total needed: ${totalAmount.toFixed(6)} ${nativeSymbol}\n\n` +
          `📍 To: \`${recipientAddress.substring(0, 10)}...${recipientAddress.substring(recipientAddress.length - 4)}\``;

        // Store pending transfer in state
        userStates.set(userId, {
          ...state,
          awaitingTransferAmount: false,
          pendingTransfer: {
            type: state.transferType === 'token' ? 'token' : 'native',
            tokenAddress: state.currentToken,
            tokenSymbol,
            recipientAddress,
            amount,
            feeAmount,
            chain: chain as ChainType,
            walletId: wallet.id
          }
        });

        await ctx.reply(confirmMessage, {
          parse_mode: 'Markdown',
          reply_markup: new InlineKeyboard()
            .text('✅ Confirm Transfer', 'confirm_p2p_transfer')
            .row()
            .text('✏️ Change Amount', 'back')
            .text('❌ Cancel', 'menu_main')
        });
      } catch (error: any) {
        console.error('Transfer amount handler error:', error);
        await ctx.reply('❌ Error processing transfer.');
      }
      return;
    }

    // ===== P2P TRANSFER: Handle transfer address input SECOND =====
    if (state.awaitingTransferAddress) {
      userStates.set(userId, { ...state, awaitingTransferAddress: false, transferAddress: text });

      try {
        const userResult = await query(`SELECT id FROM users WHERE telegram_id = $1`, [userId]);
        if (userResult.rows.length === 0) {
          await ctx.reply('Please use /start first.');
          return;
        }

        const chain = state.transferChain || 'solana';
        
        if (chain === 'solana') {
          if (text.length < 32 || text.length > 44) {
            await ctx.reply('❌ Invalid Solana address. Please enter a valid address.');
            userStates.set(userId, { ...state, awaitingTransferAddress: true });
            return;
          }
        } else {
          if (!text.startsWith('0x') || text.length !== 42) {
            await ctx.reply('❌ Invalid EVM address. Please enter a valid Ethereum/BSC address starting with 0x');
            userStates.set(userId, { ...state, awaitingTransferAddress: true });
            return;
          }
        }

        const chainName = chain === 'ethereum' ? 'Ethereum' : chain === 'bsc' ? 'BSC' : 'Solana';
        const nativeSymbol = chain === 'ethereum' ? 'ETH' : chain === 'bsc' ? 'BNB' : 'SOL';

        const keyboard = new InlineKeyboard()
          .text('✏️ Change Address', 'p2p_transfer_' + chain).row()
          .text('🔙 Back', 'back')
          .text('❌ Cancel', 'menu_main');

        await ctx.reply(
          `📤 *P2P Transfer - ${chainName}*\n\n✅ Address: \`${text}\`\n\nStep 2: Enter the amount of ${nativeSymbol} to send\n\n*Example:* \`0.5\` or \`1.25\``,
          { parse_mode: 'Markdown', reply_markup: keyboard }
        );

        userStates.set(userId, { ...state, awaitingTransferAmount: true, transferAddress: text });
      } catch (error: any) {
        console.error('Transfer address handler error:', error);
        await ctx.reply('❌ Error processing address.');
      }
      return;
    }

    // ===== TOKEN BUY AMOUNT: Check BEFORE token search to fix "Buy X" amount input =====
    if (state.awaitingBuyAmount && state.currentToken) {
      const nativeAmount = parseFloat(text);

      if (isNaN(nativeAmount) || nativeAmount <= 0) {
        await ctx.reply('❌ Invalid amount. Please enter a positive number.');
        return;
      }

      const tokenAddress = state.currentToken;
      const chain = (state.currentChain || 'solana') as ChainType;
      
      if (!tokenAddress || !chain) {
        await ctx.reply('❌ Invalid state. Please try searching for the token again.');
        userStates.delete(userId);
        return;
      }

      try {
        const userResult = await query(`SELECT id FROM users WHERE telegram_id = $1`, [userId]);
        const dbUserId = userResult.rows[0].id;
        
        const settings = await userSettingsService.getSettings(dbUserId);
        
        const multiChainWallet = new MultiChainWalletService();
        const wallet = await multiChainWallet.getWallet(dbUserId, chain);

        if (!wallet) {
          await ctx.reply(`❌ No ${chain} wallet found. Please switch to ${chain} chain first.`);
          userStates.delete(userId);
          return;
        }

        const nativeBalance = parseFloat(await multiChainWallet.getBalance(dbUserId, chain));
        const nativeSymbol = multiChainWallet.getChainManager().getAdapter(chain).getNativeToken().symbol;
        
        // Fetch target token metadata to get symbol
        let targetTokenSymbol = 'TOKEN';
        try {
          const targetTokenInfo = await tokenInfoService.getTokenInfo(tokenAddress, chain);
          if (targetTokenInfo && targetTokenInfo.symbol) {
            targetTokenSymbol = targetTokenInfo.symbol;
          }
        } catch (metaError: any) {
          console.warn('Could not fetch target token metadata:', metaError.message);
          targetTokenSymbol = tokenAddress.substring(0, 8);
        }
        
        // Calculate fee and total needed
        const feeAmount = nativeAmount * 0.005; // 0.5% fee
        const swapAmount = nativeAmount - feeAmount;
        const totalNeeded = nativeAmount + feeAmount;

        if (nativeBalance < totalNeeded) {
          await ctx.reply(
            `❌ *Insufficient Balance*\n\n` +
            `⚠️  *WARNING: YOU MIGHT LOSE FEES!*\n\n` +
            `💰 Total needed: ${totalNeeded.toFixed(6)} ${nativeSymbol}\n` +
            `   • Swap: ${nativeAmount.toFixed(4)} ${nativeSymbol}\n` +
            `   • Fee (0.5%): ${feeAmount.toFixed(6)} ${nativeSymbol}\n\n` +
            `You have: ${nativeBalance.toFixed(6)} ${nativeSymbol} (Short: ${(totalNeeded - nativeBalance).toFixed(6)} ${nativeSymbol})\n\n` +
            `If you attempt to swap with insufficient balance:\n` +
            `• Fee will be transferred FIRST\n` +
            `• Swap will FAIL\n` +
            `• You lose the fee! 💔\n\n` +
            `Please top up your wallet and try again.`,
            { parse_mode: 'Markdown' }
          );
          userStates.delete(userId);
          return;
        }

        // Show confirmation BEFORE executing any transactions
        const confirmMessage = 
          `🔄 *Confirm Swap*\n\n` +
          `📊 Swap Details:\n` +
          `• Input: ${nativeAmount} ${nativeSymbol}\n` +
          `• Target: ${targetTokenSymbol}\n` +
          `• Platform fee (0.5%): ${feeAmount.toFixed(6)} ${nativeSymbol}\n` +
          `• Swap amount: ${swapAmount.toFixed(6)} ${nativeSymbol}\n\n` +
          `💰 Your balance: ${nativeBalance.toFixed(6)} ${nativeSymbol}\n` +
          `✅ After swap: ${(nativeBalance - totalNeeded).toFixed(6)} ${nativeSymbol}`;

        // Store pending swap in state
        userStates.set(userId, {
          ...state,
          awaitingBuyAmount: false,
          pendingSwap: {
            type: 'buy',
            walletId: wallet.id,
            tokenAddress,
            chain,
            amount: nativeAmount,
            swapAmount,
            feeAmount,
            signature: '',
            swappedTokens: 0,
            nativeSymbol,
            tokenSymbol: targetTokenSymbol
          }
        });

        await ctx.reply(confirmMessage, {
          parse_mode: 'Markdown',
          reply_markup: new InlineKeyboard()
            .text('✅ Confirm Swap', 'confirm_swap_buy_custom')
            .row()
            .text('❌ Cancel', 'menu_main')
        });
      } catch (error: any) {
        console.error('Buy custom amount error:', error);
        await ctx.reply(
          `❌ *Error*\n\n` +
          `${getErrorMessage(error)}`,
          { parse_mode: 'Markdown' }
        );
        userStates.delete(userId);
      }
      return;
    }

    // ===== TOKEN BUY: Original buy token handler =====
    if (state.awaitingBuyToken) {
      try {
        await ctx.reply('🔍 Analyzing token...');
        
        const userResult = await query(`SELECT id, current_chain FROM users WHERE telegram_id = $1`, [userId]);
        if (userResult.rows.length === 0) {
          await ctx.reply('Please use /start first.');
          return;
        }
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
          
          // Warn if token might not be on Jupiter
          if (searchResults.length > 0 && searchResults[0].priceUsd === '0') {
            await ctx.reply(
              `⚠️ *Warning*: This token might not have liquidity on Jupiter aggregator.\n\n` +
              `We're trying anyway, but if the swap fails, the token might only be available on Raydium directly.\n\n` +
              `Continuing...`,
              { parse_mode: 'Markdown' }
            );
          }
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

        // Store token info in state for button callbacks
        if (userStates.has(userId)) {
          const state = userStates.get(userId);
          if (state) {
            state.currentTokenInfo = tokenInfo;
            state.currentChain = chain as ChainType;
            state.currentToken = tokenAddress;
          }
        } else {
          userStates.set(userId, {
            currentTokenInfo: tokenInfo,
            currentChain: chain as ChainType,
            currentToken: tokenAddress
          });
        }

        const buyKeyboard = new InlineKeyboard()
          .text('⏰ Limit Order', `create_limit_buy`)
          .text('✅ Swap', `execute_swap_custom`)
          .text('DCA', `menu_dca`)
          .row()
          .text(`Buy 1.0 ${nativeSymbol}`, `buy_preset_1.0`)
          .text(`Buy 5.0 ${nativeSymbol}`, `buy_preset_5.0`)
          .row()
          .text(`Buy X ${nativeSymbol}`, `buy_custom_amount`)
          .row()
          .text('🔄 Refresh', `refresh_token_custom`)
          .text('❌ Cancel', 'menu_main');

        await ctx.reply(previewMessage, {
          parse_mode: 'Markdown',
          reply_markup: buyKeyboard,
          link_preview_options: { is_disabled: true }
        });
        
      } catch (error: any) {
        console.error('Token preview error:', error);
        await ctx.reply(`❌ Error: ${error.message}`);
        // Don't delete state - let user retry
      }
    }

    // ===== SELL TOKEN: Show confirmation with fee breakdown =====
    if (state.awaitingSellAmount && state.currentToken) {
      let sellAmount = 0;
      
      if (text.toLowerCase() === 'all') {
        // Will set sellAmount to full balance below
        sellAmount = -1; // Marker for "all"
      } else {
        sellAmount = parseFloat(text);
        if (isNaN(sellAmount) || sellAmount <= 0) {
          await ctx.reply('❌ Invalid amount. Please enter a positive number.');
          return;
        }
      }

      try {
        const userResult = await query(`SELECT id FROM users WHERE telegram_id = $1`, [userId]);
        if (userResult.rows.length === 0) {
          await ctx.reply('Please use /start first.');
          return;
        }

        const dbUserId = userResult.rows[0].id;
        const tokenMint = state.currentToken;
        const chain = (state.currentChain || 'solana') as ChainType;
        const adapter = new MultiChainWalletService().getChainManager().getAdapter(chain);
        const nativeSymbol = adapter.getNativeToken().symbol;

        // Get wallet
        const walletResult = await query(
          `SELECT id, public_key FROM wallets WHERE user_id = $1 AND chain = $2 AND is_active = true LIMIT 1`,
          [dbUserId, chain]
        );

        if (walletResult.rows.length === 0) {
          await ctx.reply(`❌ Wallet not found for ${chain}`);
          userStates.delete(userId);
          return;
        }

        const walletPublicKey = walletResult.rows[0].public_key;
        const walletId = walletResult.rows[0].id;

        // Get token info (chain-specific method)
        let tokenList: any[] = [];
        if (chain === 'solana') {
          const portfolio = await walletManager.getPortfolio(walletPublicKey);
          tokenList = portfolio.tokens || [];
        } else {
          // For Ethereum/BSC: query from transactions table
          const tokenTxResult = await query(
            `SELECT DISTINCT to_token FROM transactions 
             WHERE wallet_id = $1 AND transaction_type = 'swap' AND status = 'success' AND to_token IS NOT NULL AND to_token != ''`,
            [walletId]
          );
          tokenList = tokenTxResult.rows.map((row: any) => ({
            tokenAddress: row.to_token,
            symbol: `${row.to_token.substring(0, 6)}...`,
            name: 'Token',
            balance: '0',
            decimals: 18
          }));
          
          if (tokenList.length === 0) {
            await ctx.reply('❌ No tokens found in your wallet.');
            userStates.delete(userId);
            return;
          }
        }
        
        const token = tokenList.find((t: any) => 
          (t.tokenAddress === tokenMint) || (t.mint === tokenMint)
        );

        if (!token) {
          await ctx.reply('❌ Token not found in your wallet.');
          userStates.delete(userId);
          return;
        }

        // Handle "all" keyword
        if (sellAmount === -1) {
          sellAmount = parseFloat(token.balance);
        }

        if (parseFloat(token.balance) < sellAmount) {
          await ctx.reply(`❌ Insufficient balance. You have ${token.balance} but trying to sell ${sellAmount}`);
          userStates.delete(userId);
          return;
        }

        // Fetch token metadata to get proper symbol
        let tokenSymbol = 'TOKEN';
        try {
          const tokenMetadata = await tokenInfoService.getTokenInfo(tokenMint, chain);
          if (tokenMetadata && tokenMetadata.symbol) {
            tokenSymbol = tokenMetadata.symbol;
          } else if (token.symbol) {
            tokenSymbol = token.symbol;
          } else {
            tokenSymbol = tokenMint.substring(0, 8);
          }
        } catch (metaError: any) {
          console.warn('Could not fetch token metadata:', metaError.message);
          tokenSymbol = token.symbol || tokenMint.substring(0, 8) || 'TOKEN';
        }
        
        // Estimate fee from SOL output (0.5% of estimated output)
        // This is approximate - actual fee depends on swap quote
        const estimatedFeeAmount = sellAmount * 0.005; // rough estimate
        
        // Show confirmation BEFORE executing any transactions
        const confirmMessage = 
          `🔄 *Confirm Sale*\n\n` +
          `📊 Sale Details:\n` +
          `• Token: ${sellAmount} ${tokenSymbol}\n` +
          `• Platform fee (0.5%): ~${estimatedFeeAmount.toFixed(6)} ${nativeSymbol} (calculated from output)\n\n` +
          `⏳ After confirmation, we'll:\n` +
          `1. Get current price quote\n` +
          `2. Transfer fee (0.5% of SOL output)\n` +
          `3. Execute sale`;

        // Store pending sell in state
        userStates.set(userId, {
          ...state,
          awaitingSellAmount: false,
          pendingSell: {
            tokenMint,
            tokenSymbol,
            sellAmount,
            chain,
            walletId: walletId,
            token
          }
        });

        await ctx.reply(confirmMessage, {
          parse_mode: 'Markdown',
          reply_markup: new InlineKeyboard()
            .text('✅ Confirm Sale', 'confirm_sell_custom')
            .row()
            .text('❌ Cancel', 'menu_main')
        });
      } catch (error: any) {
        console.error('Sell amount handler error:', error);
        await ctx.reply(
          `❌ *Error*\n\n` +
          `${getErrorMessage(error)}`,
          { parse_mode: 'Markdown' }
        );
        userStates.delete(userId);
      }
      return;
    }

    // ===== WITHDRAW: Handle both address and amount =====
    if (state.awaitingWithdrawAddress && !state.withdrawAmount) {
      const address = text.trim();
      userStates.set(userId, { ...state, withdrawAddress: address, awaitingWithdrawAmount: true, awaitingWithdrawAddress: false });

      const chainName = state.currentChain === 'ethereum' ? 'Ethereum' : state.currentChain === 'bsc' ? 'BSC' : 'Solana';
      await ctx.reply(`✅ Address confirmed: \`${address}\`\n\nStep 2: Enter the ${state.withdrawType === 'sol' ? 'SOL' : 'token'} amount to withdraw.\n\n*Example:* \`0.5\` or \`1.25\``);
      return;
    }

    if (state.awaitingWithdrawAmount && state.withdrawAddress) {
      const amount = parseFloat(text);
      if (isNaN(amount) || amount <= 0) {
        await ctx.reply('❌ Invalid amount. Please enter a positive number.');
        return;
      }

      userStates.delete(userId);

      try {
        const userResult = await query(`SELECT id FROM users WHERE telegram_id = $1`, [userId]);
        if (userResult.rows.length === 0) {
          await ctx.reply('Please use /start first.');
          return;
        }

        const dbUserId = userResult.rows[0].id;
        const address = state.withdrawAddress;
        
        // CRITICAL: Load chain from wallet, not state (fixes chain detection bug)
        const walletQueryResult = await query(
          `SELECT id, public_key, chain FROM wallets WHERE user_id = $1 AND is_active = true LIMIT 1`,
          [dbUserId]
        );

        if (walletQueryResult.rows.length === 0) {
          await ctx.reply(`❌ Wallet not found`);
          return;
        }

        const wallet = walletQueryResult.rows[0];
        const chain = (wallet.chain as ChainType) || 'solana'; // Use wallet's chain, not state
        const nativeSymbol = new MultiChainWalletService().getChainManager().getAdapter(chain).getNativeToken().symbol;

        const transferService = new TransferService((walletManager as any).connection);

        await ctx.reply(`🔄 Processing withdrawal of ${amount} ${state.withdrawType === 'sol' ? 'SOL' : 'tokens'}...`);

        let txHash = '';

        if (chain === 'solana') {
          const keypair = await walletManager.getKeypair(wallet.id);
          
          if (state.withdrawType === 'sol') {
            // CRITICAL: Check rent-exempt minimum (0.00203928 SOL)
            const connection = (walletManager as any).connection;
            const balance = await connection.getBalance(keypair.publicKey);
            const balanceSOL = balance / LAMPORTS_PER_SOL;
            const minRentExempt = 0.0025; // 0.00203928 + buffer
            
            if (balanceSOL - amount < minRentExempt) {
              const maxWithdrawable = Math.max(0, balanceSOL - minRentExempt);
              await ctx.reply(
                `❌ *Insufficient balance for rent-exempt minimum*\n\n` +
                `Your wallet needs ${minRentExempt} SOL to stay active.\n\n` +
                `💰 Current balance: ${balanceSOL.toFixed(4)} SOL\n` +
                `🔒 Minimum required: ${minRentExempt} SOL\n` +
                `📤 Maximum withdrawable: ${maxWithdrawable.toFixed(4)} SOL\n\n` +
                `Try withdrawing ${maxWithdrawable.toFixed(4)} SOL instead.`,
                { parse_mode: 'Markdown' }
              );
              return;
            }
            
            txHash = await transferService.transferSOL(keypair, address, amount, dbUserId, null);
          } else if (state.currentToken) {
            // Get token info
            const adapter = new MultiChainWalletService().getChainManager().getAdapter(chain);
            const tokenBalances = await adapter.getTokenBalances(wallet.public_key);
            const token = tokenBalances.find((t: any) => t.tokenAddress === state.currentToken);
            
            if (!token) {
              await ctx.reply('❌ Token not found');
              return;
            }

            txHash = await transferService.transferSPLToken(
              keypair,
              address,
              state.currentToken,
              amount,
              token.decimals,
              dbUserId,
              null,
              token.symbol
            );
          }

          const explorer = 'https://solscan.io/tx/';
          await ctx.reply(
            `✅ *Withdrawal Successful!*\n\n` +
            `💰 Amount: ${amount} ${state.withdrawType === 'sol' ? 'SOL' : (state.currentToken ? 'tokens' : 'SOL')}\n` +
            `📍 To: \`${address}\`\n` +
            `📝 TX: \`${txHash.substring(0, 20)}...\`\n\n` +
            `🔗 [View on Solscan](${explorer}${txHash})`,
            { parse_mode: 'Markdown', link_preview_options: { is_disabled: true }, reply_markup: getMainMenu() }
          );
        } else {
          await ctx.reply(`⚠️ Multi-chain withdrawals for ${chain} not yet fully implemented.`);
        }
      } catch (error: any) {
        console.error('Withdraw error:', error);
        await ctx.reply(`❌ Withdrawal failed: ${error.message}`, { reply_markup: getMainMenu() });
      }
      return;
    }
  });

  // ==================== PIN VERIFICATION HANDLERS ====================
  
  // Set PIN command
  bot.command('setpin', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const userResult = await query(`SELECT id FROM users WHERE telegram_id = $1`, [userId]);
    if (userResult.rows.length === 0) {
      await ctx.reply('Please use /start first.');
      return;
    }

    const dbUserId = userResult.rows[0].id;
    const state = userStates.get(userId) || {};

    userStates.set(userId, {
      ...state,
      awaitingNewPin: true,
      newPinInput: ''
    });

    await ctx.reply(
      `🔐 *Set Your PIN for Withdrawals*\n\n` +
      `Choose a 4-6 digit PIN to protect your withdrawals.\n\n` +
      `_Your PIN is encrypted and stored securely._`,
      {
        parse_mode: 'Markdown',
        reply_markup: getPinEntryKeyboard(0)
      }
    );
  });

  // PIN number entry handlers
  for (let i = 0; i <= 9; i++) {
    bot.callbackQuery(`pin_${i}`, async (ctx) => {
      const userId = ctx.from?.id;
      if (!userId) return;

      const state = userStates.get(userId) || {};
      if (!state.awaitingNewPin && !state.awaitingPin) {
        await ctx.answerCallbackQuery('❌ Not in PIN entry mode');
        return;
      }

      const currentPin = state.awaitingNewPin ? (state.newPinInput || '') : (state.pinInput || '');
      if (currentPin.length >= 6) {
        await ctx.answerCallbackQuery('⚠️ PIN is already 6 digits');
        return;
      }

      const newPin = currentPin + i.toString();
      
      if (state.awaitingNewPin) {
        state.newPinInput = newPin;
      } else {
        state.pinInput = newPin;
      }

      userStates.set(userId, state);
      
      const keyboard = state.awaitingNewPin 
        ? getPinEntryKeyboard(newPin.length)
        : getPinDisplayKeyboard(newPin.length);

      await ctx.editMessageReplyMarkup({ reply_markup: keyboard });
      await ctx.answerCallbackQuery();
    });
  }

  // PIN delete handler
  bot.callbackQuery('pin_delete', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const state = userStates.get(userId) || {};
    if (!state.awaitingNewPin && !state.awaitingPin) {
      await ctx.answerCallbackQuery('❌ Not in PIN entry mode');
      return;
    }

    if (state.awaitingNewPin) {
      state.newPinInput = (state.newPinInput || '').slice(0, -1);
    } else {
      state.pinInput = (state.pinInput || '').slice(0, -1);
    }

    userStates.set(userId, state);
    
    const pinLength = state.awaitingNewPin 
      ? (state.newPinInput || '').length 
      : (state.pinInput || '').length;
    const keyboard = state.awaitingNewPin 
      ? getPinEntryKeyboard(pinLength)
      : getPinDisplayKeyboard(pinLength);

    await ctx.editMessageReplyMarkup({ reply_markup: keyboard });
    await ctx.answerCallbackQuery('⬅️ Deleted');
  });

  // PIN confirm handler
  bot.callbackQuery('pin_confirm', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const state = userStates.get(userId) || {};
    
    try {
      const userResult = await query(`SELECT id FROM users WHERE telegram_id = $1`, [userId]);
      if (userResult.rows.length === 0) {
        await ctx.reply('Please use /start first.');
        return;
      }

      const dbUserId = userResult.rows[0].id;

      // Setting new PIN
      if (state.awaitingNewPin) {
        const pin = state.newPinInput || '';
        
        if (pin.length < 4 || pin.length > 6) {
          await ctx.answerCallbackQuery(`⚠️ PIN must be 4-6 digits (current: ${pin.length})`);
          return;
        }

        await PinService.setPin(dbUserId, pin);
        
        userStates.delete(userId);
        await ctx.editMessageText(
          `✅ *PIN Set Successfully!*\n\n` +
          `Your PIN is now enabled for all withdrawals.`,
          {
            parse_mode: 'Markdown',
            reply_markup: getMainMenu()
          }
        );
        await ctx.answerCallbackQuery('✅ PIN saved!');
        return;
      }

      // Verifying PIN for withdrawal
      if (state.awaitingPin) {
        const pin = state.pinInput || '';
        
        if (pin.length < 4 || pin.length > 6) {
          await ctx.answerCallbackQuery(`⚠️ PIN must be 4-6 digits (current: ${pin.length})`);
          return;
        }

        const isValid = await PinService.verifyPin(dbUserId, pin);
        
        if (!isValid) {
          state.pinInput = '';
          userStates.set(userId, state);
          
          const keyboard = getPinDisplayKeyboard(0);
          await ctx.editMessageReplyMarkup({ reply_markup: keyboard });
          await ctx.answerCallbackQuery('❌ Wrong PIN! Try again');
          return;
        }

        // PIN verified - process withdrawal
        if (!state.pendingWithdrawal) {
          await ctx.reply('❌ Withdrawal data not found. Please try again.');
          userStates.delete(userId);
          return;
        }

        const withdrawal = state.pendingWithdrawal;
        userStates.delete(userId);

        // Process the withdrawal here
        await ctx.editMessageText(
          `✅ *PIN Verified!*\n\n🔄 Processing your ${withdrawal.type === 'sol' ? 'SOL' : 'token'} withdrawal...`,
          { parse_mode: 'Markdown' }
        );

        // TODO: Execute actual withdrawal logic
        setTimeout(async () => {
          await ctx.reply(
            `✅ *Withdrawal Submitted!*\n\n` +
            `Amount: ${withdrawal.amount}\n` +
            `To: \`${withdrawal.address}\`\n\n` +
            `Your transaction is being processed.`,
            { parse_mode: 'Markdown', reply_markup: getMainMenu() }
          );
        }, 1000);

        await ctx.answerCallbackQuery('✅ PIN verified!');
      }
    } catch (error: any) {
      console.error('PIN confirm error:', error);
      await ctx.answerCallbackQuery(`❌ ${error.message}`);
    }
  });

  // PIN cancel handler
  bot.callbackQuery('pin_cancel', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const state = userStates.get(userId) || {};
    
    if (state.awaitingNewPin) {
      userStates.delete(userId);
      await ctx.editMessageText(
        `❌ PIN setup cancelled.`,
        { parse_mode: 'Markdown', reply_markup: getMainMenu() }
      );
    } else if (state.awaitingPin) {
      userStates.delete(userId);
      await ctx.editMessageText(
        `❌ Withdrawal cancelled.`,
        { parse_mode: 'Markdown', reply_markup: getMainMenu() }
      );
    }

    await ctx.answerCallbackQuery();
  });

  // Swap confirmation handler (Buy & Sell)
  // Flow: Check balance → Show confirmation → Transfer fee → Execute swap
  bot.callbackQuery('confirm_swap_buy', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    await ctx.answerCallbackQuery();
    const state = userStates.get(userId);
    const swap = state?.pendingSwap;

    if (!swap) {
      await ctx.reply('❌ Swap session expired. Please try again.');
      return;
    }

    try {
      const userResult = await query(`SELECT id FROM users WHERE telegram_id = $1`, [userId]);
      const dbUserId = userResult.rows[0].id;
      
      const walletResult = await query(
        `SELECT id FROM wallets WHERE id = $1 AND user_id = $2`,
        [swap.walletId, dbUserId]
      );

      if (walletResult.rows.length === 0) {
        await ctx.reply('❌ Wallet not found.');
        userStates.delete(userId);
        return;
      }

      const keypair = await walletManager.getKeypair(swap.walletId);
      const feeWallet = feeService.getFeeWallet();

      // ✅ STEP 1: Check balance (already done at confirmation, but verify again)
      const multiChainWallet = new MultiChainWalletService();
      const nativeBalance = parseFloat(await multiChainWallet.getBalance(dbUserId, 'solana'));
      const totalNeeded = swap.amount + swap.feeAmount;

      if (nativeBalance < totalNeeded) {
        await ctx.editMessageText(
          `❌ *Insufficient Balance*\n\n` +
          `Your balance changed. You need ${totalNeeded.toFixed(6)} SOL but have ${nativeBalance.toFixed(6)} SOL`,
          { parse_mode: 'Markdown', reply_markup: getMainMenu() }
        );
        userStates.delete(userId);
        return;
      }

      // ✅ STEP 2: Show "Swapping" status
      await ctx.editMessageText(
        `🔄 *Processing Swap*\n\n⏳ Swapping tokens...`,
        { parse_mode: 'Markdown' }
      );

      // ✅ STEP 3: Transfer fee to fee wallet (MUST succeed before swap)
      if (feeWallet && swap.feeAmount > 0) {
        try {
          await walletManager.transferSOL(
            keypair,
            feeWallet,
            swap.feeAmount
          );
          console.log(`✅ Fee transferred: ${swap.feeAmount.toFixed(6)} SOL`);
        } catch (feeError: any) {
          console.error(`❌ Fee transfer failed:`, feeError);
          throw new Error(`Fee transfer failed: ${feeError?.message || feeError}`);
        }
      }

      // ✅ STEP 4: Get FRESH quote right before swap (prevents stale quote errors)
      const settings = await userSettingsService.getSettings(dbUserId);
      const connection = (walletManager as any).getConnection();
      const jupiterService = new JupiterService(connection);
      const inputMint = swap.inputMint || NATIVE_SOL_MINT;
      const outputMint = swap.outputMint || '';
      const amountInLamports = Math.floor(swap.swapAmount * LAMPORTS_PER_SOL);
      
      console.log(`🔄 Getting fresh quote before swap execution...`);
      let freshQuote;
      try {
        freshQuote = await jupiterService.getQuote(
          inputMint,
          outputMint,
          amountInLamports,
          settings.slippageBps
        );
        console.log(`✅ Fresh quote obtained: ${freshQuote.outAmount} output`);
      } catch (quoteError: any) {
        console.error(`❌ Failed to get fresh quote:`, quoteError);
        throw new Error(`Failed to get swap quote: ${quoteError?.message || quoteError}`);
      }

      // ✅ STEP 5: Execute swap with fresh quote
      let swapSignature: string;
      try {
        swapSignature = await jupiterService.executeSwap(keypair, freshQuote);
      } catch (swapError: any) {
        console.error(`❌ Swap execution failed:`, swapError);
        throw new Error(`Swap execution failed: ${swapError?.message || swapError}`);
      }

      console.log(`✅ Swap successful: ${swapSignature}`);

      // Record transaction
      let transactionId: number | null = null;
      try {
        transactionId = await query(
          `INSERT INTO transactions (wallet_id, from_token, to_token, amount, swap_amount, status, transaction_type, signature)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING id`,
          [swap.walletId, swap.inputMint, swap.outputMint, swap.amount, swap.swapAmount, 'success', 'swap', swapSignature]
        ).then((res: any) => res.rows[0]?.id || null);
      } catch (recordError: any) {
        console.error('Transaction recording failed:', recordError);
      }

      // Record fee
      try {
        await feeService.recordFee(transactionId, dbUserId, swap.feeAmount, 'trading', swap.inputMint);
      } catch (feeRecordError: any) {
        console.error('Fee recording failed:', feeRecordError);
      }

      // Record referral reward
      if (transactionId) {
        await referralService.recordReferralReward(transactionId, dbUserId, swap.feeAmount);
      }

      const adapter = new MultiChainWalletService().getChainManager().getAdapter('solana');
      const explorerUrl = adapter.getExplorerUrl(swapSignature);

      // ✅ STEP 6: Show success with token info
      let successMessage = `✅ *Swap Successful!*\n\n` +
        `💰 You spent: ${swap.amount} ${swap.nativeSymbol || 'SOL'}\n` +
        `📝 TX: \`${swapSignature.substring(0, 20)}...\`\n\n` +
        `🔗 [View on Solscan](${explorerUrl})\n\n` +
        `✨ Your token will appear in portfolio shortly.`;
      
      await ctx.editMessageText(
        successMessage,
        { parse_mode: 'Markdown', link_preview_options: { is_disabled: true }, reply_markup: getMainMenu() }
      );

      userStates.delete(userId);
    } catch (error: any) {
      console.error('Swap confirmation error:', error);
      await ctx.editMessageText(
        `❌ *Swap Failed*\n\n` +
        `Error: ${error.message}\n\n` +
        `Please check your balance and try again.`,
        { parse_mode: 'Markdown', reply_markup: getMainMenu() }
      );
      userStates.delete(userId);
    }
  });

  // Custom amount swap confirmation handler
  bot.callbackQuery('confirm_swap_buy_custom', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    await ctx.answerCallbackQuery();
    const state = userStates.get(userId);
    const swap = state?.pendingSwap;

    if (!swap) {
      await ctx.reply('❌ Swap session expired. Please try again.');
      return;
    }

    try {
      const userResult = await query(`SELECT id FROM users WHERE telegram_id = $1`, [userId]);
      const dbUserId = userResult.rows[0].id;
      
      const walletResult = await query(
        `SELECT id FROM wallets WHERE id = $1 AND user_id = $2`,
        [swap.walletId, dbUserId]
      );

      if (walletResult.rows.length === 0) {
        await ctx.reply('❌ Wallet not found.');
        userStates.delete(userId);
        return;
      }

      const keypair = await walletManager.getKeypair(swap.walletId);
      const feeWallet = feeService.getFeeWallet();

      // ✅ STEP 1: Check balance (already done at confirmation, but verify again)
      const multiChainWallet = new MultiChainWalletService();
      const chain = (swap.chain || 'solana') as ChainType;
      const nativeBalance = parseFloat(await multiChainWallet.getBalance(dbUserId, chain));
      const nativeSymbol = multiChainWallet.getChainManager().getAdapter(chain).getNativeToken().symbol;
      const totalNeeded = swap.amount + swap.feeAmount;

      if (nativeBalance < totalNeeded) {
        await ctx.reply(
          `❌ *Insufficient Balance*\n\n` +
          `Your balance changed. You need ${totalNeeded.toFixed(6)} ${nativeSymbol} but have ${nativeBalance.toFixed(6)} ${nativeSymbol}`,
          { parse_mode: 'Markdown', reply_markup: getMainMenu() }
        );
        userStates.delete(userId);
        return;
      }

      // ✅ STEP 2: Show "Swapping" status
      await ctx.reply(`🔄 *Processing Swap*\n\n⏳ Swapping tokens...`, { parse_mode: 'Markdown' });

      // ✅ STEP 3: Transfer fee to fee wallet (MUST succeed before swap)
      if (feeWallet && swap.feeAmount > 0) {
        try {
          await walletManager.transferSOL(
            keypair,
            feeWallet,
            swap.feeAmount
          );
          console.log(`✅ Fee transferred: ${swap.feeAmount.toFixed(6)} SOL`);
        } catch (feeError: any) {
          console.error(`❌ Fee transfer failed:`, feeError);
          throw new Error(`Fee transfer failed: ${feeError?.message || feeError}`);
        }
      }

      // ✅ STEP 4: Get FRESH quote right before swap (prevents stale quote errors)
      const settings = await userSettingsService.getSettings(dbUserId);
      const connection = (walletManager as any).getConnection();
      const jupiterService = new JupiterService(connection);
      const tokenAddress = swap.tokenAddress || '';
      const amountInLamports = Math.floor(swap.swapAmount * LAMPORTS_PER_SOL);
      
      console.log(`🔄 Getting fresh quote before swap execution...`);
      let freshQuote;
      try {
        freshQuote = await jupiterService.getQuote(
          NATIVE_SOL_MINT,
          tokenAddress,
          amountInLamports,
          settings.slippageBps
        );
        console.log(`✅ Fresh quote obtained: ${freshQuote.outAmount} output`);
      } catch (quoteError: any) {
        console.error(`❌ Failed to get fresh quote:`, quoteError);
        throw new Error(`Failed to get swap quote: ${quoteError?.message || quoteError}`);
      }

      // ✅ STEP 5: Execute swap with fresh quote
      let swapSignature: string;
      try {
        swapSignature = await jupiterService.executeSwap(keypair, freshQuote);
      } catch (swapError: any) {
        console.error(`❌ Swap execution failed:`, swapError);
        throw new Error(`Swap execution failed: ${swapError?.message || swapError}`);
      }

      console.log(`✅ Swap successful: ${swapSignature}`);

      // Record transaction
      let transactionId: number | null = null;
      try {
        transactionId = await query(
          `INSERT INTO transactions (wallet_id, from_token, to_token, amount, swap_amount, status, transaction_type, signature)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING id`,
          [swap.walletId, NATIVE_SOL_MINT, swap.tokenAddress, swap.amount, swap.swapAmount, 'success', 'swap', swapSignature]
        ).then((res: any) => res.rows[0]?.id || null);
      } catch (recordError: any) {
        console.error('Transaction recording failed:', recordError);
      }

      // Record fee
      try {
        await feeService.recordFee(transactionId, dbUserId, swap.feeAmount, 'trading', NATIVE_SOL_MINT);
      } catch (feeRecordError: any) {
        console.error('Fee recording failed:', feeRecordError);
      }

      // Record referral reward
      if (transactionId) {
        await referralService.recordReferralReward(transactionId, dbUserId, swap.feeAmount);
      }

      const adapter = multiChainWallet.getChainManager().getAdapter(chain);
      const explorerUrl = adapter.getExplorerUrl(swapSignature);

      // ✅ STEP 5: Show success
      await ctx.reply(
        `✅ *Swap Successful!*\n\n` +
        `💰 You bought: ${swap.tokenSymbol || 'TOKEN'}\n` +
        `💵 Spent: ${swap.amount} ${nativeSymbol}\n` +
        `🎯 Received: ${swap.swapAmount.toFixed(6)}\n` +
        `📝 TX: \`${swapSignature.substring(0, 20)}...\`\n\n` +
        `🔗 [View on Solscan](${explorerUrl})`,
        { parse_mode: 'Markdown', link_preview_options: { is_disabled: true }, reply_markup: getMainMenu() }
      );

      userStates.delete(userId);
    } catch (error: any) {
      console.error('Custom swap confirmation error:', error);
      await ctx.reply(
        `❌ *Swap Failed*\n\n` +
        `Error: ${error.message}\n\n` +
        `Please check your balance and try again.`,
        { parse_mode: 'Markdown', reply_markup: getMainMenu() }
      );
      userStates.delete(userId);
    }
  });

  // Sell confirmation handler
  bot.callbackQuery('confirm_sell_custom', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    await ctx.answerCallbackQuery();
    const state = userStates.get(userId);
    const sell = state?.pendingSell;

    if (!sell) {
      await ctx.reply('❌ Sale session expired. Please try again.');
      return;
    }

    try {
      const userResult = await query(`SELECT id FROM users WHERE telegram_id = $1`, [userId]);
      const dbUserId = userResult.rows[0].id;
      
      const walletResult = await query(
        `SELECT id, public_key FROM wallets WHERE id = $1 AND user_id = $2`,
        [sell.walletId, dbUserId]
      );

      if (walletResult.rows.length === 0) {
        await ctx.reply('❌ Wallet not found.');
        userStates.delete(userId);
        return;
      }

      const wallet = walletResult.rows[0];
      const keypair = await walletManager.getKeypair(sell.walletId);
      const feeWallet = feeService.getFeeWallet();
      const adapter = new MultiChainWalletService().getChainManager().getAdapter(sell.chain);
      const nativeSymbol = adapter.getNativeToken().symbol;

      // ✅ STEP 1: Show processing status
      await ctx.reply(`🔄 *Processing Sale*\n\n⏳ Converting to ${nativeSymbol}...`, { parse_mode: 'Markdown' });

      if (sell.chain === 'solana') {
        const settings = await userSettingsService.getSettings(dbUserId);
        const tokenAmountLamports = Math.floor(sell.sellAmount * Math.pow(10, sell.token.decimals));

        // Get quote first to know the SOL output
        const connection = (walletManager as any).getConnection();
        const jupiterService = new JupiterService(connection);
        
        // Get quote to estimate SOL output
        let estimatedSolOutput = sell.sellAmount; // fallback estimate
        try {
          const jupiterQuote = await jupiterService.getQuote(
            sell.tokenMint,
            NATIVE_SOL_MINT,
            tokenAmountLamports,
            settings.slippageBps
          );
          const outAmount = typeof jupiterQuote.outAmount === 'string' 
            ? parseInt(jupiterQuote.outAmount) 
            : jupiterQuote.outAmount;
          estimatedSolOutput = outAmount / LAMPORTS_PER_SOL;
        } catch (quoteError: any) {
          console.warn('Could not get quote, using estimate:', quoteError.message);
        }

        // Calculate fee as 0.5% of SOL output
        const feeAmount = estimatedSolOutput * 0.005; // 0.5% of SOL output

        // ✅ STEP 2: Transfer fee FIRST (MUST succeed before swap)
        if (feeWallet && feeAmount > 0) {
          try {
            await walletManager.transferSOL(keypair, feeWallet, feeAmount);
            console.log(`✅ Fee transferred: ${feeAmount.toFixed(6)} SOL`);
          } catch (feeError: any) {
            console.error(`❌ Fee transfer failed:`, feeError);
            throw new Error(`Fee transfer failed: ${feeError?.message || feeError}`);
          }
        }

        // ✅ STEP 3: Execute swap
        const swapResult = await feeAwareSwapService.swapWithFeeDeduction(
          keypair,
          sell.tokenMint,
          NATIVE_SOL_MINT,
          tokenAmountLamports,
          settings.slippageBps,
          dbUserId,
          sell.walletId
        );

        // Recalculate actual fee from actual output
        const actualFeeAmount = swapResult.swapAmount * 0.005; // 0.5% of actual SOL output
        const actualSolReceived = swapResult.swapAmount - actualFeeAmount;

        console.log(`✅ Sell successful: ${swapResult.signature}`);

        // Record transaction
        let transactionId: number | null = null;
        try {
          transactionId = await query(
            `INSERT INTO transactions (wallet_id, from_token, to_token, amount, swap_amount, status, transaction_type, signature)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING id`,
            [sell.walletId, sell.tokenMint, NATIVE_SOL_MINT, sell.sellAmount, swapResult.swapAmount, 'success', 'swap', swapResult.signature]
          ).then((res: any) => res.rows[0]?.id || null);
        } catch (recordError: any) {
          console.error('Transaction recording failed:', recordError);
        }

        // Record fee
        try {
          await feeService.recordFee(transactionId, dbUserId, actualFeeAmount, 'trading', sell.tokenMint);
        } catch (feeRecordError: any) {
          console.error('Fee recording failed:', feeRecordError);
        }

        // Record referral reward
        if (transactionId) {
          await referralService.recordReferralReward(transactionId, dbUserId, actualFeeAmount);
        }

        const explorerUrl = adapter.getExplorerUrl(swapResult.signature);

        // ✅ STEP 4: Show success
        await ctx.reply(
          `✅ *Sale Successful!*\n\n` +
          `💰 You sold: ${sell.sellAmount} ${sell.tokenSymbol}\n` +
          `💵 Platform fee (0.5%): ${actualFeeAmount.toFixed(6)} ${nativeSymbol}\n` +
          `📈 Received: ${actualSolReceived.toFixed(6)} ${nativeSymbol}\n` +
          `📝 TX: \`${swapResult.signature.substring(0, 20)}...\`\n\n` +
          `🔗 [View on Solscan](${explorerUrl})`,
          { parse_mode: 'Markdown', link_preview_options: { is_disabled: true }, reply_markup: getMainMenu() }
        );

        userStates.delete(userId);
      } else {
        await ctx.reply(`⚠️ Multi-chain token sales for ${sell.chain} not yet fully implemented.`);
        userStates.delete(userId);
      }
    } catch (error: any) {
      console.error('Sell confirmation error:', error);
      await ctx.reply(
        `❌ *Sale Failed*\n\n` +
        `Error: ${error.message}\n\n` +
        `Please check your balance and try again.`,
        { parse_mode: 'Markdown', reply_markup: getMainMenu() }
      );
      userStates.delete(userId);
    }
  });

  // P2P Transfer confirmation handler
  bot.callbackQuery('confirm_p2p_transfer', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    await ctx.answerCallbackQuery();
    const state = userStates.get(userId);
    const transfer = state?.pendingTransfer;

    if (!transfer) {
      await ctx.reply('❌ Transfer session expired. Please try again.');
      return;
    }

    try {
      const userResult = await query(`SELECT id FROM users WHERE telegram_id = $1`, [userId]);
      const dbUserId = userResult.rows[0].id;
      
      const walletResult = await query(
        `SELECT id FROM wallets WHERE id = $1 AND user_id = $2`,
        [transfer.walletId, dbUserId]
      );

      if (walletResult.rows.length === 0) {
        await ctx.reply('❌ Wallet not found.');
        userStates.delete(userId);
        return;
      }

      const keypair = await walletManager.getKeypair(transfer.walletId);
      const feeWallet = feeService.getFeeWallet();
      const chainName = transfer.chain === 'ethereum' ? 'Ethereum' : transfer.chain === 'bsc' ? 'BSC' : 'Solana';
      const nativeSymbol = transfer.chain === 'ethereum' ? 'ETH' : transfer.chain === 'bsc' ? 'BNB' : 'SOL';

      // ✅ STEP 1: Show "Processing" status
      await ctx.reply(`🔄 *Processing Transfer*\n\n⏳ Transferring ${transfer.tokenSymbol}...`, { parse_mode: 'Markdown' });

      // ✅ STEP 2: Transfer fee to fee wallet FIRST (MUST succeed before main transfer)
      if (feeWallet && transfer.feeAmount > 0 && transfer.chain === 'solana') {
        try {
          await walletManager.transferSOL(
            keypair,
            feeWallet,
            transfer.feeAmount
          );
          console.log(`✅ Fee transferred: ${transfer.feeAmount.toFixed(6)} SOL`);
        } catch (feeError: any) {
          console.error(`❌ Fee transfer failed:`, feeError);
          throw new Error(`Fee transfer failed: ${feeError?.message || feeError}`);
        }
      }

      // ✅ STEP 3: Execute transfer
      let txHash = '';
      try {
        const solanaConnection = (walletManager as any).connection || require('@solana/web3.js').Connection;
        const transferService = new TransferService(solanaConnection);
        
        if (transfer.chain === 'solana') {
          txHash = await transferService.transferSOL(keypair, transfer.recipientAddress, transfer.amount, dbUserId, null, transfer.feeAmount);
        } else if (transfer.chain === 'ethereum') {
          const encryptedPrivateKey = await query(`SELECT encrypted_private_key FROM wallets WHERE id = $1`, [transfer.walletId]);
          if (encryptedPrivateKey.rows.length === 0) throw new Error('Wallet not found');
          const { decrypt } = await import('../utils/encryption');
          const privateKey = decrypt(encryptedPrivateKey.rows[0].encrypted_private_key, process.env.ENCRYPTION_KEY || '');
          txHash = await transferService.transferETH(privateKey, transfer.recipientAddress, transfer.amount, dbUserId, null, transfer.feeAmount);
        } else if (transfer.chain === 'bsc') {
          const encryptedPrivateKey = await query(`SELECT encrypted_private_key FROM wallets WHERE id = $1`, [transfer.walletId]);
          if (encryptedPrivateKey.rows.length === 0) throw new Error('Wallet not found');
          const { decrypt } = await import('../utils/encryption');
          const privateKey = decrypt(encryptedPrivateKey.rows[0].encrypted_private_key, process.env.ENCRYPTION_KEY || '');
          txHash = await transferService.transferBNB(privateKey, transfer.recipientAddress, transfer.amount, dbUserId, null, transfer.feeAmount);
        }

        // Record fee
        try {
          await feeService.recordFee(0, dbUserId, transfer.feeAmount, 'transfer', nativeSymbol);
        } catch (feeRecordError: any) {
          console.error('Fee recording failed:', feeRecordError);
        }

        const solanaNetwork = process.env.SOLANA_NETWORK || 'mainnet-beta';
        let explorerUrl = '';
        if (transfer.chain === 'ethereum') {
          explorerUrl = `https://etherscan.io/tx/${txHash}`;
        } else if (transfer.chain === 'bsc') {
          explorerUrl = `https://bscscan.com/tx/${txHash}`;
        } else {
          explorerUrl = `https://solscan.io/tx/${txHash}?cluster=${solanaNetwork}`;
        }

        // ✅ STEP 4: Show success
        await ctx.reply(
          `✅ *Transfer Successful!*\n\n` +
          `💸 Amount: ${transfer.amount} ${transfer.tokenSymbol}\n` +
          `💵 Platform fee (1%): ${transfer.feeAmount.toFixed(6)} ${nativeSymbol}\n` +
          `📍 To: \`${transfer.recipientAddress}\`\n` +
          `📝 Hash: \`${txHash.substring(0, 20)}...\`\n\n` +
          `🔗 [View on Explorer](${explorerUrl})`,
          { parse_mode: 'Markdown', link_preview_options: { is_disabled: true }, reply_markup: getMainMenu() }
        );

        userStates.delete(userId);
      } catch (error: any) {
        console.error('Transfer execution error:', error);
        await ctx.reply(`❌ Transfer failed: ${error.message}\n\nPlease try again or contact support.`, { reply_markup: getMainMenu() });
        userStates.delete(userId);
      }
    } catch (error: any) {
      console.error('P2P transfer confirmation error:', error);
      await ctx.reply(
        `❌ *Transfer Failed*\n\n` +
        `Error: ${error.message}\n\n` +
        `Please check your balance and try again.`,
        { parse_mode: 'Markdown', reply_markup: getMainMenu() }
      );
      userStates.delete(userId);
    }
  });

  // Limit Order Creation - Buy
  bot.callbackQuery('create_limit_buy', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    await ctx.answerCallbackQuery();
    const state = userStates.get(userId);
    
    if (!state?.currentToken || !state?.currentChain) {
      await ctx.reply('❌ Token information not found. Please search for a token again.');
      return;
    }

    // Ask for amount first
    const chainName = state.currentChain === 'ethereum' ? 'Ethereum' : state.currentChain === 'bsc' ? 'BSC' : 'Solana';
    const nativeSymbol = state.currentChain === 'ethereum' ? 'ETH' : state.currentChain === 'bsc' ? 'BNB' : 'SOL';

    await ctx.reply(
      `⏰ *Create Buy Limit Order*\n\n` +
      `📊 Token: ${state.currentTokenInfo?.symbol || 'TOKEN'}\n` +
      `🔗 Chain: ${chainName}\n\n` +
      `Current Price: $${parseFloat(state.currentTokenInfo?.priceUsd || '0').toFixed(6)}\n\n` +
      `Step 1: Enter the amount of ${nativeSymbol} to spend:\n\n` +
      `*Example:* \`1.0\` or \`5.25\``,
      { parse_mode: 'Markdown' }
    );

    userStates.set(userId, {
      ...state,
      limitOrderType: 'buy',
      awaitingLimitPrice: true
    });
  });

  // Limit Order Creation - Sell (show owned tokens)
  bot.callbackQuery('create_limit_sell', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    await ctx.answerCallbackQuery();
    const state = userStates.get(userId) || {};
    const chain = state.currentChain || 'solana';
    const chainName = chain === 'ethereum' ? 'Ethereum' : chain === 'bsc' ? 'BSC' : 'Solana';

    try {
      const userResult = await query(`SELECT id FROM users WHERE telegram_id = $1`, [userId]);
      if (!userResult.rows[0]) {
        await ctx.reply('❌ User not found.');
        return;
      }

      const dbUserId = userResult.rows[0].id;
      const multiChainWallet = new MultiChainWalletService();
      const wallet = await multiChainWallet.getWallet(dbUserId, chain as ChainType);

      if (!wallet) {
        await ctx.reply(`❌ No ${chain} wallet found.`);
        return;
      }

      const portfolio = await walletManager.getPortfolio(wallet.publicKey);
      const tokens = portfolio.tokens || [];

      if (tokens.length === 0) {
        await ctx.reply(`❌ You have no tokens to sell on ${chainName}.`);
        return;
      }

      const keyboard = new InlineKeyboard();
      for (const token of tokens.slice(0, 10)) {
        const tokenInfo = await tokenInfoService.getTokenInfo(token.mint, chain as ChainType);
        const symbol = tokenInfo?.symbol || token.mint.slice(0, 8);
        const balance = token.balance.toFixed(2);
        keyboard.text(`${symbol} (${balance})`, `select_sell_token_${token.mint}`).row();
      }

      keyboard.text('❌ Cancel', 'menu_main');

      await ctx.reply(
        `⏰ *Create Sell Limit Order* (${chainName})\n\n` +
        `Step 1: Select a token to sell:\n`,
        { parse_mode: 'Markdown', reply_markup: keyboard }
      );

      userStates.set(userId, {
        ...state,
        limitOrderType: 'sell',
        currentChain: chain as ChainType
      });
    } catch (error: any) {
      console.error('Error loading portfolio:', error);
      await ctx.reply('❌ Error loading your portfolio.');
    }
  });

  // Handle sell token selection
  bot.callbackQuery(/^select_sell_token_/, async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const tokenMint = ctx.callbackQuery.data.replace('select_sell_token_', '');
    await ctx.answerCallbackQuery();
    const state = userStates.get(userId) || {};
    const chain = state.currentChain || 'solana';

    try {
      const tokenInfo = await tokenInfoService.getTokenInfo(tokenMint, chain as ChainType);
      if (!tokenInfo) {
        await ctx.reply('❌ Token not found.');
        return;
      }

      const symbol = tokenInfo.symbol || 'TOKEN';
      await ctx.reply(
        `⏰ *Sell Limit Order - Amount*\n\n` +
        `📊 Token: ${symbol}\n\n` +
        `Step 2: Enter the amount of ${symbol} to sell:\n\n` +
        `*Example:* \`100\` or \`1000.50\``,
        { parse_mode: 'Markdown' }
      );

      userStates.set(userId, {
        ...state,
        limitOrderType: 'sell',
        currentToken: tokenMint,
        currentTokenInfo: tokenInfo,
        currentChain: chain as ChainType,
        awaitingLimitPrice: 'sell_amount' as any
      });
    } catch (error: any) {
      console.error('Token info error:', error);
      await ctx.reply('❌ Error fetching token info.');
    }
  });

  // Limit Order Confirmation
  bot.callbackQuery('confirm_limit_order', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    await ctx.answerCallbackQuery();
    const state = userStates.get(userId);
    const limitOrder = state?.pendingLimitOrder;

    if (!limitOrder) {
      await ctx.reply('❌ Order session expired. Please try again.');
      return;
    }

    try {
      const userResult = await query(`SELECT id FROM users WHERE telegram_id = $1`, [userId]);
      const dbUserId = userResult.rows[0].id;

      // Create limit order in database
      // For BUY orders: to_token is what we're buying
      // For SELL orders: from_token is what we're selling
      const isBuy = limitOrder.type === 'buy';
      const orderResult = await query(
        `INSERT INTO orders (user_id, wallet_id, ${isBuy ? 'to_token' : 'from_token'}, order_type, amount, target_price, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
         RETURNING id`,
        [dbUserId, limitOrder.walletId, limitOrder.tokenAddress, limitOrder.type, limitOrder.amount, limitOrder.targetPrice, 'active']
      );

      const orderId = orderResult.rows[0].id;
      const nativeSymbol = limitOrder.chain === 'ethereum' ? 'ETH' : limitOrder.chain === 'bsc' ? 'BNB' : 'SOL';

      await ctx.reply(
        `✅ *Limit Order Created!*\n\n` +
        `📌 Order ID: ${orderId}\n` +
        `📊 Type: Buy ${limitOrder.tokenSymbol}\n` +
        `💰 Amount: ${limitOrder.amount} ${nativeSymbol}\n` +
        `🎯 Target Price: $${limitOrder.targetPrice.toFixed(6)}\n` +
        `💵 Fee: ${limitOrder.feeAmount.toFixed(6)} ${nativeSymbol}\n\n` +
        `⏰ Status: Active\n` +
        `The order will execute automatically when the target price is reached.`,
        { parse_mode: 'Markdown', reply_markup: getMainMenu() }
      );

      userStates.delete(userId);
    } catch (error: any) {
      console.error('Limit order confirmation error:', error);
      await ctx.reply(
        `❌ *Failed to Create Order*\n\n` +
        `Error: ${error.message}\n\n` +
        `Please try again.`,
        { parse_mode: 'Markdown', reply_markup: getMainMenu() }
      );
      userStates.delete(userId);
    }
  });

  console.log('✅ Bot commands and callbacks registered');
}
