import { test,expect } from '@playwright/test';
test.use({baseURL:'http://127.0.0.1:4273'});

test('web playtest loads from its repository path and stays playable offline',async ({page,context}) => {
  const failed = [],errors = [],unexpected = [];
  page.on('pageerror',error => errors.push(error.message));
  page.on('requestfailed',req => failed.push(req.url()));
  page.on('request',req => {
    const url = new URL(req.url());
    if (url.protocol.startsWith('http') && !url.pathname.startsWith('/whatever/')) unexpected.push(url.pathname);
  });
  await page.goto('/whatever/');
  await expect(page.locator('#board')).toBeVisible();
  const href = await page.locator('.sprite image').first().getAttribute('href');
  expect(href).toBe('/whatever/assets/items.png');
  const icon = await page.locator('link[rel="icon"]').getAttribute('href');
  expect(icon).toBe('/whatever/icon.svg');
  const scope = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) await new Promise(resolve => navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true}));
    return registration.scope;
  });
  expect(new URL(scope).pathname).toBe('/whatever/');
  const manifest = await (await page.request.get('/whatever/manifest.webmanifest')).json();
  expect(new URL(manifest.start_url,page.url()).pathname).toBe('/whatever/');
  expect(unexpected).toEqual([]);
  expect(failed).toEqual([]);
  await page.locator('[data-action="hint"]').click();
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('.packed-piece')).toHaveCount(1);
  const art = await page.evaluate(() => new Promise(resolve => {
    const image = new Image();
    image.onload = () => resolve(image.naturalWidth);
    image.onerror = () => resolve(0);
    image.src = document.querySelector('.sprite image').getAttribute('href');
  }));
  expect(art).toBe(1536);
  for (let i=0;i<6 && await page.locator('.tray-piece').count();i++) await page.locator('[data-action="hint"]').click();
  await expect(page.getByRole('dialog')).toContainText('Mahubki küll!');
  await page.locator('[data-action="next"]').click();
  await expect(page.getByRole('heading',{name:/Kohver 02/})).toBeVisible();
  expect(errors).toEqual([]);
});

test('a failed game script shows recovery instructions instead of an empty page',async ({page}) => {
  await page.route('**/assets/index-*.js',route => route.abort());
  await page.goto('/whatever/');
  await expect(page.getByRole('heading',{name:'Mahub küll!'})).toBeVisible();
  await expect(page.locator('#boot-message')).toHaveText('Mängu avamine ei õnnestunud.');
  await expect(page.locator('#boot-help')).toBeVisible();
});
