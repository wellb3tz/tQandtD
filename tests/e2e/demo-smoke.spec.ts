import { expect, test } from '@playwright/test';

test('demo loads and can generate a world', async ({ page }) => {
  const runtimeErrors: string[] = [];

  page.on('pageerror', error => {
    runtimeErrors.push(error.message);
  });

  page.on('console', message => {
    if (message.type() === 'error') {
      runtimeErrors.push(message.text());
    }
  });

  await page.goto('/');

  await expect(page.locator('#viewer')).toBeVisible();
  await page.locator('#control-panel .section-header.clickable').first().click();
  await expect(page.locator('#generate-btn')).toBeVisible();
  await expect(page.locator('canvas').first()).toBeVisible({ timeout: 15_000 });

  await page.locator('#seed-input').fill('424242');
  await page.locator('#generate-btn').click();

  await expect(page.locator('#loading-indicator')).toHaveClass(/hidden/, { timeout: 30_000 });
  await expect(page.locator('#status-seed')).toContainText('424242', { timeout: 10_000 });
  await expect
    .poll(async () => Number((await page.locator('#status-chunks').innerText()).match(/\d+/)?.[0] ?? 0), {
      timeout: 10_000,
    })
    .toBeGreaterThan(0);

  expect(runtimeErrors).toEqual([]);
});

test('secondary UI panels start hidden and can be toggled', async ({ page }) => {
  test.setTimeout(60_000);

  await page.goto('/');

  await expect(page.locator('#control-panel .panel-section').first()).toHaveClass(/collapsed/);
  await expect(page.locator('#generate-btn')).toBeHidden();
  await expect(page.locator('#performance-monitor')).toHaveClass(/hidden/);
  await expect(page.locator('#world-statistics')).toHaveClass(/hidden/);

  await page.locator('#control-panel .section-header.clickable').first().click();
  await expect(page.locator('#generate-btn')).toBeVisible();

  await page.locator('#toggle-monitor-btn').click();
  await expect(page.locator('#performance-monitor')).not.toHaveClass(/hidden/);

  await page.locator('#toggle-statistics-btn').click();
  await expect(page.locator('#world-statistics')).not.toHaveClass(/hidden/);

  await page.locator('#hide-statistics-btn').click();
  await expect(page.locator('#world-statistics')).toHaveClass(/hidden/);
});
