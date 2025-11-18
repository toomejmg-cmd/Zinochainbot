# 🔐 Environment Variables Reference

Complete list of environment variables needed for Zinochain Bot deployment.

---

## 🚀 Quick Setup - Railway

**Copy these to Railway's Variables tab:**

### **Service: Zinochain Bot (Main Bot)**
```bash
# Database
DATABASE_URL=${{Postgres.DATABASE_URL}}

# Telegram
TELEGRAM_BOT_TOKEN=your_bot_token_from_botfather

# Security
ENCRYPTION_KEY=generate_with_openssl_rand_hex_32
SESSION_SECRET=generate_with_openssl_rand_hex_32

# Blockchain RPCs
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
SOLANA_NETWORK=mainnet-beta
ETHEREUM_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
BSC_RPC_URL=https://bsc-dataseed.binance.org

# Environment
NODE_ENV=production
```

### **Service: Admin API**
```bash
DATABASE_URL=${{Postgres.DATABASE_URL}}
SESSION_SECRET=${{Zinochain Bot.SESSION_SECRET}}
ENCRYPTION_KEY=${{Zinochain Bot.ENCRYPTION_KEY}}
NODE_ENV=production
PORT=5000
```

### **Service: Admin Dashboard**
```bash
ADMIN_API_URL=${{Admin API.RAILWAY_PUBLIC_DOMAIN}}
NODE_ENV=production
PORT=3000
```

---

## 📝 Variable Descriptions

### **Required (All Services)**

**DATABASE_URL**  
- PostgreSQL connection string
- Automatically provided by Railway PostgreSQL service
- Format: `postgresql://user:pass@host:port/dbname`

**NODE_ENV**  
- Environment mode
- Values: `development`, `production`
- Use `production` for Railway deployments

---

### **Bot-Specific Variables**

**TELEGRAM_BOT_TOKEN** *(Required)*  
- Your Telegram bot token from @BotFather
- Get it: https://t.me/BotFather → `/newbot`
- Format: `1234567890:ABCdefGHIjklMNOpqrSTUvwxYZ`

**ENCRYPTION_KEY** *(Required)*  
- Used to encrypt wallet private keys in database
- **Must be 32+ characters**
- Generate: `openssl rand -hex 32`
- ⚠️ **Never share this key!**

**SESSION_SECRET** *(Required)*  
- Used for JWT token signing
- **Must be 32+ characters**
- Generate: `openssl rand -hex 32`

**SOLANA_RPC_URL** *(Required)*  
- Solana blockchain RPC endpoint
- Devnet: `https://api.devnet.solana.com`
- Mainnet: `https://api.mainnet-beta.solana.com`
- Premium: Use Helius, QuickNode, or Alchemy

**SOLANA_NETWORK** *(Required)*  
- Solana network to connect to
- Values: `devnet`, `mainnet-beta`

**ETHEREUM_RPC_URL** *(Required for ETH trading)*  
- Ethereum blockchain RPC endpoint
- Get free tier: https://www.alchemy.com
- Or use: https://eth.llamarpc.com

**BSC_RPC_URL** *(Required for BSC trading)*  
- Binance Smart Chain RPC endpoint
- Public: `https://bsc-dataseed.binance.org`
- Premium: Use QuickNode or NodeReal

---

### **Admin API Variables**

**PORT** *(Optional)*  
- Port for Admin API server
- Default: `5000`
- Railway sets this automatically

---

### **Admin Dashboard Variables**

**ADMIN_API_URL** *(Required)*  
- URL of your deployed Admin API
- Railway reference: `${{Admin API.RAILWAY_PUBLIC_DOMAIN}}`
- Format: `https://admin-api-production-xyz.up.railway.app`

**PORT** *(Optional)*  
- Port for dashboard server
- Default: `3000`
- Railway sets this automatically

---

## 🛠️ How to Generate Secure Keys

### **Option 1: Using OpenSSL (Recommended)**
```bash
# Generate ENCRYPTION_KEY
openssl rand -hex 32

# Generate SESSION_SECRET
openssl rand -hex 32
```

### **Option 2: Using Node.js**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### **Option 3: Online Generator**
- Visit: https://randomkeygen.com
- Use "CodeIgniter Encryption Keys" section
- Copy 256-bit or 512-bit key

---

## 🔗 Railway Reference Variables

Railway allows you to reference variables from other services:

| Reference | Description |
|-----------|-------------|
| `${{Postgres.DATABASE_URL}}` | PostgreSQL connection string |
| `${{ServiceName.VARIABLE_NAME}}` | Any variable from another service |
| `${{ServiceName.RAILWAY_PUBLIC_DOMAIN}}` | Public URL of a service |

**Example:**
```bash
# Admin Dashboard referencing Admin API URL
ADMIN_API_URL=${{Admin API.RAILWAY_PUBLIC_DOMAIN}}

# Admin API reusing bot's encryption key
ENCRYPTION_KEY=${{Zinochain Bot.ENCRYPTION_KEY}}
```

---

## ⚠️ Security Best Practices

1. **Never commit secrets to Git**
   - Add `.env` to `.gitignore`
   - Use Railway's Variables feature

2. **Use strong, random keys**
   - Minimum 32 characters for encryption
   - Never use simple passwords

3. **Rotate keys regularly**
   - Update `SESSION_SECRET` every 3-6 months
   - Never change `ENCRYPTION_KEY` (wallets become unrecoverable!)

4. **Use environment-specific values**
   - Different keys for dev vs production
   - Different RPC endpoints for testing

5. **Limit API key permissions**
   - Use read-only RPC endpoints when possible
   - Don't store admin wallet private keys

---

## 🧪 Development vs Production

### **Development (.env file)**
```bash
DATABASE_URL=postgresql://localhost:5432/zinochain_dev
TELEGRAM_BOT_TOKEN=your_test_bot_token
ENCRYPTION_KEY=dev_key_at_least_32_characters_long
SESSION_SECRET=dev_secret_at_least_32_chars
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_NETWORK=devnet
NODE_ENV=development
```

### **Production (Railway)**
```bash
DATABASE_URL=${{Postgres.DATABASE_URL}}
TELEGRAM_BOT_TOKEN=production_bot_token
ENCRYPTION_KEY=production_key_from_openssl
SESSION_SECRET=production_secret_from_openssl
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
SOLANA_NETWORK=mainnet-beta
NODE_ENV=production
```

---

## 📋 Deployment Checklist

Before deploying to Railway, verify you have:

- [ ] `TELEGRAM_BOT_TOKEN` from @BotFather
- [ ] `ENCRYPTION_KEY` generated (32+ chars)
- [ ] `SESSION_SECRET` generated (32+ chars)
- [ ] Mainnet RPC endpoints (Solana, Ethereum, BSC)
- [ ] PostgreSQL database provisioned
- [ ] All Railway reference variables configured
- [ ] No secrets committed to Git

---

## 🔍 Troubleshooting

**Error: "ENCRYPTION_KEY must be at least 32 characters"**  
→ Generate a longer key with `openssl rand -hex 32`

**Error: "Invalid bot token"**  
→ Verify token from @BotFather, ensure no spaces

**Error: "Database connection failed"**  
→ Check `DATABASE_URL` is set to `${{Postgres.DATABASE_URL}}`

**Error: "Cannot connect to Admin API"**  
→ Verify `ADMIN_API_URL` matches Admin API's public domain

---

## 📞 Support

Need help? Check:
- Railway documentation: https://docs.railway.app
- Telegram Bot API: https://core.telegram.org/bots/api
- Zinochain deployment guide: `RAILWAY_DEPLOYMENT.md`
