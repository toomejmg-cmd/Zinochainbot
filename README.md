# Zinobot - Solana Trading Bot for Telegram

A powerful Telegram bot for trading on Solana blockchain with Jupiter aggregator integration.

## Features

- 🔐 **Secure Wallet Management**: Create and manage Solana wallets with AES-256 encryption
- 💱 **Token Swaps**: Buy and sell tokens instantly via Jupiter Aggregator
- 📊 **Portfolio Tracking**: Real-time balance and token holdings
- 💰 **Market Data**: Live token prices from CoinGecko
- 📝 **Transaction History**: Complete audit trail of all trades
- 🔒 **Non-custodial**: You control your private keys

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

## Bot Commands

- `/start` - Welcome message and bot introduction
- `/create_wallet` - Generate a new Solana wallet
- `/wallet` - View your wallet address
- `/portfolio` - Check your token balances
- `/buy <token_mint> <sol_amount>` - Buy tokens (e.g., `/buy EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v 0.1`)
- `/sell <token_mint> <token_amount>` - Sell tokens
- `/history` - View recent transactions
- `/help` - Show all available commands

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

## Database Schema

- **users**: Telegram user information
- **wallets**: Encrypted Solana wallet data
- **transactions**: Trade history and logs
- **token_cache**: Cached token metadata

## Future Features

- ⏰ Limit orders with price monitoring
- 🔄 DCA (Dollar Cost Averaging) scheduling
- 📈 Advanced portfolio analytics
- 🤖 AI-powered trade suggestions
- 👥 Copy-trading functionality
- 🎯 Token sniping for new listings

## Support

For issues or questions, please check the code comments or create an issue.

## License

MIT License - Use at your own risk
