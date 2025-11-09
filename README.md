# Zinochain Bot - Multi-Chain Trading Bot for Telegram

A comprehensive, production-ready Telegram trading bot supporting Solana, Ethereum, and BSC blockchains, featuring non-custodial wallet management, token swaps via Jupiter and 1inch, admin controls, fee collection, and referral system.

**Bot Status**: ✅ Running as @Zinochainbot  
**Network**: Solana Devnet (for testing)  
**Version**: 1.0.0

## ✨ Features

### Core Trading
- 🌐 **Multi-Chain Support**: Trade on Solana, Ethereum, and BSC with seamless chain switching
- 🔐 **Non-Custodial Wallets**: Users control their own wallets with AES-256 encrypted private keys
- 💱 **Token Swaps**: Buy and sell tokens via Jupiter (Solana) and 1inch (ETH/BSC) with optimal routing
- 📊 **Portfolio Tracking**: Real-time cross-chain portfolio with SOL, ETH, BNB, and token balances
- 💰 **Fee Collection**: Automated 0.5% trading fee (configurable by admins)
- 📝 **Transaction History**: Complete audit trail with block explorer links

### User Experience
- 🎮 **Interactive Menus**: Button-based interface for easy navigation
- ⚙️ **Settings**: Customize slippage tolerance, notifications, and auto-approve
- 👥 **Referral System**: Earn rewards by inviting friends to the platform
- 📤 **Withdraw**: Send SOL and tokens to external wallets
- 🔄 **Real-time Updates**: Refresh portfolio and balances on demand

### Admin Panel
- 👑 **Admin Dashboard**: View total users, wallets, transactions, and fees
- 💵 **Fee Management**: Dynamically adjust trading fees
- 🔑 **Admin Control**: Add/remove administrators
- 📊 **Statistics**: Track platform growth and revenue

### Coming Soon
- ⏰ **Limit Orders**: Auto-execute trades at target prices
- 🔄 **DCA Orders**: Schedule recurring token purchases
- 🎯 **Token Sniper**: Auto-buy new listings instantly
- 🔔 **Price Alerts**: Get notified when tokens hit targets
- 🎁 **Rewards Program**: Earn from trading activity

## Quick Start on Replit

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Create a `.env` file based on `.env.example`:

```env
TELEGRAM_BOT_TOKEN=your_bot_token_from_@BotFather
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_NETWORK=devnet
ENCRYPTION_KEY=a_random_32_character_string_here
```

**To get a Telegram Bot Token:**
1. Open Telegram and search for `@BotFather`
2. Send `/newbot` and follow the instructions
3. Copy the token provided

### 3. Initialize Database
```bash
npm run db:init
```

### 4. Start the Bot
```bash
npm run dev
```

## 🎮 User Commands

### For All Users
- `/start` - Show main menu with interactive buttons
- `/create_wallet` - Generate a new Solana wallet
- `/wallet` - View wallet address and balance
- `/history` - View transaction history
- `/applyreferral <code>` - Apply a friend's referral code

### Admin Commands
- `/admin` - Open admin panel with statistics
- `/setfee <percentage>` - Set trading fee (e.g., `/setfee 0.75` for 0.75%)
- `/addadmin <telegram_id>` - Add new administrator
- `/removeadmin <telegram_id>` - Remove administrator

## 🎯 Using the Bot

1. **Start**: Send `/start` to initialize and see the main menu
2. **Create Wallet**: Click "Create Wallet" or use `/create_wallet`
3. **Fund Wallet**: Get devnet SOL from https://faucet.solana.com
4. **Trade**: Use the menu buttons to buy/sell tokens
5. **Track**: View your portfolio and transaction history anytime

## Testing on Devnet

The bot is configured for Solana Devnet by default. To get test SOL:
1. Use `/create_wallet` to generate a wallet
2. Visit https://faucet.solana.com/
3. Enter your wallet address and request airdrop

## Token Mint Addresses (Devnet Examples)

- USDC: `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`
- USDT: `Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB`

## Security Notes

⚠️ **Important Security Information:**
- Private keys are encrypted using AES-256 before database storage
- Never share your ENCRYPTION_KEY
- Never share your wallet's secret/recovery phrase
- Start with Devnet for testing before using Mainnet
- This is a demo/educational bot - use at your own risk

## Architecture

```
Telegram User
    ↓
grammY Bot Framework
    ↓
Command Handlers
    ↓
├─ Wallet Manager (Encryption/Decryption)
├─ Trading Engine (Jupiter API)
├─ Market Data (CoinGecko API)
└─ Database (PostgreSQL)
```

## 🗂️ Database Schema

### Core Tables
- **users**: User accounts with referral tracking
- **wallets**: Encrypted wallet private keys (AES-256-GCM)
- **transactions**: Complete trade history with fees
- **token_cache**: Token metadata caching

### Feature Tables
- **admin_users**: Administrator authentication
- **user_settings**: User preferences (slippage, notifications)
- **fees_collected**: Fee tracking and reporting
- **referrals**: Referral relationships and rewards
- **orders**: Limit orders (coming soon)
- **dca_jobs**: DCA schedules (coming soon)

## 💰 Fee Structure

- **Trading Fee**: 0.5% per trade (configurable)
- **Collection**: Automatically transferred to fee wallet
- **Transparency**: All fees tracked in database
- **Referral Rewards**: Earn from referred users (coming soon)

## 🔐 Security

- ✅ Private keys encrypted with AES-256-GCM
- ✅ Non-custodial - users control their wallets
- ✅ Admin authentication for sensitive operations
- ✅ Fee transfer verification before recording
- ✅ Input validation and sanitization
- ⚠️ Never share your ENCRYPTION_KEY or bot token

## 🚀 Production Deployment

To deploy to mainnet:

1. Update environment variables:
   ```env
   SOLANA_NETWORK=mainnet-beta
   SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
   FEE_WALLET=your_mainnet_wallet
   ```

2. Test thoroughly on devnet first!
3. Set up monitoring and alerts
4. Configure proper RPC endpoint with rate limits
5. Add yourself as first admin in database

## 📊 Current Status

### Implemented ✅
- Non-custodial wallet management
- Token swaps via Jupiter v6
- Portfolio tracking with USD values
- Transaction history
- Fee collection system
- Referral program structure
- Admin panel with statistics
- Interactive button menus
- User settings management

### Coming Soon ⏳
- Limit order execution
- DCA scheduler
- Token sniping
- Copy trading
- Advanced analytics
- Price alerts
- Reward distribution

## Support

For issues or questions, please check the code comments or create an issue.

## License

MIT License - Use at your own risk
