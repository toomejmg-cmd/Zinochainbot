import { readFileSync } from 'fs';
import { join } from 'path';
import pool from './db';

async function runMigration() {
  try {
    console.log('🔧 Running database migrations...');
    
    const migrationSQL = readFileSync(join(__dirname, 'migrate.sql'), 'utf-8');
    
    await pool.query(migrationSQL);
    
    console.log('✅ Database migrations completed successfully!');
    console.log('New tables: admin_users, user_settings, fees_collected, referrals');
    console.log('Updated tables: users (referral columns), transactions (fee_amount)');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error running migrations:', error);
    process.exit(1);
  }
}

runMigration();
