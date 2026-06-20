/* =========================================================================
 * light.js — The optical simulation engine for HELIOS
 *
 * This is the heart of the game: a deterministic light simulator. Sunlight
 * is emitted, travels in straight rays, and interacts with pieces on a grid:
 *
 *   MIRROR    reflects a beam 90 degrees ( / or \ )
 *   SPLITTER  passes a beam straight AND reflects a copy 90 degrees
 *   WALL      absorbs a beam
 *   PRISM     a target crystal: lights up when any beam reaches it
 *   GATE      an OPTICAL LOGIC GATE (AND / OR / XOR / NOT) — the Turing tribute.
 *             Gates read whether their input ports are lit and emit a beam
 *             from their output port accordingly.
 *
 * Because a gate's output can feed another gate's input (and beams can loop
 * via mirrors), the simulator iterates to a FIXPOINT — exactly how one
 * simulates a logic circuit. If the circuit never settles (e.g. a NOT gate
 * feeding itself), we detect the instability rather than hang.
 *
 * The module is environment-agnostic: it attaches to `window` in the browser
 * and to `module.exports` under Node, so the engine can be unit-tested
 * headlessly with zero DOM.
 * ========================================================================= */

(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.Light = api;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  // Direction indices and their grid deltas.
  // 0 = North (up), 1 = East (right), 2 = South (down), 3 = West (left)
  const DIRS = [
    { dx: 0, dy: -1 },
    { dx: 1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 0 }
  ];
  const OPP = [2, 3, 0, 1]; // opposite direction

  // Mirror reflection tables (incoming direction -> outgoing direction).
  // '/'  swaps North<->East and South<->West.
  // '\\' swaps North<->West and South<->East.
  const REFLECT = {
    '/': { 0: 1, 1: 0, 2: 3, 3: 2 },
    '\\': { 0: 3, 3: 0, 1: 2, 2: 1 }
  };

  // Piece type constants.
  const T = {
    EMPTY: 'empty',
    WALL: 'wall',
    MIRROR: 'mirror',
    SPLITTER: 'splitter',
    EMITTER: 'emitter',
    PRISM: 'prism',
    GATE: 'gate'
  };

  /**
   * Determine the input/output port layout for a gate given its output
   * direction `dir`.
   *   - NOT gate: single input on the side opposite the output.
   *   - AND/OR/XOR: two inputs on the sides perpendicular to the output.
   */
  function gatePorts(gateType, dir) {
    if (gateType === 'NOT') {
      return { inputs: [(dir + 2) % 4], output: dir };
    }
    return { inputs: [(dir + 1) % 4, (dir + 3) % 4], output: dir };
  }

  /** Evaluate a gate's boolean output from the state of its input ports. */
  function evalGate(gateType, inputBits) {
    const on = inputBits.filter(Boolean).length;
    switch (gateType) {
      case 'AND': return inputBits.length >= 2 && on === inputBits.length;
      case 'OR': return on >= 1;
      case 'XOR': return on === 1;
      case 'NOT': return inputBits.length >= 1 && !inputBits[0];
      case 'NAND': return !(inputBits.length >= 2 && on === inputBits.length);
      case 'NOR': return on === 0;
      default: return false;
    }
  }

  /**
   * A Board holds the grid and all pieces. Pieces are stored sparsely in a
   * Map keyed by "x,y". Empty cells simply have no entry.
   */
  class Board {
    constructor(width, height) {
      this.width = width;
      this.height = height;
      this.cells = new Map();
      this._gateId = 0;
    }

    key(x, y) { return x + ',' + y; }
    inBounds(x, y) { return x >= 0 && y >= 0 && x < this.width && y < this.height; }
    get(x, y) { return this.cells.get(this.key(x, y)) || null; }

    set(x, y, piece) {
      piece.x = x;
      piece.y = y;
      this.cells.set(this.key(x, y), piece);
      return piece;
    }

    remove(x, y) { this.cells.delete(this.key(x, y)); }

    /** Convenience builders. */
    addEmitter(x, y, dir) { return this.set(x, y, { type: T.EMITTER, dir }); }
    addWall(x, y) { return this.set(x, y, { type: T.WALL }); }
    addMirror(x, y, orient) { return this.set(x, y, { type: T.MIRROR, orient }); }
    addSplitter(x, y, orient) { return this.set(x, y, { type: T.SPLITTER, orient }); }
    addPrism(x, y, id) { return this.set(x, y, { type: T.PRISM, id: id || ('p' + x + '_' + y) }); }
    addGate(x, y, gateType, dir) {
      return this.set(x, y, { type: T.GATE, gateType, dir, id: 'g' + (this._gateId++) });
    }

    gates() {
      const list = [];
      for (const piece of this.cells.values()) if (piece.type === T.GATE) list.push(piece);
      return list;
    }

    prisms() {
      const list = [];
      for (const piece of this.cells.values()) if (piece.type === T.PRISM) list.push(piece);
      return list;
    }
  }

  /**
   * Trace every beam for the current set of active light sources.
   * `gateOn` maps gateId -> boolean (whether that gate is currently emitting).
   *
   * Returns:
   *   segments  : array of {x1,y1,x2,y2} cell-center segments (for rendering)
   *   gateInputs: map gateId -> { portDir: true } (which input ports got light)
   *   litPrisms : Set of prism ids that received light
   */
  function traceBeams(board, gateOn) {
    const segments = [];
    const gateInputs = {};
    const litPrisms = new Set();
    const visited = new Set(); // "x,y,dir" guards against mirror loops

    board.gates().forEach((g) => { gateInputs[g.id] = {}; });

    // Collect light sources: sun emitters always on; gates on per gateOn.
    const sources = [];
    for (const piece of board.cells.values()) {
      if (piece.type === T.EMITTER) {
        sources.push({ x: piece.x, y: piece.y, dir: piece.dir });
      } else if (piece.type === T.GATE && gateOn[piece.id]) {
        const { output } = gatePorts(piece.gateType, piece.dir);
        sources.push({ x: piece.x, y: piece.y, dir: output });
      }
    }

    // Iterative ray walker with an explicit stack (splitters push branches).
    const stack = sources.map((s) => ({ x: s.x, y: s.y, dir: s.dir }));

    while (stack.length) {
      let { x, y, dir } = stack.pop();

      // Walk in a straight line until the beam is consumed or leaves the grid.
      while (true) {
        const d = DIRS[dir];
        const nx = x + d.dx;
        const ny = y + d.dy;
        if (!board.inBounds(nx, ny)) break;

        const vkey = nx + ',' + ny + ',' + dir;
        if (visited.has(vkey)) break;
        visited.add(vkey);

        segments.push({ x1: x, y1: y, x2: nx, y2: ny });

        const cell = board.get(nx, ny);
        if (!cell || cell.type === T.EMPTY) { x = nx; y = ny; continue; }

        if (cell.type === T.WALL) break;

        if (cell.type === T.MIRROR) {
          dir = REFLECT[cell.orient][dir];
          x = nx; y = ny; continue;
        }

        if (cell.type === T.SPLITTER) {
          const branchDir = REFLECT[cell.orient][dir];
          stack.push({ x: nx, y: ny, dir: branchDir }); // perpendicular copy
          x = nx; y = ny; continue;                      // straight beam continues
        }

        if (cell.type === T.PRISM) { litPrisms.add(cell.id); break; }

        if (cell.type === T.GATE) {
          const port = OPP[dir]; // side of the gate the beam enters from
          const { inputs } = gatePorts(cell.gateType, cell.dir);
          if (inputs.indexOf(port) !== -1) gateInputs[cell.id][port] = true;
          break; // gate absorbs the beam
        }

        break;
      }
    }

    return { segments, gateInputs, litPrisms };
  }

  /**
   * Run the full simulation to a fixpoint.
   * Returns { segments, litPrisms, gateOn, stable, iterations }.
   */
  function simulate(board, maxIter = 40) {
    const gates = board.gates();
    let gateOn = {};
    gates.forEach((g) => { gateOn[g.id] = false; });

    let trace = traceBeams(board, gateOn);
    let stable = true;
    let iterations = 0;

    for (let i = 0; i < maxIter; i++) {
      iterations = i + 1;
      const next = {};
      let changed = false;
      for (const g of gates) {
        const ports = gatePorts(g.gateType, g.dir);
        const bits = ports.inputs.map((p) => !!trace.gateInputs[g.id][p]);
        const out = evalGate(g.gateType, bits);
        next[g.id] = out;
        if (out !== gateOn[g.id]) changed = true;
      }
      gateOn = next;
      trace = traceBeams(board, gateOn);
      if (!changed) { stable = true; break; }
      if (i === maxIter - 1) stable = false; // never settled (oscillating)
    }

    if (gates.length === 0) stable = true;

    return {
      segments: trace.segments,
      litPrisms: trace.litPrisms,
      gateInputs: trace.gateInputs,
      gateOn,
      stable,
      iterations
    };
  }

  /** Are all prisms on the board lit (and the circuit stable)? */
  function isSolved(board, result) {
    if (!result.stable) return false;
    const prisms = board.prisms();
    if (prisms.length === 0) return false;
    return prisms.every((p) => result.litPrisms.has(p.id));
  }

  return {
    DIRS, OPP, REFLECT, T,
    Board, gatePorts, evalGate, traceBeams, simulate, isSolved
  };
});
