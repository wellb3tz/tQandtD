const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const entry = path.join(root, 'dist', 'index.js');
const types = path.join(root, 'dist', 'index.d.ts');
const workerEntry = path.join(root, 'dist', 'worker.js');
const workerTypes = path.join(root, 'dist', 'worker.d.ts');
const configEntry = path.join(root, 'dist', 'config', 'index.js');
const configTypes = path.join(root, 'dist', 'config', 'index.d.ts');
const runtimeEntry = path.join(root, 'dist', 'runtime', 'index.js');
const runtimeTypes = path.join(root, 'dist', 'runtime', 'index.d.ts');
const renderingEntry = path.join(root, 'dist', 'rendering', 'index.js');
const renderingTypes = path.join(root, 'dist', 'rendering', 'index.d.ts');
const threeAdapterEntry = path.join(root, 'dist', 'adapters', 'three', 'index.js');
const threeAdapterTypes = path.join(root, 'dist', 'adapters', 'three', 'index.d.ts');
const engineApiDoc = path.join(root, 'docs', 'ENGINE_API.md');
const renderingDoc = path.join(root, 'docs', 'RENDERING.md');
const basicExample = path.join(root, 'examples', 'basic-world.ts');
const renderingExample = path.join(root, 'examples', 'rendering-data.ts');

function assertFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing build artifact: ${path.relative(root, filePath)}`);
  }
}

assertFile(entry);
assertFile(types);
assertFile(workerEntry);
assertFile(workerTypes);
assertFile(configEntry);
assertFile(configTypes);
assertFile(runtimeEntry);
assertFile(runtimeTypes);
assertFile(renderingEntry);
assertFile(renderingTypes);
assertFile(threeAdapterEntry);
assertFile(threeAdapterTypes);
assertFile(engineApiDoc);
assertFile(renderingDoc);
assertFile(basicExample);
assertFile(renderingExample);

const api = require(entry);
const workerApi = require(workerEntry);
const configApi = require(configEntry);
const runtimeApi = require(runtimeEntry);
const renderingApi = require(renderingEntry);
const threeAdapterApi = require(threeAdapterEntry);
const packageApi = require('procedural-world-engine');
const packageWorkerApi = require('procedural-world-engine/worker');
const packageConfigApi = require('procedural-world-engine/config');
const packageRuntimeApi = require('procedural-world-engine/runtime');
const packageRenderingApi = require('procedural-world-engine/rendering');
const packageThreeAdapterApi = require('procedural-world-engine/adapters/three');

const requiredExports = [
  'ChunkManager',
  'WorldSerializer',
  'SerializationFormat',
  'BiomeType',
  'ResourceType',
  'StructureType',
  'TerrainGenerator',
  'WorkerPool',
  'WorldSession',
  'installWorkerHandler',
];

const missing = requiredExports.filter((name) => !(name in api));
if (missing.length > 0) {
  throw new Error(`Missing public exports: ${missing.join(', ')}`);
}

if (typeof workerApi.installWorkerHandler !== 'function') {
  throw new Error('Missing worker subpath export: installWorkerHandler');
}

if (typeof configApi.createDefaultWorldConfig !== 'function') {
  throw new Error('Missing config subpath export: createDefaultWorldConfig');
}

if (typeof runtimeApi.WorldSession !== 'function') {
  throw new Error('Missing runtime subpath export: WorldSession');
}

for (const name of [
  'buildOceanGeometryData',
  'buildTerrainGridGeometryData',
  'calculateRiverTrenchInfluence',
  'planFoliagePlacements',
  'buildChunkBoundaryLineData',
  'buildResourceMarkerPlacements',
  'applyChunkVisibility',
  'calculateRenderStats',
  'RenderStatsCache',
]) {
  if (typeof renderingApi[name] !== 'function') {
    throw new Error(`Missing rendering subpath export: ${name}`);
  }
}

if (typeof threeAdapterApi.ThreeWorldRendererAdapter !== 'function') {
  throw new Error('Missing Three adapter subpath export: ThreeWorldRendererAdapter');
}

if (packageApi.ChunkManager !== api.ChunkManager) {
  throw new Error('Package self-reference does not resolve the main export');
}

if (packageWorkerApi.installWorkerHandler !== workerApi.installWorkerHandler) {
  throw new Error('Package worker subpath does not resolve the worker export');
}

if (packageConfigApi.createDefaultWorldConfig !== configApi.createDefaultWorldConfig) {
  throw new Error('Package config subpath does not resolve the config export');
}

if (packageRuntimeApi.WorldSession !== runtimeApi.WorldSession) {
  throw new Error('Package runtime subpath does not resolve the runtime export');
}

if (packageRenderingApi.buildOceanGeometryData !== renderingApi.buildOceanGeometryData) {
  throw new Error('Package rendering subpath does not resolve the rendering export');
}

if (packageThreeAdapterApi.ThreeWorldRendererAdapter !== threeAdapterApi.ThreeWorldRendererAdapter) {
  throw new Error('Package Three adapter subpath does not resolve the adapter export');
}

console.log(`Build verification passed (${Object.keys(api).length} exports).`);
