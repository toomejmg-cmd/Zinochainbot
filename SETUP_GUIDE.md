# Zinobot Setup Guide

## 🚀 Quick Start

Your Zinobot is now **running successfully** on Replit!

### Bot Username
**@Zinochainbot** (as shown in the logs)

---

## 📱 How to Use Your Bot

### Step 1: Open Telegram
1. Open the Telegram app on your phone or desktop
2. Search for: **@Zinochainbot**
3. Start a chat with the bot

### Step 2: Initialize the Bot
Send the command:
```
/start
```

This will register you and show all available commands.

### Step 3: Create a Wallet
Send the command:
```
/create_wallet
```

⚠️ **IMPORTANT:** The bot will show you a secret key **ONLY ONCE**. Save it immediately in a secure location!

### Step 4: Get Test SOL (Devnet)
1. Copy your wallet address from the bot
2. Visit: https://faucet.solana.com/
3. Paste your address and request an airdrop
4. You'll receive 1-2 SOL for testing

### Step 5: Check Your Balance
```
/wallet
```
or
```
/portfolio
```

---

## 💱 Trading Commands

### Buy Tokens
Swap SOL for tokens using Jupiter:
```
/buy <token_mint_address> <sol_amount>
```

**Example - Buy USDC with 0.1 SOL:**
```
/buy EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v 0.1
```

The bot automatically converts SOL to the smallest unit (lamports) before executing the swap.

### Sell Tokens
Swap tokens back to SOL:
```
/sell <token_mint_address> <token_amount>
```

**Example - Sell 100 USDC:**
```
/sell EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v 100
```

The bot automatically fetches the token's decimal places and converts your amount to the smallest unit (e.g., USDC uses 6 decimals, so 100 USDC = 100,000,000 base units).

### View Transaction History
```
/history
```

---

## 🪙 Common Token Addresses (Devnet)

Copy and paste these addresses for testing:

**USDC (Devnet):**
```
EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
```

**USDT (Devnet):**
```
Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB
```

**SOL (Native):**
```
So11111111111111111111111111111111111111112
```

---

## 🔐 Security Features

✅ **AES-256 Encryption** - All private keys are encrypted before database storage
✅ **Non-custodial** - You control your private keys
✅ **Secret Management** - API keys stored in Replit Secrets
✅ **Devnet by Default** - Safe testing environment

---

## 🛠️ Configuration

### Current Settings
- **Network:** Solana Devnet
- **RPC:** https://api.devnet.solana.com
- **Trading:** Jupiter Aggregator v6
- **Price Data:** CoinGecko API

### Environment Variables (Already Configured)
- ✅ `TELEGRAM_BOT_TOKEN` - Your bot token
- ✅ `ENCRYPTION_KEY` - Wallet encryption key
- ✅ `DATABASE_URL` - PostgreSQL connection
- ✅ `SOLANA_RPC_URL` - Solana RPC endpoint
- ✅ `SOLANA_NETWORK` - Current network (devnet)

---

## 📊 Database

The bot uses PostgreSQL with the following tables:
- **users** - Telegram user data
- **wallets** - Encrypted wallet storage
- **transactions** - Complete trade history
- **token_cache** - Price and metadata cache
- **orders** - For future limit order feature
- **dca_jobs** - For future DCA scheduling

---

## 🚨 Important Warnings

⚠️ **This is running on DEVNET** - Use only test SOL, not real funds
⚠️ **Save your secret key** - It's shown only once when creating a wallet
⚠️ **Never share your ENCRYPTION_KEY** - If lost, wallets cannot be recovered
⚠️ **Educational/Demo Bot** - Use at your own risk

---

## 🔄 Switching to Mainnet (When Ready)

**DO NOT do this unless you understand the risks!**

To switch to mainnet:
1. Update `SOLANA_RPC_URL` to a mainnet RPC
2. Change `SOLANA_NETWORK` to `mainnet-beta`
3. Create new wallets (devnet wallets won't work on mainnet)
4. Use real SOL (be extremely careful!)

---

## 📈 Future Features (Planned)

Coming in the next phase:
- ⏰ Limit orders with price monitoring
- 🔄 DCA (Dollar Cost Averaging) automation
- 📊 Advanced portfolio analytics with P&L
- 🤖 AI-powered trade suggestions (OpenAI)
- 👥 Copy-trading from successful wallets
- 🎯 Token sniping for new listings
- 📢 Price alerts and notifications

---

## 🆘 Troubleshooting

### Bot Not Responding
- Check that the Zinobot workflow is running (green status)
- Restart the workflow if needed
- Check logs for errors

### Transaction Failed
- Ensure you have enough SOL for the swap + fees
- Check if the token mint address is valid
- Try with a smaller amount first
- Verify you're on the correct network (devnet/mainnet)

### Can't Find My Wallet
- Use `/wallet` to see your active wallet
- Only one wallet is active per user
- If you created multiple, the latest one is active

---

## 🧪 Testing Workflow

1. **Create wallet** → Get devnet SOL from faucet
2. **Check balance** → Verify SOL received
3. **Small test swap** → Buy small amount of USDC
4. **Check portfolio** → Verify token received
5. **Swap back** → Sell tokens for SOL
6. **Check history** → View all transactions

---

## 📞 Support

- Check the README.md for general information
- Review code comments for technical details
- All transactions are logged in the database
- Use `/help` in the bot for quick command reference

---

## 🎉 You're All Set!

Your Solana trading bot is ready to use. Start with small test amounts on devnet to familiarize yourself with the commands before considering mainnet use.

**Happy trading!** 🚀
