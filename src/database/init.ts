import { readFileSync } from 'fs';
import { join } from 'path';
import pool from './db';

async function initDatabase() {
  try {
    console.log('🔧 Initializing database...');
    
    const schemaSQL = readFileSync(join(__dirname, 'schema.sql'), 'utf-8');
    
    await pool.query(schemaSQL);
    
    console.log('✅ Database initialized successfully!');
    console.log('Tables created: users, wallets, transactions, token_cache, orders, dca_jobs');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error initializing database:', error);
    process.exit(1);
  }
}

initDatabase();
