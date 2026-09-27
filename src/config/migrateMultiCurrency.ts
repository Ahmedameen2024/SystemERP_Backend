import { query } from './db';

export const runMultiCurrencyMigration = async (): Promise<void> => {
  try {
    console.log('🔄 Checking / running Multi-Currency schema migrations...');

    // 1. Create junction & balance tables
    await query(`
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
    `);

    // 2. Data migration from existing single currency fields to junction tables
    await query(`
      -- Customers
      INSERT INTO customer_currencies (customer_id, currency_id, balance, opening_balance, credit_limit, is_default)
      SELECT id, currency_id, COALESCE(balance, 0), COALESCE(opening_balance, 0), credit_limit, TRUE
      FROM customers
      WHERE currency_id IS NOT NULL
      ON CONFLICT (customer_id, currency_id) DO NOTHING;

      -- Suppliers
      INSERT INTO supplier_currencies (supplier_id, currency_id, balance, opening_balance, credit_limit, is_default)
      SELECT id, currency_id, COALESCE(balance, 0), COALESCE(opening_balance, 0), credit_limit, TRUE
      FROM suppliers
      WHERE currency_id IS NOT NULL
      ON CONFLICT (supplier_id, currency_id) DO NOTHING;

      -- GL Accounts
      INSERT INTO account_currencies (gl_account_id, currency_id)
      SELECT id, currency_id
      FROM gl_accounts
      WHERE currency_id IS NOT NULL
      ON CONFLICT (gl_account_id, currency_id) DO NOTHING;

      -- Cash Boxes
      INSERT INTO cash_box_currencies (cash_box_id, currency_id, opening_balance, current_balance, maximum_balance, is_default)
      SELECT id, currency_id, COALESCE(opening_balance, 0), COALESCE(current_balance, 0), COALESCE(maximum_balance, 0), TRUE
      FROM cash_boxes
      WHERE currency_id IS NOT NULL
      ON CONFLICT (cash_box_id, currency_id) DO NOTHING;

      -- Bank Accounts
      INSERT INTO bank_account_currencies (bank_account_id, currency_id, opening_balance, current_balance, is_default)
      SELECT id, currency_id, COALESCE(opening_balance, 0), COALESCE(current_balance, 0), TRUE
      FROM bank_accounts
      WHERE currency_id IS NOT NULL
      ON CONFLICT (bank_account_id, currency_id) DO NOTHING;
    `);

    console.log('✅ Multi-Currency schema migrations completed successfully');
  } catch (error) {
    console.error('❌ Failed to run Multi-Currency schema migrations:', error);
  }
};
