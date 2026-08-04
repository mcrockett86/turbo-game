/**
 * Endgame System — Phase 4.4
 *
 * Handles win/lose conditions, celebration, and restart.
 * Manages the game over screen, victory screen, and score summary.
 */

// ---- Endgame States ----
type EndgameState = 'playing' | 'won' | 'lost' | 'transitioning';

interface EndgameData {
  state: EndgameState;
  score: number;
  timePlayed: number;
  itemsCollected: number;
  companionsMet: number;
  threatsResolved: number;
  maxHappiness: number;
  finalDialogue: string;
  animProgress: number;
}

// ---- Constants ----
const CELEBRATION_DURATION = 5000; // ms
const SCORE_FONT = 'bold 32px monospace';
const TEXT_FONT = '18px monospace';

// ---- Renderer ----
export class EndgameRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private data: EndgameData;
  private animFrame: number | null = null;
  private lastTime: number;
  private onRestart: (() => void) | null = null;
  private onMenu: (() => void) | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.lastTime = 0;

    this.data = {
      state: 'playing',
      score: 0,
      timePlayed: 0,
      itemsCollected: 0,
      companionsMet: 0,
      threatsResolved: 0,
      maxHappiness: 50,
      finalDialogue: '',
      animProgress: 0,
    };
  }

  /** Set game state */
  setState(state: EndgameState): void {
    this.data.state = state;
    this.data.animProgress = 0;
    this.lastTime = performance.now();
    this.startRenderLoop();
  }

  /** Set score data */
  setScoreData(score: number, timePlayed: number, itemsCollected: number, companionsMet: number, threatsResolved: number, maxHappiness: number): void {
    this.data.score = score;
    this.data.timePlayed = timePlayed;
    this.data.itemsCollected = itemsCollected;
    this.data.companionsMet = companionsMet;
    this.data.threatsResolved = threatsResolved;
    this.data.maxHappiness = maxHappiness;
  }

  /** Set final dialogue */
  setFinalDialogue(text: string): void {
    this.data.finalDialogue = text;
  }

  /** Main render loop */
  private startRenderLoop(): void {
    const loop = (time: number) => {
      if (this.data.state === 'playing') return;
      const delta = (time - this.lastTime) / 1000;
      this.lastTime = time;
      this.data.animProgress += delta;
      this.render();
      this.animFrame = requestAnimationFrame(loop);
    };
    this.animFrame = requestAnimationFrame(loop);
  }

  /** Render endgame screen */
  private render(): void {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const progress = Math.min(1, this.data.animProgress / 2);

    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillRect(0, 0, w, h);

    if (this.data.state === 'won') {
      this.renderWinScreen(ctx, w, h, progress);
    } else if (this.data.state === 'lost') {
      this.renderLoseScreen(ctx, w, h, progress);
    }
  }

  /** Render win screen */
  private renderWinScreen(ctx: CanvasRenderingContext2D, w: number, h: number, progress: number): void {
    // Celebration particles
    const time = performance.now() / 1000;
    for (let i = 0; i < 50; i++) {
      const x = (Math.sin(i * 7.3 + time) * 0.5 + 0.5) * w;
      const y = ((i * 37 + time * 50) % h);
      const size = 3 + Math.sin(i * 3.1) * 2;
      const colors = ['#ffcc00', '#ff6600', '#ff3366', '#33ccff', '#66ff66'];
      ctx.fillStyle = colors[i % colors.length];
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }

    // Title
    const titleAlpha = Math.min(1, progress * 3);
    ctx.fillStyle = `rgba(255, 215, 0, ${titleAlpha})`;
    ctx.font = 'bold 48px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('HOME AT LAST!', w / 2, h / 4);

    // Final dialogue
    if (progress > 0.3) {
      const dialogAlpha = Math.min(1, (progress - 0.3) * 3);
      ctx.fillStyle = `rgba(255, 255, 255, ${dialogAlpha})`;
      ctx.font = '20px monospace';
      ctx.fillText(this.data.finalDialogue || 'You made it home, Turbo!', w / 2, h / 3);
    }

    // Score
    if (progress > 0.5) {
      const scoreAlpha = Math.min(1, (progress - 0.5) * 3);
      ctx.fillStyle = `rgba(255, 255, 255, ${scoreAlpha})`;
      ctx.font = 'bold 24px monospace';
      ctx.fillText(`Score: ${this.data.score}`, w / 2, h / 2);

      // Stats
      ctx.font = '16px monospace';
      const statsY = h / 2 + 40;
      ctx.fillText(`Time: ${Math.floor(this.data.timePlayed)}s`, w / 2, statsY);
      ctx.fillText(`Items: ${this.data.itemsCollected} | Companions: ${this.data.companionsMet}`, w / 2, statsY + 25);
      ctx.fillText(`Threats Resolved: ${this.data.threatsResolved} | Max Happiness: ${this.data.maxHappiness}%`, w / 2, statsY + 50);
    }

    // Buttons
    if (progress > 0.8) {
      const btnAlpha = Math.min(1, (progress - 0.8) * 5);

      // Restart button
      const btnW = 200;
      const btnH = 50;
      const btnX = (w - btnW) / 2;
      const btnY = h - 120;

      ctx.fillStyle = `rgba(100, 200, 100, ${btnAlpha})`;
      ctx.fillRect(btnX, btnY, btnW, btnH);
      ctx.strokeStyle = `rgba(255, 255, 255, ${btnAlpha})`;
      ctx.lineWidth = 2;
      ctx.strokeRect(btnX, btnY, btnW, btnH);

      ctx.fillStyle = `rgba(255, 255, 255, ${btnAlpha})`;
      ctx.font = 'bold 18px monospace';
      ctx.fillText('PLAY AGAIN', w / 2, btnY + btnH / 2);
    }
  }

  /** Render lose screen */
  private renderLoseScreen(ctx: CanvasRenderingContext2D, w: number, h: number, progress: number): void {
    // Title
    const titleAlpha = Math.min(1, progress * 3);
    ctx.fillStyle = `rgba(255, 100, 100, ${titleAlpha})`;
    ctx.font = 'bold 48px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('LOST...', w / 2, h / 4);

    // Message
    if (progress > 0.3) {
      const msgAlpha = Math.min(1, (progress - 0.3) * 3);
      ctx.fillStyle = `rgba(255, 255, 255, ${msgAlpha})`;
      ctx.font = '20px monospace';
      ctx.fillText('Don\'t give up, Turbo!', w / 2, h / 3);
      ctx.fillText('Try again to find your way home.', w / 2, h / 3 + 30);
    }

    // Restart button
    if (progress > 0.5) {
      const btnAlpha = Math.min(1, (progress - 0.5) * 3);

      const btnW = 200;
      const btnH = 50;
      const btnX = (w - btnW) / 2;
      const btnY = h - 120;

      ctx.fillStyle = `rgba(200, 100, 100, ${btnAlpha})`;
      ctx.fillRect(btnX, btnY, btnW, btnH);
      ctx.strokeStyle = `rgba(255, 255, 255, ${btnAlpha})`;
      ctx.lineWidth = 2;
      ctx.strokeRect(btnX, btnY, btnW, btnH);

      ctx.fillStyle = `rgba(255, 255, 255, ${btnAlpha})`;
      ctx.font = 'bold 18px monospace';
      ctx.fillText('TRY AGAIN', w / 2, btnY + btnH / 2);
    }
  }

  /** Handle click for buttons */
  handleClick(e: MouseEvent): void {
    if (this.data.state === 'playing') return;

    const rect = this.canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const w = this.canvas.width;
    const h = this.canvas.height;
    const btnW = 200;
    const btnH = 50;
    const btnX = (w - btnW) / 2;
    const btnY = h - 120;

    if (mx >= btnX && mx <= btnX + btnW && my >= btnY && my <= btnY + btnH) {
      if (this.data.state === 'won') {
        this.onRestart?.();
      } else if (this.data.state === 'lost') {
        this.onRestart?.();
      }
    }
  }

  // ---- Callbacks ----
  setOnRestart(fn: () => void): void {
    this.onRestart = fn;
  }

  setOnMenu(fn: () => void): void {
    this.onMenu = fn;
  }

  /** Get current state */
  getState(): EndgameState {
    return this.data.state;
  }

  /** Get score data */
  getScoreData(): Omit<EndgameData, 'state' | 'finalDialogue' | 'animProgress'> {
    return {
      score: this.data.score,
      timePlayed: this.data.timePlayed,
      itemsCollected: this.data.itemsCollected,
      companionsMet: this.data.companionsMet,
      threatsResolved: this.data.threatsResolved,
      maxHappiness: this.data.maxHappiness,
    };
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
