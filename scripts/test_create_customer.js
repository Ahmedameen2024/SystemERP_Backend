(async () => {
  try {
    const loginRes = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'Admin@1234' }),
    });
    const loginJson = await loginRes.json();
    console.log('LOGIN', loginJson);
    if (!loginJson.success) return;
    const token = loginJson.data.token;
    const cust = {
      code: 'CUST-TEST-001',
      nameAr: 'عميل اختبار',
      nameEn: 'Test Customer',
      phone: '0500000000',
      paymentTerms: 30,
      creditLimit: 0,
      openingBalance: 0,
      status: 'Active',
    };
    const createRes = await fetch('http://localhost:5000/api/sales/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(cust),
    });
    const createJson = await createRes.json();
    console.log('CREATE', createJson);
  } catch (e) {
    console.error(e);
  }
})();
