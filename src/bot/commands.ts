import { Bot, Context, InlineKeyboard } from 'grammy';
import { WalletManager } from '../wallet/walletManager';
import { JupiterService, NATIVE_SOL_MINT, USDC_MINT } from '../services/jupiter';
import { CoinGeckoService } from '../services/coingecko';
import { query } from '../database/db';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';

export function registerCommands(
  bot: Bot,
  walletManager: WalletManager,
  jupiterService: JupiterService,
  coinGeckoService: CoinGeckoService
) {
  
  bot.command('start', async (ctx) => {
    const userId = ctx.from?.id;
    const username = ctx.from?.username;
    const firstName = ctx.from?.first_name;
    const lastName = ctx.from?.last_name;

    if (!userId) return;

    await query(
      `INSERT INTO users (telegram_id, username, first_name, last_name)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (telegram_id) DO UPDATE SET username = $2, first_name = $3, last_name = $4`,
      [userId, username, firstName, lastName]
    );

    await ctx.reply(
      `🤖 *Welcome to Zinobot!*\n\n` +
      `Your Solana trading assistant on Telegram.\n\n` +
      `*Available Commands:*\n` +
      `/create_wallet - Create a new Solana wallet\n` +
      `/wallet - View your wallet address\n` +
      `/portfolio - Check your token balances\n` +
      `/buy <token_mint> <sol_amount> - Buy tokens\n` +
      `/sell <token_mint> <token_amount> - Sell tokens\n` +
      `/history - View recent transactions\n` +
      `/help - Show all commands\n\n` +
      `⚠️ *Security Note:* Your private keys are encrypted with AES-256.\n` +
      `Currently running on *${process.env.SOLANA_NETWORK || 'devnet'}*.`,
      { parse_mode: 'Markdown' }
    );
  });

  bot.command('help', async (ctx) => {
    await ctx.reply(
      `📖 *Zinobot Help*\n\n` +
      `*Wallet Commands:*\n` +
      `/create_wallet - Generate new wallet\n` +
      `/wallet - View wallet address\n` +
      `/portfolio - Check balances\n\n` +
      `*Trading Commands:*\n` +
      `/buy <token_mint> <sol_amount>\n` +
      `Example: /buy ${USDC_MINT} 0.1\n\n` +
      `/sell <token_mint> <token_amount>\n` +
      `Example: /sell ${USDC_MINT} 100\n\n` +
      `*History:*\n` +
      `/history - View your transactions\n\n` +
      `*Common Token Mints (Devnet):*\n` +
      `USDC: \`${USDC_MINT}\`\n` +
      `SOL: \`${NATIVE_SOL_MINT}\`\n\n` +
      `Need test SOL? Visit https://faucet.solana.com/`,
      { parse_mode: 'Markdown' }
    );
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
        `• Never share it with anyone\n` +
        `• You'll need it to recover your wallet\n\n` +
        `💡 Get test SOL: https://faucet.solana.com/`,
        { parse_mode: 'Markdown' }
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
        `Use /portfolio for token balances.`,
        { parse_mode: 'Markdown' }
      );
    } catch (error: any) {
      console.error('Wallet command error:', error);
      await ctx.reply('❌ Error retrieving wallet info.');
    }
  });

  bot.command('portfolio', async (ctx) => {
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
        await ctx.reply('❌ No wallet found. Use /create_wallet first.');
        return;
      }

      await ctx.reply('📊 Loading portfolio...');

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

      message += `Use /buy to purchase tokens.`;

      await ctx.reply(message, { parse_mode: 'Markdown' });
    } catch (error: any) {
      console.error('Portfolio command error:', error);
      await ctx.reply('❌ Error loading portfolio.');
    }
  });

  bot.command('buy', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    try {
      const args = ctx.message?.text?.split(' ').slice(1);
      
      if (!args || args.length < 2) {
        await ctx.reply(
          `❌ Invalid format.\n\n` +
          `Usage: /buy <token_mint> <sol_amount>\n\n` +
          `Example: /buy ${USDC_MINT} 0.1`
        );
        return;
      }

      const [tokenMint, solAmountStr] = args;
      const solAmount = parseFloat(solAmountStr);

      if (isNaN(solAmount) || solAmount <= 0) {
        await ctx.reply('❌ Invalid SOL amount.');
        return;
      }

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
        await ctx.reply('❌ No wallet found. Use /create_wallet first.');
        return;
      }

      await ctx.reply(`🔄 Executing swap: ${solAmount} SOL → Token...\nThis may take a moment...`);

      const keypair = await walletManager.getKeypair(wallet.id);
      const amountLamports = Math.floor(solAmount * LAMPORTS_PER_SOL);

      const signature = await jupiterService.swap(
        keypair,
        NATIVE_SOL_MINT,
        tokenMint,
        amountLamports,
        100
      );

      await query(
        `INSERT INTO transactions (wallet_id, user_id, transaction_type, signature, from_token, to_token, from_amount, status)
         VALUES ($1, $2, 'buy', $3, $4, $5, $6, 'confirmed')`,
        [wallet.id, dbUserId, signature, NATIVE_SOL_MINT, tokenMint, solAmount]
      );

      await ctx.reply(
        `✅ *Swap Successful!*\n\n` +
        `📝 Signature: \`${signature}\`\n\n` +
        `🔗 View on Solscan:\nhttps://solscan.io/tx/${signature}?cluster=${process.env.SOLANA_NETWORK}`,
        { parse_mode: 'Markdown' }
      );
    } catch (error: any) {
      console.error('Buy command error:', error);
      await ctx.reply(`❌ Swap failed: ${error.message}`);
    }
  });

  bot.command('sell', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    try {
      const args = ctx.message?.text?.split(' ').slice(1);
      
      if (!args || args.length < 2) {
        await ctx.reply(
          `❌ Invalid format.\n\n` +
          `Usage: /sell <token_mint> <token_amount>\n\n` +
          `Example: /sell ${USDC_MINT} 100`
        );
        return;
      }

      const [tokenMint, tokenAmountStr] = args;
      const tokenAmount = parseFloat(tokenAmountStr);

      if (isNaN(tokenAmount) || tokenAmount <= 0) {
        await ctx.reply('❌ Invalid token amount.');
        return;
      }

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
        await ctx.reply('❌ No wallet found. Use /create_wallet first.');
        return;
      }

      await ctx.reply(`🔄 Executing swap: ${tokenAmount} Token → SOL...\nThis may take a moment...`);

      const keypair = await walletManager.getKeypair(wallet.id);
      
      const decimals = await jupiterService.getTokenDecimals(tokenMint);
      const amountInSmallestUnit = Math.floor(tokenAmount * Math.pow(10, decimals));

      const signature = await jupiterService.swap(
        keypair,
        tokenMint,
        NATIVE_SOL_MINT,
        amountInSmallestUnit,
        100
      );

      await query(
        `INSERT INTO transactions (wallet_id, user_id, transaction_type, signature, from_token, to_token, from_amount, status)
         VALUES ($1, $2, 'sell', $3, $4, $5, $6, 'confirmed')`,
        [wallet.id, dbUserId, signature, tokenMint, NATIVE_SOL_MINT, tokenAmount]
      );

      await ctx.reply(
        `✅ *Swap Successful!*\n\n` +
        `📝 Signature: \`${signature}\`\n\n` +
        `🔗 View on Solscan:\nhttps://solscan.io/tx/${signature}?cluster=${process.env.SOLANA_NETWORK}`,
        { parse_mode: 'Markdown' }
      );
    } catch (error: any) {
      console.error('Sell command error:', error);
      await ctx.reply(`❌ Swap failed: ${error.message}`);
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
        `SELECT transaction_type, signature, from_amount, status, created_at
         FROM transactions
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT 10`,
        [dbUserId]
      );

      if (transactions.rows.length === 0) {
        await ctx.reply('📭 No transactions yet.');
        return;
      }

      let message = `📜 *Transaction History*\n\n`;

      for (const tx of transactions.rows) {
        const date = new Date(tx.created_at).toLocaleDateString();
        const type = tx.transaction_type.toUpperCase();
        const status = tx.status === 'confirmed' ? '✅' : '⏳';
        
        message += `${status} *${type}* - ${tx.from_amount || 'N/A'}\n`;
        message += `   ${date} | \`${tx.signature?.substring(0, 16)}...\`\n\n`;
      }

      await ctx.reply(message, { parse_mode: 'Markdown' });
    } catch (error: any) {
      console.error('History command error:', error);
      await ctx.reply('❌ Error loading history.');
    }
  });

  console.log('✅ Bot commands registered');
}
