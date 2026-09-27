/**
 * ERP System Database Initializer
 * Connects to PostgreSQL and runs schema.sql + seed.sql
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
  database: 'postgres', // connect to default db to create our db
  ssl: process.env.DB_HOST && process.env.DB_HOST !== 'localhost' ? { rejectUnauthorized: false } : false,
};

async function initDatabase() {
  console.log('🚀 ERP Database Initializer');
  console.log('============================');

  // Step 1: Create the ERP database if it doesn't exist
  const adminClient = new Client(config);
  try {
    await adminClient.connect();
    console.log('✅ Connected to PostgreSQL server');

    const dbName = process.env.DB_NAME || 'stitch_erp';
    const checkDb = await adminClient.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [dbName]
    );

    if (checkDb.rows.length === 0) {
      await adminClient.query(`CREATE DATABASE "${dbName}" ENCODING 'UTF8'`);
      console.log(`✅ Database "${dbName}" created`);
    } else {
      console.log(`ℹ️  Database "${dbName}" already exists`);
    }
  } catch (err) {
    console.error('❌ Error connecting to PostgreSQL:', err.message);
    console.error('Please ensure PostgreSQL is running and credentials are correct.');
    console.error('Set DB_HOST, DB_PORT, DB_USER, DB_PASSWORD environment variables.');
    process.exit(1);
  } finally {
    await adminClient.end();
  }

  // Step 2: Connect to ERP database and run schema + seed
  const erpClient = new Client({
    ...config,
    database: process.env.DB_NAME || 'stitch_erp',
  });

  try {
    await erpClient.connect();
    console.log(`✅ Connected to ${process.env.DB_NAME || 'stitch_erp'} database`);

    // Run Schema
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    console.log('⏳ Running schema.sql...');
    await erpClient.query(schemaSql);
    console.log('✅ Schema applied successfully');

    // Run Seed
    const seedPath = path.join(__dirname, 'seed.sql');
    const seedSql = fs.readFileSync(seedPath, 'utf8');
    console.log('⏳ Running seed.sql...');
    await erpClient.query(seedSql);
    console.log('✅ Seed data inserted successfully');

    console.log('\n============================');
    console.log('✅ Database initialization complete!');
    console.log('Default credentials:');
    console.log('  Username: admin');
    console.log('  Password: Admin@1234');
    console.log('============================\n');

  } catch (err) {
    console.error('❌ Error running SQL:', err.message);
    if (err.detail) console.error('Detail:', err.detail);
    process.exit(1);
  } finally {
    await erpClient.end();
  }
}

initDatabase();
