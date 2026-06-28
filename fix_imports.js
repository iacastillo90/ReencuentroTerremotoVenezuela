const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'back', 'src');
const testDir = path.join(__dirname, 'back', 'test', 'unit');

// Map all exports to their relative paths from back/src
const fileMap = new Map();

function walk(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walk(fullPath);
    } else if (fullPath.endsWith('.ts')) {
      // Get relative path without extension
      let relPath = path.relative(srcDir, fullPath).replace(/\\/g, '/');
      relPath = relPath.replace(/\.ts$/, '');
      const basename = path.basename(relPath);
      fileMap.set(basename, relPath);
    }
  }
}
walk(srcDir);

// Also add app to map
fileMap.set('app', 'app');

const testFiles = fs.readdirSync(testDir).filter(f => f.endsWith('.ts'));

for (const testFile of testFiles) {
  const filePath = path.join(testDir, testFile);
  let content = fs.readFileSync(filePath, 'utf8');

  // Replace imports/mocks
  content = content.replace(/(import .*? from |jest\.mock\()(['"])([^'"]+)\2/g, (match, p1, p2, p3) => {
    // extract basename from the import
    let importName = path.basename(p3);
    if (p3 === '../app' || p3 === '../../app') importName = 'app';
    if (importName.startsWith('util')) importName = importName.replace('util', 'utils'); // hack for utils

    let found = fileMap.get(importName);
    if (found) {
      const newPath = '../../src/' + found;
      return p1 + p2 + newPath + p2;
    }
    // Check if it's a known mapping
    if (importName === 'ai.factory') return p1 + p2 + '../../src/services/ai/ai.factory' + p2;
    if (importName === 'ai.interface') return p1 + p2 + '../../src/services/ai/ai.interface' + p2;
    
    // If not found (e.g. node_modules like supertest), leave it
    if (!p3.startsWith('.')) return match;
    
    console.log(`Could not map: ${p3} in ${testFile}`);
    return match;
  });

  fs.writeFileSync(filePath, content);
}
console.log('Fixed imports in test files.');
