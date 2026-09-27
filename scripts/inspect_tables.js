const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
});

(async () => {
  try {
    const res = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    console.log('--- TABLES AND RECORD COUNTS ---');
    for (let r of res.rows) {
      try {
        const c = await pool.query(`SELECT count(*) FROM "${r.table_name}"`);
        console.log(`${r.table_name.padEnd(30)} : ${c.rows[0].count}`);
      } catch (err) {
        console.log(`${r.table_name.padEnd(30)} : error ${err.message}`);
      }
    }
  } catch (err) {
    console.error('Connection error:', err);
  } finally {
    await pool.end();
  }
})();
