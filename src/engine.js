/** Pure, deterministic packing-puzzle rules. Coordinates are zero-based cells. */
const item = (name,w,h,unlock,sheet,col,row) => Object.freeze({name,w,h,unlock,sheet,col,row});
export const ITEM_TYPES = Object.freeze({
  shirt: item('T-särk',3,2,3,'original',0,0),
  book: item('Raamat',2,2,1,'original',1,0),
  shoes: item('Tossud',2,3,5,'original',2,0),
  dryer: item('Föön',2,2,1,'original',0,1),
  console: item('Mängukonsool',2,1,2,'original',1,1),
  teddy: item('Kaisukaru',2,2,1,'original',2,1),
  camera: item('Fotoaparaat',2,2,1,'travel',0,0),
  headphones: item('Kõrvaklapid',2,2,7,'travel',1,0),
  sunglasses: item('Päikeseprillid',2,1,9,'travel',2,0),
  bottle: item('Joogipudel',1,3,11,'travel',3,0),
  toothbrush: item('Hambahari',1,2,13,'travel',0,1),
  passport: item('Pass',1,2,15,'travel',1,1),
  sunscreen: item('Päikesekreem',1,2,17,'travel',2,1),
  socks: item('Sokid',2,1,19,'travel',3,1),
  cap: item('Nokamüts',2,2,21,'travel',0,2),
  umbrella: item('Vihmavari',1,3,22,'travel',1,2),
  snack: item('Müslibatoon',2,1,23,'travel',2,2),
  powerbank: item('Akupank',1,2,24,'travel',3,2),
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
  { cols: 4, rows: 4, rects: [[0, 0, 2, 2], [2, 0, 2, 2], [0, 2, 2, 2], [2, 2, 2, 2]] },
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

export function getUnlockedItems(index) {
  return Object.keys(ITEM_TYPES).filter(type => ITEM_TYPES[type].unlock <= index + 1);
}

function sameShape(type,w,h) {
  const d=ITEM_TYPES[type];
  return (d.w===w && d.h===h) || (d.w===h && d.h===w);
}

// Each cut retains a complete tiling. Leftover rectangles must also correspond
// to available items, so introducing a long bottle cannot create a dead cell.
function cutsFor(rect,type,pool) {
  if (rect[4]) return [];
  const [x,y,w,h]=rect, d=ITEM_TYPES[type], cuts=[];
  for (const [tw,th] of d.w===d.h ? [[d.w,d.h]] : [[d.w,d.h],[d.h,d.w]]) {
    if (tw>w || th>h) continue;
    const remainder=[];
    if (w>tw) remainder.push([x+tw,y,w-tw,th]);
    if (h>th) remainder.push([x,y+th,w,h-th]);
    if (remainder.every(r => pool.some(t => sameShape(t,r[2],r[3])))) {
      cuts.push([[x,y,tw,th,type],...remainder]);
    }
  }
  return cuts;
}

function createLevel(templateIndex, seed, metadata) {
  const random=randomSource(seed), template=TEMPLATES[templateIndex];
  const campaign=metadata.index>=0;
  const pool=campaign ? getUnlockedItems(metadata.index) : Object.keys(ITEM_TYPES);
  const newItems=campaign ? pool.filter(type => ITEM_TYPES[type].unlock===metadata.index+1) : [];
  let {cols,rows}=template;
  let rects=template.rects.map(rect => [...rect]);
  for (const type of newItems) {
    const choices=rects.flatMap((rect,index) => cutsFor(rect,type,pool).map(cut => ({index,cut})));
    if (!choices.length) throw new Error(`No introduction slot for ${type} in ${metadata.id}`);
    const fewest=Math.min(...choices.map(choice => choice.cut.length));
    const best=choices.filter(choice => choice.cut.length===fewest);
    const choice=best[Math.floor(random()*best.length)];
    rects.splice(choice.index,1,...choice.cut);
  }
  // Split some large footprints into smaller travel accessories, giving later
  // suitcases a mix of objects instead of rows of identical large rectangles.
  const small=pool.filter(type => ITEM_TYPES[type].w*ITEM_TYPES[type].h<=3);
  const extra=campaign && metadata.index<8 ? 1 : 2;
  for (let pass=0; pass<extra && rects.length<10; pass++) {
    const useful=small.filter(type => {
      const d=ITEM_TYPES[type];
      const current=rects.filter(rect => sameShape(type,rect[2],rect[3])).length;
      const alternatives=pool.filter(t => sameShape(t,d.w,d.h)).length;
      return current<Math.max(2,alternatives);
    });
    const choices=rects.flatMap((rect,index) => rect[2]*rect[3]>=4
      ? useful.flatMap(type => cutsFor(rect,type,pool).filter(cut => cut.length===2)
        .map(cut => ({index,cut,type}))) : []);
    if (!choices.length) break;
    const biggest=Math.max(...choices.map(choice => rects[choice.index][2]*rects[choice.index][3]));
    const best=choices.filter(choice => rects[choice.index][2]*rects[choice.index][3]===biggest);
    const choice=best[Math.floor(random()*best.length)];
    if (rects.length-1+choice.cut.length>10) break;
    rects.splice(choice.index,1,...choice.cut.map(rect => rect.slice(0,4)));
  }
  if (random()<.5) rects=rects.map(([x,y,w,h,t]) => [cols-x-w,y,w,h,t]);
  if (random()<.5) rects=rects.map(([x,y,w,h,t]) => [x,rows-y-h,w,h,t]);
  // Keep the case square or landscape inside the fixed portrait game screen.
  if (cols<rows || (cols===rows && random()<.5)) {
    rects=rects.map(([x,y,w,h,t]) => [rows-y-h,x,h,w,t]);
    [cols,rows]=[rows,cols];
  }
  const counts={}, usage=Object.fromEntries(pool.map(type => [type,0])), solution={};
  for (const rect of rects) if (rect[4]) usage[rect[4]]++;
  const pieces=rects.map(([x,y,w,h,forced]) => {
    let type=forced;
    if (!type) {
      const eligible=shuffle(pool.filter(t => sameShape(t,w,h)),random);
      eligible.sort((a,b) => usage[a]-usage[b]);
      type=eligible[0];
      if (!type) throw new Error(`Unsupported footprint ${w}x${h}`);
      usage[type]++;
    }
    const dimensions=ITEM_TYPES[type];
    const id=`${type}-${counts[type]=(counts[type]||0)+1}`;
    solution[id]={x,y,rotation:dimensions.w===w && dimensions.h===h ? 0 : 90};
    return {id,type,w:dimensions.w,h:dimensions.h};
  });
  return {...metadata,revision:2,cols,rows,pieces:shuffle(pieces,random),solution,newItems,unlockedItems:pool};
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
  const seed = hash(`mahub-kyll-daily-v2-${dateKey}`);
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
