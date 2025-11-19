# 🔧 Railway Deployment Troubleshooting Guide

Quick fixes for common Railway deployment crashes and errors.

---

## 🚨 Service Keeps Crashing

### **Check 1: View Deployment Logs**

1. Go to Railway dashboard → Click your service
2. Click **"Deployments"** tab
3. Click the latest deployment
4. Click **"View Logs"** (scroll down)
5. Look for error messages in red

**Common error patterns:**

#### ❌ "Error: Cannot find module"
```
Error: Cannot find module 'express'
```

**Cause:** Dependencies not installed  
**Fix:** Check your `buildCommand` includes `npm install`

For monorepo services:
```json
{
  "build": {
    "buildCommand": "cd admin-api && npm install && npm run build"
  }
}
```

---

#### ❌ "EADDRINUSE: address already in use"
```
Error: listen EADDRINUSE: address already in use :::3001
```

**Cause:** Hardcoded port instead of using Railway's `PORT` variable  
**Fix:** ✅ **Already fixed in your code!** All services now use `process.env.PORT`

---

#### ❌ "connect ECONNREFUSED"
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Cause:** Database connection not configured  
**Fix:** Add environment variable:
```bash
DATABASE_URL=${{Postgres.DATABASE_URL}}
```

---

#### ❌ "Missing environment variable"
```
Error: TELEGRAM_BOT_TOKEN is required
```

**Cause:** Environment variable not set  
**Fix:** Go to service → **Variables** tab → Add the missing variable

---

#### ❌ "listen EADDRNOTAVAIL"
```
Error: listen EADDRNOTAVAIL: address not available
```

**Cause:** Binding to wrong address (localhost instead of 0.0.0.0)  
**Fix:** ✅ **Already fixed!** All services bind to `0.0.0.0`

---

## 🔍 Debugging Steps

### Step 1: Check Build Logs
1. Service → Deployments → Latest → **Build Logs**
2. Look for TypeScript compilation errors
3. Ensure `npm install` completes successfully

### Step 2: Check Runtime Logs
1. Service → Deployments → Latest → **Deploy Logs**
2. Look for the first error after "Starting..."
3. Copy the error message

### Step 3: Verify Configuration

#### For **Main Bot** (Root Directory: `/`)
```bash
# Build Command
npm install && npm run build

# Start Command
node dist/index.js

# Required Environment Variables
DATABASE_URL=${{Postgres.DATABASE_URL}}
TELEGRAM_BOT_TOKEN=<your_token>
ENCRYPTION_KEY=<32_char_random>
SESSION_SECRET=<32_char_random>
NODE_ENV=production
```

#### For **Admin API** (Root Directory: `admin-api`)
```bash
# Build Command
cd admin-api && npm install && npm run build

# Start Command
cd admin-api && node dist/index.js

# Required Environment Variables
DATABASE_URL=${{Postgres.DATABASE_URL}}
SESSION_SECRET=${{Zinochain Bot.SESSION_SECRET}}
ENCRYPTION_KEY=${{Zinochain Bot.ENCRYPTION_KEY}}
NODE_ENV=production
```

**⚠️ Do NOT set PORT manually** - Railway provides it automatically

#### For **Admin Dashboard** (Root Directory: `admin-dashboard`)
```bash
# Build Command
cd admin-dashboard && npm install

# Start Command
cd admin-dashboard && node server.js

# Required Environment Variables
ADMIN_API_URL=https://your-admin-api.up.railway.app
NODE_ENV=production
```

---

## 🐛 Specific Error Solutions

### "Application failed to respond"

**Symptoms:** Service starts but shows "Application Failed to Respond"

**Solutions:**

1. **Check healthcheck path:**
   - Main Bot: No healthcheck (it's a Telegram bot, not web server)
   - Admin API: `/health`
   - Admin Dashboard: `/`

2. **Disable healthcheck for bot:**
   - Go to Main Bot service
   - Settings → Deploy
   - Remove any healthcheck configuration

3. **Verify port binding:**
   All services should use:
   ```javascript
   const PORT = parseInt(process.env.PORT || '3001', 10);
   app.listen(PORT, '0.0.0.0', () => {
     console.log(`Server running on ${PORT}`);
   });
   ```

---

### "Module build failed"

**Symptoms:** TypeScript compilation errors during build

**Solutions:**

1. **Test build locally first:**
   ```bash
   # For main bot
   npm install && npm run build
   
   # For admin-api
   cd admin-api && npm install && npm run build
   
   # For admin-dashboard
   cd admin-dashboard && npm install
   ```

2. **Check TypeScript version:**
   Ensure all `package.json` have TypeScript 5.x:
   ```json
   "devDependencies": {
     "typescript": "^5.3.3"
   }
   ```

3. **Verify tsconfig.json exists** in the correct directory

---

### "Database connection failed"

**Symptoms:** `error: no pg_hba.conf entry for host`

**Solutions:**

1. **Use Railway's reference variable:**
   ```bash
   DATABASE_URL=${{Postgres.DATABASE_URL}}
   ```
   NOT a hardcoded string!

2. **Check PostgreSQL service is running:**
   - Dashboard → PostgreSQL service
   - Should show green "Active" status

3. **Verify database was created:**
   - Click Postgres service → Data tab
   - Should see connection info

---

### "Admin Dashboard can't reach API"

**Symptoms:** Login page loads but login fails with network error

**Solutions:**

1. **Check Admin API is running:**
   ```bash
   curl https://your-admin-api-url.up.railway.app/health
   ```
   Should return: `{"status":"ok",...}`

2. **Verify ADMIN_API_URL is set correctly:**
   - Admin Dashboard → Variables
   - `ADMIN_API_URL` should be the **full URL** including `https://`
   - Example: `https://admin-api-production-abc123.up.railway.app`

3. **Check CORS settings:**
   Admin API automatically allows all origins in production. If issues persist:
   - Check Admin API logs for CORS errors
   - Verify Admin Dashboard domain is not blocked

---

## 🔧 Railway Configuration Files

Your project has 3 `railway.json` files (one per service):

### `/railway.json` (Main Bot)
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "npm install && npm run build",
    "watchPatterns": ["src/**", "package.json", "tsconfig.json"]
  },
  "deploy": {
    "startCommand": "node dist/index.js",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10,
    "healthcheckPath": "/",
    "healthcheckTimeout": 100
  }
}
```

### `/admin-api/railway.json`
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "cd admin-api && npm install && npm run build",
    "watchPatterns": ["admin-api/src/**", "admin-api/package.json", "admin-api/tsconfig.json"]
  },
  "deploy": {
    "startCommand": "cd admin-api && node dist/index.js",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10,
    "healthcheckPath": "/health",
    "healthcheckTimeout": 100
  }
}
```

### `/admin-dashboard/railway.json`
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "cd admin-dashboard && npm install",
    "watchPatterns": ["admin-dashboard/server.js", "admin-dashboard/public/**", "admin-dashboard/package.json"]
  },
  "deploy": {
    "startCommand": "cd admin-dashboard && node server.js",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10,
    "healthcheckPath": "/",
    "healthcheckTimeout": 100
  }
}
```

**⚠️ Important:** These files are configured correctly - Railway should auto-detect them when you set the Root Directory.

---

## 🎯 Deployment Checklist

Before asking for help, verify:

- [ ] PostgreSQL service is running (green status)
- [ ] All 3 services have correct Root Directory set
- [ ] Build commands include `cd <directory> &&` for admin-api and admin-dashboard
- [ ] All required environment variables are set (see above)
- [ ] Admin API has a generated public domain
- [ ] `ADMIN_API_URL` in Dashboard points to Admin API's public URL
- [ ] No hardcoded `PORT` values in environment variables
- [ ] Build logs show successful TypeScript compilation
- [ ] Runtime logs don't show connection errors

---

## 🆘 Still Crashing?

### Get Help with Logs

1. **Copy deployment logs:**
   - Service → Deployments → Latest deployment
   - Click "Copy Logs" button
   - Share in support channels

2. **Check Railway status:**
   - Visit https://status.railway.app
   - Look for ongoing incidents

3. **Test locally:**
   ```bash
   # Set environment variables
   export DATABASE_URL="your_railway_database_url"
   export TELEGRAM_BOT_TOKEN="your_token"
   export ENCRYPTION_KEY="your_key"
   export SESSION_SECRET="your_secret"
   export PORT=3001
   
   # Run main bot
   npm install && npm run build && node dist/index.js
   
   # Run admin-api
   cd admin-api && npm install && npm run build && node dist/index.js
   
   # Run admin-dashboard
   cd admin-dashboard && npm install && node server.js
   ```

4. **Join Railway Discord:**
   - https://discord.gg/railway
   - #help channel for deployment issues

---

## ✅ Success Indicators

Your services are working when:

### Main Bot:
- Logs show: `✅ Zinochain Bot is ready!`
- Telegram responds to `/start` command
- No crash loops in Railway

### Admin API:
- Logs show: `🔐 Admin API running on port XXXX`
- `curl https://your-api.up.railway.app/health` returns JSON
- No database connection errors

### Admin Dashboard:
- Logs show: `📊 Admin Dashboard running on http://0.0.0.0:XXXX`
- Login page loads in browser
- Can login successfully with admin credentials

---

**💡 Pro Tip:** Railway deployments typically take 2-3 minutes. If a service crashes immediately (< 30 seconds), it's usually a configuration issue (missing env vars, wrong commands). If it crashes after running for a while, check for runtime errors in logs.
