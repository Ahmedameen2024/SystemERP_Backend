/**
 * Migration Runner: Purchasing Module Complete
 */
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const config = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'postgres',
  ssl: process.env.DB_HOST && process.env.DB_HOST !== 'localhost' ? { rejectUnauthorized: false } : false,
};

async function runMigration() {
  const client = new Client(config);
  try {
    await client.connect();
    console.log('✅ Connected to database');

    const migrationPath = path.join(__dirname, 'migrate_purchasing_complete.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('⏳ Running purchasing migration...');
    await client.query(sql);
    console.log('✅ Migration completed successfully!');
    
  } catch (err) {
    console.error('❌ Migration error:', err.message);
    if (err.detail) console.error('Detail:', err.detail);
    if (err.hint) console.error('Hint:', err.hint);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
