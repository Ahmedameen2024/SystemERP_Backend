const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'postgres',
  user: process.env.DB_USER || 'postgres',
  password: (process.env.DB_PASSWORD || '').replace(/^["']|["']$/g, ''),
  ssl: process.env.DB_HOST && process.env.DB_HOST !== 'localhost' ? { rejectUnauthorized: false } : false,
});

async function setupRLS() {
  console.log('🔒 Starting RLS Policies Setup on Supabase...');

  // 1. Get all base tables
  const tablesRes = await pool.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `);

  const tables = tablesRes.rows.map(r => r.table_name);
  console.log(`Found ${tables.length} base tables.`);

  // 2. Helper function to check column existence
  const columnsRes = await pool.query(`
    SELECT table_name, column_name 
    FROM information_schema.columns 
    WHERE table_schema = 'public';
  `);
  
  const colMap = new Map();
  columnsRes.rows.forEach(r => {
    if (!colMap.has(r.table_name)) colMap.set(r.table_name, new Set());
    colMap.get(r.table_name).add(r.column_name);
  });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Create helper function for auth company check if not exists
    await client.query(`
      CREATE OR REPLACE FUNCTION public.get_current_user_company_id()
      RETURNS UUID AS $$
      BEGIN
        -- Returns company_id from Supabase JWT claims or user record
        RETURN COALESCE(
          NULLIF(current_setting('request.jwt.claim.company_id', true), '')::UUID,
          (SELECT company_id FROM public.users WHERE id = auth.uid() LIMIT 1)
        );
      EXCEPTION WHEN OTHERS THEN
        RETURN NULL;
      END;
      $$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
    `);

    let policiesCreated = 0;

    for (const table of tables) {
      // Ensure RLS is enabled on table
      await client.query(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY;`);

      // 1. Service role full access policy (standard Supabase administrative access)
      await client.query(`
        DROP POLICY IF EXISTS "service_role_manage_${table}" ON "${table}";
        CREATE POLICY "service_role_manage_${table}" 
        ON "${table}" 
        FOR ALL 
        TO service_role, postgres 
        USING (true) 
        WITH CHECK (true);
      `);
      policiesCreated++;

      // 2. Authenticated user policy based on table structure
      const cols = colMap.get(table) || new Set();

      if (cols.has('company_id')) {
        // Multi-tenant table with direct company_id
        await client.query(`
          DROP POLICY IF EXISTS "auth_tenant_isolate_${table}" ON "${table}";
          CREATE POLICY "auth_tenant_isolate_${table}" 
          ON "${table}" 
          FOR ALL 
          TO authenticated 
          USING (
            company_id = public.get_current_user_company_id()
            OR public.get_current_user_company_id() IS NULL
          ) 
          WITH CHECK (
            company_id = public.get_current_user_company_id()
            OR public.get_current_user_company_id() IS NULL
          );
        `);
        policiesCreated++;
      } else if (cols.has('branch_id')) {
        // Table with branch_id
        await client.query(`
          DROP POLICY IF EXISTS "auth_branch_isolate_${table}" ON "${table}";
          CREATE POLICY "auth_branch_isolate_${table}" 
          ON "${table}" 
          FOR ALL 
          TO authenticated 
          USING (
            branch_id IN (
              SELECT id FROM public.branches 
              WHERE company_id = public.get_current_user_company_id()
            )
            OR public.get_current_user_company_id() IS NULL
          ) 
          WITH CHECK (
            branch_id IN (
              SELECT id FROM public.branches 
              WHERE company_id = public.get_current_user_company_id()
            )
            OR public.get_current_user_company_id() IS NULL
          );
        `);
        policiesCreated++;
      } else if (['currencies', 'exchange_rates', 'uoms', 'item_categories', 'payment_methods', 'taxes', 'departments', 'financial_periods'].includes(table)) {
        // Shared lookup tables: readable by authenticated users, modifiable by admin
        await client.query(`
          DROP POLICY IF EXISTS "auth_read_lookup_${table}" ON "${table}";
          CREATE POLICY "auth_read_lookup_${table}" 
          ON "${table}" 
          FOR SELECT 
          TO authenticated 
          USING (true);

          DROP POLICY IF EXISTS "auth_write_lookup_${table}" ON "${table}";
          CREATE POLICY "auth_write_lookup_${table}" 
          ON "${table}" 
          FOR ALL 
          TO authenticated 
          USING (
            EXISTS (
              SELECT 1 FROM public.users u 
              JOIN public.roles r ON r.id = u.role_id 
              WHERE u.id = auth.uid() AND (r.is_system_role = true OR u.username = 'admin')
            )
          )
          WITH CHECK (
            EXISTS (
              SELECT 1 FROM public.users u 
              JOIN public.roles r ON r.id = u.role_id 
              WHERE u.id = auth.uid() AND (r.is_system_role = true OR u.username = 'admin')
            )
          );
        `);
        policiesCreated += 2;
      } else {
        // Other related tables (lines/currencies/sub-records)
        await client.query(`
          DROP POLICY IF EXISTS "auth_authenticated_access_${table}" ON "${table}";
          CREATE POLICY "auth_authenticated_access_${table}" 
          ON "${table}" 
          FOR ALL 
          TO authenticated 
          USING (true) 
          WITH CHECK (true);
        `);
        policiesCreated++;
      }
    }

    await client.query('COMMIT');
    console.log(`✅ Successfully enabled RLS and created ${policiesCreated} policies across all ${tables.length} tables!`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Failed to configure RLS:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

setupRLS();

