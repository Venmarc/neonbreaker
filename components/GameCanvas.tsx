import React, { useRef, useEffect, useCallback } from 'react';
import { 
  CANVAS_WIDTH, CANVAS_HEIGHT, PADDLE_WIDTH, PADDLE_WIDTH_ENLARGED, PADDLE_HEIGHT, PADDLE_OFFSET_BOTTOM, 
  BALL_RADIUS, COLORS, BRICK_PADDING, BRICK_OFFSET_TOP, BRICK_OFFSET_LEFT,
  DIFFICULTY_SETTINGS, POWERUP_CHANCE, POWERUP_COLORS, POWERUP_SPEED,
  ENLARGE_DURATION, SHIELD_DURATION, LASER_DELAY, POWERUP_WARNING_MS, STICKY_DURATION,
  DASH_COOLDOWN_MS, DASH_DISTANCE, LIGHTNING_DURATION, CLUSTER_DURATION,
  PIERCE_THRESHOLD_FACTOR, PIERCE_DRAG, BRICK_TYPE_COLORS, BRICK_HEIGHT
} from '../constants';
import { GameState, Difficulty, Ball, Paddle, Brick, Particle, PowerUp, PowerUpType, LightningArc, Shrapnel, PaddleGhost, CampaignMode, BrickType } from '../types';
import { detectCircleRectCollision, createParticles, updateParticles } from '../utils/physics';
import { playSound } from '../utils/audio';
import { ARCADE_LEVELS, ENDLESS_STAGES } from '../data/levels';

interface FloatingText {
  id: number;
  x: number;
  y: number;
  text: string;
  life: number; // 1.0 to 0.0
  color: string;
  dy: number;
}

interface GameCanvasProps {
  gameState: GameState;
  setGameState: (state: GameState) => void;
  score: number;
  setScore: (score: number | ((prev: number) => number)) => void;
  lives: number;
  setLives: (lives: number | ((prev: number) => number)) => void;
  difficulty: Difficulty;
  setMultiplier: (multiplier: number) => void;
  levelIndex: number;
  campaignMode: CampaignMode;
  difficultyMultiplier: number;
  onLevelComplete: () => void;
}

const GameCanvas: React.FC<GameCanvasProps> = ({ 
  gameState, setGameState, score, setScore, lives, setLives, difficulty, setMultiplier, levelIndex, campaignMode, difficultyMultiplier, onLevelComplete
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);
  
  // Game State Refs
  const ballsRef = useRef<Ball[]>([]);
  const powerUpsRef = useRef<PowerUp[]>([]);
  const bricksRef = useRef<Brick[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const floatingTextsRef = useRef<FloatingText[]>([]);
  const streakRef = useRef<number>(0);
  
  // New Effect Refs
  const lightningArcsRef = useRef<LightningArc[]>([]);
  const shrapnelsRef = useRef<Shrapnel[]>([]);
  const paddleGhostsRef = useRef<PaddleGhost[]>([]);
  const shakeRef = useRef<number>(0); // Screen shake magnitude
  
  // Track initialized level to prevent resetting on Resume
  const prevLevelKey = useRef<string>("");

  const paddleRef = useRef<Paddle>({
    x: (CANVAS_WIDTH - PADDLE_WIDTH) / 2,
    y: CANVAS_HEIGHT - PADDLE_OFFSET_BOTTOM,
    width: PADDLE_WIDTH,
    height: PADDLE_HEIGHT,
    color: COLORS.paddle,
    isEnlarged: false,
    flashTimer: 0,
    dashCooldown: 0
  });
  
  // Visual effects for paddle hits
  const paddleImpactsRef = useRef<{ id: number; x: number; life: number }[]>([]);

  // Touch State
  const touchRef = useRef<{
    active: boolean;
    x: number;
    y: number;
    zone: 'UPPER' | 'LOWER' | null;
    lastTap: number; // For double tap detection
  }>({
    active: false,
    x: 0,
    y: 0,
    zone: null,
    lastTap: 0
  });

  // Mercy Event State (Last Stand)
  const hasTriggeredMercyEventRef = useRef<boolean>(false);
  const isCriticalModeRef = useRef<boolean>(false);
  const criticalHitCounterRef = useRef<number>(0);
  const criticalHeartTargetRef = useRef<number>(0);

  // Mercy Priority: Wait for final heart logic
  const isWaitingForFinalHeartRef = useRef<boolean>(false);
  const finalHeartIdRef = useRef<number | null>(null);

  // Power-up State (Timestamp based for better control)
  const powerUpStateRef = useRef<{
    enlargeEndTime: number;
    shieldEndTime: number;
    laserFireTime: number;
    stickyEndTime: number;
    lightningEndTime: number;
    clusterEndTime: number;
  }>({
    enlargeEndTime: 0,
    shieldEndTime: 0,
    laserFireTime: 0,
    stickyEndTime: 0,
    lightningEndTime: 0,
    clusterEndTime: 0
  });

  const shieldActiveRef = useRef<boolean>(false);
  const laserBeamRef = useRef<{active: boolean, x: number, y: number, timer: number, alpha: number} | null>(null);

  const keysPressed = useRef<{ [key: string]: boolean }>({});

  // --- HELPER: Physics Calculations ---
  
  // Consistent launch angle calculation
  const getLaunchVector = useCallback((offset: number, halfPaddleWidth: number, speed: number) => {
    // Normalize offset (-1 to 1)
    const hitPoint = offset / halfPaddleWidth;
    // Clamp to ensure we don't exceed max angle
    const clampedHitPoint = Math.max(-1, Math.min(1, hitPoint));
    // Max angle 60 degrees (PI/3)
    const angle = clampedHitPoint * (Math.PI / 3); 
    
    return {
        dx: speed * Math.sin(angle),
        dy: -speed * Math.cos(angle)
    };
  }, []);

  // Initialize Bricks based on Current Level Config
  const initBricks = useCallback(() => {
    // Determine which config to load
    let config;
    if (campaignMode === CampaignMode.ARCADE) {
        config = ARCADE_LEVELS[levelIndex] || ARCADE_LEVELS[0];
    } else {
        config = ENDLESS_STAGES[levelIndex] || ENDLESS_STAGES[0];
    }

    // Dynamic Size Calculation
    // We use the predefined margins, then split the remaining width
    const totalAvailableWidth = CANVAS_WIDTH - (BRICK_OFFSET_LEFT * 2);
    const brickWidth = (totalAvailableWidth - (BRICK_PADDING * (config.cols - 1))) / config.cols;

    const newBricks: Brick[] = [];
    
    for (let i = 0; i < config.layout.length; i++) {
        const typeCode = config.layout[i];
        if (typeCode === 0) continue; // Empty space

        const r = Math.floor(i / config.cols);
        const c = i % config.cols;

        const brickX = (c * (brickWidth + BRICK_PADDING)) + BRICK_OFFSET_LEFT;
        const brickY = (r * (BRICK_HEIGHT + BRICK_PADDING)) + BRICK_OFFSET_TOP;
        
        let type = BrickType.STANDARD;
        let health = 1;
        let value = 10;
        let color = BRICK_TYPE_COLORS[BrickType.STANDARD];

        if (typeCode === 2) {
            type = BrickType.DURABLE;
            health = 2; // Harder bricks
            value = 30;
            color = BRICK_TYPE_COLORS[BrickType.DURABLE];
        } else {
             // For standard bricks, vary color by row for aesthetics
             // We can map BrickType 1 to varied colors or strict type colors
             // Let's stick to standard colors for standard bricks but maybe vary slightly?
             // Or revert to row-based colors if it's type 1
             const rowColorIndex = r % 6;
             const rowColors = [
                '#ef4444', // Red
                '#f97316', // Orange
                '#eab308', // Yellow
                '#22c55e', // Green
                '#3b82f6', // Blue
                '#a855f7', // Purple
             ];
             color = rowColors[rowColorIndex];
        }

        // Apply Difficulty Multiplier to Score Value (Endless Mode)
        value = Math.floor(value * difficultyMultiplier);

        newBricks.push({
            x: brickX,
            y: brickY,
            width: brickWidth,
            height: BRICK_HEIGHT,
            status: health,
            maxHealth: health,
            color: color,
            type: type,
            value: value
        });
    }
    
    bricksRef.current = newBricks;
  }, [levelIndex, campaignMode, difficultyMultiplier]);

  const resetPaddle = useCallback(() => {
    const settings = DIFFICULTY_SETTINGS[difficulty];
    paddleRef.current = {
      x: (CANVAS_WIDTH - (PADDLE_WIDTH * settings.paddleWidthFactor)) / 2,
      y: CANVAS_HEIGHT - PADDLE_OFFSET_BOTTOM,
      width: PADDLE_WIDTH * settings.paddleWidthFactor,
      height: PADDLE_HEIGHT,
      color: COLORS.paddle,
      isEnlarged: false,
      flashTimer: 0,
      dashCooldown: 0
    };
    // Clear effects
    shieldActiveRef.current = false;
    laserBeamRef.current = null;
    paddleImpactsRef.current = [];
    paddleGhostsRef.current = [];
    lightningArcsRef.current = [];
    shrapnelsRef.current = [];
    shakeRef.current = 0;
    
    powerUpStateRef.current = {
      enlargeEndTime: 0,
      shieldEndTime: 0,
      laserFireTime: 0,
      stickyEndTime: 0,
      lightningEndTime: 0,
      clusterEndTime: 0
    };
  }, [difficulty]);

  const spawnBall = useCallback((isActive: boolean = false, x?: number, y?: number, dx?: number, dy?: number) => {
    const settings = DIFFICULTY_SETTINGS[difficulty];
    const newBall: Ball = {
      id: Date.now() + Math.random(),
      x: x ?? paddleRef.current.x + paddleRef.current.width / 2,
      y: y ?? CANVAS_HEIGHT - PADDLE_OFFSET_BOTTOM - PADDLE_HEIGHT - BALL_RADIUS - 1,
      radius: BALL_RADIUS,
      dx: dx ?? 0,
      dy: dy ?? 0,
      speed: settings.ballSpeed * difficultyMultiplier, // Apply Endless Scaling
      active: isActive,
      spin: 0, // Initialize with no spin
      stuckOffset: 0, // Initialize centered
      trail: [], // Initialize empty trail
    };
    return newBall;
  }, [difficulty, difficultyMultiplier]);

  const resetLevel = useCallback((keepPowerUps = false) => {
    ballsRef.current = [spawnBall(false)];
    isWaitingForFinalHeartRef.current = false;
    finalHeartIdRef.current = null;
    
    // Always reset active effects (paddle size, shield, guns, sticky) if not keeping powerups
    if (!keepPowerUps) {
        laserBeamRef.current = null;
        shieldActiveRef.current = false;
        const settings = DIFFICULTY_SETTINGS[difficulty];
        paddleRef.current.width = PADDLE_WIDTH * settings.paddleWidthFactor;
        paddleRef.current.isEnlarged = false;
        
        powerUpStateRef.current = {
            enlargeEndTime: 0,
            shieldEndTime: 0,
            laserFireTime: 0,
            stickyEndTime: 0,
            lightningEndTime: 0,
            clusterEndTime: 0
        };
    }

    // Only clear falling powerups/particles on a full reset (Menu/New Game), not on death
    if (!keepPowerUps) {
        particlesRef.current = [];
        powerUpsRef.current = [];
        paddleImpactsRef.current = [];
        floatingTextsRef.current = [];
        lightningArcsRef.current = [];
        shrapnelsRef.current = [];
        paddleGhostsRef.current = [];
        shakeRef.current = 0;
        streakRef.current = 0;
        setMultiplier(1);
        
        // Reset Mercy Event for new game
        hasTriggeredMercyEventRef.current = false;
        isCriticalModeRef.current = false;
        criticalHitCounterRef.current = 0;
    }
  }, [spawnBall, difficulty, setMultiplier]);

  const launchBalls = useCallback(() => {
    if (gameState !== GameState.PLAYING) return;
    
    // Reset streak on launch (specifically covers the case where sticky powerup held the streak)
    streakRef.current = 0;
    setMultiplier(1);

    const inactiveBalls = ballsRef.current.filter(b => !b.active);
    if (inactiveBalls.length > 0) {
      inactiveBalls.forEach(ball => {
         ball.active = true;
         ball.trail = []; // Reset trail on launch
         
         const offset = ball.stuckOffset ?? 0;
         let { dx, dy } = getLaunchVector(offset, paddleRef.current.width / 2, ball.speed);

         // Implement "Micro-Drift" to prevent infinite vertical loops
         // If trajectory is extremely vertical (dx near 0), add a tiny sub-pixel nudge.
         if (Math.abs(dx) < 0.1) {
             const drift = (Math.random() * 0.1) - 0.05; // +/- 0.05
             dx += drift;
         }

         // Normalize velocity to ensure speed is consistent even after drift
         const currentSpeed = Math.sqrt(dx * dx + dy * dy);
         ball.dx = (dx / currentSpeed) * ball.speed;
         ball.dy = (dy / currentSpeed) * ball.speed;

         // Add launch particles for visual flair
         particlesRef.current.push(...createParticles(ball.x, ball.y, COLORS.paddle));
      });
      playSound('paddle');
    }
  }, [gameState, setMultiplier, getLaunchVector]);

  const addFloatingText = (x: number, y: number, text: string, color: string = '#ffffff') => {
    floatingTextsRef.current.push({
      id: Math.random(),
      x,
      y,
      text,
      life: 1.0,
      color,
      dy: -1.5
    });
  };

  const performDash = useCallback((direction: 'left' | 'right') => {
    const now = Date.now();
    if (now < paddleRef.current.dashCooldown) return;

    // Set Cooldown
    paddleRef.current.dashCooldown = now + DASH_COOLDOWN_MS;
    playSound('paddle'); // Re-use paddle sound or add dash sound if avail

    const startX = paddleRef.current.x;
    let targetX = startX + (direction === 'left' ? -DASH_DISTANCE : DASH_DISTANCE);

    // Clamp
    if (targetX < 0) targetX = 0;
    if (targetX + paddleRef.current.width > CANVAS_WIDTH) targetX = CANVAS_WIDTH - paddleRef.current.width;

    // Create Ghost Trail
    // We add 3 ghosts interpolated between start and end
    const steps = 3;
    for (let i = 0; i < steps; i++) {
        const ratio = i / steps;
        paddleGhostsRef.current.push({
            id: Math.random(),
            x: startX + (targetX - startX) * ratio,
            y: paddleRef.current.y,
            width: paddleRef.current.width,
            height: paddleRef.current.height,
            life: 1.0 - (ratio * 0.5) // Fade older ghosts faster
        });
    }

    // Move Paddle Instantly
    paddleRef.current.x = targetX;

  }, []);

  // Handle Touch Inputs
  const getCanvasPos = (e: React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (touch.clientX - rect.left) * scaleX,
      y: (touch.clientY - rect.top) * scaleY
    };
  };

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const { x, y } = getCanvasPos(e);
    const now = Date.now();
    const zone = y < CANVAS_HEIGHT / 2 ? 'UPPER' : 'LOWER';
    
    // Double Tap Detection for Dash
    if (zone === 'LOWER' && now - touchRef.current.lastTap < 300) {
        // Determine side relative to paddle center
        const paddleCenter = paddleRef.current.x + paddleRef.current.width / 2;
        if (x < paddleCenter) performDash('left');
        else performDash('right');
        touchRef.current.lastTap = 0; // Consume tap
    } else {
        touchRef.current.lastTap = now;
    }

    touchRef.current = { ...touchRef.current, active: true, x, y, zone };
  }, [performDash]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const { x, y } = getCanvasPos(e);
    // Keep the original zone to allow sliding out without losing control
    touchRef.current.x = x;
    touchRef.current.y = y;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    // If we released in the upper zone, treat as launch/fire
    if (touchRef.current.zone === 'UPPER') {
       launchBalls();
    }
    touchRef.current.active = false;
    touchRef.current.zone = null;
  }, [launchBalls]);

  // Handle Power Ups
  const activatePowerUp = (type: PowerUpType, x: number, y: number, color: string) => {
    playSound('powerup');
    const now = Date.now();
    
    // Generic Visual Feedback for all powerups
    paddleRef.current.flashTimer = 15;
    particlesRef.current.push(...createParticles(x, y, color));
    
    switch (type) {
      case PowerUpType.HEART:
        setLives(prev => prev + 1);
        addFloatingText(x, y - 20, '+1 LIFE', '#ec4899');
        break;

      case PowerUpType.ENLARGE:
        powerUpStateRef.current.enlargeEndTime = now + ENLARGE_DURATION;
        if (!paddleRef.current.isEnlarged) {
          const oldWidth = paddleRef.current.width;
          const newWidth = PADDLE_WIDTH_ENLARGED;
          const widthDiff = newWidth - oldWidth;
          
          // Shift Center
          paddleRef.current.x -= widthDiff / 2;
          
          // Update Width
          paddleRef.current.width = newWidth;

          // Clamp
          paddleRef.current.x = Math.max(0, paddleRef.current.x);
          paddleRef.current.x = Math.min(CANVAS_WIDTH - paddleRef.current.width, paddleRef.current.x);

          paddleRef.current.isEnlarged = true;
        }
        addFloatingText(x, y - 20, 'BIG PADDLE', '#22c55e');
        break;

      case PowerUpType.MULTIBALL:
        const currentBalls = [...ballsRef.current];
        currentBalls.forEach(b => {
           if (b.active) {
             // Spawn 2 new balls per active ball
             const b1 = spawnBall(true, b.x, b.y, b.dx * 0.8 + 1, b.dy);
             const b2 = spawnBall(true, b.x, b.y, b.dx * 0.8 - 1, b.dy);
             ballsRef.current.push(b1, b2);
           } else {
             // Handle stuck balls - spawn new balls stuck as well
             const offset = b.stuckOffset ?? 0;
             const padWidth = paddleRef.current.width;
             
             // Spawn 2 new stuck balls with offset spread
             const b1 = spawnBall(false);
             const b2 = spawnBall(false);
             
             // Clamp offsets to stay on paddle
             const maxOffset = padWidth / 2 - BALL_RADIUS;
             b1.stuckOffset = Math.max(-maxOffset, Math.min(maxOffset, offset - 20));
             b2.stuckOffset = Math.max(-maxOffset, Math.min(maxOffset, offset + 20));
             
             ballsRef.current.push(b1, b2);
           }
        });
        if (ballsRef.current.length === 0) {
           // If stuck with no balls (edge case), spawn one
           const b = spawnBall(true, paddleRef.current.x + paddleRef.current.width/2, paddleRef.current.y - 20, 2, -4);
           ballsRef.current.push(b);
        }
        addFloatingText(x, y - 20, 'MULTIBALL', '#fbbf24');
        break;

      case PowerUpType.SHIELD:
        powerUpStateRef.current.shieldEndTime = now + SHIELD_DURATION;
        shieldActiveRef.current = true;
        addFloatingText(x, y - 20, 'SHIELD', '#38bdf8');
        break;
      
      case PowerUpType.STICKY:
        powerUpStateRef.current.stickyEndTime = now + STICKY_DURATION;
        addFloatingText(x, y - 20, 'STICKY', '#4ade80');
        break;

      case PowerUpType.LASER:
        powerUpStateRef.current.laserFireTime = now + LASER_DELAY;
        addFloatingText(x, y - 20, 'LASER', '#ef4444');
        break;

      case PowerUpType.LIGHTNING:
        powerUpStateRef.current.lightningEndTime = now + LIGHTNING_DURATION;
        addFloatingText(x, y - 20, 'LIGHTNING', '#facc15');
        break;

      case PowerUpType.CLUSTER:
        powerUpStateRef.current.clusterEndTime = now + CLUSTER_DURATION;
        addFloatingText(x, y - 20, 'CLUSTER', '#f87171');
        break;
    }
  };

  const spawnShrapnel = (x: number, y: number) => {
    const count = 3 + Math.floor(Math.random() * 3); // 3 to 5
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 6 + Math.random() * 2;
        shrapnelsRef.current.push({
            id: Math.random(),
            x,
            y,
            dx: Math.cos(angle) * speed,
            dy: Math.sin(angle) * speed,
            radius: 4,
            life: 40, // Frames
            color: '#f87171'
        });
    }
  };

  const triggerLightning = (originX: number, originY: number) => {
    // Find active bricks
    const activeBricks = bricksRef.current.filter(b => b.status > 0);
    
    // Calculate distances
    const targets = activeBricks.map(b => {
        const cx = b.x + b.width / 2;
        const cy = b.y + b.height / 2;
        const dist = Math.sqrt(Math.pow(cx - originX, 2) + Math.pow(cy - originY, 2));
        return { brick: b, dist, cx, cy };
    });

    // Sort by distance and take closest 3 within range
    const range = 150;
    const closest = targets.filter(t => t.dist < range).sort((a, b) => a.dist - b.dist).slice(0, 3);

    closest.forEach(target => {
        // Destroy (reduce health by 1)
        target.brick.status -= 1;
        setScore(prev => prev + target.brick.value);
        
        // Visual Arc
        lightningArcsRef.current.push({
            id: Math.random(),
            x1: originX,
            y1: originY,
            x2: target.cx,
            y2: target.cy,
            life: 1.0
        });
        
        // Add particles
        particlesRef.current.push(...createParticles(target.cx, target.cy, '#facc15'));
        
        // Chain reaction only if destroyed
        if (target.brick.status <= 0) {
            attemptPowerUpDrop(target.cx, target.cy);
        }
    });
  };

  const getAllowedPowerUps = (level: number): PowerUpType[] => {
    const pool = [PowerUpType.ENLARGE, PowerUpType.STICKY, PowerUpType.HEART];
    if (level >= 2) pool.push(PowerUpType.LASER, PowerUpType.MULTIBALL);
    if (level >= 5) pool.push(PowerUpType.CLUSTER, PowerUpType.LIGHTNING, PowerUpType.SHIELD);
    return pool;
  };

  const attemptPowerUpDrop = (x: number, y: number) => {
    let spawnedPowerUp = false;

    // --- MERCY EVENT LOGIC (Last Stand) ---
    // If critical mode is active (1 life remaining), we check the counter.
    if (isCriticalModeRef.current) {
        criticalHitCounterRef.current += 1;
        
        // Spawn guaranteed Mercy Heart if we hit the target count
        if (criticalHitCounterRef.current >= criticalHeartTargetRef.current) {
             powerUpsRef.current.push({
                 id: Math.random(),
                 x: x,
                 y: y,
                 width: 20,
                 height: 20,
                 // SLOWER SPEED for Mercy Heart (0.8x)
                 dy: POWERUP_SPEED * 0.8, 
                 type: PowerUpType.HEART,
                 active: true,
                 // GOLD color for Mercy Heart
                 color: '#ffd700' 
             });
             
             // Mark as triggered so it only happens once per game
             hasTriggeredMercyEventRef.current = true;
             
             // Disable critical mode now that we've spawned it
             isCriticalModeRef.current = false; 
             
             spawnedPowerUp = true;
        }
    }

    // --- NORMAL DROP LOGIC ---
    if (!spawnedPowerUp && Math.random() < POWERUP_CHANCE) {
       const allowed = getAllowedPowerUps(levelIndex);
       const common = [PowerUpType.LASER, PowerUpType.STICKY, PowerUpType.ENLARGE].filter(t => allowed.includes(t));
       const uncommon = [PowerUpType.MULTIBALL, PowerUpType.SHIELD].filter(t => allowed.includes(t));
       const rare = [PowerUpType.CLUSTER, PowerUpType.LIGHTNING].filter(t => allowed.includes(t));

       // Weighted Drop System
       const r = Math.random() * 100;
       let pool: PowerUpType[] = [];
       
       if (r < 60) {
           // Common (60%)
           pool = common;
       } else if (r < 90) {
           // Uncommon (30%)
           pool = uncommon;
       } else {
           // Rare (10%)
           pool = rare;
       }

       // Fallback logic
       if (pool.length === 0) {
            if (uncommon.length > 0) pool = uncommon;
            else if (common.length > 0) pool = common;
            else if (allowed.includes(PowerUpType.HEART)) pool = [PowerUpType.HEART];
       }

       if (pool.length > 0) {
           const type = pool[Math.floor(Math.random() * pool.length)];
           powerUpsRef.current.push({
             id: Math.random(),
             x: x,
             y: y,
             width: 20,
             height: 20,
             dy: POWERUP_SPEED,
             type: type,
             active: true,
             color: POWERUP_COLORS[type]
           });
       }
    }
  };

  const fireLaser = () => {
    playSound('shoot');
    const paddleCenter = paddleRef.current.x + paddleRef.current.width / 2;
    
    laserBeamRef.current = {
      active: true,
      x: paddleCenter,
      y: paddleRef.current.y,
      timer: 30, // Frames to show beam (approx 0.5s at 60fps)
      alpha: 1.0
    };
    
    // Destroy bricks with beam width (prevents shooting through gaps)
    const beamHalfWidth = 6; // 12px wide hit area covering visual core + inner glow
    
    bricksRef.current.forEach(b => {
       if (b.status > 0) {
         const overlap = (paddleCenter + beamHalfWidth >= b.x) && 
                         (paddleCenter - beamHalfWidth <= b.x + b.width);
                         
         if (overlap) {
            // INSTANT DESTRUCTION LOGIC
            b.status = 0; // Vaporize!
            
            setScore(s => s + b.value); 
            addFloatingText(b.x + b.width / 2, b.y, `+${b.value}`, '#ffffff');
            particlesRef.current.push(...createParticles(b.x + b.width / 2, b.y + b.height / 2, b.color));
            playSound('brick');
            
            // Always drop powerup check since it's destroyed
            attemptPowerUpDrop(b.x + b.width / 2, b.y + b.height / 2);
         }
       }
    });
  };

  // Logic to monitor lives and set critical mode for Last Stand
  useEffect(() => {
    // Activate Mercy Mode if at 1 life AND we haven't used the one-time event yet
    if (lives === 1 && !hasTriggeredMercyEventRef.current) {
        if (!isCriticalModeRef.current) {
            isCriticalModeRef.current = true;
            criticalHitCounterRef.current = 0;
            // Random target between 6 and 12 hits before spawn
            criticalHeartTargetRef.current = Math.floor(Math.random() * 7) + 6; 
        }
    } else {
        // If lives > 1, we are safe (or already used it), so disable mode
        isCriticalModeRef.current = false;
    }
  }, [lives]);

  // Input Listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysPressed.current[e.code] = true;
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
        if (gameState === GameState.MENU || gameState === GameState.GAME_OVER || gameState === GameState.VICTORY) {
           // Handled by UI
        } else {
           launchBalls();
        }
      }
      // Dash Input (Shift)
      if (e.key === 'Shift') {
        // Detect movement direction from held keys
        if (keysPressed.current['ArrowLeft'] || keysPressed.current['KeyA']) {
            performDash('left');
        } else if (keysPressed.current['ArrowRight'] || keysPressed.current['KeyD']) {
            performDash('right');
        }
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current[e.code] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [gameState, launchBalls, performDash]);

  // Level Update Listener
  useEffect(() => {
    const currentLevelKey = `${campaignMode}-${levelIndex}-${difficultyMultiplier}`;
    
    // Only run initialization if the level config actually changed AND we are playing
    if (gameState === GameState.PLAYING && prevLevelKey.current !== currentLevelKey) {
        prevLevelKey.current = currentLevelKey;

        // Perform "Hard Reset" for the new level
        initBricks();
        
        // Reset Paddle & Ball (clears all powerups from player)
        resetPaddle();
        ballsRef.current = [spawnBall(false)];
        
        // Clear Environment (clears falling items)
        powerUpsRef.current = [];
        particlesRef.current = [];
        shrapnelsRef.current = [];
        paddleGhostsRef.current = [];
        lightningArcsRef.current = [];
        
        // Reset Logic Flags
        isWaitingForFinalHeartRef.current = false;
        finalHeartIdRef.current = null;
        
        let levelText = '';
        if (campaignMode === CampaignMode.ARCADE) {
             levelText = `LEVEL ${levelIndex + 1}`;
        } else {
             // const loop = Math.floor(difficultyMultiplier); // Unused
             levelText = `STAGE ${levelIndex + 1}`;
        }
        addFloatingText(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, levelText, '#ffffff');
    }
  }, [levelIndex, initBricks, spawnBall, gameState, campaignMode, difficultyMultiplier, resetPaddle]);

  // Game Loop
  const update = useCallback(() => {
    if (gameState !== GameState.PLAYING) return;
    const now = Date.now();

    // --- TIMED POWERUPS LOGIC ---
    const stickyActive = now < powerUpStateRef.current.stickyEndTime;
    const lightningActive = now < powerUpStateRef.current.lightningEndTime;
    const clusterActive = now < powerUpStateRef.current.clusterEndTime;

    // Check Enlarge Expiry
    if (paddleRef.current.isEnlarged && now > powerUpStateRef.current.enlargeEndTime) {
      const oldWidth = paddleRef.current.width;
      const newWidth = PADDLE_WIDTH * DIFFICULTY_SETTINGS[difficulty].paddleWidthFactor;
      const widthDiff = newWidth - oldWidth;

      // Center shrink
      paddleRef.current.x -= widthDiff / 2;
      paddleRef.current.width = newWidth;
      
      // Clamp
      paddleRef.current.x = Math.max(0, paddleRef.current.x);
      paddleRef.current.x = Math.min(CANVAS_WIDTH - paddleRef.current.width, paddleRef.current.x);

      paddleRef.current.isEnlarged = false;
    }

    // Check Shield Expiry
    if (shieldActiveRef.current && now > powerUpStateRef.current.shieldEndTime) {
      shieldActiveRef.current = false;
    }

    // Check Laser Fire
    if (powerUpStateRef.current.laserFireTime > 0 && now > powerUpStateRef.current.laserFireTime) {
      fireLaser();
      powerUpStateRef.current.laserFireTime = 0;
    }
    
    // Update Paddle Color State
    if (stickyActive) {
      paddleRef.current.color = POWERUP_COLORS[PowerUpType.STICKY];
    } else if (lightningActive) {
      paddleRef.current.color = POWERUP_COLORS[PowerUpType.LIGHTNING];
    } else if (clusterActive) {
      paddleRef.current.color = POWERUP_COLORS[PowerUpType.CLUSTER];
    } else {
      paddleRef.current.color = COLORS.paddle;
    }

    // --- INPUT HANDLING (PADDLE & AIMING) ---
    const paddleSpeed = 8;
    const isHoldingDown = keysPressed.current['ArrowDown'] || keysPressed.current['KeyS'];
    const stuckBalls = ballsRef.current.filter(b => !b.active);
    const isTouchActive = touchRef.current.active;
    
    // Capture previous position for velocity calculation
    const prevPaddleX = paddleRef.current.x;

    // AIMING LOGIC (Touch or Keyboard)
    if (stuckBalls.length > 0) {
      if (isTouchActive && touchRef.current.zone === 'UPPER') {
         // Touch Aiming (Upper Zone)
         const center = CANVAS_WIDTH / 2;
         const clampedX = Math.max(0, Math.min(CANVAS_WIDTH, touchRef.current.x));
         const factor = (clampedX - center) / (CANVAS_WIDTH / 2); 
         
         const maxOffset = (paddleRef.current.width / 2) - BALL_RADIUS;
         const newOffset = factor * maxOffset;
         
         stuckBalls.forEach(ball => {
             ball.stuckOffset = newOffset;
         });
      } else if (isHoldingDown) {
         // Keyboard Aiming
         const aimSpeed = 5;
         stuckBalls.forEach(ball => {
            if (ball.stuckOffset === undefined) ball.stuckOffset = 0;
            
            if (keysPressed.current['ArrowRight'] || keysPressed.current['KeyD']) {
               ball.stuckOffset += aimSpeed;
            }
            if (keysPressed.current['ArrowLeft'] || keysPressed.current['KeyA']) {
               ball.stuckOffset -= aimSpeed;
            }
            
            const maxOffset = (paddleRef.current.width / 2) - ball.radius;
            if (ball.stuckOffset > maxOffset) ball.stuckOffset = maxOffset;
            if (ball.stuckOffset < -maxOffset) ball.stuckOffset = -maxOffset;
         });
      }
    }

    // PADDLE MOVEMENT LOGIC
    if (isTouchActive && touchRef.current.zone === 'LOWER') {
        const targetX = touchRef.current.x - paddleRef.current.width / 2;
        const dx = targetX - paddleRef.current.x;
        const maxStep = 60; 
        
        if (Math.abs(dx) > maxStep) {
            paddleRef.current.x += Math.sign(dx) * maxStep;
        } else {
            paddleRef.current.x = targetX;
        }

        if (paddleRef.current.x < 0) paddleRef.current.x = 0;
        if (paddleRef.current.x + paddleRef.current.width > CANVAS_WIDTH) paddleRef.current.x = CANVAS_WIDTH - paddleRef.current.width;
        
    } else if (!isHoldingDown || stuckBalls.length === 0) {
      // Normal Keyboard Mode
      if (keysPressed.current['ArrowRight'] || keysPressed.current['KeyD']) {
        paddleRef.current.x += paddleSpeed;
        if (paddleRef.current.x + paddleRef.current.width > CANVAS_WIDTH) {
          paddleRef.current.x = CANVAS_WIDTH - paddleRef.current.width;
        }
      }
      if (keysPressed.current['ArrowLeft'] || keysPressed.current['KeyA']) {
        paddleRef.current.x -= paddleSpeed;
        if (paddleRef.current.x < 0) {
          paddleRef.current.x = 0;
        }
      }
    }
    
    // Calculate paddle velocity for physics
    const paddleVelocity = paddleRef.current.x - prevPaddleX;

    // --- MERCY PRIORITY WAIT LOGIC ---
    if (isWaitingForFinalHeartRef.current) {
        // Check if heart is still active
        const heart = powerUpsRef.current.find(p => p.id === finalHeartIdRef.current);
        const heartStillActive = heart && heart.active && heart.y < CANVAS_HEIGHT;
        
        // Check if balls are active
        const ballsActive = ballsRef.current.length > 0 && ballsRef.current.some(b => b.y < CANVAS_HEIGHT + 20);

        if (!heartStillActive || !ballsActive) {
            // Outcome decided: Either collected heart, missed heart, or ball died.
            isWaitingForFinalHeartRef.current = false;
            finalHeartIdRef.current = null;
            onLevelComplete();
            return; // Exit update loop for this frame
        }
    }

    // --- BALL LOGIC ---
    let activeBallsCount = 0;
    
    ballsRef.current.forEach(ball => {
      if (!ball.active) {
        // Stick to paddle
        const offset = ball.stuckOffset ?? 0;
        ball.x = paddleRef.current.x + paddleRef.current.width / 2 + offset;
        ball.y = paddleRef.current.y - ball.radius - 2;
        
        const halfPaddle = paddleRef.current.width / 2;
        const center = paddleRef.current.x + halfPaddle;
        
        if (ball.x < center - halfPaddle + ball.radius) {
            ball.x = center - halfPaddle + ball.radius;
            ball.stuckOffset = -halfPaddle + ball.radius;
        }
        if (ball.x > center + halfPaddle - ball.radius) {
            ball.x = center + halfPaddle - ball.radius;
            ball.stuckOffset = halfPaddle - ball.radius;
        }
        
        // Reset dynamics while stuck
        ball.spin = 0;
        ball.trail = [];

      } else {
        activeBallsCount++;
        
        // Update Trail
        ball.trail.push({ x: ball.x, y: ball.y });
        if (ball.trail.length > 8) {
            ball.trail.shift();
        }

        // Apply Magnus Force (Spin)
        // User requested subtle effect (0.001), tweaked to 0.0015 for balance
        ball.dx += ball.spin * 0.0015;
        // Apply Air Resistance to Spin
        ball.spin *= 0.98;

        ball.x += ball.dx;
        ball.y += ball.dy;

        // Walls
        if (ball.x + ball.radius > CANVAS_WIDTH) {
          ball.x = CANVAS_WIDTH - ball.radius;
          ball.dx = -ball.dx;
          playSound('wall');
        } else if (ball.x - ball.radius < 0) {
          ball.x = ball.radius;
          ball.dx = -ball.dx;
          playSound('wall');
        }

        if (ball.y - ball.radius < 0) {
          ball.y = ball.radius;
          ball.dy = -ball.dy;
          playSound('wall');
        } 
        
        // Floor / Shield
        else if (ball.y + ball.radius > CANVAS_HEIGHT) {
           if (shieldActiveRef.current) {
             ball.y = CANVAS_HEIGHT - ball.radius;
             ball.dy = -Math.abs(ball.dy);
             playSound('paddle'); 
           } else {
             ball.active = false; 
             ball.trail = [];
             ball.y = CANVAS_HEIGHT + 100;
           }
        }

        // Paddle Collision
        const paddleCol = detectCircleRectCollision(ball, paddleRef.current);
        if (paddleCol.hit) {
           if (stickyActive) {
             // Catch the ball
             ball.active = false;
             ball.trail = [];
             ball.stuckOffset = ball.x - (paddleRef.current.x + paddleRef.current.width / 2);
             ball.dx = 0;
             ball.dy = 0;
             ball.spin = 0;
             playSound('paddle');
           } else {
             playSound('paddle');
             streakRef.current = 0;
             setMultiplier(1);
             paddleRef.current.flashTimer = 4;
             paddleImpactsRef.current.push({
               id: Math.random(),
               x: ball.x - paddleRef.current.x,
               life: 1.0
             });

             // Calculate hit point relative to paddle center (-1 to 1)
             let hitPoint = (ball.x - (paddleRef.current.x + paddleRef.current.width / 2)) / (paddleRef.current.width / 2);
             
             // Apply paddle velocity influence to bounce ANGLE
             hitPoint += paddleVelocity * 0.02;
             
             // Apply paddle velocity to SPIN (Magnus Effect)
             // Increased friction slightly to ensure effect is visible on keyboard
             ball.spin = paddleVelocity * 0.15;
             
             hitPoint = Math.max(-1, Math.min(1, hitPoint));
             
             const angle = hitPoint * (Math.PI / 3); // Max 60 degrees
             const speed = Math.sqrt(ball.dx*ball.dx + ball.dy*ball.dy);
             const newSpeed = Math.min(speed * 1.05, 14); 
             
             let newDx = newSpeed * Math.sin(angle);
             let newDy = -newSpeed * Math.cos(angle); // Always bounce up

             // Prevent vertical loops using Micro-Drift instead of hard clamp
             if (Math.abs(newDx) < 0.1) {
                 newDx += (Math.random() * 0.1) - 0.05;
             }

             // Normalize to ensure exact speed
             const velocityMagnitude = Math.sqrt(newDx * newDx + newDy * newDy);
             ball.dx = (newDx / velocityMagnitude) * newSpeed;
             ball.dy = (newDy / velocityMagnitude) * newSpeed;
           }
        }

        // Brick Collision
        for (let i = 0; i < bricksRef.current.length; i++) {
          const b = bricksRef.current[i];
          if (b.status > 0) {
            const collision = detectCircleRectCollision(ball, b);
            if (collision.hit) {
              let shouldBounce = true;
              let destroyed = false;
              
              // --- NORMAL LOGIC ---
              const currentSpeed = Math.sqrt(ball.dx*ball.dx + ball.dy*ball.dy);
              const isMomentumPierce = currentSpeed > DIFFICULTY_SETTINGS[difficulty].ballSpeed * PIERCE_THRESHOLD_FACTOR;
              
              b.status -= 1; // Normal damage
              if (b.status <= 0) destroyed = true;
              
              if (isMomentumPierce) {
                  shouldBounce = false;
                  playSound('pierce');
                  ball.dx *= PIERCE_DRAG;
                  ball.dy *= PIERCE_DRAG;
                  shakeRef.current = 3;
              } else {
                  shouldBounce = true;
                  playSound('brick');
              }

              // Scoring & Effects
              streakRef.current += 1;
              const currentMultiplier = 1 + (streakRef.current * 0.1);
              setMultiplier(currentMultiplier);
              const points = Math.floor(b.value * currentMultiplier);
              setScore(prev => prev + points);
              addFloatingText(b.x + b.width / 2, b.y, `+${points}`, '#ffffff');
              particlesRef.current.push(...createParticles(b.x + b.width / 2, b.y + b.height / 2, b.color));

              // Bounce Physics
              if (shouldBounce) {
                 if (collision.axis === 'x') {
                    const dir = ball.x < (b.x + b.width / 2) ? -1 : 1;
                    ball.x += dir * (collision.overlap || 1);
                    ball.dx = -ball.dx;
                 } else {
                    const dir = ball.y < (b.y + b.height / 2) ? -1 : 1;
                    ball.y += dir * (collision.overlap || 1);
                    ball.dy = -ball.dy;
                 }
              }

              // Special effects (Lightning/Cluster)
              if (lightningActive) triggerLightning(b.x + b.width/2, b.y + b.height/2);
              if (clusterActive) spawnShrapnel(b.x + b.width/2, b.y + b.height/2);
              
              if (destroyed) {
                  attemptPowerUpDrop(b.x + b.width / 2, b.y + b.height / 2);
              }
              break; 
            }
          }
        }
      }
    });

    // --- SHRAPNEL LOGIC ---
    shrapnelsRef.current.forEach(s => {
        s.x += s.dx;
        s.y += s.dy;
        s.life -= 1;
        
        // Wall Collisions
        if (s.x < 0 || s.x > CANVAS_WIDTH) s.dx = -s.dx;
        if (s.y < 0) s.dy = -s.dy;

        // Brick Collisions
        for (let i = 0; i < bricksRef.current.length; i++) {
            const b = bricksRef.current[i];
            if (b.status > 0) {
                const rect = { x: b.x, y: b.y, width: b.width, height: b.height };
                // Simple point check or circle check
                if (s.x > rect.x && s.x < rect.x + rect.width &&
                    s.y > rect.y && s.y < rect.y + rect.height) {
                        b.status -= 1;
                        setScore(prev => prev + b.value);
                        particlesRef.current.push(...createParticles(s.x, s.y, b.color));
                        playSound('brick');
                        s.life = 0; // Destroy shrapnel on hit
                        break;
                }
            }
        }
    });
    shrapnelsRef.current = shrapnelsRef.current.filter(s => s.life > 0 && s.y < CANVAS_HEIGHT);


    // Check Lives (Only if NOT waiting for final heart result)
    ballsRef.current = ballsRef.current.filter(b => b.y < CANVAS_HEIGHT + 50); 
    
    if (!isWaitingForFinalHeartRef.current && ballsRef.current.length === 0) {
      const newLives = lives - 1;
      setLives(newLives);
      streakRef.current = 0; // Reset streak on life loss
      setMultiplier(1);
      
      if (newLives <= 0) {
        playSound('gameover');
        setGameState(GameState.GAME_OVER);
      } else {
        // Soft reset: Keep powerups, reset ball
        resetLevel(true); 
      }
    }

    // --- POWER UPS ---
    powerUpsRef.current.forEach(p => {
       p.y += p.dy;
       // Collision with paddle
       if (p.active && 
           p.x + p.width > paddleRef.current.x && 
           p.x < paddleRef.current.x + paddleRef.current.width &&
           p.y + p.height > paddleRef.current.y &&
           p.y < paddleRef.current.y + paddleRef.current.height) {
             p.active = false;
             activatePowerUp(p.type, p.x + p.width / 2, p.y + p.height / 2, p.color);
       }
    });
    powerUpsRef.current = powerUpsRef.current.filter(p => p.active && p.y < CANVAS_HEIGHT);

    // --- CHECK LEVEL COMPLETE ---
    // Failsafe check at end of frame to catch Ball, Lightning, or Shrapnel destruction
    if (!isWaitingForFinalHeartRef.current) {
       const hasBricks = bricksRef.current.some(b => b.status > 0);
       if (!hasBricks) {
           // Level Cleared
           if (lives === 1 && !hasTriggeredMercyEventRef.current) {
               // Mercy Event: Spawn Heart at Center if player is critical and hasn't used mercy yet
               const heartId = Math.random();
               powerUpsRef.current.push({
                   id: heartId,
                   x: CANVAS_WIDTH / 2 - 10,
                   y: CANVAS_HEIGHT / 2, // Spawn in middle
                   width: 20, height: 20, 
                   dy: POWERUP_SPEED * 0.8, 
                   type: PowerUpType.HEART, 
                   active: true, 
                   color: POWERUP_COLORS[PowerUpType.HEART]
               });
               
               isWaitingForFinalHeartRef.current = true;
               finalHeartIdRef.current = heartId;
               hasTriggeredMercyEventRef.current = true;
           } else {
               // Standard Win
               onLevelComplete();
               return; // Stop update loop
           }
       }
    }

    // --- LASER BEAM ---
    if (laserBeamRef.current) {
      laserBeamRef.current.timer--;
      laserBeamRef.current.alpha = laserBeamRef.current.timer / 30;
      if (laserBeamRef.current.timer <= 0) {
        laserBeamRef.current = null;
      }
    }

    // --- EFFECTS UPDATE ---
    updateParticles(particlesRef.current);
    
    // Paddle Impacts
    paddleImpactsRef.current.forEach(p => p.life -= 0.05);
    paddleImpactsRef.current = paddleImpactsRef.current.filter(p => p.life > 0);

    // Paddle Ghosts
    paddleGhostsRef.current.forEach(g => g.life -= 0.1);
    paddleGhostsRef.current = paddleGhostsRef.current.filter(g => g.life > 0);

    // Lightning Arcs
    lightningArcsRef.current.forEach(arc => arc.life -= 0.1);
    lightningArcsRef.current = lightningArcsRef.current.filter(arc => arc.life > 0);

    // Floating Texts
    floatingTextsRef.current.forEach(t => {
      t.y += t.dy;
      t.life -= 0.02;
    });
    floatingTextsRef.current = floatingTextsRef.current.filter(t => t.life > 0);

  }, [gameState, difficulty, resetLevel, setGameState, setLives, setScore, lives, setMultiplier, triggerLightning, spawnShrapnel, getLaunchVector, onLevelComplete, campaignMode, difficultyMultiplier]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const now = Date.now();
    
    // 1. CLEAR CANVAS
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    // 2. APPLY SCREEN SHAKE
    ctx.save();
    if (shakeRef.current > 0) {
        const magnitude = shakeRef.current;
        const shakeX = (Math.random() - 0.5) * magnitude;
        const shakeY = (Math.random() - 0.5) * magnitude;
        ctx.translate(shakeX, shakeY);
        
        // Decay shake
        shakeRef.current *= 0.9;
        if (shakeRef.current < 0.5) shakeRef.current = 0;
    }

    // Helper for blinking logic
    const getBlinkState = (endTime: number) => {
      const remaining = endTime - now;
      if (remaining > POWERUP_WARNING_MS) return true;
      if (remaining <= 0) return false;
      let interval = 300;
      if (remaining < 1000) interval = 100;
      if (remaining < 500) interval = 50;
      return Math.floor(now / interval) % 2 === 0;
    };

    // --- ICON DRAWING FUNCTIONS ---

    const drawSpikyBall = (x: number, y: number, radius: number, color: string) => {
      const spikes = 8;
      const outerRadius = radius;
      const innerRadius = radius / 2;
      let rot = Math.PI / 2 * 3;
      let cx = x;
      let cy = y;
      let step = Math.PI / spikes;

      ctx.beginPath();
      ctx.moveTo(cx, cy - outerRadius);
      for (let i = 0; i < spikes; i++) {
          let sx = cx + Math.cos(rot) * outerRadius;
          let sy = cy + Math.sin(rot) * outerRadius;
          ctx.lineTo(sx, sy);
          rot += step;

          sx = cx + Math.cos(rot) * innerRadius;
          sy = cy + Math.sin(rot) * innerRadius;
          ctx.lineTo(sx, sy);
          rot += step;
      }
      ctx.lineTo(cx, cy - outerRadius);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      
      // Add shine
      ctx.shadowBlur = 5;
      ctx.shadowColor = color;
      ctx.fill();
      ctx.shadowBlur = 0;
    };

    const drawHeart = (x: number, y: number, radius: number, color: string) => {
      const size = radius * 2;
      ctx.beginPath();
      const topCurveHeight = size * 0.3;
      const startX = x;
      const startY = y - size / 4; 
      
      ctx.moveTo(startX, startY + topCurveHeight);
      ctx.bezierCurveTo(
        startX, startY, 
        startX - size / 2, startY, 
        startX - size / 2, startY + topCurveHeight
      );
      ctx.bezierCurveTo(
        startX - size / 2, startY + (size + topCurveHeight) / 2, 
        startX, startY + (size + topCurveHeight) / 2, 
        startX, startY + size
      );
      ctx.bezierCurveTo(
        startX + size / 2, startY + (size + topCurveHeight) / 2, 
        startX + size / 2, startY + (size + topCurveHeight) / 2, 
        startX + size / 2, startY + topCurveHeight
      );
      ctx.bezierCurveTo(
        startX + size / 2, startY, 
        startX, startY, 
        startX, startY + topCurveHeight
      );
      
      ctx.fillStyle = color;
      ctx.fill();
      ctx.shadowBlur = 8;
      ctx.shadowColor = color;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.closePath();
    };

    const drawLaserIcon = (x: number, y: number, color: string) => {
        const pulse = Math.abs(Math.sin(now / 200)); 
        const outerGlow = 10 + pulse * 10;
        ctx.save();
        ctx.translate(x, y);
        ctx.beginPath();
        ctx.arc(0, 0, 10 + pulse * 2, 0, Math.PI * 2);
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.shadowBlur = outerGlow;
        ctx.shadowColor = color;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, -14 - pulse); ctx.lineTo(0, -6);
        ctx.moveTo(0, 6); ctx.lineTo(0, 14 + pulse);
        ctx.moveTo(-14 - pulse, 0); ctx.lineTo(-6, 0);
        ctx.moveTo(6, 0); ctx.lineTo(14 + pulse, 0);
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff'; 
        ctx.shadowBlur = 15;
        ctx.shadowColor = color;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(0, 0, 7, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 255, 255, 0.5)`;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
    };

    const drawShieldIcon = (x: number, y: number, radius: number, color: string) => {
        ctx.save();
        ctx.translate(x, y);
        const r = radius;
        ctx.beginPath();
        ctx.moveTo(-r*0.8, -r*0.8);
        ctx.lineTo(r*0.8, -r*0.8);
        ctx.lineTo(r*0.8, 0);
        ctx.quadraticCurveTo(r*0.8, r, 0, r*1.3);
        ctx.quadraticCurveTo(-r*0.8, r, -r*0.8, 0);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.shadowBlur = 8;
        ctx.shadowColor = color;
        ctx.fill();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.shadowBlur = 0;
        ctx.fillRect(-2, -r*0.5, 4, r*1.2);
        ctx.fillRect(-r*0.6, -2, r*1.2, 4);
        ctx.restore();
    };

    const drawMultiBallIcon = (x: number, y: number, radius: number, color: string) => {
        ctx.save();
        ctx.translate(x, y);
        const ballR = radius * 0.35;
        const offsets = [
            {x: 0, y: -radius * 0.4},
            {x: -radius * 0.5, y: radius * 0.4},
            {x: radius * 0.5, y: radius * 0.4}
        ];
        ctx.fillStyle = color;
        ctx.shadowBlur = 5;
        ctx.shadowColor = color;
        offsets.forEach(off => {
            ctx.beginPath();
            ctx.arc(off.x, off.y, ballR, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.beginPath();
            ctx.arc(off.x - ballR*0.3, off.y - ballR*0.3, ballR*0.3, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = color; 
        });
        ctx.restore();
    };

    const drawEnlargeIcon = (x: number, y: number, radius: number, color: string) => {
        ctx.save();
        ctx.translate(x, y);
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.shadowBlur = 8;
        ctx.shadowColor = color;
        const w = radius * 0.8;
        ctx.beginPath();
        ctx.moveTo(w*0.2, 0); ctx.lineTo(-w, 0); ctx.lineTo(-w*0.5, -w*0.5);
        ctx.moveTo(-w, 0); ctx.lineTo(-w*0.5, w*0.5);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-w*0.2, 0); ctx.lineTo(w, 0); ctx.lineTo(w*0.5, -w*0.5);
        ctx.moveTo(w, 0); ctx.lineTo(w*0.5, w*0.5);
        ctx.stroke();
        ctx.restore();
    };

    const drawLightningIcon = (x: number, y: number, radius: number, color: string) => {
        ctx.save();
        ctx.translate(x, y);
        ctx.beginPath();
        ctx.moveTo(-radius * 0.3, -radius * 0.8);
        ctx.lineTo(radius * 0.5, -radius * 0.2);
        ctx.lineTo(-radius * 0.1, -radius * 0.2);
        ctx.lineTo(radius * 0.3, radius * 0.8);
        ctx.lineTo(-radius * 0.5, radius * 0.2);
        ctx.lineTo(radius * 0.1, radius * 0.2);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.shadowBlur = 8;
        ctx.shadowColor = color;
        ctx.fill();
        ctx.restore();
    };

    const drawClusterIcon = (x: number, y: number, radius: number, color: string) => {
        ctx.save();
        ctx.translate(x, y);
        // Main core
        ctx.beginPath();
        ctx.arc(0, 0, radius * 0.5, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.shadowBlur = 6;
        ctx.shadowColor = color;
        ctx.fill();
        // Orbiting dots
        for(let i=0; i<3; i++) {
            const angle = (now / 200) + (i * (Math.PI * 2 / 3));
            const ox = Math.cos(angle) * radius * 0.8;
            const oy = Math.sin(angle) * radius * 0.8;
            ctx.beginPath();
            ctx.arc(ox, oy, radius * 0.2, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    };

    // Background
    const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    gradient.addColorStop(0, '#0f172a');
    gradient.addColorStop(1, '#1e293b');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Shield
    if (shieldActiveRef.current) {
      if (getBlinkState(powerUpStateRef.current.shieldEndTime)) {
        ctx.beginPath();
        ctx.moveTo(0, CANVAS_HEIGHT - 2);
        ctx.lineTo(CANVAS_WIDTH, CANVAS_HEIGHT - 2);
        ctx.strokeStyle = COLORS.shield;
        ctx.lineWidth = 4;
        ctx.shadowBlur = 10;
        ctx.shadowColor = COLORS.shield;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
    }

    // Laser Beam (Rendering)
    if (laserBeamRef.current) {
       ctx.save();
       ctx.globalAlpha = laserBeamRef.current.alpha;
       ctx.fillStyle = COLORS.laserBeam;
       ctx.shadowBlur = 30;
       ctx.shadowColor = COLORS.laserBeam;
       ctx.fillRect(laserBeamRef.current.x - 15, 0, 30, CANVAS_HEIGHT);
       ctx.fillStyle = '#ffffff'; 
       ctx.shadowBlur = 10;
       ctx.shadowColor = '#ffffff';
       ctx.fillRect(laserBeamRef.current.x - 4, 0, 8, CANVAS_HEIGHT);
       ctx.restore();
    }

    // Lightning Arcs
    lightningArcsRef.current.forEach(arc => {
        ctx.save();
        ctx.globalAlpha = arc.life;
        ctx.beginPath();
        ctx.moveTo(arc.x1, arc.y1);
        // Jagged line
        const midX = (arc.x1 + arc.x2) / 2 + (Math.random() - 0.5) * 30;
        const midY = (arc.y1 + arc.y2) / 2 + (Math.random() - 0.5) * 30;
        ctx.lineTo(midX, midY);
        ctx.lineTo(arc.x2, arc.y2);
        
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 3;
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#facc15';
        ctx.stroke();
        ctx.restore();
    });

    // Bricks
    bricksRef.current.forEach(b => {
      if (b.status > 0) {
        ctx.beginPath();
        ctx.roundRect(b.x, b.y, b.width, b.height, 4);
        ctx.fillStyle = b.color;
        ctx.fill();
        ctx.closePath();
        
        // Visual indicator for durable bricks (cracks or border)
        if (b.maxHealth > 1) {
            ctx.strokeStyle = 'rgba(0,0,0,0.3)';
            ctx.lineWidth = 2;
            ctx.strokeRect(b.x + 2, b.y + 2, b.width - 4, b.height - 4);
            
            if (b.status < b.maxHealth) {
                // Draw crack
                ctx.beginPath();
                ctx.moveTo(b.x + b.width * 0.2, b.y + b.height * 0.2);
                ctx.lineTo(b.x + b.width * 0.5, b.y + b.height * 0.8);
                ctx.lineTo(b.x + b.width * 0.8, b.y + b.height * 0.3);
                ctx.strokeStyle = 'rgba(0,0,0,0.5)';
                ctx.stroke();
            }
        }
      }
    });

    // Shrapnel
    shrapnelsRef.current.forEach(s => {
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
        ctx.fillStyle = s.color;
        ctx.fill();
    });

    // PowerUps
    powerUpsRef.current.forEach(p => {
       // Rare Glow Logic for Cluster and Lightning
       if (p.type === PowerUpType.CLUSTER || p.type === PowerUpType.LIGHTNING) {
           ctx.save();
           ctx.translate(p.x, p.y);
           // Pulsing effect
           const pulse = Math.sin(now / 100) * 2;
           ctx.beginPath();
           ctx.arc(0, 0, 16 + pulse, 0, Math.PI * 2);
           ctx.fillStyle = 'rgba(255, 215, 0, 0.3)'; // Gold
           ctx.shadowBlur = 10;
           ctx.shadowColor = 'gold';
           ctx.fill();
           
           // Inner ring
           ctx.beginPath();
           ctx.arc(0, 0, 12 + pulse, 0, Math.PI * 2);
           ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
           ctx.lineWidth = 1;
           ctx.stroke();
           
           ctx.restore();
       }

       const r = 10;
       if (p.type === PowerUpType.STICKY) {
         drawSpikyBall(p.x, p.y, r, p.color);
       } else if (p.type === PowerUpType.LASER) {
         drawLaserIcon(p.x, p.y, p.color);
       } else if (p.type === PowerUpType.HEART) {
         drawHeart(p.x, p.y, r, p.color);
       } else if (p.type === PowerUpType.SHIELD) {
         drawShieldIcon(p.x, p.y, r, p.color);
       } else if (p.type === PowerUpType.MULTIBALL) {
         drawMultiBallIcon(p.x, p.y, r, p.color);
       } else if (p.type === PowerUpType.ENLARGE) {
         drawEnlargeIcon(p.x, p.y, r, p.color);
       } else if (p.type === PowerUpType.LIGHTNING) {
         drawLightningIcon(p.x, p.y, r, p.color);
       } else if (p.type === PowerUpType.CLUSTER) {
         drawClusterIcon(p.x, p.y, r, p.color);
       } else {
         // Fallback
         ctx.beginPath();
         ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
         ctx.fillStyle = p.color;
         ctx.shadowBlur = 5;
         ctx.shadowColor = p.color;
         ctx.fill();
         ctx.fillStyle = 'white';
         ctx.font = '10px Arial';
         ctx.textAlign = 'center';
         ctx.textBaseline = 'middle';
         ctx.fillText(p.type[0], p.x, p.y);
         ctx.closePath();
       }
    });

    // Charging Effect (if laser is charging)
    if (powerUpStateRef.current.laserFireTime > now) {
         const timeLeft = powerUpStateRef.current.laserFireTime - now;
         const totalDuration = LASER_DELAY;
         const progress = 1 - (timeLeft / totalDuration); 
         const centerX = paddleRef.current.x + paddleRef.current.width / 2;
         const centerY = paddleRef.current.y;
         const radius = progress * 15;
         ctx.beginPath();
         ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
         ctx.fillStyle = `rgba(239, 68, 68, ${0.6 + Math.random() * 0.4})`;
         ctx.shadowBlur = 15 * progress;
         ctx.shadowColor = '#ef4444';
         ctx.fill();
         ctx.closePath();
    }

    // Paddle Ghosts (Dash Trail)
    paddleGhostsRef.current.forEach(g => {
        ctx.save();
        ctx.globalAlpha = g.life * 0.4;
        ctx.fillStyle = COLORS.paddle;
        ctx.beginPath();
        ctx.roundRect(g.x, g.y, g.width, g.height, 6);
        ctx.fill();
        ctx.restore();
    });

    // Paddle Drawing
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(paddleRef.current.x, paddleRef.current.y, paddleRef.current.width, paddleRef.current.height, 6);
    
    // Paddle Color Logic
    let paddleColor = paddleRef.current.color;
    if (paddleRef.current.flashTimer > 0) {
      paddleColor = COLORS.paddleFlash;
      paddleRef.current.flashTimer--;
    } else {
      const stickyActive = now < powerUpStateRef.current.stickyEndTime;
      const enlargeActive = paddleRef.current.isEnlarged;
      let shouldBlink = false;
      if (stickyActive && !getBlinkState(powerUpStateRef.current.stickyEndTime)) shouldBlink = true;
      if (enlargeActive && !getBlinkState(powerUpStateRef.current.enlargeEndTime)) shouldBlink = true;
      if (shouldBlink) paddleColor = '#ffffff';
    }
    
    ctx.shadowBlur = 15;
    ctx.shadowColor = paddleRef.current.color;
    ctx.fillStyle = paddleColor;
    ctx.fill();
    ctx.shadowBlur = 0;
    
    // Dash Ready Indicator (Green Bar) - Offset Left
    if (now >= paddleRef.current.dashCooldown) {
        ctx.fillStyle = '#4ade80'; // Green ready light
        const centerX = paddleRef.current.x + paddleRef.current.width / 2;
        // Two small lights on paddle face
        ctx.fillRect(centerX - 12, paddleRef.current.y + paddleRef.current.height - 4, 4, 2);
        
        ctx.shadowBlur = 5;
        ctx.shadowColor = '#4ade80';
        // Underglow bar - shifted left
        ctx.fillRect(centerX - 20, paddleRef.current.y + 22, 15, 4);
        ctx.shadowBlur = 0;
    }

    // Overlay Impacts
    ctx.clip();
    paddleImpactsRef.current.forEach(impact => {
        const cx = paddleRef.current.x + impact.x;
        const cy = paddleRef.current.y;
        const radius = 80 * (1 - impact.life);
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
        grad.addColorStop(0, `rgba(255, 255, 255, ${impact.life})`);
        grad.addColorStop(1, `rgba(255, 255, 255, 0)`);
        ctx.fillStyle = grad;
        ctx.fillRect(paddleRef.current.x, paddleRef.current.y, paddleRef.current.width, paddleRef.current.height);
    });
    ctx.restore();


    // Balls
    ballsRef.current.forEach(ball => {
      // Draw Trail
      if (ball.trail) {
        ball.trail.forEach((pos, index) => {
            const ratio = (index + 1) / ball.trail.length; // 0.1 to 1.0
            const opacity = ratio * 0.4; // Max 0.4 opacity
            
            // Visual Spin Indicator
            let fillStyle = `rgba(255, 255, 255, ${opacity})`;
            
            if (Math.abs(ball.spin) > 3.0) {
                 fillStyle = `rgba(236, 72, 153, ${opacity})`; // Pink for high spin
            } else if (Math.abs(ball.spin) > 0.5) {
                 fillStyle = `rgba(34, 211, 238, ${opacity})`; // Cyan for medium spin
            }

            ctx.beginPath();
            ctx.arc(pos.x, pos.y, ball.radius * ratio, 0, Math.PI * 2); 
            ctx.fillStyle = fillStyle;
            ctx.fill();
            ctx.closePath();
        });
      }

      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
      
      ctx.fillStyle = COLORS.ball;
      ctx.shadowBlur = 8;
      ctx.shadowColor = COLORS.ball;
      
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.closePath();
      
      // Draw guide for inactive balls
      if (!ball.active) {
         const offset = ball.stuckOffset ?? 0;
         // Use the shared helper function for drawing the guide line
         const { dx, dy } = getLaunchVector(offset, paddleRef.current.width / 2, 120); // 120px guide length
         
         const gradient = ctx.createLinearGradient(ball.x, ball.y, ball.x + dx, ball.y + dy);
         gradient.addColorStop(0, 'rgba(255, 255, 255, 0.6)');
         gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

         ctx.beginPath();
         ctx.moveTo(ball.x, ball.y);
         ctx.lineTo(ball.x + dx, ball.y + dy);
         ctx.strokeStyle = gradient;
         ctx.lineWidth = 2;
         ctx.setLineDash([4, 4]);
         ctx.stroke();
         ctx.setLineDash([]);
         ctx.closePath();
      }
    });
    
    // Particles
    particlesRef.current.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.life;
      ctx.fill();
      ctx.globalAlpha = 1.0;
      ctx.closePath();
    });

    // Floating Score Texts
    floatingTextsRef.current.forEach(t => {
      ctx.font = 'bold 16px "Orbitron", sans-serif';
      ctx.fillStyle = t.color;
      ctx.globalAlpha = t.life;
      ctx.fillText(t.text, t.x, t.y);
      ctx.globalAlpha = 1.0;
    });

    // Touch Feedback
    if (touchRef.current.active) {
        ctx.beginPath();
        ctx.arc(touchRef.current.x, touchRef.current.y, 15, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.stroke();
        ctx.closePath();
    }
    
    // 3. RESTORE CONTEXT (Undo Shake)
    ctx.restore();

  }, [getLaunchVector]); // Added dependency

  const tick = useCallback(() => {
    update();
    draw();
    requestRef.current = requestAnimationFrame(tick);
  }, [update, draw]);

  // Initial Setup (Only runs once on mount)
  useEffect(() => {
    initBricks();
    resetPaddle();
    resetLevel();
  }, []); 

  // Game Loop (Restarts loop when tick updates, e.g. pause/resume)
  useEffect(() => {
    if (requestRef.current) cancelAnimationFrame(requestRef.current);
    requestRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(requestRef.current);
  }, [tick]);

  // Reset logic when state changes to MENU
  useEffect(() => {
    if (gameState === GameState.MENU) {
      initBricks();
      resetPaddle();
      resetLevel(false);
    }
  }, [gameState, initBricks, resetPaddle, resetLevel]);

  return (
    <canvas 
      ref={canvasRef} 
      width={CANVAS_WIDTH} 
      height={CANVAS_HEIGHT}
      className="max-w-full h-auto shadow-2xl rounded-lg border border-slate-700 bg-slate-900 cursor-none"
      style={{ touchAction: 'none' }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    />
  );
};

export default GameCanvas;