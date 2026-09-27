const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'postgres',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  ssl: process.env.DB_HOST && process.env.DB_HOST !== 'localhost' ? { rejectUnauthorized: false } : false,
});

(async () => {
  try {
    const newHash = bcrypt.hashSync('Admin@1234', 12);
    const result = await pool.query(
      'UPDATE users SET password_hash = $1 WHERE username = $2 RETURNING id, username',
      [newHash, 'admin']
    );

    if (result.rowCount === 0) {
      console.error('Admin user not found. No password updated.');
      process.exit(1);
    }

    console.log('✅ Admin password hash updated for user:', result.rows[0].username);
    console.log('New hash:', newHash);
  } catch (error) {
    console.error('❌ Failed to update admin password hash:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();
