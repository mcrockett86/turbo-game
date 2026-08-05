/**
 * HUD — Phase 4.1
 *
 * Heads-up display: happiness bar, zone indicator, panel toggles.
 * Renders game state information in a clean, non-intrusive overlay.
 */

// ---- HUD State ----
interface HUDState {
  dogName: string;
  happiness: number;
  currentZone: string;
  currentRoom: string;
  itemCount: number;
  companionName: string | null;
  isTransitioning: boolean;
  threatActive: boolean;
  muted: boolean;
}

// ---- Constants ----
const HAPPINESS_BAR_HEIGHT = 12;
const HAPPINESS_BAR_WIDTH = 200;
const FONT_SIZE = 14;
const PANEL_SIZE = 200;

// ---- Renderer ----
export class HUDRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private state: HUDState;
  private animFrame: number | null = null;
  private lastTime: number;
  private onPanelToggle: ((panel: string) => void) | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.lastTime = 0;

    this.state = {
      dogName: 'Turbo',
      happiness: 50,
      currentZone: '',
      currentRoom: '',
      itemCount: 0,
      companionName: null,
      isTransitioning: false,
      threatActive: false,
      muted: false,
    };
  }

  /** Update HUD state */
  updateState(newState: Partial<HUDState>): void {
    Object.assign(this.state, newState);
  }

  /** Set happiness */
  setHappiness(value: number): void {
    this.state.happiness = Math.max(0, Math.min(100, value));
  }

  /** Set dog name */
  setDogName(name: string): void {
    this.state.dogName = name;
  }

  /** Set current zone */
  setZone(zone: string): void {
    this.state.currentZone = zone;
  }

  /** Set item count */
  setItemCount(count: number): void {
    this.state.itemCount = count;
  }

  /** Set companion name */
  setCompanion(name: string | null): void {
    this.state.companionName = name;
  }

  /** Set threat active */
  setThreatActive(active: boolean): void {
    this.state.threatActive = active;
  }

  /** Set mute state */
  setMuted(muted: boolean): void {
    this.state.muted = muted;
  }

  /** Main render loop */
  start(): void {
    this.lastTime = performance.now();
    const loop = (time: number) => {
      const delta = (time - this.lastTime) / 1000;
      this.lastTime = time;
      this.render(delta);
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

  /** Render HUD */
  private render(delta: number): void {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Clear
    ctx.clearRect(0, 0, w, h);

    // Top-left: Dog name + happiness bar
    this.renderDogInfo(ctx, w, h);

    // Top-center: Zone indicator
    this.renderZoneIndicator(ctx, w, h);

    // Top-right: Item count + companion
    this.renderStatus(ctx, w, h);

    // Bottom: Panel toggle hints
    this.renderPanelHints(ctx, w, h);

    // Bottom-right: Threat indicator
    if (this.state.threatActive) {
      this.renderThreatIndicator(ctx, w, h);
    }

    // Top-right: Mute button
    this.renderMuteButton(ctx, w, h);
  }

  /** Render dog info (name + happiness) */
  private renderDogInfo(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const x = 20;
    const y = 20;

    // Dog name
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${FONT_SIZE + 4}px monospace`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(this.state.dogName, x, y);

    // Happiness bar background
    const barX = x;
    const barY = y + 25;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(barX, barY, HAPPINESS_BAR_WIDTH, HAPPINESS_BAR_HEIGHT);

    // Happiness bar fill
    const fillWidth = (this.state.happiness / 100) * HAPPINESS_BAR_WIDTH;
    const r = Math.floor(255 * (1 - this.state.happiness / 100));
    const g = Math.floor(255 * (this.state.happiness / 100));
    ctx.fillStyle = `rgb(${r}, ${g}, 50)`;
    ctx.fillRect(barX, barY, fillWidth, HAPPINESS_BAR_HEIGHT);

    // Happiness bar border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, HAPPINESS_BAR_WIDTH, HAPPINESS_BAR_HEIGHT);

    // Happiness text
    ctx.fillStyle = '#ffffff';
    ctx.font = `${FONT_SIZE - 2}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${this.state.happiness}%`, barX + HAPPINESS_BAR_WIDTH / 2, barY + HAPPINESS_BAR_HEIGHT / 2);
  }

  /** Render zone indicator */
  private renderZoneIndicator(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const x = w / 2;
    const y = 20;

    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fillRect(x - 100, y - 5, 200, 30);

    // Zone name
    ctx.fillStyle = '#ffcc00';
    ctx.font = `bold ${FONT_SIZE}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(this.state.currentZone.toUpperCase(), x, y);
  }

  /** Render status (item count, companion) */
  private renderStatus(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const x = w - 20;
    let y = 20;

    // Item count
    ctx.fillStyle = '#ffffff';
    ctx.font = `${FONT_SIZE}px monospace`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText(`🎒 ${this.state.itemCount}`, x, y);
    y += 25;

    // Companion
    if (this.state.companionName) {
      ctx.fillStyle = '#88ff88';
      ctx.font = `${FONT_SIZE - 2}px monospace`;
      ctx.fillText(`🐕 ${this.state.companionName}`, x, y);
    }
  }

  /** Render panel toggle hints */
  private renderPanelHints(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const x = 20;
    const y = h - 30;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fillRect(x, y, 250, 25);

    ctx.fillStyle = '#aaaaaa';
    ctx.font = `${FONT_SIZE - 2}px monospace`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('[I]nventory  [C]ompanion  [H]ints', x + 10, y + 12);
  }

  /** Render threat indicator */
  private renderThreatIndicator(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const x = w / 2;
    const y = h - 60;

    // Pulsing border
    const pulse = Math.sin(performance.now() / 200) * 0.3 + 0.7;
    ctx.strokeStyle = `rgba(255, 50, 50, ${pulse})`;
    ctx.lineWidth = 3;
    ctx.strokeRect(10, 10, w - 20, h - 20);

    // Threat text
    ctx.fillStyle = '#ff4444';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('⚠️ THREAT DETECTED — Press SPACE to resolve', x, y);
  }

  /** Render mute button */
  private renderMuteButton(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const x = w - 60;
    const y = h - 35;
    const size = 24;

    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.beginPath();
    ctx.roundRect(x - size / 2, y - size / 2, size, size, 4);
    ctx.fill();

    // Icon
    ctx.fillStyle = '#ffffff';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.state.muted ? '🔇' : '🔊', x, y);
  }

  // ---- Callbacks ----
  setOnPanelToggle(fn: (panel: string) => void): void {
    this.onPanelToggle = fn;
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

  /** Check if click is on mute button */
  handleClick(x: number, y: number): boolean {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const muteX = w - 60;
    const muteY = h - 35;
    const size = 24;

    if (x >= muteX - size / 2 && x <= muteX + size / 2 &&
        y >= muteY - size / 2 && y <= muteY + size / 2) {
      return true;
    }
    return false;
  }
}
