const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'postgres',
  user: process.env.DB_USER || 'postgres',
  password: (process.env.DB_PASSWORD || '').replace(/^["']|["']$/g, ''),
  ssl: process.env.DB_HOST && process.env.DB_HOST !== 'localhost' ? { rejectUnauthorized: false } : false,
});

async function main() {
  try {
    // 1. Tables and Views
    const tablesRes = await pool.query(`
      SELECT table_name, table_type 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_type, table_name;
    `);

    // 2. RLS Status on Tables
    const rlsRes = await pool.query(`
      SELECT 
        c.relname AS table_name,
        c.relrowsecurity AS rls_enabled,
        c.relforcerowsecurity AS rls_forced
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'
      ORDER BY c.relname;
    `);

    // 3. Existing RLS policies
    const policiesRes = await pool.query(`
      SELECT 
        schemaname,
        tablename,
        policyname,
        permissive,
        roles,
        cmd,
        qual,
        with_check
      FROM pg_policies
      WHERE schemaname = 'public'
      ORDER BY tablename, policyname;
    `);

    // 4. Columns for each table
    const columnsRes = await pool.query(`
      SELECT 
        table_name, 
        column_name, 
        data_type, 
        is_nullable, 
        column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
      ORDER BY table_name, ordinal_position;
    `);

    // 5. Views and SECURITY DEFINER check
    const viewsRes = await pool.query(`
      SELECT 
        table_name,
        view_definition
      FROM information_schema.views
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);

    const secDefViews = await pool.query(`
      SELECT 
        c.relname AS view_name,
        pg_get_userbyid(c.relowner) AS owner,
        c.reloptions
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'v'
      ORDER BY c.relname;
    `);

    // 6. Foreign Keys
    const fksRes = await pool.query(`
      SELECT
        tc.table_name, 
        kcu.column_name, 
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name 
      FROM information_schema.table_constraints AS tc 
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema='public';
    `);

    const summary = {
      tablesCount: tablesRes.rows.filter(r => r.table_type === 'BASE TABLE').length,
      viewsCount: tablesRes.rows.filter(r => r.table_type === 'VIEW').length,
      tables: tablesRes.rows,
      rlsTables: rlsRes.rows,
      policies: policiesRes.rows,
      views: viewsRes.rows.map(v => v.table_name),
      secDefViews: secDefViews.rows,
      columnsCount: columnsRes.rows.length,
      columns: columnsRes.rows,
      foreignKeys: fksRes.rows
    };

    fs.writeFileSync(path.join(__dirname, 'db_schema_dump.json'), JSON.stringify(summary, null, 2));
    console.log('Database inspection complete!');
    console.log(`Base Tables: ${summary.tablesCount}`);
    console.log(`Views: ${summary.viewsCount}`);
    console.log(`RLS Enabled Tables: ${rlsRes.rows.filter(r => r.rls_enabled).length}`);
    console.log(`Existing RLS Policies: ${policiesRes.rows.length}`);
  } catch (err) {
    console.error('Error during DB inspection:', err);
  } finally {
    await pool.end();
  }
}

main();
