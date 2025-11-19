const { Client } = require('pg');
const fs = require('fs');

async function setupDatabase() {
  console.log('========================================');
  console.log('Railway Database Setup');
  console.log('========================================\n');

  // Get DATABASE_URL from command line argument
  const databaseUrl = process.argv[2];

  if (!databaseUrl) {
    console.error('❌ ERROR: No DATABASE_URL provided!\n');
    console.log('Usage: node setup-railway-database.js "YOUR_DATABASE_URL"\n');
    console.log('Get your DATABASE_URL from Railway:');
    console.log('1. Go to Railway Dashboard');
    console.log('2. Click PostgreSQL service');
    console.log('3. Click "Variables" tab');
    console.log('4. Copy the DATABASE_URL value\n');
    process.exit(1);
  }

  // Read the SQL setup script
  let sqlScript;
  try {
    sqlScript = fs.readFileSync('railway-db-setup.sql', 'utf8');
    console.log('✅ SQL setup script loaded');
  } catch (error) {
    console.error('❌ Error reading railway-db-setup.sql:', error.message);
    process.exit(1);
  }

  // Connect to database
  const client = new Client({
    connectionString: databaseUrl,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    console.log('📡 Connecting to Railway PostgreSQL...');
    await client.connect();
    console.log('✅ Connected successfully!\n');

    console.log('📝 Creating database tables...');
    console.log('   (This may take 10-15 seconds)\n');

    // Execute the SQL script
    await client.query(sqlScript);

    console.log('✅ Database setup completed successfully!\n');

    // Verify tables were created
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);

    console.log('========================================');
    console.log(`📊 Created ${result.rows.length} tables:`);
    console.log('========================================');
    result.rows.forEach((row, index) => {
      console.log(`${index + 1}. ${row.table_name}`);
    });
    console.log('========================================\n');

    console.log('🚀 Your Railway database is ready!');
    console.log('   You can now deploy your bot on Railway.\n');

  } catch (error) {
    console.error('❌ Database setup failed:', error.message);
    console.error('\nError details:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

setupDatabase();
