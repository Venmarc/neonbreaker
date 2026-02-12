export enum GameState {
  MENU = 'MENU',
  PLAYING = 'PLAYING',
  PAUSED = 'PAUSED',
  GAME_OVER = 'GAME_OVER',
  VICTORY = 'VICTORY',
  SETTINGS = 'SETTINGS'
}

export enum Difficulty {
  EASY = 'EASY',
  MEDIUM = 'MEDIUM',
  HARD = 'HARD'
}

export enum PowerUpType {
  ENLARGE = 'ENLARGE',
  MULTIBALL = 'MULTIBALL',
  SHIELD = 'SHIELD',
  LASER = 'LASER',
  STICKY = 'STICKY',
  HEART = 'HEART',
  LIGHTNING = 'LIGHTNING',
  CLUSTER = 'CLUSTER'
}

export interface Position {
  x: number;
  y: number;
}

export interface Vector {
  dx: number;
  dy: number;
}

export interface Ball {
  id: number;
  x: number;
  y: number;
  radius: number;
  dx: number;
  dy: number;
  speed: number;
  active: boolean;
  stuckOffset?: number; // Optional offset from paddle center when stuck
  trail: Position[]; // History of positions for visual trail
}

export interface Paddle {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  isEnlarged: boolean;
  flashTimer: number; // For visual feedback
  dashCooldown: number; // Timestamp when dash is ready
}

export interface Brick {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  status: number; // 1 = active, 0 = destroyed
  value: number;
}

export interface Particle {
  x: number;
  y: number;
  dx: number;
  dy: number;
  life: number;
  color: string;
  size: number;
}

export interface PowerUp {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  dy: number;
  type: PowerUpType;
  active: boolean;
  color: string;
}

export interface Collision {
  hit: boolean;
  axis?: 'x' | 'y';
  overlap?: number;
}

export interface LightningArc {
  id: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  life: number; // 0.0 to 1.0
}

export interface Shrapnel {
  id: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
  radius: number;
  life: number;
  color: string;
}

export interface PaddleGhost {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  life: number;
}