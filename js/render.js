/* =========================================================================
 * render.js — Canvas renderer for the HELIOS board
 *
 * Draws the grid, all pieces, and the live light beams produced by the
 * simulation. Beams animate with a flowing dash so light feels like it's
 * moving. Lit prisms and active gates glow. Pure presentation — it reads the
 * simulation result; it never mutates game state.
 * ========================================================================= */

(function (root, factory) {
  const api = factory();
  if (root) root.Renderer = api;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const L = window.Light;

  class Renderer {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.cell = 56;          // pixel size of a cell (recalculated on layout)
      this.pad = 14;
      this.flow = 0;           // animated dash offset
      this.board = null;
      this.result = null;
      this.hoverCell = null;   // {x,y} for placement preview
      this.dragType = null;    // type being dragged for preview
    }

    layout(board) {
      this.board = board;
      const maxW = Math.min(window.innerWidth - 320, 760);
      const maxH = window.innerHeight - 230;
      const cw = Math.floor((maxW - this.pad * 2) / board.width);
      const ch = Math.floor((maxH - this.pad * 2) / board.height);
      this.cell = Math.max(34, Math.min(64, Math.min(cw, ch)));
      const w = board.width * this.cell + this.pad * 2;
      const h = board.height * this.cell + this.pad * 2;
      const dpr = window.devicePixelRatio || 1;
      this.canvas.width = w * dpr;
      this.canvas.height = h * dpr;
      this.canvas.style.width = w + 'px';
      this.canvas.style.height = h + 'px';
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.pxW = w; this.pxH = h;
    }

    cx(x) { return this.pad + x * this.cell + this.cell / 2; }
    cy(y) { return this.pad + y * this.cell + this.cell / 2; }

    // Convert a pixel point (relative to canvas) to a grid cell.
    cellAt(px, py) {
      const x = Math.floor((px - this.pad) / this.cell);
      const y = Math.floor((py - this.pad) / this.cell);
      if (!this.board || !this.board.inBounds(x, y)) return null;
      return { x, y };
    }

    setResult(result) { this.result = result; }

    draw(dayProgress) {
      const { ctx, cell } = this;
      ctx.clearRect(0, 0, this.pxW, this.pxH);
      this.flow = (this.flow + 0.6) % 1000;

      // Board backdrop tinted by time of day.
      const night = Math.min(1, Math.max(0, dayProgress));
      const base = this._mix([22, 28, 54], [8, 9, 22], night);
      ctx.fillStyle = `rgb(${base[0]},${base[1]},${base[2]})`;
      this._roundRect(0, 0, this.pxW, this.pxH, 16);
      ctx.fill();

      // Grid cells.
      for (let y = 0; y < this.board.height; y++) {
        for (let x = 0; x < this.board.width; x++) {
          const px = this.pad + x * cell;
          const py = this.pad + y * cell;
          ctx.fillStyle = (x + y) % 2 === 0
            ? 'rgba(255,255,255,0.022)'
            : 'rgba(255,255,255,0.045)';
          this._roundRect(px + 2, py + 2, cell - 4, cell - 4, 7);
          ctx.fill();
        }
      }

      // Placement preview.
      if (this.hoverCell && this.dragType) {
        const px = this.pad + this.hoverCell.x * cell;
        const py = this.pad + this.hoverCell.y * cell;
        const occupied = this.board.get(this.hoverCell.x, this.hoverCell.y);
        ctx.fillStyle = occupied ? 'rgba(255,120,110,0.18)' : 'rgba(255,210,130,0.18)';
        this._roundRect(px + 2, py + 2, cell - 4, cell - 4, 7);
        ctx.fill();
      }

      if (this.result) this._drawBeams();
      this._drawPieces();
    }

    _drawBeams() {
      const { ctx, cell } = this;
      const segs = this.result.segments;
      ctx.lineCap = 'round';

      // Glow pass then bright core, with a flowing dash.
      for (const pass of [{ w: cell * 0.20, a: 0.18, dash: false },
                          { w: cell * 0.07, a: 0.95, dash: true }]) {
        ctx.lineWidth = pass.w;
        ctx.strokeStyle = `rgba(255,221,150,${pass.a})`;
        ctx.shadowColor = 'rgba(255,210,120,0.9)';
        ctx.shadowBlur = pass.dash ? 16 : 0;
        if (pass.dash) { ctx.setLineDash([cell * 0.32, cell * 0.32]); ctx.lineDashOffset = -this.flow; }
        else ctx.setLineDash([]);
        ctx.beginPath();
        for (const s of segs) {
          ctx.moveTo(this.cx(s.x1), this.cy(s.y1));
          ctx.lineTo(this.cx(s.x2), this.cy(s.y2));
        }
        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.shadowBlur = 0;
    }

    _drawPieces() {
      const { ctx, cell } = this;
      for (const piece of this.board.cells.values()) {
        const cx = this.cx(piece.x);
        const cy = this.cy(piece.y);
        const r = cell * 0.34;
        switch (piece.type) {
          case L.T.EMITTER: this._drawEmitter(cx, cy, r, piece.dir); break;
          case L.T.WALL: this._drawWall(piece.x, piece.y); break;
          case L.T.MIRROR: this._drawMirror(cx, cy, r, piece.orient); break;
          case L.T.SPLITTER: this._drawSplitter(cx, cy, r, piece.orient); break;
          case L.T.PRISM: this._drawPrism(cx, cy, r, piece); break;
          case L.T.GATE: this._drawGate(cx, cy, r, piece); break;
        }
      }
    }

    _drawEmitter(cx, cy, r, dir) {
      const { ctx } = this;
      ctx.save();
      ctx.translate(cx, cy);
      // Sun disc.
      const g = ctx.createRadialGradient(0, 0, 2, 0, 0, r * 1.4);
      g.addColorStop(0, '#fff4c2');
      g.addColorStop(1, '#f6a93b');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
      // Rays.
      ctx.strokeStyle = 'rgba(255,210,120,0.9)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r * 1.15, Math.sin(a) * r * 1.15);
        ctx.lineTo(Math.cos(a) * r * 1.45, Math.sin(a) * r * 1.45);
        ctx.stroke();
      }
      // Direction nub.
      const d = L.DIRS[dir];
      ctx.fillStyle = '#fff4c2';
      ctx.beginPath();
      ctx.arc(d.dx * r * 0.9, d.dy * r * 0.9, r * 0.22, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    _drawWall(gx, gy) {
      const { ctx, cell } = this;
      const px = this.pad + gx * cell;
      const py = this.pad + gy * cell;
      ctx.fillStyle = 'rgba(120,128,160,0.5)';
      this._roundRect(px + 5, py + 5, cell - 10, cell - 10, 6);
      ctx.fill();
      ctx.strokeStyle = 'rgba(180,190,220,0.35)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    _drawMirror(cx, cy, r, orient) {
      const { ctx } = this;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(orient === '/' ? -Math.PI / 4 : Math.PI / 4);
      const grad = ctx.createLinearGradient(0, -r, 0, r);
      grad.addColorStop(0, '#dff3ff');
      grad.addColorStop(0.5, '#8fb7d6');
      grad.addColorStop(1, '#dff3ff');
      ctx.fillStyle = grad;
      this._rr(ctx, -r * 1.15, -r * 0.22, r * 2.3, r * 0.44, 5);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 1.2; ctx.stroke();
      ctx.restore();
    }

    _drawSplitter(cx, cy, r, orient) {
      const { ctx } = this;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(orient === '/' ? -Math.PI / 4 : Math.PI / 4);
      ctx.fillStyle = 'rgba(150,220,255,0.28)';
      this._rr(ctx, -r * 1.15, -r * 0.5, r * 2.3, r, 6);
      ctx.fill();
      ctx.strokeStyle = 'rgba(180,235,255,0.85)';
      ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(-r * 1.15, 0); ctx.lineTo(r * 1.15, 0); ctx.stroke();
      ctx.restore();
    }

    _drawPrism(cx, cy, r, piece) {
      const { ctx } = this;
      const lit = this.result && this.result.litPrisms.has(piece.id);
      const isOracle = piece.id === 'ORACLE';
      ctx.save();
      ctx.translate(cx, cy);
      if (lit) {
        ctx.shadowColor = isOracle ? 'rgba(180,140,255,0.95)' : 'rgba(120,255,180,0.95)';
        ctx.shadowBlur = 26;
      }
      const sides = 6;
      ctx.beginPath();
      for (let i = 0; i < sides; i++) {
        const a = (i / sides) * Math.PI * 2 - Math.PI / 2;
        const px = Math.cos(a) * r, py = Math.sin(a) * r;
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.closePath();
      if (lit) {
        const g = ctx.createRadialGradient(0, 0, 2, 0, 0, r);
        g.addColorStop(0, isOracle ? '#e9d4ff' : '#d7ffe9');
        g.addColorStop(1, isOracle ? '#9b6bff' : '#39d98a');
        ctx.fillStyle = g;
      } else {
        ctx.fillStyle = 'rgba(120,130,165,0.32)';
      }
      ctx.fill();
      ctx.strokeStyle = lit ? 'rgba(255,255,255,0.85)' : 'rgba(160,170,205,0.5)';
      ctx.lineWidth = 1.4; ctx.stroke();
      ctx.restore();
    }

    _drawGate(cx, cy, r, piece) {
      const { ctx, cell } = this;
      const on = this.result && this.result.gateOn[piece.id];
      ctx.save();
      ctx.translate(cx, cy);
      if (on) { ctx.shadowColor = 'rgba(255,210,120,0.9)'; ctx.shadowBlur = 20; }
      // Body.
      ctx.fillStyle = on ? 'rgba(255,205,120,0.22)' : 'rgba(90,100,140,0.3)';
      this._rr(ctx, -r * 1.2, -r * 1.2, r * 2.4, r * 2.4, 8);
      ctx.fill();
      ctx.strokeStyle = on ? 'rgba(255,221,150,0.95)' : 'rgba(150,160,200,0.6)';
      ctx.lineWidth = 1.6; ctx.stroke();
      ctx.shadowBlur = 0;
      // Label.
      ctx.fillStyle = on ? '#ffe9c4' : '#aab1d0';
      ctx.font = `600 ${Math.round(cell * 0.2)}px 'IBM Plex Mono', monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(piece.gateType, 0, 0);
      // Port markers.
      const ports = L.gatePorts(piece.gateType, piece.dir);
      ctx.fillStyle = on ? '#ffd27a' : '#7c84a8';
      const out = L.DIRS[ports.output];
      ctx.beginPath(); ctx.arc(out.dx * r * 1.15, out.dy * r * 1.15, r * 0.18, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(150,220,255,0.8)';
      for (const ip of ports.inputs) {
        const d = L.DIRS[ip];
        ctx.beginPath(); ctx.arc(d.dx * r * 1.15, d.dy * r * 1.15, r * 0.14, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }

    // --- helpers ---
    _mix(a, b, t) {
      return [
        Math.round(a[0] + (b[0] - a[0]) * t),
        Math.round(a[1] + (b[1] - a[1]) * t),
        Math.round(a[2] + (b[2] - a[2]) * t)
      ];
    }
    _roundRect(x, y, w, h, r) { this._rr(this.ctx, x, y, w, h, r); }
    _rr(ctx, x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    }
  }

  return Renderer;
});
