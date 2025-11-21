# Zinochain Bot - Complete Feature Rundown

## Overview
**Zinochain Bot** is a sophisticated AI-powered multi-chain Telegram trading bot that enables users to trade tokens, manage crypto portfolios, and earn through referrals - all directly in Telegram. With bank-grade security (AES-256 encryption), non-custodial wallet management, and seamless multi-chain support, Zinochain puts professional trading capabilities in your pocket.

**Status:** Production-Ready | **Networks:** Solana, Ethereum, BSC | **Users:** Non-Custodial Wallets | **Security:** AES-256-GCM Encrypted

---

## Core Features

### 🌐 Multi-Chain Support
Trade seamlessly across three major blockchains:
- **⚡ Solana** - Lightning-fast token swaps with Jupiter Aggregator routing
- **🔷 Ethereum** - ERC-20 token trading with OneInch optimization
- **🟡 Binance Smart Chain (BSC)** - BEP-20 token trading with optimal gas fees

Switch between chains instantly using the interactive menu system. Your wallet addresses and balances sync automatically across all chains.

### 🔐 Secure Wallet Management
Bank-grade security for your cryptocurrency:
- **AES-256-GCM Encryption** - Military-grade encryption for private keys
- **Non-Custodial Control** - You control your wallets, not Zinochain
- **One-Time Secret Display** - Seed phrases shown once during creation
- **Encrypted Database Storage** - Keys encrypted at rest
- **Import Existing Wallets** - Import any wallet using BIP39 seed phrases
- **Multiple Wallets** - Manage up to 5 wallets per user (configurable)

### 💰 Token Trading
Execute trades with confidence:
- **Buy Tokens** - Swap native coins (SOL/ETH/BNB) for any token
- **Sell Tokens** - Convert tokens back to native coins
- **Jupiter Aggregator** - Best-price routing on Solana
- **OneInch Protocol** - Optimal routing on Ethereum & BSC
- **Automatic Decimals** - Handles all token decimal places correctly
- **Custom Token Input** - Enter token addresses, tickers, or URLs (pump.fun, Birdeye, DEX Screener)
- **Quick Buy/Sell** - Preset amounts or custom amounts
- **Slippage Control** - Adjust tolerance for volatile pairs
- **Priority Fees** - Configurable transaction priority (auto, low, standard, high)

### 📊 Portfolio Tracking
Real-time multi-chain portfolio monitoring:
- **Balance Overview** - SOL, ETH, BNB, and all SPL/ERC-20/BEP-20 token balances
- **USD Conversion** - Real-time pricing via CoinGecko
- **Transaction History** - Complete audit trail with:
  - Transaction timestamps
  - Token amounts
  - Gas fees paid
  - Links to block explorers (Solscan, Etherscan, BSCScan)
- **Token Management** - Hide tokens below minimum value threshold
- **Watchlist** - Add and track specific tokens for monitoring

### 💸 Fee System
Transparent and configurable trading fees:
- **Trading Fees** - Default 0.5% per transaction (configurable by admins)
- **Automated Collection** - Fees collected to designated wallet
- **Referral Bonus** - Earn rewards by inviting friends
- **Fee Transparency** - Always shows fee percentage before trade
- **Zero Hidden Fees** - All costs displayed upfront

### 👥 Referral & Rewards Program
**"Trade. Refer. Earn More."**

Earn passive income by sharing your referral link:
- **Referral Rewards** - Earn 50% cashback on your referred users' trading fees
- **3-Layer System:**
  - Layer 1 (Direct) - Up to 55% commission
  - Layer 2 (Indirect) - Lower tier rewards
  - Layer 3 (Extended Network) - Extended reach bonuses
- **Cashback Rewards** - 25% base cashback on all trading fees
- **Automatic Payouts** - Rewards airdropped every 12 hours to Rewards Wallet
- **Minimum Threshold** - Must maintain 0.005 SOL in rewards wallet to qualify
- **Unique Link Generation** - Regenerate custom referral links anytime
- **Dashboard** - Track referrals, earnings, and tier breakdown in real-time

### 📤 Withdrawal & Transfers
Move crypto on your terms:
- **Withdraw SOL** - Send to external Solana wallets
- **Withdraw Tokens** - Transfer any SPL/ERC-20/BEP-20 tokens
- **Custom Amounts** - Specify exact amounts or all balance
- **External Addresses** - Send to any blockchain address
- **Network Selection** - Choose destination network automatically

### ⏰ Advanced Trading Features

#### Limit Orders
Set it and forget it:
- **Buy/Sell Limits** - Automatically execute when target price is reached
- **Target Price Setting** - Define exact buy/sell prices
- **Order Management** - View, edit, cancel active orders
- **Price Monitoring** - Bot monitors 24/7 for target prices
- **Automatic Execution** - Instant trade when conditions met

#### DCA (Dollar Cost Averaging)
Perfect for long-term investment strategies:
- **Recurring Orders** - Set up automatic periodic purchases
- **Custom Intervals** - Daily, weekly, or custom schedules
- **Amount Configuration** - Define purchase amount per interval
- **Risk Reduction** - Spread purchases over time to reduce entry price volatility
- **Set & Forget** - Bot manages all recurring transactions automatically

#### Token Sniping
Catch early-stage tokens:
- **New Token Monitoring** - Track tokens at launch
- **Price Alerts** - Get notified of price movements
- **Fast Execution** - Sniper trades execute milliseconds after launch
- **MEV Protection** - Minimize sandwich attacks

#### Price Alerts
Stay informed 24/7:
- **Custom Price Targets** - Alert when tokens reach specific prices
- **Multiple Alerts** - Track unlimited tokens simultaneously
- **Instant Notifications** - Get alerted immediately via Telegram
- **Above/Below Triggers** - Alert on price highs or lows

### ⚙️ User Settings & Customization

#### Trading Settings
- **Slippage Tolerance** - Adjust for market conditions (0.01% - 50%)
- **Priority Fee Mode** - Auto/Low/Standard/High gas fees
- **Auto-Approve Trades** - Skip confirmation for known trades
- **Max Trade Amount** - Set per-trade limits for safety
- **Default Buy Amount** - Quick reference for preset buys

#### AI Trader Settings
- **AI Mode** - Enable AI-powered trading suggestions (when available)
- **Risk Level** - Conservative, Moderate, or Aggressive
- **Auto-Trading** - Allow bot to execute trades automatically

#### Security & Privacy
- **MEV Protection** - Prevent sandwich attacks
- **Anti-Rug Detection** - Identify suspicious contracts
- **Transaction Confirmation** - Require manual approval for sensitive actions
- **Session Timeouts** - Auto-lock after inactivity
- **Secure Action Password (SAP)** - Additional password for withdrawals/exports

#### Notification Preferences
- **Trade Alerts** - Notify on all trades
- **Large Trade Alerts** - Alert only on significant trades
- **Suspicious Activity** - Alert on unusual account activity
- **Price Alerts** - Receive price target notifications
- **Daily Summary** - Get daily portfolio summary

#### Display & Preferences
- **Active Chain** - Set default trading chain
- **Currency Display** - USD, EUR, or other fiat
- **UI Theme** - Light/Dark mode
- **Language** - English (expandable)

#### Advanced Settings
- **RPC Endpoints** - Configure custom Solana/Ethereum/BSC RPC URLs
- **Transaction Speed** - Slow/Standard/Fast network settings
- **Debug Mode** - Detailed transaction logs
- **Slippage Presets** - Save favorite slippage configurations

### 🎮 User Experience
- **Interactive Button Menus** - No command memorization needed
- **Real-Time Updates** - Refresh portfolio and balances on demand
- **Responsive Design** - Works on all Telegram clients
- **Onboarding Flow** - Guided setup for new users
- **Terms & Conditions** - Accept before first use
- **Chain Selection** - Choose Solana/Ethereum/BSC on onboarding

### 📱 Available Commands
- `/start` - Initialize bot and view dashboard
- `/wallet` - View wallet address and balance
- `/portfolio` - Check all token holdings
- `/history` - View transaction history
- `/help` - Show help and security tips
- `/buy` - (Can also use menu button)
- `/sell` - (Can also use menu button)
- `/create_wallet` - Generate new wallet

---

## Admin Dashboard Features

### 👑 Admin Panel (Web-Based)
Complete control over your bot instance:
- **User Management** - View, monitor, and manage users
- **Transaction Monitoring** - Track all platform trades
- **Fee Management** - Adjust fees in real-time
- **Administrator Control** - Add/remove admin accounts
- **Statistics Dashboard:**
  - Total users registered
  - Total wallets created
  - Total transactions processed
  - Total fees collected
  - Total referral rewards paid

### 💰 Fee Configuration
- **Set Trading Fees** - Adjust percentage (e.g., 0.1% to 1%)
- **Fee Wallet** - Designate collection address
- **Auto-Collection** - Automatic fee gathering from trades
- **Collection Schedule** - Set collection intervals
- **Balance Thresholds** - Collect when balance reaches minimum

### 🔧 Bot Settings Management
- **Emergency Stop** - Pause all bot functions if needed
- **Maintenance Mode** - Graceful shutdown for updates
- **New User Registration** - Allow/disable new signups
- **Daily Trade Limits** - Set per-user trade limits
- **Withdrawal Settings:**
  - Minimum withdrawal amounts
  - Maximum withdrawal amounts
  - Daily/monthly limits
  - Approval requirement toggle
- **Security Settings:**
  - IP whitelist for admin access
  - 2FA requirement toggle
  - Failed login attempt limits
  - Suspicious activity thresholds

### 📊 Analytics & Reporting
- **Platform Statistics** - Real-time metrics
- **User Growth** - Track new user registrations
- **Transaction Volume** - Monitor trading activity
- **Revenue Tracking** - Fee collection analytics
- **Referral Metrics** - Track referral program performance

---

## Security Features

### Encryption & Data Protection
- **AES-256-GCM** - Military-grade key encryption
- **Database Encryption** - Keys encrypted at rest
- **HTTPS Only** - All communications encrypted in transit
- **Session Management** - Secure session tokens
- **Rate Limiting** - Protection against brute force attacks

### Wallet Security
- **Non-Custodial** - Users control private keys
- **One-Time Seed Display** - Keys shown only once
- **Import Validation** - Validate seed phrases before import
- **Address Verification** - Verify before transactions
- **Export Controls** - Seed phrase export with confirmation

### Transaction Security
- **MEV Protection** - Minimize sandwich attacks (configurable)
- **Slippage Limits** - User-defined price protection
- **Transaction Confirmation** - Manual approval option
- **Gas Monitoring** - Alert on high gas prices
- **Failed Transaction Recovery** - Automatic refund attempts

### Admin Security
- **Admin Authentication** - Telegram ID verification
- **Admin-Only Functions** - Fee changes, user management
- **Audit Trail** - Log all admin actions
- **Permission Levels** - Configurable admin roles

---

## Blockchain Integration

### Solana
- **Jupiter Aggregator** - Optimal token swap routing
- **SPL Tokens** - Full SPL token support
- **Devnet/Mainnet** - Testnet and production support
- **RPC Endpoints** - Configurable Solana RPC
- **Priority Fees** - MEV-aware fee structure
- **Solscan Integration** - Direct transaction links

### Ethereum & BSC
- **OneInch Protocol** - DEX aggregation for optimal pricing
- **ERC-20 Tokens** - Full ERC-20 standard support
- **BEP-20 Tokens** - Full BEP-20 standard support
- **Gas Optimization** - Configurable gas strategies
- **Etherscan/BSCScan Integration** - Direct transaction links
- **Contract Verification** - Automatic contract analysis

---

## How Users Get Started

### 1. Initial Setup
- Send `/start` to @Zinochainbot
- Accept Terms of Service
- Choose primary blockchain (Solana/Ethereum/BSC)
- Create or import wallet

### 2. Fund Your Wallet
- Copy wallet address
- Send crypto from exchange or another wallet
- Use Moonpay to buy SOL/USDC/ETH/BNB with credit card

### 3. Start Trading
- Click **💰 Buy** to purchase tokens
- Click **💸 Sell** to convert back to native coins
- Set **⚙️ Settings** for your preferences
- Monitor **💼 Portfolio** in real-time

### 4. Earn Passive Income
- Get unique referral link from **👥 Refer Friends**
- Share with friends and earn rewards
- Collect rewards every 12 hours automatically

---

## Technical Stack

- **Bot Framework:** grammY (TypeScript/Node.js)
- **Blockchain:** Solana Web3.js, ethers.js
- **DEX Aggregation:** Jupiter (Solana), OneInch (ETH/BSC)
- **Market Data:** CoinGecko API, DEX Screener API
- **Database:** PostgreSQL with encrypted storage
- **Encryption:** Native Node.js crypto (AES-256-GCM)
- **Hosting:** Railway (Production-ready deployment)
- **Security:** Rate limiting, HTTPS, session management

---

## Supported Features Summary

| Feature | Solana | Ethereum | BSC |
|---------|--------|----------|-----|
| Token Swaps | ✅ | ✅ | ✅ |
| Wallet Management | ✅ | ✅ | ✅ |
| Portfolio Tracking | ✅ | ✅ | ✅ |
| Transfers | ✅ | ✅ | ✅ |
| Limit Orders | ✅ | ✅ | ✅ |
| DCA Orders | ✅ | ✅ | ✅ |
| Price Alerts | ✅ | ✅ | ✅ |
| MEV Protection | ✅ | ✅ | ✅ |
| Referral Program | ✅ | ✅ | ✅ |

---

## Fee Structure

- **Trading Fee:** Configurable (default 0.5%)
- **Referral Cashback:** 25% base on your trades
- **Referral Commission:** Up to 55% on referred user trades
- **Withdrawal Fee:** None (network fees apply)
- **Gas Fees:** Configurable (user pays to network, not to Zinochain)

---

## API Integrations

**Market Data:**
- CoinGecko API - Real-time token pricing
- DEX Screener - Token information and charts

**DEX Integration:**
- Jupiter Aggregator - Best-price routing on Solana
- OneInch - DEX aggregation for Ethereum and BSC

**External Services:**
- Moonpay - On-ramp for fiat-to-crypto purchases
- Block Explorers - Solscan, Etherscan, BSCScan integration

---

## What Makes Zinochain Bot Different

✅ **True Multi-Chain** - Trade across Solana, Ethereum, AND BSC in one bot  
✅ **Non-Custodial** - You own your wallets and private keys  
✅ **Bank-Grade Security** - AES-256-GCM encryption for all keys  
✅ **Production Ready** - Deployed on Railway with high uptime  
✅ **Advanced Trading** - Limit orders, DCA, sniping, alerts  
✅ **Passive Income** - 3-tier referral system with automatic payouts  
✅ **User-Friendly** - No complex commands, just click buttons  
✅ **Customizable** - Admins can adjust fees, limits, and settings  
✅ **Transparent Fees** - No hidden costs, all fees shown before trade  
✅ **24/7 Monitoring** - Limit orders and price alerts work while you sleep  

---

## Contact & Support

- **Website:** zinochain.com
- **Twitter:** @zinochain
- **Email:** hi@zinochain.com
- **Support Group:** @zinogroup on Telegram
- **Bot:** @Zinochainbot on Telegram

---

*Last Updated: November 21, 2025*  
*Version: 1.0 - Production Ready*  
*Status: Fully Operational on Mainnet*
