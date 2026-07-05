const fs = require('fs');
const path = require('path');

const controllersDir = path.join(__dirname, 'src', 'controllers');

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;

  // Replace res.json({ success: true, data: X }) with ApiResponse.success(res, X)
  content = content.replace(/res\.json\(\{\s*success:\s*true,\s*data:\s*([^}]+)\s*\}\);/g, 'ApiResponse.success(res, $1);');
  
  // Replace res.json({ success: true, message: 'X' }) with ApiResponse.success(res, undefined, 'X')
  content = content.replace(/res\.json\(\{\s*success:\s*true,\s*message:\s*([^}]+)\s*\}\);/g, 'ApiResponse.success(res, undefined, $1);');
  
  // Replace res.json({ success: true }) with ApiResponse.success(res)
  content = content.replace(/res\.json\(\{\s*success:\s*true\s*\}\);/g, 'ApiResponse.success(res);');

  if (content !== originalContent) {
    if (!content.includes('ApiResponse')) {
      content = `import { ApiResponse } from '../utils/response';\n` + content;
    }
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${path.basename(filePath)}`);
  }
}

const files = fs.readdirSync(controllersDir);
files.forEach(file => {
  if (file.endsWith('.ts')) {
    processFile(path.join(controllersDir, file));
  }
});
