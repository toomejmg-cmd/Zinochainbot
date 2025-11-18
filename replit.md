# Zinochain Bot - Project Documentation

## Overview
Zinochain Bot is a **multi-chain** Telegram trading bot built with Node.js and TypeScript. It supports Solana, Ethereum, and Binance Smart Chain, enabling users to create wallets, trade tokens, and track their portfolio directly through Telegram.

**Current Status:** Multi-chain architecture implemented, ready for Railway deployment
**Supported Chains:** Solana (Devnet), Ethereum (Mainnet), Binance Smart Chain (Mainnet)
**Deployment:** Railway.app with PostgreSQL
**Last Updated:** November 18, 2025

## 🚀 Deployment

### Railway.app Setup
This project is configured for deployment on Railway.app with PostgreSQL. Railway offers:
- ✅ **Cost Savings:** ~$10-15/month (vs $25-50 on Replit)
- ✅ **Auto-deployments:** Push to GitHub → Automatic redeploy
- ✅ **PostgreSQL:** Built-in database service
- ✅ **Monorepo Support:** All 3 services deploy from one repo

**Quick Start:**
1. Push code to GitHub (already done)
2. Follow complete guide: `RAILWAY_DEPLOYMENT.md`
3. Environment variables reference: `ENV_VARIABLES.md`

**Deployment Files:**
- `railway.json` - Main bot configuration
- `admin-api/railway.json` - Admin API configuration
- `admin-dashboard/railway.json` - Dashboard configuration
- `.railwayignore` - Optimize build times

## Architecture

### Tech Stack
- **Language:** TypeScript/Node.js
- **Bot Framework:** grammY
- **Blockchains:** 
  - Solana (via @solana/web3.js)
  - Ethereum (via ethers.js)
  - Binance Smart Chain (via ethers.js)
- **Trading:** DEX aggregation APIs for optimal swap routing
- **Database:** PostgreSQL with multi-chain support
- **Encryption:** AES-256-GCM for all chains
- **Market Data:** CoinGecko API

### Project Structure
```
zinochain-bot/
├── src/                          # Main Telegram bot
│   ├── adapters/                 # Chain adapter pattern
│   │   ├── IChainAdapter.ts     # Interface for all chains
│   │   ├── SolanaAdapter.ts     # Solana implementation
│   │   ├── EthereumAdapter.ts   # Ethereum implementation
│   │   └── BSCAdapter.ts        # BSC implementation
│   ├── bot/
│   │   ├── commandsNew.ts       # Telegram command handlers
│   │   └── menus.ts             # Bot menu structures
│   ├── database/
│   │   ├── db.ts                # Database connection
│   │   ├── init.ts              # Schema initialization
│   │   └── schema.sql           # Multi-chain database schema
│   ├── services/
│   │   ├── jupiter.ts           # Solana swap integration
│   │   ├── oneinch.ts           # ETH/BSC swap integration
│   │   ├── chainManager.ts      # Chain adapter management
│   │   ├── multiChainWallet.ts  # Multi-chain wallet service
│   │   ├── fees.ts              # Fee collection service
│   │   └── coingecko.ts         # Price data service
│   ├── utils/
│   │   └── encryption.ts        # AES-256 encryption (chain-agnostic)
│   ├── wallet/
│   │   └── walletManager.ts     # Legacy Solana wallet operations
│   └── index.ts                 # Main entry point
├── admin-api/                    # REST API for admin dashboard
│   ├── src/
│   │   ├── routes/
│   │   │   ├── auth.ts          # JWT authentication
│   │   │   └── admin.ts         # Admin data endpoints
│   │   ├── middleware/
│   │   │   └── auth.ts          # JWT verification
│   │   └── index.ts             # Express server (port 3001)
│   └── scripts/
│       └── create-admin.ts      # Admin account utility
├── admin-dashboard/              # Web admin interface
│   ├── public/
│   │   ├── index.html           # SPA dashboard
│   │   └── js/app.js            # Frontend logic
│   └── server.js                # Static server (port 5000)
├── package.json
├── tsconfig.json
└── .env.example
```

## Features Implemented

### Core Functionality
✅ Telegram bot interface with grammY
✅ **Multi-chain wallet generation** (Solana, Ethereum, BSC)
✅ **Chain adapter architecture** for easy expansion
✅ **Encrypted storage for all chains** with AES-256
✅ Token swaps with optimal routing on all chains
✅ **Chain switching** with persistent selection
✅ **Chain-specific dashboards** showing balances and info
✅ Portfolio tracking across multiple chains
✅ Transaction history with chain tagging
✅ Market data from CoinGecko
✅ PostgreSQL database with multi-chain schema
✅ Secure key management with AES-256

### Multi-Chain Features
⚡ **Solana Support:**
  - Fast, low-cost transactions
  - Optimized swap routing
  - Devnet for testing

🔷 **Ethereum Support:**
  - Established DeFi ecosystem
  - ERC-20 token trading
  - Mainnet integration ready

🟡 **BSC Support:**
  - Low fees, high speed
  - BEP-20 token trading
  - Mainnet integration ready

### Onboarding Flow
1. **Terms Acceptance** - User agrees to terms & privacy
2. **Chain Selection** - Choose starting blockchain (Solana/Ethereum/BSC)
3. **Wallet Creation** - Generate encrypted wallet with private key display
4. **Dashboard** - Chain-specific trading interface

Users can switch chains anytime and create wallets on additional chains!

### Bot Commands
- `/start` - Register and introduction
- `/create_wallet` - Generate encrypted Solana wallet
- `/wallet` - View wallet address and SOL balance
- `/portfolio` - Check token holdings
- `/buy <mint> <amount>` - Buy tokens with SOL
- `/sell <mint> <amount>` - Sell tokens for SOL
- `/history` - View transaction history
- `/refer` - Generate referral code and track earnings
- `/help` - Command reference

### Admin Dashboard
**Access:** Web interface on port 5000
**Features:**
- Real-time bot statistics and analytics
- User management and activity monitoring
- Transaction history and fee tracking
- Referral system analytics
- Secure JWT authentication with bcrypt

**Setup:**
1. Create admin account: `cd admin-api && npm run create-admin`
2. Login with Telegram ID and password
3. Monitor all bot activities in real-time

## Database Schema

### Tables
1. **users** - Telegram user data + `current_chain` (persistent chain selection)
2. **wallets** - Encrypted wallet storage + `chain` column (supports multiple wallets per user)
3. **transactions** - Trade history + `chain` column (multi-chain transaction tracking)
4. **token_cache** - Price/metadata cache
5. **orders** - Limit orders (future)
6. **dca_jobs** - Recurring purchases (future)

### Multi-Chain Architecture
- Users can have one wallet per chain (Solana, Ethereum, BSC)
- Chain selection persisted in database (survives bot restarts)
- All wallets encrypted with AES-256 regardless of chain
- Transactions tagged with chain for accurate history tracking

## Security Features
- Private keys encrypted with AES-256-GCM before storage
- Secure key derivation using scrypt
- Environment-based secret management
- No plaintext key exposure
- Secret keys shown only once on creation

## Environment Variables

### Required
- `TELEGRAM_BOT_TOKEN` - From @BotFather
- `DATABASE_URL` - Auto-populated by Replit
- `ENCRYPTION_KEY` - 32+ character random string

### Optional
- `SOLANA_RPC_URL` - Custom RPC endpoint
- `SOLANA_NETWORK` - devnet/mainnet-beta
- `COINGECKO_API_KEY` - For higher rate limits
- `JWT_SECRET` - Admin dashboard JWT secret (change in production)
- `ADMIN_API_PORT` - Admin API port (default: 3001)
- `ADMIN_DASHBOARD_PORT` - Dashboard port (default: 5000)

## Next Phase Features

### Planned Enhancements
- ⏰ Limit orders with price monitoring
- 🔄 DCA (Dollar Cost Averaging) scheduler
- 📈 Advanced portfolio analytics (P&L, performance)
- 🤖 AI-powered trade suggestions (OpenAI)
- 👥 Copy-trading from other wallets
- 🎯 Token sniping for new listings
- 📊 Real-time price alerts
- 💬 Enhanced notifications

## Development Notes

### Testing on Devnet
1. Bot defaults to Solana Devnet
2. Get test SOL from https://faucet.solana.com/
3. Common devnet token mints in code constants

### Known Token Mints (Devnet)
- SOL: `So11111111111111111111111111111111111111112`
- USDC: `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`
- USDT: `Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB`

### Deployment on Replit
- Always On recommended for 24/7 operation
- Workflow configured for automatic restart
- Database auto-managed by Replit PostgreSQL

## User Preferences
None specified yet.

## Recent Changes

### November 8, 2025  
- **URL-Based Token Buying with DEX Integration** 💎
  - Integrated pump.fun, Moonshot, Birdeye, and DEX Screener for URL-based token purchases
  - Created URLParserService to extract token addresses from platform URLs
  - Supports Solana base58 addresses and Ethereum 0x addresses
  - Built TokenInfoService using DEX Screener API for real-time token data
  - Rich token preview displays: price, market cap, volume, 5m/1h/6h/24h price changes
  - Shows wallet balance and price impact calculations
  - Direct links to Explorer, Chart, and platform-specific scans
  - Quick buy buttons: DCA, Swap, Limit, Buy 1.0 SOL, Buy 5.0 SOL, Buy X SOL
  - Refresh button updates token data in real-time
  - Search tokens by ticker symbol if URL not provided
  - Complete buy flow with fee collection and transaction recording
  - Users can enter URLs, token addresses, or ticker symbols to buy

- **Multi-Chain Architecture Implementation** 🌐
  - Added support for Ethereum and Binance Smart Chain alongside Solana
  - Created chain adapter pattern (IChainAdapter interface) for extensibility
  - Implemented SolanaAdapter, EthereumAdapter, and BSCAdapter
  - Built ChainManager service to handle adapter switching
  - Created MultiChainWalletService for unified wallet management
  - Added DEX integration for Ethereum/BSC token swaps
  - Database schema updated with `chain` columns in wallets & transactions tables
  - Added `current_chain` to users table for persistent chain selection
  - Onboarding flow now includes chain selection step
  - Chain switching UI added to main menu with automatic wallet creation
  - All dashboards now show chain-specific data (balances, addresses, network info)
  - /start command updated to display user's current chain
  - Ready for multi-chain trading across Solana, Ethereum, and BSC!

- **3-Step Professional Onboarding Flow**
  - Step 1: Terms & Conditions acceptance with links
  - Step 1.5: Chain selection (Solana/Ethereum/BSC) with descriptions
  - Step 2: Wallet credentials display with private key (auto-deletes in 10 minutes)
  - Step 3: Chain-specific dashboard with trading interface
  - Users can add wallets on other chains later from Settings

- **Bot Welcome Page Enhancement**
  - Added professional Zinobot logo displayed when users start the bot
  - Redesigned welcome message with catchy, marketing-focused copy
  - Integrated branded links: website (zinochain.com), X/Twitter (@zinochain), and email
  - Improved user experience with visual branding on first interaction
  - Added fallback handling if logo image fails to load
  - Main menu already includes Help button for easy access to commands

- **Admin Dashboard Proxy Fix**
  - Fixed API proxy between dashboard (port 5000) and Admin API (port 3001)
  - Replaced http-proxy-middleware with simple fetch-based proxy for reliability
  - Verified all endpoints working: stats, users, transactions, transfers, settings
  - Dashboard fully functional with proper API communication
  - All pages now load correctly including Settings page

### November 7, 2025
- **Admin Dashboard Implementation**
  - Built REST API with Express.js on port 3001
  - Created web-based admin interface on port 5000
  - Added JWT authentication with bcrypt password hashing
  - Implemented real-time statistics and monitoring
  - User management with search and filtering
  - Transaction history with detailed analytics
  - Referral tracking and analytics
  - Secure admin account creation utility
  - Auto-refresh functionality for live data
  - Fixed critical navigation bug in frontend
  - Added proxy trust configuration for Replit deployment
  - Comprehensive documentation in admin-dashboard/README.md

### October 28, 2025
- Initial project setup
- Complete MVP implementation
- Database schema created
- All core trading features implemented
- Security with AES-256 encryption
- Multi-chain swap integration
- CoinGecko price feeds
- Full Telegram command suite
