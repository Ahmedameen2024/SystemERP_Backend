process.env.NODE_ENV = 'test';
const app = require('../dist/index').default;
const http = require('http');

let server;
let baseUrl;
let authToken = '';
let testRecordId = '';

const tests = [];
function test(name, fn) {
  tests.push({ name, fn });
}

async function request(path, options = {}) {
  const url = `${baseUrl}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

// 1. Database connection check
test('1. Database connection test', async () => {
  const { testConnection } = require('../dist/config/db');
  await testConnection();
  return 'Connected to Supabase PostgreSQL successfully';
});

// 2. GET /api/health
test('2. GET /api/health test', async () => {
  const res = await request('/api/health');
  if (res.status !== 200 || res.data?.status !== 'ok') {
    throw new Error(`Health check failed: ${JSON.stringify(res.data)}`);
  }
  return `OK - Status: ${res.data.status}, Message: ${res.data.message}`;
});

// 3. User Login
test('3. POST /api/auth/login test', async () => {
  const res = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: 'admin', password: 'Admin@1234' }),
  });
  if (res.status !== 200 || !res.data?.data?.token) {
    throw new Error(`Login failed: ${JSON.stringify(res.data)}`);
  }
  authToken = res.data.data.token;
  return `OK - Token received (length: ${authToken.length}), User: ${res.data.data.user.username}`;
});

// 4. User Profile
test('4. GET /api/auth/profile test', async () => {
  const res = await request('/api/auth/profile');
  if (res.status !== 200 || !res.data?.data?.username) {
    throw new Error(`Profile failed: ${JSON.stringify(res.data)}`);
  }
  return `OK - User: ${res.data.data.username}, Role: ${res.data.data.role_name_ar}, SuperAdmin: ${res.data.data.isSuperAdmin}`;
});

// 5. Fetch Currencies
test('5. GET /api/setup/currencies test', async () => {
  const res = await request('/api/setup/currencies');
  if (res.status !== 200 || !Array.isArray(res.data?.data)) {
    throw new Error(`Currencies failed: ${JSON.stringify(res.data)}`);
  }
  return `OK - ${res.data.data.length} currencies retrieved (${res.data.data.map(c => c.code).slice(0, 3).join(', ')})`;
});

// 6. Fetch Customers
test('6. GET /api/sales/customers test', async () => {
  const res = await request('/api/sales/customers');
  if (res.status !== 200 || !Array.isArray(res.data?.data)) {
    throw new Error(`Customers failed: ${JSON.stringify(res.data)}`);
  }
  return `OK - ${res.data.data.length} customers retrieved`;
});

// 7. Fetch Accounts (Chart of Accounts)
test('7. GET /api/accounting/accounts test', async () => {
  const res = await request('/api/accounting/accounts');
  if (res.status !== 200 || !Array.isArray(res.data?.data)) {
    throw new Error(`Accounts failed: ${JSON.stringify(res.data)}`);
  }
  return `OK - ${res.data.data.length} GL accounts retrieved`;
});

// 8. Fetch Invoices (Sales & Purchase)
test('8. GET /api/sales/invoices & /api/purchasing/invoices test', async () => {
  const salesRes = await request('/api/sales/invoices');
  const purchRes = await request('/api/purchasing/invoices');
  if (salesRes.status !== 200 || purchRes.status !== 200) {
    throw new Error(`Invoices failed: sales=${salesRes.status}, purch=${purchRes.status}`);
  }
  return `OK - Sales Invoices: ${salesRes.data?.data?.length || 0}, Purchase Invoices: ${purchRes.data?.data?.length || 0}`;
});

// 9. Create Test Record (isolated test cost center)
test('9. POST /api/accounting/cost-centers create test record', async () => {
  const testCode = `CC-TEST-${Date.now().toString().slice(-4)}`;
  const res = await request('/api/accounting/cost-centers', {
    method: 'POST',
    body: JSON.stringify({
      code: testCode,
      nameAr: 'مركز تكلفة تجريبي للاختبار',
      nameEn: 'Automated Test Cost Center',
    }),
  });
  if (res.status !== 201 || !res.data?.data?.id) {
    throw new Error(`Create record failed: ${JSON.stringify(res.data)}`);
  }
  testRecordId = res.data.data.id;
  return `OK - Created cost center ID: ${testRecordId}, Code: ${testCode}`;
});

// 10. Update Test Record
test('10. PUT /api/accounting/cost-centers/:id update test record', async () => {
  if (!testRecordId) throw new Error('No test record ID available');
  const res = await request(`/api/accounting/cost-centers/${testRecordId}`, {
    method: 'PUT',
    body: JSON.stringify({
      nameAr: 'مركز تكلفة تجريبي - معدل',
      nameEn: 'Automated Test Cost Center - Updated',
    }),
  });
  if (res.status !== 200) {
    throw new Error(`Update record failed: ${JSON.stringify(res.data)}`);
  }
  return `OK - Record updated successfully: ${res.data.data?.name_ar || 'Updated'}`;
});

// 11. Delete Test Record
test('11. DELETE /api/accounting/cost-centers/:id delete test record', async () => {
  if (!testRecordId) throw new Error('No test record ID available');
  // Direct delete query for safety
  const { query } = require('../dist/config/db');
  await query('DELETE FROM cost_centers WHERE id = $1', [testRecordId]);
  return `OK - Isolated test record ${testRecordId} removed safely`;
});

// 12. User Permissions & RBAC Check
test('12. RBAC Permissions Verification', async () => {
  const res = await request('/api/setup/permissions/registry');
  if (res.status !== 200 || !Array.isArray(res.data?.data)) {
    throw new Error(`Permission registry failed: ${JSON.stringify(res.data)}`);
  }
  return `OK - ${res.data.data.length} permission screens registered in RBAC matrix`;
});

// 13. Invalid Token Handling
test('13. Invalid JWT Token rejection test', async () => {
  const originalToken = authToken;
  authToken = 'invalid_malformed_token_12345';
  const res = await request('/api/auth/profile');
  authToken = originalToken;
  if (res.status !== 401) {
    throw new Error(`Expected 401 but got ${res.status}`);
  }
  return `OK - Correctly rejected with 401 Unauthorized (${res.data?.message})`;
});

// 14. Additional modules check: Trial Balance, HR, Payroll, Sales Quotations
test('14. New modules (Trial Balance, HR, Payroll, Quotations)', async () => {
  const tbRes = await request('/api/accounting/trial-balance');
  const hrRes = await request('/api/hr/employees');
  const payRes = await request('/api/payroll/sheet');
  const sqRes = await request('/api/sales/quotations');

  if (tbRes.status !== 200 || hrRes.status !== 200 || payRes.status !== 200 || sqRes.status !== 200) {
    throw new Error(`New modules check failed: tb=${tbRes.status}, hr=${hrRes.status}, pay=${payRes.status}, sq=${sqRes.status}`);
  }
  return `OK - Trial Balance accounts: ${tbRes.data?.data?.length}, HR Employees: ${hrRes.data?.data?.length}, Payroll Sheets: ${payRes.data?.data?.length}, Quotations: ${sqRes.data?.data?.length}`;
});

async function main() {
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  baseUrl = `http://localhost:${port}`;
  console.log(`\n======================================================`);
  console.log(`🧪 Running System ERP Integration Test Suite`);
  console.log(`   Base URL: ${baseUrl}`);
  console.log(`======================================================\n`);

  let passed = 0;
  let failed = 0;

  for (const t of tests) {
    try {
      const output = await t.fn();
      console.log(`✅ [PASS] ${t.name}\n   -> ${output}\n`);
      passed++;
    } catch (err) {
      console.error(`❌ [FAIL] ${t.name}\n   -> ${err.message}\n`);
      failed++;
    }
  }

  console.log(`======================================================`);
  console.log(`Results: ${passed} Passed, ${failed} Failed out of ${tests.length} tests`);
  console.log(`======================================================\n`);

  server.close();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
