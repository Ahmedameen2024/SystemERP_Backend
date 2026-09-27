-- ============================================================
-- Migration: إدارة الموردين والمشتريات المتكاملة
-- Version: 2.0
-- Date: 2026-09-21
-- Description: إضافة جداول مجموعات/أنواع الموردين، شروط الدفع،
--              طلبات الشراء، استلام المشتريات، مردودات المشتريات،
--              تقييمات الموردين، وتعزيز جدول الموردين
-- ============================================================

-- ============================================================
-- 1. مجموعات الموردين
-- ============================================================
CREATE TABLE IF NOT EXISTS supplier_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name_ar VARCHAR(255) NOT NULL,
    name_en VARCHAR(255),
    description TEXT,
    default_account_id UUID REFERENCES gl_accounts(id),
    default_currency_id UUID REFERENCES currencies(id),
    status VARCHAR(20) DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (company_id, code)
);

-- ============================================================
-- 2. أنواع الموردين
-- ============================================================
CREATE TABLE IF NOT EXISTS supplier_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name_ar VARCHAR(255) NOT NULL,
    name_en VARCHAR(255),
    description TEXT,
    status VARCHAR(20) DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (company_id, code)
);

-- ============================================================
-- 3. شروط الدفع
-- ============================================================
CREATE TABLE IF NOT EXISTS payment_terms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name_ar VARCHAR(255) NOT NULL,
    name_en VARCHAR(255),
    days INTEGER NOT NULL DEFAULT 0,
    payment_type VARCHAR(50) DEFAULT 'Credit' CHECK (payment_type IN ('Cash', 'OnReceipt', 'Credit', 'Advance')),
    description TEXT,
    status VARCHAR(20) DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (company_id, code)
);

-- ============================================================
-- 4. تعزيز جدول الموردين (إضافة أعمدة جديدة)
-- ============================================================

-- المجموعة والنوع
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES supplier_groups(id);
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS type_id UUID REFERENCES supplier_types(id);
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS payment_term_id UUID REFERENCES payment_terms(id);

-- بيانات تجارية إضافية
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS trade_name VARCHAR(255);
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS additional_phone VARCHAR(50);
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS website VARCHAR(200);
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS country VARCHAR(100) DEFAULT 'Saudi Arabia';
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS region VARCHAR(100);

-- بيانات البنك
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS bank_name VARCHAR(100);
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS bank_account_number VARCHAR(100);
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS iban VARCHAR(50);
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS bank_branch VARCHAR(100);
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS swift_code VARCHAR(20);

-- الشخص المسؤول
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS responsible_person VARCHAR(100);

-- حساب مشتريات مخصص
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS purchase_account_id UUID REFERENCES gl_accounts(id);

-- ============================================================
-- 5. طلبات الشراء (Purchase Requests)
-- ============================================================
CREATE TABLE IF NOT EXISTS purchase_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_number VARCHAR(100) NOT NULL UNIQUE,
    request_date DATE NOT NULL,
    department_id UUID REFERENCES departments(id),
    requested_by UUID REFERENCES users(id),
    supplier_id UUID REFERENCES suppliers(id),
    branch_id UUID REFERENCES branches(id),
    priority VARCHAR(20) DEFAULT 'Normal' CHECK (priority IN ('Low', 'Normal', 'High', 'Urgent')),
    expected_date DATE,
    notes TEXT,
    status VARCHAR(30) DEFAULT 'Draft' CHECK (status IN ('Draft', 'Pending', 'Approved', 'Rejected', 'Converted', 'Closed')),
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    rejection_reason TEXT,
    converted_to_po_id UUID,  -- يُملأ لاحقاً بعد إنشاء PO
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS purchase_request_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_request_id UUID REFERENCES purchase_requests(id) ON DELETE CASCADE,
    item_id UUID REFERENCES items(id) NOT NULL,
    uom_id UUID REFERENCES uoms(id) NOT NULL,
    quantity NUMERIC(15, 4) NOT NULL,
    estimated_price NUMERIC(15, 4) DEFAULT 0.0000,
    notes TEXT,
    sort_order INTEGER DEFAULT 0
);

-- ============================================================
-- 6. استلام المشتريات (Purchase Receipts)
-- ============================================================
CREATE TABLE IF NOT EXISTS purchase_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_number VARCHAR(100) NOT NULL UNIQUE,
    receipt_date DATE NOT NULL,
    purchase_order_id UUID REFERENCES purchase_orders(id) NOT NULL,
    supplier_id UUID REFERENCES suppliers(id) NOT NULL,
    branch_id UUID REFERENCES branches(id) NOT NULL,
    warehouse_id UUID REFERENCES warehouses(id) NOT NULL,
    currency_id UUID REFERENCES currencies(id) NOT NULL,
    exchange_rate NUMERIC(15, 6) DEFAULT 1.000000,
    notes TEXT,
    status VARCHAR(20) DEFAULT 'Draft' CHECK (status IN ('Draft', 'Posted', 'Void')),
    inventory_transaction_id UUID REFERENCES inventory_transactions(id),
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS purchase_receipt_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_receipt_id UUID REFERENCES purchase_receipts(id) ON DELETE CASCADE,
    po_line_id UUID REFERENCES purchase_order_lines(id),
    item_id UUID REFERENCES items(id) NOT NULL,
    uom_id UUID REFERENCES uoms(id) NOT NULL,
    ordered_quantity NUMERIC(15, 4) DEFAULT 0.0000,
    received_quantity NUMERIC(15, 4) NOT NULL,
    unit_cost NUMERIC(15, 4) DEFAULT 0.0000,
    total_cost NUMERIC(15, 4) DEFAULT 0.0000,
    notes TEXT,
    sort_order INTEGER DEFAULT 0
);

-- ============================================================
-- 7. مردودات المشتريات (Purchase Returns)
-- ============================================================
CREATE TABLE IF NOT EXISTS purchase_returns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    return_number VARCHAR(100) NOT NULL UNIQUE,
    return_date DATE NOT NULL,
    original_invoice_id UUID REFERENCES purchase_invoices(id) NOT NULL,
    supplier_id UUID REFERENCES suppliers(id) NOT NULL,
    branch_id UUID REFERENCES branches(id) NOT NULL,
    warehouse_id UUID REFERENCES warehouses(id) NOT NULL,
    currency_id UUID REFERENCES currencies(id) NOT NULL,
    exchange_rate NUMERIC(15, 6) DEFAULT 1.000000,
    total_amount NUMERIC(15, 4) DEFAULT 0.0000,
    tax_amount NUMERIC(15, 4) DEFAULT 0.0000,
    net_amount NUMERIC(15, 4) DEFAULT 0.0000,
    reason TEXT,
    notes TEXT,
    status VARCHAR(20) DEFAULT 'Draft' CHECK (status IN ('Draft', 'Approved', 'Posted', 'Void')),
    journal_entry_id UUID REFERENCES journal_entries(id),
    approved_by UUID REFERENCES users(id),
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS purchase_return_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_return_id UUID REFERENCES purchase_returns(id) ON DELETE CASCADE,
    original_invoice_line_id UUID REFERENCES purchase_invoice_lines(id),
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
-- 8. تقييمات الموردين (Supplier Evaluations)
-- ============================================================
CREATE TABLE IF NOT EXISTS supplier_evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id UUID REFERENCES suppliers(id) ON DELETE CASCADE,
    evaluation_date DATE NOT NULL,
    quality_score NUMERIC(3, 1) CHECK (quality_score BETWEEN 1 AND 5),
    delivery_speed_score NUMERIC(3, 1) CHECK (delivery_speed_score BETWEEN 1 AND 5),
    punctuality_score NUMERIC(3, 1) CHECK (punctuality_score BETWEEN 1 AND 5),
    price_compliance_score NUMERIC(3, 1) CHECK (price_compliance_score BETWEEN 1 AND 5),
    service_quality_score NUMERIC(3, 1) CHECK (service_quality_score BETWEEN 1 AND 5),
    responsiveness_score NUMERIC(3, 1) CHECK (responsiveness_score BETWEEN 1 AND 5),
    overall_score NUMERIC(3, 2) DEFAULT 0.00,
    notes TEXT,
    evaluated_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 9. إعدادات الموردين (Supplier Settings)
-- ============================================================
-- نستخدم جدول system_settings الموجود مع مفاتيح مخصصة
-- لا نحتاج جدول منفصل

-- ============================================================
-- 10. Sequences للمستندات الجديدة
-- ============================================================
CREATE SEQUENCE IF NOT EXISTS seq_purchase_request START 1;
CREATE SEQUENCE IF NOT EXISTS seq_purchase_receipt START 1;
CREATE SEQUENCE IF NOT EXISTS seq_purchase_return START 1;

-- ============================================================
-- 11. Indexes للأداء
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_supplier_groups_company ON supplier_groups(company_id);
CREATE INDEX IF NOT EXISTS idx_supplier_types_company ON supplier_types(company_id);
CREATE INDEX IF NOT EXISTS idx_payment_terms_company ON payment_terms(company_id);
CREATE INDEX IF NOT EXISTS idx_purchase_requests_supplier ON purchase_requests(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_requests_status ON purchase_requests(status);
CREATE INDEX IF NOT EXISTS idx_purchase_receipts_po ON purchase_receipts(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_purchase_receipts_supplier ON purchase_receipts(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_returns_invoice ON purchase_returns(original_invoice_id);
CREATE INDEX IF NOT EXISTS idx_purchase_returns_supplier ON purchase_returns(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_evaluations_supplier ON supplier_evaluations(supplier_id);

-- ============================================================
-- 12. إضافة FK لـ purchase_requests -> purchase_orders
-- ============================================================
ALTER TABLE purchase_requests
    ADD CONSTRAINT fk_pr_converted_po
    FOREIGN KEY (converted_to_po_id) REFERENCES purchase_orders(id)
    NOT VALID; -- NOT VALID لأن البيانات الموجودة قد لا تتطابق

-- ============================================================
-- 13. تحديث purchase_orders لإضافة payment_term_id
-- ============================================================
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS payment_term_id UUID REFERENCES payment_terms(id);
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS purchase_request_id UUID REFERENCES purchase_requests(id);

-- ============================================================
-- 14. تحديث purchase_invoices لإضافة receipt_id والاستحقاق
-- ============================================================
ALTER TABLE purchase_invoices ADD COLUMN IF NOT EXISTS receipt_id UUID REFERENCES purchase_receipts(id);

-- ============================================================
-- 15. بيانات افتراضية لشروط الدفع
-- (سيتم إدراجها في seed أو عبر API)
-- ============================================================

-- Trigger لتحديث updated_at في supplier_groups
CREATE TRIGGER tr_supplier_groups_updated_at
    BEFORE UPDATE ON supplier_groups
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_purchase_requests_updated_at
    BEFORE UPDATE ON purchase_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 16. View: ملخص المورد (Supplier Summary View)
-- ============================================================
CREATE OR REPLACE VIEW v_supplier_summary AS
SELECT
    s.id AS supplier_id,
    s.code,
    s.name_ar,
    s.name_en,
    s.company_id,
    s.status,
    sg.name_ar AS group_name,
    st.name_ar AS type_name,
    -- إجمالي المشتريات
    COALESCE(SUM(pi.net_amount * pi.exchange_rate), 0) AS total_purchases_base,
    -- إجمالي المدفوعات
    COALESCE((
        SELECT SUM(pv.amount * pv.exchange_rate)
        FROM payment_vouchers pv
        WHERE pv.supplier_id = s.id AND pv.status = 'Posted'
    ), 0) AS total_payments_base,
    -- الرصيد المستحق
    s.balance AS current_balance,
    -- آخر فاتورة
    (SELECT MAX(pi2.invoice_date) FROM purchase_invoices pi2 WHERE pi2.supplier_id = s.id AND pi2.status = 'Posted') AS last_invoice_date,
    -- آخر دفعة
    (SELECT MAX(pv2.voucher_date) FROM payment_vouchers pv2 WHERE pv2.supplier_id = s.id AND pv2.status = 'Posted') AS last_payment_date
FROM suppliers s
LEFT JOIN supplier_groups sg ON sg.id = s.group_id
LEFT JOIN supplier_types st ON st.id = s.type_id
LEFT JOIN purchase_invoices pi ON pi.supplier_id = s.id AND pi.status = 'Posted'
GROUP BY s.id, s.code, s.name_ar, s.name_en, s.company_id, s.status, s.balance, sg.name_ar, st.name_ar;

-- ============================================================
-- 17. View: أعمار ديون الموردين (Supplier Aging)
-- ============================================================
CREATE OR REPLACE VIEW v_supplier_aging AS
SELECT
    s.id AS supplier_id,
    s.code,
    s.name_ar,
    s.name_en,
    s.company_id,
    COALESCE(SUM(CASE WHEN pi.due_date >= CURRENT_DATE THEN pi.remaining_amount * pi.exchange_rate ELSE 0 END), 0) AS current_amount,
    COALESCE(SUM(CASE WHEN pi.due_date < CURRENT_DATE AND pi.due_date >= CURRENT_DATE - 30 THEN pi.remaining_amount * pi.exchange_rate ELSE 0 END), 0) AS days_30,
    COALESCE(SUM(CASE WHEN pi.due_date < CURRENT_DATE - 30 AND pi.due_date >= CURRENT_DATE - 60 THEN pi.remaining_amount * pi.exchange_rate ELSE 0 END), 0) AS days_60,
    COALESCE(SUM(CASE WHEN pi.due_date < CURRENT_DATE - 60 AND pi.due_date >= CURRENT_DATE - 90 THEN pi.remaining_amount * pi.exchange_rate ELSE 0 END), 0) AS days_90,
    COALESCE(SUM(CASE WHEN pi.due_date < CURRENT_DATE - 90 THEN pi.remaining_amount * pi.exchange_rate ELSE 0 END), 0) AS over_90,
    COALESCE(SUM(pi.remaining_amount * pi.exchange_rate), 0) AS total_balance
FROM suppliers s
LEFT JOIN purchase_invoices pi ON pi.supplier_id = s.id AND pi.status IN ('Approved', 'Posted', 'PartiallyPaid')
GROUP BY s.id, s.code, s.name_ar, s.name_en, s.company_id;
