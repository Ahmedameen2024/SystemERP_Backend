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
    console.log('--- CUSTOMERS ---');
    const custs = await pool.query('SELECT id, name_ar, name_en, code FROM customers');
    console.log(custs.rows);

    console.log('--- SUPPLIERS ---');
    const supps = await pool.query('SELECT id, name_ar, name_en, code FROM suppliers');
    console.log(supps.rows);

    console.log('--- BRANCHES ---');
    const branches = await pool.query('SELECT id, name_ar, name_en, code FROM branches');
    console.log(branches.rows);

    console.log('--- CASH BOXES ---');
    const cash = await pool.query('SELECT id, name_ar, name_en, code FROM cash_boxes');
    console.log(cash.rows);

    console.log('--- BANK ACCOUNTS ---');
    const banks = await pool.query('SELECT id, bank_name_ar, account_name_ar, account_number FROM bank_accounts');
    console.log(banks.rows);

    console.log('--- EMPLOYEES ---');
    const emps = await pool.query('SELECT id, first_name_ar, last_name_ar, employee_code, job_title_ar FROM employees');
    console.log(emps.rows);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
})();
