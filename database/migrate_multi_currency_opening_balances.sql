-- Migration: Multi-Currency & Opening Balances Redesign
-- Date: 2026-08-05

-- 1. Create opening_balances table
CREATE TABLE IF NOT EXISTS opening_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    party_type VARCHAR(50) NOT NULL CHECK (party_type IN ('Customer', 'Supplier', 'Bank', 'CashBox', 'Employee', 'FixedAsset', 'Inventory', 'GLAccount')),
    party_id UUID,
    account_id UUID REFERENCES gl_accounts(id),
    currency_id UUID REFERENCES currencies(id) NOT NULL,
    nature VARCHAR(10) NOT NULL DEFAULT 'Debit' CHECK (nature IN ('Debit', 'Credit')),
    foreign_amount NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    exchange_rate NUMERIC(15, 6) NOT NULL DEFAULT 1.000000,
    base_amount NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    opening_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status VARCHAR(20) DEFAULT 'Draft' CHECK (status IN ('Draft', 'Posted', 'Void')),
    journal_entry_id UUID REFERENCES journal_entries(id),
    notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast party and account queries
CREATE INDEX IF NOT EXISTS idx_opening_balances_party ON opening_balances (company_id, party_type, party_id);
CREATE INDEX IF NOT EXISTS idx_opening_balances_account ON opening_balances (company_id, account_id);

-- 2. Make currency_id optional in suppliers
ALTER TABLE suppliers ALTER COLUMN currency_id DROP NOT NULL;
