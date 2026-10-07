const fs = require('fs');
const path = require('path');

function getRequires(dir) {
  const files = fs.readdirSync(dir);
  const requires = new Set();
  for (const f of files) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) {
      getRequires(full).forEach(r => requires.add(r));
    } else if (f.endsWith('.js')) {
      const content = fs.readFileSync(full, 'utf8');
      const matches = content.matchAll(/require\(['"]([^'"]+)['"]\)/g);
      for (const m of matches) {
        if (!m[1].startsWith('.')) {
          requires.add(m[1]);
        }
      }
    }
  }
  return requires;
}

const reqs = getRequires('./src');
console.log('Third-party / built-in requires in src/:', Array.from(reqs));

const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
const deps = Object.keys(pkg.dependencies || {});
console.log('package.json dependencies:', deps);

const builtin = ['path', 'fs', 'crypto', 'http', 'https', 'url', 'os', 'stream', 'util', 'events', 'child_process'];
const missing = Array.from(reqs).filter(r => !builtin.includes(r) && !deps.includes(r) && !r.startsWith('puppeteer'));
console.log('Potentially missing in package.json:', missing);
