/**
 * E2E Smoke Test: App health after LOD/Incremental removal
 *
 * Loads the demo, captures all console output, checks for errors,
 * and verifies basic functionality still works.
 */

import { test, expect } from '@playwright/test';

test.describe('App smoke test after LOD/Incremental removal', () => {
  test('loads without errors and renders terrain', async ({ page }) => {
    const consoleMessages: Array<{ type: string; text: string }> = [];
    const pageErrors: string[] = [];

    // Capture all console output
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
      console.log(`[BROWSER ${msg.type().toUpperCase()}] ${msg.text()}`);
    });

    // Capture uncaught page errors
    page.on('pageerror', err => {
      pageErrors.push(err.message);
      console.log(`[PAGE ERROR] ${err.message}`);
    });

    console.log('\n🌐 Opening demo at http://localhost:3001/...\n');
    await page.goto('http://localhost:3001/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    console.log('✅ Page loaded\n');

    // ── 1. No uncaught page errors ──────────────────────────────────
    console.log('🔍 Checking for page errors...');
    if (pageErrors.length > 0) {
      console.log('❌ Page errors found:');
      pageErrors.forEach(e => console.log(`   ${e}`));
    } else {
      console.log('✅ No page errors\n');
    }
    expect(pageErrors, 'Should have no uncaught page errors').toHaveLength(0);

    // ── 2. No console errors (excluding known 404 for worker script) ──
    const errors = consoleMessages.filter(m =>
      m.type === 'error' &&
      !m.text.includes('Failed to load resource') // worker script 404 is pre-existing
    );
    console.log(`🔍 Console errors (excluding resource 404s): ${errors.length}`);
    errors.forEach(e => console.log(`   ❌ ${e.text}`));
    const resource404s = consoleMessages.filter(m => m.type === 'error' && m.text.includes('Failed to load resource'));
    if (resource404s.length > 0) {
      console.log(`ℹ️  Resource 404s (pre-existing, not related to this change): ${resource404s.length}`);
      resource404s.forEach(e => console.log(`   ⚠️  ${e.text}`));
    }
    expect(errors, 'Should have no console errors').toHaveLength(0);

    // ── 3. App initialized ──────────────────────────────────────────
    const initialized = consoleMessages.some(m =>
      m.text.includes('DemoApp initialized successfully')
    );
    console.log(`🔍 DemoApp initialized: ${initialized ? '✅' : '❌'}`);
    expect(initialized, 'DemoApp should initialize').toBe(true);

    // ── 4. No LOD/incremental references in console ─────────────────
    const lodRefs = consoleMessages.filter(m =>
      /LODManager|LODLevel|LODConfig|IncrementalGenerator|IncrementalConfig|GenerationStage|PartialChunkData/i.test(m.text)
    );
    console.log(`🔍 LOD/Incremental console refs: ${lodRefs.length}`);
    lodRefs.forEach(m => console.log(`   ⚠️  ${m.text}`));
    expect(lodRefs, 'Should have no LOD/incremental references in console').toHaveLength(0);

    // ── 5. Canvas is rendered ───────────────────────────────────────
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
    console.log('✅ Canvas is visible\n');

    // ── 6. Worker Pool checkbox exists (LOD checkbox should NOT exist) ──
    const workerPoolCheckbox = page.locator('#enableWorkerPool');
    await expect(workerPoolCheckbox).toBeVisible();
    console.log('✅ Worker Pool checkbox present\n');

    const lodCheckbox = page.locator('#enableLOD');
    const lodVisible = await lodCheckbox.isVisible();
    console.log(`🔍 LOD checkbox visible: ${lodVisible ? '❌ (should be gone)' : '✅ (correctly absent)'}`);
    expect(lodVisible, 'LOD checkbox should not exist').toBe(false);

    const incrementalCheckbox = page.locator('#enableIncremental');
    const incrementalVisible = await incrementalCheckbox.isVisible();
    console.log(`🔍 Incremental checkbox visible: ${incrementalVisible ? '❌ (should be gone)' : '✅ (correctly absent)'}`);
    expect(incrementalVisible, 'Incremental checkbox should not exist').toBe(false);

    // ── 7. Enable Worker Pool and verify it works ───────────────────
    console.log('\n🔵 Enabling Worker Pool...');
    await workerPoolCheckbox.check();
    await page.waitForTimeout(1500);

    const workerEnabled = consoleMessages.some(m =>
      m.text.includes('Worker pool enabled successfully')
    );
    console.log(`🔍 Worker pool enabled: ${workerEnabled ? '✅' : '❌'}`);
    expect(workerEnabled, 'Worker pool should enable successfully').toBe(true);

    // ── 8. Disable Worker Pool and verify shutdown ──────────────────
    console.log('🔴 Disabling Worker Pool...');
    await workerPoolCheckbox.uncheck();
    await page.waitForTimeout(1000);

    const shutdownMsg = consoleMessages.some(m =>
      m.text.includes('Shutting down old worker pool')
    );
    console.log(`🔍 Shutdown message: ${shutdownMsg ? '✅' : '❌'}`);
    expect(shutdownMsg, 'Should show shutdown message').toBe(true);

    // ── 9. Final error check ────────────────────────────────────────
    const finalErrors = consoleMessages.filter(m =>
      m.type === 'error' && !m.text.includes('Failed to load resource')
    );
    console.log(`\n🔍 Final error count (excluding resource 404s): ${finalErrors.length}`);
    finalErrors.forEach(e => console.log(`   ❌ ${e.text}`));
    expect(finalErrors, 'Should still have no console errors').toHaveLength(0);

    console.log('\n🎉 All smoke tests passed!\n');
  });
});
