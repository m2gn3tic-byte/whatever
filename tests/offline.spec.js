import { test, expect } from '@playwright/test';

test.use({ baseURL: 'http://127.0.0.1:4173' });

test('production game loads and keeps progress offline after its first visit', async ({ page, context }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('#board')).toBeVisible();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise(resolve => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once:true }));
    }
  });
  const cached = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    const cache = await caches.open(`mahub-kull-v2:${new URL(registration.scope).pathname}`);
    return (await cache.keys()).map(request => new URL(request.url).pathname);
  });
  expect(cached).toContain('/assets/items.png');
  expect(cached.some(path => /\/assets\/index-.*\.js$/.test(path))).toBe(true);
  expect(cached.some(path => /\/assets\/index-.*\.css$/.test(path))).toBe(true);
  await page.locator('[data-action="hint"]').click();
  await expect(page.locator('.packed-piece')).toHaveCount(1);
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('#board')).toBeVisible();
  await expect(page.locator('.packed-piece')).toHaveCount(1);
  await expect(page.locator('.tray-piece')).toHaveCount(3);
  const artLoaded = await page.evaluate(() => new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve(img.naturalWidth > 0);
    img.onerror = () => resolve(false);
    img.src = '/assets/items.png';
  }));
  expect(artLoaded).toBe(true);
  await page.locator('[data-action="hint"]').click();
  await expect(page.locator('.packed-piece')).toHaveCount(2);
  expect(errors).toEqual([]);
  await context.setOffline(false);
});
