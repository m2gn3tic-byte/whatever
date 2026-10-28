import {test,expect} from '@playwright/test';
import {getLevel} from '../src/engine.js';
import {mkdir} from 'node:fs/promises';

test('desktop and mobile share a 9:16 game stage with every late-level item reachable',async ({page}) => {
  await page.addInitScript(() => localStorage.setItem('mahub-kull-v1',JSON.stringify({
    current:22,completed:Array.from({length:22},(_,i)=>i),games:{},sound:false,
  })));
  await page.goto('/');
  await expect(page.getByRole('heading',{name:/Kohver 23/})).toBeVisible();
  await expect(page.locator('.tray-piece')).toHaveCount(getLevel(22).pieces.length);
  const bounds=await page.locator('#app').boundingBox();
  expect(bounds.width/bounds.height).toBeCloseTo(9/16,3);
  for(const selector of ['.site-header','.game-heading','.discovery-banner','#board','#tray','.controls','.site-footer']) {
    const rect=await page.locator(selector).boundingBox();
    expect(rect.width,selector).toBeGreaterThan(0);
    expect(rect.height,selector).toBeGreaterThan(0);
    expect(rect.x,selector).toBeGreaterThanOrEqual(bounds.x-1);
    expect(rect.y+rect.height,selector).toBeLessThanOrEqual(bounds.y+bounds.height+1);
  }
  const tray=await page.locator('#tray').boundingBox();
  const controls=await page.locator('.controls').boundingBox();
  expect(tray.y+tray.height).toBeLessThanOrEqual(controls.y);
  for(const rect of await page.locator('.tray-piece').evaluateAll(nodes=>nodes.map(node=>{
    const r=node.getBoundingClientRect();return {top:r.top,bottom:r.bottom,height:r.height};
  }))) {
    expect(rect.top).toBeGreaterThanOrEqual(tray.y-1);
    expect(rect.bottom).toBeLessThanOrEqual(tray.y+tray.height+1);
    expect(rect.height).toBeGreaterThanOrEqual(44);
  }
});

test('new item is introduced on the next level and appears in the collection',async ({page}) => {
  await page.goto('/');
  await page.getByRole('button',{name:'Esemekogu',exact:true}).click();
  await expect(page.locator('[data-collection-item]')).toHaveCount(18);
  await expect(page.locator('[data-unlocked="true"]')).toHaveCount(4);
  await expect(page.locator('[data-collection-item="console"]')).toHaveAttribute('data-unlocked','false');
  await page.getByRole('button',{name:'Sulge',exact:true}).click();
  for(let i=0;i<6 && await page.locator('.tray-piece').count();i++) await page.locator('[data-action="hint"]').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.locator('[data-action="next"]').click();
  await expect(page.locator('.discovery-banner')).toContainText('Uus ese: Mängukonsool');
  await page.getByRole('button',{name:'Esemekogu',exact:true}).click();
  await expect(page.locator('[data-unlocked="true"]')).toHaveCount(5);
  await expect(page.locator('[data-collection-item="console"]')).toHaveAttribute('data-unlocked','true');
});

test('previous campaign achievements survive new level layouts without restoring stale placements',async ({page}) => {
  await page.addInitScript(()=>localStorage.setItem('mahub-kull-v1',JSON.stringify({
    completed:[0,1,2],current:3,sound:false,games:{'level-4':{moves:50,hints:10,placements:{'shirt-1':{x:0,y:0,rotation:0}}}},
  })));
  await page.goto('/');
  await expect(page.getByRole('heading',{name:/Kohver 04/})).toBeVisible();
  await expect(page.locator('.packed-piece')).toHaveCount(0);
  const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('mahub-kull-v1')));
  expect(stored.completed).toEqual([0,1,2]);
  expect(stored.games['level-4'].revision).toBe(2);
  expect(stored.games['level-4'].moves).toBe(0);
});

test('portrait reference screenshot exports at exactly 1080 by 1920 pixels',async ({browser},info) => {
  test.skip(info.project.name!=='desktop','one reference image is sufficient');
  const context=await browser.newContext({viewport:{width:1280,height:1000},deviceScaleFactor:2});
  try {
    const page=await context.newPage();
    await page.addInitScript(()=>localStorage.setItem('mahub-kull-v1',JSON.stringify({
      current:22,completed:Array.from({length:22},(_,i)=>i),games:{},sound:false,
    })));
    await page.goto('http://127.0.0.1:5173');
    await expect(page.locator('#board')).toBeVisible();
    for(let i=0;i<3;i++) await page.locator('[data-action="hint"]').click();
    await expect(page.locator('#toast')).not.toHaveClass(/visible/);
    expect(await page.locator('#app').evaluate(node=>node.scrollTop)).toBe(0);
    await mkdir('artifacts',{recursive:true});
    const png=await page.locator('#app').screenshot({path:'artifacts/mahub-portrait-1080x1920.png'});
    expect(png.readUInt32BE(16)).toBe(1080);
    expect(png.readUInt32BE(20)).toBe(1920);
  } finally {await context.close();}
});
