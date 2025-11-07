# Zinobot Admin Dashboard

A secure, web-based admin dashboard for monitoring and managing your Zinobot Telegram trading bot.

## 🎯 Features

### Real-time Monitoring
- **Dashboard Overview**: Live stats including total users, active wallets, transactions, and fees collected
- **User Management**: View all users with search and filtering capabilities
- **Transaction Monitoring**: Real-time feed of all buy/sell transactions
- **Referral Tracking**: Monitor top referrers and rewards

### Admin Controls
- **Fee Management**: Adjust trading fees dynamically
- **User Analytics**: Detailed user profiles with transaction history
- **Statistics**: Comprehensive bot performance metrics

## 🔐 Security

- **JWT Authentication**: Secure token-based authentication
- **Password Hashing**: Bcrypt password hashing (10 rounds)
- **Rate Limiting**: Protection against brute-force attacks
- **CORS Protection**: Configured for specific origins
- **Admin-Only Access**: All routes require valid admin authentication

## 🚀 Getting Started

### 1. Create an Admin Account

Run the admin creation script:

```bash
cd admin-api
npm run create-admin
```

You'll be prompted for:
- Telegram ID (your Telegram user ID)
- Password (minimum 8 characters)
- Password confirmation

### 2. Access the Dashboard

The admin dashboard runs on **port 5000** and is automatically started with your Replit project.

1. Open your Replit webview
2. Navigate to the admin dashboard (port 5000)
3. Login with your Telegram ID and password

## 🏗️ Architecture

### Backend API (Port 3001)
```
admin-api/
├── src/
│   ├── routes/
│   │   ├── auth.ts       # Authentication endpoints
│   │   └── admin.ts      # Admin data endpoints
│   ├── middleware/
│   │   ├── auth.ts       # JWT verification
│   │   └── errorHandler.ts
│   ├── database/
│   │   └── db.ts         # PostgreSQL connection
│   └── index.ts          # Express server
└── scripts/
    └── create-admin.ts   # Admin account creation
```

### Frontend Dashboard (Port 5000)
```
admin-dashboard/
├── public/
│   ├── index.html        # Main SPA
│   └── js/
│       └── app.js        # Dashboard logic
└── server.js             # Express static server
```

## 📡 API Endpoints

### Authentication
- `POST /api/auth/login` - Login with Telegram ID and password
- `POST /api/auth/verify` - Verify JWT token validity

### Admin Data (Requires Authentication)
- `GET /api/admin/stats` - Get overall bot statistics
- `GET /api/admin/users` - List all users (with search and pagination)
- `GET /api/admin/users/:id` - Get detailed user information
- `GET /api/admin/transactions` - List all transactions (with filtering)
- `GET /api/admin/fees` - Get fee collection data
- `GET /api/admin/referrals` - Get referral statistics

## 🔧 Configuration

### Environment Variables

Set these in your Replit Secrets:

```env
# Admin API
ADMIN_API_PORT=3001
JWT_SECRET=your-secret-key-here

# Admin Dashboard
ADMIN_DASHBOARD_PORT=5000
```

### CORS Configuration

The API is configured to accept requests from:
- `*` (all origins) - configured via `ADMIN_DASHBOARD_URL` env variable
- Adjust in `admin-api/src/index.ts` for production

## 💡 Usage Tips

### Finding Your Telegram ID
1. Start a chat with @userinfobot on Telegram
2. It will reply with your user ID
3. Use this ID when creating admin accounts

### Security Best Practices
1. **Strong Passwords**: Use passwords with 12+ characters
2. **Unique Passwords**: Don't reuse passwords from other services
3. **Secure Access**: Only access dashboard over HTTPS (Replit provides this)
4. **Regular Updates**: Update admin passwords periodically

### Monitoring Tips
1. **Auto-Refresh**: Dashboard auto-refreshes every 10 seconds on the Overview page
2. **Manual Refresh**: Click the "Refresh" button anytime for latest data
3. **Search Users**: Use the search box on Users page to find specific users
4. **Filter Transactions**: View only buy or sell transactions using filters

## 🎨 Dashboard Pages

### Overview
- Four stat cards showing key metrics
- Recent activity feed (last 10 transactions)
- Auto-refreshes every 10 seconds

### Users
- Complete user list with search
- Shows wallet count and transaction count per user
- Pagination support (50 users per page)

### Transactions
- Detailed transaction history
- Type, user, amount, fee, time, and status
- Color-coded by transaction type (buy/sell)

### Referrals
- Top referrers leaderboard
- Referral codes and stats
- Total rewards earned

### Settings
- Bot configuration (coming soon)
- Admin management (coming soon)

## 🐛 Troubleshooting

### Can't Login
- Verify you created an admin account with `npm run create-admin`
- Check that password_hash column exists in admin_users table
- Ensure Telegram ID is correct (check @userinfobot)

### API Connection Error
- Verify Admin API is running on port 3001
- Check browser console for CORS errors
- Ensure both API and Dashboard workflows are active

### No Data Showing
- Check that Telegram bot has users and transactions
- Verify database connection is working
- Look at Admin API logs for errors

## 📊 Database Schema

### admin_users Table
```sql
CREATE TABLE admin_users (
    id SERIAL PRIMARY KEY,
    telegram_id BIGINT UNIQUE NOT NULL,
    role VARCHAR(20) DEFAULT 'admin',
    password_hash VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 🔒 Security Notes

⚠️ **Important**:
- Never share your admin password
- Don't expose admin Telegram IDs publicly
- Always use HTTPS in production
- Keep JWT_SECRET secret and complex
- Regularly review admin access logs

## 🚀 Deployment

The admin dashboard is deployed automatically on Replit:
1. **Admin API**: Runs on port 3001 (internal)
2. **Admin Dashboard**: Runs on port 5000 (web preview)
3. **Auto-start**: Both start with your Replit project

For production:
1. Set proper CORS origins
2. Use strong JWT secret
3. Enable HTTPS only
4. Set up monitoring and alerts
5. Regular security audits

## 📝 Development

### Adding New Features
1. Add API endpoints in `admin-api/src/routes/admin.ts`
2. Create frontend page in `admin-dashboard/public/index.html`
3. Add logic in `admin-dashboard/public/js/app.js`
4. Test thoroughly before deploying

### Testing
```bash
# Test API
curl http://localhost:3001/health

# Test Dashboard
# Open browser to http://localhost:5000
```

## 📞 Support

For issues:
1. Check logs in Replit console
2. Verify database connection
3. Review API endpoint responses
4. Check browser console for errors

---

**Version**: 1.0.0  
**Last Updated**: November 2025  
**License**: MIT
