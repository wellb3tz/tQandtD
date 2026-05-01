const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const targets = process.argv.slice(2);

if (targets.length === 0) {
  throw new Error('Usage: node scripts/clean.js <path> [path...]');
}

for (const target of targets) {
  const resolved = path.resolve(root, target);
  const relative = path.relative(root, resolved);

  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Refusing to clean outside project root: ${target}`);
  }

  if (relative === '') {
    throw new Error('Refusing to clean project root');
  }

  fs.rmSync(resolved, { recursive: true, force: true });
}
