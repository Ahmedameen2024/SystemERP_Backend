(async () => {
  try {
    const loginRes = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'Admin@1234' }),
    });
    const loginJson = await loginRes.json();
    console.log('LOGIN', loginJson.success);
    if (!loginJson.success) return;
    const token = loginJson.data.token;
    const dash = await fetch('http://localhost:5000/api/sales/dashboard-stats', { headers: { Authorization: `Bearer ${token}` } }).then(r=>r.json());
    console.log('DASH', dash);
    const invs = await fetch('http://localhost:5000/api/sales/invoices', { headers: { Authorization: `Bearer ${token}` } }).then(r=>r.json());
    console.log('INVS', invs.success, (invs.data || []).length);
  } catch (e) { console.error(e); }
})();
