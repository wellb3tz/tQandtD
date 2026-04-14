#!/usr/bin/env node

/**
 * Build Verification Script
 * 
 * Verifies that the production build meets performance targets:
 * - Bundle size < 500KB gzipped
 * - All required files present
 * - No critical issues
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';
import { gzipSync } from 'zlib';

const DIST_DIR = 'dist-demo';
const MAX_TOTAL_SIZE_KB = 500; // 500KB gzipped target
const MAX_MAIN_BUNDLE_KB = 200; // 200KB gzipped for main bundle

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function formatSize(bytes) {
  return `${(bytes / 1024).toFixed(2)} KB`;
}

function getGzippedSize(filePath) {
  const content = readFileSync(filePath);
  const gzipped = gzipSync(content);
  return gzipped.length;
}

function getAllFiles(dir, fileList = []) {
  const files = readdirSync(dir);
  
  files.forEach(file => {
    const filePath = join(dir, file);
    const stat = statSync(filePath);
    
    if (stat.isDirectory()) {
      getAllFiles(filePath, fileList);
    } else {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

function verifyBuild() {
  log('\n=== Build Verification ===\n', 'bold');
  
  let hasErrors = false;
  let hasWarnings = false;
  
  // Check if dist directory exists
  try {
    statSync(DIST_DIR);
  } catch (error) {
    log('❌ Error: dist-demo directory not found. Run "npm run build:demo" first.', 'red');
    process.exit(1);
  }
  
  // Get all files
  const allFiles = getAllFiles(DIST_DIR);
  const jsFiles = allFiles.filter(f => extname(f) === '.js');
  const cssFiles = allFiles.filter(f => extname(f) === '.css');
  const htmlFiles = allFiles.filter(f => extname(f) === '.html');
  
  log('📦 Bundle Analysis:', 'blue');
  log('');
  
  // Analyze JavaScript bundles
  let totalJsSize = 0;
  let totalJsGzipped = 0;
  const bundleInfo = [];
  
  jsFiles.forEach(file => {
    const stat = statSync(file);
    const gzippedSize = getGzippedSize(file);
    const fileName = file.replace(`${DIST_DIR}/`, '');
    
    totalJsSize += stat.size;
    totalJsGzipped += gzippedSize;
    
    bundleInfo.push({
      name: fileName,
      size: stat.size,
      gzipped: gzippedSize
    });
  });
  
  // Sort by gzipped size (largest first)
  bundleInfo.sort((a, b) => b.gzipped - a.gzipped);
  
  // Display bundle info
  bundleInfo.forEach(bundle => {
    const sizeStr = formatSize(bundle.size);
    const gzippedStr = formatSize(bundle.gzipped);
    
    let color = 'green';
    if (bundle.gzipped > MAX_MAIN_BUNDLE_KB * 1024) {
      color = 'yellow';
    }
    
    log(`  ${bundle.name}`, color);
    log(`    Size: ${sizeStr} | Gzipped: ${gzippedStr}`);
  });
  
  log('');
  
  // Analyze CSS
  let totalCssSize = 0;
  let totalCssGzipped = 0;
  
  cssFiles.forEach(file => {
    const stat = statSync(file);
    const gzippedSize = getGzippedSize(file);
    const fileName = file.replace(`${DIST_DIR}/`, '');
    
    totalCssSize += stat.size;
    totalCssGzipped += gzippedSize;
    
    log(`  ${fileName}`, 'green');
    log(`    Size: ${formatSize(stat.size)} | Gzipped: ${formatSize(gzippedSize)}`);
  });
  
  log('');
  
  // Total sizes
  const totalSize = totalJsSize + totalCssSize;
  const totalGzipped = totalJsGzipped + totalCssGzipped;
  
  log('📊 Summary:', 'blue');
  log('');
  log(`  Total JS:  ${formatSize(totalJsSize)} (${formatSize(totalJsGzipped)} gzipped)`);
  log(`  Total CSS: ${formatSize(totalCssSize)} (${formatSize(totalCssGzipped)} gzipped)`);
  log(`  Total:     ${formatSize(totalSize)} (${formatSize(totalGzipped)} gzipped)`);
  log('');
  
  // Check against targets
  log('🎯 Performance Targets:', 'blue');
  log('');
  
  const totalGzippedKB = totalGzipped / 1024;
  
  if (totalGzippedKB <= MAX_TOTAL_SIZE_KB) {
    log(`  ✅ Total bundle size: ${totalGzippedKB.toFixed(2)} KB / ${MAX_TOTAL_SIZE_KB} KB`, 'green');
  } else {
    log(`  ❌ Total bundle size: ${totalGzippedKB.toFixed(2)} KB / ${MAX_TOTAL_SIZE_KB} KB (EXCEEDS TARGET)`, 'red');
    hasErrors = true;
  }
  
  // Check main bundle size
  const mainBundle = bundleInfo.find(b => b.name.includes('index-'));
  if (mainBundle) {
    const mainGzippedKB = mainBundle.gzipped / 1024;
    if (mainGzippedKB <= MAX_MAIN_BUNDLE_KB) {
      log(`  ✅ Main bundle size: ${mainGzippedKB.toFixed(2)} KB / ${MAX_MAIN_BUNDLE_KB} KB`, 'green');
    } else {
      log(`  ⚠️  Main bundle size: ${mainGzippedKB.toFixed(2)} KB / ${MAX_MAIN_BUNDLE_KB} KB (WARNING)`, 'yellow');
      hasWarnings = true;
    }
  }
  
  // Check Three.js bundle
  const threeBundle = bundleInfo.find(b => b.name.includes('three-'));
  if (threeBundle) {
    const threeGzippedKB = threeBundle.gzipped / 1024;
    log(`  ℹ️  Three.js bundle: ${threeGzippedKB.toFixed(2)} KB`);
  }
  
  log('');
  
  // Check required files
  log('📋 Required Files:', 'blue');
  log('');
  
  const hasIndexHtml = htmlFiles.some(f => f.includes('index.html'));
  if (hasIndexHtml) {
    log('  ✅ index.html found', 'green');
  } else {
    log('  ❌ index.html not found', 'red');
    hasErrors = true;
  }
  
  const hasMainJs = jsFiles.some(f => f.includes('index-'));
  if (hasMainJs) {
    log('  ✅ Main JavaScript bundle found', 'green');
  } else {
    log('  ❌ Main JavaScript bundle not found', 'red');
    hasErrors = true;
  }
  
  const hasThreeJs = jsFiles.some(f => f.includes('three-'));
  if (hasThreeJs) {
    log('  ✅ Three.js bundle found', 'green');
  } else {
    log('  ⚠️  Three.js bundle not found (may be bundled with main)', 'yellow');
    hasWarnings = true;
  }
  
  const hasStyles = cssFiles.length > 0;
  if (hasStyles) {
    log('  ✅ CSS styles found', 'green');
  } else {
    log('  ⚠️  No CSS files found', 'yellow');
    hasWarnings = true;
  }
  
  log('');
  
  // Final result
  if (hasErrors) {
    log('❌ Build verification FAILED', 'red');
    log('');
    process.exit(1);
  } else if (hasWarnings) {
    log('⚠️  Build verification PASSED with warnings', 'yellow');
    log('');
    process.exit(0);
  } else {
    log('✅ Build verification PASSED', 'green');
    log('');
    log('🚀 Ready for deployment!', 'bold');
    log('');
    process.exit(0);
  }
}

// Run verification
verifyBuild();
