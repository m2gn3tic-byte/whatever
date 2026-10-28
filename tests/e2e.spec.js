import { test, expect } from '@playwright/test';
import { getLevel, getDailyLevel, rotateDimensions } from '../src/engine.js';

const STORAGE = 'mahub-kull-v1';
const action = (page, name) => page.locator(`[data-action="${name}"]`).filter({ visible: true }).first();
const piece = (page, id) => page.locator(`[data-piece="${id}"]`);
const state = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), STORAGE);
const tap = (locator, info) => info.project.use.hasTouch ? locator.tap() : locator.click();

async function chooseAndPlace(page, info, level, item, placement) {
  let current = Number(await piece(page, item.id).getAttribute('data-rotation'));
  await tap(piece(page, item.id), info);
  while (current % 180 !== placement.rotation % 180) {
    await tap(action(page, 'rotate'), info);
    current = (current + 90) % 360;
  }
  const index = placement.y * level.cols + placement.x;
  await tap(page.locator(`[data-cell="${index}"]`), info);
  await expect(piece(page, item.id)).toHaveClass(/packed-piece/);
}

async function gesture(page, info, source, destination) {
  await source.scrollIntoViewIfNeeded();
  const box = await source.boundingBox();
  const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const end = await destination();
  if (info.project.use.hasTouch) {
    const session = await page.context().newCDPSession(page);
    const point = (x, y) => [{ x, y, id: 1, radiusX: 5, radiusY: 5 }];
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: point(start.x, start.y) });
    for (let step = 1; step <= 10; step += 1) {
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: point(start.x + (end.x - start.x) * step / 10, start.y + (end.y - start.y) * step / 10),
      });
    }
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await session.detach();
  } else {
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(end.x, end.y, { steps: 10 });
    await page.mouse.up();
  }
}

async function dragToBoard(page, info, level, item, x, y, rotation = 0) {
  return gesture(page, info, piece(page, item.id), async () => {
    const board = await page.locator('#board').boundingBox();
    const size = rotateDimensions(item, rotation);
    return {
      x: board.x + (x + size.w / 2) * board.width / level.cols,
      y: board.y + (y + size.h / 2) * board.height / level.rows,
    };
  });
}

async function finishWithHints(page, info) {
  // Each hint visibly places a real piece; completion is asserted through UI.
  for (let step = 0; step < 18 && await page.locator('.tray-piece').count(); step += 1) {
    await tap(action(page, 'hint'), info);
  }
  await expect(page.locator('.tray-piece')).toHaveCount(0);
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('dialog').getByRole('heading')).toHaveText(/Mahubki küll|kohvrimeister/);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#board')).toBeVisible();
});

test('game loads its artwork and fits the viewport', async ({ page }, info) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.reload();
  await expect(page.getByRole('heading', { name: /Kohver 01/ })).toBeVisible();
  await expect(page.locator('#board .cell')).toHaveCount(16);
  await expect(page.locator('.tray-piece')).toHaveCount(4);
  await expect(page.locator('#packing-count')).toHaveText('0 / 4 pakitud');
  const art = await page.evaluate(() => new Promise(resolve => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => resolve(null);
    image.src = '/assets/items.png';
  }));
  expect(art?.width).toBeGreaterThan(300);
  expect(art?.height).toBeGreaterThan(200);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
  await page.screenshot({ path: `/tmp/mahub-${info.project.name}-e2e.png`, fullPage: true });
});

test('dragging places pieces, rejects collisions, and returns packed pieces to the tray', async ({ page }, info) => {
  const level = getLevel(0);
  const [first, second] = level.pieces;
  await dragToBoard(page, info, level, first, 0, 0);
  await expect(piece(page, first.id)).toHaveClass(/packed-piece/);
  expect((await state(page)).games[level.id].placements[first.id]).toMatchObject({ x: 0, y: 0 });
  await dragToBoard(page, info, level, second, 0, 0);
  await expect(piece(page, second.id)).toHaveClass(/tray-piece/);
  await expect(page.locator('#toast')).toContainText('Siia veel ei mahu');
  expect(Object.keys((await state(page)).games[level.id].placements)).toHaveLength(1);
  await gesture(page, info, piece(page, first.id), async () => {
    const tray = await page.locator('#tray').boundingBox();
    return { x: tray.x + tray.width / 2, y: tray.y + tray.height / 2 };
  });
  await expect(page.locator('.packed-piece')).toHaveCount(0);
  await expect(page.locator('.tray-piece')).toHaveCount(4);
  await expect(page.locator('.drag-ghost')).toHaveCount(0);
});

test('click placement, undo, and confirmed reset change the actual saved game', async ({ page }, info) => {
  const level = getLevel(0), item = level.pieces[0];
  await chooseAndPlace(page, info, level, item, level.solution[item.id]);
  await expect(page.locator('#packing-count')).toHaveText('1 / 4 pakitud');
  await tap(action(page, 'undo'), info);
  await expect(page.locator('.packed-piece')).toHaveCount(0);
  await expect(action(page, 'undo')).toBeDisabled();
  await chooseAndPlace(page, info, level, item, level.solution[item.id]);
  await tap(action(page, 'reset'), info);
  await expect(page.getByRole('dialog')).toContainText('Proovime algusest?');
  await tap(page.getByRole('button', { name: 'Jätkan siits' }), info);
  await expect(page.locator('.packed-piece')).toHaveCount(1);
  await tap(action(page, 'reset'), info);
  await tap(action(page, 'confirm-reset'), info);
  await expect(page.locator('.packed-piece')).toHaveCount(0);
  expect((await state(page)).games[level.id].placements).toEqual({});
  await tap(action(page, 'undo'), info);
  await expect(page.locator('.packed-piece')).toHaveCount(1);
});

test('hints complete a level, unlock the next, and restore partial progress on reload', async ({ page }, info) => {
  await finishWithHints(page, info);
  expect((await state(page)).completed).toContain(0);
  await tap(action(page, 'next'), info);
  await expect(page.getByRole('heading', { name: /Kohver 02/ })).toBeVisible();
  const level = getLevel(1), item = level.pieces[0];
  await chooseAndPlace(page, info, level, item, level.solution[item.id]);
  const before = (await state(page)).games[level.id];
  await page.reload();
  await expect(page.getByRole('heading', { name: /Kohver 02/ })).toBeVisible();
  await expect(piece(page, item.id)).toHaveClass(/packed-piece/);
  expect((await state(page)).games[level.id]).toEqual(before);
  await tap(action(page, 'levels'), info);
  await expect(page.locator('[data-level="0"]')).toBeEnabled();
  await expect(page.locator('[data-level="1"]')).toBeEnabled();
  await expect(page.locator('[data-level="2"]')).toBeDisabled();
});

test('rotation changes a rectangular piece footprint and can be undone', async ({ page }, info) => {
  await finishWithHints(page, info);
  await tap(action(page, 'next'), info);
  const level = getLevel(1), item = level.pieces.find(candidate => candidate.type === 'console');
  await tap(piece(page, item.id), info);
  await expect(action(page, 'rotate')).toBeEnabled();
  await tap(action(page, 'rotate'), info);
  await expect(piece(page, item.id)).toHaveAttribute('data-rotation', '90');
  await expect(piece(page, item.id)).toHaveAccessibleName(/1 korda 2/);
  await tap(page.locator('[data-cell="0"]'), info);
  await expect(piece(page, item.id)).toHaveClass(/packed-piece/);
  expect((await state(page)).games[level.id].placements[item.id]).toEqual({ x: 0, y: 0, rotation: 90 });
  await expect.poll(async () => piece(page, item.id).evaluate(element => {
    const footprint = element.getBoundingClientRect();
    const visual = element.querySelector('.piece-visual').getBoundingClientRect();
    return visual.left >= footprint.left - 1 && visual.right <= footprint.right + 1
      && visual.top >= footprint.top - 1 && visual.bottom <= footprint.bottom + 1;
  })).toBe(true);
  await tap(action(page, 'undo'), info);
  await expect(piece(page, item.id)).toHaveClass(/tray-piece/);
  await expect(piece(page, item.id)).toHaveAttribute('data-rotation', '90');
  await tap(action(page, 'undo'), info);
  await expect(piece(page, item.id)).toHaveAttribute('data-rotation', '0');
});

test('locked levels, instructions, and sound controls are functional', async ({ page }, info) => {
  await tap(action(page, 'levels'), info);
  await expect(page.locator('.level-tile')).toHaveCount(24);
  await expect(page.locator('[data-level="0"]')).toBeEnabled();
  await expect(page.locator('[data-level="1"]')).toBeDisabled();
  await tap(page.getByRole('button', { name: 'Sulge', exact: true }), info);
  await tap(page.getByRole('button', { name: 'Kuidas mängida' }), info);
  await expect(page.getByRole('dialog')).toContainText('Vali ja lohista');
  await expect(page.getByRole('dialog')).toContainText('Keera teistpidi');
  await tap(page.getByRole('button', { name: /Proovime järele/ }), info);
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await tap(page.getByRole('button', { name: 'Lülita heli välja' }), info);
  await expect(page.getByRole('button', { name: 'Lülita heli sisse' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Lülita heli sisse' })).toBeVisible();
  expect((await state(page)).sound).toBe(false);
});

test('daily puzzle is reachable, solvable, and leaves campaign progress intact', async ({ page }, info) => {
  if (!await action(page, 'daily').isVisible()) await tap(action(page, 'levels'), info);
  await tap(action(page, 'daily'), info);
  await expect(page.getByRole('heading', { name: /Päeva kohver/ })).toBeVisible();
  const date = await page.evaluate(() => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Tallinn' }).format(new Date()));
  const daily = getDailyLevel(date);
  await expect(page.locator('#board .cell')).toHaveCount(daily.cols * daily.rows);
  await finishWithHints(page, info);
  await expect(page.getByRole('dialog')).toContainText('PÄEVA KOHVER PAKITUD');
  const saved = await state(page);
  expect(saved.daily).toBe(date);
  expect(saved.completed).toEqual([]);
  await tap(page.getByRole('button', { name: /Tagasi reisile/ }), info);
  await expect(page.getByRole('heading', { name: /Kohver 01/ })).toBeVisible();
});

test('a completed suitcase can continue the journey after a reload', async ({ page }, info) => {
  await finishWithHints(page, info);
  await page.reload();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.locator('.packed-piece')).toHaveCount(getLevel(0).pieces.length);
  await tap(action(page, 'show-win'), info);
  await expect(page.getByRole('dialog')).toBeVisible();
  await tap(action(page, 'next'), info);
  await expect(page.getByRole('heading', { name: /Kohver 02/ })).toBeVisible();
});
