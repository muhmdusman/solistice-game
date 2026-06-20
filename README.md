# HELIOS — The Longest Day

> A light-routing logic puzzle for the **June Solstice Game Jam**. Bend sunlight with mirrors, divide it with splitters, and channel it through **optical logic gates** to wake the crystals — and finally, the Oracle. An ode to Alan Turing, built from pure light.

![Made for the June Solstice Game Jam](https://img.shields.io/badge/June_Solstice-Game_Jam-ffce7a) ![Vanilla JS](https://img.shields.io/badge/Built_with-Vanilla_JS-f6b85e) ![License: MIT](https://img.shields.io/badge/License-MIT-6ef0a6)

---

<!-- ======================================================================
     DEV SUBMISSION POST  —  copy everything between the markers into your
     DEV.to article. The cover image and demo video go where noted.
     ====================================================================== -->

<!-- DEV-POST-START -->

## What I Built

**HELIOS — The Longest Day** is a real-time puzzle game where **sunlight is the only tool you have**. On the longest day of the year, you guide the sun's beam across a grid using mirrors and beam-splitters, and route it through **optical logic gates** — AND, OR, XOR, and NOT — to light up dormant crystals before the sun sets.

The twist that ties the whole thing together: you aren't just solving mazes. You're **building computation out of light**. Each level asks you to assemble a small logic circuit, and the final level — *The Oracle* — has you wire up a working decision-gate to wake a machine that "thinks."

That's the heart of the tribute. Alan Turing's foundational insight was that computation can be built from almost anything that can hold and combine logical states. Here, you build it from beams of solstice sunlight.

> Theme fusion was the goal from day one. The **solstice** isn't set dressing — light *is* the gameplay, and the sun arcing toward dusk *is* your timer. The **Turing tribute** isn't a footnote — logic gates *are* the core mechanic.

## Demo

<!-- 📹 PASTE YOUR DEMO VIDEO EMBED HERE (YouTube/Loom). DEV supports: {% embed VIDEO_URL %} -->

**▶️ Play it live (CodePen):**

{% codepen https://codepen.io/fpxdiqtk-the-bashful/pen/RNKpLNg %}

**💻 Source:** https://github.com/muhmdusman/solistice-game

## How To Play

- **Goal:** light every crystal on the board at once.
- **Drag** a mirror or splitter from the tray onto an empty cell.
- **Click** a placed piece to rotate it; **right-click** to remove it.
- **Mirrors** bend a beam 90°. **Splitters** pass the beam *and* send a copy at a right angle.
- **Logic gates** are the soul of the game:
  - **AND** fires only when *both* inputs are lit
  - **OR** fires with *either* input
  - **XOR** fires with *exactly one* input
  - **NOT** fires only when its input is *dark*
- The **sun is your clock** — it arcs across the sky as you work. Solve before nightfall.

## How I Built It

It's pure **vanilla JavaScript, HTML, and Canvas** — no frameworks, no build step, no asset files (even the sound is synthesized with the Web Audio API). That keeps it a single self-contained bundle that embeds cleanly anywhere.

The architecture is split into focused modules:

| Module | Role |
| --- | --- |
| `js/light.js` | The optical simulation engine — the brain |
| `js/levels.js` | Six hand-designed, validated puzzles |
| `js/render.js` | Canvas renderer with animated, flowing beams |
| `js/game.js` | Game loop, input, scoring, screen flow |
| `js/audio.js` | Runtime-synthesized sound |
| `tools/validate-levels.js` | A brute-force solvability prover |

### The interesting technical part: simulating light *as a circuit*

A naive beam-tracer is easy. The hard, fun part is that **gates can feed other gates**, and beams can loop through mirrors. A gate's output depends on its inputs, which may themselves depend on another gate's output. That's not a straight line — it's a **circuit**.

So the engine doesn't just trace once. It **iterates to a fixpoint**, exactly like simulating digital logic:

1. Assume every gate is off, trace all beams.
2. Re-evaluate each gate from the light now hitting its input ports.
3. Re-trace. Repeat until nothing changes (the circuit *settles*).
4. If it never settles within a bounded number of passes (e.g. a NOT gate feeding itself), flag the circuit as **unstable** instead of hanging.

```javascript
// Iterate gate states until the circuit reaches a stable fixpoint.
for (let i = 0; i < maxIter; i++) {
  const next = {};
  let changed = false;
  for (const g of gates) {
    const ports = gatePorts(g.gateType, g.dir);
    const bits  = ports.inputs.map((p) => !!trace.gateInputs[g.id][p]);
    const out   = evalGate(g.gateType, bits);
    next[g.id] = out;
    if (out !== gateOn[g.id]) changed = true;
  }
  gateOn = next;
  trace  = traceBeams(board, gateOn);
  if (!changed) { stable = true; break; }   // settled
  if (i === maxIter - 1) stable = false;     // oscillating
}
```

### Making sure it actually works

I wanted the puzzles to be provably fair, so I built the engine to be **environment-agnostic** — it runs identically in the browser and in Node. That let me test the whole thing headlessly:

- A **17-test suite** covers straight beams, mirror reflection, splitters, all four logic gates, and cascading gates reaching a fixpoint. All pass.
- A **brute-force level validator** (`tools/validate-levels.js`) tries every placement of each level's tray pieces and confirms two things for all six levels: the level **is solvable**, and it is **not already solved at the start**. No player ever gets handed an impossible — or trivial — board.

That validation step caught real design mistakes early and is, honestly, the thing I'm most happy with.

## The Solstice & Turing Connections

- **Solstice:** the longest day is the setting and the stakes. Light is your resource, the sun's arc is your timer, and dusk is the fail state. The palette moves from dawn-gold to deep twilight as the clock runs.
- **Turing:** the logic gates are a direct nod to the idea that computation is substrate-independent. The campaign builds from "bend one beam" to "assemble an XOR decision circuit" to wake *The Oracle* — a small machine that reasons. It closes on Turing's 1950 line: *"We can only see a short distance ahead, but we can see plenty there that needs to be done."*

## What I'd Add Next

- A **NAND-only level** (NAND is functionally complete — you can build *any* logic from it, a beautiful deeper Turing nod).
- A **level editor** so players can design and share their own light-circuits.
- More beam types (filters, colored prisms requiring combined inputs).

## Tech Stack

`Vanilla JS` · `HTML5 Canvas` · `Web Audio API` · `Node` (for headless testing) · No frameworks, no build tools.

Thanks for reading — and happy solstice. 🌞

<!-- DEV-POST-END -->

---

## Running Locally

No build step. Just serve the folder:

```bash
# Python
python3 -m http.server 8080
# then open http://localhost:8080
```

## Tests

```bash
node tools/validate-levels.js   # proves every level is solvable & non-trivial
```

## License

[MIT](LICENSE) — free to use, riff on, and learn from.
