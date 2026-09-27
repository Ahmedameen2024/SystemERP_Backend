-- ============================================================
-- ERP System - Seed Data
-- Default data for system initialization
-- ============================================================

-- Default Currency (Saudi Riyal)
INSERT INTO currencies (id, code, name_ar, name_en, symbol, decimal_places, is_default, status)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'SAR', 'ريال سعودي', 'Saudi Riyal', 'ر.س', 2, TRUE, 'Active'
) ON CONFLICT (code) DO NOTHING;

-- US Dollar
INSERT INTO currencies (code, name_ar, name_en, symbol, decimal_places, is_default, status)
VALUES ('USD', 'دولار أمريكي', 'US Dollar', '$', 2, FALSE, 'Active') ON CONFLICT (code) DO NOTHING;

-- Euro
INSERT INTO currencies (code, name_ar, name_en, symbol, decimal_places, is_default, status)
VALUES ('EUR', 'يورو', 'Euro', '€', 2, FALSE, 'Active') ON CONFLICT (code) DO NOTHING;

-- Default Company
INSERT INTO companies (id, name_ar, name_en, tax_number, base_currency_id, fiscal_year_start, fiscal_year_end)
VALUES (
    '00000000-0000-0000-0000-000000000010',
    'مؤسسة الأعمال الحديثة',
    'Modern Business Establishment',
    '300000000000003',
    '00000000-0000-0000-0000-000000000001',
    '2025-01-01',
    '2025-12-31'
) ON CONFLICT DO NOTHING;

-- Default Branch
INSERT INTO branches (id, company_id, code, name_ar, name_en, status)
VALUES (
    '00000000-0000-0000-0000-000000000020',
    '00000000-0000-0000-0000-000000000010',
    'HQ', 'المقر الرئيسي', 'Headquarters', 'Active'
) ON CONFLICT (code) DO NOTHING;

-- Default Admin Role
INSERT INTO roles (id, company_id, name_ar, name_en, description, is_system_role)
VALUES (
    '00000000-0000-0000-0000-000000000030',
    '00000000-0000-0000-0000-000000000010',
    'مدير النظام', 'System Administrator',
    'Full system access', TRUE
) ON CONFLICT DO NOTHING;

-- Admin User (password: Admin@1234)
-- Password hash is bcrypt of 'Admin@1234'
INSERT INTO users (id, username, password_hash, name_ar, name_en, email, role_id, company_id, branch_id, language, status)
VALUES (
    '00000000-0000-0000-0000-000000000040',
    'admin',
    '$2a$12$2KJpgt9dGBKwrlEwXiKZ2eZGoVOCYdp21Q1yBpuUukhpGRU2/jsF2',
    'مدير النظام', 'System Admin',
    'admin@erp.local',
    '00000000-0000-0000-0000-000000000030',
    '00000000-0000-0000-0000-000000000010',
    '00000000-0000-0000-0000-000000000020',
    'ar', 'Active'
) ON CONFLICT (username) DO NOTHING;

-- Full Admin Permissions for all modules
INSERT INTO permissions (role_id, module_name, screen_name, can_view, can_create, can_edit, can_delete, can_approve, can_print, can_export)
SELECT
    '00000000-0000-0000-0000-000000000030',
    m.module_name,
    m.screen_name,
    TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE
FROM (VALUES
    ('system', 'company_profile'),
    ('system', 'branches'),
    ('system', 'currencies'),
    ('system', 'exchange_rates'),
    ('system', 'users'),
    ('system', 'roles'),
    ('system', 'permissions'),
    ('system', 'cash_boxes'),
    ('system', 'bank_accounts'),
    ('accounting', 'chart_of_accounts'),
    ('accounting', 'cost_centers'),
    ('accounting', 'journal_entries'),
    ('accounting', 'trial_balance'),
    ('accounting', 'account_details'),
    ('accounting', 'financial_statements'),
    ('inventory', 'warehouses'),
    ('inventory', 'items'),
    ('inventory', 'uoms'),
    ('inventory', 'stock_transactions'),
    ('sales', 'customers'),
    ('sales', 'sales_quotations'),
    ('sales', 'sales_invoices'),
    ('sales', 'sales_returns'),
    ('sales', 'sales_dashboard'),
    ('purchasing', 'suppliers'),
    ('purchasing', 'purchase_orders'),
    ('purchasing', 'purchase_invoices'),
    ('purchasing', 'purchasing_dashboard'),
    ('vouchers', 'receipt_vouchers'),
    ('vouchers', 'payment_vouchers'),
    ('hr', 'employees'),
    ('hr', 'attendance'),
    ('hr', 'leave_management'),
    ('hr', 'hr_dashboard'),
    ('payroll', 'payroll_sheet'),
    ('payroll', 'allowances_deductions'),
    ('reports', 'reports_dashboard')
) AS m(module_name, screen_name)
ON CONFLICT (role_id, module_name, screen_name) DO NOTHING;

-- Default Units of Measure
INSERT INTO uoms (code, name_ar, name_en, abbreviation, type, conversion_factor) VALUES
('PCS',   'قطعة',    'Piece',    'PCS', 'Quantity', 1.000000),
('BOX',   'صندوق',   'Box',      'BOX', 'Quantity', 1.000000),
('CTN',   'كرتون',   'Carton',   'CTN', 'Quantity', 1.000000),
('PKT',   'باكيت',   'Packet',   'PKT', 'Quantity', 1.000000),
('KG',    'كيلوغرام','Kilogram',  'KG',  'Weight',   1.000000),
('G',     'غرام',    'Gram',     'G',   'Weight',   0.001000),
('TON',   'طن',      'Ton',      'TON', 'Weight',   1000.000000),
('LTR',   'لتر',     'Liter',    'LTR', 'Volume',   1.000000),
('MTR',   'متر',     'Meter',    'MTR', 'Length',   1.000000),
('ROLL',  'رول',     'Roll',     'ROLL','Quantity',  1.000000)
ON CONFLICT (code) DO NOTHING;

-- Default System Settings
INSERT INTO system_settings (company_id, key, value, description)
VALUES
('00000000-0000-0000-0000-000000000010', 'default_language', 'ar', 'Default UI language'),
('00000000-0000-0000-0000-000000000010', 'date_format', 'DD/MM/YYYY', 'Date display format'),
('00000000-0000-0000-0000-000000000010', 'decimal_places', '2', 'Number of decimal places'),
('00000000-0000-0000-0000-000000000010', 'prevent_negative_stock', 'true', 'Block sales if stock is insufficient'),
('00000000-0000-0000-0000-000000000010', 'auto_numbering', 'true', 'Auto-generate document numbers'),
('00000000-0000-0000-0000-000000000010', 'vat_rate', '15', 'Default VAT rate percentage'),
('00000000-0000-0000-0000-000000000010', 'gosi_employee_rate', '9.75', 'GOSI employee contribution %'),
('00000000-0000-0000-0000-000000000010', 'gosi_employer_rate', '11.75', 'GOSI employer contribution %'),
('00000000-0000-0000-0000-000000000010', 'overtime_multiplier', '1.5', 'Overtime hourly rate multiplier'),
('00000000-0000-0000-0000-000000000010', 'late_grace_minutes', '15', 'Grace period in minutes before lateness is recorded')
ON CONFLICT (company_id, key) DO NOTHING;

-- Default Leave Types
INSERT INTO leave_types (company_id, name_ar, name_en, max_days_per_year, is_paid, status)
VALUES
('00000000-0000-0000-0000-000000000010', 'إجازة سنوية', 'Annual Leave', 21, TRUE, 'Active'),
('00000000-0000-0000-0000-000000000010', 'إجازة مرضية', 'Sick Leave', 30, TRUE, 'Active'),
('00000000-0000-0000-0000-000000000010', 'إجازة بدون راتب', 'Unpaid Leave', NULL, FALSE, 'Active'),
('00000000-0000-0000-0000-000000000010', 'إجازة أمومة', 'Maternity Leave', 90, TRUE, 'Active'),
('00000000-0000-0000-0000-000000000010', 'مأمورية', 'Mission', NULL, TRUE, 'Active')
ON CONFLICT DO NOTHING;

-- Default Payment Methods
INSERT INTO payment_methods (company_id, name_ar, name_en, type, status)
VALUES
('00000000-0000-0000-0000-000000000010', 'نقداً',           'Cash',           'Cash',         'Active'),
('00000000-0000-0000-0000-000000000010', 'آجل',             'Credit',         'Credit',       'Active'),
('00000000-0000-0000-0000-000000000010', 'تحويل بنكي',      'Bank Transfer',  'BankTransfer', 'Active'),
('00000000-0000-0000-0000-000000000010', 'بطاقة ائتمان',    'Credit Card',    'Card',         'Active'),
('00000000-0000-0000-0000-000000000010', 'شيك',             'Cheque',         'Cheque',       'Active'),
('00000000-0000-0000-0000-000000000010', 'محفظة إلكترونية', 'E-Wallet',       'EWallet',      'Active')
ON CONFLICT DO NOTHING;

-- Default Tax Rate (VAT 15%)
INSERT INTO taxes (company_id, code, name_ar, name_en, rate, type, status)
VALUES
('00000000-0000-0000-0000-000000000010', 'VAT15', 'ضريبة القيمة المضافة 15%', 'VAT 15%', 15.00, 'VAT', 'Active'),
('00000000-0000-0000-0000-000000000010', 'EXEMPT', 'معفى من الضريبة', 'Tax Exempt', 0.00, 'Exempt', 'Active'),
('00000000-0000-0000-0000-000000000010', 'ZERO', 'صفر بالمائة', 'Zero Rated', 0.00, 'ZeroRated', 'Active')
ON CONFLICT (company_id, code) DO NOTHING;

-- Default Chart of Accounts (Level 1 & Level 2)
-- Level 1 Accounts (Parent Accounts - Not Postable)
INSERT INTO gl_accounts (id, company_id, code, name_ar, name_en, parent_id, account_level, account_type, nature, allow_posting, status)
VALUES
('00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0000-000000000010', '1', 'الأصول',      'Assets',      NULL, 1, 'Asset',     'Debit',  FALSE, 'Active'),
('00000000-0000-0000-0001-000000000002', '00000000-0000-0000-0000-000000000010', '2', 'الالتزامات',  'Liabilities', NULL, 1, 'Liability', 'Credit', FALSE, 'Active'),
('00000000-0000-0000-0001-000000000003', '00000000-0000-0000-0000-000000000010', '3', 'حقوق الملكية','Equity',      NULL, 1, 'Equity',    'Credit', FALSE, 'Active'),
('00000000-0000-0000-0001-000000000004', '00000000-0000-0000-0000-000000000010', '4', 'الإيرادات',   'Revenue',     NULL, 1, 'Revenue',   'Credit', FALSE, 'Active'),
('00000000-0000-0000-0001-000000000005', '00000000-0000-0000-0000-000000000010', '5', 'المصروفات',  'Expenses',    NULL, 1, 'Expense',   'Debit',  FALSE, 'Active')
ON CONFLICT (company_id, code) DO NOTHING;

-- Level 2 Accounts (Sub-accounts - Not Postable)
INSERT INTO gl_accounts (id, company_id, code, name_ar, name_en, parent_id, account_level, account_type, nature, allow_posting, status)
VALUES
-- Level 2 under Assets (Parent Code: 1)
('00000000-0000-0000-0002-000000000011', '00000000-0000-0000-0000-000000000010', '11', 'الأصول المتداولة',    'Current Assets',    (SELECT id FROM gl_accounts WHERE company_id = '00000000-0000-0000-0000-000000000010' AND code = '1'), 2, 'Asset',     'Debit',  FALSE, 'Active'),
('00000000-0000-0000-0002-000000000012', '00000000-0000-0000-0000-000000000010', '12', 'الأصول غير المتداولة','Non-Current Assets',(SELECT id FROM gl_accounts WHERE company_id = '00000000-0000-0000-0000-000000000010' AND code = '1'), 2, 'Asset',     'Debit',  FALSE, 'Active'),

-- Level 2 under Liabilities (Parent Code: 2)
('00000000-0000-0000-0002-000000000021', '00000000-0000-0000-0000-000000000010', '21', 'الالتزامات المتداولة',   'Current Liabilities',   (SELECT id FROM gl_accounts WHERE company_id = '00000000-0000-0000-0000-000000000010' AND code = '2'), 2, 'Liability', 'Credit', FALSE, 'Active'),
('00000000-0000-0000-0002-000000000022', '00000000-0000-0000-0000-000000000010', '22', 'الالتزامات غير المتداولة','Non-Current Liabilities',(SELECT id FROM gl_accounts WHERE company_id = '00000000-0000-0000-0000-000000000010' AND code = '2'), 2, 'Liability', 'Credit', FALSE, 'Active'),

-- Level 2 under Equity (Parent Code: 3)
('00000000-0000-0000-0002-000000000031', '00000000-0000-0000-0000-000000000010', '31', 'رأس المال',       'Capital',          (SELECT id FROM gl_accounts WHERE company_id = '00000000-0000-0000-0000-000000000010' AND code = '3'), 2, 'Equity',    'Credit', FALSE, 'Active'),
('00000000-0000-0000-0002-000000000032', '00000000-0000-0000-0000-000000000010', '32', 'الأرباح المحتجزة','Retained Earnings', (SELECT id FROM gl_accounts WHERE company_id = '00000000-0000-0000-0000-000000000010' AND code = '3'), 2, 'Equity',    'Credit', FALSE, 'Active'),

-- Level 2 under Revenue (Parent Code: 4)
('00000000-0000-0000-0002-000000000041', '00000000-0000-0000-0000-000000000010', '41', 'إيرادات التشغيل','Operating Revenue',(SELECT id FROM gl_accounts WHERE company_id = '00000000-0000-0000-0000-000000000010' AND code = '4'), 2, 'Revenue',   'Credit', FALSE, 'Active'),
('00000000-0000-0000-0002-000000000042', '00000000-0000-0000-0000-000000000010', '42', 'الإيرادات الأخرى','Other Revenue',   (SELECT id FROM gl_accounts WHERE company_id = '00000000-0000-0000-0000-000000000010' AND code = '4'), 2, 'Revenue',   'Credit', FALSE, 'Active'),

-- Level 2 under Expenses (Parent Code: 5)
('00000000-0000-0000-0002-000000000051', '00000000-0000-0000-0000-000000000010', '51', 'مصروفات التشغيل',         'Operating Expenses',          (SELECT id FROM gl_accounts WHERE company_id = '00000000-0000-0000-0000-000000000010' AND code = '5'), 2, 'Expense',   'Debit',  FALSE, 'Active'),
('00000000-0000-0000-0002-000000000052', '00000000-0000-0000-0000-000000000010', '52', 'المصروفات الإدارية',       'Administrative Expenses',     (SELECT id FROM gl_accounts WHERE company_id = '00000000-0000-0000-0000-000000000010' AND code = '5'), 2, 'Expense',   'Debit',  FALSE, 'Active'),
('00000000-0000-0000-0002-000000000053', '00000000-0000-0000-0000-000000000010', '53', 'المصروفات البيعية والتسويقية','Selling & Marketing Expenses',(SELECT id FROM gl_accounts WHERE company_id = '00000000-0000-0000-0000-000000000010' AND code = '5'), 2, 'Expense',   'Debit',  FALSE, 'Active'),
('00000000-0000-0000-0002-000000000054', '00000000-0000-0000-0000-000000000010', '54', 'المصروفات المالية',       'Financial Expenses',          (SELECT id FROM gl_accounts WHERE company_id = '00000000-0000-0000-0000-000000000010' AND code = '5'), 2, 'Expense',   'Debit',  FALSE, 'Active'),
('00000000-0000-0000-0002-000000000055', '00000000-0000-0000-0000-000000000010', '55', 'المصروفات الأخرى',        'Other Expenses',              (SELECT id FROM gl_accounts WHERE company_id = '00000000-0000-0000-0000-000000000010' AND code = '5'), 2, 'Expense',   'Debit',  FALSE, 'Active')
ON CONFLICT (company_id, code) DO NOTHING;

