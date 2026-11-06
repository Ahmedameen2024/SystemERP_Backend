-- ====================================================
-- Migration: Row Level Security (RLS) & Views Hardening
-- Supabase PostgreSQL 17
-- ====================================================

-- 1. Helper function for tenant isolation
CREATE OR REPLACE FUNCTION public.get_current_user_company_id()
RETURNS UUID AS $$
BEGIN
  RETURN COALESCE(
    NULLIF(current_setting('request.jwt.claim.company_id', true), '')::UUID,
    (SELECT company_id FROM public.users WHERE id = auth.uid() LIMIT 1)
  );
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 2. Enable RLS and Configure Access Policies on all tables
-- Table: account_currencies
ALTER TABLE "account_currencies" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_manage_account_currencies" ON "account_currencies";
CREATE POLICY "service_role_manage_account_currencies" ON "account_currencies" FOR ALL TO service_role, postgres USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_authenticated_access_account_currencies" ON "account_currencies";
CREATE POLICY "auth_authenticated_access_account_currencies" ON "account_currencies" FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Table: allowance_types
ALTER TABLE "allowance_types" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_manage_allowance_types" ON "allowance_types";
CREATE POLICY "service_role_manage_allowance_types" ON "allowance_types" FOR ALL TO service_role, postgres USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_tenant_isolate_allowance_types" ON "allowance_types";
CREATE POLICY "auth_tenant_isolate_allowance_types" ON "allowance_types" FOR ALL TO authenticated USING (company_id = public.get_current_user_company_id() OR public.get_current_user_company_id() IS NULL) WITH CHECK (company_id = public.get_current_user_company_id() OR public.get_current_user_company_id() IS NULL);

-- Table: attendances
ALTER TABLE "attendances" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_manage_attendances" ON "attendances";
CREATE POLICY "service_role_manage_attendances" ON "attendances" FOR ALL TO service_role, postgres USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_authenticated_access_attendances" ON "attendances";
CREATE POLICY "auth_authenticated_access_attendances" ON "attendances" FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Table: audit_logs
ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_manage_audit_logs" ON "audit_logs";
CREATE POLICY "service_role_manage_audit_logs" ON "audit_logs" FOR ALL TO service_role, postgres USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_authenticated_access_audit_logs" ON "audit_logs";
CREATE POLICY "auth_authenticated_access_audit_logs" ON "audit_logs" FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Table: bank_account_currencies
ALTER TABLE "bank_account_currencies" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_manage_bank_account_currencies" ON "bank_account_currencies";
CREATE POLICY "service_role_manage_bank_account_currencies" ON "bank_account_currencies" FOR ALL TO service_role, postgres USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_authenticated_access_bank_account_currencies" ON "bank_account_currencies";
CREATE POLICY "auth_authenticated_access_bank_account_currencies" ON "bank_account_currencies" FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Table: bank_accounts
ALTER TABLE "bank_accounts" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_manage_bank_accounts" ON "bank_accounts";
CREATE POLICY "service_role_manage_bank_accounts" ON "bank_accounts" FOR ALL TO service_role, postgres USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_tenant_isolate_bank_accounts" ON "bank_accounts";
CREATE POLICY "auth_tenant_isolate_bank_accounts" ON "bank_accounts" FOR ALL TO authenticated USING (company_id = public.get_current_user_company_id() OR public.get_current_user_company_id() IS NULL) WITH CHECK (company_id = public.get_current_user_company_id() OR public.get_current_user_company_id() IS NULL);

-- Table: biometric_logs
ALTER TABLE "biometric_logs" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_manage_biometric_logs" ON "biometric_logs";
CREATE POLICY "service_role_manage_biometric_logs" ON "biometric_logs" FOR ALL TO service_role, postgres USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_authenticated_access_biometric_logs" ON "biometric_logs";
CREATE POLICY "auth_authenticated_access_biometric_logs" ON "biometric_logs" FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Table: branches
ALTER TABLE "branches" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_manage_branches" ON "branches";
CREATE POLICY "service_role_manage_branches" ON "branches" FOR ALL TO service_role, postgres USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_tenant_isolate_branches" ON "branches";
CREATE POLICY "auth_tenant_isolate_branches" ON "branches" FOR ALL TO authenticated USING (company_id = public.get_current_user_company_id() OR public.get_current_user_company_id() IS NULL) WITH CHECK (company_id = public.get_current_user_company_id() OR public.get_current_user_company_id() IS NULL);

-- Table: cash_box_currencies
ALTER TABLE "cash_box_currencies" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_manage_cash_box_currencies" ON "cash_box_currencies";
CREATE POLICY "service_role_manage_cash_box_currencies" ON "cash_box_currencies" FOR ALL TO service_role, postgres USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_authenticated_access_cash_box_currencies" ON "cash_box_currencies";
CREATE POLICY "auth_authenticated_access_cash_box_currencies" ON "cash_box_currencies" FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Table: cash_boxes
ALTER TABLE "cash_boxes" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_manage_cash_boxes" ON "cash_boxes";
CREATE POLICY "service_role_manage_cash_boxes" ON "cash_boxes" FOR ALL TO service_role, postgres USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_tenant_isolate_cash_boxes" ON "cash_boxes";
CREATE POLICY "auth_tenant_isolate_cash_boxes" ON "cash_boxes" FOR ALL TO authenticated USING (company_id = public.get_current_user_company_id() OR public.get_current_user_company_id() IS NULL) WITH CHECK (company_id = public.get_current_user_company_id() OR public.get_current_user_company_id() IS NULL);

-- Table: companies
ALTER TABLE "companies" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_manage_companies" ON "companies";
CREATE POLICY "service_role_manage_companies" ON "companies" FOR ALL TO service_role, postgres USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_authenticated_access_companies" ON "companies";
CREATE POLICY "auth_authenticated_access_companies" ON "companies" FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Table: cost_centers
ALTER TABLE "cost_centers" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_manage_cost_centers" ON "cost_centers";
CREATE POLICY "service_role_manage_cost_centers" ON "cost_centers" FOR ALL TO service_role, postgres USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_tenant_isolate_cost_centers" ON "cost_centers";
CREATE POLICY "auth_tenant_isolate_cost_centers" ON "cost_centers" FOR ALL TO authenticated USING (company_id = public.get_current_user_company_id() OR public.get_current_user_company_id() IS NULL) WITH CHECK (company_id = public.get_current_user_company_id() OR public.get_current_user_company_id() IS NULL);

-- Table: currencies
ALTER TABLE "currencies" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_manage_currencies" ON "currencies";
CREATE POLICY "service_role_manage_currencies" ON "currencies" FOR ALL TO service_role, postgres USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_read_lookup_currencies" ON "currencies";
CREATE POLICY "auth_read_lookup_currencies" ON "currencies" FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "auth_write_lookup_currencies" ON "currencies";
CREATE POLICY "auth_write_lookup_currencies" ON "currencies" FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.users u JOIN public.roles r ON r.id = u.role_id WHERE u.id = auth.uid() AND (r.is_system_role = true OR u.username = 'admin'))) WITH CHECK (EXISTS (SELECT 1 FROM public.users u JOIN public.roles r ON r.id = u.role_id WHERE u.id = auth.uid() AND (r.is_system_role = true OR u.username = 'admin')));

-- Table: currency_transfers
ALTER TABLE "currency_transfers" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_manage_currency_transfers" ON "currency_transfers";
CREATE POLICY "service_role_manage_currency_transfers" ON "currency_transfers" FOR ALL TO service_role, postgres USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_tenant_isolate_currency_transfers" ON "currency_transfers";
CREATE POLICY "auth_tenant_isolate_currency_transfers" ON "currency_transfers" FOR ALL TO authenticated USING (company_id = public.get_current_user_company_id() OR public.get_current_user_company_id() IS NULL) WITH CHECK (company_id = public.get_current_user_company_id() OR public.get_current_user_company_id() IS NULL);

-- Table: customer_currencies
ALTER TABLE "customer_currencies" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_manage_customer_currencies" ON "customer_currencies";
CREATE POLICY "service_role_manage_customer_currencies" ON "customer_currencies" FOR ALL TO service_role, postgres USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_authenticated_access_customer_currencies" ON "customer_currencies";
CREATE POLICY "auth_authenticated_access_customer_currencies" ON "customer_currencies" FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Table: customers
ALTER TABLE "customers" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_manage_customers" ON "customers";
CREATE POLICY "service_role_manage_customers" ON "customers" FOR ALL TO service_role, postgres USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_tenant_isolate_customers" ON "customers";
CREATE POLICY "auth_tenant_isolate_customers" ON "customers" FOR ALL TO authenticated USING (company_id = public.get_current_user_company_id() OR public.get_current_user_company_id() IS NULL) WITH CHECK (company_id = public.get_current_user_company_id() OR public.get_current_user_company_id() IS NULL);

-- Table: deduction_types
ALTER TABLE "deduction_types" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_manage_deduction_types" ON "deduction_types";
CREATE POLICY "service_role_manage_deduction_types" ON "deduction_types" FOR ALL TO service_role, postgres USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_tenant_isolate_deduction_types" ON "deduction_types";
CREATE POLICY "auth_tenant_isolate_deduction_types" ON "deduction_types" FOR ALL TO authenticated USING (company_id = public.get_current_user_company_id() OR public.get_current_user_company_id() IS NULL) WITH CHECK (company_id = public.get_current_user_company_id() OR public.get_current_user_company_id() IS NULL);

-- Table: departments
ALTER TABLE "departments" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_manage_departments" ON "departments";
CREATE POLICY "service_role_manage_departments" ON "departments" FOR ALL TO service_role, postgres USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_branch_isolate_departments" ON "departments";
CREATE POLICY "auth_branch_isolate_departments" ON "departments" FOR ALL TO authenticated USING (branch_id IN (SELECT id FROM public.branches WHERE company_id = public.get_current_user_company_id()) OR public.get_current_user_company_id() IS NULL) WITH CHECK (branch_id IN (SELECT id FROM public.branches WHERE company_id = public.get_current_user_company_id()) OR public.get_current_user_company_id() IS NULL);

-- Table: employee_allowances
ALTER TABLE "employee_allowances" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_manage_employee_allowances" ON "employee_allowances";
CREATE POLICY "service_role_manage_employee_allowances" ON "employee_allowances" FOR ALL TO service_role, postgres USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_authenticated_access_employee_allowances" ON "employee_allowances";
CREATE POLICY "auth_authenticated_access_employee_allowances" ON "employee_allowances" FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Table: employee_deductions
ALTER TABLE "employee_deductions" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_manage_employee_deductions" ON "employee_deductions";
CREATE POLICY "service_role_manage_employee_deductions" ON "employee_deductions" FOR ALL TO service_role, postgres USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_authenticated_access_employee_deductions" ON "employee_deductions";
CREATE POLICY "auth_authenticated_access_employee_deductions" ON "employee_deductions" FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Table: employees
ALTER TABLE "employees" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_manage_employees" ON "employees";
CREATE POLICY "service_role_manage_employees" ON "employees" FOR ALL TO service_role, postgres USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_branch_isolate_employees" ON "employees";
CREATE POLICY "auth_branch_isolate_employees" ON "employees" FOR ALL TO authenticated USING (branch_id IN (SELECT id FROM public.branches WHERE company_id = public.get_current_user_company_id()) OR public.get_current_user_company_id() IS NULL) WITH CHECK (branch_id IN (SELECT id FROM public.branches WHERE company_id = public.get_current_user_company_id()) OR public.get_current_user_company_id() IS NULL);

-- Table: exchange_rates
ALTER TABLE "exchange_rates" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_manage_exchange_rates" ON "exchange_rates";
CREATE POLICY "service_role_manage_exchange_rates" ON "exchange_rates" FOR ALL TO service_role, postgres USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_tenant_isolate_exchange_rates" ON "exchange_rates";
CREATE POLICY "auth_tenant_isolate_exchange_rates" ON "exchange_rates" FOR ALL TO authenticated USING (company_id = public.get_current_user_company_id() OR public.get_current_user_company_id() IS NULL) WITH CHECK (company_id = public.get_current_user_company_id() OR public.get_current_user_company_id() IS NULL);

-- Table: financial_periods
ALTER TABLE "financial_periods" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_manage_financial_periods" ON "financial_periods";
CREATE POLICY "service_role_manage_financial_periods" ON "financial_periods" FOR ALL TO service_role, postgres USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_tenant_isolate_financial_periods" ON "financial_periods";
CREATE POLICY "auth_tenant_isolate_financial_periods" ON "financial_periods" FOR ALL TO authenticated USING (company_id = public.get_current_user_company_id() OR public.get_current_user_company_id() IS NULL) WITH CHECK (company_id = public.get_current_user_company_id() OR public.get_current_user_company_id() IS NULL);

-- Table: gl_accounts
ALTER TABLE "gl_accounts" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_manage_gl_accounts" ON "gl_accounts";
CREATE POLICY "service_role_manage_gl_accounts" ON "gl_accounts" FOR ALL TO service_role, postgres USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_tenant_isolate_gl_accounts" ON "gl_accounts";
CREATE POLICY "auth_tenant_isolate_gl_accounts" ON "gl_accounts" FOR ALL TO authenticated USING (company_id = public.get_current_user_company_id() OR public.get_current_user_company_id() IS NULL) WITH CHECK (company_id = public.get_current_user_company_id() OR public.get_current_user_company_id() IS NULL);

-- Table: inventory_balances
ALTER TABLE "inventory_balances" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_manage_inventory_balances" ON "inventory_balances";
CREATE POLICY "service_role_manage_inventory_balances" ON "inventory_balances" FOR ALL TO service_role, postgres USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_authenticated_access_inventory_balances" ON "inventory_balances";
CREATE POLICY "auth_authenticated_access_inventory_balances" ON "inventory_balances" FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Table: inventory_transaction_lines
ALTER TABLE "inventory_transaction_lines" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_manage_inventory_transaction_lines" ON "inventory_transaction_lines";
CREATE POLICY "service_role_manage_inventory_transaction_lines" ON "inventory_transaction_lines" FOR ALL TO service_role, postgres USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_authenticated_access_inventory_transaction_lines" ON "inventory_transaction_lines";
CREATE POLICY "auth_authenticated_access_inventory_transaction_lines" ON "inventory_transaction_lines" FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Table: inventory_transactions
ALTER TABLE "inventory_transactions" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_manage_inventory_transactions" ON "inventory_transactions";
CREATE POLICY "service_role_manage_inventory_transactions" ON "inventory_transactions" FOR ALL TO service_role, postgres USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_authenticated_access_inventory_transactions" ON "inventory_transactions";
CREATE POLICY "auth_authenticated_access_inventory_transactions" ON "inventory_transactions" FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Table: item_categories
ALTER TABLE "item_categories" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_manage_item_categories" ON "item_categories";
CREATE POLICY "service_role_manage_item_categories" ON "item_categories" FOR ALL TO service_role, postgres USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_tenant_isolate_item_categories" ON "item_categories";
CREATE POLICY "auth_tenant_isolate_item_categories" ON "item_categories" FOR ALL TO authenticated USING (company_id = public.get_current_user_company_id() OR public.get_current_user_company_id() IS NULL) WITH CHECK (company_id = public.get_current_user_company_id() OR public.get_current_user_company_id() IS NULL);

-- Table: items
ALTER TABLE "items" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_manage_items" ON "items";
CREATE POLICY "service_role_manage_items" ON "items" FOR ALL TO service_role, postgres USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_tenant_isolate_items" ON "items";
CREATE POLICY "auth_tenant_isolate_items" ON "items" FOR ALL TO authenticated USING (company_id = public.get_current_user_company_id() OR public.get_current_user_company_id() IS NULL) WITH CHECK (company_id = public.get_current_user_company_id() OR public.get_current_user_company_id() IS NULL);

-- Table: journal_entries
ALTER TABLE "journal_entries" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_manage_journal_entries" ON "journal_entries";
CREATE POLICY "service_role_manage_journal_entries" ON "journal_entries" FOR ALL TO service_role, postgres USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_branch_isolate_journal_entries" ON "journal_entries";
CREATE POLICY "auth_branch_isolate_journal_entries" ON "journal_entries" FOR ALL TO authenticated USING (branch_id IN (SELECT id FROM public.branches WHERE company_id = public.get_current_user_company_id()) OR public.get_current_user_company_id() IS NULL) WITH CHECK (branch_id IN (SELECT id FROM public.branches WHERE company_id = public.get_current_user_company_id()) OR public.get_current_user_company_id() IS NULL);

-- Table: journal_entry_lines
ALTER TABLE "journal_entry_lines" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_manage_journal_entry_lines" ON "journal_entry_lines";
CREATE POLICY "service_role_manage_journal_entry_lines" ON "journal_entry_lines" FOR ALL TO service_role, postgres USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_branch_isolate_journal_entry_lines" ON "journal_entry_lines";
CREATE POLICY "auth_branch_isolate_journal_entry_lines" ON "journal_entry_lines" FOR ALL TO authenticated USING (branch_id IN (SELECT id FROM public.branches WHERE company_id = public.get_current_user_company_id()) OR public.get_current_user_company_id() IS NULL) WITH CHECK (branch_id IN (SELECT id FROM public.branches WHERE company_id = public.get_current_user_company_id()) OR public.get_current_user_company_id() IS NULL);

-- Table: leave_requests
ALTER TABLE "leave_requests" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_manage_leave_requests" ON "leave_requests";
CREATE POLICY "service_role_manage_leave_requests" ON "leave_requests" FOR ALL TO service_role, postgres USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_authenticated_access_leave_requests" ON "leave_requests";
CREATE POLICY "auth_authenticated_access_leave_requests" ON "leave_requests" FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Table: leave_types
ALTER TABLE "leave_types" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_manage_leave_types" ON "leave_types";
CREATE POLICY "service_role_manage_leave_types" ON "leave_types" FOR ALL TO service_role, postgres USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_tenant_isolate_leave_types" ON "leave_types";
CREATE POLICY "auth_tenant_isolate_leave_types" ON "leave_types" FOR ALL TO authenticated USING (company_id = public.get_current_user_company_id() OR public.get_current_user_company_id() IS NULL) WITH CHECK (company_id = public.get_current_user_company_id() OR public.get_current_user_company_id() IS NULL);

-- Table: opening_balances
ALTER TABLE "opening_balances" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_manage_opening_balances" ON "opening_balances";
CREATE POLICY "service_role_manage_opening_balances" ON "opening_balances" FOR ALL TO service_role, postgres USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_tenant_isolate_opening_balances" ON "opening_balances";
CREATE POLICY "auth_tenant_isolate_opening_balances" ON "opening_balances" FOR ALL TO authenticated USING (company_id = public.get_current_user_company_id() OR public.get_current_user_company_id() IS NULL) WITH CHECK (company_id = public.get_current_user_company_id() OR public.get_current_user_company_id() IS NULL);

-- Table: payment_methods
ALTER TABLE "payment_methods" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_manage_payment_methods" ON "payment_methods";
CREATE POLICY "service_role_manage_payment_methods" ON "payment_methods" FOR ALL TO service_role, postgres USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_tenant_isolate_payment_methods" ON "payment_methods";
CREATE POLICY "auth_tenant_isolate_payment_methods" ON "payment_methods" FOR ALL TO authenticated USING (company_id = public.get_current_user_company_id() OR public.get_current_user_company_id() IS NULL) WITH CHECK (company_id = public.get_current_user_company_id() OR public.get_current_user_company_id() IS NULL);

-- Table: payment_terms
ALTER TABLE "payment_terms" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_manage_payment_terms" ON "payment_terms";
CREATE POLICY "service_role_manage_payment_terms" ON "payment_terms" FOR ALL TO service_role, postgres USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_tenant_isolate_payment_terms" ON "payment_terms";
CREATE POLICY "auth_tenant_isolate_payment_terms" ON "payment_terms" FOR ALL TO authenticated USING (company_id = public.get_current_user_company_id() OR public.get_current_user_company_id() IS NULL) WITH CHECK (company_id = public.get_current_user_company_id() OR public.get_current_user_company_id() IS NULL);

-- Table: payment_voucher_lines
ALTER TABLE "payment_voucher_lines" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_manage_payment_voucher_lines" ON "payment_voucher_lines";
CREATE POLICY "service_role_manage_payment_voucher_lines" ON "payment_voucher_lines" FOR ALL TO service_role, postgres USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_authenticated_access_payment_voucher_lines" ON "payment_voucher_lines";
CREATE POLICY "auth_authenticated_access_payment_voucher_lines" ON "payment_voucher_lines" FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Table: payment_vouchers
ALTER TABLE "payment_vouchers" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_manage_payment_vouchers" ON "payment_vouchers";
CREATE POLICY "service_role_manage_payment_vouchers" ON "payment_vouchers" FOR ALL TO service_role, postgres USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_branch_isolate_payment_vouchers" ON "payment_vouchers";
CREATE POLICY "auth_branch_isolate_payment_vouchers" ON "payment_vouchers" FOR ALL TO authenticated USING (branch_id IN (SELECT id FROM public.branches WHERE company_id = public.get_current_user_company_id()) OR public.get_current_user_company_id() IS NULL) WITH CHECK (branch_id IN (SELECT id FROM public.branches WHERE company_id = public.get_current_user_company_id()) OR public.get_current_user_company_id() IS NULL);

-- Table: payroll_lines
ALTER TABLE "payroll_lines" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_manage_payroll_lines" ON "payroll_lines";
CREATE POLICY "service_role_manage_payroll_lines" ON "payroll_lines" FOR ALL TO service_role, postgres USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_authenticated_access_payroll_lines" ON "payroll_lines";
CREATE POLICY "auth_authenticated_access_payroll_lines" ON "payroll_lines" FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Table: payrolls
ALTER TABLE "payrolls" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_manage_payrolls" ON "payrolls";
CREATE POLICY "service_role_manage_payrolls" ON "payrolls" FOR ALL TO service_role, postgres USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_tenant_isolate_payrolls" ON "payrolls";
CREATE POLICY "auth_tenant_isolate_payrolls" ON "payrolls" FOR ALL TO authenticated USING (company_id = public.get_current_user_company_id() OR public.get_current_user_company_id() IS NULL) WITH CHECK (company_id = public.get_current_user_company_id() OR public.get_current_user_company_id() IS NULL);

-- Table: permissions
ALTER TABLE "permissions" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_manage_permissions" ON "permissions";
CREATE POLICY "service_role_manage_permissions" ON "permissions" FOR ALL TO service_role, postgres USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_authenticated_access_permissions" ON "permissions";
CREATE POLICY "auth_authenticated_access_permissions" ON "permissions" FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Table: purchase_invoice_lines
ALTER TABLE "purchase_invoice_lines" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_manage_purchase_invoice_lines" ON "purchase_invoice_lines";
CREATE POLICY "service_role_manage_purchase_invoice_lines" ON "purchase_invoice_lines" FOR ALL TO service_role, postgres USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_authenticated_access_purchase_invoice_lines" ON "purchase_invoice_lines";
CREATE POLICY "auth_authenticated_access_purchase_invoice_lines" ON "purchase_invoice_lines" FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Table: purchase_invoices
ALTER TABLE "purchase_invoices" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_manage_purchase_invoices" ON "purchase_invoices";
CREATE POLICY "service_role_manage_purchase_invoices" ON "purchase_invoices" FOR ALL TO service_role, postgres USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_branch_isolate_purchase_invoices" ON "purchase_invoices";
CREATE POLICY "auth_branch_isolate_purchase_invoices" ON "purchase_invoices" FOR ALL TO authenticated USING (branch_id IN (SELECT id FROM public.branches WHERE company_id = public.get_current_user_company_id()) OR public.get_current_user_company_id() IS NULL) WITH CHECK (branch_id IN (SELECT id FROM public.branches WHERE company_id = public.get_current_user_company_id()) OR public.get_current_user_company_id() IS NULL);

-- Table: purchase_order_lines
ALTER TABLE "purchase_order_lines" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_manage_purchase_order_lines" ON "purchase_order_lines";
CREATE POLICY "service_role_manage_purchase_order_lines" ON "purchase_order_lines" FOR ALL TO service_role, postgres USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_authenticated_access_purchase_order_lines" ON "purchase_order_lines";
CREATE POLICY "auth_authenticated_access_purchase_order_lines" ON "purchase_order_lines" FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Table: purchase_orders
ALTER TABLE "purchase_orders" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_manage_purchase_orders" ON "purchase_orders";
CREATE POLICY "service_role_manage_purchase_orders" ON "purchase_orders" FOR ALL TO service_role, postgres USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_branch_isolate_purchase_orders" ON "purchase_orders";
CREATE POLICY "auth_branch_isolate_purchase_orders" ON "purchase_orders" FOR ALL TO authenticated USING (branch_id IN (SELECT id FROM public.branches WHERE company_id = public.get_current_user_company_id()) OR public.get_current_user_company_id() IS NULL) WITH CHECK (branch_id IN (SELECT id FROM public.branches WHERE company_id = public.get_current_user_company_id()) OR public.get_current_user_company_id() IS NULL);

-- Table: purchase_receipt_lines
ALTER TABLE "purchase_receipt_lines" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_manage_purchase_receipt_lines" ON "purchase_receipt_lines";
CREATE POLICY "service_role_manage_purchase_receipt_lines" ON "purchase_receipt_lines" FOR ALL TO service_role, postgres USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_authenticated_access_purchase_receipt_lines" ON "purchase_receipt_lines";
CREATE POLICY "auth_authenticated_access_purchase_receipt_lines" ON "purchase_receipt_lines" FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Table: purchase_receipts
ALTER TABLE "purchase_receipts" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_manage_purchase_receipts" ON "purchase_receipts";
CREATE POLICY "service_role_manage_purchase_receipts" ON "purchase_receipts" FOR ALL TO service_role, postgres USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_branch_isolate_purchase_receipts" ON "purchase_receipts";
CREATE POLICY "auth_branch_isolate_purchase_receipts" ON "purchase_receipts" FOR ALL TO authenticated USING (branch_id IN (SELECT id FROM public.branches WHERE company_id = public.get_current_user_company_id()) OR public.get_current_user_company_id() IS NULL) WITH CHECK (branch_id IN (SELECT id FROM public.branches WHERE company_id = public.get_current_user_company_id()) OR public.get_current_user_company_id() IS NULL);

-- Table: purchase_request_lines
ALTER TABLE "purchase_request_lines" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_manage_purchase_request_lines" ON "purchase_request_lines";
CREATE POLICY "service_role_manage_purchase_request_lines" ON "purchase_request_lines" FOR ALL TO service_role, postgres USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_authenticated_access_purchase_request_lines" ON "purchase_request_lines";
CREATE POLICY "auth_authenticated_access_purchase_request_lines" ON "purchase_request_lines" FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Table: purchase_requests
ALTER TABLE "purchase_requests" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_manage_purchase_requests" ON "purchase_requests";
CREATE POLICY "service_role_manage_purchase_requests" ON "purchase_requests" FOR ALL TO service_role, postgres USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_branch_isolate_purchase_requests" ON "purchase_requests";
CREATE POLICY "auth_branch_isolate_purchase_requests" ON "purchase_requests" FOR ALL TO authenticated USING (branch_id IN (SELECT id FROM public.branches WHERE company_id = public.get_current_user_company_id()) OR public.get_current_user_company_id() IS NULL) WITH CHECK (branch_id IN (SELECT id FROM public.branches WHERE company_id = public.get_current_user_company_id()) OR public.get_current_user_company_id() IS NULL);

-- Table: purchase_return_lines
ALTER TABLE "purchase_return_lines" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_manage_purchase_return_lines" ON "purchase_return_lines";
CREATE POLICY "service_role_manage_purchase_return_lines" ON "purchase_return_lines" FOR ALL TO service_role, postgres USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_authenticated_access_purchase_return_lines" ON "purchase_return_lines";
CREATE POLICY "auth_authenticated_access_purchase_return_lines" ON "purchase_return_lines" FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Table: purchase_returns
ALTER TABLE "purchase_returns" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_manage_purchase_returns" ON "purchase_returns";
CREATE POLICY "service_role_manage_purchase_returns" ON "purchase_returns" FOR ALL TO service_role, postgres USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_branch_isolate_purchase_returns" ON "purchase_returns";
CREATE POLICY "auth_branch_isolate_purchase_returns" ON "purchase_returns" FOR ALL TO authenticated USING (branch_id IN (SELECT id FROM public.branches WHERE company_id = public.get_current_user_company_id()) OR public.get_current_user_company_id() IS NULL) WITH CHECK (branch_id IN (SELECT id FROM public.branches WHERE company_id = public.get_current_user_company_id()) OR public.get_current_user_company_id() IS NULL);

-- Table: receipt_vouchers
ALTER TABLE "receipt_vouchers" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_manage_receipt_vouchers" ON "receipt_vouchers";
CREATE POLICY "service_role_manage_receipt_vouchers" ON "receipt_vouchers" FOR ALL TO service_role, postgres USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_branch_isolate_receipt_vouchers" ON "receipt_vouchers";
CREATE POLICY "auth_branch_isolate_receipt_vouchers" ON "receipt_vouchers" FOR ALL TO authenticated USING (branch_id IN (SELECT id FROM public.branches WHERE company_id = public.get_current_user_company_id()) OR public.get_current_user_company_id() IS NULL) WITH CHECK (branch_id IN (SELECT id FROM public.branches WHERE company_id = public.get_current_user_company_id()) OR public.get_current_user_company_id() IS NULL);

-- Table: roles
ALTER TABLE "roles" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_manage_roles" ON "roles";
CREATE POLICY "service_role_manage_roles" ON "roles" FOR ALL TO service_role, postgres USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_tenant_isolate_roles" ON "roles";
CREATE POLICY "auth_tenant_isolate_roles" ON "roles" FOR ALL TO authenticated USING (company_id = public.get_current_user_company_id() OR public.get_current_user_company_id() IS NULL) WITH CHECK (company_id = public.get_current_user_company_id() OR public.get_current_user_company_id() IS NULL);

-- Table: sales_invoice_lines
ALTER TABLE "sales_invoice_lines" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_manage_sales_invoice_lines" ON "sales_invoice_lines";
CREATE POLICY "service_role_manage_sales_invoice_lines" ON "sales_invoice_lines" FOR ALL TO service_role, postgres USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_authenticated_access_sales_invoice_lines" ON "sales_invoice_lines";
CREATE POLICY "auth_authenticated_access_sales_invoice_lines" ON "sales_invoice_lines" FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Table: sales_invoices
ALTER TABLE "sales_invoices" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_manage_sales_invoices" ON "sales_invoices";
CREATE POLICY "service_role_manage_sales_invoices" ON "sales_invoices" FOR ALL TO service_role, postgres USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_branch_isolate_sales_invoices" ON "sales_invoices";
CREATE POLICY "auth_branch_isolate_sales_invoices" ON "sales_invoices" FOR ALL TO authenticated USING (branch_id IN (SELECT id FROM public.branches WHERE company_id = public.get_current_user_company_id()) OR public.get_current_user_company_id() IS NULL) WITH CHECK (branch_id IN (SELECT id FROM public.branches WHERE company_id = public.get_current_user_company_id()) OR public.get_current_user_company_id() IS NULL);

-- Table: sales_quotation_lines
ALTER TABLE "sales_quotation_lines" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_manage_sales_quotation_lines" ON "sales_quotation_lines";
CREATE POLICY "service_role_manage_sales_quotation_lines" ON "sales_quotation_lines" FOR ALL TO service_role, postgres USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_authenticated_access_sales_quotation_lines" ON "sales_quotation_lines";
CREATE POLICY "auth_authenticated_access_sales_quotation_lines" ON "sales_quotation_lines" FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Table: sales_quotations
ALTER TABLE "sales_quotations" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_manage_sales_quotations" ON "sales_quotations";
CREATE POLICY "service_role_manage_sales_quotations" ON "sales_quotations" FOR ALL TO service_role, postgres USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_branch_isolate_sales_quotations" ON "sales_quotations";
CREATE POLICY "auth_branch_isolate_sales_quotations" ON "sales_quotations" FOR ALL TO authenticated USING (branch_id IN (SELECT id FROM public.branches WHERE company_id = public.get_current_user_company_id()) OR public.get_current_user_company_id() IS NULL) WITH CHECK (branch_id IN (SELECT id FROM public.branches WHERE company_id = public.get_current_user_company_id()) OR public.get_current_user_company_id() IS NULL);

-- Table: sales_return_lines
ALTER TABLE "sales_return_lines" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_manage_sales_return_lines" ON "sales_return_lines";
CREATE POLICY "service_role_manage_sales_return_lines" ON "sales_return_lines" FOR ALL TO service_role, postgres USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_authenticated_access_sales_return_lines" ON "sales_return_lines";
CREATE POLICY "auth_authenticated_access_sales_return_lines" ON "sales_return_lines" FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Table: sales_returns
ALTER TABLE "sales_returns" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_manage_sales_returns" ON "sales_returns";
CREATE POLICY "service_role_manage_sales_returns" ON "sales_returns" FOR ALL TO service_role, postgres USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_branch_isolate_sales_returns" ON "sales_returns";
CREATE POLICY "auth_branch_isolate_sales_returns" ON "sales_returns" FOR ALL TO authenticated USING (branch_id IN (SELECT id FROM public.branches WHERE company_id = public.get_current_user_company_id()) OR public.get_current_user_company_id() IS NULL) WITH CHECK (branch_id IN (SELECT id FROM public.branches WHERE company_id = public.get_current_user_company_id()) OR public.get_current_user_company_id() IS NULL);

-- Table: supplier_currencies
ALTER TABLE "supplier_currencies" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_manage_supplier_currencies" ON "supplier_currencies";
CREATE POLICY "service_role_manage_supplier_currencies" ON "supplier_currencies" FOR ALL TO service_role, postgres USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_authenticated_access_supplier_currencies" ON "supplier_currencies";
CREATE POLICY "auth_authenticated_access_supplier_currencies" ON "supplier_currencies" FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Table: supplier_evaluations
ALTER TABLE "supplier_evaluations" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_manage_supplier_evaluations" ON "supplier_evaluations";
CREATE POLICY "service_role_manage_supplier_evaluations" ON "supplier_evaluations" FOR ALL TO service_role, postgres USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_authenticated_access_supplier_evaluations" ON "supplier_evaluations";
CREATE POLICY "auth_authenticated_access_supplier_evaluations" ON "supplier_evaluations" FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Table: supplier_groups
ALTER TABLE "supplier_groups" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_manage_supplier_groups" ON "supplier_groups";
CREATE POLICY "service_role_manage_supplier_groups" ON "supplier_groups" FOR ALL TO service_role, postgres USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_tenant_isolate_supplier_groups" ON "supplier_groups";
CREATE POLICY "auth_tenant_isolate_supplier_groups" ON "supplier_groups" FOR ALL TO authenticated USING (company_id = public.get_current_user_company_id() OR public.get_current_user_company_id() IS NULL) WITH CHECK (company_id = public.get_current_user_company_id() OR public.get_current_user_company_id() IS NULL);

-- Table: supplier_types
ALTER TABLE "supplier_types" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_manage_supplier_types" ON "supplier_types";
CREATE POLICY "service_role_manage_supplier_types" ON "supplier_types" FOR ALL TO service_role, postgres USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_tenant_isolate_supplier_types" ON "supplier_types";
CREATE POLICY "auth_tenant_isolate_supplier_types" ON "supplier_types" FOR ALL TO authenticated USING (company_id = public.get_current_user_company_id() OR public.get_current_user_company_id() IS NULL) WITH CHECK (company_id = public.get_current_user_company_id() OR public.get_current_user_company_id() IS NULL);

-- Table: suppliers
ALTER TABLE "suppliers" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_manage_suppliers" ON "suppliers";
CREATE POLICY "service_role_manage_suppliers" ON "suppliers" FOR ALL TO service_role, postgres USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_tenant_isolate_suppliers" ON "suppliers";
CREATE POLICY "auth_tenant_isolate_suppliers" ON "suppliers" FOR ALL TO authenticated USING (company_id = public.get_current_user_company_id() OR public.get_current_user_company_id() IS NULL) WITH CHECK (company_id = public.get_current_user_company_id() OR public.get_current_user_company_id() IS NULL);

-- Table: system_settings
ALTER TABLE "system_settings" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_manage_system_settings" ON "system_settings";
CREATE POLICY "service_role_manage_system_settings" ON "system_settings" FOR ALL TO service_role, postgres USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_tenant_isolate_system_settings" ON "system_settings";
CREATE POLICY "auth_tenant_isolate_system_settings" ON "system_settings" FOR ALL TO authenticated USING (company_id = public.get_current_user_company_id() OR public.get_current_user_company_id() IS NULL) WITH CHECK (company_id = public.get_current_user_company_id() OR public.get_current_user_company_id() IS NULL);

-- Table: taxes
ALTER TABLE "taxes" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_manage_taxes" ON "taxes";
CREATE POLICY "service_role_manage_taxes" ON "taxes" FOR ALL TO service_role, postgres USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_tenant_isolate_taxes" ON "taxes";
CREATE POLICY "auth_tenant_isolate_taxes" ON "taxes" FOR ALL TO authenticated USING (company_id = public.get_current_user_company_id() OR public.get_current_user_company_id() IS NULL) WITH CHECK (company_id = public.get_current_user_company_id() OR public.get_current_user_company_id() IS NULL);

-- Table: uoms
ALTER TABLE "uoms" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_manage_uoms" ON "uoms";
CREATE POLICY "service_role_manage_uoms" ON "uoms" FOR ALL TO service_role, postgres USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_read_lookup_uoms" ON "uoms";
CREATE POLICY "auth_read_lookup_uoms" ON "uoms" FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "auth_write_lookup_uoms" ON "uoms";
CREATE POLICY "auth_write_lookup_uoms" ON "uoms" FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.users u JOIN public.roles r ON r.id = u.role_id WHERE u.id = auth.uid() AND (r.is_system_role = true OR u.username = 'admin'))) WITH CHECK (EXISTS (SELECT 1 FROM public.users u JOIN public.roles r ON r.id = u.role_id WHERE u.id = auth.uid() AND (r.is_system_role = true OR u.username = 'admin')));

-- Table: users
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_manage_users" ON "users";
CREATE POLICY "service_role_manage_users" ON "users" FOR ALL TO service_role, postgres USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_tenant_isolate_users" ON "users";
CREATE POLICY "auth_tenant_isolate_users" ON "users" FOR ALL TO authenticated USING (company_id = public.get_current_user_company_id() OR public.get_current_user_company_id() IS NULL) WITH CHECK (company_id = public.get_current_user_company_id() OR public.get_current_user_company_id() IS NULL);

-- Table: warehouses
ALTER TABLE "warehouses" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_manage_warehouses" ON "warehouses";
CREATE POLICY "service_role_manage_warehouses" ON "warehouses" FOR ALL TO service_role, postgres USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_branch_isolate_warehouses" ON "warehouses";
CREATE POLICY "auth_branch_isolate_warehouses" ON "warehouses" FOR ALL TO authenticated USING (branch_id IN (SELECT id FROM public.branches WHERE company_id = public.get_current_user_company_id()) OR public.get_current_user_company_id() IS NULL) WITH CHECK (branch_id IN (SELECT id FROM public.branches WHERE company_id = public.get_current_user_company_id()) OR public.get_current_user_company_id() IS NULL);

-- 3. Security Invoker on Views (Resolve Security Definer View Warning)
ALTER VIEW public.v_trial_balance SET (security_invoker = true);
ALTER VIEW public.v_customer_aging SET (security_invoker = true);
ALTER VIEW public.v_inventory_stock SET (security_invoker = true);
ALTER VIEW public.v_supplier_summary SET (security_invoker = true);
ALTER VIEW public.v_supplier_aging SET (security_invoker = true);
