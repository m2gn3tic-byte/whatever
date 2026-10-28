import './style.css';
import './portrait.css';
import { ITEM_TYPES, LEVEL_COUNT, getLevel, getDailyLevel, getUnlockedItems, validatePlacement, rotateDimensions, isComplete, getHint } from './engine.js';
import { SPRITE_SHEETS } from './art.js';

const BASE = import.meta.env.BASE_URL;
function sheetSource(sheet) {
  const embedded=globalThis.__MAHUB_ASSETS__?.[sheet.key];
  if (!embedded) return `${BASE}assets/${sheet.file}`;
  // Reuse a short blob URL instead of copying megabytes of base64 into every
  // SVG whenever the portable game's tray or collection is rendered again.
  if (embedded.startsWith('data:image/png;base64,')) {
    const binary=atob(embedded.slice(22)),bytes=new Uint8Array(binary.length);
    for(let i=0;i<binary.length;i++) bytes[i]=binary.charCodeAt(i);
    return URL.createObjectURL(new Blob([bytes],{type:'image/png'}));
  }
  return embedded;
}
const SHEET_URLS = Object.fromEntries(Object.entries(SPRITE_SHEETS).map(([name,sheet]) =>
  [name,sheetSource(sheet)]));
const icons = {
  suitcase: '<rect x="4" y="7" width="16" height="13" rx="3"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M8 11v5m8-5v5"/>',
  rotate: '<path d="M3 10a9 9 0 1 1 2 8M3 4v6h6"/>',
  bulb: '<path d="M9 18h6m-5 3h4M8 14a6 6 0 1 1 8 0c-1 1-1 2-1 4H9c0-2 0-3-1-4Z"/>',
  arrow: '<path d="m9 5 7 7-7 7M4 12h12"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  sound: '<path d="m11 5-6 4H2v6h3l6 4V5Zm4 3a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  mute: '<path d="m11 5-6 4H2v6h3l6 4V5Zm5 4 6 6m0-6-6 6"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 4 2c-1 .5-1.5 1-1.5 2m0 3v.1"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 1v2m0 18v2M1 12h2m18 0h2M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2"/>',
  undo: '<path d="M4 10h10a6 6 0 0 1 0 12M4 10l6-6M4 10l6 6"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
  leaf: '<path d="M20 3C5 1 1 11 6 17S23 18 20 3ZM5 20 16 8"/>',
  star: '<path d="m12 2 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z"/>',
};
const icon = (name, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.suitcase}</svg>`;
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const STORAGE = 'mahub-kull-v1';
let saved;
try { saved = JSON.parse(localStorage.getItem(STORAGE) || '{}'); } catch { saved = {}; }
if (!saved || typeof saved !== 'object' || Array.isArray(saved)) saved = {};
const progress = {
  completed: Array.isArray(saved.completed) ? [...new Set(saved.completed.filter(n => Number.isInteger(n) && n >= 0 && n < LEVEL_COUNT))] : [],
  current: Number.isInteger(saved.current) && saved.current >= 0 && saved.current < LEVEL_COUNT ? saved.current : 0,
  games: saved.games && typeof saved.games === 'object' && !Array.isArray(saved.games) ? saved.games : {},
  sound: saved.sound !== false,
  daily: typeof saved.daily === 'string' ? saved.daily : '',
};
let dailyMode = false;
let level, placements = {}, selected = null, rotations = {}, history = [], moves = 0, hints = 0;
let drag = null, suppressClick = false, toastTimer, audio, storageWarning = false;
const app = document.querySelector('#app');
const today = () => new Intl.DateTimeFormat('sv-SE', {timeZone:'Europe/Tallinn'}).format(new Date());
function persist() {
  progress.games[level.id] = { placements, moves, hints, revision:level.revision };
  try { localStorage.setItem(STORAGE, JSON.stringify(progress)); }
  catch { if (!storageWarning) { storageWarning = true; toast('Salvestusruum pole saadaval. Edenemine säilib selle mängukorra lõpuni.'); } }
}
function play(kind = 'place') {
  if (!progress.sound) return;
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume();
    const notes = kind === 'win' ? [523, 659, 784, 1046] : kind === 'rotate' ? [440, 550] : [660, 880];
    notes.forEach((frequency, i) => {
      const osc = audio.createOscillator(), gain = audio.createGain(), t = audio.currentTime + i * .075;
      osc.type = 'sine'; osc.frequency.value = frequency;
      gain.gain.setValueAtTime(0, t); gain.gain.linearRampToValueAtTime(.055, t + .008); gain.gain.exponentialRampToValueAtTime(.001, t + .16);
      osc.connect(gain); gain.connect(audio.destination); osc.start(t); osc.stop(t + .18);
    });
  } catch { /* Sound is optional on browsers without Web Audio. */ }
}
const sprite = type => {
  const item=ITEM_TYPES[type],sheet=SPRITE_SHEETS[item.sheet];
  const w=sheet.width/sheet.cols,h=sheet.height/sheet.rows;
  return `<svg class="sprite" viewBox="0 0 ${w} ${h}" aria-hidden="true"><svg width="${w}" height="${h}" viewBox="${item.col*w} ${item.row*h} ${w} ${h}" overflow="hidden"><image href="${SHEET_URLS[item.sheet]}" width="${sheet.width}" height="${sheet.height}"/></svg></svg>`;
};
function reachedLevel() { return Math.min(LEVEL_COUNT-1,Math.max(progress.current,Math.max(-1,...progress.completed)+1)); }
function discoveryBanner() {
  if (dailyMode) return `<div class="discovery-banner"><span class="discovery-icon">${icon('star')}</span><span><strong>Päeva väike seiklus</strong><small>Kõik reisikaaslased võivad kaasa tulla</small></span><button class="icon-button" data-action="collection" aria-label="Vaata esemekogu">${icon('suitcase')}</button></div>`;
  const fresh=level.newItems;
  const ordered=Object.entries(ITEM_TYPES).filter(([,item]) => item.unlock>level.index+1).sort((a,b) => a[1].unlock-b[1].unlock);
  const upcoming=ordered[0];
  if (fresh.length) {
    const type=fresh.length>1 ? 'camera' : fresh[0];
    return `<div class="discovery-banner is-new"><span class="discovery-art">${sprite(type)}</span><span><strong>${fresh.length>1 ? 'Neli reisikaaslast, esimene kohver' : `Uus ese: ${esc(ITEM_TYPES[type].name)}`}</strong><small>${fresh.length>1 ? 'Avasta reisi jooksul 18 erinevat eset' : 'Uus kuju, uued pakkimisvõimalused'}</small></span><span class="new-pill">UUS</span></div>`;
  }
  return `<div class="discovery-banner"><span class="discovery-icon">${icon('suitcase')}</span><span><strong>${upcoming ? `Järgmisena: ${esc(upcoming[1].name)}` : 'Kõik reisikaaslased on avastatud'}</strong><small>${upcoming ? `Avaneb kohvris ${upcoming[1].unlock}` : 'Nüüd oled tõeline kohvrimeister'}</small></span><button class="icon-button" data-action="collection" aria-label="Vaata esemekogu">${icon('arrow')}</button></div>`;
}
function theme() { return ['Suvepuhkus', 'Nädalalõpureis', 'Väike seiklus'][Math.floor((level.index || 0) / 8)] || 'Suvepuhkus'; }
function loadLevel(index = progress.current, daily = false) {
  dailyMode = daily;
  level = daily ? getDailyLevel(today()) : getLevel(index);
  if (!daily) progress.current = index;
  placements = {}; rotations = {}; history = []; selected = null;
  const stored = progress.games[level.id];
  const previous = stored?.revision===level.revision ? stored : null;
  if (previous?.placements && typeof previous.placements === 'object') {
    for (const piece of level.pieces) {
      const p = previous.placements[piece.id];
      if (p && validatePlacement(level, placements, piece.id, p.x, p.y, p.rotation)) placements[piece.id] = { x:p.x, y:p.y, rotation:p.rotation };
    }
  }
  moves = Number.isSafeInteger(previous?.moves) && previous.moves >= 0 ? previous.moves : 0;
  hints = Number.isSafeInteger(previous?.hints) && previous.hints >= 0 ? previous.hints : 0;
  render(); persist();
}
function render() {
  app.innerHTML = `
    <header class="site-header">
      <button class="brand" data-action="journey" aria-label="Mahub küll! avaleht"><span class="brand-icon">${icon('suitcase')}</span><span>mahub küll<span class="brand-dot">!</span></span></button>
      <div class="header-right"><button class="icon-button collection-button" data-action="collection" aria-label="Esemekogu">${icon('suitcase')}</button><button class="icon-button" data-action="sound" aria-label="${progress.sound ? 'Lülita heli välja' : 'Lülita heli sisse'}">${icon(progress.sound ? 'sound' : 'mute')}</button><button class="icon-button" data-action="help" aria-label="Kuidas mängida">${icon('help')}</button></div>
    </header>
    <main class="layout">
      <aside class="journey">
        <div class="eyebrow"><span></span> VÄIKE KOHVER. SUURED PLAANID.</div>
        <h1>Hea tuju?<br>Võta <em>kaasa.</em></h1>
        <p class="intro">Natuke nuputamist. Mõnus klõps.<br>Ja kõik vajalik mahubki ära.</p>
        <div class="journey-divider"></div>
        <div class="section-label">SINU VÄIKESED SEIKLUSED <span>${progress.completed.length}/${LEVEL_COUNT}</span></div>
        <button class="trip-card ${!dailyMode ? 'active' : ''}" data-action="journey"><span class="trip-art summer">${icon('sun')}</span><span><strong>Suvepuhkus</strong><small>24 kohvrit täis avastamist</small></span><span class="trip-arrow">${icon('arrow')}</span></button>
        <button class="trip-card daily ${dailyMode ? 'active' : ''}" data-action="daily"><span class="trip-art daily-art">${icon('star')}</span><span><strong>Päeva kohver ${progress.daily === today() ? '✓' : ''}</strong><small>Üks uus pusle iga päev</small></span><span class="daily-badge">TÄNA</span></button>
        <div class="travel-note"><span class="note-sun">✳</span><p>Kiiret pole.<br><strong>Reisimine algab pakkimisest.</strong></p><svg viewBox="0 0 110 46" aria-hidden="true"><path d="M4 35c25-40 32 18 55-12S92 12 105 3" fill="none" stroke="currentColor" stroke-dasharray="4 5"/><path d="m96 3 10-1-2 11" fill="none" stroke="currentColor"/></svg></div>
        <div class="journey-bottom">${icon('leaf')} Oma tempos. Ilma reklaamideta.</div>
      </aside>
      <section class="game" aria-label="Kohvri pakkimise mäng">
        <div class="game-heading"><div><div class="eyebrow">${dailyMode ? 'IGALE PÄEVALE OMA SEIKLUS' : `REIS ${String(Math.floor(level.index / 8) + 1).padStart(2, '0')} · ${theme().toUpperCase()}`}</div><h2>${dailyMode ? 'Päeva kohver' : `Kohver ${String(level.index + 1).padStart(2,'0')}`}<span class="level-tag">${dailyMode ? new Intl.DateTimeFormat('et', {day:'numeric',month:'long'}).format(new Date()) : level.index < 4 ? 'MÕNUS ALGUS' : level.index < 12 ? 'VÄIKE VÄLJAKUTSE' : 'PÄRIS PAKKIJA'}</span></h2></div><button class="icon-button level-button" data-action="levels" aria-label="Vali tase">${icon('grid')}</button></div>
        ${discoveryBanner()}
        <div class="packing-status"><span id="packing-label" role="status"></span><span id="packing-count"></span></div>
        <div class="progress-track"><span id="packing-progress"></span></div>
        <div class="suitcase-wrap"><div class="case-handle top"></div><div class="suitcase"><div class="case-corner c1"></div><div class="case-corner c2"></div><div class="case-corner c3"></div><div class="case-corner c4"></div><div class="zipper"><div class="board" id="board" style="--cols:${level.cols};--rows:${level.rows};aspect-ratio:${level.cols}/${level.rows}" aria-label="${level.cols} korda ${level.rows} pakkimislaud"></div></div><span class="case-clasp clasp-left"></span><span class="case-clasp clasp-right"></span></div><div class="case-handle bottom"></div><div class="case-sticker">${icon('sun')} <span>GOOD<br>THINGS<br>AHEAD</span></div></div>
        <div class="tray-heading"><span id="tray-label">VEEL KAASA</span><span class="tray-help">Vali ese · pööra · paiguta</span></div>
        <div id="tray" class="item-tray" aria-label="Pakkimata esemed"></div>
        <div class="controls"><button class="secondary-button" data-action="rotate" id="rotate-button" disabled>${icon('rotate')} Pööra <kbd>R</kbd></button><button class="hint-button" data-action="hint">${icon('bulb')} Väike vihje</button><button class="icon-button undo-button" data-action="undo" aria-label="Võta viimane käik tagasi" disabled>${icon('undo')}</button></div>
        <div class="game-bottom"><button class="text-button" data-action="reset">Alusta uuesti</button><span>${icon('leaf')} Kõik mahub. Võta rahulikult.</span></div>
      </section>
      <aside class="side-note" aria-hidden="true"><span class="postcard-stamp">ET<br>✳</span><span class="postcard-sun"></span><div class="postcard-hills"></div><span class="postcard-text">väikesed<br><em>head hetked.</em></span></aside>
    </main>
    <footer class="site-footer"><span>VÄIKE KOHVER. SUURED PLAANID.</span><span>18 reisikaaslast · v0.2</span></footer>
    <div class="toast" id="toast" role="status" aria-live="polite"></div><dialog id="modal" aria-label="Mängu teave"></dialog>`;
  renderPieces();
}
function pieceButton(piece, placed = null) {
  const rotation = placed?.rotation ?? rotations[piece.id] ?? 0;
  const { w,h } = rotateDimensions(piece, rotation);
  const style = placed ? `left:${placed.x / level.cols * 100}%;top:${placed.y / level.rows * 100}%;width:${w / level.cols * 100}%;height:${h / level.rows * 100}%;` : '';
  const swapped = rotation % 180 !== 0;
  const visualStyle = placed ? `--visual-w:${(swapped ? h/w : 1)*95}%;--visual-h:${(swapped ? w/h : 1)*95}%;` : '';
  return `<button class="piece ${placed ? 'packed-piece' : 'tray-piece'} ${selected === piece.id ? 'selected' : ''}" data-piece="${piece.id}" data-rotation="${rotation}" style="${style}--turn:${rotation}deg;--piece-w:${w};--piece-h:${h}" aria-label="${esc(ITEM_TYPES[piece.type].name)}, ${w} korda ${h}${placed ? ', kohvris' : ', pakkimata'}" aria-pressed="${selected === piece.id}"><span class="piece-visual" style="${visualStyle}--art-turn:${rotation}deg">${sprite(piece.type)}</span>${!placed ? `<span class="piece-size">${w} × ${h}</span>` : ''}</button>`;
}
function renderPieces() {
  const focusedPiece = document.activeElement?.dataset.piece;
  const focusedCell = document.activeElement?.dataset.cell;
  const board = document.querySelector('#board');
  board.innerHTML = Array.from({ length:level.cols * level.rows }, (_,i) => `<button class="cell" data-cell="${i}" aria-label="Rida ${Math.floor(i / level.cols) + 1}, veerg ${i % level.cols + 1}"></button>`).join('') + level.pieces.filter(p => placements[p.id]).map(p => pieceButton(p, placements[p.id])).join('');
  const remaining = level.pieces.filter(p => !placements[p.id]);
  document.querySelector('#tray').innerHTML = remaining.length ? remaining.map(p => pieceButton(p)).join('') : `<button class="all-packed" data-action="show-win">${icon('check')} Kõik on kaasas. Jätka reisi ${icon('arrow')}</button>`;
  document.querySelector('#tray').style.setProperty('--items', Math.min(remaining.length, 5));
  document.querySelector('#tray').style.setProperty('--tray-rows', Math.max(1,Math.ceil(remaining.length/5)));
  document.querySelector('#tray-label').textContent = remaining.length ? `VEEL ${remaining.length} ${remaining.length === 1 ? 'ESE' : 'ESET'} KAASA` : 'KOHVER ON PAKITUD';
  document.querySelector('#packing-label').textContent = remaining.length ? 'Igale asjale oma koht' : 'Valmis uuteks seiklusteks';
  document.querySelector('#packing-count').textContent = `${level.pieces.length - remaining.length} / ${level.pieces.length} pakitud`;
  document.querySelector('#packing-progress').style.width = `${(level.pieces.length - remaining.length) / level.pieces.length * 100}%`;
  updateSelection();
  document.querySelector('[data-action="undo"]').disabled = !history.length;
  if (focusedPiece) document.querySelector(`[data-piece="${focusedPiece}"]`)?.focus({preventScroll:true});
  else if (focusedCell !== undefined) document.querySelector(`[data-cell="${focusedCell}"]`)?.focus({preventScroll:true});
}
function updateSelection() {
  document.querySelectorAll('[data-piece]').forEach(el => { const yes = el.dataset.piece === selected; el.classList.toggle('selected', yes); el.setAttribute('aria-pressed', yes); });
  const btn = document.querySelector('#rotate-button');
  btn.disabled = !selected;
  document.querySelector('.tray-help').innerHTML = selected && placements[selected]
    ? '<button class="text-button unpack-button" data-action="unpack">Tagasi alusele ↓</button>'
    : selected ? 'Puuduta kohvris sobivat ruutu' : 'Vali ese · pööra · paiguta';
}
function snapshot() {
  history.push({ placements:structuredClone(placements), rotations:{...rotations}, moves, hints });
  if (history.length > 60) history.shift();
}
function place(pieceId, x, y, rotation) {
  if (!validatePlacement(level, placements, pieceId, x,y,rotation)) { toast('Siia veel ei mahu. Proovi teistpidi või teise kohta.'); return false; }
  const prev = placements[pieceId];
  if (prev?.x === x && prev?.y === y && prev?.rotation === rotation) return true;
  snapshot(); placements[pieceId] = { x,y,rotation }; selected = null; moves++;
  play(); renderPieces(); persist(); checkWin(); return true;
}
function rotate() {
  if (!selected) { toast('Vali esmalt ese, mida soovid pöörata.'); return; }
  const piece = level.pieces.find(p => p.id === selected), previous = placements[selected];
  const rotation = ((previous?.rotation ?? rotations[selected] ?? 0) + 90) % 360;
  snapshot();
  if (previous && validatePlacement(level, placements, selected, previous.x, previous.y, rotation)) {
    placements[selected] = {...previous, rotation}; moves++;
  } else {
    if (previous) { delete placements[selected]; toast('Pööratud ese ootab all uut kohta.'); }
    rotations[selected] = rotation;
  }
  play('rotate'); renderPieces(); persist(); checkWin();
}
function hint() {
  const h = getHint(level, placements);
  if (!h) { if (isComplete(level, placements)) showWin(); return; }
  snapshot();
  for (const id of h.displacedIds || []) delete placements[id];
  placements[h.pieceId] = {x:h.x,y:h.y,rotation:h.rotation}; hints++; moves++; selected = null;
  renderPieces(); persist(); play();
  const el = document.querySelector(`[data-piece="${h.pieceId}"]`); el?.classList.add('hinted');
  toast(h.displacedIds?.length ? 'Tegime veidi ruumi ja leidsime ühe õige koha.' : 'Üks asi leidis oma koha. Nüüd on sinu kord!');
  checkWin();
}
function unpack() {
  if (!selected || !placements[selected]) return;
  snapshot(); rotations[selected] = placements[selected].rotation;
  delete placements[selected]; moves++; renderPieces(); persist();
  document.querySelector(`[data-piece="${selected}"]`)?.focus({preventScroll:true});
}
function checkWin() {
  if (!isComplete(level, placements)) return;
  if (dailyMode) progress.daily = level.dateKey;
  else if (!progress.completed.includes(level.index)) progress.completed.push(level.index);
  document.querySelector('.section-label span').textContent = `${progress.completed.length}/${LEVEL_COUNT}`;
  persist(); play('win');
  document.querySelector('.suitcase').classList.add('celebrate');
  const completedId = level.id;
  setTimeout(() => { if (level.id === completedId && isComplete(level, placements)) showWin(); }, 650);
}
function openModal(content, className = '') {
  const dialog = document.querySelector('#modal');
  if (dialog.open) dialog.close();
  dialog.className = className;
  dialog.innerHTML = `<button class="icon-button modal-close" data-action="close" aria-label="Sulge">${icon('close')}</button>${content}`;
  dialog.showModal();
}
function showWin() {
  const all = progress.completed.length === LEVEL_COUNT;
  openModal(`<div class="win-illustration">${icon('suitcase')}<span>✦</span><span>✦</span><span>✧</span></div><div class="eyebrow">${dailyMode ? 'PÄEVA KOHVER PAKITUD' : 'KÕIK VAJALIK ON KAASAS'}</div><h2>${all ? 'Oled kohvrimeister!' : 'Mahubki küll!'}</h2><p>${dailyMode ? 'Tänane väike seiklus on tehtud. Homme ootab sind uus kohver.' : all ? 'Kõik 24 kohvrit on pakitud. Päeva kohver pakub sulle iga päev uue pusle.' : 'Sokid, seiklused ja hea tuju.<br>Oled järgmiseks peatuseks valmis.'}</p><div class="win-stats"><span><strong>${moves}</strong> käiku</span><span><strong>${hints}</strong> vihjet</span><span><strong>${dailyMode ? '✓' : progress.completed.length + '/' + LEVEL_COUNT}</strong> ${dailyMode ? 'tehtud' : 'kohvrit'}</span></div><button class="primary-button" data-action="${dailyMode || all ? 'journey' : level.index === LEVEL_COUNT - 1 ? 'levels' : 'next'}">${dailyMode || all ? 'Tagasi reisile' : level.index === LEVEL_COUNT - 1 ? 'Vaata kohvreid' : 'Järgmine kohver'} ${icon('arrow')}</button><button class="text-button" data-action="close">Naudi oma kätetööd</button>`, 'win-modal');
}
function showLevels() {
  const unlocked = Math.min(LEVEL_COUNT - 1, Math.max(-1, ...progress.completed) + 1);
  openModal(`<div class="eyebrow">IGA KOHVER ON UUS ALGUS</div><h2>Sinu väike reis</h2><p>${progress.completed.length} kohvrit pakitud. Võta järgmine ette.</p><div class="level-grid">${Array.from({length:LEVEL_COUNT},(_,i) => `<button data-level="${i}" class="level-tile ${progress.completed.includes(i) ? 'done' : ''} ${!dailyMode && i === level.index ? 'current' : ''}" ${i > unlocked ? 'disabled' : ''} aria-label="Kohver ${i+1}${i > unlocked ? ', lukus' : ''}">${progress.completed.includes(i) ? icon('check') : String(i+1).padStart(2,'0')}</button>`).join('')}</div><div class="modal-footnote">Uus kohver avaneb eelmise lõpetamisel.</div><button class="daily-entry" data-action="daily">${icon('star')}<span>Päeva kohver<small>Uus pusle iga päev</small></span>${icon('arrow')}</button>${dailyMode ? '<button class="text-button" data-action="journey">Tagasi oma reisile</button>' : ''}`);
}
function showCollection() {
  const unlocked=getUnlockedItems(reachedLevel());
  const types=Object.keys(ITEM_TYPES).sort((a,b) => ITEM_TYPES[a].unlock-ITEM_TYPES[b].unlock);
  openModal(`<div class="eyebrow">IGAL REISIL MIDAGI UUT</div><h2>Sinu reisikaaslased</h2><p>${unlocked.length} / ${types.length} eset avastatud. Uus ese avaneb iga paari kohvri järel.</p><div class="collection-grid">${types.map(type => {
    const item=ITEM_TYPES[type],open=unlocked.includes(type);
    return `<div class="collection-item ${open ? 'discovered' : 'locked'}" data-collection-item="${type}" data-unlocked="${open}"><span class="collection-art">${open ? sprite(type) : '<span class="unknown-item">?</span>'}</span><strong>${esc(item.name)}</strong><small>${open ? `${item.w} × ${item.h} ruutu` : `Kohver ${item.unlock}`}</small></div>`;
  }).join('')}</div><button class="primary-button" data-action="close">Tagasi pakkima ${icon('arrow')}</button>`,'collection-modal');
}
function help() {
  openModal(`<div class="help-illustration">${icon('suitcase')}</div><div class="eyebrow">VÄIKE PAKKIMISÕPETUS</div><h2>Kõik leiab oma koha.</h2><div class="help-steps"><div><b>01</b><span><strong>Vali ja lohista</strong>Võta alt ese ning lohista see kohvrisse. Võid ka valida eseme ja puudutada ruutu.</span></div><div><b>02</b><span><strong>Keera teistpidi</strong>Vali ese ja vajuta „Pööra”. Klaviatuuril töötab ka R. Mõnikord piisab vaid ühest pöördest.</span></div><div><b>03</b><span><strong>Paki kõik kaasa</strong>Esemed ei tohi kattuda. Vihje aitab ning tagasinool võtab käigu tagasi. Ajalimiiti pole.</span></div></div><button class="primary-button" data-action="close">Proovime järele ${icon('arrow')}</button>`);
}
function toast(message) {
  const el = document.querySelector('#toast'); if (!el) return;
  clearTimeout(toastTimer); el.textContent = message; el.classList.add('visible');
  toastTimer = setTimeout(() => el.classList.remove('visible'), 3500);
}
function closeModal() { document.querySelector('#modal')?.close(); }
app.addEventListener('click', event => {
  if (suppressClick) { suppressClick = false; return; }
  const action = event.target.closest('[data-action]')?.dataset.action;
  const levelButton = event.target.closest('[data-level]');
  if (levelButton && !levelButton.disabled) { closeModal(); loadLevel(Number(levelButton.dataset.level)); return; }
  if (action) {
    switch (action) {
      case 'rotate': rotate(); break;
      case 'unpack': unpack(); break;
      case 'hint': hint(); break;
      case 'undo': { const previous = history.pop(); if (previous) { ({placements,rotations,moves,hints} = previous); selected = null; renderPieces(); persist(); } break; }
      case 'reset': openModal(`<div class="eyebrow">VÄRSKE PILK AITAB</div><h2>Proovime algusest?</h2><p>Selle kohvri esemed lähevad tagasi alusele. Läbitud tasemed jäävad alles.</p><button class="primary-button" data-action="confirm-reset">Jah, pakin uuesti ${icon('rotate')}</button><button class="text-button" data-action="close">Jätkan siits</button>`); break;
      case 'confirm-reset': closeModal(); snapshot(); placements = {}; rotations = {}; selected = null; moves = 0; hints = 0; renderPieces(); persist(); break;
      case 'sound': { const button = event.target.closest('button'); progress.sound = !progress.sound; persist(); button.innerHTML = icon(progress.sound ? 'sound' : 'mute'); button.setAttribute('aria-label', progress.sound ? 'Lülita heli välja' : 'Lülita heli sisse'); play(); break; }
      case 'help': help(); break;
      case 'levels': showLevels(); break;
      case 'collection': showCollection(); break;
      case 'close': closeModal(); break;
      case 'next': closeModal(); loadLevel(Math.min(level.index+1,LEVEL_COUNT-1)); break;
      case 'show-win': showWin(); break;
      case 'daily': closeModal(); loadLevel(0,true); break;
      case 'journey': closeModal(); loadLevel(progress.current); break;
    }
    return;
  }
  const piece = event.target.closest('[data-piece]');
  if (piece) { selected = selected === piece.dataset.piece ? null : piece.dataset.piece; updateSelection(); return; }
  const cell = event.target.closest('[data-cell]');
  if (cell && selected) { const i = Number(cell.dataset.cell); place(selected, i % level.cols, Math.floor(i / level.cols), placements[selected]?.rotation ?? rotations[selected] ?? 0); }
});
app.addEventListener('pointerdown', event => {
  const target = event.target.closest('[data-piece]');
  if (!target || drag || event.button !== 0 || document.querySelector('#modal')?.open) return;
  const piece = level.pieces.find(p => p.id === target.dataset.piece);
  drag = { id:piece.id, pointerId:event.pointerId, startX:event.clientX, startY:event.clientY, rotation:placements[piece.id]?.rotation ?? rotations[piece.id] ?? 0, moved:false, ghost:null };
});
function dragPosition(event) {
  const rect = document.querySelector('#board').getBoundingClientRect();
  const piece = level.pieces.find(p => p.id === drag.id), {w,h} = rotateDimensions(piece,drag.rotation);
  return { rect, w,h, x:Math.round((event.clientX - rect.left) / (rect.width / level.cols) - w/2), y:Math.round((event.clientY - rect.top) / (rect.height / level.rows) - h/2) };
}
document.addEventListener('pointermove', event => {
  if (!drag || event.pointerId !== drag.pointerId) return;
  if (!drag.moved && Math.hypot(event.clientX-drag.startX,event.clientY-drag.startY) < 6) return;
  event.preventDefault();
  const {rect,w,h,x,y} = dragPosition(event);
  if (!drag.moved) {
    drag.moved = true; selected = drag.id; updateSelection();
    drag.ghost = document.createElement('div'); drag.ghost.className = 'drag-ghost';
    const piece = level.pieces.find(p => p.id === drag.id);
    const swapped = drag.rotation % 180 !== 0;
    drag.ghost.innerHTML = `<span class="piece-visual" style="--visual-w:${(swapped ? h/w : 1)*95}%;--visual-h:${(swapped ? w/h : 1)*95}%;--art-turn:${drag.rotation}deg">${sprite(piece.type)}</span>`;
    document.body.append(drag.ghost); document.querySelector(`[data-piece="${drag.id}"]`)?.classList.add('dragging');
  }
  Object.assign(drag.ghost.style,{width:`${rect.width / level.cols * w}px`,height:`${rect.height / level.rows * h}px`,left:`${event.clientX}px`,top:`${event.clientY}px`});
  document.querySelectorAll('.cell').forEach((cell,i) => {
    const cx = i % level.cols, cy = Math.floor(i / level.cols);
    const highlighted = cx >= x && cx < x+w && cy >= y && cy < y+h;
    cell.classList.toggle('landing',highlighted); cell.classList.toggle('invalid',highlighted && !validatePlacement(level,placements,drag.id,x,y,drag.rotation));
  });
}, {passive:false});
function endDrag(event, cancelled = false) {
  if (!drag || event.pointerId !== drag.pointerId) return;
  if (drag.moved) {
    suppressClick = true; setTimeout(() => { suppressClick = false; }, 0);
    const {rect,x,y} = dragPosition(event);
    if (!cancelled && event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom) place(drag.id,x,y,drag.rotation);
    else if (!cancelled && placements[drag.id]) {
      const tray = document.querySelector('#tray').getBoundingClientRect();
      if (event.clientY >= tray.top && event.clientY <= tray.bottom && event.clientX >= tray.left && event.clientX <= tray.right) {
        snapshot(); delete placements[drag.id]; moves++; rotations[drag.id] = drag.rotation; renderPieces(); persist();
      }
    }
    drag.ghost?.remove(); document.querySelectorAll('.cell').forEach(c => c.classList.remove('landing','invalid')); document.querySelectorAll('.dragging').forEach(c => c.classList.remove('dragging'));
  }
  drag = null;
}
document.addEventListener('pointerup', e => endDrag(e));
document.addEventListener('pointercancel', e => endDrag(e,true));
document.addEventListener('keydown', event => {
  if (document.querySelector('#modal')?.open || drag) return;
  if (event.key.toLowerCase() === 'r') { event.preventDefault(); rotate(); }
  if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); unpack(); }
  if (event.key === 'Escape') { selected = null; updateSelection(); }
});
loadLevel();
if ('serviceWorker' in navigator && import.meta.env.PROD && location.protocol !== 'file:' && !document.documentElement.hasAttribute('data-standalone')) {
  window.addEventListener('load', () => navigator.serviceWorker.register(`${BASE}sw.js`, {scope:BASE}).catch(() => {}));
}
