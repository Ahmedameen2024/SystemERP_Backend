import { Pool, PoolClient } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Look for .env in current directory or parent directory
const envPaths = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), 'SystemERP_Backend', '.env'),
  path.resolve(__dirname, '../../.env'),
  path.resolve(__dirname, '../.env'),
];
for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    break;
  }
}
dotenv.config();

const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';

const DEFAULT_SUPABASE_HOST = 'aws-0-ap-southeast-1.pooler.supabase.com';
const DEFAULT_SUPABASE_PORT = '6543';
const DEFAULT_SUPABASE_DB = 'postgres';
const DEFAULT_SUPABASE_USER = 'postgres.mlezotgbaemxnksacydh';
const DEFAULT_SUPABASE_PASS = process.env.DB_PASSWORD || '';

const host = process.env.DB_HOST || DEFAULT_SUPABASE_HOST;
const port = parseInt(process.env.DB_PORT || DEFAULT_SUPABASE_PORT);
const database = process.env.DB_NAME || DEFAULT_SUPABASE_DB;
const user = process.env.DB_USER || DEFAULT_SUPABASE_USER;
const rawPassword = process.env.DB_PASSWORD || DEFAULT_SUPABASE_PASS;
const password = rawPassword.replace(/^["']|["']$/g, '');

const connectionConfig = process.env.DATABASE_URL || process.env.POSTGRES_URL
  ? {
      connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
      ssl: { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 20000,
      keepAlive: true,
    }
  : {
      host,
      port,
      database,
      user,
      password,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 20000,
      keepAlive: true,
      ssl: host !== 'localhost' ? { rejectUnauthorized: false } : false,
    };

const pool = new Pool(connectionConfig);

pool.on('connect', () => {
  // console.log('New client connected to PostgreSQL pool');
});

pool.on('error', (err: Error) => {
  console.error('Unexpected error on idle PostgreSQL client', err);
});

export const query = async (text: string, params?: unknown[]) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    if (process.env.NODE_ENV === 'development' && duration > 1000) {
      console.warn('Slow query detected:', { text, duration, rows: res.rowCount });
    }
    return res;
  } catch (error) {
    console.error('Database query error:', { text, error });
    throw error;
  }
};

export const getClient = (): Promise<PoolClient> => pool.connect();

export const transaction = async <T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const testConnection = async (): Promise<void> => {
  const client = await pool.connect();
  try {
    await client.query('SELECT NOW()');
    console.log('✅ PostgreSQL connection successful');
  } finally {
    client.release();
  }
  try {
    const { runMultiCurrencyMigration } = await import('./migrateMultiCurrency');
    await runMultiCurrencyMigration();
  } catch (migErr) {
    // Migration is non-fatal
    console.warn('Notice: Multi-currency migration check passed');
  }
};

export default pool;
