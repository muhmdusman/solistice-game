/* =========================================================================
 * game.js — HELIOS game controller
 *
 * Owns the game loop, level progression, the daylight clock, drag-and-drop
 * placement, rotation, scoring, and screen flow. It builds a Light.Board
 * from the current level definition, re-simulates after every player action,
 * hands the result to the renderer, and checks for the win condition.
 * ========================================================================= */

(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const L = window.Light;
  const LEVELS = window.LEVELS;

  const screens = {
    title: $('#title-screen'),
    how: $('#how-screen'),
    game: $('#game-screen'),
    end: $('#end-screen')
  };

  const boardCanvas = $('#board');
  const renderer = new window.Renderer(boardCanvas);
  const sky = new window.Sky('bg');
  sky.start();

  // --- Persistent best score ---
  const BEST_KEY = 'helios_best';
  function getBest() { return parseInt(localStorage.getItem(BEST_KEY) || '0', 10); }
  function setBest(v) { localStorage.setItem(BEST_KEY, String(v)); }

  // --- State ---
  const state = {
    levelIndex: 0,
    score: 0,
    levelScore: 0,
    board: null,
    result: null,
    level: null,
    tray: [],          // remaining tray pieces: {type, id, placed:false, x,y}
    placed: [],        // player-placed pieces on the board
    daylight: 100,
    running: false,
    cleared: false,
    lastTs: 0,
    drag: null,        // active drag piece
    hintUsed: false
  };

  function showScreen(name) {
    Object.values(screens).forEach((s) => s.classList.remove('active'));
    screens[name].classList.add('active');
  }

  // ---- Build the board for a level ----
  function buildBoard(level) {
    const b = new L.Board(level.width, level.height);
    const f = level.fixed;
    (f.emitters || []).forEach((e) => b.addEmitter(e.x, e.y, e.dir));
    (f.prisms || []).forEach((p) => b.addPrism(p.x, p.y, p.id));
    (f.walls || []).forEach((w) => b.addWall(w.x, w.y));
    (f.mirrors || []).forEach((m) => b.addMirror(m.x, m.y, m.orient));
    (f.gates || []).forEach((g) => b.addGate(g.x, g.y, g.gateType, g.dir));
    return b;
  }

  function loadLevel(index) {
    const level = LEVELS[index];
    state.level = level;
    state.levelIndex = index;
    state.board = buildBoard(level);
    state.placed = [];
    state.cleared = false;
    state.hintUsed = false;
    state.daylight = 100;
    state.levelScore = 0;

    // Build tray entries with stable ids.
    state.tray = (level.tray || []).map((p, i) => ({
      type: p.type, id: `tray_${index}_${i}`, placed: false, x: null, y: null
    }));

    $('#level-num').textContent = index + 1;
    $('#level-total').textContent = LEVELS.length;
    $('#level-name').textContent = level.name;
    $('#level-time').textContent = level.time;
    $('#story').textContent = level.story;

    renderer.layout(state.board);
    renderTray();
    resimulate();
  }

  // ---- Simulation ----
  function resimulate() {
    state.result = L.simulate(state.board);
    renderer.setResult(state.result);
    checkWin();
    updateStatus();
  }

  function updateStatus() {
    const prisms = state.board.prisms();
    const lit = prisms.filter((p) => state.result.litPrisms.has(p.id)).length;
    const el = $('#status-line');
    if (!state.result.stable) {
      el.innerHTML = '<span class="warn">Circuit unstable \u2014 the gates can\u2019t settle.</span>';
    } else {
      el.innerHTML = `Crystals lit: <strong>${lit} / ${prisms.length}</strong>`;
    }
  }

  function checkWin() {
    if (state.cleared) return;
    if (L.isSolved(state.board, state.result)) {
      state.cleared = true;
      state.running = false;
      audioKit.litCrystal();
      setTimeout(levelCleared, 700);
    }
  }

  // ---- Tray rendering ----
  function renderTray() {
    const tray = $('#tray');
    tray.innerHTML = '';
    state.tray.forEach((piece) => {
      const el = document.createElement('div');
      el.className = 'tray-piece' + (piece.placed ? ' used' : '');
      el.dataset.id = piece.id;
      el.draggable = !piece.placed;
      el.innerHTML = `
        <div class="tray-icon ${piece.type}"></div>
        <span class="tray-name">${piece.type}</span>
      `;
      if (!piece.placed) {
        el.addEventListener('dragstart', (e) => {
          state.drag = piece;
          renderer.dragType = piece.type;
          e.dataTransfer.setData('text/plain', piece.id);
          e.dataTransfer.effectAllowed = 'move';
        });
        el.addEventListener('dragend', () => {
          state.drag = null; renderer.dragType = null; renderer.hoverCell = null;
        });
        // Touch / click fallback: tap a piece then tap a cell.
        el.addEventListener('click', () => selectForTap(piece, el));
      }
      tray.appendChild(el);
    });
  }

  // Tap-to-place fallback for touch devices.
  let tapPiece = null;
  function selectForTap(piece, el) {
    if (piece.placed) return;
    tapPiece = (tapPiece === piece) ? null : piece;
    document.querySelectorAll('.tray-piece').forEach((p) => p.classList.remove('selected'));
    if (tapPiece) el.classList.add('selected');
  }

  // ---- Placement / rotation ----
  function placePiece(piece, x, y) {
    if (state.board.get(x, y)) { audioKit.error(); flashToast('That cell is occupied.', 'bad'); return false; }
    const orient = '/';
    if (piece.type === 'mirror') state.board.addMirror(x, y, orient);
    else if (piece.type === 'splitter') state.board.addSplitter(x, y, orient);
    else return false;
    piece.placed = true; piece.x = x; piece.y = y;
    state.placed.push(piece);
    audioKit.place();
    renderTray();
    resimulate();
    return true;
  }

  function rotatePieceAt(x, y) {
    const cell = state.board.get(x, y);
    if (!cell) return;
    // Only player-placed mirrors/splitters rotate (fixed pieces are locked).
    const owned = state.placed.find((p) => p.x === x && p.y === y);
    if (!owned) return;
    if (cell.type === L.T.MIRROR || cell.type === L.T.SPLITTER) {
      cell.orient = cell.orient === '/' ? '\\' : '/';
      audioKit.rotate();
      resimulate();
    }
  }

  function removePieceAt(x, y) {
    const owned = state.placed.find((p) => p.x === x && p.y === y);
    if (!owned) return;
    state.board.remove(x, y);
    owned.placed = false; owned.x = null; owned.y = null;
    state.placed = state.placed.filter((p) => p !== owned);
    renderTray();
    resimulate();
  }

  // ---- Canvas input ----
  function canvasPoint(e) {
    const rect = boardCanvas.getBoundingClientRect();
    const cxp = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const cyp = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
    return { px: cxp, py: cyp };
  }

  boardCanvas.addEventListener('dragover', (e) => {
    e.preventDefault();
    const { px, py } = canvasPoint(e);
    renderer.hoverCell = renderer.cellAt(px, py);
  });
  boardCanvas.addEventListener('drop', (e) => {
    e.preventDefault();
    const { px, py } = canvasPoint(e);
    const cell = renderer.cellAt(px, py);
    renderer.hoverCell = null;
    if (cell && state.drag) placePiece(state.drag, cell.x, cell.y);
    state.drag = null; renderer.dragType = null;
  });

  // Click: tap-place, rotate placed piece, or (with modifier) remove.
  boardCanvas.addEventListener('click', (e) => {
    const { px, py } = canvasPoint(e);
    const cell = renderer.cellAt(px, py);
    if (!cell) return;
    if (tapPiece && !state.board.get(cell.x, cell.y)) {
      placePiece(tapPiece, cell.x, cell.y);
      tapPiece = null;
      document.querySelectorAll('.tray-piece').forEach((p) => p.classList.remove('selected'));
      return;
    }
    if (e.shiftKey) removePieceAt(cell.x, cell.y);
    else rotatePieceAt(cell.x, cell.y);
  });

  // Right-click removes a placed piece.
  boardCanvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const { px, py } = canvasPoint(e);
    const cell = renderer.cellAt(px, py);
    if (cell) removePieceAt(cell.x, cell.y);
  });

  // ---- Buttons ----
  function resetLevel() { loadLevel(state.levelIndex); flashToast('Board reset.', 'warn'); }

  function useHint() {
    if (state.hintUsed) { flashToast('Hint already shown.', 'warn'); return; }
    state.hintUsed = true;
    state.daylight = Math.max(0, state.daylight - 12);
    flashToast(state.level.hint, 'warn', 3200);
  }

  // ---- Daylight clock ----
  function tick(ts) {
    if (!state.running) return;
    if (!state.lastTs) state.lastTs = ts;
    const dt = (ts - state.lastTs) / 1000;
    state.lastTs = ts;

    // Drains over ~75s per level; the solstice gives generous light.
    state.daylight -= dt * 1.35;
    if (state.daylight <= 0) {
      state.daylight = 0;
      updateSunUI();
      return loseLevel();
    }
    updateSunUI();
    renderer.draw(1 - state.daylight / 100);
    requestAnimationFrame(tick);
  }

  function updateSunUI() {
    $('#sun-fill').style.width = Math.max(0, state.daylight) + '%';
    // The sky background mirrors the daylight clock (0% light => full night).
    sky.setProgress(1 - state.daylight / 100);
  }

  // ---- Level outcomes ----
  function levelCleared() {
    const light = Math.round(state.daylight);
    const hintPenalty = state.hintUsed ? 60 : 0;
    state.levelScore = Math.max(50, 200 + light * 3 - hintPenalty);
    state.score += state.levelScore;
    $('#score').textContent = state.score;

    const rating = light > 65 ? '★★★' : light > 35 ? '★★' : '★';
    $('#clear-score').textContent = state.levelScore;
    $('#clear-rating').textContent = rating;

    const last = state.levelIndex === LEVELS.length - 1;
    $('#clear-title').textContent = last ? 'The Oracle wakes.' : 'Crystals lit.';
    $('#clear-text').textContent = last
      ? 'Light flows through every gate. The circuit holds. The Oracle opens its eye as the longest day ends.'
      : 'The crystals blaze with captured sunlight. The day moves on.';
    $('#next-btn').textContent = last ? 'See the dawn' : 'Continue';

    audioKit.clear();
    $('#level-clear').hidden = false;
  }

  function loseLevel() {
    flashToast('The sun has set. Try this day again.', 'bad', 2600);
    audioKit.error();
    setTimeout(() => loadAndRun(state.levelIndex), 1400);
  }

  function nextLevel() {
    $('#level-clear').hidden = true;
    const next = state.levelIndex + 1;
    if (next >= LEVELS.length) return endGame();
    loadAndRun(next);
  }

  function endGame() {
    state.running = false;
    audioKit.oracle();
    const best = Math.max(getBest(), state.score);
    setBest(best);
    $('#end-score').textContent = state.score;
    $('#end-best').textContent = best;
    $('#end-title').textContent = 'The Oracle wakes.';
    $('#end-text').textContent =
      'You built thinking from sunlight \u2014 mirrors, splitters, and logic gates ' +
      'woven into a working circuit. On the longest day, you held the light long ' +
      'enough to wake a machine that reasons. Turing would have smiled.';
    showScreen('end');
  }

  // ---- Toast ----
  let toastTimer = null;
  function flashToast(msg, kind = 'good', ms = 1700) {
    const t = $('#toast');
    t.textContent = msg;
    t.className = `toast show ${kind}`;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.className = 'toast'; t.hidden = true; }, ms);
  }

  // ---- Flow ----
  function loadAndRun(index) {
    loadLevel(index);
    state.running = true;
    state.lastTs = 0;
    requestAnimationFrame(tick);
  }

  function startGame() {
    audioKit.ensure();
    state.score = 0;
    $('#score').textContent = '0';
    showScreen('game');
    loadAndRun(0);
  }

  // A steady render loop even when the clock isn't running (menus/clear),
  // so beams keep flowing during the level-clear overlay.
  function idleRender() {
    if (screens.game.classList.contains('active') && state.board) {
      if (!state.running) renderer.draw(1 - state.daylight / 100);
    }
    requestAnimationFrame(idleRender);
  }
  requestAnimationFrame(idleRender);

  window.addEventListener('resize', () => {
    if (state.board) { renderer.layout(state.board); }
  });

  // ---- Wire controls ----
  $('#start-btn').addEventListener('click', startGame);
  $('#replay-btn').addEventListener('click', startGame);
  $('#how-btn').addEventListener('click', () => showScreen('how'));
  document.querySelectorAll('.back-btn').forEach((b) =>
    b.addEventListener('click', () => showScreen('title')));
  $('#next-btn').addEventListener('click', nextLevel);
  $('#hint-btn').addEventListener('click', useHint);
  $('#reset-btn').addEventListener('click', resetLevel);

  $('#end-best').textContent = getBest();
  showScreen('title');
})();
