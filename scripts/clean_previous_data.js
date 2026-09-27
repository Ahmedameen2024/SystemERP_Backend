const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
});

(async () => {
  try {
    console.log('--- Cleaning previous test data (preserving employees & system lookups) ---');
    
    // Clean transactions
    await pool.query('DELETE FROM sales_return_lines');
    await pool.query('DELETE FROM sales_returns');
    await pool.query('DELETE FROM sales_invoice_lines');
    await pool.query('DELETE FROM sales_invoices');
    await pool.query('DELETE FROM sales_quotation_lines');
    await pool.query('DELETE FROM sales_quotations');

    await pool.query('DELETE FROM purchase_invoice_lines');
    await pool.query('DELETE FROM purchase_invoices');
    await pool.query('DELETE FROM purchase_order_lines');
    await pool.query('DELETE FROM purchase_orders');
    await pool.query('DELETE FROM goods_receipt_note_lines');
    await pool.query('DELETE FROM goods_receipt_notes');

    await pool.query('DELETE FROM payment_voucher_lines');
    await pool.query('DELETE FROM payment_vouchers');
    await pool.query('DELETE FROM receipt_vouchers');

    await pool.query('DELETE FROM payroll_lines');
    await pool.query('DELETE FROM payrolls');
    await pool.query('DELETE FROM employee_allowances');
    await pool.query('DELETE FROM employee_deductions');
    await pool.query('DELETE FROM attendances');
    await pool.query('DELETE FROM biometric_logs');
    await pool.query('DELETE FROM leave_requests');

    await pool.query('DELETE FROM inventory_transaction_lines');
    await pool.query('DELETE FROM inventory_transactions');
    await pool.query('DELETE FROM inventory_balances');
    await pool.query('DELETE FROM items');
    await pool.query('DELETE FROM item_categories');
    await pool.query('DELETE FROM warehouses');

    await pool.query('DELETE FROM journal_entry_lines');
    await pool.query('DELETE FROM journal_entries');
    await pool.query('DELETE FROM opening_balances');

    await pool.query('DELETE FROM bank_account_transactions');
    await pool.query('DELETE FROM bank_account_currencies');
    await pool.query('DELETE FROM bank_accounts');

    await pool.query('DELETE FROM cash_box_transactions');
    await pool.query('DELETE FROM cash_box_currencies');
    await pool.query('DELETE FROM cash_boxes');

    await pool.query('DELETE FROM customer_currencies');
    await pool.query('DELETE FROM customers');

    await pool.query('DELETE FROM supplier_currencies');
    await pool.query('DELETE FROM suppliers');

    await pool.query('DELETE FROM audit_logs');

    console.log('✅ Cleanup finished successfully!');
  } catch (err) {
    console.error('Error during cleanup:', err);
  } finally {
    await pool.end();
  }
})();
