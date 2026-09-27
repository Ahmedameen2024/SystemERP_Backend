-- ============================================================
-- ERP System - Complete PostgreSQL Database Schema
-- Technology: PostgreSQL 15+
-- Character Set: UTF8 (Full Arabic Support)
-- Direction: RTL (Right-to-Left)
-- ============================================================

-- Enable Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- PHASE 1: SYSTEM FOUNDATION & CONFIGURATION
-- ============================================================

-- Companies Table
CREATE TABLE IF NOT EXISTS companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name_ar VARCHAR(255) NOT NULL,
    name_en VARCHAR(255) NOT NULL,
    logo_path VARCHAR(500),
    activity VARCHAR(255),
    tax_number VARCHAR(50) UNIQUE,
    cr_number VARCHAR(50) UNIQUE,
    phone VARCHAR(50),
    email VARCHAR(100),
    website VARCHAR(200),
    address TEXT,
    country VARCHAR(100) DEFAULT 'Saudi Arabia',
    city VARCHAR(100),
    base_currency_id UUID,
    fiscal_year_start DATE,
    fiscal_year_end DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Branches Table
CREATE TABLE IF NOT EXISTS branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL UNIQUE,
    name_ar VARCHAR(255) NOT NULL,
    name_en VARCHAR(255) NOT NULL,
    manager_id UUID,
    city VARCHAR(100),
    address TEXT,
    phone VARCHAR(50),
    email VARCHAR(100),
    status VARCHAR(20) DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Currencies Table
CREATE TABLE IF NOT EXISTS currencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(10) NOT NULL UNIQUE,
    name_ar VARCHAR(100) NOT NULL,
    name_en VARCHAR(100) NOT NULL,
    symbol VARCHAR(10),
    decimal_places INTEGER DEFAULT 2,
    is_default BOOLEAN DEFAULT FALSE,
    status VARCHAR(20) DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add FK from companies to currencies
ALTER TABLE companies ADD CONSTRAINT fk_companies_currency
    FOREIGN KEY (base_currency_id) REFERENCES currencies(id);

-- Exchange Rates Table
CREATE TABLE IF NOT EXISTS exchange_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    currency_id UUID REFERENCES currencies(id) ON DELETE CASCADE,
    rate_date DATE NOT NULL,
    buy_rate NUMERIC(15, 6) NOT NULL CHECK (buy_rate > 0),
    sell_rate NUMERIC(15, 6) NOT NULL CHECK (sell_rate > 0),
    mid_rate NUMERIC(15, 6) NOT NULL CHECK (mid_rate > 0),
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (currency_id, rate_date)
);

-- Roles Table
CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    name_ar VARCHAR(255) NOT NULL,
    name_en VARCHAR(255) NOT NULL,
    description TEXT,
    is_system_role BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    name_ar VARCHAR(255),
    name_en VARCHAR(255),
    email VARCHAR(100) UNIQUE,
    employee_id UUID,
    role_id UUID REFERENCES roles(id),
    company_id UUID REFERENCES companies(id),
    branch_id UUID REFERENCES branches(id),
    language VARCHAR(10) DEFAULT 'ar',
    status VARCHAR(20) DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive', 'Suspended')),
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add FKs to branches manager and exchange_rates created_by
ALTER TABLE branches ADD CONSTRAINT fk_branches_manager
    FOREIGN KEY (manager_id) REFERENCES users(id);
ALTER TABLE exchange_rates ADD CONSTRAINT fk_exchange_rates_created_by
    FOREIGN KEY (created_by) REFERENCES users(id);

-- Permissions Table
CREATE TABLE IF NOT EXISTS permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
    module_name VARCHAR(100) NOT NULL,
    screen_name VARCHAR(100) NOT NULL,
    can_view BOOLEAN DEFAULT FALSE,
    can_create BOOLEAN DEFAULT FALSE,
    can_edit BOOLEAN DEFAULT FALSE,
    can_delete BOOLEAN DEFAULT FALSE,
    can_approve BOOLEAN DEFAULT FALSE,
    can_print BOOLEAN DEFAULT FALSE,
    can_export BOOLEAN DEFAULT FALSE,
    UNIQUE (role_id, module_name, screen_name)
);

-- System Settings Table
CREATE TABLE IF NOT EXISTS system_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    key VARCHAR(100) NOT NULL,
    value TEXT,
    description TEXT,
    updated_by UUID REFERENCES users(id),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (company_id, key)
);

-- Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    action_type VARCHAR(50) NOT NULL CHECK (action_type IN ('INSERT', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'APPROVE', 'VOID')),
    table_name VARCHAR(100) NOT NULL,
    record_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    description TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Payment Methods Table
CREATE TABLE IF NOT EXISTS payment_methods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    name_ar VARCHAR(100) NOT NULL,
    name_en VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('Cash', 'Credit', 'BankTransfer', 'Card', 'Cheque', 'EWallet')),
    gl_account_id UUID,
    status VARCHAR(20) DEFAULT 'Active',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tax Rates Table
CREATE TABLE IF NOT EXISTS taxes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name_ar VARCHAR(100) NOT NULL,
    name_en VARCHAR(100) NOT NULL,
    rate NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    type VARCHAR(50) DEFAULT 'VAT' CHECK (type IN ('VAT', 'Exempt', 'ZeroRated', 'Custom')),
    gl_account_id UUID,
    status VARCHAR(20) DEFAULT 'Active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (company_id, code)
);

-- Departments Table
CREATE TABLE IF NOT EXISTS departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL UNIQUE,
    name_ar VARCHAR(255) NOT NULL,
    name_en VARCHAR(255) NOT NULL,
    manager_id UUID REFERENCES users(id),
    status VARCHAR(20) DEFAULT 'Active',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PHASE 2: CORE FINANCIALS (GENERAL LEDGER)
-- ============================================================

-- Financial Periods Table
CREATE TABLE IF NOT EXISTS financial_periods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_closed BOOLEAN DEFAULT FALSE,
    closed_by UUID REFERENCES users(id),
    closed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (company_id, start_date, end_date)
);

-- GL Accounts (Chart of Accounts) Table
CREATE TABLE IF NOT EXISTS gl_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name_ar VARCHAR(255) NOT NULL,
    name_en VARCHAR(255) NOT NULL,
    parent_id UUID REFERENCES gl_accounts(id),
    account_level INTEGER NOT NULL DEFAULT 1,
    account_type VARCHAR(50) NOT NULL CHECK (account_type IN ('Asset', 'Liability', 'Equity', 'Revenue', 'Expense')),
    nature VARCHAR(10) NOT NULL CHECK (nature IN ('Debit', 'Credit')),
    currency_id UUID REFERENCES currencies(id),
    allow_posting BOOLEAN DEFAULT TRUE,
    status VARCHAR(20) DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (company_id, code)
);

-- Add FK from payment_methods and taxes to gl_accounts
ALTER TABLE payment_methods ADD CONSTRAINT fk_payment_methods_gl
    FOREIGN KEY (gl_account_id) REFERENCES gl_accounts(id);
ALTER TABLE taxes ADD CONSTRAINT fk_taxes_gl
    FOREIGN KEY (gl_account_id) REFERENCES gl_accounts(id);

-- Cost Centers Table
CREATE TABLE IF NOT EXISTS cost_centers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name_ar VARCHAR(255) NOT NULL,
    name_en VARCHAR(255) NOT NULL,
    parent_id UUID REFERENCES cost_centers(id),
    manager_id UUID REFERENCES users(id),
    budget NUMERIC(15, 4) DEFAULT 0.0000,
    status VARCHAR(20) DEFAULT 'Active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (company_id, code)
);

-- Journal Entries (Header) Table
CREATE TABLE IF NOT EXISTS journal_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_number VARCHAR(100) NOT NULL UNIQUE,
    entry_date DATE NOT NULL,
    period_id UUID REFERENCES financial_periods(id),
    description TEXT,
    reference_no VARCHAR(100),
    reference_type VARCHAR(50),
    reference_id UUID,
    status VARCHAR(20) DEFAULT 'Draft' CHECK (status IN ('Draft', 'Approved', 'Posted', 'Void')),
    branch_id UUID REFERENCES branches(id),
    currency_id UUID REFERENCES currencies(id),
    exchange_rate NUMERIC(15, 6) DEFAULT 1.000000,
    total_debit NUMERIC(15, 4) DEFAULT 0.0000,
    total_credit NUMERIC(15, 4) DEFAULT 0.0000,
    created_by UUID REFERENCES users(id),
    approved_by UUID REFERENCES users(id),
    posted_at TIMESTAMPTZ,
    voided_by UUID REFERENCES users(id),
    void_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Journal Entry Lines Table
CREATE TABLE IF NOT EXISTS journal_entry_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    journal_entry_id UUID REFERENCES journal_entries(id) ON DELETE CASCADE,
    gl_account_id UUID REFERENCES gl_accounts(id) NOT NULL,
    cost_center_id UUID REFERENCES cost_centers(id),
    branch_id UUID REFERENCES branches(id),
    cash_box_id UUID,
    bank_account_id UUID,
    customer_id UUID,
    supplier_id UUID,
    employee_id UUID,
    project_id UUID,
    debit NUMERIC(15, 4) DEFAULT 0.0000,
    credit NUMERIC(15, 4) DEFAULT 0.0000,
    debit_base NUMERIC(15, 4) DEFAULT 0.0000,
    credit_base NUMERIC(15, 4) DEFAULT 0.0000,
    line_description TEXT,
    sort_order INTEGER DEFAULT 0
);

-- ============================================================
-- PHASE 3: INVENTORY & WAREHOUSE MASTER
-- ============================================================

-- Units of Measure Table
CREATE TABLE IF NOT EXISTS uoms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(20) NOT NULL UNIQUE,
    name_ar VARCHAR(100) NOT NULL,
    name_en VARCHAR(100) NOT NULL,
    abbreviation VARCHAR(10) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('Weight', 'Length', 'Volume', 'Quantity', 'Time', 'Other')),
    base_uom_id UUID REFERENCES uoms(id),
    conversion_factor NUMERIC(15, 6) DEFAULT 1.000000,
    status VARCHAR(20) DEFAULT 'Active',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Item Categories Table
CREATE TABLE IF NOT EXISTS item_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name_ar VARCHAR(255) NOT NULL,
    name_en VARCHAR(255) NOT NULL,
    parent_category_id UUID REFERENCES item_categories(id),
    description TEXT,
    status VARCHAR(20) DEFAULT 'Active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (company_id, code)
);

-- Warehouses Table
CREATE TABLE IF NOT EXISTS warehouses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL UNIQUE,
    name_ar VARCHAR(255) NOT NULL,
    name_en VARCHAR(255) NOT NULL,
    manager_id UUID REFERENCES users(id),
    location TEXT,
    capacity NUMERIC(15, 2),
    status VARCHAR(20) DEFAULT 'Active',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Items (Product Master) Table
CREATE TABLE IF NOT EXISTS items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name_ar VARCHAR(255) NOT NULL,
    name_en VARCHAR(255) NOT NULL,
    uom_id UUID REFERENCES uoms(id),
    category_id UUID REFERENCES item_categories(id),
    cost_price NUMERIC(15, 4) DEFAULT 0.0000,
    selling_price NUMERIC(15, 4) DEFAULT 0.0000,
    reorder_level NUMERIC(15, 4) DEFAULT 0.0000,
    barcode VARCHAR(100) UNIQUE,
    description TEXT,
    inventory_account_id UUID REFERENCES gl_accounts(id),
    cogs_account_id UUID REFERENCES gl_accounts(id),
    revenue_account_id UUID REFERENCES gl_accounts(id),
    tax_id UUID REFERENCES taxes(id),
    status VARCHAR(20) DEFAULT 'Active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (company_id, code)
);

-- Inventory Transactions (Stock Movements) Table
CREATE TABLE IF NOT EXISTS inventory_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_number VARCHAR(100) NOT NULL UNIQUE,
    transaction_date DATE NOT NULL,
    transaction_type VARCHAR(50) NOT NULL CHECK (transaction_type IN ('Receipt', 'Issue', 'Transfer', 'Adjustment', 'Opening')),
    warehouse_id UUID REFERENCES warehouses(id),
    target_warehouse_id UUID REFERENCES warehouses(id),
    reference_type VARCHAR(50),
    reference_id UUID,
    description TEXT,
    status VARCHAR(20) DEFAULT 'Draft' CHECK (status IN ('Draft', 'Posted', 'Void')),
    journal_entry_id UUID REFERENCES journal_entries(id),
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inventory Transaction Lines Table
CREATE TABLE IF NOT EXISTS inventory_transaction_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inventory_transaction_id UUID REFERENCES inventory_transactions(id) ON DELETE CASCADE,
    item_id UUID REFERENCES items(id) NOT NULL,
    uom_id UUID REFERENCES uoms(id) NOT NULL,
    quantity NUMERIC(15, 4) NOT NULL,
    unit_cost NUMERIC(15, 4) DEFAULT 0.0000,
    total_cost NUMERIC(15, 4) DEFAULT 0.0000,
    batch_number VARCHAR(100),
    expiry_date DATE,
    sort_order INTEGER DEFAULT 0
);

-- Inventory Balances View (current stock per item/warehouse)
CREATE TABLE IF NOT EXISTS inventory_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID REFERENCES items(id) ON DELETE CASCADE,
    warehouse_id UUID REFERENCES warehouses(id) ON DELETE CASCADE,
    quantity_on_hand NUMERIC(15, 4) DEFAULT 0.0000,
    average_cost NUMERIC(15, 4) DEFAULT 0.0000,
    total_value NUMERIC(15, 4) DEFAULT 0.0000,
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (item_id, warehouse_id)
);

-- ============================================================
-- PHASE 4: SALES MODULE & CUSTOMERS
-- ============================================================

-- Customers Table
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name_ar VARCHAR(255) NOT NULL,
    name_en VARCHAR(255) NOT NULL,
    trade_name VARCHAR(255),
    phone VARCHAR(50),
    email VARCHAR(100),
    city VARCHAR(100),
    address TEXT,
    tax_number VARCHAR(50),
    cr_number VARCHAR(50),
    credit_limit NUMERIC(15, 4) DEFAULT 0.0000,
    opening_balance NUMERIC(15, 4) DEFAULT 0.0000,
    balance NUMERIC(15, 4) DEFAULT 0.0000,
    currency_id UUID REFERENCES currencies(id),
    ar_account_id UUID REFERENCES gl_accounts(id),
    payment_terms INTEGER DEFAULT 30,
    status VARCHAR(20) DEFAULT 'Active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (company_id, code)
);

-- Sales Quotations Table
CREATE TABLE IF NOT EXISTS sales_quotations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quotation_number VARCHAR(100) NOT NULL UNIQUE,
    quotation_date DATE NOT NULL,
    valid_until DATE,
    customer_id UUID REFERENCES customers(id) NOT NULL,
    branch_id UUID REFERENCES branches(id) NOT NULL,
    currency_id UUID REFERENCES currencies(id) NOT NULL,
    exchange_rate NUMERIC(15, 6) DEFAULT 1.000000,
    total_amount NUMERIC(15, 4) DEFAULT 0.0000,
    discount_amount NUMERIC(15, 4) DEFAULT 0.0000,
    tax_amount NUMERIC(15, 4) DEFAULT 0.0000,
    net_amount NUMERIC(15, 4) DEFAULT 0.0000,
    notes TEXT,
    status VARCHAR(20) DEFAULT 'Draft' CHECK (status IN ('Draft', 'Sent', 'Accepted', 'Rejected', 'Expired', 'Converted')),
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sales Quotation Lines Table
CREATE TABLE IF NOT EXISTS sales_quotation_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sales_quotation_id UUID REFERENCES sales_quotations(id) ON DELETE CASCADE,
    item_id UUID REFERENCES items(id) NOT NULL,
    uom_id UUID REFERENCES uoms(id) NOT NULL,
    quantity NUMERIC(15, 4) NOT NULL,
    unit_price NUMERIC(15, 4) NOT NULL,
    discount_percentage NUMERIC(5, 2) DEFAULT 0.00,
    tax_id UUID REFERENCES taxes(id),
    tax_amount NUMERIC(15, 4) DEFAULT 0.0000,
    total_amount NUMERIC(15, 4) NOT NULL,
    notes TEXT,
    sort_order INTEGER DEFAULT 0
);

-- Sales Invoices Table
CREATE TABLE IF NOT EXISTS sales_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number VARCHAR(100) NOT NULL UNIQUE,
    invoice_date DATE NOT NULL,
    due_date DATE,
    customer_id UUID REFERENCES customers(id) NOT NULL,
    branch_id UUID REFERENCES branches(id) NOT NULL,
    warehouse_id UUID REFERENCES warehouses(id) NOT NULL,
    quotation_id UUID REFERENCES sales_quotations(id),
    payment_method_id UUID REFERENCES payment_methods(id),
    currency_id UUID REFERENCES currencies(id) NOT NULL,
    exchange_rate NUMERIC(15, 6) DEFAULT 1.000000,
    sales_rep_id UUID REFERENCES users(id),
    total_amount NUMERIC(15, 4) DEFAULT 0.0000,
    discount_amount NUMERIC(15, 4) DEFAULT 0.0000,
    tax_amount NUMERIC(15, 4) DEFAULT 0.0000,
    net_amount NUMERIC(15, 4) DEFAULT 0.0000,
    paid_amount NUMERIC(15, 4) DEFAULT 0.0000,
    remaining_amount NUMERIC(15, 4) DEFAULT 0.0000,
    notes TEXT,
    status VARCHAR(20) DEFAULT 'Draft' CHECK (status IN ('Draft', 'Approved', 'Posted', 'Paid', 'PartiallyPaid', 'Void')),
    journal_entry_id UUID REFERENCES journal_entries(id),
    -- ZATCA e-invoicing fields
    zatca_uuid UUID DEFAULT gen_random_uuid(),
    zatca_invoice_hash VARCHAR(256),
    zatca_xml_payload TEXT,
    zatca_qr_code TEXT,
    created_by UUID REFERENCES users(id),
    approved_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sales Invoice Lines Table
CREATE TABLE IF NOT EXISTS sales_invoice_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sales_invoice_id UUID REFERENCES sales_invoices(id) ON DELETE CASCADE,
    item_id UUID REFERENCES items(id) NOT NULL,
    uom_id UUID REFERENCES uoms(id) NOT NULL,
    quantity NUMERIC(15, 4) NOT NULL,
    unit_price NUMERIC(15, 4) NOT NULL,
    discount_percentage NUMERIC(5, 2) DEFAULT 0.00,
    tax_id UUID REFERENCES taxes(id),
    tax_amount NUMERIC(15, 4) DEFAULT 0.0000,
    total_amount NUMERIC(15, 4) NOT NULL,
    unit_cost NUMERIC(15, 4) DEFAULT 0.0000,
    cogs_amount NUMERIC(15, 4) DEFAULT 0.0000,
    notes TEXT,
    sort_order INTEGER DEFAULT 0
);

-- Sales Returns Table
CREATE TABLE IF NOT EXISTS sales_returns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    return_number VARCHAR(100) NOT NULL UNIQUE,
    return_date DATE NOT NULL,
    original_invoice_id UUID REFERENCES sales_invoices(id) NOT NULL,
    customer_id UUID REFERENCES customers(id) NOT NULL,
    branch_id UUID REFERENCES branches(id) NOT NULL,
    warehouse_id UUID REFERENCES warehouses(id) NOT NULL,
    currency_id UUID REFERENCES currencies(id) NOT NULL,
    total_amount NUMERIC(15, 4) DEFAULT 0.0000,
    tax_amount NUMERIC(15, 4) DEFAULT 0.0000,
    net_amount NUMERIC(15, 4) DEFAULT 0.0000,
    reason TEXT,
    status VARCHAR(20) DEFAULT 'Draft' CHECK (status IN ('Draft', 'Approved', 'Posted', 'Void')),
    journal_entry_id UUID REFERENCES journal_entries(id),
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sales Return Lines Table
CREATE TABLE IF NOT EXISTS sales_return_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sales_return_id UUID REFERENCES sales_returns(id) ON DELETE CASCADE,
    original_line_id UUID REFERENCES sales_invoice_lines(id),
    item_id UUID REFERENCES items(id) NOT NULL,
    uom_id UUID REFERENCES uoms(id) NOT NULL,
    quantity NUMERIC(15, 4) NOT NULL,
    unit_price NUMERIC(15, 4) NOT NULL,
    tax_amount NUMERIC(15, 4) DEFAULT 0.0000,
    total_amount NUMERIC(15, 4) NOT NULL,
    sort_order INTEGER DEFAULT 0
);

-- ============================================================
-- PHASE 5: PURCHASING MODULE & SUPPLIERS
-- ============================================================

-- Suppliers Table
CREATE TABLE IF NOT EXISTS suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name_ar VARCHAR(255) NOT NULL,
    name_en VARCHAR(255) NOT NULL,
    contact_person VARCHAR(100),
    phone VARCHAR(50),
    email VARCHAR(100),
    city VARCHAR(100),
    address TEXT,
    tax_number VARCHAR(50),
    cr_number VARCHAR(50),
    credit_limit NUMERIC(15, 4) DEFAULT NULL,
    opening_balance NUMERIC(15, 4) DEFAULT 0.0000,
    balance NUMERIC(15, 4) DEFAULT 0.0000,
    currency_id UUID REFERENCES currencies(id) NOT NULL,
    ap_account_id UUID REFERENCES gl_accounts(id),
    payment_terms INTEGER DEFAULT 30,
    status VARCHAR(20) DEFAULT 'Active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (company_id, code)
);

-- Purchase Orders Table
CREATE TABLE IF NOT EXISTS purchase_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number VARCHAR(100) NOT NULL UNIQUE,
    order_date DATE NOT NULL,
    expected_date DATE,
    supplier_id UUID REFERENCES suppliers(id) NOT NULL,
    branch_id UUID REFERENCES branches(id) NOT NULL,
    warehouse_id UUID REFERENCES warehouses(id) NOT NULL,
    currency_id UUID REFERENCES currencies(id) NOT NULL,
    exchange_rate NUMERIC(15, 6) DEFAULT 1.000000,
    total_amount NUMERIC(15, 4) DEFAULT 0.0000,
    discount_amount NUMERIC(15, 4) DEFAULT 0.0000,
    tax_amount NUMERIC(15, 4) DEFAULT 0.0000,
    net_amount NUMERIC(15, 4) DEFAULT 0.0000,
    notes TEXT,
    status VARCHAR(20) DEFAULT 'Draft' CHECK (status IN ('Draft', 'Approved', 'PartiallyReceived', 'FullyReceived', 'Cancelled')),
    created_by UUID REFERENCES users(id),
    approved_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Purchase Order Lines Table
CREATE TABLE IF NOT EXISTS purchase_order_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_order_id UUID REFERENCES purchase_orders(id) ON DELETE CASCADE,
    item_id UUID REFERENCES items(id) NOT NULL,
    uom_id UUID REFERENCES uoms(id) NOT NULL,
    quantity NUMERIC(15, 4) NOT NULL,
    received_quantity NUMERIC(15, 4) DEFAULT 0.0000,
    unit_cost NUMERIC(15, 4) NOT NULL,
    discount_percentage NUMERIC(5, 2) DEFAULT 0.00,
    tax_id UUID REFERENCES taxes(id),
    tax_amount NUMERIC(15, 4) DEFAULT 0.0000,
    total_amount NUMERIC(15, 4) NOT NULL,
    notes TEXT,
    sort_order INTEGER DEFAULT 0
);

-- Purchase Invoices Table
CREATE TABLE IF NOT EXISTS purchase_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number VARCHAR(100) NOT NULL UNIQUE,
    vendor_invoice_number VARCHAR(100),
    invoice_date DATE NOT NULL,
    due_date DATE,
    supplier_id UUID REFERENCES suppliers(id) NOT NULL,
    purchase_order_id UUID REFERENCES purchase_orders(id),
    branch_id UUID REFERENCES branches(id) NOT NULL,
    warehouse_id UUID REFERENCES warehouses(id) NOT NULL,
    currency_id UUID REFERENCES currencies(id) NOT NULL,
    exchange_rate NUMERIC(15, 6) DEFAULT 1.000000,
    total_amount NUMERIC(15, 4) DEFAULT 0.0000,
    discount_amount NUMERIC(15, 4) DEFAULT 0.0000,
    tax_amount NUMERIC(15, 4) DEFAULT 0.0000,
    net_amount NUMERIC(15, 4) DEFAULT 0.0000,
    paid_amount NUMERIC(15, 4) DEFAULT 0.0000,
    remaining_amount NUMERIC(15, 4) DEFAULT 0.0000,
    notes TEXT,
    status VARCHAR(20) DEFAULT 'Draft' CHECK (status IN ('Draft', 'Approved', 'Posted', 'Paid', 'PartiallyPaid', 'Void')),
    journal_entry_id UUID REFERENCES journal_entries(id),
    created_by UUID REFERENCES users(id),
    approved_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Purchase Invoice Lines Table
CREATE TABLE IF NOT EXISTS purchase_invoice_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_invoice_id UUID REFERENCES purchase_invoices(id) ON DELETE CASCADE,
    po_line_id UUID REFERENCES purchase_order_lines(id),
    item_id UUID REFERENCES items(id) NOT NULL,
    uom_id UUID REFERENCES uoms(id) NOT NULL,
    quantity NUMERIC(15, 4) NOT NULL,
    unit_cost NUMERIC(15, 4) NOT NULL,
    discount_percentage NUMERIC(5, 2) DEFAULT 0.00,
    tax_id UUID REFERENCES taxes(id),
    tax_amount NUMERIC(15, 4) DEFAULT 0.0000,
    total_amount NUMERIC(15, 4) NOT NULL,
    notes TEXT,
    sort_order INTEGER DEFAULT 0
);

-- ============================================================
-- PHASE 6: VOUCHERS & CASH MANAGEMENT
-- ============================================================

-- Cash Boxes Master Table
CREATE TABLE IF NOT EXISTS cash_boxes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id) NOT NULL,
    code VARCHAR(50) NOT NULL,
    name_ar VARCHAR(255) NOT NULL,
    name_en VARCHAR(255) NOT NULL,
    currency_id UUID REFERENCES currencies(id) NOT NULL,
    gl_account_id UUID REFERENCES gl_accounts(id) NOT NULL,
    responsible_employee_id UUID REFERENCES users(id),
    opening_balance NUMERIC(15, 4) DEFAULT 0.0000,
    current_balance NUMERIC(15, 4) DEFAULT 0.0000,
    maximum_balance NUMERIC(15, 4) DEFAULT 0.0000,
    status VARCHAR(20) DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
    notes TEXT,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (company_id, code)
);

-- Bank Accounts Master Table
CREATE TABLE IF NOT EXISTS bank_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id) NOT NULL,
    code VARCHAR(50) NOT NULL,
    name_ar VARCHAR(255) NOT NULL,
    name_en VARCHAR(255) NOT NULL,
    currency_id UUID REFERENCES currencies(id) NOT NULL,
    gl_account_id UUID REFERENCES gl_accounts(id) NOT NULL,
    account_number VARCHAR(100) NOT NULL,
    iban VARCHAR(50),
    swift VARCHAR(50),
    contact_person VARCHAR(100),
    phone VARCHAR(50),
    email VARCHAR(100),
    opening_balance NUMERIC(15, 4) DEFAULT 0.0000,
    current_balance NUMERIC(15, 4) DEFAULT 0.0000,
    status VARCHAR(20) DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
    notes TEXT,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (company_id, code),
    UNIQUE (company_id, account_number)
);

-- Receipt Vouchers Table
CREATE TABLE IF NOT EXISTS receipt_vouchers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    voucher_number VARCHAR(100) NOT NULL UNIQUE,
    voucher_date DATE NOT NULL,
    customer_id UUID REFERENCES customers(id),
    branch_id UUID REFERENCES branches(id),
    payment_method_id UUID REFERENCES payment_methods(id),
    cash_account_id UUID REFERENCES gl_accounts(id),
    cash_box_id UUID REFERENCES cash_boxes(id),
    bank_account_id UUID REFERENCES bank_accounts(id),
    posting_mode VARCHAR(50) DEFAULT 'Immediate',
    due_date DATE,
    amount NUMERIC(15, 4) NOT NULL CHECK (amount > 0),
    currency_id UUID REFERENCES currencies(id),
    exchange_rate NUMERIC(15, 6) DEFAULT 1.000000,
    cheque_number VARCHAR(50),
    cheque_date DATE,
    bank_name VARCHAR(100),
    description TEXT,
    status VARCHAR(20) DEFAULT 'Draft' CHECK (status IN ('Draft', 'Approved', 'Posted', 'Void', 'Reversed')),
    journal_entry_id UUID REFERENCES journal_entries(id),
    invoice_settlement JSONB,
    created_by UUID REFERENCES users(id),
    approved_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payment Vouchers Table
CREATE TABLE IF NOT EXISTS payment_vouchers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    voucher_number VARCHAR(100) NOT NULL UNIQUE,
    voucher_date DATE NOT NULL,
    supplier_id UUID REFERENCES suppliers(id),
    beneficiary_name VARCHAR(255),
    branch_id UUID REFERENCES branches(id),
    payment_method_id UUID REFERENCES payment_methods(id),
    cash_account_id UUID REFERENCES gl_accounts(id),
    cash_box_id UUID REFERENCES cash_boxes(id),
    bank_account_id UUID REFERENCES bank_accounts(id),
    posting_mode VARCHAR(50) DEFAULT 'Immediate',
    due_date DATE,
    amount NUMERIC(15, 4) NOT NULL CHECK (amount > 0),
    currency_id UUID REFERENCES currencies(id),
    exchange_rate NUMERIC(15, 6) DEFAULT 1.000000,
    cheque_number VARCHAR(50),
    cheque_date DATE,
    bank_name VARCHAR(100),
    description TEXT,
    status VARCHAR(20) DEFAULT 'Draft' CHECK (status IN ('Draft', 'Approved', 'Posted', 'Void', 'Reversed')),
    journal_entry_id UUID REFERENCES journal_entries(id),
    invoice_settlement JSONB,
    created_by UUID REFERENCES users(id),
    approved_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payment Voucher Lines Table (Expense allocation)
CREATE TABLE IF NOT EXISTS payment_voucher_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_voucher_id UUID REFERENCES payment_vouchers(id) ON DELETE CASCADE,
    gl_account_id UUID REFERENCES gl_accounts(id) NOT NULL,
    cost_center_id UUID REFERENCES cost_centers(id),
    amount NUMERIC(15, 4) NOT NULL,
    notes TEXT,
    sort_order INTEGER DEFAULT 0
);

-- Multi-Currency Balances & Relationships
CREATE TABLE IF NOT EXISTS customer_currencies (
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    currency_id UUID REFERENCES currencies(id) ON DELETE RESTRICT,
    opening_balance NUMERIC(15, 4) DEFAULT 0.0000,
    balance NUMERIC(15, 4) DEFAULT 0.0000,
    credit_limit NUMERIC(15, 4) DEFAULT NULL,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (customer_id, currency_id)
);

CREATE TABLE IF NOT EXISTS supplier_currencies (
    supplier_id UUID REFERENCES suppliers(id) ON DELETE CASCADE,
    currency_id UUID REFERENCES currencies(id) ON DELETE RESTRICT,
    opening_balance NUMERIC(15, 4) DEFAULT 0.0000,
    balance NUMERIC(15, 4) DEFAULT 0.0000,
    credit_limit NUMERIC(15, 4) DEFAULT NULL,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (supplier_id, currency_id)
);

CREATE TABLE IF NOT EXISTS account_currencies (
    gl_account_id UUID REFERENCES gl_accounts(id) ON DELETE CASCADE,
    currency_id UUID REFERENCES currencies(id) ON DELETE RESTRICT,
    opening_balance NUMERIC(15, 4) DEFAULT 0.0000,
    balance NUMERIC(15, 4) DEFAULT 0.0000,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (gl_account_id, currency_id)
);

CREATE TABLE IF NOT EXISTS cash_box_currencies (
    cash_box_id UUID REFERENCES cash_boxes(id) ON DELETE CASCADE,
    currency_id UUID REFERENCES currencies(id) ON DELETE RESTRICT,
    opening_balance NUMERIC(15, 4) DEFAULT 0.0000,
    current_balance NUMERIC(15, 4) DEFAULT 0.0000,
    maximum_balance NUMERIC(15, 4) DEFAULT 0.0000,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (cash_box_id, currency_id)
);

CREATE TABLE IF NOT EXISTS bank_account_currencies (
    bank_account_id UUID REFERENCES bank_accounts(id) ON DELETE CASCADE,
    currency_id UUID REFERENCES currencies(id) ON DELETE RESTRICT,
    opening_balance NUMERIC(15, 4) DEFAULT 0.0000,
    current_balance NUMERIC(15, 4) DEFAULT 0.0000,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (bank_account_id, currency_id)
);

-- Currency Transfers / Exchange Table
CREATE TABLE IF NOT EXISTS currency_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id),
    transfer_number VARCHAR(100) NOT NULL UNIQUE,
    transfer_date DATE NOT NULL,
    source_cash_box_id UUID REFERENCES cash_boxes(id),
    source_bank_account_id UUID REFERENCES bank_accounts(id),
    source_currency_id UUID REFERENCES currencies(id) NOT NULL,
    source_amount NUMERIC(15, 4) NOT NULL CHECK (source_amount > 0),
    target_cash_box_id UUID REFERENCES cash_boxes(id),
    target_bank_account_id UUID REFERENCES bank_accounts(id),
    target_currency_id UUID REFERENCES currencies(id) NOT NULL,
    target_amount NUMERIC(15, 4) NOT NULL CHECK (target_amount > 0),
    exchange_rate NUMERIC(15, 6) NOT NULL CHECK (exchange_rate > 0),
    difference_amount NUMERIC(15, 4) DEFAULT 0.0000,
    difference_gl_account_id UUID REFERENCES gl_accounts(id),
    notes TEXT,
    status VARCHAR(20) DEFAULT 'Posted' CHECK (status IN ('Draft', 'Posted', 'Void')),
    journal_entry_id UUID REFERENCES journal_entries(id),
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PHASE 7: HR & BIOMETRIC ATTENDANCE
-- ============================================================

-- Leave Types Table
CREATE TABLE IF NOT EXISTS leave_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    name_ar VARCHAR(100) NOT NULL,
    name_en VARCHAR(100) NOT NULL,
    max_days_per_year INTEGER,
    is_paid BOOLEAN DEFAULT TRUE,
    status VARCHAR(20) DEFAULT 'Active',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Employees Table
CREATE TABLE IF NOT EXISTS employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_number VARCHAR(50) NOT NULL UNIQUE,
    name_ar VARCHAR(255) NOT NULL,
    name_en VARCHAR(255) NOT NULL,
    national_id VARCHAR(20),
    department_id UUID REFERENCES departments(id),
    job_title VARCHAR(100),
    branch_id UUID REFERENCES branches(id),
    hire_date DATE NOT NULL,
    contract_type VARCHAR(20) DEFAULT 'Permanent' CHECK (contract_type IN ('Permanent', 'Temporary', 'Contract', 'Freelance')),
    basic_salary NUMERIC(15, 4) DEFAULT 0.0000,
    nationality VARCHAR(50),
    phone VARCHAR(50),
    email VARCHAR(100),
    address TEXT,
    bank_account VARCHAR(50),
    iban VARCHAR(50),
    user_id UUID REFERENCES users(id),
    status VARCHAR(20) DEFAULT 'Active' CHECK (status IN ('Active', 'OnLeave', 'Suspended', 'Terminated')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Update users table to link to employees
ALTER TABLE users ADD CONSTRAINT fk_users_employee
    FOREIGN KEY (employee_id) REFERENCES employees(id);

-- Biometric Logs Table
CREATE TABLE IF NOT EXISTS biometric_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    log_datetime TIMESTAMPTZ NOT NULL,
    log_type VARCHAR(20) DEFAULT 'CheckIn' CHECK (log_type IN ('CheckIn', 'CheckOut')),
    device_id VARCHAR(50),
    raw_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Attendances Table
CREATE TABLE IF NOT EXISTS attendances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    attendance_date DATE NOT NULL,
    check_in TIME,
    check_out TIME,
    work_hours NUMERIC(5, 2) DEFAULT 0.00,
    delay_hours NUMERIC(5, 2) DEFAULT 0.00,
    overtime_hours NUMERIC(5, 2) DEFAULT 0.00,
    status VARCHAR(20) DEFAULT 'Present' CHECK (status IN ('Present', 'Absent', 'Leave', 'Holiday', 'Mission', 'HalfDay')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (employee_id, attendance_date)
);

-- Leave Requests Table
CREATE TABLE IF NOT EXISTS leave_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_number VARCHAR(100) NOT NULL UNIQUE,
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    leave_type_id UUID REFERENCES leave_types(id),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    total_days INTEGER,
    reason TEXT,
    status VARCHAR(20) DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected', 'Cancelled')),
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PHASE 8: PAYROLL & ALLOWANCES
-- ============================================================

-- Allowance Types Table
CREATE TABLE IF NOT EXISTS allowance_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name_ar VARCHAR(100) NOT NULL,
    name_en VARCHAR(100) NOT NULL,
    calculation_method VARCHAR(20) DEFAULT 'Fixed' CHECK (calculation_method IN ('Fixed', 'Percentage')),
    is_taxable BOOLEAN DEFAULT FALSE,
    gl_account_id UUID REFERENCES gl_accounts(id),
    status VARCHAR(20) DEFAULT 'Active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (company_id, code)
);

-- Deduction Types Table
CREATE TABLE IF NOT EXISTS deduction_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name_ar VARCHAR(100) NOT NULL,
    name_en VARCHAR(100) NOT NULL,
    calculation_method VARCHAR(20) DEFAULT 'Fixed' CHECK (calculation_method IN ('Fixed', 'Percentage', 'DailyRate')),
    gl_account_id UUID REFERENCES gl_accounts(id),
    status VARCHAR(20) DEFAULT 'Active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (company_id, code)
);

-- Employee Allowances Table
CREATE TABLE IF NOT EXISTS employee_allowances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    allowance_type_id UUID REFERENCES allowance_types(id),
    amount NUMERIC(15, 4) DEFAULT 0.0000,
    percentage NUMERIC(5, 2) DEFAULT 0.00,
    is_recurring BOOLEAN DEFAULT TRUE,
    effective_from DATE,
    effective_to DATE,
    status VARCHAR(20) DEFAULT 'Active',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Employee Deductions Table
CREATE TABLE IF NOT EXISTS employee_deductions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    deduction_type_id UUID REFERENCES deduction_types(id),
    amount NUMERIC(15, 4) DEFAULT 0.0000,
    percentage NUMERIC(5, 2) DEFAULT 0.00,
    reason TEXT,
    is_recurring BOOLEAN DEFAULT FALSE,
    effective_from DATE,
    effective_to DATE,
    status VARCHAR(20) DEFAULT 'Active',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payrolls (Monthly Run Header) Table
CREATE TABLE IF NOT EXISTS payrolls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payroll_number VARCHAR(100) NOT NULL UNIQUE,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id),
    pay_period_month INTEGER NOT NULL CHECK (pay_period_month BETWEEN 1 AND 12),
    pay_period_year INTEGER NOT NULL,
    total_basic_salary NUMERIC(15, 4) DEFAULT 0.0000,
    total_allowances NUMERIC(15, 4) DEFAULT 0.0000,
    total_deductions NUMERIC(15, 4) DEFAULT 0.0000,
    total_overtime NUMERIC(15, 4) DEFAULT 0.0000,
    total_gosi_employee NUMERIC(15, 4) DEFAULT 0.0000,
    total_gosi_employer NUMERIC(15, 4) DEFAULT 0.0000,
    total_net_salary NUMERIC(15, 4) DEFAULT 0.0000,
    employee_count INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'Draft' CHECK (status IN ('Draft', 'Calculated', 'Approved', 'Posted', 'Void')),
    journal_entry_id UUID REFERENCES journal_entries(id),
    created_by UUID REFERENCES users(id),
    approved_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payroll Lines Table
CREATE TABLE IF NOT EXISTS payroll_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payroll_id UUID REFERENCES payrolls(id) ON DELETE CASCADE,
    employee_id UUID REFERENCES employees(id) NOT NULL,
    basic_salary NUMERIC(15, 4) DEFAULT 0.0000,
    housing_allowance NUMERIC(15, 4) DEFAULT 0.0000,
    transport_allowance NUMERIC(15, 4) DEFAULT 0.0000,
    food_allowance NUMERIC(15, 4) DEFAULT 0.0000,
    other_allowances NUMERIC(15, 4) DEFAULT 0.0000,
    total_allowances NUMERIC(15, 4) DEFAULT 0.0000,
    overtime_hours NUMERIC(5, 2) DEFAULT 0.00,
    overtime_amount NUMERIC(15, 4) DEFAULT 0.0000,
    delay_hours NUMERIC(5, 2) DEFAULT 0.00,
    delay_deduction NUMERIC(15, 4) DEFAULT 0.0000,
    absence_days NUMERIC(5, 2) DEFAULT 0.00,
    absence_deduction NUMERIC(15, 4) DEFAULT 0.0000,
    other_deductions NUMERIC(15, 4) DEFAULT 0.0000,
    total_deductions NUMERIC(15, 4) DEFAULT 0.0000,
    gosi_employee NUMERIC(15, 4) DEFAULT 0.0000,
    gosi_employer NUMERIC(15, 4) DEFAULT 0.0000,
    gross_salary NUMERIC(15, 4) DEFAULT 0.0000,
    net_salary NUMERIC(15, 4) DEFAULT 0.0000,
    work_days INTEGER DEFAULT 0,
    notes TEXT
);

-- ============================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_branches_company ON branches(company_id);
CREATE INDEX IF NOT EXISTS idx_exchange_rates_currency_date ON exchange_rates(currency_id, rate_date);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role_id);
CREATE INDEX IF NOT EXISTS idx_users_branch ON users(branch_id);
CREATE INDEX IF NOT EXISTS idx_permissions_role ON permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_gl_accounts_company ON gl_accounts(company_id);
CREATE INDEX IF NOT EXISTS idx_gl_accounts_parent ON gl_accounts(parent_id);
CREATE INDEX IF NOT EXISTS idx_cost_centers_company ON cost_centers(company_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_date ON journal_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_journal_entries_status ON journal_entries(status);
CREATE INDEX IF NOT EXISTS idx_journal_entry_lines_entry ON journal_entry_lines(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_journal_entry_lines_account ON journal_entry_lines(gl_account_id);
CREATE INDEX IF NOT EXISTS idx_items_company ON items(company_id);
CREATE INDEX IF NOT EXISTS idx_inventory_balances_item ON inventory_balances(item_id);
CREATE INDEX IF NOT EXISTS idx_customers_company ON customers(company_id);
CREATE INDEX IF NOT EXISTS idx_sales_invoices_customer ON sales_invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_invoices_date ON sales_invoices(invoice_date);
CREATE INDEX IF NOT EXISTS idx_sales_invoices_status ON sales_invoices(status);
CREATE INDEX IF NOT EXISTS idx_suppliers_company ON suppliers(company_id);
CREATE INDEX IF NOT EXISTS idx_purchase_invoices_supplier ON purchase_invoices(supplier_id);
CREATE INDEX IF NOT EXISTS idx_employees_number ON employees(employee_number);
CREATE INDEX IF NOT EXISTS idx_attendances_employee_date ON attendances(employee_id, attendance_date);
CREATE INDEX IF NOT EXISTS idx_payroll_lines_payroll ON payroll_lines(payroll_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);

-- ============================================================
-- VIEWS
-- ============================================================

-- Trial Balance View
CREATE OR REPLACE VIEW v_trial_balance AS
SELECT
    g.id AS account_id,
    g.code AS account_code,
    g.name_ar AS account_name_ar,
    g.name_en AS account_name_en,
    g.account_type,
    g.nature,
    g.company_id,
    COALESCE(SUM(l.debit_base), 0) AS total_debit,
    COALESCE(SUM(l.credit_base), 0) AS total_credit,
    CASE
        WHEN g.nature = 'Debit' THEN COALESCE(SUM(l.debit_base), 0) - COALESCE(SUM(l.credit_base), 0)
        ELSE COALESCE(SUM(l.credit_base), 0) - COALESCE(SUM(l.debit_base), 0)
    END AS balance
FROM gl_accounts g
LEFT JOIN journal_entry_lines l ON l.gl_account_id = g.id
LEFT JOIN journal_entries je ON je.id = l.journal_entry_id AND je.status = 'Posted'
GROUP BY g.id, g.code, g.name_ar, g.name_en, g.account_type, g.nature, g.company_id;

-- Customer Aging View
CREATE OR REPLACE VIEW v_customer_aging AS
SELECT
    c.id AS customer_id,
    c.code,
    c.name_ar,
    c.name_en,
    c.company_id,
    COALESCE(SUM(CASE WHEN si.due_date >= CURRENT_DATE THEN si.remaining_amount ELSE 0 END), 0) AS current_amount,
    COALESCE(SUM(CASE WHEN si.due_date < CURRENT_DATE AND si.due_date >= CURRENT_DATE - 30 THEN si.remaining_amount ELSE 0 END), 0) AS days_30,
    COALESCE(SUM(CASE WHEN si.due_date < CURRENT_DATE - 30 AND si.due_date >= CURRENT_DATE - 60 THEN si.remaining_amount ELSE 0 END), 0) AS days_60,
    COALESCE(SUM(CASE WHEN si.due_date < CURRENT_DATE - 60 AND si.due_date >= CURRENT_DATE - 90 THEN si.remaining_amount ELSE 0 END), 0) AS days_90,
    COALESCE(SUM(CASE WHEN si.due_date < CURRENT_DATE - 90 THEN si.remaining_amount ELSE 0 END), 0) AS over_90,
    COALESCE(SUM(si.remaining_amount), 0) AS total_balance
FROM customers c
LEFT JOIN sales_invoices si ON si.customer_id = c.id AND si.status IN ('Approved','Posted','PartiallyPaid')
GROUP BY c.id, c.code, c.name_ar, c.name_en, c.company_id;

-- Inventory Stock View
CREATE OR REPLACE VIEW v_inventory_stock AS
SELECT
    i.id AS item_id,
    i.code AS item_code,
    i.name_ar AS item_name_ar,
    i.name_en AS item_name_en,
    i.company_id,
    w.id AS warehouse_id,
    w.name_ar AS warehouse_name,
    COALESCE(ib.quantity_on_hand, 0) AS quantity_on_hand,
    COALESCE(ib.average_cost, i.cost_price) AS average_cost,
    COALESCE(ib.quantity_on_hand, 0) * COALESCE(ib.average_cost, i.cost_price) AS stock_value,
    i.reorder_level,
    CASE WHEN COALESCE(ib.quantity_on_hand, 0) <= i.reorder_level THEN TRUE ELSE FALSE END AS is_under_minimum
FROM items i
CROSS JOIN warehouses w
LEFT JOIN inventory_balances ib ON ib.item_id = i.id AND ib.warehouse_id = w.id;

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Function: Auto-generate sequential document numbers
CREATE OR REPLACE FUNCTION generate_document_number(prefix TEXT, company_id_param UUID)
RETURNS TEXT AS $$
DECLARE
    seq_num INTEGER;
    doc_number TEXT;
BEGIN
    -- Use a sequence based on prefix and company
    EXECUTE format('SELECT COALESCE(MAX(CAST(SUBSTRING(number_col FROM %L) AS INTEGER)), 0) + 1
                    FROM %I WHERE company_col = $1',
                   '^' || prefix || '-\d+$', prefix || '_sequences')
    INTO seq_num USING company_id_param;
    
    doc_number := prefix || '-' || LPAD(seq_num::TEXT, 6, '0');
    RETURN doc_number;
END;
$$ LANGUAGE plpgsql;

-- Function: Validate journal entry balance (Debits = Credits)
CREATE OR REPLACE FUNCTION validate_journal_entry_balance(entry_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    total_debit NUMERIC;
    total_credit NUMERIC;
BEGIN
    SELECT 
        COALESCE(SUM(debit), 0),
        COALESCE(SUM(credit), 0)
    INTO total_debit, total_credit
    FROM journal_entry_lines
    WHERE journal_entry_id = entry_id;
    
    RETURN ABS(total_debit - total_credit) < 0.01;
END;
$$ LANGUAGE plpgsql;

-- Function: Calculate Weighted Average Cost for inventory
CREATE OR REPLACE FUNCTION calculate_wac(p_item_id UUID, p_warehouse_id UUID, p_new_qty NUMERIC, p_new_cost NUMERIC)
RETURNS NUMERIC AS $$
DECLARE
    current_qty NUMERIC;
    current_wac NUMERIC;
    new_wac NUMERIC;
BEGIN
    SELECT quantity_on_hand, average_cost
    INTO current_qty, current_wac
    FROM inventory_balances
    WHERE item_id = p_item_id AND warehouse_id = p_warehouse_id;
    
    IF NOT FOUND OR current_qty <= 0 THEN
        RETURN p_new_cost;
    END IF;
    
    new_wac := ((current_qty * current_wac) + (p_new_qty * p_new_cost)) / (current_qty + p_new_qty);
    RETURN ROUND(new_wac, 4);
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- TRIGGERS
-- ============================================================

-- Trigger: Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_companies_updated_at BEFORE UPDATE ON companies FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_branches_updated_at BEFORE UPDATE ON branches FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Trigger: Prevent posting to closed financial periods
CREATE OR REPLACE FUNCTION check_period_not_closed()
RETURNS TRIGGER AS $$
DECLARE
    period_closed BOOLEAN;
BEGIN
    IF NEW.period_id IS NOT NULL THEN
        SELECT is_closed INTO period_closed FROM financial_periods WHERE id = NEW.period_id;
        IF period_closed THEN
            RAISE EXCEPTION 'لا يمكن الترحيل في فترة مالية مغلقة. Cannot post to a closed financial period.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_journal_entries_period_check
    BEFORE INSERT OR UPDATE ON journal_entries
    FOR EACH ROW EXECUTE FUNCTION check_period_not_closed();

-- Trigger: Update inventory balance on stock transaction
CREATE OR REPLACE FUNCTION update_inventory_balance()
RETURNS TRIGGER AS $$
DECLARE
    v_warehouse_id UUID;
    v_transaction_type VARCHAR;
    v_new_qty NUMERIC;
    v_new_cost NUMERIC;
    v_current_qty NUMERIC;
    v_current_cost NUMERIC;
BEGIN
    SELECT it.warehouse_id, it.transaction_type
    INTO v_warehouse_id, v_transaction_type
    FROM inventory_transactions it
    WHERE it.id = NEW.inventory_transaction_id;

    -- Get current balance
    SELECT quantity_on_hand, average_cost
    INTO v_current_qty, v_current_cost
    FROM inventory_balances
    WHERE item_id = NEW.item_id AND warehouse_id = v_warehouse_id;

    IF NOT FOUND THEN
        v_current_qty := 0;
        v_current_cost := 0;
    END IF;

    IF v_transaction_type IN ('Receipt', 'Opening') THEN
        v_new_cost := calculate_wac(NEW.item_id, v_warehouse_id, NEW.quantity, NEW.unit_cost);
        v_new_qty := v_current_qty + NEW.quantity;
    ELSIF v_transaction_type = 'Issue' THEN
        v_new_qty := v_current_qty - NEW.quantity;
        v_new_cost := v_current_cost;
    ELSIF v_transaction_type = 'Adjustment' THEN
        v_new_qty := NEW.quantity;
        v_new_cost := NEW.unit_cost;
    ELSE
        RETURN NEW;
    END IF;

    INSERT INTO inventory_balances (item_id, warehouse_id, quantity_on_hand, average_cost, total_value, last_updated)
    VALUES (NEW.item_id, v_warehouse_id, v_new_qty, v_new_cost, v_new_qty * v_new_cost, NOW())
    ON CONFLICT (item_id, warehouse_id)
    DO UPDATE SET
        quantity_on_hand = v_new_qty,
        average_cost = v_new_cost,
        total_value = v_new_qty * v_new_cost,
        last_updated = NOW();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- DOCUMENT NUMBER SEQUENCES
-- ============================================================

CREATE SEQUENCE IF NOT EXISTS seq_journal_entry START 1;
CREATE SEQUENCE IF NOT EXISTS seq_sales_invoice START 1;
CREATE SEQUENCE IF NOT EXISTS seq_sales_quotation START 1;
CREATE SEQUENCE IF NOT EXISTS seq_sales_return START 1;
CREATE SEQUENCE IF NOT EXISTS seq_purchase_order START 1;
CREATE SEQUENCE IF NOT EXISTS seq_purchase_invoice START 1;
CREATE SEQUENCE IF NOT EXISTS seq_receipt_voucher START 1;
CREATE SEQUENCE IF NOT EXISTS seq_payment_voucher START 1;
CREATE SEQUENCE IF NOT EXISTS seq_inventory_transaction START 1;
CREATE SEQUENCE IF NOT EXISTS seq_payroll START 1;
CREATE SEQUENCE IF NOT EXISTS seq_leave_request START 1;
CREATE SEQUENCE IF NOT EXISTS seq_employee_number START 1;
