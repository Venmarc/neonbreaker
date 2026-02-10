import { Ball, Brick, Collision, Particle } from '../types';

export const detectCircleRectCollision = (circle: Ball, rect: { x: number, y: number, width: number, height: number }): Collision => {
  // Find the closest point to the circle within the rectangle
  const closestX = Math.max(rect.x, Math.min(circle.x, rect.x + rect.width));
  const closestY = Math.max(rect.y, Math.min(circle.y, rect.y + rect.height));

  // Calculate the distance between the circle's center and this closest point
  const distanceX = circle.x - closestX;
  const distanceY = circle.y - closestY;

  // If the distance is less than the circle's radius, an intersection occurs
  const distanceSquared = (distanceX * distanceX) + (distanceY * distanceY);
  
  if (distanceSquared < (circle.radius * circle.radius)) {
    // Determine the axis of collision based on the overlap
    // If the distance in X is greater than Y (normalized by dimensions), it's likely a side hit
    // A simplified robust approach:
    // If the ball center is horizontally within the rect's width range, it's a vertical hit.
    // Otherwise if it's vertically within the rect's height range, it's a horizontal hit.
    // If it's a corner, check which overlap is smaller.

    const overlapX = (circle.radius + rect.width / 2) - Math.abs(circle.x - (rect.x + rect.width / 2));
    const overlapY = (circle.radius + rect.height / 2) - Math.abs(circle.y - (rect.y + rect.height / 2));

    if (overlapX < overlapY) {
      return { hit: true, axis: 'x' };
    } else {
      return { hit: true, axis: 'y' };
    }
  }

  return { hit: false };
};

export const createParticles = (x: number, y: number, color: string): Particle[] => {
  const particles: Particle[] = [];
  for (let i = 0; i < 8; i++) {
    particles.push({
      x,
      y,
      dx: (Math.random() - 0.5) * 4,
      dy: (Math.random() - 0.5) * 4,
      life: 1.0, // Opacity/Life from 1 to 0
      color: color,
      size: Math.random() * 3 + 2
    });
  }
  return particles;
};

export const updateParticles = (particles: Particle[]) => {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.dx;
    p.y += p.dy;
    p.life -= 0.02; // Fade out speed
    if (p.life <= 0) {
      particles.splice(i, 1);
    }
  }
};
