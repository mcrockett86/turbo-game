/**
 * Visual Effects — Phase 4.3
 *
 * Particle system, screen shake, and lighting effects.
 * Provides atmospheric visual polish for the game.
 */

// ---- Particle Types ----
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  type: 'sparkle' | 'rain' | 'dust' | 'light';
}

// ---- Screen Shake State ----
interface ShakeState {
  intensity: number;
  duration: number;
  elapsed: number;
  active: boolean;
}

// ---- Lighting State ----
interface LightPulse {
  x: number;
  y: number;
  radius: number;
  intensity: number;
  maxIntensity: number;
  color: string;
  duration: number;
  elapsed: number;
  active: boolean;
}

// ---- Constants ----
const MAX_PARTICLES = 200;
const SHAKE_DECAY = 0.95;
const LIGHT_FADE = 0.02;

// ---- Renderer ----
export class VisualEffectsRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private particles: Particle[];
  private shake: ShakeState;
  private lights: LightPulse[];
  private animFrame: number | null = null;
  private lastTime: number;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.particles = [];
    this.shake = { intensity: 0, duration: 0, elapsed: 0, active: false };
    this.lights = [];
    this.lastTime = 0;
  }

  /** Spawn particles */
  spawnParticles(x: number, y: number, count: number, type: Particle['type'], color?: string): void {
    for (let i = 0; i < count && this.particles.length < MAX_PARTICLES; i++) {
      this.particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 4,
        vy: (Math.random() - 0.5) * 4 - 2,
        life: 1,
        maxLife: 0.5 + Math.random() * 1.5,
        size: 2 + Math.random() * 4,
        color: color || '#ffffff',
        type,
      });
    }
  }

  /** Trigger screen shake */
  triggerShake(intensity: number, duration: number): void {
    this.shake = {
      intensity,
      duration,
      elapsed: 0,
      active: true,
    };
  }

  /** Add light pulse */
  addLight(x: number, y: number, radius: number, color: string, intensity: number = 1, duration: number = 2): void {
    this.lights.push({
      x,
      y,
      radius,
      intensity,
      maxIntensity: intensity,
      color,
      duration,
      elapsed: 0,
      active: true,
    });
  }

  /** Main render loop */
  start(): void {
    this.lastTime = performance.now();
    const loop = (time: number) => {
      const delta = (time - this.lastTime) / 1000;
      this.lastTime = time;
      this.update(delta);
      this.render();
      this.animFrame = requestAnimationFrame(loop);
    };
    this.animFrame = requestAnimationFrame(loop);
  }

  /** Stop render loop */
  stop(): void {
    if (this.animFrame) {
      cancelAnimationFrame(this.animFrame);
      this.animFrame = null;
    }
  }

  /** Update effects */
  private update(delta: number): void {
    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * delta;
      p.y += p.vy * delta;
      p.life -= delta / p.maxLife;

      if (p.type === 'rain') {
        p.vy += 10 * delta; // Gravity
      }

      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }

    // Update shake
    if (this.shake.active) {
      this.shake.elapsed += delta;
      if (this.shake.elapsed >= this.shake.duration) {
        this.shake.active = false;
        this.shake.intensity = 0;
      } else {
        this.shake.intensity *= SHAKE_DECAY;
      }
    }

    // Update lights
    for (let i = this.lights.length - 1; i >= 0; i--) {
      const l = this.lights[i];
      l.elapsed += delta;
      l.intensity = Math.max(0, l.maxIntensity - (l.elapsed / l.duration) * l.maxIntensity);

      if (l.elapsed >= l.duration) {
        this.lights.splice(i, 1);
      }
    }
  }

  /** Render effects */
  private render(): void {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Apply screen shake
    if (this.shake.active) {
      const shakeX = (Math.random() - 0.5) * this.shake.intensity * 10;
      const shakeY = (Math.random() - 0.5) * this.shake.intensity * 10;
      ctx.save();
      ctx.translate(shakeX, shakeY);
    }

    // Render particles
    for (const p of this.particles) {
      const alpha = p.life;
      ctx.fillStyle = p.color + Math.floor(alpha * 255).toString(16).padStart(2, '0');
      ctx.beginPath();

      switch (p.type) {
        case 'sparkle':
          ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
          break;
        case 'rain':
          ctx.rect(p.x, p.y, 1, p.size * 2);
          break;
        case 'dust':
          ctx.arc(p.x, p.y, p.size * 0.5 * p.life, 0, Math.PI * 2);
          break;
        case 'light':
          const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
          gradient.addColorStop(0, p.color);
          gradient.addColorStop(1, 'transparent');
          ctx.fillStyle = gradient;
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
          continue;
      }

      ctx.fill();
    }

    // Render lights
    for (const l of this.lights) {
      const gradient = ctx.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.radius);
      gradient.addColorStop(0, l.color + Math.floor(l.intensity * 80).toString(16).padStart(2, '0'));
      gradient.addColorStop(1, 'transparent');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(l.x, l.y, l.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Restore from shake
    if (this.shake.active) {
      ctx.restore();
    }
  }

  /** Get shake offset */
  getShakeOffset(): { x: number; y: number } {
    if (!this.shake.active) return { x: 0, y: 0 };
    return {
      x: (Math.random() - 0.5) * this.shake.intensity * 10,
      y: (Math.random() - 0.5) * this.shake.intensity * 10,
    };
  }

  /** Resize */
  resize(w: number, h: number): void {
    this.canvas.width = w;
    this.canvas.height = h;
  }

  /** Dispose */
  dispose(): void {
    this.stop();
  }
}
