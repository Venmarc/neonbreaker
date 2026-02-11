import React, { useRef, useEffect, useCallback } from 'react';
import { 
  CANVAS_WIDTH, CANVAS_HEIGHT, PADDLE_WIDTH, PADDLE_WIDTH_ENLARGED, PADDLE_HEIGHT, PADDLE_OFFSET_BOTTOM, 
  BALL_RADIUS, COLORS, BRICK_ROW_COUNT, BRICK_COLUMN_COUNT, 
  BRICK_WIDTH, BRICK_HEIGHT, BRICK_PADDING, BRICK_OFFSET_TOP, BRICK_OFFSET_LEFT,
  DIFFICULTY_SETTINGS, POWERUP_CHANCE, POWERUP_COLORS, POWERUP_SPEED,
  ENLARGE_DURATION, SHIELD_DURATION, LASER_DELAY, POWERUP_WARNING_MS, STICKY_DURATION
} from '../constants';
import { GameState, Difficulty, Ball, Paddle, Brick, Particle, PowerUp, PowerUpType } from '../types';
import { detectCircleRectCollision, createParticles, updateParticles } from '../utils/physics';
import { playSound } from '../utils/audio';

interface GameCanvasProps {
  gameState: GameState;
  setGameState: (state: GameState) => void;
  score: number;
  setScore: (score: number | ((prev: number) => number)) => void;
  lives: number;
  setLives: (lives: number | ((prev: number) => number)) => void;
  difficulty: Difficulty;
}

const GameCanvas: React.FC<GameCanvasProps> = ({ 
  gameState, setGameState, score, setScore, lives, setLives, difficulty 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);
  
  // Game State Refs
  const ballsRef = useRef<Ball[]>([]);
  const powerUpsRef = useRef<PowerUp[]>([]);
  const bricksRef = useRef<Brick[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const paddleRef = useRef<Paddle>({
    x: (CANVAS_WIDTH - PADDLE_WIDTH) / 2,
    y: CANVAS_HEIGHT - PADDLE_OFFSET_BOTTOM,
    width: PADDLE_WIDTH,
    height: PADDLE_HEIGHT,
    color: COLORS.paddle,
    isEnlarged: false,
    flashTimer: 0
  });
  
  // Visual effects for paddle hits
  const paddleImpactsRef = useRef<{ id: number; x: number; life: number }[]>([]);

  // Touch State
  const touchRef = useRef<{
    active: boolean;
    x: number;
    y: number;
    zone: 'UPPER' | 'LOWER' | null;
  }>({
    active: false,
    x: 0,
    y: 0,
    zone: null
  });

  // Track if a heart has spawned this game/level via normal RNG
  const hasSpawnedHeartRef = useRef<boolean>(false);

  // Critical Mode Refs (Pity Heart Logic)
  const isCriticalModeRef = useRef<boolean>(false);
  const criticalHitCounterRef = useRef<number>(0);
  const criticalHeartTargetRef = useRef<number>(0);

  // Power-up State (Timestamp based for better control)
  const powerUpStateRef = useRef<{
    enlargeEndTime: number;
    shieldEndTime: number;
    laserFireTime: number;
    stickyEndTime: number;
  }>({
    enlargeEndTime: 0,
    shieldEndTime: 0,
    laserFireTime: 0,
    stickyEndTime: 0
  });

  const shieldActiveRef = useRef<boolean>(false);
  const laserBeamRef = useRef<{active: boolean, x: number, y: number, timer: number, alpha: number} | null>(null);

  const keysPressed = useRef<{ [key: string]: boolean }>({});

  // Initialize Bricks
  const initBricks = useCallback(() => {
    // Reset level-specific flags
    hasSpawnedHeartRef.current = false;
    // Reset critical mode on new level, though lives might stay same
    // We'll let the lives useEffect handle critical mode activation

    const newBricks: Brick[] = [];
    for (let c = 0; c < BRICK_COLUMN_COUNT; c++) {
      for (let r = 0; r < BRICK_ROW_COUNT; r++) {
        const brickX = (c * (BRICK_WIDTH + BRICK_PADDING)) + BRICK_OFFSET_LEFT;
        const brickY = (r * (BRICK_HEIGHT + BRICK_PADDING)) + BRICK_OFFSET_TOP;
        newBricks.push({
          x: brickX,
          y: brickY,
          width: BRICK_WIDTH,
          height: BRICK_HEIGHT,
          status: 1,
          color: COLORS.bricks[r % COLORS.bricks.length],
          value: (BRICK_ROW_COUNT - r) * 10
        });
      }
    }
    bricksRef.current = newBricks;
  }, []);

  const resetPaddle = useCallback(() => {
    const settings = DIFFICULTY_SETTINGS[difficulty];
    paddleRef.current = {
      x: (CANVAS_WIDTH - (PADDLE_WIDTH * settings.paddleWidthFactor)) / 2,
      y: CANVAS_HEIGHT - PADDLE_OFFSET_BOTTOM,
      width: PADDLE_WIDTH * settings.paddleWidthFactor,
      height: PADDLE_HEIGHT,
      color: COLORS.paddle,
      isEnlarged: false,
      flashTimer: 0
    };
    // Clear effects
    shieldActiveRef.current = false;
    laserBeamRef.current = null;
    paddleImpactsRef.current = [];
    powerUpStateRef.current = {
      enlargeEndTime: 0,
      shieldEndTime: 0,
      laserFireTime: 0,
      stickyEndTime: 0
    };
    // Note: powerUpsRef is not cleared here as this is just paddle reset
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
      speed: settings.ballSpeed,
      active: isActive,
      stuckOffset: 0 // Initialize centered
    };
    return newBall;
  }, [difficulty]);

  const resetLevel = useCallback((keepPowerUps = false) => {
    ballsRef.current = [spawnBall(false)];
    
    // Always reset active effects (paddle size, shield, guns, sticky)
    laserBeamRef.current = null;
    shieldActiveRef.current = false;
    const settings = DIFFICULTY_SETTINGS[difficulty];
    paddleRef.current.width = PADDLE_WIDTH * settings.paddleWidthFactor;
    paddleRef.current.isEnlarged = false;
    
    powerUpStateRef.current = {
      enlargeEndTime: 0,
      shieldEndTime: 0,
      laserFireTime: 0,
      stickyEndTime: 0
    };

    // Only clear falling powerups/particles on a full reset (Menu/New Game), not on death
    if (!keepPowerUps) {
        particlesRef.current = [];
        powerUpsRef.current = [];
        paddleImpactsRef.current = [];
    }
  }, [spawnBall, difficulty]);

  const launchBalls = useCallback(() => {
    if (gameState !== GameState.PLAYING) return;
    
    const inactiveBalls = ballsRef.current.filter(b => !b.active);
    if (inactiveBalls.length > 0) {
      inactiveBalls.forEach(ball => {
         ball.active = true;
         // Use offset to calculate angle, similar to paddle hit logic
         const offset = ball.stuckOffset ?? 0;
         const hitPoint = offset / (paddleRef.current.width / 2);
         
         // Ensure hitPoint is within bounds in case paddle shrunk
         const clampedHitPoint = Math.max(-1, Math.min(1, hitPoint));
         const angle = clampedHitPoint * (Math.PI / 3); // Max 60 deg
         
         ball.dx = ball.speed * Math.sin(angle);
         ball.dy = -ball.speed * Math.cos(angle);

         // RULE: Minimum Horizontal Velocity on Launch
         const MIN_DX = 0.5;
         if (Math.abs(ball.dx) < MIN_DX) {
            const dir = ball.dx >= 0 ? 1 : -1;
            ball.dx = dir * MIN_DX;
            // Recalculate DY to maintain speed
            const remainingSpeedSq = Math.max(0, (ball.speed * ball.speed) - (ball.dx * ball.dx));
            ball.dy = -Math.sqrt(remainingSpeedSq);
         }

         // Add launch particles for visual flair
         particlesRef.current.push(...createParticles(ball.x, ball.y, COLORS.paddle));
      });
      playSound('paddle');
    }
  }, [gameState]);

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
    const zone = y < CANVAS_HEIGHT / 2 ? 'UPPER' : 'LOWER';
    touchRef.current = { active: true, x, y, zone };
  }, []);

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
        setLives(prev => Math.min(prev + 1, 4));
        // Note: isCriticalModeRef logic is handled in the lives useEffect
        break;

      case PowerUpType.ENLARGE:
        powerUpStateRef.current.enlargeEndTime = now + ENLARGE_DURATION;
        if (!paddleRef.current.isEnlarged) {
          const oldWidth = paddleRef.current.width;
          paddleRef.current.width = PADDLE_WIDTH_ENLARGED;
          paddleRef.current.x -= (PADDLE_WIDTH_ENLARGED - oldWidth) / 2; // Center expansion
          paddleRef.current.isEnlarged = true;
        }
        break;

      case PowerUpType.MULTIBALL:
        const currentBalls = [...ballsRef.current];
        currentBalls.forEach(b => {
           if (b.active) {
             // Spawn 2 new balls per active ball
             const b1 = spawnBall(true, b.x, b.y, b.dx * 0.8 + 1, b.dy);
             const b2 = spawnBall(true, b.x, b.y, b.dx * 0.8 - 1, b.dy);
             ballsRef.current.push(b1, b2);
           }
        });
        if (ballsRef.current.length === 0) {
           // If stuck with no balls (edge case), spawn one
           const b = spawnBall(true, paddleRef.current.x + paddleRef.current.width/2, paddleRef.current.y - 20, 2, -4);
           ballsRef.current.push(b);
        }
        break;

      case PowerUpType.SHIELD:
        powerUpStateRef.current.shieldEndTime = now + SHIELD_DURATION;
        shieldActiveRef.current = true;
        break;
      
      case PowerUpType.STICKY:
        powerUpStateRef.current.stickyEndTime = now + STICKY_DURATION;
        break;

      case PowerUpType.LASER:
        // Schedule laser fire using timestamp
        powerUpStateRef.current.laserFireTime = now + LASER_DELAY;
        break;
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
       if (b.status === 1) {
         // Check if beam rect overlaps brick rect horizontally
         // Beam X range: [paddleCenter - beamHalfWidth, paddleCenter + beamHalfWidth]
         // Brick X range: [b.x, b.x + b.width]
         const overlap = (paddleCenter + beamHalfWidth >= b.x) && 
                         (paddleCenter - beamHalfWidth <= b.x + b.width);
                         
         if (overlap) {
            b.status = 0;
            setScore(s => s + b.value);
            particlesRef.current.push(...createParticles(b.x + b.width / 2, b.y + b.height / 2, b.color));
            playSound('brick');
            // Laser hits shouldn't trigger critical heart logic directly to keep it focused on paddle play,
            // but we can allow it if desired. For now, sticking to standard collision loop logic.
         }
       }
    });
  };

  // Logic to monitor lives and set critical mode
  useEffect(() => {
    if (lives === 1) {
        isCriticalModeRef.current = true;
        criticalHitCounterRef.current = 0;
        // Random target between 6 and 12
        criticalHeartTargetRef.current = Math.floor(Math.random() * 7) + 6; 
    } else {
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
  }, [gameState, launchBalls]);

  // Game Loop
  const update = useCallback(() => {
    if (gameState !== GameState.PLAYING) return;
    const now = Date.now();

    // --- TIMED POWERUPS LOGIC ---
    const stickyActive = now < powerUpStateRef.current.stickyEndTime;

    // Check Enlarge Expiry
    if (paddleRef.current.isEnlarged && now > powerUpStateRef.current.enlargeEndTime) {
      paddleRef.current.width = PADDLE_WIDTH * DIFFICULTY_SETTINGS[difficulty].paddleWidthFactor;
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
    } else {
      paddleRef.current.color = COLORS.paddle;
    }

    // --- INPUT HANDLING (PADDLE & AIMING) ---
    const paddleSpeed = 8;
    const isHoldingDown = keysPressed.current['ArrowDown'] || keysPressed.current['KeyS'];
    const stuckBalls = ballsRef.current.filter(b => !b.active);
    const isTouchActive = touchRef.current.active;
    
    // AIMING LOGIC (Touch or Keyboard)
    if (stuckBalls.length > 0) {
      if (isTouchActive && touchRef.current.zone === 'UPPER') {
         // Touch Aiming (Upper Zone)
         const center = CANVAS_WIDTH / 2;
         // Map touch X to offset (-1 to 1 relative to center)
         const clampedX = Math.max(0, Math.min(CANVAS_WIDTH, touchRef.current.x));
         const factor = (clampedX - center) / (CANVAS_WIDTH / 2); 
         
         const maxOffset = (paddleRef.current.width / 2) - BALL_RADIUS;
         const newOffset = factor * maxOffset;
         
         stuckBalls.forEach(ball => {
             ball.stuckOffset = newOffset;
         });
      } else if (isHoldingDown) {
         // Keyboard Aiming (Down + Left/Right)
         const aimSpeed = 5;
         stuckBalls.forEach(ball => {
            if (ball.stuckOffset === undefined) ball.stuckOffset = 0;
            
            if (keysPressed.current['ArrowRight'] || keysPressed.current['KeyD']) {
               ball.stuckOffset += aimSpeed;
            }
            if (keysPressed.current['ArrowLeft'] || keysPressed.current['KeyA']) {
               ball.stuckOffset -= aimSpeed;
            }
            
            // Clamp offset to keep ball on paddle
            const maxOffset = (paddleRef.current.width / 2) - ball.radius;
            if (ball.stuckOffset > maxOffset) ball.stuckOffset = maxOffset;
            if (ball.stuckOffset < -maxOffset) ball.stuckOffset = -maxOffset;
         });
      }
    }

    // PADDLE MOVEMENT LOGIC
    // Touch overrides keyboard if active in LOWER zone
    if (isTouchActive && touchRef.current.zone === 'LOWER') {
        const targetX = touchRef.current.x - paddleRef.current.width / 2;
        const dx = targetX - paddleRef.current.x;
        
        // 1:1 Mapping with speed cap to prevent physics tunneling
        const maxStep = 60; // Max pixels per frame
        
        if (Math.abs(dx) > maxStep) {
            paddleRef.current.x += Math.sign(dx) * maxStep;
        } else {
            paddleRef.current.x = targetX;
        }

        // Clamp to screen bounds
        if (paddleRef.current.x < 0) {
          paddleRef.current.x = 0;
        }
        if (paddleRef.current.x + paddleRef.current.width > CANVAS_WIDTH) {
          paddleRef.current.x = CANVAS_WIDTH - paddleRef.current.width;
        }
        
    } else if (!isHoldingDown || stuckBalls.length === 0) {
      // Normal Keyboard Mode: Move Paddle (Only if not in Aim Mode)
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

    // --- BALL LOGIC ---
    let activeBallsCount = 0;
    
    // We clean up "dead" balls at the end, but here we process movement.
    
    ballsRef.current.forEach(ball => {
      if (!ball.active) {
        // Stick to paddle
        const offset = ball.stuckOffset ?? 0;
        ball.x = paddleRef.current.x + paddleRef.current.width / 2 + offset;
        ball.y = paddleRef.current.y - ball.radius - 2;
        
        // Clamp ball to paddle width (in case paddle shrunk)
        // Also updates the stuckOffset if it was out of bounds
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

      } else {
        activeBallsCount++;
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
             // Note: Shield doesn't expire on hit, only on time
           } else {
             ball.active = false; 
             // Force it well below canvas to ensure filter removes it next
             ball.y = CANVAS_HEIGHT + 100;
           }
        }

        // Paddle Collision
        const paddleCol = detectCircleRectCollision(ball, paddleRef.current);
        if (paddleCol.hit) {
           if (stickyActive) {
             // Catch the ball
             ball.active = false;
             ball.stuckOffset = ball.x - (paddleRef.current.x + paddleRef.current.width / 2);
             ball.dx = 0;
             ball.dy = 0;
             playSound('paddle');
           } else {
             playSound('paddle');

             // VISUAL EFFECT: Paddle Flash & Ripple
             paddleRef.current.flashTimer = 4;
             paddleImpactsRef.current.push({
               id: Math.random(),
               x: ball.x - paddleRef.current.x,
               life: 1.0
             });

             // Simple physics: change angle based on hit position
             let hitPoint = ball.x - (paddleRef.current.x + paddleRef.current.width / 2);
             hitPoint = hitPoint / (paddleRef.current.width / 2); // -1 to 1

             // RULE: Randomness/Jitter (±10% of width variance)
             hitPoint += (Math.random() - 0.5) * 0.1; 
             
             // Clamp for sanity
             hitPoint = Math.max(-1, Math.min(1, hitPoint));
             
             const angle = hitPoint * (Math.PI / 3); // Max 60 deg
             const speed = Math.sqrt(ball.dx*ball.dx + ball.dy*ball.dy);
             // Cap speed
             const newSpeed = Math.min(speed * 1.05, 14); 
             
             ball.dx = newSpeed * Math.sin(angle);
             ball.dy = -newSpeed * Math.cos(angle);

             // RULE: Minimum Horizontal Velocity
             const MIN_DX = 1.0;
             if (Math.abs(ball.dx) < MIN_DX) {
                let dir = Math.sign(hitPoint);
                if (dir === 0) dir = Math.random() > 0.5 ? 1 : -1;
                
                ball.dx = dir * MIN_DX;
                // Recalculate DY to maintain exact speed vector length
                const remainingSpeedSq = Math.max(0, (newSpeed * newSpeed) - (ball.dx * ball.dx));
                ball.dy = -Math.sqrt(remainingSpeedSq);
             }
             
             // Ensure it moves up
             if (ball.dy > 0) ball.dy = -ball.dy;
           }
        }

        // Brick Collision
        for (let i = 0; i < bricksRef.current.length; i++) {
          const b = bricksRef.current[i];
          if (b.status === 1) {
            const collision = detectCircleRectCollision(ball, b);
            if (collision.hit) {
              b.status = 0;
              setScore(prev => prev + b.value);
              playSound('brick');
              particlesRef.current.push(...createParticles(b.x + b.width / 2, b.y + b.height / 2, b.color));

              // Physics Response & Position Correction
              if (collision.axis === 'x') {
                // Correct position to prevent tunneling/sticky behavior
                // Push ball out of brick based on which side relative to center
                const dir = ball.x < (b.x + b.width / 2) ? -1 : 1;
                ball.x += dir * (collision.overlap || 1);
                ball.dx = -ball.dx;
              } else {
                const dir = ball.y < (b.y + b.height / 2) ? -1 : 1;
                ball.y += dir * (collision.overlap || 1);
                ball.dy = -ball.dy;
              }

              // Determine PowerUp Drop
              let spawnedPowerUp = false;

              // CRITICAL MODE LOGIC (Pity Heart)
              if (isCriticalModeRef.current) {
                  criticalHitCounterRef.current += 1;
                  
                  // Spawn heart if we hit the target count
                  if (criticalHitCounterRef.current === criticalHeartTargetRef.current) {
                       powerUpsRef.current.push({
                           id: Math.random(),
                           x: b.x + b.width / 2,
                           y: b.y + b.height / 2,
                           width: 20,
                           height: 20,
                           dy: POWERUP_SPEED,
                           type: PowerUpType.HEART,
                           active: true,
                           color: POWERUP_COLORS[PowerUpType.HEART]
                       });
                       isCriticalModeRef.current = false; // Disable mode after spawning
                       spawnedPowerUp = true;
                  }
              }

              // Normal Random Drop (if not already spawned by critical logic)
              if (!spawnedPowerUp && Math.random() < POWERUP_CHANCE) {
                 let types = Object.values(PowerUpType);
                 
                 // Heart Constraint: Only if lives == 1 AND hasn't spawned yet via normal means
                 // If we are in critical mode, we disable random hearts to rely on the deterministic logic
                 if (lives > 1 || hasSpawnedHeartRef.current || isCriticalModeRef.current) {
                   types = types.filter(t => t !== PowerUpType.HEART);
                 }

                 if (types.length > 0) {
                     const type = types[Math.floor(Math.random() * types.length)];
                     
                     if (type === PowerUpType.HEART) {
                         hasSpawnedHeartRef.current = true;
                     }

                     powerUpsRef.current.push({
                       id: Math.random(),
                       x: b.x + b.width / 2,
                       y: b.y + b.height / 2,
                       width: 20,
                       height: 20,
                       dy: POWERUP_SPEED,
                       type: type,
                       active: true,
                       color: POWERUP_COLORS[type]
                     });
                 }
              }
              break; 
            }
          }
        }
      }
    });

    // Check Lives
    // Filter balls: Keep if active, or if stuck on paddle (approx y < 580). 
    // Dead balls are pushed to y > 600.
    ballsRef.current = ballsRef.current.filter(b => b.y < CANVAS_HEIGHT + 50); 
    
    if (ballsRef.current.length === 0) {
      const newLives = lives - 1;
      setLives(newLives);
      
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

    // --- LASER BEAM ---
    if (laserBeamRef.current) {
      laserBeamRef.current.timer--;
      laserBeamRef.current.alpha = laserBeamRef.current.timer / 30;
      if (laserBeamRef.current.timer <= 0) {
        laserBeamRef.current = null;
      }
    }

    // --- PARTICLES ---
    updateParticles(particlesRef.current);
    
    // --- PADDLE IMPACTS ---
    paddleImpactsRef.current.forEach(p => p.life -= 0.05);
    paddleImpactsRef.current = paddleImpactsRef.current.filter(p => p.life > 0);

    // Win Condition
    const remainingBricks = bricksRef.current.filter(b => b.status === 1).length;
    if (remainingBricks === 0) {
       playSound('victory');
       setGameState(GameState.VICTORY);
    }

  }, [gameState, difficulty, resetLevel, setGameState, setLives, setScore, lives]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const now = Date.now();

    // Helper for blinking logic
    // Returns true if should be visible
    const getBlinkState = (endTime: number) => {
      const remaining = endTime - now;
      if (remaining > POWERUP_WARNING_MS) return true;
      if (remaining <= 0) return false;
      
      // Calculate blink interval: starts at 300ms, drops to 50ms as time expires
      // The closer to 0, the faster the blink
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
        startX, startY + (size + topCurveHeight) / 2, 
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
        // Pulsing Effect based on time
        const pulse = Math.abs(Math.sin(now / 200)); 
        const outerGlow = 10 + pulse * 10;
        
        ctx.save();
        ctx.translate(x, y);

        // 1. Outer Target Ring
        ctx.beginPath();
        ctx.arc(0, 0, 10 + pulse * 2, 0, Math.PI * 2);
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.shadowBlur = outerGlow;
        ctx.shadowColor = color;
        ctx.stroke();
        
        // 2. Crosshairs (Reticle)
        ctx.beginPath();
        // Top
        ctx.moveTo(0, -14 - pulse);
        ctx.lineTo(0, -6);
        // Bottom
        ctx.moveTo(0, 6);
        ctx.lineTo(0, 14 + pulse);
        // Left
        ctx.moveTo(-14 - pulse, 0);
        ctx.lineTo(-6, 0);
        // Right
        ctx.moveTo(6, 0);
        ctx.lineTo(14 + pulse, 0);
        
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();

        // 3. Center Beam Core (The "Laser")
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff'; // White hot center
        ctx.shadowBlur = 15;
        ctx.shadowColor = color;
        ctx.fill();
        
        // 4. Inner Ring (Spinning or static)
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
        
        // Shield Shape
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
        
        // White cross
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.shadowBlur = 0;
        // Vertical
        ctx.fillRect(-2, -r*0.5, 4, r*1.2);
        // Horizontal
        ctx.fillRect(-r*0.6, -2, r*1.2, 4);
        
        ctx.restore();
    };

    const drawMultiBallIcon = (x: number, y: number, radius: number, color: string) => {
        ctx.save();
        ctx.translate(x, y);
        
        const ballR = radius * 0.35;
        // Triangle formation
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
            
            // Tiny Highlight for depth
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.beginPath();
            ctx.arc(off.x - ballR*0.3, off.y - ballR*0.3, ballR*0.3, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = color; // reset
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
        
        // Left Arrow <
        ctx.beginPath();
        ctx.moveTo(w*0.2, 0);
        ctx.lineTo(-w, 0);
        ctx.lineTo(-w*0.5, -w*0.5);
        ctx.moveTo(-w, 0);
        ctx.lineTo(-w*0.5, w*0.5);
        ctx.stroke();

        // Right Arrow >
        ctx.beginPath();
        ctx.moveTo(-w*0.2, 0);
        ctx.lineTo(w, 0);
        ctx.lineTo(w*0.5, -w*0.5);
        ctx.moveTo(w, 0);
        ctx.lineTo(w*0.5, w*0.5);
        ctx.stroke();
        
        ctx.restore();
    };

    // Clear Screen
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Background
    const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    gradient.addColorStop(0, '#0f172a');
    gradient.addColorStop(1, '#1e293b');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Shield
    if (shieldActiveRef.current) {
      // Check blink for expiring shield
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
       
       // Outer glow (Red)
       ctx.fillStyle = COLORS.laserBeam;
       ctx.shadowBlur = 30;
       ctx.shadowColor = COLORS.laserBeam;
       ctx.fillRect(laserBeamRef.current.x - 15, 0, 30, CANVAS_HEIGHT);
       
       // Inner core (White hot)
       ctx.fillStyle = '#ffffff'; 
       ctx.shadowBlur = 10;
       ctx.shadowColor = '#ffffff';
       ctx.fillRect(laserBeamRef.current.x - 4, 0, 8, CANVAS_HEIGHT);
       
       ctx.restore();
    }

    // Bricks
    bricksRef.current.forEach(b => {
      if (b.status === 1) {
        ctx.beginPath();
        ctx.roundRect(b.x, b.y, b.width, b.height, 4);
        ctx.fillStyle = b.color;
        ctx.fill();
        ctx.closePath();
      }
    });

    // PowerUps
    powerUpsRef.current.forEach(p => {
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
         ctx.shadowBlur = 0;
         ctx.closePath();
       }
    });

    // Charging Effect (if laser is charging)
    if (powerUpStateRef.current.laserFireTime > now) {
         const timeLeft = powerUpStateRef.current.laserFireTime - now;
         const totalDuration = LASER_DELAY;
         const progress = 1 - (timeLeft / totalDuration); // 0 to 1
         
         // Visuals: Growing red orb on paddle
         const centerX = paddleRef.current.x + paddleRef.current.width / 2;
         const centerY = paddleRef.current.y;
         
         const radius = progress * 15;
         ctx.beginPath();
         ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
         // Flickering effect
         ctx.fillStyle = `rgba(239, 68, 68, ${0.6 + Math.random() * 0.4})`;
         ctx.shadowBlur = 15 * progress;
         ctx.shadowColor = '#ef4444';
         ctx.fill();
         ctx.closePath();
    }

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
      // Calculate blink for expiration of any paddle affecting powerup
      const stickyActive = now < powerUpStateRef.current.stickyEndTime;
      const enlargeActive = paddleRef.current.isEnlarged;
      
      let shouldBlink = false;
      // If sticky is active, check its warning timer
      if (stickyActive && !getBlinkState(powerUpStateRef.current.stickyEndTime)) shouldBlink = true;
      // If enlarge is active (and not overridden by sticky or is expiring), check its timer
      if (enlargeActive && !getBlinkState(powerUpStateRef.current.enlargeEndTime)) shouldBlink = true;

      if (shouldBlink) {
         paddleColor = '#ffffff';
      }
    }
    
    ctx.shadowBlur = 15;
    ctx.shadowColor = paddleRef.current.color;
    ctx.fillStyle = paddleColor;
    ctx.fill();
    ctx.shadowBlur = 0;
    
    // Overlay Impacts (clipped to paddle shape)
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
         const hitPoint = offset / (paddleRef.current.width / 2);
         const clampedHitPoint = Math.max(-1, Math.min(1, hitPoint));
         const angle = clampedHitPoint * (Math.PI / 3);
         const dx = Math.sin(angle);
         const dy = -Math.cos(angle);
         
         const guideLength = 120;
         
         // Create gradient for the laser sight
         const gradient = ctx.createLinearGradient(ball.x, ball.y, ball.x + dx * guideLength, ball.y + dy * guideLength);
         gradient.addColorStop(0, 'rgba(255, 255, 255, 0.6)');
         gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

         ctx.beginPath();
         ctx.moveTo(ball.x, ball.y);
         ctx.lineTo(ball.x + dx * guideLength, ball.y + dy * guideLength);
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

  }, []);

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