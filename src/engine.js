/** Pure, deterministic packing-puzzle rules. Coordinates are zero-based cells. */
export const ITEM_TYPES = Object.freeze({
  shirt: Object.freeze({ name: 'T-särk', w: 3, h: 2 }),
  book: Object.freeze({ name: 'Raamat', w: 2, h: 2 }),
  shoes: Object.freeze({ name: 'Tossud', w: 2, h: 3 }),
  dryer: Object.freeze({ name: 'Föön', w: 2, h: 2 }),
  console: Object.freeze({ name: 'Mängukonsool', w: 2, h: 1 }),
  teddy: Object.freeze({ name: 'Kaisukaru', w: 2, h: 2 }),
});

export const LEVEL_COUNT = 24;

const TITLES = [
  'Esimene reis', 'Väike kohver', 'Nädalalõpp', 'Linnapuhkus',
  'Mere äärde', 'Matkarajale', 'Pikk nädalavahetus', 'Rongireis',
  'Päikesepaiste', 'Suvepuhkus', 'Saarele sõit', 'Väike seiklus',
  'Reisikaaslane', 'Suvine väljasõit', 'Veel üks peatus', 'Mälestuste kohver',
  'Kaugele teele', 'Rannapuhkus', 'Pikk reis', 'Uus sihtkoht',
  'Kõik kaasa', 'Viimane suveniir', 'Maailma avastama', 'Kohvrimeister',
];

// Every rectangle is an item's complete cell footprint. These templates tile
// their boards exactly; mirrored and rotated variants retain that guarantee.
const TEMPLATES = [
  { cols: 4, rows: 4, rects: [[0, 0, 2, 2], [2, 0, 2, 2], [0, 2, 2, 2], [2, 2, 2, 2]] },
  { cols: 4, rows: 4, rects: [[0, 0, 2, 2], [2, 0, 2, 2], [0, 2, 2, 1], [2, 2, 2, 1], [0, 3, 2, 1], [2, 3, 2, 1]] },
  { cols: 4, rows: 5, rects: [[0, 0, 2, 3], [2, 0, 2, 3], [0, 3, 2, 2], [2, 3, 2, 2]] },
  { cols: 5, rows: 4, rects: [[0, 0, 3, 2], [0, 2, 3, 2], [3, 0, 2, 2], [3, 2, 2, 2]] },
  { cols: 6, rows: 4, rects: [[0, 0, 3, 2], [3, 0, 3, 2], [0, 2, 3, 2], [3, 2, 3, 2]] },
  { cols: 4, rows: 6, rects: [[0, 0, 2, 3], [2, 0, 2, 3], [0, 3, 2, 3], [2, 3, 2, 3]] },
  { cols: 6, rows: 4, rects: [[0, 0, 2, 2], [2, 0, 2, 2], [4, 0, 2, 2], [0, 2, 2, 2], [2, 2, 2, 2], [4, 2, 2, 2]] },
  { cols: 6, rows: 5, rects: [[0, 0, 2, 3], [2, 0, 2, 3], [4, 0, 2, 3], [0, 3, 3, 2], [3, 3, 3, 2]] },
  { cols: 5, rows: 6, rects: [[0, 0, 3, 2], [0, 2, 3, 2], [0, 4, 3, 2], [3, 0, 2, 3], [3, 3, 2, 3]] },
  { cols: 6, rows: 6, rects: [[0, 0, 3, 2], [3, 0, 3, 2], [0, 2, 3, 2], [3, 2, 3, 2], [0, 4, 3, 2], [3, 4, 3, 2]] },
  { cols: 6, rows: 6, rects: [[0, 0, 2, 2], [2, 0, 2, 2], [4, 0, 2, 2], [0, 2, 3, 2], [3, 2, 3, 2], [0, 4, 2, 2], [2, 4, 2, 2], [4, 4, 2, 2]] },
  { cols: 6, rows: 6, rects: [[0, 0, 2, 3], [0, 3, 2, 3], [2, 0, 2, 2], [4, 0, 2, 2], [2, 2, 2, 2], [4, 2, 2, 2], [2, 4, 2, 2], [4, 4, 2, 2]] },
  { cols: 6, rows: 6, rects: [[0, 0, 2, 2], [0, 2, 2, 2], [0, 4, 2, 2], [2, 0, 2, 3], [4, 0, 2, 3], [2, 3, 2, 2], [4, 3, 2, 2], [2, 5, 2, 1], [4, 5, 2, 1]] },
];
const TEMPLATE_ORDER = [0, 1, 2, 3, 4, 5, 6, 4, 5, 7, 8, 6, 9, 10, 11, 12, 10, 11, 12, 9, 12, 10, 11, 9];

function randomSource(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let n = state;
    n = Math.imul(n ^ (n >>> 15), n | 1);
    n ^= n + Math.imul(n ^ (n >>> 7), n | 61);
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(text) {
  let value = 2166136261;
  for (const character of text) value = Math.imul(value ^ character.charCodeAt(0), 16777619);
  return value >>> 0;
}

function shuffle(values, random) {
  for (let i = values.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [values[i], values[j]] = [values[j], values[i]];
  }
  return values;
}

function createLevel(templateIndex, seed, metadata) {
  const random = randomSource(seed);
  const template = TEMPLATES[templateIndex];
  let { cols, rows } = template;
  let rects = template.rects.map(rect => [...rect]);
  if (random() < 0.5) rects = rects.map(([x, y, w, h]) => [cols - x - w, y, w, h]);
  if (random() < 0.5) rects = rects.map(([x, y, w, h]) => [x, rows - y - h, w, h]);
  if (random() < 0.5) {
    rects = rects.map(([x, y, w, h]) => [rows - y - h, x, h, w]);
    [cols, rows] = [rows, cols];
  }
  const counts = {};
  const solution = {};
  const squareTypes = shuffle(['book', 'dryer', 'teddy'], random);
  let squareIndex = 0;
  let largeIndex = 0;
  const pieces = rects.map(([x, y, w, h]) => {
    let type;
    if (w * h === 2) type = 'console';
    else if (w * h === 4) type = squareTypes[squareIndex++ % squareTypes.length];
    else type = ['shirt', 'shoes'][(largeIndex++ + (seed % 2)) % 2];
    const dimensions = ITEM_TYPES[type];
    const id = `${type}-${counts[type] = (counts[type] || 0) + 1}`;
    solution[id] = { x, y, rotation: dimensions.w === w && dimensions.h === h ? 0 : 90 };
    return { id, type, w: dimensions.w, h: dimensions.h };
  });
  return { ...metadata, cols, rows, pieces: shuffle(pieces, random), solution };
}

/** A fresh level object is returned so UI state cannot mutate later calls. */
export function getLevel(index) {
  if (!Number.isInteger(index) || index < 0 || index >= LEVEL_COUNT) {
    throw new RangeError(`Level index must be an integer from 0 to ${LEVEL_COUNT - 1}.`);
  }
  return createLevel(TEMPLATE_ORDER[index], 90317 + index * 1987, {
    id: `level-${index + 1}`, index, title: TITLES[index],
  });
}

function todayInTallinn() {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Europe/Tallinn', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const value = type => parts.find(part => part.type === type).value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}

export function getDailyLevel(dateKey = todayInTallinn()) {
  if (typeof dateKey !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)
    || Number.isNaN(Date.parse(`${dateKey}T00:00:00Z`))
    || new Date(`${dateKey}T00:00:00Z`).toISOString().slice(0, 10) !== dateKey) {
    throw new TypeError('Daily level date must be a valid YYYY-MM-DD date.');
  }
  const seed = hash(`mahub-kyll-daily-v1-${dateKey}`);
  return createLevel(9 + seed % 4, seed, {
    id: `daily-${dateKey}`, index: -1, title: 'Päevapusle', dateKey,
  });
}

function normalizeRotation(rotation = 0) {
  if (!Number.isInteger(rotation)) return null;
  if (rotation > 0 && rotation < 4) return rotation * 90;
  if (rotation % 90 !== 0) return null;
  return ((rotation % 360) + 360) % 360;
}

export function rotateDimensions(piece, rotation = 0) {
  const normalized = normalizeRotation(rotation);
  if (!piece || !Number.isInteger(piece.w) || !Number.isInteger(piece.h)
    || piece.w <= 0 || piece.h <= 0 || normalized === null) return null;
  return normalized % 180 === 0 ? { w: piece.w, h: piece.h } : { w: piece.h, h: piece.w };
}

function footprint(level, piece, placement) {
  if (!placement || !Number.isInteger(placement.x) || !Number.isInteger(placement.y)) return null;
  const size = rotateDimensions(piece, placement.rotation);
  if (!size || placement.x < 0 || placement.y < 0
    || placement.x + size.w > level.cols || placement.y + size.h > level.rows) return null;
  let mask = 0n;
  for (let y = placement.y; y < placement.y + size.h; y += 1) {
    for (let x = placement.x; x < placement.x + size.w; x += 1) {
      mask |= 1n << BigInt(y * level.cols + x);
    }
  }
  return mask;
}

/** Repositioning a piece ignores its old footprint, but checks all other pieces. */
export function validatePlacement(level, placements, pieceId, x, y, rotation = 0) {
  const piece = level.pieces.find(candidate => candidate.id === pieceId);
  if (!piece) return false;
  const mask = footprint(level, piece, { x, y, rotation });
  if (mask === null) return false;
  for (const other of level.pieces) {
    if (other.id === pieceId || !placements?.[other.id]) continue;
    const otherMask = footprint(level, other, placements[other.id]);
    if (otherMask === null || (mask & otherMask) !== 0n) return false;
  }
  return true;
}

function readState(level, placements) {
  let occupied = 0n;
  const remaining = [];
  for (const piece of level.pieces) {
    const placement = placements?.[piece.id];
    if (!placement) { remaining.push(piece); continue; }
    const mask = footprint(level, piece, placement);
    if (mask === null || (occupied & mask) !== 0n) return null;
    occupied |= mask;
  }
  return { occupied, remaining };
}

export function isComplete(level, placements) {
  const state = readState(level, placements);
  return state !== null && state.remaining.length === 0;
}

function findCompletion(level, placements) {
  const state = readState(level, placements);
  if (!state) return null;
  const full = (1n << BigInt(level.cols * level.rows)) - 1n;
  const candidates = new Map(state.remaining.map(piece => {
    const positions = [];
    for (const rotation of piece.w === piece.h ? [0] : [0, 90]) {
      const { w, h } = rotateDimensions(piece, rotation);
      for (let y = 0; y <= level.rows - h; y += 1) {
        for (let x = 0; x <= level.cols - w; x += 1) {
          const placement = { x, y, rotation };
          positions.push({ placement, mask: footprint(level, piece, placement) });
        }
      }
    }
    return [piece.id, positions];
  }));
  let nodes = 0;
  const failed = new Set();
  const chosen = {};
  function visit(occupied, remaining) {
    if (++nodes > 20000) return false;
    if (!remaining.length) return occupied === full;
    const key = `${occupied}:${remaining.map(piece => piece.id).join(',')}`;
    if (failed.has(key)) return false;
    // An exact tiling must cover every empty cell. Trying the most constrained
    // cell first avoids the factorial cost of arbitrary piece-order searches.
    let choices = null;
    for (let cell = 0; cell < level.cols * level.rows; cell += 1) {
      const bit = 1n << BigInt(cell);
      if ((occupied & bit) !== 0n) continue;
      const covering = [];
      const dimensionsSeen = new Set();
      for (const piece of remaining) {
        const shape = [piece.w, piece.h].sort().join('x');
        if (dimensionsSeen.has(shape)) continue;
        dimensionsSeen.add(shape);
        for (const candidate of candidates.get(piece.id)) {
          if ((candidate.mask & bit) !== 0n && (candidate.mask & occupied) === 0n) {
            covering.push({ piece, ...candidate });
          }
        }
      }
      if (!covering.length) { failed.add(key); return false; }
      if (choices === null || covering.length < choices.length) choices = covering;
      if (choices.length === 1) break;
    }
    if (!choices) return false;
    choices.sort((a, b) => (b.piece.w * b.piece.h) - (a.piece.w * a.piece.h));
    for (const choice of choices) {
      chosen[choice.piece.id] = choice.placement;
      if (visit(occupied | choice.mask, remaining.filter(piece => piece.id !== choice.piece.id))) return true;
      delete chosen[choice.piece.id];
      if (nodes > 20000) break;
    }
    failed.add(key);
    return false;
  }
  return visit(state.occupied, state.remaining) ? chosen : null;
}

function samePlacement(piece, a, b) {
  if (!a || !b || a.x !== b.x || a.y !== b.y) return false;
  const first = rotateDimensions(piece, a.rotation);
  const second = rotateDimensions(piece, b.rotation);
  return first && second && first.w === second.w && first.h === second.h;
}

/**
 * Returns a single useful move, never an unchecked guess. Remove displacedIds
 * from current placements before applying the returned move. A completion is
 * sought without disturbing existing pieces first. If the board is trapped,
 * one reference-solution move is returned with just its conflicting pieces.
 * Repeated fallback hints converge to the guaranteed reference solution.
 */
export function getHint(level, placements = {}) {
  if (isComplete(level, placements)) return null;
  const completion = findCompletion(level, placements);
  if (completion) {
    const piece = level.pieces.find(candidate => completion[candidate.id]);
    if (piece) return { pieceId: piece.id, ...completion[piece.id], displacedIds: [], reset: false };
  }
  const piece = level.pieces.find(candidate => !samePlacement(candidate, placements[candidate.id], level.solution[candidate.id]));
  if (!piece) return null;
  const target = level.solution[piece.id];
  const mask = footprint(level, piece, target);
  const displacedIds = level.pieces.filter(other => {
    if (other.id === piece.id || !placements[other.id]) return false;
    const otherMask = footprint(level, other, placements[other.id]);
    return otherMask === null || (otherMask & mask) !== 0n;
  }).map(other => other.id);
  return { pieceId: piece.id, ...target, displacedIds, reset: false };
}
