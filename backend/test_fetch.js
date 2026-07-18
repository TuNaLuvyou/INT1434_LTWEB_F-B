const http = require('http');

http.get('http://localhost:3000/api/tables?tenantId=48e6fd63-e190-4ef1-a34f-6d1e913c3891', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('Tables:', data));
});
