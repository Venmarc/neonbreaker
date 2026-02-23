import { Difficulty, PowerUpType, BrickType } from './types';

export const CANVAS_WIDTH = 800;
export const CANVAS_HEIGHT = 600; // Increased to better fill screen

export const PADDLE_WIDTH = 100;
export const PADDLE_WIDTH_ENLARGED = 160;
export const PADDLE_HEIGHT = 20;
export const PADDLE_SPEED = 8;
export const PADDLE_OFFSET_BOTTOM = 40;

export const BALL_RADIUS = 8;

// Brick Layout Constants - DYNAMIC NOW
// These act as default/fallback or purely structural offsets
export const BRICK_PADDING = 4;
export const BRICK_OFFSET_TOP = 60;
export const BRICK_OFFSET_LEFT = 35;
export const BRICK_HEIGHT = 25; // Default height, though can be dynamic if desired

// Removed Fixed Row/Col counts in favor of LevelConfig

export const COLORS = {
  paddle: '#38bdf8', // Sky 400
  paddleFlash: '#ffffff',
  ball: '#ffffff',
  background: '#0f172a', // Slate 900
  text: '#ffffff',
  particles: ['#f472b6', '#22d3ee', '#fbbf24', '#a78bfa'],
  shield: '#22d3ee', // Cyan
  laserBeam: '#ef4444', // Red
};

export const BRICK_TYPE_COLORS = {
  [BrickType.STANDARD]: '#ef4444', // Red 500
  [BrickType.DURABLE]: '#a855f7', // Purple 500 (Harder)
  [BrickType.MIMIC]: '#f97316', // Orange 500
  [BrickType.HEALER]: '#22c55e', // Green 500
  [BrickType.SPORE]: '#eab308', // Yellow 500
  [BrickType.PORTAL]: '#3b82f6', // Blue 500
  [BrickType.TURRET]: '#64748b', // Slate 500
};

export const POWERUP_COLORS = {
  [PowerUpType.ENLARGE]: '#22c55e', // Green
  [PowerUpType.MULTIBALL]: '#fbbf24', // Amber
  [PowerUpType.BARRIER]: '#38bdf8', // Sky (Old Shield)
  [PowerUpType.LASER]: '#ef4444', // Red
  [PowerUpType.STICKY]: '#4ade80', // Green 400
  [PowerUpType.HEART]: '#ec4899', // Pink 500
  [PowerUpType.LIGHTNING]: '#facc15', // Yellow
  [PowerUpType.CLUSTER]: '#f87171', // Red 400
  [PowerUpType.ARMOR]: '#00FFFF', // Cyan
  [PowerUpType.TURRET]: '#D4AF37' // Gold/Brass
};

export const DIFFICULTY_SETTINGS = {
  [Difficulty.EASY]: {
    ballSpeed: 4,
    lives: 2,
    paddleWidthFactor: 1.2
  },
  [Difficulty.MEDIUM]: {
    ballSpeed: 6,
    lives: 2,
    paddleWidthFactor: 1.0
  },
  [Difficulty.HARD]: {
    ballSpeed: 8,
    lives: 2,
    paddleWidthFactor: 0.8
  }
};

export const POWERUP_CHANCE = 0.15; // 15% chance
export const POWERUP_SPEED = 3;
export const BARRIER_DURATION = 10000; // 10s
export const ENLARGE_DURATION = 10000; // 10s
export const TURRET_DURATION = 5000; // 5s
export const STICKY_DURATION = 10000; // 10s
export const LASER_DELAY = 2000; // 2.0s
export const LIGHTNING_DURATION = 5000; // 5s
export const CLUSTER_DURATION = 5000; // 5s
export const POWERUP_WARNING_MS = 3000; // Warning starts 3 seconds before expiry

export const DASH_COOLDOWN_MS = 3000;
export const DASH_DISTANCE = 100;
export const DASH_GHOST_DURATION = 0.2; // 200ms visual trail

// Momentum Pierce Mechanics
export const PIERCE_THRESHOLD_FACTOR = 1.5; // Speed must be > 1.5x base speed to pierce
export const PIERCE_DRAG = 0.85; // Speed multiplier after piercing (15% slow down)

// Performance Limits
export const MAX_BALLS = 81;