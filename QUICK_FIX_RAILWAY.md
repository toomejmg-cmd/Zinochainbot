# Railway Deployment Fix

## Current Issues & Solutions

### Issue 1: Admin Dashboard SIGTERM (Deployment Failed)
**Cause**: New deployment needs to be triggered from Railway, not just code push

**Fix**:
1. Go to your Railway project dashboard
2. Find the Admin Dashboard service
3. Click **"New Deployment"** (NOT "Redeploy") - this pulls latest code from GitHub
4. Wait for deployment to complete

### Issue 2: Bot Polling Conflict (Error: terminated by other getUpdates request)
**Cause**: Both Replit and Railway are running the bot simultaneously

**Solution - Choose ONE**:

#### Option A: Use Railway for Bot (Recommended for Production)
1. In Replit, remove or stop the "Zinobot" workflow
2. Go to Railway → Zinobot service
3. Ensure `NODE_ENV=production` is set
4. Click "New Deployment"
5. Bot will run only on Railway

#### Option B: Keep Bot on Replit (Development)
1. Go to Railway → Zinobot service
2. Click the three dots menu
3. Select "Remove from project" or disable it
4. Keep the Replit Zinobot workflow running instead

### Issue 3: Admin API Connection
**Required Environment Variables on Railway**:
```
ADMIN_API_URL=${{Admin API.RAILWAY_PUBLIC_DOMAIN}}
```
This is already configured if you used the Railway template.

### Issue 4: Admin Dashboard Can't Find API
**Fix**: Verify Admin API is running on Railway
1. Go to Railway → Admin API service
2. Check "Public Domain" exists and is not empty
3. If missing, click "Generate" to create a public URL
4. Copy that domain
5. Go to Admin Dashboard → Environment → Set:
   ```
   ADMIN_API_URL=<paste Admin API public domain>
   ```

## Verification Checklist

✅ Check 1: Admin API is running
```
Visit: https://your-admin-api-domain/health
Should see JSON with "status": "ok"
```

✅ Check 2: Admin Dashboard is running  
```
Visit: https://your-admin-dashboard-domain
Should load the dashboard
```

✅ Check 3: Bot is NOT running on both Replit and Railway
- Either stop Zinobot workflow in Replit, OR remove it from Railway
- NOT both running simultaneously

## Quick Deploy Command

After pushing code to GitHub:
```bash
# On Railway Web UI: 
# 1. Go to each service (Admin API, Admin Dashboard, Zinobot)
# 2. Click "New Deployment" to pull latest code
# 3. Wait for green checkmarks
```

## Environment Variables Needed on Railway

**Admin Dashboard**:
- `ADMIN_API_URL`: Admin API's public Railway domain
- `PORT`: 5000 (already set)

**Admin API**: 
- `DATABASE_URL`: (automatically set by Railway PostgreSQL plugin)
- `TELEGRAM_BOT_TOKEN`: Your bot token
- `ENCRYPTION_KEY`: Your encryption key
- Other variables from `.env.example`

**Zinobot**:
- `DATABASE_URL`: (automatically set by Railway PostgreSQL plugin)
- `TELEGRAM_BOT_TOKEN`: Your bot token
- `ENCRYPTION_KEY`: Your encryption key
- Other variables from `.env.example`

## Still Having Issues?

1. **Check logs**: Railway service → View logs
2. **Restart service**: Click three dots → Restart
3. **Force redeploy**: New Deployment → Yes
4. **Check public domains**: Services should have public URLs assigned
5. **Verify DATABASE_URL**: PostgreSQL should be attached to project
