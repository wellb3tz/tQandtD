const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const srcRoot = path.join(root, 'src');
const rootTestsRoot = path.join(root, 'tests');
const tsconfig = require(path.join(root, 'tsconfig.json'));
const appTsconfig = require(path.join(root, 'tsconfig.app.json'));

const disallowedPathAliases = ['@core/*', '@viewer/*', '@ui/*', '@editor/*', '@utils/*'];
const enginePaths = tsconfig.compilerOptions?.paths ?? {};
const appPaths = appTsconfig.compilerOptions?.paths ?? {};

for (const alias of disallowedPathAliases) {
  if (Object.prototype.hasOwnProperty.call(enginePaths, alias)) {
    throw new Error(`Engine tsconfig must not define app-only alias: ${alias}`);
  }
}

for (const alias of disallowedPathAliases.filter(alias => alias !== '@editor/*')) {
  if (!Object.prototype.hasOwnProperty.call(appPaths, alias)) {
    throw new Error(`App tsconfig must define app alias: ${alias}`);
  }
}

const disallowedImportPatterns = [
  /\bfrom\s+['"][^'"]*app\/src[^'"]*['"]/,
  /\bfrom\s+['"](?:\.\.\/)+app(?:\/|['"])/,
  /\bfrom\s+['"]@(?:core|viewer|ui|editor|utils)(?:\/|['"])/,
  /\bimport\s*\([^)]*['"][^'"]*app\/src[^'"]*['"][^)]*\)/,
  /\bimport\s*\([^)]*['"]@(?:core|viewer|ui|editor|utils)(?:\/|['"])[^)]*\)/,
];

const disallowedRootTestImportPatterns = [
  /\bfrom\s+['"][^'"]*app\/src[^'"]*['"]/,
  /\bfrom\s+['"](?:\.\.\/)+app(?:\/|['"])/,
  /\bfrom\s+['"]@(?:core|viewer|ui|editor|utils)(?:\/|['"])/,
  /\bimport\s*\([^)]*['"][^'"]*app\/src[^'"]*['"][^)]*\)/,
  /\bimport\s*\([^)]*['"]@(?:core|viewer|ui|editor|utils)(?:\/|['"])[^)]*\)/,
];

const sourceFiles = [];
const rootTestFiles = [];

function collectTypeScriptFiles(directory, target) {
  if (!fs.existsSync(directory)) {
    return;
  }

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      collectTypeScriptFiles(absolutePath, target);
      continue;
    }

    if (entry.isFile() && absolutePath.endsWith('.ts')) {
      target.push(absolutePath);
    }
  }
}

collectTypeScriptFiles(srcRoot, sourceFiles);
collectTypeScriptFiles(rootTestsRoot, rootTestFiles);

const violations = [];

for (const filePath of sourceFiles) {
  const source = fs.readFileSync(filePath, 'utf8');

  for (const pattern of disallowedImportPatterns) {
    if (pattern.test(source)) {
      violations.push(path.relative(root, filePath));
      break;
    }
  }
}

if (violations.length > 0) {
  throw new Error(
    `Engine source must not import app modules:\n${violations.map(file => `- ${file}`).join('\n')}`
  );
}

const rootTestViolations = [];

for (const filePath of rootTestFiles) {
  const source = fs.readFileSync(filePath, 'utf8');

  for (const pattern of disallowedRootTestImportPatterns) {
    if (pattern.test(source)) {
      rootTestViolations.push(path.relative(root, filePath));
      break;
    }
  }
}

if (rootTestViolations.length > 0) {
  throw new Error(
    `Root engine tests must not import app modules. Put app tests under app/src instead:\n${rootTestViolations.map(file => `- ${file}`).join('\n')}`
  );
}

console.log('Source/app boundary verification passed.');
