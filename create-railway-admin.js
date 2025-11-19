/**
 * Create Admin User for Railway Deployment
 * 
 * This script creates an admin user in your Railway PostgreSQL database.
 * Run this from Replit to add yourself as an admin.
 * 
 * Usage: node create-railway-admin.js "RAILWAY_DATABASE_URL"
 */

const { Client } = require('pg');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function ask(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

async function createRailwayAdmin() {
  const databaseUrl = process.argv[2];

  if (!databaseUrl) {
    console.error('\n❌ Please provide your Railway DATABASE_URL\n');
    console.log('Usage: node create-railway-admin.js "YOUR_DATABASE_URL"\n');
    console.log('Get your DATABASE_URL from Railway:');
    console.log('1. Go to Railway Dashboard');
    console.log('2. Click PostgreSQL service');
    console.log('3. Click "Connect" button');
    console.log('4. Copy the connection string\n');
    process.exit(1);
  }

  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('\n🔐 CREATE ADMIN USER FOR RAILWAY\n');
    console.log('==========================================\n');

    // Get Telegram ID
    console.log('📱 First, get your Telegram ID:');
    console.log('   1. Open Telegram');
    console.log('   2. Message @userinfobot');
    console.log('   3. Copy the ID it sends you\n');

    const telegramId = await ask('Enter your Telegram ID: ');

    if (!telegramId || isNaN(telegramId)) {
      console.error('❌ Invalid Telegram ID. Must be a number.');
      process.exit(1);
    }

    // Connect to database
    console.log('\n📡 Connecting to Railway PostgreSQL...');
    await client.connect();
    console.log('✅ Connected!\n');

    // Check if admin_users table has password_hash column
    const columnsResult = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'admin_users'
    `);

    const hasPasswordHash = columnsResult.rows.some(row => row.column_name === 'password_hash');

    // Insert admin user
    let result;
    if (hasPasswordHash) {
      // Table has password_hash column - add with null (will set on first login)
      result = await client.query(
        `INSERT INTO admin_users (telegram_id, role, password_hash)
         VALUES ($1, 'admin', NULL)
         ON CONFLICT (telegram_id) DO UPDATE SET role = 'admin'
         RETURNING id, telegram_id, role`,
        [telegramId]
      );
    } else {
      // Table doesn't have password_hash - simple insert
      result = await client.query(
        `INSERT INTO admin_users (telegram_id, role)
         VALUES ($1, 'admin')
         ON CONFLICT (telegram_id) DO UPDATE SET role = 'admin'
         RETURNING id, telegram_id, role`,
        [telegramId]
      );
    }

    console.log('==========================================');
    console.log('✅ ADMIN USER CREATED SUCCESSFULLY!');
    console.log('==========================================\n');
    console.log(`Telegram ID: ${result.rows[0].telegram_id}`);
    console.log(`Role: ${result.rows[0].role}`);
    console.log(`Database ID: ${result.rows[0].id}\n`);
    console.log('🎉 You can now login to the admin dashboard!');
    console.log(`   Username: ${telegramId}`);
    console.log('   Password: Set during first login\n');

  } catch (error) {
    console.error('\n❌ Error creating admin user:', error.message);
    console.error('\nDetails:', error);
    process.exit(1);
  } finally {
    await client.end();
    rl.close();
  }
}

createRailwayAdmin();
