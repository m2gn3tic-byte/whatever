import test from 'node:test';
import assert from 'node:assert/strict';
import { ITEM_TYPES, LEVEL_COUNT, getLevel, getDailyLevel, rotateDimensions, validatePlacement, isComplete, getHint } from '../src/engine.js';

function applyHint(placements, hint) {
  const result = structuredClone(placements);
  for (const id of hint.displacedIds) delete result[id];
  result[hint.pieceId] = { x: hint.x, y: hint.y, rotation: hint.rotation };
  return result;
}

function assertSolvable(level) {
  const placements = {};
  for (const piece of level.pieces) {
    const position = level.solution[piece.id];
    assert.equal(validatePlacement(level, placements, piece.id, position.x, position.y, position.rotation), true, `${level.id}: ${piece.id}`);
    placements[piece.id] = position;
  }
  assert.equal(isComplete(level, placements), true);
  assert.equal(level.pieces.reduce((area, piece) => area + piece.w * piece.h, 0), level.cols * level.rows);
}

test('all 24 campaign levels tile the board without overlap and include every art type', () => {
  const seen = new Set();
  assert.equal(LEVEL_COUNT, 24);
  for (let index = 0; index < LEVEL_COUNT; index += 1) {
    const level = getLevel(index);
    assert.ok(level.cols >= 4 && level.cols <= 6);
    assert.ok(level.rows >= 4 && level.rows <= 6);
    assertSolvable(level);
    level.pieces.forEach(piece => seen.add(piece.type));
  }
  assert.deepEqual([...seen].sort(), Object.keys(ITEM_TYPES).sort());
});

test('level generation is deterministic and returns independently mutable objects', () => {
  const first = getLevel(9);
  assert.deepEqual(first, getLevel(9));
  first.pieces.pop();
  first.solution = {};
  assertSolvable(getLevel(9));
  for (const index of [-1, LEVEL_COUNT, 1.1, NaN, '1']) assert.throws(() => getLevel(index), RangeError);
});

test('rotation supports degrees and quarter turns; bad dimensions and angles are rejected', () => {
  const piece = ITEM_TYPES.shirt;
  assert.deepEqual(rotateDimensions(piece, 0), { w: 3, h: 2 });
  assert.deepEqual(rotateDimensions(piece, 90), { w: 2, h: 3 });
  assert.deepEqual(rotateDimensions(piece, 1), { w: 2, h: 3 });
  assert.deepEqual(rotateDimensions(piece, 180), { w: 3, h: 2 });
  assert.deepEqual(rotateDimensions(piece, -90), { w: 2, h: 3 });
  assert.equal(rotateDimensions(piece, 45), null);
  assert.equal(rotateDimensions({ w: 0, h: 2 }, 0), null);
});

test('placement rejects edges, overlaps, fractional cells and invalid rotations', () => {
  const level = getLevel(0);
  const [first, second] = level.pieces;
  assert.equal(validatePlacement(level, {}, first.id, -1, 0, 0), false);
  assert.equal(validatePlacement(level, {}, first.id, 3, 0, 0), false);
  assert.equal(validatePlacement(level, {}, first.id, 0, 3, 0), false);
  assert.equal(validatePlacement(level, {}, first.id, 0.2, 0, 0), false);
  assert.equal(validatePlacement(level, {}, first.id, 0, 0, 45), false);
  assert.equal(validatePlacement(level, {}, 'missing-piece', 0, 0, 0), false);
  const state = { [first.id]: { x: 0, y: 0, rotation: 0 } };
  assert.equal(validatePlacement(level, state, second.id, 1, 1, 0), false);
  assert.equal(validatePlacement(level, state, second.id, 2, 0, 0), true);
  assert.equal(validatePlacement(level, state, first.id, 0, 0, 0), true);
});

test('completion requires every piece placed legally, including alternatives to reference', () => {
  const level = getLevel(0);
  assert.equal(isComplete(level, {}), false);
  const placements = structuredClone(level.solution);
  const [first, second] = level.pieces;
  delete placements[first.id];
  assert.equal(isComplete(level, placements), false);
  placements[first.id] = placements[second.id];
  assert.equal(isComplete(level, placements), false);
  const swapped = structuredClone(level.solution);
  [swapped[first.id], swapped[second.id]] = [swapped[second.id], swapped[first.id]];
  assert.equal(isComplete(level, swapped), true);
});

test('hints finish every campaign level and preserve the input state', () => {
  for (let index = 0; index < LEVEL_COUNT; index += 1) {
    const level = getLevel(index);
    let placements = {};
    for (let step = 0; step < level.pieces.length + 1 && !isComplete(level, placements); step += 1) {
      const before = structuredClone(placements);
      const hint = getHint(level, placements);
      assert.ok(hint, `hint for ${level.id}`);
      assert.deepEqual(placements, before);
      assert.deepEqual(hint.displacedIds, []);
      assert.equal(validatePlacement(level, placements, hint.pieceId, hint.x, hint.y, hint.rotation), true);
      placements = applyHint(placements, hint);
    }
    assert.equal(isComplete(level, placements), true, `completed ${level.id}`);
    assert.equal(getHint(level, placements), null);
  }
});

test('a solvable non-reference placement is preserved by hints', () => {
  const level = getLevel(0);
  const piece = level.pieces[0];
  const original = level.solution[piece.id];
  const alternative = { x: original.x === 0 ? 2 : 0, y: original.y, rotation: 0 };
  let placements = { [piece.id]: alternative };
  while (!isComplete(level, placements)) {
    const hint = getHint(level, placements);
    assert.deepEqual(hint.displacedIds, []);
    placements = applyHint(placements, hint);
    assert.deepEqual(placements[piece.id], alternative);
  }
});

test('a trapped but valid board gets conflict-aware hints and converges to completion', () => {
  const level = getLevel(0);
  const piece = level.pieces[0];
  // A square in the middle of a 4x4 board leaves strips too thin for squares.
  let placements = { [piece.id]: { x: 1, y: 1, rotation: 0 } };
  assert.equal(validatePlacement(level, {}, piece.id, 1, 1, 0), true);
  let displaced = false;
  for (let step = 0; step < level.pieces.length * 3 && !isComplete(level, placements); step += 1) {
    const hint = getHint(level, placements);
    assert.ok(hint);
    displaced ||= hint.displacedIds.length > 0 || hint.pieceId === piece.id;
    const next = applyHint(placements, hint);
    assert.equal(validatePlacement(level, next, hint.pieceId, hint.x, hint.y, hint.rotation), true);
    placements = next;
  }
  assert.equal(displaced, true);
  assert.equal(isComplete(level, placements), true);
});

test('daily puzzles are stable by date and their solutions are legal', () => {
  assert.deepEqual(getDailyLevel('2026-10-28'), getDailyLevel('2026-10-28'));
  assert.notDeepEqual(getDailyLevel('2026-10-28'), getDailyLevel('2026-10-29'));
  for (const day of ['2026-10-28', '2026-10-29', '2028-02-29', '2026-12-31']) assertSolvable(getDailyLevel(day));
  for (const date of ['yesterday', '2026-02-30', '2026-13-01', '2026-1-1']) assert.throws(() => getDailyLevel(date), TypeError);
});
