/**
 * ERP Data Entry Script
 * Simulates user interaction through the API (same calls the frontend makes)
 * Executes all accounting operations in order from the PDF files
 */

const { Pool } = require('pg');
require('dotenv').config();
const https = require('https');
const http = require('http');

const BASE_URL = 'http://localhost:5000/api';
let TOKEN = '';

// ── HTTP Helper ──────────────────────────────────────────────────
function apiCall(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: '/api' + path,
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (TOKEN) options.headers['Authorization'] = 'Bearer ' + TOKEN;

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function log(msg) { console.log('\n' + msg); }
function ok(msg) { console.log('  ✅ ' + msg); }
function warn(msg) { console.log('  ⚠️  ' + msg); }
function fail(msg) { console.log('  ❌ ' + msg); }

// ── Main Script ──────────────────────────────────────────────────
async function main() {
  log('='.repeat(60));
  log('ERP ACCOUNTING CYCLE - DATA ENTRY SCRIPT');
  log('='.repeat(60));

  // ── STEP 0: LOGIN ────────────────────────────────────────────
  log('[LOGIN] Authenticating as admin...');
  const loginRes = await apiCall('POST', '/auth/login', { username: 'admin', password: 'Admin@1234' });
  if (!loginRes.data.success && !loginRes.data.token) {
    fail('Login failed: ' + JSON.stringify(loginRes.data));
    process.exit(1);
  }
  TOKEN = loginRes.data.data?.token || loginRes.data.token;
  const companyId = loginRes.data.data?.user?.companyId;
  const branchId = loginRes.data.data?.user?.branchId;
  ok(`Logged in. Company: ${companyId}, Branch: ${branchId}`);

  // ── STEP 1: GET CURRENT STATE ────────────────────────────────
  log('[CHECK] Reading existing accounts, branches, currencies...');
  
  const accountsRes = await apiCall('GET', '/accounting/accounts');
  const accounts = accountsRes.data.data || [];
  log(`  Found ${accounts.length} GL accounts`);
  
  // Print account list for reference
  accounts.forEach(a => {
    console.log(`    [${a.code}] ${a.name_ar} (${a.account_type}) - nature: ${a.nature}`);
  });

  const branchesRes = await apiCall('GET', '/setup/branches');
  const branches = branchesRes.data.data || [];
  log(`  Found ${branches.length} branches:`);
  branches.forEach(b => console.log(`    [${b.code}] ${b.name_ar}`));

  const currenciesRes = await apiCall('GET', '/setup/currencies');
  const currencies = currenciesRes.data.data || [];
  log(`  Found ${currencies.length} currencies:`);
  currencies.forEach(c => console.log(`    [${c.code}] ${c.name_ar} - rate: ${c.exchange_rate}`));

  const cashBoxRes = await apiCall('GET', '/setup/cash-boxes');
  const cashBoxes = cashBoxRes.data.data || [];
  log(`  Found ${cashBoxes.length} cash boxes:`);
  cashBoxes.forEach(cb => console.log(`    [${cb.code}] ${cb.name_ar}`));

  const bankRes = await apiCall('GET', '/setup/bank-accounts');
  const banks = bankRes.data.data || [];
  log(`  Found ${banks.length} bank accounts:`);
  banks.forEach(b => console.log(`    [${b.account_number}] ${b.account_name_ar}`));

  const suppliersRes = await apiCall('GET', '/setup/suppliers');
  const suppliers = suppliersRes.data.data || [];
  log(`  Found ${suppliers.length} suppliers:`);
  suppliers.forEach(s => console.log(`    [${s.code}] ${s.name_ar}`));

  const customersRes = await apiCall('GET', '/sales/customers');
  const customers = customersRes.data.data || [];
  log(`  Found ${customers.length} customers:`);
  customers.forEach(c => console.log(`    [${c.code}] ${c.name_ar}`));

  // ── Save results ─────────────────────────────────────────────
  console.log('\n' + '='.repeat(60));
  console.log('CURRENT STATE CAPTURED. Script will now report findings.');
  console.log('='.repeat(60));

  // Write report
  const report = {
    accounts: accounts.map(a => ({ id: a.id, code: a.code, name_ar: a.name_ar, account_type: a.account_type, nature: a.nature })),
    branches: branches.map(b => ({ id: b.id, code: b.code, name_ar: b.name_ar })),
    currencies: currencies.map(c => ({ id: c.id, code: c.code, name_ar: c.name_ar, exchange_rate: c.exchange_rate })),
    cashBoxes: cashBoxes.map(cb => ({ id: cb.id, code: cb.code, name_ar: cb.name_ar })),
    banks: banks.map(b => ({ id: b.id, account_number: b.account_number, name_ar: b.account_name_ar })),
    suppliers: suppliers.map(s => ({ id: s.id, code: s.code, name_ar: s.name_ar })),
    customers: customers.map(c => ({ id: c.id, code: c.code, name_ar: c.name_ar }))
  };

  require('fs').writeFileSync('./scripts/current_state.json', JSON.stringify(report, null, 2));
  ok('State saved to scripts/current_state.json');
}

main().catch(err => {
  fail('Fatal error: ' + err.message);
  console.error(err);
  process.exit(1);
});
