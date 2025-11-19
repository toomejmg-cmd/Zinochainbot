# 📊 Railway Admin Dashboard Deployment Guide

This guide will help you deploy the Admin API and Admin Dashboard to Railway.

---

## 🏗️ Architecture Overview

Your admin system has **2 separate services**:

1. **Admin API** (Backend) - REST API on port 3001 → Railway will assign dynamic port
2. **Admin Dashboard** (Frontend) - Web interface on port 5000 → Must use Railway's public URL

---

## 📋 Step-by-Step Deployment

### **Step 1: Deploy Admin API**

1. **In Railway Dashboard**, click **"+ New"** → **"Empty Service"**
2. **Name it:** `Zinochain Admin API`
3. **Click "Settings"** tab
4. **Scroll to "Service Name"** and set it to `admin-api`

#### **Configure Build & Start:**

**In "Settings" → "Deploy":**
- **Build Command:** `cd admin-api && npm install --include=dev && npm run build`
- **Start Command:** `cd admin-api && node dist/index.js`

#### **Set Environment Variables:**

Click **"Variables"** tab and add these:

```
DATABASE_URL=${{Postgres.DATABASE_URL}}
SESSION_SECRET=${{SESSION_SECRET}}
JWT_SECRET=your-jwt-secret-here-generate-random-32-chars
NODE_ENV=production
ADMIN_DASHBOARD_URL=https://your-admin-dashboard.railway.app
```

**Generate JWT_SECRET:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

#### **Enable Public Networking:**

1. In **Settings** → **Networking**
2. Click **"Generate Domain"**
3. Copy the URL (e.g., `https://admin-api-production.up.railway.app`)
4. **Save this URL** - you'll need it for Step 2!

---

### **Step 2: Deploy Admin Dashboard**

1. **In Railway Dashboard**, click **"+ New"** → **"Empty Service"**
2. **Name it:** `Zinochain Admin Dashboard`
3. **Click "Settings"** tab
4. **Scroll to "Service Name"** and set it to `admin-dashboard`

#### **Configure Build & Start:**

**In "Settings" → "Deploy":**
- **Build Command:** `cd admin-dashboard && npm install`
- **Start Command:** `cd admin-dashboard && node server.js`

#### **Set Environment Variables:**

Click **"Variables"** tab and add these:

```
PORT=5000
ADMIN_API_URL=https://admin-api-production.up.railway.app
NODE_ENV=production
```

**Replace** `https://admin-api-production.up.railway.app` with the URL from Step 1!

#### **Enable Public Networking:**

1. In **Settings** → **Networking**
2. Click **"Generate Domain"**
3. Copy the URL (e.g., `https://admin-dashboard-production.up.railway.app`)
4. **This is your admin dashboard URL!** Bookmark it!

---

### **Step 3: Update Admin API CORS**

Go back to **Admin API** service:

1. Click **"Variables"** tab
2. Update `ADMIN_DASHBOARD_URL` to the dashboard URL from Step 2
3. Example: `https://admin-dashboard-production.up.railway.app`

**Redeploy Admin API** for CORS settings to take effect.

---

### **Step 4: Create Admin User**

You need to create an admin account to login.

#### **Option 1: Using Railway CLI (Recommended)**

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Link to your project
railway link

# Run create-admin script
railway run --service admin-api npm run create-admin
```

Follow the prompts to create your admin account.

#### **Option 2: Using SQL (Quick Method)**

Run this SQL on your Railway PostgreSQL:

```sql
-- Insert admin user (telegram_id must be YOUR Telegram ID)
INSERT INTO admin_users (telegram_id, role)
VALUES (123456789, 'admin')
ON CONFLICT (telegram_id) DO NOTHING;
```

**Get your Telegram ID:**
- Message [@userinfobot](https://t.me/userinfobot) on Telegram
- It will reply with your user ID

---

## 🧪 Testing the Deployment

### **1. Check Admin API Health**

Open in browser:
```
https://your-admin-api-url.railway.app/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2025-11-19T12:00:00.000Z"
}
```

### **2. Access Admin Dashboard**

Open in browser:
```
https://your-admin-dashboard-url.railway.app
```

Expected: Login page appears

### **3. Login to Dashboard**

Use your Telegram ID as username (that you added to `admin_users` table)

---

## 🔐 Security Recommendations

### **1. Set Strong JWT Secret**

Generate a secure random secret:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Update `JWT_SECRET` in Admin API environment variables.

### **2. Restrict Dashboard URL**

In **Admin API** variables, set:
```
ADMIN_DASHBOARD_URL=https://your-exact-dashboard-url.railway.app
```

This prevents unauthorized origins from accessing the API.

### **3. Add Admin Users Carefully**

Only add trusted Telegram IDs to the `admin_users` table:

```sql
INSERT INTO admin_users (telegram_id, role)
VALUES (your_telegram_id, 'admin');
```

---

## 📊 Admin Dashboard Features

Once logged in, you can:

- ✅ **View Users** - See all bot users and their activity
- ✅ **Monitor Transactions** - Track all trades and transfers
- ✅ **Manage Fees** - Adjust trading fees and wallet addresses
- ✅ **Referral System** - View referral stats and payouts
- ✅ **Bot Settings** - Enable/disable bot, maintenance mode
- ✅ **Admin Management** - Add/remove admin users
- ✅ **Analytics** - View charts and statistics

---

## 🐛 Troubleshooting

### **Issue: Admin Dashboard shows "API connection failed"**

**Solution:**
1. Check `ADMIN_API_URL` in dashboard environment variables
2. Ensure Admin API is running and accessible
3. Test API health endpoint directly

### **Issue: CORS errors in browser console**

**Solution:**
1. Verify `ADMIN_DASHBOARD_URL` in Admin API variables matches the dashboard URL
2. Redeploy Admin API after changing CORS settings

### **Issue: Can't login to dashboard**

**Solution:**
1. Verify your Telegram ID is in `admin_users` table:
   ```sql
   SELECT * FROM admin_users;
   ```
2. Ensure you're using the correct Telegram ID (not username)

---

## 💰 Railway Costs

**Admin Services Cost:**
- **Admin API:** ~$1-2/month (minimal traffic)
- **Admin Dashboard:** ~$1-2/month (static frontend + proxy)

**Total Admin Cost:** ~$2-4/month

**Combined Total (Bot + Admin):**
- Main Bot: $5-10/month
- Admin Services: $2-4/month
- **Grand Total: $7-14/month** (vs $25-50 on Replit)

**Savings: 50-70%!** 💰

---

## ✅ Deployment Checklist

- [ ] Deploy Admin API service
- [ ] Generate Admin API public domain
- [ ] Set Admin API environment variables (DATABASE_URL, JWT_SECRET, etc.)
- [ ] Deploy Admin Dashboard service
- [ ] Generate Admin Dashboard public domain
- [ ] Set Dashboard environment variables (ADMIN_API_URL, PORT)
- [ ] Update Admin API CORS settings with dashboard URL
- [ ] Create admin user in database
- [ ] Test API health endpoint
- [ ] Test dashboard login
- [ ] Bookmark admin dashboard URL

---

## 🎯 Next Steps After Deployment

1. **Create your admin account** using Step 4 above
2. **Login to dashboard** and explore features
3. **Configure bot settings** (fees, maintenance mode, etc.)
4. **Monitor bot activity** through the dashboard
5. **Add more admin users** if needed (trusted team members)

---

**Your admin system is ready to deploy!** 🚀

Follow the steps above and let me know if you encounter any issues!
