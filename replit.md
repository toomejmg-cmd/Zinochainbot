# Zinobot - Project Documentation

## Overview
Zinobot is a Solana-based Telegram trading bot built with Node.js and TypeScript. It enables users to create wallets, trade tokens via Jupiter Aggregator, and track their portfolio directly through Telegram.

**Current Status:** MVP implementation complete with Admin Dashboard
**Network:** Solana Devnet (default)
**Last Updated:** November 7, 2025

## Architecture

### Tech Stack
- **Language:** TypeScript/Node.js
- **Bot Framework:** grammY
- **Blockchain:** Solana (via @solana/web3.js)
- **Trading:** Jupiter Aggregator API
- **Database:** PostgreSQL
- **Encryption:** AES-256-GCM
- **Market Data:** CoinGecko API

### Project Structure
```
zinobot/
├── src/                          # Main Telegram bot
│   ├── bot/
│   │   └── commands.ts          # Telegram command handlers
│   ├── database/
│   │   ├── db.ts                # Database connection
│   │   ├── init.ts              # Schema initialization
│   │   └── schema.sql           # Database schema
│   ├── services/
│   │   ├── jupiter.ts           # Jupiter swap integration
│   │   ├── fees.ts              # Fee collection service
│   │   └── coingecko.ts         # Price data service
│   ├── utils/
│   │   └── encryption.ts        # AES-256 encryption
│   ├── wallet/
│   │   └── walletManager.ts     # Wallet operations
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

## Features Implemented (MVP)

### Core Functionality
✅ Telegram bot interface with grammY
✅ Solana wallet generation with encrypted storage
✅ Token swaps via Jupiter Aggregator
✅ Portfolio tracking (SOL balance)
✅ Transaction history
✅ Market data from CoinGecko
✅ PostgreSQL database with full schema
✅ Secure key management with AES-256

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
1. **users** - Telegram user data
2. **wallets** - Encrypted wallet storage
3. **transactions** - Trade history
4. **token_cache** - Price/metadata cache
5. **orders** - Limit orders (future)
6. **dca_jobs** - Recurring purchases (future)

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
- `JUPITER_API_URL` - Custom Jupiter endpoint
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
- Jupiter integration for swaps
- CoinGecko price feeds
- Full Telegram command suite
