import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { readFile } from 'node:fs/promises';
import { getLevel } from '../src/engine.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const file = resolve(root, 'artifacts', 'Mahub-kull.html');
// The managed browser blocks file:// navigation by administrator policy.
// Deliver the exact exported bytes as the one document request, then disable
// networking: the game still must work without any other assets or services.
const url = 'http://127.0.0.1:4173/Mahub-kull.html';
let html;
const records = new WeakMap();
const action = (page, name) => page.locator(`[data-action="${name}"]`).filter({ visible:true }).first();
const tap = (locator, info) => info.project.use.hasTouch ? locator.tap() : locator.click();

test.beforeAll(async () => {
  try { html = await readFile(file,'utf8'); }
  catch { throw new Error('Run npm run build:standalone before standalone tests.'); }
});
test.beforeEach(async ({page,context}) => {
  const record = {errors:[],external:[]};
  records.set(page,record);
  page.on('pageerror',error => record.errors.push(error.message));
  page.on('request',request => {
    const requested = new URL(request.url());
    if (['http:','https:','file:'].includes(requested.protocol)
      && requested.href !== url) record.external.push(requested.href);
  });
  await page.route(url,route => route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:html}));
  await context.setOffline(true);
  await page.goto(url);
  await expect(page.locator('#board')).toBeVisible();
});
test.afterEach(async ({page}) => {
  expect(records.get(page).errors,'standalone JavaScript errors').toEqual([]);
  expect(records.get(page).external,'standalone must not request external assets').toEqual([]);
});

test('exported HTML renders with embedded artwork and no asset requests',async ({page},info) => {
  await expect(page.locator('html')).toHaveAttribute('data-standalone','');
  await expect(page.locator('link[rel="manifest"],script[src],link[rel="stylesheet"]')).toHaveCount(0);
  await expect(page.getByRole('heading',{name:/Kohver 01/})).toBeVisible();
  const loaded = await page.evaluate(async () => {
    const entries=Object.entries(window.__MAHUB_ASSETS__);
    if(entries.length!==2) return false;
    const sizes={items:[1536,1024],travel:[1448,1086]};
    const checks=await Promise.all(entries.map(([key,source]) => new Promise(resolve => {
      if(!source.startsWith('data:image/png;base64,')) return resolve(false);
      const image=new Image();
      image.onload=() => resolve(image.naturalWidth===sizes[key][0] && image.naturalHeight===sizes[key][1]);
      image.onerror=() => resolve(false);
      image.src=source;
    })));
    return checks.every(Boolean);
  });
  expect(loaded).toBe(true);
  expect(await page.locator('link[rel="icon"]').getAttribute('href')).toMatch(/^data:image\/svg\+xml;base64,/);
  await page.getByRole('button',{name:'Mahub küll! avaleht'}).click();
  await expect(page).toHaveURL(url);
  await page.screenshot({path:`/tmp/mahub-standalone-${info.project.name}.png`,fullPage:true});
});

test('portable game supports packing, completion, progression, reset and daily puzzles',async ({page},info) => {
  const level = getLevel(0),item = level.pieces[0],placement = level.solution[item.id];
  await tap(page.locator(`[data-piece="${item.id}"]`),info);
  await tap(page.locator(`[data-cell="${placement.y * level.cols + placement.x}"]`),info);
  await expect(page.locator('.packed-piece')).toHaveCount(1);
  await page.reload();
  await expect(page.locator('.packed-piece')).toHaveCount(1);
  for (let step=0;step<12 && await page.locator('.tray-piece').count();step++) await tap(action(page,'hint'),info);
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('dialog')).toContainText('Mahubki küll!');
  await tap(action(page,'next'),info);
  await expect(page.getByRole('heading',{name:/Kohver 02/})).toBeVisible();
  await tap(action(page,'hint'),info);
  await expect(page.locator('.packed-piece')).toHaveCount(1);
  await tap(action(page,'reset'),info);
  await tap(action(page,'confirm-reset'),info);
  await expect(page.locator('.packed-piece')).toHaveCount(0);
  if (!await action(page,'daily').isVisible()) await tap(action(page,'levels'),info);
  await tap(action(page,'daily'),info);
  await expect(page.getByRole('heading',{name:/Päeva kohver/})).toBeVisible();
  await tap(action(page,'hint'),info);
  await expect(page.locator('.packed-piece')).toHaveCount(1);
  await expect(page).toHaveURL(url);
});
