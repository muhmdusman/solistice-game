/* Validate every HELIOS level by brute-forcing tray placements.
 * Confirms: (a) the level is NOT already solved at start, and
 *           (b) at least one placement of the tray pieces solves it.
 * This guarantees players are never handed an impossible (or trivial) board.
 */
const Light = require('../js/light.js');
const LEVELS = require('../js/levels.js');
const { Board, simulate, isSolved } = Light;

function buildBoard(level, placements) {
  const b = new Board(level.width, level.height);
  const f = level.fixed;
  (f.emitters || []).forEach((e) => b.addEmitter(e.x, e.y, e.dir));
  (f.prisms || []).forEach((p) => b.addPrism(p.x, p.y, p.id));
  (f.walls || []).forEach((w) => b.addWall(w.x, w.y));
  (f.mirrors || []).forEach((m) => b.addMirror(m.x, m.y, m.orient));
  (f.gates || []).forEach((g) => b.addGate(g.x, g.y, g.gateType, g.dir));
  // Apply player placements.
  placements.forEach((pl) => {
    if (pl.type === 'mirror') b.addMirror(pl.x, pl.y, pl.orient);
    else if (pl.type === 'splitter') b.addSplitter(pl.x, pl.y, pl.orient);
  });
  return b;
}

// All empty cells (no fixed piece) are candidate placement spots.
function emptyCells(level) {
  const occupied = new Set();
  const f = level.fixed;
  const mark = (x, y) => occupied.add(x + ',' + y);
  (f.emitters || []).forEach((e) => mark(e.x, e.y));
  (f.prisms || []).forEach((p) => mark(p.x, p.y));
  (f.walls || []).forEach((w) => mark(w.x, w.y));
  (f.mirrors || []).forEach((m) => mark(m.x, m.y));
  (f.gates || []).forEach((g) => mark(g.x, g.y));
  const cells = [];
  for (let y = 0; y < level.height; y++) {
    for (let x = 0; x < level.width; x++) {
      if (!occupied.has(x + ',' + y)) cells.push({ x, y });
    }
  }
  return cells;
}

const ORIENTS = ['/', '\\'];

// Recursive search over placements of each tray piece.
function solve(level) {
  const cells = emptyCells(level);
  const tray = level.tray || [];
  let tested = 0;

  function recurse(idx, used, placements) {
    if (idx === tray.length) {
      tested++;
      const board = buildBoard(level, placements);
      const result = simulate(board);
      return isSolved(board, result) ? placements.slice() : null;
    }
    const piece = tray[idx];
    for (const cell of cells) {
      const ck = cell.x + ',' + cell.y;
      if (used.has(ck)) continue;
      for (const orient of ORIENTS) {
        used.add(ck);
        placements.push({ type: piece.type, x: cell.x, y: cell.y, orient });
        const found = recurse(idx + 1, used, placements);
        placements.pop();
        used.delete(ck);
        if (found) return found;
      }
    }
    return null;
  }

  const solution = recurse(0, new Set(), []);
  return { solution, tested };
}

let allGood = true;
for (const level of LEVELS) {
  // Already-solved-at-start check.
  const startBoard = buildBoard(level, []);
  const startResult = simulate(startBoard);
  const triviallySolved = isSolved(startBoard, startResult);

  const { solution, tested } = solve(level);

  const ok = !triviallySolved && !!solution;
  allGood = allGood && ok;

  console.log(
    `Level ${level.id} "${level.name}": ` +
    `${solution ? 'SOLVABLE' : 'NO SOLUTION'} ` +
    `(${tested} configs tested)` +
    (triviallySolved ? ' [!] already solved at start' : '') +
    (solution ? `\n    e.g. ${JSON.stringify(solution)}` : '')
  );
}

console.log(allGood ? '\nAll levels valid.' : '\nSOME LEVELS INVALID.');
process.exit(allGood ? 0 : 1);
