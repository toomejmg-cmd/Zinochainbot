# 🚂 Railway Deployment Guide - Zinochain Bot

Deploy your multi-chain Telegram trading bot to Railway.app with PostgreSQL in under 30 minutes.

---

## 📋 Prerequisites

- ✅ GitHub account with your Zinochain Bot repository pushed
- ✅ Railway account (sign up at https://railway.app)
- ✅ Telegram Bot Token from @BotFather
- ✅ API keys (Encryption key, Session secret, etc.)

---

## 🎯 Architecture Overview

Your project has **3 services** that need to be deployed:

1. **Zinochain Bot** (Main Telegram bot) - Root directory
2. **Admin API** (Backend API) - `/admin-api` directory
3. **Admin Dashboard** (Frontend UI) - `/admin-dashboard` directory
4. **PostgreSQL Database** (Shared by all services)

---

## 🚀 Step-by-Step Deployment

### **Step 1: Create Railway Project**

1. Go to https://railway.app/dashboard
2. Click **"New Project"**
3. Select **"Deploy from GitHub repo"**
4. Authenticate with GitHub
5. Select your **`zinochain-bot`** repository
6. Railway will auto-detect it's a Node.js monorepo

---

### **Step 2: Add PostgreSQL Database**

1. In your Railway project dashboard, click **"+ New"**
2. Select **"Database"** → **"Add PostgreSQL"**
3. Wait 30 seconds for provisioning
4. Railway automatically creates a `DATABASE_URL` variable

✅ **Done!** Your PostgreSQL instance is ready.

---

### **Step 3: Deploy Service 1 - Main Bot**

1. Click **"+ New"** → **"GitHub Repo"** → Select your repo
2. Railway will create a service automatically
3. **Configure the service:**
   - **Name:** `Zinochain Bot`
   - **Root Directory:** Leave blank (uses root)
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `node dist/index.js`
   - **Watch Paths:** `/src/**` (prevents unnecessary rebuilds)

4. **Add Environment Variables:**
   Click **Variables** tab and add:
   ```
   DATABASE_URL=${{Postgres.DATABASE_URL}}
   TELEGRAM_BOT_TOKEN=<your_bot_token>
   ENCRYPTION_KEY=<32_character_random_string>
   SESSION_SECRET=<32_character_random_string>
   SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
   SOLANA_NETWORK=mainnet-beta
   ETHEREUM_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
   BSC_RPC_URL=https://bsc-dataseed.binance.org
   NODE_ENV=production
   ```

   **Note:** `${{Postgres.DATABASE_URL}}` is a Railway reference variable that auto-links to your database.

5. Click **"Deploy"** and wait for build to complete

---

### **Step 4: Deploy Service 2 - Admin API**

1. Click **"+ New"** → **"Empty Service"**
2. Connect to your GitHub repo
3. **Configure the service:**
   - **Name:** `Admin API`
   - **Root Directory:** `/admin-api`
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `node dist/index.js`
   - **Watch Paths:** `/admin-api/**`

4. **Add Environment Variables:**
   ```
   DATABASE_URL=${{Postgres.DATABASE_URL}}
   SESSION_SECRET=${{Zinochain Bot.SESSION_SECRET}}
   ENCRYPTION_KEY=${{Zinochain Bot.ENCRYPTION_KEY}}
   NODE_ENV=production
   PORT=5000
   ```

5. **Generate Public Domain:**
   - Go to **Settings** → **Networking**
   - Click **"Generate Domain"**
   - Copy the URL (e.g., `admin-api-production-abc123.up.railway.app`)

6. Click **"Deploy"**

---

### **Step 5: Deploy Service 3 - Admin Dashboard**

1. Click **"+ New"** → **"Empty Service"**
2. Connect to your GitHub repo
3. **Configure the service:**
   - **Name:** `Admin Dashboard`
   - **Root Directory:** `/admin-dashboard`
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
   - **Watch Paths:** `/admin-dashboard/**`

4. **Add Environment Variables:**
   ```
   ADMIN_API_URL=${{Admin API.RAILWAY_PUBLIC_DOMAIN}}
   NODE_ENV=production
   PORT=3000
   ```

5. **Generate Public Domain:**
   - Go to **Settings** → **Networking**
   - Click **"Generate Domain"**
   - Save this URL for accessing your admin panel

6. Click **"Deploy"**

---

### **Step 6: Initialize Database**

Your database is empty on first deploy. You need to run migrations:

1. **Install Railway CLI:**
   ```bash
   npm install -g @railway/cli
   ```

2. **Login and link to your project:**
   ```bash
   railway login
   railway link
   ```

3. **Select your Zinochain Bot service**

4. **Run database migrations:**
   ```bash
   railway run npm run db:init
   ```

   This will create all tables (users, wallets, transactions, etc.)

---

### **Step 7: Create Admin User**

Create your first admin account:

```bash
railway run --service "Admin API" npm run create-admin
```

Follow the prompts to set username and password.

---

## ✅ Verify Deployment

### **Test Main Bot**
1. Open Telegram
2. Search for `@Zinochainbot`
3. Send `/start`
4. Expected: Welcome message with command buttons

### **Test Admin Dashboard**
1. Visit your Admin Dashboard URL
2. Login with admin credentials
3. Expected: Dashboard showing 0 users, 0 transactions

---

## 🔧 Environment Variables Reference

### **Required for All Services**
| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | Auto-provided by Railway |
| `NODE_ENV` | Environment mode | `production` |

### **Main Bot Only**
| Variable | Description | Example |
|----------|-------------|---------|
| `TELEGRAM_BOT_TOKEN` | Bot token from @BotFather | `1234567890:ABCdefGHI...` |
| `ENCRYPTION_KEY` | 32+ char key for wallet encryption | Generate with `openssl rand -hex 32` |
| `SESSION_SECRET` | 32+ char key for sessions | Generate with `openssl rand -hex 32` |
| `SOLANA_RPC_URL` | Solana RPC endpoint | `https://api.mainnet-beta.solana.com` |
| `ETHEREUM_RPC_URL` | Ethereum RPC endpoint | Use Alchemy/Infura |
| `BSC_RPC_URL` | BSC RPC endpoint | `https://bsc-dataseed.binance.org` |

### **Admin API Only**
| Variable | Description |
|----------|-------------|
| `PORT` | API server port (Railway sets automatically) |

### **Admin Dashboard Only**
| Variable | Description |
|----------|-------------|
| `ADMIN_API_URL` | URL of Admin API service |
| `PORT` | Dashboard server port |

---

## 🔄 Auto-Deployments

Railway automatically redeploys when you push to GitHub:

1. Make code changes locally
2. Commit and push to GitHub:
   ```bash
   git add .
   git commit -m "Update feature"
   git push origin main
   ```
3. Railway detects changes and redeploys automatically
4. Wait 2-3 minutes for deployment

---

## 📊 Monitoring & Logs

### **View Logs**
1. Click on any service in Railway dashboard
2. Go to **"Deployments"** tab
3. Click latest deployment
4. View real-time logs

### **Check Database**
1. Click on **Postgres** service
2. Go to **"Data"** tab
3. Browse tables and run SQL queries

### **Metrics**
- Railway provides CPU, Memory, and Network usage graphs
- Check **"Metrics"** tab in each service

---

## 💰 Cost Estimate

Railway pricing (as of 2025):

| Resource | Free Tier | Paid Plan |
|----------|-----------|-----------|
| **Compute** | $5 free credit/month | ~$0.000231/GB-hour |
| **PostgreSQL** | 512MB RAM, 1GB storage | ~$5-10/month |
| **Total** | ~Free for small bots | ~$10-15/month |

**Compared to Replit:** Save ~$15-40/month! 💰

---

## 🐛 Troubleshooting

### **Bot doesn't respond to /start**
1. Check logs for errors
2. Verify `TELEGRAM_BOT_TOKEN` is correct
3. Ensure database migrations ran successfully
4. Check `DATABASE_URL` is properly linked

### **Admin Dashboard shows 404**
1. Verify `ADMIN_API_URL` variable is set
2. Check Admin API is deployed and running
3. Make sure public domain is generated for Admin API

### **Database connection errors**
1. Verify all services use `${{Postgres.DATABASE_URL}}`
2. Make sure PostgreSQL service is running
3. Check Railway service is in the same project

### **Build fails**
1. Check build logs in Deployments tab
2. Verify `package.json` has correct scripts
3. Make sure `typescript` is in devDependencies
4. Try redeploying manually

---

## 📝 Post-Deployment Checklist

- [ ] All 3 services deployed successfully
- [ ] PostgreSQL database running
- [ ] Database migrations completed
- [ ] Admin user created
- [ ] Bot responds to `/start` in Telegram
- [ ] Admin dashboard accessible
- [ ] Environment variables configured
- [ ] Auto-deployment working on git push

---

## 🚀 Next Steps

1. **Configure Bot Settings:**
   - Set trading fees in Admin Dashboard
   - Configure RPC endpoints
   - Set withdrawal limits

2. **Test Trading:**
   - Create wallet: `/create_wallet`
   - Fund with SOL/ETH/BNB
   - Test token swaps

3. **Enable Mainnet:**
   - Update `SOLANA_NETWORK` to `mainnet-beta`
   - Switch RPC URLs to mainnet
   - Redeploy services

4. **Custom Domain (Optional):**
   - Go to Settings → Networking
   - Add custom domain for Admin Dashboard
   - Update DNS records

---

## 📚 Helpful Links

- **Railway Docs:** https://docs.railway.app
- **Railway CLI:** https://docs.railway.app/develop/cli
- **PostgreSQL Guide:** https://docs.railway.app/guides/postgresql
- **Monorepo Deployment:** https://docs.railway.app/guides/monorepo
- **Support:** https://help.railway.app

---

## 🎉 Congratulations!

Your Zinochain Bot is now live on Railway with PostgreSQL! 

**Total Setup Time:** ~30 minutes  
**Monthly Cost:** ~$10-15 (vs $25-50 on Replit)  
**Savings:** ~$180-480/year 💰

Need help? Check the troubleshooting section or Railway docs!
