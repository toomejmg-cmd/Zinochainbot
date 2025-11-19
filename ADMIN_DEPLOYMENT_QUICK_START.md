# 🚀 Admin Dashboard - Quick Deployment Guide

**⏱️ Time:** 10-15 minutes  
**Cost:** ~$2-4/month

---

## 🔑 Generated Secrets (Use These!)

```bash
# JWT Secret for Admin API
JWT_SECRET=23aab7766c3a1c1b77fa2d04119ec3f676facd5dde0ec9c61bf9cc3d23c6fff14e9e78985394d06fd1a1385fbd173459f3effba135cd437977bbcfeed8302943
```

*(Already generated for you - copy from above)*

---

## 📦 Step 1: Deploy Admin API (Backend)

### **In Railway Dashboard:**

1. Click **"+ New"** → **"Empty Service"**
2. **Name:** `Zinochain Admin API`
3. **Settings** → **Service Name:** `admin-api`

### **Deploy Settings:**

**Build Command:**
```bash
cd admin-api && npm install --include=dev && npm run build
```

**Start Command:**
```bash
cd admin-api && node dist/index.js
```

### **Environment Variables:**

Click **Variables** tab and add:

```
DATABASE_URL=${{Postgres.DATABASE_URL}}
SESSION_SECRET=${{SESSION_SECRET}}
JWT_SECRET=23aab7766c3a1c1b77fa2d04119ec3f676facd5dde0ec9c61bf9cc3d23c6fff14e9e78985394d06fd1a1385fbd173459f3effba135cd437977bbcfeed8302943
NODE_ENV=production
ADMIN_DASHBOARD_URL=https://will-set-after-step2.railway.app
```

### **Enable Public Access:**

1. **Settings** → **Networking**
2. Click **"Generate Domain"**
3. **📋 COPY THIS URL** - you need it for Step 2!

**Example:** `https://admin-api-production-abc123.up.railway.app`

---

## 🖥️ Step 2: Deploy Admin Dashboard (Frontend)

### **In Railway Dashboard:**

1. Click **"+ New"** → **"Empty Service"**
2. **Name:** `Zinochain Admin Dashboard`
3. **Settings** → **Service Name:** `admin-dashboard`

### **Deploy Settings:**

**Build Command:**
```bash
cd admin-dashboard && npm install
```

**Start Command:**
```bash
cd admin-dashboard && node server.js
```

### **Environment Variables:**

Click **Variables** tab and add:

```
PORT=5000
ADMIN_API_URL=https://admin-api-production-abc123.up.railway.app
NODE_ENV=production
```

**⚠️ Replace** `https://admin-api-production-abc123.up.railway.app` with YOUR Admin API URL from Step 1!

### **Enable Public Access:**

1. **Settings** → **Networking**
2. Click **"Generate Domain"**
3. **🔖 BOOKMARK THIS URL** - this is your admin dashboard!

**Example:** `https://admin-dashboard-production-xyz789.up.railway.app`

---

## 🔄 Step 3: Update Admin API CORS

Go back to **Admin API** service:

1. Click **Variables**
2. Update `ADMIN_DASHBOARD_URL` with your dashboard URL from Step 2
3. **Click "Redeploy"** button

---

## 👤 Step 4: Create Admin User

You need an admin account to login!

### **Get Your Telegram ID:**

1. Open Telegram
2. Message [@userinfobot](https://t.me/userinfobot)
3. Copy your ID (numbers like `123456789`)

### **Add Admin User to Database:**

**Quick Method - Use our script:**

From this Replit, run:

```bash
node admin-api/scripts/create-admin.js
```

Follow the prompts and enter your Telegram ID.

**OR Manual Method - Run SQL:**

```sql
INSERT INTO admin_users (telegram_id, role)
VALUES (YOUR_TELEGRAM_ID_HERE, 'admin')
ON CONFLICT (telegram_id) DO NOTHING;
```

Replace `YOUR_TELEGRAM_ID_HERE` with your actual Telegram ID!

---

## ✅ Step 5: Test & Login

### **1. Test API Health:**

Open in browser:
```
https://your-admin-api-url.railway.app/health
```

Should see:
```json
{"status": "ok", "timestamp": "..."}
```

### **2. Open Admin Dashboard:**

Visit your dashboard URL:
```
https://your-admin-dashboard-url.railway.app
```

### **3. Login:**

- **Username:** Your Telegram ID (e.g., `123456789`)
- **Password:** Create one during first login or set in database

---

## 🎉 You're Done!

Your admin dashboard is now live! You can:

- 📊 Monitor bot users and transactions
- ⚙️ Adjust bot settings and fees
- 💰 Manage referral system
- 👥 Add more admin users
- 📈 View analytics and charts

---

## 🐛 Common Issues

**Dashboard shows "API connection failed":**
- Check `ADMIN_API_URL` variable matches your API URL
- Ensure Admin API is running (check Railway logs)

**Can't login:**
- Verify your Telegram ID is in `admin_users` table
- Check Railway PostgreSQL → Data tab → admin_users table

**CORS errors:**
- Verify `ADMIN_DASHBOARD_URL` in Admin API matches dashboard URL
- Redeploy Admin API after updating CORS

---

## 📊 Total Railway Costs

| Service | Monthly Cost |
|---------|--------------|
| Main Bot | $5-10 |
| Admin API | $1-2 |
| Admin Dashboard | $1-2 |
| PostgreSQL | Included |
| **TOTAL** | **$7-14/month** |

**vs Replit:** $25-50/month  
**Savings:** 50-70% 💰

---

**Need help?** Check the detailed guide: `RAILWAY_ADMIN_DEPLOYMENT.md`
