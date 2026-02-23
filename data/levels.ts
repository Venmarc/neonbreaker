import { LevelConfig } from '../types';

// Helper to generate a full grid of standard bricks
const generateGrid = (rows: number, cols: number, type: number = 1): number[] => {
  return Array(rows * cols).fill(type);
};

// Helper to generate a checkerboard pattern
const generateCheckerboard = (rows: number, cols: number): number[] => {
  const layout = [];
  for (let i = 0; i < rows * cols; i++) {
    const row = Math.floor(i / cols);
    const col = i % cols;
    layout.push((row + col) % 2 === 0 ? 1 : 0);
  }
  return layout;
};

// Helper to generate a "frame" pattern
const generateFrame = (rows: number, cols: number): number[] => {
    const layout = [];
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (r === 0 || r === rows - 1 || c === 0 || c === cols - 1) {
                layout.push(2); // Durable on edges
            } else {
                layout.push(1); // Standard inside
            }
        }
    }
    return layout;
};

export const ARCADE_LEVELS: LevelConfig[] = [
  // Level 1: Simple 5x5 Block
  {
    id: 1,
    rows: 5,
    cols: 5,
    layout: generateGrid(5, 5, 1)
  },
  // Level 2: 7x7 Checkerboard
  {
    id: 2,
    rows: 6,
    cols: 8,
    layout: generateCheckerboard(6, 8)
  },
  // Level 3: Wide and Short
  {
    id: 3,
    rows: 4,
    cols: 10,
    layout: generateGrid(4, 10, 1)
  },
  // Level 4: Durable Frame
  {
    id: 4,
    rows: 6,
    cols: 6,
    layout: generateFrame(6, 6)
  },
  // Level 5: Stripes
  {
    id: 5,
    rows: 8,
    cols: 8,
    layout: Array(64).fill(0).map((_, i) => Math.floor(i / 8) % 2 === 0 ? 1 : 0)
  },
  // Level 6: Durable Columns
  {
    id: 6,
    rows: 6,
    cols: 9,
    layout: Array(54).fill(0).map((_, i) => (i % 9) % 2 === 0 ? 2 : 0)
  },
  // Level 7: Dense Grid
  {
    id: 7,
    rows: 10,
    cols: 10,
    layout: generateGrid(10, 10, 1)
  },
  // Level 8: Pyramid-ish
  {
    id: 8,
    rows: 8,
    cols: 11,
    layout: Array(88).fill(0).map((_, i) => {
        const r = Math.floor(i / 11);
        const c = i % 11;
        // Simple triangle logic
        return (c >= r && c < 11 - r) ? 2 : 0;
    })
  },
  // Level 9: The Wall
  {
    id: 9,
    rows: 12,
    cols: 12,
    layout: generateGrid(12, 12, 2) // All durable
  },
  // Level 10: Boss Arena (Complex)
  {
    id: 10,
    rows: 15,
    cols: 15,
    layout: generateCheckerboard(15, 15).map(x => x === 1 ? 2 : 1) // Inverted durable checkerboard
  },
  // Level 11: Portals & Mimics
  {
      id: 11,
      rows: 6,
      cols: 8,
      layout: [
          1, 1, 6, 1, 1, 6, 1, 1,
          1, 3, 1, 1, 1, 1, 3, 1,
          1, 1, 1, 1, 1, 1, 1, 1,
          1, 1, 1, 6, 6, 1, 1, 1,
          1, 3, 1, 1, 1, 1, 3, 1,
          1, 1, 1, 1, 1, 1, 1, 1
      ]
  },
  // Level 12: Spore Introduction
  {
      id: 12,
      rows: 8,
      cols: 8,
      layout: [
          1, 1, 1, 1, 1, 1, 1, 1,
          1, 0, 0, 0, 0, 0, 0, 1,
          1, 0, 0, 0, 0, 0, 0, 1,
          1, 0, 0, 5, 5, 0, 0, 1,
          1, 0, 0, 5, 5, 0, 0, 1,
          1, 0, 0, 0, 0, 0, 0, 1,
          1, 0, 0, 0, 0, 0, 0, 1,
          1, 1, 1, 1, 1, 1, 1, 1
      ]
  },
  // Level 13: Healers & Durable
  {
      id: 13,
      rows: 6,
      cols: 8,
      layout: [
          2, 2, 2, 2, 2, 2, 2, 2,
          2, 4, 2, 4, 2, 4, 2, 2,
          2, 2, 2, 2, 2, 2, 2, 2,
          1, 1, 1, 1, 1, 1, 1, 1,
          1, 1, 1, 1, 1, 1, 1, 1,
          1, 1, 1, 1, 1, 1, 1, 1
      ]
  },
  // Level 14: Turrets
  {
      id: 14,
      rows: 7,
      cols: 9,
      layout: [
          0, 0, 0, 7, 0, 7, 0, 0, 0,
          2, 2, 2, 2, 2, 2, 2, 2, 2,
          1, 1, 1, 1, 1, 1, 1, 1, 1,
          1, 1, 1, 1, 1, 1, 1, 1, 1,
          1, 1, 1, 1, 1, 1, 1, 1, 1,
          1, 1, 1, 1, 1, 1, 1, 1, 1,
          1, 1, 1, 1, 1, 1, 1, 1, 1
      ]
  },
  // Level 15: Turrets guarded by Portals
  {
      id: 15,
      rows: 8,
      cols: 8,
      layout: [
          7, 0, 0, 0, 0, 0, 0, 7,
          6, 6, 6, 6, 6, 6, 6, 6,
          1, 1, 1, 1, 1, 1, 1, 1,
          1, 1, 1, 1, 1, 1, 1, 1,
          1, 1, 1, 1, 1, 1, 1, 1,
          1, 1, 1, 1, 1, 1, 1, 1,
          1, 1, 1, 1, 1, 1, 1, 1,
          1, 1, 1, 1, 1, 1, 1, 1
      ]
  },
  // Level 16: Spores in tight corridors
  {
      id: 16,
      rows: 8,
      cols: 9,
      layout: [
          2, 2, 2, 2, 2, 2, 2, 2, 2,
          2, 5, 0, 2, 5, 2, 0, 5, 2,
          2, 0, 0, 2, 0, 2, 0, 0, 2,
          2, 2, 2, 2, 0, 2, 2, 2, 2,
          1, 1, 1, 1, 1, 1, 1, 1, 1,
          1, 1, 1, 1, 1, 1, 1, 1, 1,
          1, 1, 1, 1, 1, 1, 1, 1, 1,
          1, 1, 1, 1, 1, 1, 1, 1, 1
      ]
  },
  // Level 17: Mimics and Healers
  {
      id: 17,
      rows: 7,
      cols: 8,
      layout: [
          4, 3, 4, 3, 4, 3, 4, 3,
          2, 2, 2, 2, 2, 2, 2, 2,
          1, 1, 1, 1, 1, 1, 1, 1,
          1, 3, 1, 3, 1, 3, 1, 3,
          1, 1, 1, 1, 1, 1, 1, 1,
          1, 1, 1, 1, 1, 1, 1, 1,
          1, 1, 1, 1, 1, 1, 1, 1
      ]
  },
  // Level 18: Turrets + Spores
  {
      id: 18,
      rows: 8,
      cols: 10,
      layout: [
          7, 0, 0, 0, 0, 0, 0, 0, 0, 7,
          2, 2, 2, 2, 2, 2, 2, 2, 2, 2,
          1, 5, 1, 1, 5, 1, 1, 5, 1, 1,
          1, 0, 1, 1, 0, 1, 1, 0, 1, 1,
          1, 0, 1, 1, 0, 1, 1, 0, 1, 1,
          1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
          1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
          1, 1, 1, 1, 1, 1, 1, 1, 1, 1
      ]
  },
  // Level 19: Complex Maze
  {
      id: 19,
      rows: 9,
      cols: 9,
      layout: [
          2, 2, 2, 6, 2, 6, 2, 2, 2,
          2, 0, 0, 0, 0, 0, 0, 0, 2,
          2, 0, 2, 2, 2, 2, 2, 0, 2,
          6, 0, 2, 3, 4, 3, 2, 0, 6,
          2, 0, 2, 2, 2, 2, 2, 0, 2,
          2, 0, 0, 0, 0, 0, 0, 0, 2,
          2, 2, 2, 2, 2, 2, 2, 2, 2,
          1, 1, 1, 1, 1, 1, 1, 1, 1,
          1, 1, 1, 1, 1, 1, 1, 1, 1
      ]
  },
  // Level 20: Boss Stage
  {
      id: 20,
      rows: 12,
      cols: 12,
      layout: [
          7, 0, 0, 0, 4, 4, 0, 0, 0, 0, 7, 0,
          2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2,
          6, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 6,
          2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2,
          1, 3, 1, 3, 1, 3, 1, 3, 1, 3, 1, 1,
          1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
          1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
          1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
          1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
          1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
          2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2,
          0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0
      ]
  }
];

export const ENDLESS_STAGES: LevelConfig[] = [
  // Stage 1: Warmup
  {
    id: 1,
    rows: 5,
    cols: 6,
    layout: generateGrid(5, 6, 1)
  },
  // Stage 2: Spread
  {
    id: 2,
    rows: 6,
    cols: 8,
    layout: generateCheckerboard(6, 8)
  },
  // Stage 3: Tougher
  {
    id: 3,
    rows: 7,
    cols: 9,
    layout: generateFrame(7, 9)
  },
  // Stage 4: Dense
  {
    id: 4,
    rows: 8,
    cols: 10,
    layout: generateGrid(8, 10, 1)
  },
  // Stage 5: Fortification
  {
    id: 5,
    rows: 10,
    cols: 12,
    layout: generateGrid(10, 12, 2)
  },
  // Stage 6
  {
      id: 6,
      rows: 8,
      cols: 10,
      layout: [
          7, 0, 0, 0, 0, 0, 0, 0, 0, 7,
          2, 2, 2, 2, 2, 2, 2, 2, 2, 2,
          1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
          1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
          1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
          1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
          1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
          1, 1, 1, 1, 1, 1, 1, 1, 1, 1
      ]
  },
  // Stage 7
  {
      id: 7,
      rows: 9,
      cols: 9,
      layout: [
          5, 0, 0, 0, 5, 0, 0, 0, 5,
          0, 0, 0, 0, 0, 0, 0, 0, 0,
          0, 0, 0, 0, 0, 0, 0, 0, 0,
          2, 2, 2, 2, 2, 2, 2, 2, 2,
          1, 1, 1, 1, 1, 1, 1, 1, 1,
          1, 1, 1, 1, 1, 1, 1, 1, 1,
          1, 1, 1, 1, 1, 1, 1, 1, 1,
          1, 1, 1, 1, 1, 1, 1, 1, 1,
          1, 1, 1, 1, 1, 1, 1, 1, 1
      ]
  },
  // Stage 8
  {
      id: 8,
      rows: 8,
      cols: 10,
      layout: [
          6, 6, 6, 6, 6, 6, 6, 6, 6, 6,
          2, 2, 2, 2, 2, 2, 2, 2, 2, 2,
          1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
          1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
          1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
          1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
          1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
          1, 1, 1, 1, 1, 1, 1, 1, 1, 1
      ]
  },
  // Stage 9
  {
      id: 9,
      rows: 10,
      cols: 10,
      layout: [
          7, 0, 0, 0, 4, 4, 0, 0, 0, 7,
          2, 2, 2, 2, 2, 2, 2, 2, 2, 2,
          1, 3, 1, 3, 1, 3, 1, 3, 1, 1,
          1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
          1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
          1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
          1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
          1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
          1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
          1, 1, 1, 1, 1, 1, 1, 1, 1, 1
      ]
  },
  // Stage 10
  {
      id: 10,
      rows: 12,
      cols: 12,
      layout: [
          7, 0, 7, 0, 7, 0, 7, 0, 7, 0, 7, 0,
          2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2,
          5, 0, 5, 0, 5, 0, 5, 0, 5, 0, 5, 0,
          2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2,
          6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6,
          1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
          1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
          1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
          1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
          1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
          1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1
      ]
  }
];