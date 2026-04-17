---
inclusion: manual
---

# Playwright E2E Testing Best Practices

## When to Use Playwright

### ✅ Use Playwright for:

1. **Browser-Specific Features**
   - Web Workers
   - localStorage/sessionStorage
   - IndexedDB
   - Service Workers
   - Browser APIs (Notification, Geolocation, etc.)

2. **UI Interactions**
   - Button clicks
   - Form inputs
   - Navigation
   - Drag and drop
   - Keyboard events

3. **Console Output Verification**
   - Logging patterns
   - Error messages
   - Debug output
   - Performance metrics

4. **Real Browser Behavior**
   - Timing-sensitive operations
   - Race conditions
   - Memory leaks
   - Performance issues
   - Resource loading

5. **Integration Testing**
   - Multiple components working together
   - Full user workflows
   - End-to-end scenarios

### ❌ Don't Use Playwright for:

1. **Pure Logic Testing**
   - Mathematical calculations
   - Data transformations
   - Algorithm correctness
   - → Use Vitest unit tests instead

2. **Fast Feedback Loops**
   - TDD development
   - Quick iterations
   - → Use Vitest for speed

3. **Isolated Component Testing**
   - Single function behavior
   - Class methods
   - → Use Vitest with mocks

## Playwright Test Structure

### Basic Template

```typescript
import { test, expect } from '@playwright/test';

test.describe('Feature Name', () => {
  test('should verify specific behavior', async ({ page }) => {
    // Setup: Capture console messages
    const consoleMessages: string[] = [];
    page.on('console', msg => {
      consoleMessages.push(msg.text());
      console.log(`[BROWSER] ${msg.text()}`);
    });

    // Navigate to app
    await page.goto('http://localhost:3001/');
    await page.waitForTimeout(2000); // Wait for initialization

    // Perform actions
    const element = page.locator('#element-id');
    await element.click();
    await page.waitForTimeout(1000);

    // Verify behavior
    expect(consoleMessages).toContain('[Expected message]');
  });
});
```

### Console Observation Template

```typescript
test('should observe console output', async ({ page }) => {
  const consoleMessages: Array<{ timestamp: number; text: string }> = [];
  const startTime = Date.now();
  
  page.on('console', msg => {
    const timestamp = Date.now() - startTime;
    consoleMessages.push({ timestamp, text: msg.text() });
    console.log(`[${(timestamp / 1000).toFixed(1)}s] ${msg.text()}`);
  });

  await page.goto('http://localhost:3001/');
  
  // Perform action
  await page.locator('#button').click();
  
  // Wait and observe
  await page.waitForTimeout(5000);
  
  // Analyze messages
  const criticalMessages = consoleMessages.filter(m => 
    m.text.includes('[Critical]')
  );
  
  expect(criticalMessages).toHaveLength(1);
});
```

## Configuration

### playwright.config.ts

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3001',
    trace: 'on-first-retry',
    headless: false, // Show browser for debugging
    viewport: { width: 1280, height: 720 },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run demo',
    url: 'http://localhost:3001',
    reuseExistingServer: true,
    timeout: 30000,
  },
});
```

## Best Practices

### 1. Console Message Capture

Always capture console messages for debugging:

```typescript
const consoleMessages: string[] = [];
page.on('console', msg => {
  consoleMessages.push(msg.text());
  console.log(`[BROWSER CONSOLE] ${msg.text()}`);
});
```

### 2. Timestamps for Timing Analysis

Add timestamps to understand timing patterns:

```typescript
const startTime = Date.now();
page.on('console', msg => {
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`[${elapsed}s] ${msg.text()}`);
});
```

### 3. Wait Strategies

Use appropriate wait strategies:

```typescript
// Wait for element
await page.waitForSelector('#element');

// Wait for navigation
await page.waitForURL('**/path');

// Wait for network idle
await page.goto('url', { waitUntil: 'networkidle' });

// Wait for specific time (use sparingly)
await page.waitForTimeout(1000);
```

### 4. Error Handling

Capture and log errors:

```typescript
page.on('pageerror', error => {
  console.error('[PAGE ERROR]', error);
});

page.on('console', msg => {
  if (msg.type() === 'error') {
    console.error('[CONSOLE ERROR]', msg.text());
  }
});
```

### 5. Cleanup

Always clean up resources:

```typescript
test.afterEach(async ({ page }) => {
  await page.close();
});
```

## Real-World Example: Worker Pool Bug

### The Problem

Unit tests showed the fix worked (shutdown() was called), but Playwright revealed the real issue:

```typescript
test('should observe Worker Pool behavior', async ({ page }) => {
  const consoleMessages: string[] = [];
  page.on('console', msg => consoleMessages.push(msg.text()));

  await page.goto('http://localhost:3001/');
  await page.locator('#enableWorkerPool').check();
  await page.waitForTimeout(10000);

  // Unit tests: Expected 1 initialization
  // Reality: Found 90 initializations!
  const initMessages = consoleMessages.filter(m => 
    m.includes('Successfully initialized')
  );
  
  console.log(`Initializations: ${initMessages.length}`);
  // Output: 90 (not 1!)
});
```

### The Discovery

Playwright revealed:
1. WorkerPool was created 90 times (not 1)
2. Workers were creating their own WorkerPools (recursion!)
3. This happened because `workerPoolConfig` was sent to workers

### The Fix

```typescript
// Remove workerPoolConfig before sending to workers
const { workerPoolConfig, ...configWithoutWorkerPool } = config.worldConfig;
worker.postMessage({
  type: 'init',
  config: configWithoutWorkerPool,
});
```

### Verification

After fix, Playwright confirmed:
```
Initializations: 1 ✅
```

## Common Patterns

### Pattern 1: Toggle Testing

```typescript
test('should handle toggle correctly', async ({ page }) => {
  await page.goto('http://localhost:3001/');
  
  const checkbox = page.locator('#feature-toggle');
  
  // Enable
  await checkbox.check();
  await page.waitForTimeout(500);
  // Verify enabled state
  
  // Disable
  await checkbox.uncheck();
  await page.waitForTimeout(500);
  // Verify disabled state
  
  // Re-enable
  await checkbox.check();
  await page.waitForTimeout(500);
  // Verify re-enabled state
});
```

### Pattern 2: Multiple Cycles

```typescript
test('should handle multiple cycles', async ({ page }) => {
  await page.goto('http://localhost:3001/');
  
  const checkbox = page.locator('#feature');
  
  for (let i = 0; i < 5; i++) {
    await checkbox.uncheck();
    await page.waitForTimeout(500);
    
    await checkbox.check();
    await page.waitForTimeout(500);
  }
  
  // Verify no degradation after multiple cycles
});
```

### Pattern 3: Message Pattern Verification

```typescript
test('should show expected message pattern', async ({ page }) => {
  const messages: string[] = [];
  page.on('console', msg => messages.push(msg.text()));
  
  await page.goto('http://localhost:3001/');
  await page.locator('#action').click();
  await page.waitForTimeout(1000);
  
  // Verify message sequence
  expect(messages[0]).toContain('[Step 1]');
  expect(messages[1]).toContain('[Step 2]');
  expect(messages[2]).toContain('[Step 3]');
});
```

## Debugging Tips

### 1. Visual Debugging

Set `headless: false` to see the browser:

```typescript
use: {
  headless: false,
}
```

### 2. Slow Motion

Add slow motion to see actions:

```typescript
use: {
  launchOptions: {
    slowMo: 1000, // 1 second delay between actions
  },
}
```

### 3. Screenshots

Take screenshots at key points:

```typescript
await page.screenshot({ path: 'screenshot.png' });
```

### 4. Video Recording

Enable video recording:

```typescript
use: {
  video: 'on',
}
```

### 5. Trace Viewer

Use trace viewer for debugging:

```typescript
use: {
  trace: 'on',
}
```

Then view with:
```bash
npx playwright show-trace trace.zip
```

## Performance Testing

### Memory Leak Detection

```typescript
test('should not leak memory', async ({ page }) => {
  await page.goto('http://localhost:3001/');
  
  // Get initial memory
  const initialMemory = await page.evaluate(() => 
    (performance as any).memory?.usedJSHeapSize
  );
  
  // Perform operations
  for (let i = 0; i < 10; i++) {
    await page.locator('#toggle').click();
    await page.waitForTimeout(500);
  }
  
  // Force garbage collection (if available)
  await page.evaluate(() => {
    if ((window as any).gc) {
      (window as any).gc();
    }
  });
  
  // Get final memory
  const finalMemory = await page.evaluate(() => 
    (performance as any).memory?.usedJSHeapSize
  );
  
  const memoryGrowth = finalMemory - initialMemory;
  console.log(`Memory growth: ${(memoryGrowth / 1024 / 1024).toFixed(2)} MB`);
  
  // Verify memory growth is acceptable
  expect(memoryGrowth).toBeLessThan(100 * 1024 * 1024); // < 100MB
});
```

## Integration with CI/CD

### GitHub Actions

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npm run test:e2e
```

## Summary

### Decision Matrix

| Scenario | Tool | Reason |
|----------|------|--------|
| Pure logic | Vitest | Fast, isolated |
| Browser API | Playwright | Real browser |
| UI interaction | Playwright | Real user behavior |
| Console output | Playwright | Real console |
| Memory leak | Playwright | Real memory usage |
| Integration | Playwright | Full system |
| Unit test | Vitest | Fast feedback |

### Key Takeaway

**Unit tests verify code correctness. Playwright verifies real-world behavior.**

Use both for comprehensive testing!
