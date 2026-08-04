/**
 * Manga Cutaway Combat — Phase 3.1
 *
 * Renders a manga-panel-style combat overlay during threat encounters.
 * Features panel layout, QTE mini-game visualization, and dramatic effects.
 */

import { CONFIG } from '@/config';

// ---- Types ----
interface MangaPanel {
  x: number;
  y: number;
  w: number;
  h: number;
  type: 'action' | 'dialogue' | 'sfx' | 'speed';
  content: string;
  bgColor: string;
  borderColor: string;
  textColor: string;
  fontSize: number;
  animation?: 'shake' | 'zoom' | 'flash' | 'none';
  animProgress?: number;
}

interface QTEIndicator {
  x: number;
  y: number;
  radius: number;
  targetRadius: number;
  progress: number;
  isActive: boolean;
}

// ---- Constants ----
const PANEL_MARGIN = 8;
const PANEL_BORDER = 3;
const QTE_TARGET_SIZE = 40;
const QTE_HIT_ZONE = 8;

// ---- Panel Layouts ----
const LAYOUTS = {
  standard: [
    { x: 0, y: 0, w: 0.5, h: 0.6, type: 'action' as const },
    { x: 0.5, y: 0, w: 0.5, h: 0.35, type: 'dialogue' as const },
    { x: 0.5, y: 0.65, w: 0.5, h: 0.35, type: 'sfx' as const },
  ],
  dramatic: [
    { x: 0, y: 0, w: 1, h: 0.5, type: 'action' as const },
    { x: 0, y: 0.5, w: 0.45, h: 0.5, type: 'dialogue' as const },
    { x: 0.55, y: 0.5, w: 0.45, h: 0.5, type: 'sfx' as const },
  ],
  closeup: [
    { x: 0.1, y: 0.05, w: 0.8, h: 0.5, type: 'action' as const },
    { x: 0, y: 0.6, w: 1, h: 0.4, type: 'dialogue' as const },
  ],
};

// ---- Renderer ----
export class MangaCombatRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private panels: MangaPanel[];
  private qteIndicators: QTEIndicator[];
  private animFrame: number | null = null;
  private lastTime: number;
  private isActive: boolean;
  private onQTEHit: ((hit: boolean) => void) | null = null;
  private onQTEComplete: (() => void) | null = null;
  private comboCount: number;
  private flashAlpha: number;
  private shakeOffset: { x: number; y: number };

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.panels = [];
    this.qteIndicators = [];
    this.lastTime = 0;
    this.isActive = false;
    this.comboCount = 0;
    this.flashAlpha = 0;
    this.shakeOffset = { x: 0, y: 0 };
  }

  /** Start a combat cutaway */
  startCombat(threatType: string, dialogue: string, sfx: string): void {
    this.isActive = true;
    this.comboCount = 0;
    this.flashAlpha = 0;
    this.shakeOffset = { x: 0, y: 0 };

    // Determine layout based on threat type
    let layoutKey: keyof typeof LAYOUTS = 'standard';
    if (threatType === 'cat' || threatType === 'bully') {
      layoutKey = 'dramatic';
    } else if (threatType === 'storm') {
      layoutKey = 'closeup';
    }

    const layout = LAYOUTS[layoutKey];

    // Create panels
    this.panels = layout.map((p) => {
      const panel: MangaPanel = {
        x: p.x * this.canvas.width,
        y: p.y * this.canvas.height,
        w: p.w * this.canvas.width,
        h: p.h * this.canvas.height,
        type: p.type,
        content: '',
        bgColor: '#ffffff',
        borderColor: '#000000',
        textColor: '#000000',
        fontSize: 24,
        animation: 'none',
        animProgress: 0,
      };

      // Set content based on panel type
      switch (p.type) {
        case 'action':
          panel.content = threatType === 'cat' ? '⚔️ FIGHT!' : threatType === 'bully' ? '💪 INTIMIDATE!' : '⛈️ TAKE COVER!';
          panel.bgColor = '#f0f0f0';
          panel.fontSize = 32;
          break;
        case 'dialogue':
          panel.content = dialogue;
          panel.bgColor = '#fffff0';
          panel.fontSize = 18;
          break;
        case 'sfx':
          panel.content = sfx;
          panel.bgColor = '#000000';
          panel.textColor = '#ffffff';
          panel.fontSize = 48;
          break;
      }

      return panel;
    });

    // QTE indicators
    this.qteIndicators = [
      {
        x: this.canvas.width / 2,
        y: this.canvas.height * 0.85,
        radius: 30,
        targetRadius: QTE_TARGET_SIZE,
        progress: 0,
        isActive: true,
      },
    ];

    this.lastTime = performance.now();
    this.startRenderLoop();
  }

  /** Stop combat cutaway */
  stop(): void {
    this.isActive = false;
    if (this.animFrame) {
      cancelAnimationFrame(this.animFrame);
      this.animFrame = null;
    }
  }

  /** Handle QTE input */
  handleQTEInput(): boolean {
    if (!this.isActive) return false;

    for (const qte of this.qteIndicators) {
      if (qte.isActive) {
        const diff = Math.abs(qte.radius - (this.qteIndicators[0] as any).targetRadius);
        const hit = diff < QTE_HIT_ZONE;
        if (hit) {
          qte.radius = 0;
          qte.isActive = false;
          this.comboCount++;
          this.flashAlpha = 1;
          this.onQTEHit?.(true);

          // Check if all QTEs are done
          if (this.qteIndicators.every((q) => !q.isActive)) {
            this.onQTEComplete?.();
          }
        } else {
          this.onQTEHit?.(false);
        }
        return hit;
      }
    }
    return false;
  }

  /** Main render loop */
  private startRenderLoop(): void {
    const loop = (time: number) => {
      if (!this.isActive) return;
      const delta = (time - this.lastTime) / 1000;
      this.lastTime = time;
      this.update(delta);
      this.render();
      this.animFrame = requestAnimationFrame(loop);
    };
    this.animFrame = requestAnimationFrame(loop);
  }

  /** Update state */
  private update(delta: number): void {
    // Flash fade
    this.flashAlpha = Math.max(0, this.flashAlpha - delta * 3);

    // Shake decay
    this.shakeOffset.x *= 0.9;
    this.shakeOffset.y *= 0.9;

    // Animate panels
    for (const panel of this.panels) {
      if (panel.animation !== 'none') {
        panel.animProgress = (panel.animProgress || 0) + delta * 2;
      }
    }

    // Animate QTE indicators
    for (const qte of this.qteIndicators) {
      if (qte.isActive) {
        qte.radius += delta * 60;
        if (qte.radius > (this.qteIndicators[0] as any).targetRadius + 30) {
          qte.radius = 0;
        }
      }
    }
  }

  /** Render the manga overlay */
  private render(): void {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Clear
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, w, h);

    // Flash effect
    if (this.flashAlpha > 0) {
      ctx.fillStyle = `rgba(255, 255, 255, ${this.flashAlpha})`;
      ctx.fillRect(0, 0, w, h);
    }

    // Apply shake
    ctx.save();
    ctx.translate(this.shakeOffset.x, this.shakeOffset.y);

    // Draw panels
    for (const panel of this.panels) {
      this.drawPanel(panel);
    }

    // Draw QTE
    this.drawQTE();

    // Draw combo counter
    if (this.comboCount > 0) {
      ctx.fillStyle = '#ffcc00';
      ctx.font = 'bold 28px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(`${this.comboCount}x COMBO!`, w / 2, 10);
    }

    ctx.restore();
  }

  /** Draw a single manga panel */
  private drawPanel(panel: MangaPanel): void {
    const ctx = this.ctx;

    // Panel background
    ctx.fillStyle = panel.bgColor;
    ctx.fillRect(panel.x, panel.y, panel.w, panel.h);

    // Panel border
    ctx.strokeStyle = panel.borderColor;
    ctx.lineWidth = PANEL_BORDER;
    ctx.strokeRect(panel.x, panel.y, panel.w, panel.h);

    // Animation effects
    if (panel.animation === 'shake') {
      const shakeAmt = Math.sin((panel.animProgress || 0) * 20) * 3;
      ctx.translate(shakeAmt, 0);
    }

    // Content
    ctx.fillStyle = panel.textColor;
    ctx.font = `bold ${panel.fontSize}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Word wrap for dialogue
    if (panel.type === 'dialogue') {
      this.drawTextWrapped(ctx, panel.content, panel.x + panel.w / 2, panel.y + panel.h / 2, panel.w - 20, panel.fontSize * 1.4);
    } else {
      ctx.fillText(panel.content, panel.x + panel.w / 2, panel.y + panel.h / 2);
    }

    // Speed lines for action panels
    if (panel.type === 'action') {
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
      ctx.lineWidth = 1;
      const cx = panel.x + panel.w / 2;
      const cy = panel.y + panel.h / 2;
      for (let i = 0; i < 20; i++) {
        const angle = (i / 20) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(angle) * panel.w, cy + Math.sin(angle) * panel.h);
        ctx.stroke();
      }
    }
  }

  /** Draw QTE indicator */
  private drawQTE(): void {
    const ctx = this.ctx;

    for (const qte of this.qteIndicators) {
      // Target ring
      ctx.strokeStyle = '#ffcc00';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc((this.qteIndicators[0] as any).x, (this.qteIndicators[0] as any).y, (this.qteIndicators[0] as any).targetRadius, 0, Math.PI * 2);
      ctx.stroke();

      // Moving ring
      if (qte.isActive) {
        ctx.strokeStyle = '#ff6600';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc((this.qteIndicators[0] as any).x, (this.qteIndicators[0] as any).y, qte.radius, 0, Math.PI * 2);
        ctx.stroke();

        // Hit zone highlight
        ctx.strokeStyle = 'rgba(255, 204, 0, 0.3)';
        ctx.lineWidth = QTE_HIT_ZONE * 2;
        ctx.beginPath();
        ctx.arc((this.qteIndicators[0] as any).x, (this.qteIndicators[0] as any).y, (this.qteIndicators[0] as any).targetRadius, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // Prompt text
    ctx.fillStyle = '#ffffff';
    ctx.font = '14px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('Press SPACE', (this.qteIndicators[0] as any).x, (this.qteIndicators[0] as any).y - (this.qteIndicators[0] as any).targetRadius - 10);
  }

  /** Word wrap text drawing */
  private drawTextWrapped(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    lineHeight: number,
  ): void {
    const words = text.split(' ');
    let line = '';
    let lines = 0;

    for (const word of words) {
      const testLine = line + word + ' ';
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && line !== '') {
        ctx.fillText(line.trim(), x, y + lines * lineHeight);
        line = word + ' ';
        lines++;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line.trim(), x, y + lines * lineHeight);
  }

  // ---- Callbacks ----
  setOnQTEHit(fn: (hit: boolean) => void): void {
    this.onQTEHit = fn;
  }

  setOnQTEComplete(fn: () => void): void {
    this.onQTEComplete = fn;
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
