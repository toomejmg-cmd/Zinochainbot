const bcrypt = require('bcrypt');
const { Client } = require('pg');

async function createAdmin() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  try {
    await client.connect();
    console.log('Connected to database');

    const telegramId = '999999';
    const password = 'youngempire';
    const role = 'super_admin';
    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await client.query(
      `INSERT INTO admin_users (telegram_id, password_hash, role, created_at) 
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP) 
       ON CONFLICT (telegram_id) DO UPDATE 
       SET password_hash = EXCLUDED.password_hash
       RETURNING id, telegram_id, role, created_at`,
      [telegramId, hashedPassword, role]
    );

    console.log('✅ Admin account created successfully!');
    console.log('Telegram ID:', result.rows[0].telegram_id);
    console.log('User ID:', result.rows[0].id);
    console.log('Role:', result.rows[0].role);
    console.log('Created at:', result.rows[0].created_at);
    console.log('\n🔐 LOGIN CREDENTIALS:');
    console.log('Telegram ID: 999999');
    console.log('Password: youngempire');

  } catch (error) {
    console.error('Error creating admin:', error.message);
  } finally {
    await client.end();
  }
}

createAdmin();
