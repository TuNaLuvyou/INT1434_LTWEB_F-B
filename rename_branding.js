const fs = require('fs');
const path = require('path');

const directory = 'c:/Users/ASUS/Desktop/dphava_2/HiAI-MenuGo';
const excludeDirs = ['node_modules', '.git', '.next', 'dist'];

function replaceInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let newContent = content
    .replace(/HiAI-MenuGo/g, 'HiAI-MenuGo')
    .replace(/hiaimenugo/g, 'hiaimenugo');

  if (content !== newContent) {
    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log(`Updated: ${filePath}`);
  }
}

function walkDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      if (!excludeDirs.includes(file)) {
        walkDir(fullPath);
      }
    } else {
      if (!file.endsWith('.svg') && !file.endsWith('.ico') && !file.endsWith('.png')) {
        replaceInFile(fullPath);
      }
    }
  }
}

walkDir(directory);
console.log('Branding replacement complete.');
