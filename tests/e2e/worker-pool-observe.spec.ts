/**
 * E2E Test: Observe Worker Pool Console Output
 * 
 * This test enables Worker Pool and observes console output for 10 seconds
 * to see what messages appear during normal operation.
 */

import { test } from '@playwright/test';

test.describe('Worker Pool Console Observation', () => {
  test('should observe console output after enabling Worker Pool', async ({ page }) => {
    // Array to capture ALL console messages
    const consoleMessages: Array<{ timestamp: number; text: string }> = [];
    const startTime = Date.now();
    
    // Listen to ALL console messages
    page.on('console', msg => {
      const text = msg.text();
      const timestamp = Date.now() - startTime;
      consoleMessages.push({ timestamp, text });
      console.log(`[${(timestamp / 1000).toFixed(1)}s] ${text}`);
    });

    // Navigate to the demo
    console.log('\n🌐 Opening demo at http://localhost:3001/...\n');
    await page.goto('http://localhost:3001/', { waitUntil: 'networkidle' });
    
    // Wait for the app to initialize
    await page.waitForTimeout(3000);
    
    console.log('\n✅ Demo loaded\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Find the Worker Pool checkbox
    const workerPoolCheckbox = page.locator('#enableWorkerPool');
    
    // Clear console messages before enabling
    consoleMessages.length = 0;

    console.log('🔵 Enabling Worker Pool...\n');
    await workerPoolCheckbox.check();
    
    console.log('\n⏱️  Observing console for 10 seconds...\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // Wait 10 seconds and observe
    await page.waitForTimeout(10000);
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('⏹️  Observation complete!\n');
    
    // Analyze the messages
    console.log('📊 ANALYSIS:\n');
    
    const workerPoolMessages = consoleMessages.filter(m => 
      m.text.includes('WorkerPool') || m.text.includes('Worker pool')
    );
    
    const updateConfigMessages = consoleMessages.filter(m => 
      m.text.includes('updateEngineConfig')
    );
    
    const shutdownMessages = consoleMessages.filter(m => 
      m.text.includes('Shutting down')
    );
    
    const initMessages = consoleMessages.filter(m => 
      m.text.includes('Successfully initialized')
    );
    
    console.log(`   Total console messages: ${consoleMessages.length}`);
    console.log(`   WorkerPool-related messages: ${workerPoolMessages.length}`);
    console.log(`   updateEngineConfig calls: ${updateConfigMessages.length}`);
    console.log(`   Shutdown messages: ${shutdownMessages.length}`);
    console.log(`   Initialization messages: ${initMessages.length}`);
    
    console.log('\n📋 WorkerPool-related messages:\n');
    workerPoolMessages.forEach(m => {
      console.log(`   [${(m.timestamp / 1000).toFixed(1)}s] ${m.text}`);
    });
    
    if (initMessages.length > 1) {
      console.log('\n⚠️  WARNING: Multiple initialization messages detected!');
      console.log(`   Expected: 1 initialization`);
      console.log(`   Actual: ${initMessages.length} initializations`);
      console.log('\n   This might indicate repeated worker creation!');
    }
    
    if (updateConfigMessages.length > 1) {
      console.log('\n⚠️  WARNING: Multiple updateEngineConfig calls detected!');
      console.log(`   Expected: 1 call (when enabling)`);
      console.log(`   Actual: ${updateConfigMessages.length} calls`);
      console.log('\n   updateEngineConfig calls:\n');
      updateConfigMessages.forEach(m => {
        console.log(`   [${(m.timestamp / 1000).toFixed(1)}s] ${m.text}`);
      });
    }
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  });
});
