# 🚂 Railway Deployment Guide - Zinochain Bot

Deploy your multi-chain Telegram trading bot to Railway.app with PostgreSQL in under 30 minutes.

> **💰 Cost Savings:** ~$25-50/month on Replit → ~$5-10/month on Railway

---

## 📋 Prerequisites

- ✅ GitHub account with your Zinochain Bot repository pushed
- ✅ Railway account (sign up at https://railway.app - free $5 credit)
- ✅ Telegram Bot Token from @BotFather
- ✅ API keys (Encryption key, Session secret, etc.)

---

## 🎯 Architecture Overview

Your project has **3 services + 1 database** deployed from a **monorepo**:

| Service | Directory | Purpose | Port |
|---------|-----------|---------|------|
| **Zinochain Bot** | `/` (root) | Main Telegram bot | N/A |
| **Admin API** | `/admin-api` | Backend REST API | Railway assigns |
| **Admin Dashboard** | `/admin-dashboard` | Web UI for admins | Railway assigns |
| **PostgreSQL** | N/A | Shared database | 5432 |

**Important:** All 3 services deploy from the **same GitHub repository** using different root directories.

---

## 🚀 Step-by-Step Deployment

### **Step 1: Create Railway Project & Database**

1. Go to https://railway.app/dashboard
2. Click **"New Project"**
3. Select **"Provision PostgreSQL"**
4. Wait 30 seconds for provisioning
5. Railway automatically creates these variables:
   - `DATABASE_URL` (full connection string)
   - `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`

✅ **Done!** Your PostgreSQL instance is ready.

---

### **Step 2: Deploy Service 1 - Main Bot**

#### A. Create Service
1. In your project, click **"+ New"**
2. Select **"GitHub Repo"**
3. Authenticate and select your **`zinochain-bot`** repository
4. Railway creates a service named after your repo

#### B. Configure Service Settings
1. Click on the service → **Settings** tab
2. **Service Name:** `Zinochain Bot`
3. **Root Directory:** Leave blank (uses root `/`)
4. Scroll to **Deploy** section
5. **Custom Build Command:** `npm install && npm run build`
6. **Custom Start Command:** `node dist/index.js`

#### C. Add Environment Variables
Click **Variables** tab and add these:

```bash
# Database (Reference to PostgreSQL service)
DATABASE_URL=${{Postgres.DATABASE_URL}}

# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=<your_telegram_bot_token_from_botfather>

# Security Keys (Generate 32+ character random strings)
ENCRYPTION_KEY=<generate_random_32_char_string>
SESSION_SECRET=<generate_random_32_char_string>

# Blockchain RPC URLs
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
SOLANA_NETWORK=mainnet-beta
ETHEREUM_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_ALCHEMY_KEY
BSC_RPC_URL=https://bsc-dataseed.binance.org

# Environment
NODE_ENV=production
```

**💡 Tips:**
- `${{Postgres.DATABASE_URL}}` auto-links to your database
- Generate secure random strings for `ENCRYPTION_KEY` and `SESSION_SECRET`
- Get free Alchemy API key at https://www.alchemy.com

#### D. Deploy
Click **"Deploy"** button (top right) and wait 2-3 minutes for build.

---

### **Step 3: Deploy Service 2 - Admin API**

#### A. Create Service
1. Click **"+ New"** → **"GitHub Repo"**
2. Select your **same repository** again
3. Railway creates another service

#### B. Configure Service Settings
1. **Service Name:** `Admin API`
2. **Root Directory:** `admin-api`
3. **Custom Build Command:** `cd admin-api && npm install && npm run build`
4. **Custom Start Command:** `cd admin-api && node dist/index.js`
5. **Watch Paths:** `admin-api/**`

#### C. Add Environment Variables
```bash
# Database
DATABASE_URL=${{Postgres.DATABASE_URL}}

# Security (Reuse from main bot)
SESSION_SECRET=${{Zinochain Bot.SESSION_SECRET}}
ENCRYPTION_KEY=${{Zinochain Bot.ENCRYPTION_KEY}}

# Environment
NODE_ENV=production
```

**Note:** Railway automatically provides `PORT` variable - do not set it manually!

#### D. Generate Public Domain
1. Go to **Settings** → **Networking** tab
2. Click **"Generate Domain"**
3. Copy the URL (e.g., `admin-api-production-abc123.up.railway.app`)
4. **Save this URL** - you'll need it for Step 4!

#### E. Deploy
Click **"Deploy"** and wait for build to complete.

---

### **Step 4: Deploy Service 3 - Admin Dashboard**

#### A. Create Service
1. Click **"+ New"** → **"GitHub Repo"**
2. Select your **same repository** again (3rd time)
3. Railway creates another service

#### B. Configure Service Settings
1. **Service Name:** `Admin Dashboard`
2. **Root Directory:** `admin-dashboard`
3. **Custom Build Command:** `cd admin-dashboard && npm install`
4. **Custom Start Command:** `cd admin-dashboard && node server.js`
5. **Watch Paths:** `admin-dashboard/**`

#### C. Add Environment Variables
```bash
# Link to Admin API (Use the URL you copied in Step 3D)
ADMIN_API_URL=https://admin-api-production-abc123.up.railway.app

# Environment
NODE_ENV=production
```

**⚠️ Critical:** Replace `admin-api-production-abc123.up.railway.app` with your actual Admin API domain from Step 3D!

#### D. Generate Public Domain
1. Go to **Settings** → **Networking**
2. Click **"Generate Domain"**
3. This is your admin dashboard URL - bookmark it!

#### E. Deploy
Click **"Deploy"** button.

---

### **Step 5: Create Admin User**

Your admin dashboard needs login credentials. Create an admin user:

#### Option A: Using Railway CLI
```bash
# Install Railway CLI
npm i -g @railway/cli

# Login to Railway
railway login

# Link to your Admin API service
railway link

# Run create-admin script
railway run npm run create-admin
```

#### Option B: Using Railway Console
1. Go to your **Admin API** service
2. Click **Deployments** → Latest deployment → **View Logs**
3. Click **"Terminal"** icon (console access)
4. Run: `npm run create-admin`
5. Enter username, password when prompted

---

## ✅ Verification Checklist

Test your deployment:

### 1. **PostgreSQL Database**
```bash
# In any service terminal
railway run node -e "const {Pool}=require('pg');const pool=new Pool();pool.query('SELECT NOW()').then(r=>console.log(r.rows))"
```
Expected: Current timestamp

### 2. **Main Bot**
- Open Telegram and message your bot
- Send `/start` command
- Should receive welcome message
- Check Railway logs for connection confirmations

### 3. **Admin API**
```bash
curl https://your-admin-api-url.up.railway.app/health
```
Expected: `{"status":"ok","timestamp":"..."}`

### 4. **Admin Dashboard**
- Open your dashboard URL in browser
- Should see login page
- Login with credentials from Step 5
- Should see admin panel with statistics

---

## 🔧 Common Issues & Fixes

### ❌ Issue: "Cannot find module"
**Solution:** Check `buildCommand` includes `cd <directory> &&` prefix for monorepo services

### ❌ Issue: Admin Dashboard can't connect to API
**Solution:** 
1. Verify `ADMIN_API_URL` in Dashboard service
2. Check Admin API has public domain generated
3. Ensure Admin API is running (check logs)

### ❌ Issue: Database connection errors
**Solution:**
1. Verify all services have `DATABASE_URL=${{Postgres.DATABASE_URL}}`
2. Check PostgreSQL service is running
3. Ensure no hardcoded database credentials

### ❌ Issue: Bot not responding in Telegram
**Solution:**
1. Check `TELEGRAM_BOT_TOKEN` is correct
2. Verify bot service is running (green status)
3. Check logs for errors: `Error: 401 Unauthorized` = wrong token

### ❌ Issue: Build fails with TypeScript errors
**Solution:**
1. Verify `buildCommand` includes `npm run build`
2. Check local build works: `npm install && npm run build`
3. Ensure `tsconfig.json` exists in service directory

### ❌ Issue: Services keep restarting
**Solution:**
1. Check logs for crash errors
2. Verify `PORT` is not hardcoded (Railway assigns it automatically)
3. Ensure all required environment variables are set

---

## 📊 Cost Breakdown

### Railway Pricing (Pay-as-you-go)

| Resource | Usage | Cost |
|----------|-------|------|
| **PostgreSQL** | 500MB storage | $0/month (included) |
| **Zinochain Bot** | ~100MB RAM | ~$2/month |
| **Admin API** | ~100MB RAM | ~$2/month |
| **Admin Dashboard** | ~100MB RAM | ~$2/month |
| **Network** | 100GB/month | Included |
| **Total** | | **~$6/month** |

**💰 Savings:** ~$19-44/month vs Replit

**Free Tier:**
- Railway gives $5 free credit/month
- First month ~$1 out of pocket
- Cancel anytime, no minimum commitment

---

## 🔐 Security Best Practices

1. **Never commit secrets** to GitHub
   - All secrets are in Railway environment variables
   - Add `.env` to `.gitignore` (already done)

2. **Use strong encryption keys**
   ```bash
   # Generate secure 32-character keys
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

3. **Enable Railway's Private Networking**
   - Admin API <-> Bot communication can use internal URLs
   - Reduces exposure to internet

4. **Use environment-specific RPC URLs**
   - Development: Free public RPCs
   - Production: Paid providers (Alchemy, Infura) for reliability

---

## 🚀 Production Optimizations

### 1. Use Private Networking
Instead of public URLs, use Railway's internal networking:

**Admin Dashboard** `.env`:
```bash
# Use internal URL (no internet traffic)
ADMIN_API_URL=${{Admin API.RAILWAY_PRIVATE_DOMAIN}}
```

### 2. Set Resource Limits
In each service **Settings** → **Resources**:
- **CPU:** 0.5 vCPU
- **Memory:** 512MB
Prevents runaway costs.

### 3. Enable Auto-scaling (Pro Plan)
For production traffic, enable replicas in **Settings**.

### 4. Add Custom Domain
**Settings** → **Networking** → **Custom Domain**:
- Admin Dashboard: `admin.yourdomain.com`
- Admin API: `api.yourdomain.com`

### 5. Set Up Monitoring
Use Railway's built-in metrics:
- CPU/Memory usage graphs
- Deployment history
- Crash alerts

---

## 📚 Useful Railway Commands

```bash
# Install CLI
npm i -g @railway/cli

# Login
railway login

# Link to project
railway link

# View logs
railway logs

# Run commands in production
railway run <command>

# Open service in browser
railway open

# SSH into container
railway shell
```

---

## 🔄 Update Deployment

When you push to GitHub, Railway auto-deploys:

1. Commit and push changes:
   ```bash
   git add .
   git commit -m "Update bot features"
   git push origin main
   ```

2. Railway detects changes and rebuilds automatically
3. Watch deployment in Railway dashboard

**Manual Deploy:**
- Click service → **Deployments** → **Deploy**

---

## 🆘 Support & Resources

- **Railway Docs:** https://docs.railway.app
- **Railway Discord:** https://discord.gg/railway
- **Railway Status:** https://status.railway.app
- **This Bot's Repo:** Your GitHub repo URL

---

## 📝 Environment Variables Reference

See [`ENV_VARIABLES.md`](./ENV_VARIABLES.md) for complete list of all environment variables with descriptions.

---

**🎉 Congratulations!** Your Zinochain Bot is now live on Railway with significant cost savings!

**Next Steps:**
1. Test all features (wallet creation, swaps, transfers)
2. Monitor logs for errors
3. Set up alerting for critical issues
4. Share your bot with users!
