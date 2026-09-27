const { Pool } = require('pg');
require('dotenv').config();

const cfg = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'stitch_erp',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  ssl: process.env.DB_HOST && process.env.DB_HOST !== 'localhost' ? { rejectUnauthorized: false } : false,
  connectionTimeoutMillis: 5000,
};

console.log('Attempting DB connection to', { host: cfg.host, port: cfg.port, database: cfg.database, user: cfg.user, ssl: !!cfg.ssl });

(async () => {
  const pool = new Pool(cfg);
  try {
    const client = await pool.connect();
    const res = await client.query('SELECT NOW()');
    console.log('Connected, server time:', res.rows[0]);
    client.release();
    process.exit(0);
  } catch (err) {
    console.error('Connection failed:', err.message || err);
    process.exit(2);
  } finally {
    try { await pool.end(); } catch (e) {}
  }
})();
