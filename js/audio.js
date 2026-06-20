/* =========================================================================
 * audio.js — Synthesized sound (Web Audio API, no asset files)
 * Soft placement clicks, a rising chime when a crystal lights, a warm chord
 * on level clear, and a low tone at dusk. All generated at runtime so the
 * game stays a single self-contained bundle that embeds cleanly anywhere.
 * ========================================================================= */

class AudioKit {
  constructor() { this.ctx = null; this.enabled = true; }

  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) this.ctx = new AC();
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  tone(freq, dur, type = 'sine', gain = 0.06, when = 0) {
    if (!this.enabled) return;
    const ctx = this.ensure();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    osc.connect(g).connect(ctx.destination);
    const t = ctx.currentTime + when;
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.start(t);
    osc.stop(t + dur);
  }

  place() { this.tone(180 + Math.random() * 30, 0.06, 'triangle', 0.05); }
  rotate() { this.tone(320, 0.05, 'square', 0.035); }
  litCrystal() { this.tone(660, 0.12, 'sine', 0.06); this.tone(990, 0.18, 'sine', 0.04, 0.04); }
  clear() {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
      this.tone(f, 0.5, 'sine', 0.06, i * 0.09));
  }
  error() { this.tone(110, 0.2, 'sawtooth', 0.045); }
  oracle() {
    [392, 523.25, 659.25, 880].forEach((f, i) =>
      this.tone(f, 1.1, 'sine', 0.07, i * 0.16));
  }
}

window.audioKit = new AudioKit();
