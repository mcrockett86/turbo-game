/**
 * Zone Transitions — Phase 3.5
 *
 * Handles transitions between zones with fade, audio crossfade, and camera pan.
 * Provides smooth visual/audio bridging between different game areas.
 */

// ---- Transition Types ----
type TransitionType = 'fade' | 'wipe' | 'zoom' | 'slide';

interface TransitionState {
  type: TransitionType;
  progress: number; // 0-1
  duration: number;
  fromZone: string | null;
  toZone: string;
  isActive: boolean;
  onComplete: (() => void) | null;
}

// ---- Constants ----
const DEFAULT_DURATION = 1.5;
const FADE_SPEED = 1 / DEFAULT_DURATION;
const WIPE_SPEED = 1.5 / DEFAULT_DURATION;
const ZOOM_SPEED = 0.8 / DEFAULT_DURATION;
const SLIDE_SPEED = 1.2 / DEFAULT_DURATION;

// ---- Easing Functions ----
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function easeOutElastic(t: number): number {
  if (t === 0 || t === 1) return t;
  return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI) / 3) + 1;
}

// ---- Renderer ----
export class ZoneTransitionRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private currentTransition: TransitionState | null = null;
  private animFrame: number | null = null;
  private lastTime: number;
  private onComplete: (() => void) | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.lastTime = 0;
  }

  /** Start a zone transition */
  startTransition(
    type: TransitionType,
    toZone: string,
    duration: number = DEFAULT_DURATION,
    onComplete?: () => void,
  ): void {
    this.currentTransition = {
      type,
      progress: 0,
      duration,
      fromZone: null,
      toZone,
      isActive: true,
      onComplete: onComplete || null,
    };

    this.lastTime = performance.now();
    this.startRenderLoop();
  }

  /** Stop transition */
  stop(): void {
    if (this.currentTransition) {
      this.currentTransition.isActive = false;
      this.currentTransition = null;
    }
    if (this.animFrame) {
      cancelAnimationFrame(this.animFrame);
      this.animFrame = null;
    }
  }

  /** Main render loop */
  private startRenderLoop(): void {
    const loop = (time: number) => {
      if (!this.currentTransition?.isActive) return;
      const delta = (time - this.lastTime) / 1000;
      this.lastTime = time;
      this.update(delta);
      this.render();
      this.animFrame = requestAnimationFrame(loop);
    };
    this.animFrame = requestAnimationFrame(loop);
  }

  /** Update transition */
  private update(delta: number): void {
    if (!this.currentTransition) return;

    this.currentTransition.progress += delta / this.currentTransition.duration;

    if (this.currentTransition.progress >= 1) {
      this.currentTransition.isActive = false;
      this.currentTransition.onComplete?.();
      this.currentTransition = null;
      if (this.animFrame) {
        cancelAnimationFrame(this.animFrame);
        this.animFrame = null;
      }
    }
  }

  /** Render transition overlay */
  private render(): void {
    if (!this.currentTransition) return;

    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const progress = this.currentTransition.progress;

    switch (this.currentTransition.type) {
      case 'fade':
        this.renderFade(ctx, w, h, progress);
        break;
      case 'wipe':
        this.renderWipe(ctx, w, h, progress);
        break;
      case 'zoom':
        this.renderZoom(ctx, w, h, progress);
        break;
      case 'slide':
        this.renderSlide(ctx, w, h, progress);
        break;
    }
  }

  /** Render fade transition */
  private renderFade(ctx: CanvasRenderingContext2D, w: number, h: number, progress: number): void {
    const eased = easeInOutCubic(progress);
    const alpha = progress < 0.5
      ? eased * 0.85
      : (1 - eased) * 0.85;

    ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
    ctx.fillRect(0, 0, w, h);

    // Zone name text with fade-in/out
    if (progress > 0.25 && progress < 0.75) {
      const textAlpha = Math.min(1, (progress - 0.25) * 4, (0.75 - progress) * 4);
      const scale = 0.8 + textAlpha * 0.2;
      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.scale(scale, scale);
      ctx.fillStyle = `rgba(255, 255, 255, ${textAlpha})`;
      ctx.font = 'bold 42px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0, 200, 255, 0.5)';
      ctx.shadowBlur = 15;
      ctx.fillText(`Entering: ${this.currentTransition?.toZone || ''}`, 0, 0);
      ctx.restore();
    }
  }

  /** Render wipe transition */
  private renderWipe(ctx: CanvasRenderingContext2D, w: number, h: number, progress: number): void {
    const eased = easeInOutCubic(progress);
    const wipeX = progress < 0.5
      ? eased * w
      : w;

    // Gradient wipe edge
    const gradient = ctx.createLinearGradient(wipeX - 30, 0, wipeX + 30, 0);
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0.9)');
    gradient.addColorStop(0.5, 'rgba(0, 0, 0, 1)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, wipeX + 30, h);

    // Wipe back with gradient
    if (progress > 0.5) {
      const eraseStart = eased * w;
      const eraseGrad = ctx.createLinearGradient(eraseStart - 30, 0, eraseStart + 30, 0);
      eraseGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
      eraseGrad.addColorStop(1, 'rgba(0, 0, 0, 0.9)');
      ctx.fillStyle = eraseGrad;
      ctx.fillRect(0, 0, eraseStart + 30, h);
      // Clear what's behind
      ctx.clearRect(eraseStart + 30, 0, w - eraseStart - 30, h);
    }

    // Zone name with glow
    if (progress > 0.3 && progress < 0.7) {
      const textAlpha = Math.min(1, (progress - 0.3) * 5, (0.7 - progress) * 5);
      ctx.save();
      ctx.shadowColor = 'rgba(0, 200, 255, 0.6)';
      ctx.shadowBlur = 20;
      ctx.fillStyle = `rgba(255, 255, 255, ${textAlpha})`;
      ctx.font = 'bold 42px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`Entering: ${this.currentTransition?.toZone || ''}`, w / 2, h / 2);
      ctx.restore();
    }
  }

  /** Render zoom transition */
  private renderZoom(ctx: CanvasRenderingContext2D, w: number, h: number, progress: number): void {
    const eased = easeInOutCubic(progress);
    const scale = progress < 0.5
      ? 1 + eased * 4
      : 5 - (eased - 0.5) * 10;

    const alpha = progress < 0.5
      ? eased * 0.9
      : (1 - eased) * 0.9;

    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.scale(scale, scale);
    ctx.translate(-w / 2, -h / 2);
    ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();

    // Zone name with elastic pop-in
    if (progress > 0.42 && progress < 0.58) {
      const textProgress = (progress - 0.42) / 0.16;
      const textAlpha = Math.min(1, textProgress * 5, (1 - textProgress) * 5);
      const elastic = easeOutElastic(textProgress);
      const scale = elastic * 0.5;
      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.scale(scale, scale);
      ctx.shadowColor = 'rgba(255, 200, 0, 0.8)';
      ctx.shadowBlur = 25;
      ctx.fillStyle = `rgba(255, 255, 255, ${textAlpha})`;
      ctx.font = 'bold 42px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`Entering: ${this.currentTransition?.toZone || ''}`, 0, 0);
      ctx.restore();
    }
  }

  /** Render slide transition */
  private renderSlide(ctx: CanvasRenderingContext2D, w: number, h: number, progress: number): void {
    const eased = easeInOutCubic(progress);
    const slideX = progress < 0.5
      ? eased * w
      : w;

    // Gradient fade on edges
    const fadeGrad = ctx.createLinearGradient(0, 0, 60, 0);
    fadeGrad.addColorStop(0, 'rgba(0, 0, 0, 0.9)');
    fadeGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

    // Slide out (left) with fade
    ctx.fillStyle = '#000000';
    ctx.fillRect(-slideX, 0, w + 60, h);
    ctx.fillStyle = fadeGrad;
    ctx.fillRect(-60, 0, 60, h);

    // Slide in (right) with fade
    if (progress > 0.5) {
      const slideIn = eased * w;
      const fadeGrad2 = ctx.createLinearGradient(w - slideIn - 60, 0, w - slideIn, 0);
      fadeGrad2.addColorStop(0, 'rgba(0, 0, 0, 0)');
      fadeGrad2.addColorStop(1, 'rgba(0, 0, 0, 0.9)');
      ctx.fillStyle = '#000000';
      ctx.fillRect(w - slideIn, 0, slideIn + 60, h);
      ctx.fillStyle = fadeGrad2;
      ctx.fillRect(w - slideIn - 60, 0, 60, h);
      // Clear what's behind
      ctx.clearRect(w - slideIn + 60, 0, slideIn - 60, h);
    }

    // Zone name with slide-in effect
    if (progress > 0.35 && progress < 0.65) {
      const textProgress = (progress - 0.35) / 0.3;
      const textAlpha = Math.min(1, textProgress * 4, (1 - textProgress) * 4);
      const offsetX = (1 - textProgress) * 50;
      ctx.save();
      ctx.translate(w / 2 - offsetX, h / 2);
      ctx.shadowColor = 'rgba(0, 200, 255, 0.6)';
      ctx.shadowBlur = 20;
      ctx.fillStyle = `rgba(255, 255, 255, ${textAlpha})`;
      ctx.font = 'bold 42px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`Entering: ${this.currentTransition?.toZone || ''}`, 0, 0);
      ctx.restore();
    }
  }

  /** Get current transition */
  getTransition(): TransitionState | null {
    return this.currentTransition;
  }

  /** Check if transitioning */
  isTransitioning(): boolean {
    return this.currentTransition?.isActive ?? false;
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
