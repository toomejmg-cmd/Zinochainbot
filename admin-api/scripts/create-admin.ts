import bcrypt from 'bcrypt';
import { query } from '../src/database/db';
import * as readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function ask(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

async function createAdmin() {
  try {
    console.log('\n🔐 Create Admin Account\n');

    const telegramId = await ask('Enter Telegram ID: ');
    const password = await ask('Enter password: ');
    const confirmPassword = await ask('Confirm password: ');

    if (!telegramId || !password) {
      console.error('❌ Telegram ID and password are required');
      process.exit(1);
    }

    if (password !== confirmPassword) {
      console.error('❌ Passwords do not match');
      process.exit(1);
    }

    if (password.length < 8) {
      console.error('❌ Password must be at least 8 characters');
      process.exit(1);
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await query(
      `INSERT INTO admin_users (telegram_id, role, password_hash)
       VALUES ($1, 'admin', $2)
       ON CONFLICT (telegram_id) 
       DO UPDATE SET password_hash = $2
       RETURNING id, telegram_id, role`,
      [telegramId, passwordHash]
    );

    console.log('\n✅ Admin account created/updated successfully!');
    console.log(`   Telegram ID: ${result.rows[0].telegram_id}`);
    console.log(`   Role: ${result.rows[0].role}`);
    console.log('\n💡 You can now login to the admin dashboard\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating admin:', error);
    process.exit(1);
  }
}

createAdmin();
