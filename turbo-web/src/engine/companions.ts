/**
 * Companion System — Phase 3.3
 *
 * Manages dog companions: meeting, managing, and active bonuses.
 * Companions follow the player, provide dialogue, and grant bonuses.
 */

import type { Companion } from '@/types';

// ---- Constants ----
const FOLLOW_DISTANCE = 1.5;
const FOLLOW_SPEED = 3;
const BONUS_TYPES = {
  happiness: { name: 'Happiness Boost', icon: '😊', value: 0.1 },
  speed: { name: 'Speed Boost', icon: '⚡', value: 0.2 },
  detection: { name: 'Scent Detection', icon: '👃', value: 0.15 },
  courage: { name: 'Courage', icon: '🦁', value: 0.1 },
};

// ---- Companion Manager ----
export class CompanionManager {
  private companions: Map<string, Companion> = new Map();
  private activeCompanion: string | null = null;
  private followOffset: { x: number; z: number };
  private lastUpdate: number;
  private onCompanionChange: ((companion: Companion | null) => void) | null = null;
  private onCompanionDialogue: ((dialogue: string) => void) | null = null;

  constructor() {
    this.followOffset = { x: FOLLOW_DISTANCE, z: 0 };
    this.lastUpdate = 0;
  }

  /** Meet a new companion */
  meetCompanion(companion: Companion): boolean {
    if (this.companions.has(companion.id)) {
      return false; // Already met
    }
    this.companions.set(companion.id, {
      ...companion,
      met: true,
      active: false,
      bonusActive: false,
    });

    // Auto-activate if no companion is active
    if (!this.activeCompanion) {
      this.activeCompanion = companion.id;
      this.onCompanionChange?.(this.companions.get(companion.id)!);
    }

    return true;
  }

  /** Activate a companion */
  activateCompanion(id: string): boolean {
    const companion = this.companions.get(id);
    if (!companion || !companion.met) return false;

    // Deactivate previous
    if (this.activeCompanion) {
      const prev = this.companions.get(this.activeCompanion);
      if (prev) {
        prev.active = false;
        prev.bonusActive = false;
      }
    }

    this.activeCompanion = id;
    companion.active = true;
    companion.bonusActive = true;

    this.onCompanionChange?.(companion);
    this.onCompanionDialogue?.(companion.dialogue[0]);
    return true;
  }

  /** Deactivate all companions */
  deactivateAll(): void {
    if (this.activeCompanion) {
      const companion = this.companions.get(this.activeCompanion);
      if (companion) {
        companion.active = false;
        companion.bonusActive = false;
      }
    }
    this.activeCompanion = null;
    this.onCompanionChange?.(null);
  }

  /** Get active companion */
  getActiveCompanion(): Companion | null {
    if (!this.activeCompanion) return null;
    return this.companions.get(this.activeCompanion) || null;
  }

  /** Get all met companions */
  getAllMet(): Companion[] {
    return Array.from(this.companions.values()).filter((c) => c.met);
  }

  /** Update companion position */
  updatePosition(playerX: number, playerZ: number, playerAngle: number): void {
    const companion = this.getActiveCompanion();
    if (!companion) return;

    // Calculate follow position behind player
    const angle = playerAngle + Math.PI; // Behind
    const targetX = playerX + Math.cos(angle) * FOLLOW_DISTANCE;
    const targetZ = playerZ + Math.sin(angle) * FOLLOW_DISTANCE;

    // Smooth follow
    const dx = targetX - (companion.position?.x ?? playerX);
    const dz = targetZ - (companion.position?.z ?? playerZ);
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist > 0.1) {
      const speed = Math.min(FOLLOW_SPEED, dist);
      companion.position = {
        x: (companion.position?.x ?? playerX) + (dx / dist) * speed,
        z: (companion.position?.z ?? playerZ) + (dz / dist) * speed,
      };
    }
  }

  /** Get companion bonus */
  getBonus(): Partial<Record<'happiness' | 'speed' | 'detection' | 'courage', number>> {
    const companion = this.getActiveCompanion();
    if (!companion || !companion.bonusActive) return {};

    const bonus = BONUS_TYPES[companion.bonusType as keyof typeof BONUS_TYPES];
    if (!bonus) return {};

    return { [bonus.name.toLowerCase().replace(' ', '') as keyof typeof BONUS_TYPES]: bonus.value };
  }

  /** Check if companion is nearby */
  isNearby(playerX: number, playerZ: number): boolean {
    const companion = this.getActiveCompanion();
    if (!companion?.position) return false;
    const dx = playerX - companion.position.x;
    const dz = playerZ - companion.position.z;
    return Math.sqrt(dx * dx + dz * dz) < 2;
  }

  // ---- Callbacks ----
  setOnCompanionChange(fn: (companion: Companion | null) => void): void {
    this.onCompanionChange = fn;
  }

  setOnCompanionDialogue(fn: (dialogue: string) => void): void {
    this.onCompanionDialogue = fn;
  }
}

// ---- Companion Renderer ----
export class CompanionRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private companions: Companion[] = [];
  private activeCompanion: Companion | null = null;
  private isVisible: boolean;
  private animFrame: number | null = null;
  private lastTime: number;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.isVisible = false;
    this.lastTime = 0;
  }

  /** Set companion data from manager */
  setCompanions(companions: Companion[], active: Companion | null): void {
    this.companions = companions;
    this.activeCompanion = active;
  }

  /** Toggle visibility */
  toggle(): void {
    this.isVisible = !this.isVisible;
    if (this.isVisible) {
      this.lastTime = performance.now();
      this.startRenderLoop();
    } else {
      if (this.animFrame) {
        cancelAnimationFrame(this.animFrame);
        this.animFrame = null;
      }
    }
  }

  /** Show */
  show(): void {
    this.isVisible = true;
    this.lastTime = performance.now();
    this.startRenderLoop();
  }

  /** Hide */
  hide(): void {
    this.isVisible = false;
    if (this.animFrame) {
      cancelAnimationFrame(this.animFrame);
      this.animFrame = null;
    }
  }

  /** Main render loop */
  private startRenderLoop(): void {
    const loop = (time: number) => {
      if (!this.isVisible) return;
      const delta = (time - this.lastTime) / 1000;
      this.lastTime = time;
      this.render(delta);
      this.animFrame = requestAnimationFrame(loop);
    };
    this.animFrame = requestAnimationFrame(loop);
  }

  /** Render companion panel */
  private render(_delta: number): void {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Background overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, w, h);

    // Panel
    const panelW = Math.min(350, w * 0.7);
    const panelH = Math.min(450, h * 0.7);
    const panelX = (w - panelW) / 2;
    const panelY = (h - panelH) / 2;

    ctx.fillStyle = '#1a1a2a';
    ctx.fillRect(panelX, panelY, panelW, panelH);
    ctx.strokeStyle = '#444466';
    ctx.lineWidth = 2;
    ctx.strokeRect(panelX, panelY, panelW, panelH);

    // Title
    ctx.fillStyle = '#ffcc00';
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('🐕 COMPANIONS', w / 2, panelY + 15);

    // Active companion highlight
    if (this.activeCompanion) {
      const activeY = panelY + 50;
      ctx.fillStyle = '#0a2a0a';
      ctx.fillRect(panelX + 15, activeY, panelW - 30, 80);
      ctx.strokeStyle = '#44aa44';
      ctx.lineWidth = 2;
      ctx.strokeRect(panelX + 15, activeY, panelW - 30, 80);

      ctx.fillStyle = '#88ff88';
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'left';
      ctx.fillText('★ ACTIVE', panelX + 20, activeY + 8);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 18px monospace';
      ctx.fillText(this.activeCompanion.name, panelX + 20, activeY + 30);

      ctx.fillStyle = '#aaaaaa';
      ctx.font = '13px monospace';
      ctx.fillText(`${this.activeCompanion.breed} — ${this.activeCompanion.trait}`, panelX + 20, activeY + 55);
    }

    // Companion list
    let y = this.activeCompanion ? panelY + 145 : panelY + 55;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('PACK', panelX + 15, y);
    y += 25;

    // Divider
    ctx.strokeStyle = '#333344';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(panelX + 15, y);
    ctx.lineTo(panelX + panelW - 15, y);
    ctx.stroke();
    y += 10;

    for (const comp of this.companions) {
      const isActive = this.activeCompanion?.id === comp.id;
      ctx.fillStyle = isActive ? '#0a2a0a' : '#0a0a1a';
      ctx.fillRect(panelX + 15, y, panelW - 30, 50);

      if (isActive) {
        ctx.strokeStyle = '#44aa44';
        ctx.lineWidth = 1;
        ctx.strokeRect(panelX + 15, y, panelW - 30, 50);
      }

      ctx.fillStyle = isActive ? '#88ff88' : '#ffffff';
      ctx.font = 'bold 13px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`${comp.met ? '✓' : '○'} ${comp.name}`, panelX + 20, y + 8);

      ctx.fillStyle = '#aaaaaa';
      ctx.font = '11px monospace';
      ctx.fillText(`${comp.breed} — ${comp.trait}`, panelX + 20, y + 28);

      y += 60;
    }

    // Close hint
    ctx.fillStyle = '#888888';
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('Press C to close', w / 2, panelY + panelH - 10);
  }

  /** Resize */
  resize(w: number, h: number): void {
    this.canvas.width = w;
    this.canvas.height = h;
  }

  /** Dispose */
  dispose(): void {
    if (this.animFrame) {
      cancelAnimationFrame(this.animFrame);
    }
  }
}
