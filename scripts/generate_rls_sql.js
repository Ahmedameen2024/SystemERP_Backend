const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: (process.env.DB_PASSWORD || '').replace(/^["']|["']$/g, ''),
  ssl: { rejectUnauthorized: false }
});

async function exportSQL() {
  const tablesRes = await pool.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `);
  const tables = tablesRes.rows.map(r => r.table_name);

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

  let sql = `-- ====================================================\n-- Migration: Row Level Security (RLS) & Views Hardening\n-- Supabase PostgreSQL 17\n-- ====================================================\n\n`;
  sql += `-- 1. Helper function for tenant isolation\nCREATE OR REPLACE FUNCTION public.get_current_user_company_id()\nRETURNS UUID AS $$\nBEGIN\n  RETURN COALESCE(\n    NULLIF(current_setting('request.jwt.claim.company_id', true), '')::UUID,\n    (SELECT company_id FROM public.users WHERE id = auth.uid() LIMIT 1)\n  );\nEXCEPTION WHEN OTHERS THEN\n  RETURN NULL;\nEND;\n$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;\n\n`;

  sql += `-- 2. Enable RLS and Configure Access Policies on all tables\n`;

  for (const table of tables) {
    sql += `-- Table: ${table}\nALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY;\n`;
    sql += `DROP POLICY IF EXISTS "service_role_manage_${table}" ON "${table}";\nCREATE POLICY "service_role_manage_${table}" ON "${table}" FOR ALL TO service_role, postgres USING (true) WITH CHECK (true);\n`;

    const cols = colMap.get(table) || new Set();
    if (cols.has('company_id')) {
      sql += `DROP POLICY IF EXISTS "auth_tenant_isolate_${table}" ON "${table}";\nCREATE POLICY "auth_tenant_isolate_${table}" ON "${table}" FOR ALL TO authenticated USING (company_id = public.get_current_user_company_id() OR public.get_current_user_company_id() IS NULL) WITH CHECK (company_id = public.get_current_user_company_id() OR public.get_current_user_company_id() IS NULL);\n`;
    } else if (cols.has('branch_id')) {
      sql += `DROP POLICY IF EXISTS "auth_branch_isolate_${table}" ON "${table}";\nCREATE POLICY "auth_branch_isolate_${table}" ON "${table}" FOR ALL TO authenticated USING (branch_id IN (SELECT id FROM public.branches WHERE company_id = public.get_current_user_company_id()) OR public.get_current_user_company_id() IS NULL) WITH CHECK (branch_id IN (SELECT id FROM public.branches WHERE company_id = public.get_current_user_company_id()) OR public.get_current_user_company_id() IS NULL);\n`;
    } else if (['currencies', 'exchange_rates', 'uoms', 'item_categories', 'payment_methods', 'taxes', 'departments', 'financial_periods'].includes(table)) {
      sql += `DROP POLICY IF EXISTS "auth_read_lookup_${table}" ON "${table}";\nCREATE POLICY "auth_read_lookup_${table}" ON "${table}" FOR SELECT TO authenticated USING (true);\nDROP POLICY IF EXISTS "auth_write_lookup_${table}" ON "${table}";\nCREATE POLICY "auth_write_lookup_${table}" ON "${table}" FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.users u JOIN public.roles r ON r.id = u.role_id WHERE u.id = auth.uid() AND (r.is_system_role = true OR u.username = 'admin'))) WITH CHECK (EXISTS (SELECT 1 FROM public.users u JOIN public.roles r ON r.id = u.role_id WHERE u.id = auth.uid() AND (r.is_system_role = true OR u.username = 'admin')));\n`;
    } else {
      sql += `DROP POLICY IF EXISTS "auth_authenticated_access_${table}" ON "${table}";\nCREATE POLICY "auth_authenticated_access_${table}" ON "${table}" FOR ALL TO authenticated USING (true) WITH CHECK (true);\n`;
    }
    sql += `\n`;
  }

  sql += `-- 3. Security Invoker on Views (Resolve Security Definer View Warning)\n`;
  sql += `ALTER VIEW public.v_trial_balance SET (security_invoker = true);\n`;
  sql += `ALTER VIEW public.v_customer_aging SET (security_invoker = true);\n`;
  sql += `ALTER VIEW public.v_inventory_stock SET (security_invoker = true);\n`;
  sql += `ALTER VIEW public.v_supplier_summary SET (security_invoker = true);\n`;
  sql += `ALTER VIEW public.v_supplier_aging SET (security_invoker = true);\n`;

  fs.writeFileSync(path.join(__dirname, '..', 'database', 'migrate_rls_policies.sql'), sql, 'utf8');
  console.log('✅ migrate_rls_policies.sql generated successfully!');
  await pool.end();
}

exportSQL();
