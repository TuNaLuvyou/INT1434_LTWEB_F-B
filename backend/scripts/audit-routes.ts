import fs from 'fs';
import path from 'path';

const routesDir = path.join(__dirname, '../src/routes');

console.log('=== API ROUTE ROLE GUARD AUDIT ===');

const routeFiles = fs.readdirSync(routesDir).filter((f: string) => f.endsWith('.ts'));

for (const file of routeFiles) {
  console.log(`\n📄 File: ${file}`);
  const content = fs.readFileSync(path.join(routesDir, file), 'utf8');
  
  const lines = content.split('\n');
  let hasRouterAuth = false;
  let hasRouterRole = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Kiểm tra router-level middleware
    if (line.includes('.use(authMiddleware')) hasRouterAuth = true;
    if (line.includes('.use(') && line.includes('requireRole')) hasRouterRole = true;

    // Phân tích các endpoint cụ thể
    const routeMatch = line.match(/router\.(get|post|put|patch|delete)\(['"`](.*?)['"`],/);
    if (routeMatch || (line.includes('.get(') || line.includes('.post(') || line.includes('.put(') || line.includes('.delete(') || line.includes('.patch('))) {
      const exactMatch = line.match(/\.(get|post|put|patch|delete)\(['"`](.*?)['"`]/);
      if (!exactMatch) continue;

      const method = exactMatch[1].toUpperCase();
      const endpoint = exactMatch[2];
      
      const hasRouteAuth = line.includes('authMiddleware');
      const hasRouteRole = line.includes('requireRole');

      const isProtectedAuth = hasRouterAuth || hasRouteAuth;
      const isProtectedRole = hasRouterRole || hasRouteRole;

      let status = '✅';
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && !isProtectedAuth) {
        status = '❌ [THIẾU AUTH]';
      }
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && !isProtectedRole && endpoint !== '/login' && endpoint !== '/register' && endpoint !== '/refresh' && endpoint !== '/join' && endpoint !== '/logout') {
        status = '⚠️ [THIẾU ROLE CỤ THỂ]';
      }

      console.log(`  ${status} ${method.padEnd(6)} ${endpoint}`);
    }
  }
}
console.log('\n================================');
