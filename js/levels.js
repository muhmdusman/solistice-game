/* =========================================================================
 * levels.js — HELIOS puzzle definitions
 *
 * Each level is a grid with FIXED pieces (walls, emitters, prisms, gates,
 * and some locked mirrors) plus a TRAY of movable/placeable pieces the
 * player drops onto empty cells to route the sunlight.
 *
 * A level is "designed" here as data; the actual solvability is verified by
 * tools/validate-levels.js, which loads the light engine and confirms each
 * level can be solved AND is not already solved at the start.
 *
 * Coordinates are [x, y] with origin top-left. orient is '/' or '\\'.
 * Gate dir: 0=N 1=E 2=S 3=W (direction the gate's OUTPUT beam fires).
 * ========================================================================= */

(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.LEVELS = api;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const LEVELS = [
    {
      id: 1,
      name: 'First Light',
      time: '05:30',
      width: 7,
      height: 5,
      story: 'Dawn breaks on the longest day. Bend the first ray to the waiting crystal.',
      fixed: {
        emitters: [{ x: 0, y: 2, dir: 1 }],
        prisms: [{ x: 6, y: 0, id: 'P1' }],
        walls: [],
        mirrors: [],
        gates: []
      },
      // Pieces the player can place. Mirrors can be rotated after placing.
      tray: [{ type: 'mirror' }],
      hint: 'Place a mirror where the beam meets the crystal\u2019s column, then turn it to send light upward.'
    },

    {
      id: 2,
      name: 'Two Paths',
      time: '08:00',
      width: 8,
      height: 6,
      story: 'The sun climbs. Split one ray to wake two crystals at once.',
      fixed: {
        emitters: [{ x: 0, y: 2, dir: 1 }],
        prisms: [{ x: 7, y: 2, id: 'P1' }, { x: 3, y: 5, id: 'P2' }],
        walls: [{ x: 5, y: 0 }, { x: 5, y: 1 }],
        mirrors: [],
        gates: []
      },
      tray: [{ type: 'splitter' }],
      hint: 'A splitter lets the beam continue straight while sending a copy at a right angle.'
    },

    {
      id: 3,
      name: 'The Gate',
      time: '10:30',
      width: 9,
      height: 7,
      story: 'Turing\u2019s insight: logic can be built from anything \u2014 even light. Feed BOTH inputs of the AND gate.',
      fixed: {
        emitters: [
          { x: 0, y: 1, dir: 1 },
          { x: 0, y: 5, dir: 1 }
        ],
        prisms: [{ x: 8, y: 3, id: 'P1' }],
        walls: [],
        // AND gate output East at (6,3); inputs on North & South sides.
        gates: [{ x: 6, y: 3, gateType: 'AND', dir: 1 }],
        mirrors: []
      },
      tray: [{ type: 'mirror' }, { type: 'mirror' }],
      hint: 'Route the top beam down into the gate\u2019s north port and the bottom beam up into its south port. The gate fires only when both are lit.'
    },

    {
      id: 4,
      name: 'Either Way',
      time: '13:00',
      width: 9,
      height: 7,
      story: 'High noon, the longest light. An OR gate asks for less \u2014 a single ray will do, if you can deliver it.',
      fixed: {
        emitters: [{ x: 0, y: 0, dir: 1 }],
        prisms: [{ x: 8, y: 6, id: 'P1' }],
        walls: [{ x: 4, y: 6 }, { x: 6, y: 0 }],
        gates: [{ x: 4, y: 3, gateType: 'OR', dir: 2 }],
        mirrors: []
      },
      tray: [{ type: 'mirror' }, { type: 'mirror' }, { type: 'mirror' }],
      hint: 'OR fires from one input. Get a beam into either the east or west port, then route its downward output to the crystal.'
    },

    {
      id: 5,
      name: 'Inversion',
      time: '16:00',
      width: 9,
      height: 5,
      story: 'Afternoon shadows. A NOT gate glows only in darkness \u2014 leave its input unlit and route what it gives you.',
      fixed: {
        emitters: [{ x: 0, y: 2, dir: 1 }],
        prisms: [{ x: 8, y: 0, id: 'P1' }],
        walls: [{ x: 3, y: 2 }],
        // NOT gate output East at (5,2); input on its West side. We keep the
        // west port dark (wall blocks the emitter), so the gate emits.
        gates: [{ x: 5, y: 2, gateType: 'NOT', dir: 1 }],
        mirrors: []
      },
      tray: [{ type: 'mirror' }],
      hint: 'The wall keeps the gate\u2019s input dark, so it emits east. Bend that output up to the crystal.'
    },

    {
      id: 6,
      name: 'Crossfire',
      time: '17:15',
      width: 9,
      height: 7,
      story: 'Two suns, two crystals \u2014 but none of them line up. Bend both beams inward to the waiting cores.',
      fixed: {
        emitters: [
          { x: 0, y: 0, dir: 1 },
          { x: 0, y: 6, dir: 1 }
        ],
        prisms: [{ x: 8, y: 2, id: 'P1' }, { x: 8, y: 4, id: 'P2' }],
        walls: [{ x: 8, y: 0 }, { x: 8, y: 6 }],
        gates: [],
        mirrors: []
      },
      tray: [{ type: 'mirror' }, { type: 'mirror' }, { type: 'mirror' }, { type: 'mirror' }],
      hint: 'Each beam must turn down (or up) toward a middle row, then east into its crystal. Two mirrors per ray.'
    },

    {
      id: 7,
      name: 'The Negative',
      time: '18:30',
      width: 9,
      height: 7,
      story: 'A NAND gate \u2014 the universal gate. Turing\u2019s logic can be built entirely from this one shape. Keep it from seeing both inputs.',
      fixed: {
        emitters: [{ x: 0, y: 3, dir: 1 }],
        prisms: [{ x: 8, y: 6, id: 'P1' }],
        walls: [{ x: 6, y: 3 }],
        // NAND output South at (4,3); inputs East & West. Single input -> fires.
        gates: [{ x: 4, y: 3, gateType: 'NAND', dir: 2 }],
        mirrors: []
      },
      tray: [{ type: 'mirror' }, { type: 'mirror' }],
      hint: 'The sun feeds one NAND input, so it fires downward. Bend that output across to the crystal.'
    },

    {
      id: 8,
      name: 'Stillness',
      time: '19:45',
      width: 9,
      height: 7,
      story: 'A NOR gate wakes only in perfect quiet \u2014 when no light touches it at all. Light the crystal without ever feeding the gate.',
      fixed: {
        emitters: [{ x: 0, y: 0, dir: 1 }],
        prisms: [{ x: 8, y: 4, id: 'P1' }],
        walls: [{ x: 3, y: 4 }, { x: 5, y: 4 }],
        // NOR output South at (4,5)... we want it lit since no input. Place
        // gate low and walled-off so its inputs stay dark; route its output.
        gates: [{ x: 4, y: 5, gateType: 'NOR', dir: 0 }],
        mirrors: []
      },
      tray: [{ type: 'mirror' }, { type: 'mirror' }],
      hint: 'The walls shield the NOR gate, so it stays awake and fires north. Catch that beam and steer it to the crystal.'
    },

    {
      id: 9,
      name: 'Fork & Gate',
      time: '20:30',
      width: 11,
      height: 7,
      story: 'Split one ray in two, then bring both halves back together to satisfy an AND gate. Division and reunion.',
      fixed: {
        emitters: [{ x: 0, y: 3, dir: 1 }],
        prisms: [{ x: 10, y: 3, id: 'P1' }],
        walls: [{ x: 8, y: 0 }, { x: 8, y: 6 }],
        // AND output East at (8,3); inputs North & South.
        gates: [{ x: 8, y: 3, gateType: 'AND', dir: 1 }],
        mirrors: []
      },
      tray: [
        { type: 'splitter' },
        { type: 'mirror' },
        { type: 'mirror' },
        { type: 'mirror' },
        { type: 'mirror' }
      ],
      hint: 'Split the beam early, route one copy to the gate\u2019s north port and the other to its south port, then send the output to the crystal.'
    },

    {
      id: 10,
      name: 'The Oracle',
      time: '21:30',
      width: 11,
      height: 9,
      story: 'The long dusk. Assemble a circuit that THINKS: an XOR decision feeding the Oracle. Wake it before the sun is gone.',
      fixed: {
        emitters: [
          { x: 0, y: 1, dir: 1 },
          { x: 0, y: 7, dir: 1 }
        ],
        prisms: [{ x: 10, y: 4, id: 'ORACLE' }],
        walls: [{ x: 5, y: 0 }, { x: 5, y: 8 }],
        // XOR gate output East at (7,4); inputs North & South.
        gates: [{ x: 7, y: 4, gateType: 'XOR', dir: 1 }],
        mirrors: []
      },
      tray: [
        { type: 'mirror' },
        { type: 'mirror' },
        { type: 'mirror' },
        { type: 'mirror' }
      ],
      hint: 'XOR wakes the Oracle only when exactly one ray reaches it. Route both beams toward the gate\u2019s ports, but make sure the circuit settles with a single input winning.'
    }
  ];

  return LEVELS;
});
