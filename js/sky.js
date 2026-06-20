/* =========================================================================
 * sky.js — The living solstice sky (background atmosphere)
 *
 * Renders a full-screen animated backdrop behind the puzzle board: a sun
 * that arcs from dawn to dusk, a gradient that shifts from bright day to
 * deep twilight to night, drifting clouds, and stars that fade in as the
 * light fails. It is driven by a single `progress` value (0 = full daylight,
 * 1 = night) that the game feeds from the daylight clock, so the sky doubles
 * as an ambient timer — exactly the feel of the earlier prototype.
 * ========================================================================= */

(function (root, factory) {
  const api = factory();
  if (root) root.Sky = api;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  class Sky {
    constructor(canvasId) {
      this.canvas = document.getElementById(canvasId);
      this.ctx = this.canvas.getContext('2d');
      this.progress = 0;
      this.target = 0;
      this.stars = [];
      this.clouds = [];
      this.raf = null;
      this.resize = this.resize.bind(this);
      this.loop = this.loop.bind(this);
      window.addEventListener('resize', this.resize);
      this.resize();
      this.seed();
    }

    resize() {
      const dpr = window.devicePixelRatio || 1;
      this.w = window.innerWidth;
      this.h = window.innerHeight;
      this.canvas.width = this.w * dpr;
      this.canvas.height = this.h * dpr;
      this.canvas.style.width = this.w + 'px';
      this.canvas.style.height = this.h + 'px';
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    seed() {
      this.stars = [];
      for (let i = 0; i < 140; i++) {
        this.stars.push({
          x: Math.random(),
          y: Math.random() * 0.72,
          r: Math.random() * 1.4 + 0.3,
          tw: Math.random() * Math.PI * 2
        });
      }
      this.clouds = [];
      for (let i = 0; i < 5; i++) {
        this.clouds.push({
          x: Math.random(),
          y: 0.12 + Math.random() * 0.34,
          scale: 0.7 + Math.random() * 0.9,
          speed: 0.0015 + Math.random() * 0.002
        });
      }
    }

    setProgress(p) { this.target = Math.max(0, Math.min(1, p)); }

    start() { if (!this.raf) this.loop(); }
    stop() { if (this.raf) { cancelAnimationFrame(this.raf); this.raf = null; } }

    lerp(a, b, t) { return a + (b - a) * t; }
    mix(c1, c2, t) {
      return [
        Math.round(this.lerp(c1[0], c2[0], t)),
        Math.round(this.lerp(c1[1], c2[1], t)),
        Math.round(this.lerp(c1[2], c2[2], t))
      ];
    }
    rgb(c) { return `rgb(${c[0]},${c[1]},${c[2]})`; }

    loop() {
      this.progress += (this.target - this.progress) * 0.04;
      this.draw();
      this.raf = requestAnimationFrame(this.loop);
    }

    draw() {
      const { ctx, w, h } = this;
      const p = this.progress;

      // --- Sky gradient ---
      const dayTop = [74, 150, 226], dayBot = [186, 222, 255];
      const duskTop = [44, 32, 84], duskBot = [236, 124, 88];
      const nightTop = [5, 7, 22], nightBot = [13, 15, 42];

      let top, bot;
      if (p < 0.6) {
        const t = p / 0.6;
        top = this.mix(dayTop, duskTop, t);
        bot = this.mix(dayBot, duskBot, t);
      } else {
        const t = (p - 0.6) / 0.4;
        top = this.mix(duskTop, nightTop, t);
        bot = this.mix(duskBot, nightBot, t);
      }
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, this.rgb(top));
      grad.addColorStop(1, this.rgb(bot));
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // --- Stars ---
      const starA = Math.max(0, (p - 0.42) / 0.58);
      if (starA > 0) {
        for (const s of this.stars) {
          s.tw += 0.02;
          ctx.globalAlpha = starA * (0.55 + 0.45 * Math.sin(s.tw));
          ctx.fillStyle = '#fdf6e3';
          ctx.beginPath();
          ctx.arc(s.x * w, s.y * h, s.r, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      // --- Sun arcing across the sky ---
      const ang = Math.PI * p;
      const radius = Math.min(w, h) * 0.5;
      const sunX = w * 0.5 - Math.cos(ang) * w * 0.46;
      const sunY = h * 0.96 - Math.sin(ang) * radius;
      const sunR = Math.max(22, Math.min(w, h) * 0.055);
      const sunCore = p < 0.5 ? [255, 244, 200] : [255, 172, 104];

      const glow = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, sunR * 7);
      glow.addColorStop(0, `rgba(${sunCore[0]},${sunCore[1]},${sunCore[2]},${0.85 * (1 - p * 0.45)})`);
      glow.addColorStop(1, 'rgba(255,200,120,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);

      ctx.beginPath();
      ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
      ctx.fillStyle = this.rgb(sunCore);
      ctx.fill();

      // --- Clouds (fade out as night falls) ---
      const cloudA = Math.max(0, 1 - p * 1.3);
      if (cloudA > 0) {
        for (const c of this.clouds) {
          c.x += c.speed;
          if (c.x > 1.2) c.x = -0.2;
          this.drawCloud(c.x * w, c.y * h, c.scale, cloudA * 0.5);
        }
      }

      // --- Horizon: Bletchley-style hut silhouette ---
      this.drawHorizon(p);
    }

    drawCloud(x, y, scale, alpha) {
      const { ctx } = this;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#fdf3df';
      const r = 26 * scale;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.arc(x + r * 1.1, y + r * 0.2, r * 0.8, 0, Math.PI * 2);
      ctx.arc(x - r * 1.0, y + r * 0.25, r * 0.7, 0, Math.PI * 2);
      ctx.arc(x + r * 0.3, y - r * 0.5, r * 0.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    drawHorizon(p) {
      const { ctx, w, h } = this;
      const baseY = h * 0.88;
      const g = Math.round(this.lerp(34, 5, p));
      ctx.fillStyle = `rgb(${g},${g + 4},${g + 12})`;
      ctx.fillRect(0, baseY, w, h - baseY);

      ctx.fillStyle = `rgb(${Math.round(this.lerp(24, 3, p))},${Math.round(this.lerp(26, 5, p))},${Math.round(this.lerp(36, 14, p))})`;
      const hutW = w / 8;
      for (let i = 0; i < 8; i++) {
        const x = i * hutW;
        const hh = (i % 2 === 0 ? 44 : 30) + (i % 3) * 10;
        ctx.fillRect(x + 8, baseY - hh, hutW - 16, hh);
        ctx.beginPath();
        ctx.moveTo(x + 4, baseY - hh);
        ctx.lineTo(x + hutW / 2, baseY - hh - 16);
        ctx.lineTo(x + hutW - 4, baseY - hh);
        ctx.closePath();
        ctx.fill();
        if (p > 0.5) {
          ctx.globalAlpha = Math.min(1, (p - 0.5) * 2) * (i % 2 === 0 ? 0.9 : 0.5);
          ctx.fillStyle = '#ffd27a';
          ctx.fillRect(x + hutW / 2 - 4, baseY - hh + 10, 8, 8);
          ctx.globalAlpha = 1;
          ctx.fillStyle = `rgb(${Math.round(this.lerp(24, 3, p))},${Math.round(this.lerp(26, 5, p))},${Math.round(this.lerp(36, 14, p))})`;
        }
      }
    }
  }

  return Sky;
});
