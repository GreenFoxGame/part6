/* ============================================
   КОНФИГ — ЗАМЕНИ ПУТИ НА СВОИ КАРТИНКИ
   ============================================ */
const CONFIG = {
  backgrounds: { 1:'assets/bg/player1.png', 2:'assets/bg/player2.png', 3:'assets/bg/player3.png', 4:'assets/bg/player4.png', 5:'assets/bg/player5.png', 6:'assets/bg/player6.png' },
  players:     { 1:'assets/players/1.png', 2:'assets/players/2.png', 3:'assets/players/3.png', 4:'assets/players/4.png', 5:'assets/players/5.png', 6:'assets/players/6.png' },
  items: {
    wine:    'assets/items/wine.png',
    pumpkin: 'assets/items/pumpkin.png',
    candle:  'assets/items/candle.png',
    paint:   'assets/items/paint.png',
  },
  labels: { wine:'ВИНО', pumpkin:'ТЫКВА', candle:'СВЕЧА', brush:'КРАСКА', player:'Я' },
    brushColors: {
    dark:  '#4a0a0a',
    base:  '#6b0f0f',
    light: '#9b1b1b',
  },
  brushColor: '#6b0f0f', // текущий выбранный цвет (по умолчанию базовый)
  baseSize: 120,
  playerSize: 180,
  pixelStep: 6,
};

const state = {
  playerId: null,
  activeTool: null,
  brushSize: 8,
  activeBrushColor: CONFIG.brushColor,
  scale: 1, tx: 0, ty: 0,
  placedCounts: { wine:0, pumpkin:0, candle:0, player:0 },
  selectedItem: null,
  savedSizes: { wine:120, pumpkin:120, candle:120, player:180 },
};

/* ============================================
   DOM
   ============================================ */
const $ = id => document.getElementById(id);
const loginModal = $('loginModal');
const gameEl = $('game');
const field = $('field');
const world = $('world');
const bgImg = $('bg');
const canvas = $('drawCanvas');
const ctx = canvas.getContext('2d');
const objectsLayer = $('objectsLayer');
const toolbar = $('toolbar');
const brushSettings = $('brushSettings');
const brushSizeInput = $('brushSize');
const brushSizeLabel = $('brushSizeLabel');
const brushPreview = $('brushPreview');
const hudPlayer = $('hud-player');
const finishBtn = $('finishBtn');
const tooltip = $('tooltip');
const ttTitle = $('ttTitle');
const ttDesc = $('ttDesc');
const ttBtn = $('ttBtn');
const undoBtn = $('undoBtn');
const sizeSettings = $('sizeSettings');
const itemSizeInput = $('itemSize');
const itemSizeLabel = $('itemSizeLabel');
const playerToolIcon = $('playerToolIcon');
const colorBtns = document.querySelectorAll('.color-btn');

/* ============================================
   ВСПОМОГАТЕЛЬНОЕ
   ============================================ */
function showPopup(title, desc, onOk) {
  ttTitle.textContent = title;
  ttDesc.innerHTML = desc;
  tooltip.classList.add('active');
  ttBtn.onclick = () => {
    tooltip.classList.remove('active');
    if (onOk) onOk();
  };
}

/* ============================================
   ВЫБОР ИГРОКА
   ============================================ */
document.querySelectorAll('.player-pick').forEach(btn => {
  btn.addEventListener('click', () => {
    const id = parseInt(btn.dataset.id, 10);
    startGame(id);
  });
});

function startGame(id) {
  state.playerId = id;
  loginModal.classList.remove('active');
  gameEl.hidden = false;
  hudPlayer.textContent = id;

  if (playerToolIcon) playerToolIcon.src = CONFIG.players[id];
  bgImg.src = CONFIG.backgrounds[id];

  if (bgImg.complete && bgImg.naturalWidth) {
    setupCanvas();
  } else {
    bgImg.onload = setupCanvas;
  }
}

/* ============================================
   НАСТРОЙКА CANVAS
   ============================================ */
function setupCanvas() {
  const w = bgImg.naturalWidth || 1200;
  const h = bgImg.naturalHeight || 1600;

  bgImg.style.width = w + 'px';
  bgImg.style.height = h + 'px';

  canvas.width = w;
  canvas.height = h;
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';

  objectsLayer.style.width = w + 'px';
  objectsLayer.style.height = h + 'px';
  world.style.width = w + 'px';
  world.style.height = h + 'px';

  ctx.imageSmoothingEnabled = false;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  fitToScreen();
}

function fitToScreen() {
  const fw = field.clientWidth;
  const fh = field.clientHeight;
  const w = canvas.width;
  const h = canvas.height;
  const s = Math.min(fw / w, fh / h) * 0.95;
  state.scale = s;
  state.tx = (fw - w * s) / 2;
  state.ty = (fh - h * s) / 2;
  applyTransform();
}

function applyTransform() {
  world.style.transform = `translate(${state.tx}px, ${state.ty}px) scale(${state.scale})`;
}

function screenToWorld(clientX, clientY) {
  const r = field.getBoundingClientRect();
  const x = (clientX - r.left - state.tx) / state.scale;
  const y = (clientY - r.top - state.ty) / state.scale;
  return { x, y };
}

/* ============================================
   ИНСТРУМЕНТЫ (панель)
   ============================================ */
toolbar.querySelectorAll('.tool').forEach(el => {
  el.addEventListener('click', () => {
    const tool = el.dataset.tool;
    if (!tool) return; // для кнопки отмены

    if (tool === 'brush') {
      // Если кисть уже активна — выключаем её (toggle)
      if (state.activeTool === 'brush') {
        deactivateBrush();
      } else {
        activateBrush(el);
      }
      return;
    }

    // Если выбран любой другой инструмент — выключаем кисть
    deactivateBrush();

    // Для остальных инструментов — добавляем объект
    spawnObject(tool);

    el.classList.add('active');
    setTimeout(() => el.classList.remove('active'), 150);
  });
});

function activateBrush(el) {
  state.activeTool = 'brush';
  toolbar.querySelectorAll('.tool').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  brushSettings.classList.add('visible');
  sizeSettings.classList.remove('visible');
  deselectItem();
}

function deactivateBrush() {
  state.activeTool = null;
  toolbar.querySelectorAll('.tool[data-tool="brush"]').forEach(t => t.classList.remove('active'));
  brushSettings.classList.remove('visible');
}

/* кисть: настройки */
brushSizeInput.addEventListener('input', () => {
  state.brushSize = parseInt(brushSizeInput.value, 10);
  brushSizeLabel.textContent = state.brushSize;
  brushPreview.style.width = Math.max(8, state.brushSize) + 'px';
  brushPreview.style.height = Math.max(8, state.brushSize) + 'px';
});

/* ============================================
   ПИКСЕЛЬНАЯ КИСТЬ И UNDO (КИСТЬ)
   ============================================ */
let drawing = false;
let lastPt = null;

const drawHistory = [];
const MAX_HISTORY = 30;

function isBrushActive() { return state.activeTool === 'brush'; }

function pushDrawHistory() {
  try {
    drawHistory.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    if (drawHistory.length > MAX_HISTORY) drawHistory.shift();
  } catch(_) {}
}

function restoreLastDrawing() {
  if (!drawHistory.length) return false;
  const img = drawHistory.pop();
  ctx.putImageData(img, 0, 0);
  return true;
}

function pixelRect(x, y, size) {
  const step = CONFIG.pixelStep;
  const snapX = Math.floor(x / step) * step;
  const snapY = Math.floor(y / step) * step;
  const half = Math.max(step, Math.round(size / step) * step) / 2;
  const left = Math.floor((snapX - half) / step) * step;
  const top  = Math.floor((snapY - half) / step) * step;
  const w = Math.max(step, Math.round(size / step) * step);
  ctx.fillRect(left, top, w, w);
}

function drawDot(p) {
    ctx.fillStyle = state.activeBrushColor;
  pixelRect(p.x, p.y, state.brushSize);
}

function drawLine(a, b) {  ctx.fillStyle = state.activeBrushColor;
  const dist = Math.hypot(b.x - a.x, b.y - a.y);
  const stepCount = Math.max(1, Math.ceil(dist / (state.brushSize * 0.4)));
  for (let i = 0; i <= stepCount; i++) {
    const t = i / stepCount;
    const x = a.x + (b.x - a.x) * t;
    const y = a.y + (b.y - a.y) * t;
    pixelRect(x, y, state.brushSize);
  }
}

field.addEventListener('pointerdown', e => {
  if (e.target.closest('.placed-item')) return;

  // Если кисть активна — рисуем
  if (isBrushActive() && e.isPrimary) {
    pushDrawHistory();
    drawing = true;
    lastPt = screenToWorld(e.clientX, e.clientY);
    drawDot(lastPt);
    e.preventDefault();
    return;
  }
  // Иначе — панорамирование
  startPan(e);
});

field.addEventListener('pointermove', e => {
  if (drawing) {
    const p = screenToWorld(e.clientX, e.clientY);
    drawLine(lastPt, p);
    lastPt = p;
    e.preventDefault();
    return;
  }
  movePan(e);
});

field.addEventListener('pointerup', endPointer);
field.addEventListener('pointercancel', endPointer);
field.addEventListener('pointerleave', endPointer);

function endPointer(e) {
  if (drawing) { drawing = false; lastPt = null; }
  endPan(e);
}

/* ============================================
   ПАН (ПЕРЕМЕЩЕНИЕ)
   ============================================ */
let panning = false;
let panStart = null;

function startPan(e) {
  if (e.pointerType === 'touch' && pointers.size >= 2) return;
  panning = true;
  panStart = { x: e.clientX, y: e.clientY, tx: state.tx, ty: state.ty };
  field.classList.add('panning');
}

function movePan(e) {
  if (!panning || !panStart) return;
  if (e.pointerType === 'touch' && pointers.size >= 2) return;
  state.tx = panStart.tx + (e.clientX - panStart.x);
  state.ty = panStart.ty + (e.clientY - panStart.y);
  applyTransform();
}

function endPan(e) {
  panning = false;
  panStart = null;
  field.classList.remove('panning');
}

/* ============================================
   ЗУМ
   ============================================ */
field.addEventListener('wheel', e => {
  e.preventDefault();
  const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
  zoomAt(e.clientX, e.clientY, factor);
}, { passive: false });

function zoomAt(clientX, clientY, factor) {
  const r = field.getBoundingClientRect();
  const px = clientX - r.left;
  const py = clientY - r.top;
  const newScale = clamp(state.scale * factor, 0.1, 8);
  const k = newScale / state.scale;
  state.tx = px - (px - state.tx) * k;
  state.ty = py - (py - state.ty) * k;
  state.scale = newScale;
  applyTransform();
}

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

/* ============================================
   PINCH-ЗУМ ДВУМЯ ПАЛЬЦАМИ
   ============================================ */
const pointers = new Map();
let pinchStart = null;

field.addEventListener('pointerdown', e => {
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 2) {
    drawing = false;
    lastPt = null;
    panning = false;
    panStart = null;
    const pts = [...pointers.values()];
    pinchStart = {
      dist: dist2(pts[0], pts[1]),
      mid: mid2(pts[0], pts[1]),
      scale: state.scale,
      tx: state.tx, ty: state.ty,
    };
  }
}, true);

field.addEventListener('pointermove', e => {
  if (!pointers.has(e.pointerId)) return;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

  if (pointers.size === 2 && pinchStart) {
    const pts = [...pointers.values()];
    const d = dist2(pts[0], pts[1]);
    const m = mid2(pts[0], pts[1]);
    const factor = d / pinchStart.dist;
    const newScale = clamp(pinchStart.scale * factor, 0.1, 8);
    const k = newScale / pinchStart.scale;
    const r = field.getBoundingClientRect();
    const px = m.x - r.left;
    const py = m.y - r.top;
    const startPx = pinchStart.mid.x - r.left;
    const startPy = pinchStart.mid.y - r.top;

    let tx = startPx - (startPx - pinchStart.tx) * k;
    let ty = startPy - (startPy - pinchStart.ty) * k;
    tx += (px - startPx);
    ty += (py - startPy);

    state.scale = newScale;
    state.tx = tx; state.ty = ty;
    applyTransform();
    e.preventDefault();
  }
}, true);

field.addEventListener('pointerup', e => {
  pointers.delete(e.pointerId);
  if (pointers.size < 2) pinchStart = null;
}, true);
field.addEventListener('pointercancel', e => {
  pointers.delete(e.pointerId);
  if (pointers.size < 2) pinchStart = null;
}, true);

function dist2(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function mid2(a, b) { return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; }

/* ============================================
   ДОБАВЛЕНИЕ И УПРАВЛЕНИЕ ОБЪЕКТАМИ
   ============================================ */
const placedHistory = [];

function spawnObject(type) {
  let size = state.savedSizes[type] || (type === 'player' ? CONFIG.playerSize : CONFIG.baseSize);

  const centerScreen = { x: field.clientWidth / 2, y: field.clientHeight / 2 };
  const wp = screenToWorld(
    centerScreen.x + field.getBoundingClientRect().left,
    centerScreen.y + field.getBoundingClientRect().top
  );

  const el = document.createElement('div');
  el.className = 'placed-item';
  el.dataset.type = type;
  el.style.width = size + 'px';
  el.style.height = size + 'px';
  el.style.left = (wp.x - size / 2) + 'px';
  el.style.top = (wp.y - size / 2) + 'px';

  const src = type === 'player' ? CONFIG.players[state.playerId] : CONFIG.items[type];
  const img = new Image();
  img.src = src;
  img.style.width = '100%';
  img.style.height = '100%';
  img.style.objectFit = 'contain';
  img.onerror = () => {
    img.remove();
    const ph = document.createElement('div');
    ph.className = 'ph-label';
    ph.textContent = CONFIG.labels[type] || type;
    el.appendChild(ph);
  };
  el.appendChild(img);

  const badge = document.createElement('div');
  badge.className = 'remove-badge';
  badge.textContent = '×';
  badge.addEventListener('pointerdown', e => {
    e.stopPropagation();
    removeItem(el);
  });
  el.appendChild(badge);

  makeDraggable(el);
  objectsLayer.appendChild(el);
  placedHistory.push(el);

  state.placedCounts[type] = (state.placedCounts[type] || 0) + 1;
  selectItem(el);
}

function selectItem(el) {
  if (state.selectedItem) state.selectedItem.classList.remove('selected');
  state.selectedItem = el;
  el.classList.add('selected');

  // Выключаем кисть, если был активен, чтобы не рисовать поверх
  deactivateBrush();

  const w = parseFloat(el.style.width) || CONFIG.baseSize;
  itemSizeInput.value = Math.min(500, Math.round(w));
  itemSizeLabel.textContent = Math.round(w);
  sizeSettings.classList.add('visible');
}

function deselectItem() {
  if (state.selectedItem) {
    state.selectedItem.classList.remove('selected');
    state.selectedItem = null;
  }
  sizeSettings.classList.remove('visible');
}

function removeItem(el) {
  const type = el.dataset.type;
  state.placedCounts[type] = Math.max(0, (state.placedCounts[type] || 0) - 1);
  if (state.selectedItem === el) deselectItem();
  el.remove();
  const idx = placedHistory.indexOf(el);
  if (idx !== -1) placedHistory.splice(idx, 1);
}

// клик по пустому месту — снять выделение
field.addEventListener('pointerdown', e => {
  if (!e.target.closest('.placed-item')) deselectItem();
}, true);

/* Слайдер размера объекта */
itemSizeInput.addEventListener('input', () => {
  const el = state.selectedItem;
  if (!el) return;
  const newSize = parseInt(itemSizeInput.value, 10);
  itemSizeLabel.textContent = newSize;

  const oldSize = parseFloat(el.style.width) || newSize;
  const left = parseFloat(el.style.left) || 0;
  const top  = parseFloat(el.style.top)  || 0;
  const cx = left + oldSize / 2;
  const cy = top  + oldSize / 2;

  el.style.width  = newSize + 'px';
  el.style.height = newSize + 'px';
  el.style.left = (cx - newSize / 2) + 'px';
  el.style.top  = (cy - newSize / 2) + 'px';

  state.savedSizes[el.dataset.type] = newSize;
});

/* ============================================
   ПЕРЕТАСКИВАНИЕ ОБЪЕКТОВ
   ============================================ */
function makeDraggable(el) {
  let drag = false;
  let startX = 0, startY = 0, startLeft = 0, startTop = 0;

  el.addEventListener('pointerdown', e => {
    if (e.target.classList.contains('remove-badge')) return;
    selectItem(el);
    drag = true;
    el.classList.add('dragging');
    startX = e.clientX;
    startY = e.clientY;
    startLeft = parseFloat(el.style.left) || 0;
    startTop = parseFloat(el.style.top) || 0;
    el.setPointerCapture(e.pointerId);
    e.stopPropagation();
    e.preventDefault();
  });

  el.addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = (e.clientX - startX) / state.scale;
    const dy = (e.clientY - startY) / state.scale;
    el.style.left = (startLeft + dx) + 'px';
    el.style.top = (startTop + dy) + 'px';
    e.stopPropagation();
  });

  function stopDrag(e) {
    if (!drag) return;
    drag = false;
    el.classList.remove('dragging');
    try { el.releasePointerCapture(e.pointerId); } catch (_) {}
  }
  el.addEventListener('pointerup', stopDrag);
  el.addEventListener('pointercancel', stopDrag);
}

/* ============================================
   ОТМЕНА ДЕЙСТВИЯ (КНОПКА UNDO)
   ============================================ */
undoBtn.addEventListener('click', () => {
  if (drawHistory.length) {
    restoreLastDrawing();
    return;
  }
  while (placedHistory.length) {
    const el = placedHistory.pop();
    if (el && el.isConnected) {
      removeItem(el);
      return;
    }
  }
  showPopup('ОТМЕНА', 'Нечего отменять.', null);
});

/* ============================================
   ПРОВЕРКА И ЭКСПОРТ
   ============================================ */
function validateAll() {
  const missing = [];
  if (!state.placedCounts.wine)    missing.push('ВИНО');
  if (!state.placedCounts.pumpkin) missing.push('ТЫКВА');
  if (!state.placedCounts.candle)  missing.push('СВЕЧА');
  if (!state.placedCounts.player)  missing.push('СЕБЯ (игрока)');
  return missing;
}

finishBtn.addEventListener('click', () => {
  const missing = validateAll();
  if (missing.length) {
    showPopup('ЕЩЁ НЕ ВСЁ', 'Ты не расставил(а):<br><br>' + missing.map(m => '• ' + m).join('<br>'), null);
    return;
  }
  exportImage();
});

function exportImage() {
  deselectItem();

  const w = canvas.width;
  const h = canvas.height;
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const octx = out.getContext('2d');

  try {
    octx.drawImage(bgImg, 0, 0, w, h);
  } catch (_) {
    octx.fillStyle = '#000';
    octx.fillRect(0, 0, w, h);
  }

  octx.drawImage(canvas, 0, 0);

  const items = objectsLayer.querySelectorAll('.placed-item');
  items.forEach(el => {
    const left = parseFloat(el.style.left) || 0;
    const top  = parseFloat(el.style.top)  || 0;
    const iw   = parseFloat(el.style.width)  || 0;
    const ih   = parseFloat(el.style.height) || 0;

    const img = el.querySelector('img');
    if (img && img.complete && img.naturalWidth) {
      octx.drawImage(img, left, top, iw, ih);
    } else {
      octx.fillStyle = 'rgba(40,40,40,.85)';
      octx.fillRect(left, top, iw, ih);
      octx.strokeStyle = '#555';
      octx.lineWidth = 2;
      octx.strokeRect(left, top, iw, ih);
      octx.fillStyle = '#eee';
      octx.font = 'bold 14px monospace';
      octx.textAlign = 'center';
      octx.textBaseline = 'middle';
      octx.fillText(CONFIG.labels[el.dataset.type] || '', left + iw / 2, top + ih / 2);
    }
  });

  const filename = 'player' + state.playerId + '_' + Date.now() + '.png';

  out.toBlob(blob => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);

    showPopup('ГОТОВО!', 'Картинка сохранена.<br>Если на телефоне не сохранилась в галерею —<br>открой её из загрузок и нажми «Сохранить».', null);
  }, 'image/png');
}

/* ============================================
   ВЫБОР ЦВЕТА КИСТИ
   ============================================ */
// const colorBtns уже объявлена выше — здесь НЕ объявляем повторно

colorBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    // Убираем активный класс у ВСЕХ кнопок
    colorBtns.forEach(b => b.classList.remove('active'));

    // Добавляем активный класс ТОЛЬКО текущей
    btn.classList.add('active');

    // Устанавливаем текущий цвет в состояние
    state.activeBrushColor = btn.dataset.color;
    CONFIG.brushColor = btn.dataset.color;

    // Меняем цвет кружочка-предпросмотра
    if (brushPreview) brushPreview.style.background = btn.dataset.color;
  });
});

/* ============================================
   RESIZE (Поворот экрана)
   ============================================ */
let resizeTimer = null;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (state.playerId && canvas.width) fitToScreen();
  }, 150);
});