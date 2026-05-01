const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const entry = path.join(root, 'dist', 'index.js');
const types = path.join(root, 'dist', 'index.d.ts');
const workerEntry = path.join(root, 'dist', 'worker.js');
const workerTypes = path.join(root, 'dist', 'worker.d.ts');

function assertFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing build artifact: ${path.relative(root, filePath)}`);
  }
}

assertFile(entry);
assertFile(types);
assertFile(workerEntry);
assertFile(workerTypes);

const api = require(entry);
const workerApi = require(workerEntry);
const packageApi = require('procedural-world-engine');
const packageWorkerApi = require('procedural-world-engine/worker');

const requiredExports = [
  'ChunkManager',
  'WorldSerializer',
  'SerializationFormat',
  'BiomeType',
  'ResourceType',
  'StructureType',
  'TerrainGenerator',
  'WorkerPool',
  'installWorkerHandler',
];

const missing = requiredExports.filter((name) => !(name in api));
if (missing.length > 0) {
  throw new Error(`Missing public exports: ${missing.join(', ')}`);
}

if (typeof workerApi.installWorkerHandler !== 'function') {
  throw new Error('Missing worker subpath export: installWorkerHandler');
}

if (packageApi.ChunkManager !== api.ChunkManager) {
  throw new Error('Package self-reference does not resolve the main export');
}

if (packageWorkerApi.installWorkerHandler !== workerApi.installWorkerHandler) {
  throw new Error('Package worker subpath does not resolve the worker export');
}

console.log(`Build verification passed (${Object.keys(api).length} exports).`);
