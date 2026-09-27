const axios = require('axios');
const argv = require('minimist')(process.argv.slice(2));

const backend = argv.backend || process.env.BACKEND_URL;
const username = argv.username || process.env.TEST_USERNAME || 'admin';
const password = argv.password || process.env.TEST_PASSWORD || 'Admin@1234';

if (!backend) {
  console.error('Usage: node scripts/test-remote-login.js --backend https://api.example.com [--username user --password pass]');
  process.exit(2);
}

(async () => {
  try {
    const url = backend.replace(/\/$/, '') + '/api/auth/login';
    console.log('POST', url);
    const res = await axios.post(url, { username, password }, { timeout: 10000 });
    console.log('Status:', res.status);
    console.log('Response:', JSON.stringify(res.data, null, 2));
    process.exit(0);
  } catch (err) {
    if (err.response) {
      console.error('Status:', err.response.status);
      console.error('Data:', JSON.stringify(err.response.data, null, 2));
    } else {
      console.error('Error:', err.message || err);
    }
    process.exit(3);
  }
})();
