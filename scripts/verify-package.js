const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const packageJson = require(path.join(root, 'package.json'));

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertFile(relativePath) {
  const absolutePath = path.join(root, relativePath);
  assert(fs.existsSync(absolutePath), `Missing package file: ${relativePath}`);
  assert(fs.statSync(absolutePath).isFile(), `Package path is not a file: ${relativePath}`);
}

function assertDirectory(relativePath) {
  const absolutePath = path.join(root, relativePath);
  assert(fs.existsSync(absolutePath), `Missing package directory: ${relativePath}`);
  assert(fs.statSync(absolutePath).isDirectory(), `Package path is not a directory: ${relativePath}`);
}

const requiredFiles = [
  'README.md',
  'CHANGELOG.md',
  'LICENSE',
  'docs/README.md',
  'docs/ENGINE_API.md',
  'docs/RENDERING.md',
  'docs/EXAMPLES.md',
  'examples/basic-world.ts',
  'examples/world-session.ts',
  'examples/rendering-data.ts',
  'examples/three-adapter.ts',
];

for (const relativePath of requiredFiles) {
  assertFile(relativePath);
}

for (const relativePath of [
  'dist',
  'dist/config',
  'dist/runtime',
  'dist/rendering',
  'dist/adapters/three',
  'examples',
]) {
  assertDirectory(relativePath);
}

assert(
  packageJson.files.includes('docs/*.md'),
  'Package files must include public docs/*.md'
);
assert(
  !packageJson.files.includes('docs'),
  'Package files must not include the full docs directory'
);
assert(
  !packageJson.files.includes('docs/superpowers'),
  'Package files must not include historical planning docs'
);

for (const exportPath of [
  '.',
  './worker',
  './config',
  './runtime',
  './rendering',
  './adapters/three',
  './package.json',
]) {
  assert(packageJson.exports[exportPath], `Missing package export: ${exportPath}`);
}

assert(packageJson.sideEffects === false, 'Expected sideEffects=false for package tree-shaking');
assert(packageJson.peerDependencies.three, 'Three.js must remain an optional peer dependency');
assert(packageJson.peerDependenciesMeta.three.optional === true, 'Three.js peer dependency must be optional');

console.log('Package verification passed.');
