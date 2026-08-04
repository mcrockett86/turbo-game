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
const DEFAULT_DURATION = 2.0;
const FADE_SPEED = 1 / DEFAULT_DURATION;
const WIPE_SPEED = 1.5 / DEFAULT_DURATION;
const ZOOM_SPEED = 0.8 / DEFAULT_DURATION;
const SLIDE_SPEED = 1.2 / DEFAULT_DURATION;

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
    const alpha = progress < 0.5
      ? progress * 2
      : (1 - progress) * 2;

    ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
    ctx.fillRect(0, 0, w, h);

    // Zone name text
    if (progress > 0.2 && progress < 0.8) {
      const textAlpha = Math.min(1, (progress - 0.2) * 5, (0.8 - progress) * 5);
      ctx.fillStyle = `rgba(255, 255, 255, ${textAlpha})`;
      ctx.font = 'bold 36px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`Entering: ${this.currentTransition?.toZone || ''}`, w / 2, h / 2);
    }
  }

  /** Render wipe transition */
  private renderWipe(ctx: CanvasRenderingContext2D, w: number, h: number, progress: number): void {
    const wipeX = progress < 0.5
      ? (progress * 2) * w
      : w;

    // Wipe from left
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, wipeX, h);

    // Wipe back
    if (progress > 0.5) {
      const eraseStart = (progress - 0.5) * 2 * w;
      ctx.clearRect(0, 0, eraseStart, h);
    }

    // Zone name
    if (progress > 0.3 && progress < 0.7) {
      const textAlpha = Math.min(1, (progress - 0.3) * 5, (0.7 - progress) * 5);
      ctx.fillStyle = `rgba(255, 255, 255, ${textAlpha})`;
      ctx.font = 'bold 36px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`Entering: ${this.currentTransition?.toZone || ''}`, w / 2, h / 2);
    }
  }

  /** Render zoom transition */
  private renderZoom(ctx: CanvasRenderingContext2D, w: number, h: number, progress: number): void {
    const scale = progress < 0.5
      ? 1 + progress * 4
      : 5 - (progress - 0.5) * 10;

    const alpha = progress < 0.5
      ? progress * 2
      : (1 - progress) * 2;

    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.scale(scale, scale);
    ctx.translate(-w / 2, -h / 2);
    ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();

    // Zone name
    if (progress > 0.4 && progress < 0.6) {
      const textAlpha = Math.min(1, (progress - 0.4) * 10, (0.6 - progress) * 10);
      ctx.fillStyle = `rgba(255, 255, 255, ${textAlpha})`;
      ctx.font = 'bold 36px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`Entering: ${this.currentTransition?.toZone || ''}`, w / 2, h / 2);
    }
  }

  /** Render slide transition */
  private renderSlide(ctx: CanvasRenderingContext2D, w: number, h: number, progress: number): void {
    const slideX = progress < 0.5
      ? progress * 2 * w
      : w;

    // Slide out (left)
    ctx.fillStyle = '#000000';
    ctx.fillRect(-slideX, 0, w, h);

    // Slide in (right)
    if (progress > 0.5) {
      const slideIn = (progress - 0.5) * 2 * w;
      ctx.fillStyle = '#000000';
      ctx.fillRect(w - slideIn, 0, slideIn, h);
    }

    // Zone name
    if (progress > 0.3 && progress < 0.7) {
      const textAlpha = Math.min(1, (progress - 0.3) * 5, (0.7 - progress) * 5);
      ctx.fillStyle = `rgba(255, 255, 255, ${textAlpha})`;
      ctx.font = 'bold 36px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`Entering: ${this.currentTransition?.toZone || ''}`, w / 2, h / 2);
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
