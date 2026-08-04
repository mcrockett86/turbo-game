/**
 * Dialogue System — Phase 4.2
 *
 * Typewriter text display with personality-based lines.
 * Shows dialogue bubbles with character names and speech.
 */

// ---- Dialogue State ----
interface DialogueState {
  text: string;
  speaker: string;
  isTyping: boolean;
  progress: number;
  duration: number;
  isVisible: boolean;
  lines: string[];
  currentLineIndex: number;
  autoAdvance: boolean;
}

// ---- Constants ----
const TYPEWRITER_SPEED = 0.03; // Characters per frame
const MIN_DISPLAY_TIME = 1500; // ms
const AUTO_ADVANCE_DELAY = 3000; // ms

// ---- Renderer ----
export class DialogueRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private state: DialogueState;
  private animFrame: number | null = null;
  private lastTime: number;
  private onDialogueComplete: (() => void) | null = null;
  private onLineAdvance: (() => void) | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.lastTime = 0;

    this.state = {
      text: '',
      speaker: '',
      isTyping: false,
      progress: 0,
      duration: 0,
      isVisible: false,
      lines: [],
      currentLineIndex: 0,
      autoAdvance: false,
    };
  }

  /** Show dialogue */
  showDialogue(text: string, speaker: string, autoAdvance: boolean = false): void {
    this.state.text = text;
    this.state.speaker = speaker;
    this.state.lines = this.wrapText(text, 50);
    this.state.currentLineIndex = 0;
    this.state.isVisible = true;
    this.state.isTyping = true;
    this.state.progress = 0;
    this.state.duration = 0;
    this.state.autoAdvance = autoAdvance;

    this.lastTime = performance.now();
    this.startRenderLoop();
  }

  /** Hide dialogue */
  hideDialogue(): void {
    this.state.isVisible = false;
    this.state.isTyping = false;
    if (this.animFrame) {
      cancelAnimationFrame(this.animFrame);
      this.animFrame = null;
    }
  }

  /** Advance to next line */
  advanceLine(): void {
    if (this.state.currentLineIndex < this.state.lines.length - 1) {
      this.state.currentLineIndex++;
      this.state.progress = 0;
      this.state.isTyping = true;
      this.onLineAdvance?.();
    } else {
      this.state.isTyping = false;
      this.onDialogueComplete?.();
    }
  }

  /** Skip to end */
  skip(): void {
    this.state.progress = 1;
    this.state.isTyping = false;
    this.onDialogueComplete?.();
  }

  /** Main render loop */
  private startRenderLoop(): void {
    const loop = (time: number) => {
      if (!this.state.isVisible) return;
      const delta = (time - this.lastTime) / 1000;
      this.lastTime = time;
      this.update(delta);
      this.render();
      this.animFrame = requestAnimationFrame(loop);
    };
    this.animFrame = requestAnimationFrame(loop);
  }

  /** Update dialogue */
  private update(delta: number): void {
    if (!this.state.isVisible) return;

    if (this.state.isTyping) {
      this.state.progress += TYPEWRITER_SPEED * delta * 60;
      if (this.state.progress >= 1) {
        this.state.isTyping = false;
        this.state.duration = 0;
      }
    } else {
      this.state.duration += delta * 1000;
      if (this.state.autoAdvance && this.state.duration > AUTO_ADVANCE_DELAY) {
        this.advanceLine();
      }
    }
  }

  /** Render dialogue */
  private render(): void {
    if (!this.state.isVisible) return;

    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Dialogue box
    const boxW = Math.min(600, w * 0.8);
    const boxH = 120;
    const boxX = (w - boxW) / 2;
    const boxY = h - boxH - 30;

    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(boxX, boxY, boxW, boxH);

    // Border
    ctx.strokeStyle = '#555577';
    ctx.lineWidth = 2;
    ctx.strokeRect(boxX, boxY, boxW, boxH);

    // Speaker name
    ctx.fillStyle = '#ffcc00';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`${this.state.speaker}:`, boxX + 15, boxY + 10);

    // Dialogue text (typewriter)
    const currentLine = this.state.lines[this.state.currentLineIndex] || '';
    const visibleChars = Math.floor(currentLine.length * this.state.progress);
    const visibleText = currentLine.substring(0, visibleChars);

    ctx.fillStyle = '#ffffff';
    ctx.font = '14px monospace';
    ctx.fillText(visibleText, boxX + 15, boxY + 35, boxW - 30);

    // Cursor
    if (this.state.isTyping) {
      const cursorX = boxX + 15 + ctx.measureText(visibleText).width;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(cursorX, boxY + 35, 2, 16);
    }

    // Continue prompt
    if (!this.state.isTyping) {
      const pulse = Math.sin(performance.now() / 300) * 0.3 + 0.7;
      ctx.fillStyle = `rgba(255, 255, 255, ${pulse})`;
      ctx.font = '12px monospace';
      ctx.textAlign = 'right';
      ctx.fillText('Press SPACE to continue', boxX + boxW - 15, boxY + boxH - 15);
    }
  }

  /** Wrap text into lines */
  private wrapText(text: string, maxChars: number): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let line = '';

    for (const word of words) {
      const testLine = line + word + ' ';
      if (testLine.length > maxChars && line !== '') {
        lines.push(line.trim());
        line = word + ' ';
      } else {
        line = testLine;
      }
    }
    if (line.trim()) lines.push(line.trim());
    return lines;
  }

  // ---- Callbacks ----
  setOnDialogueComplete(fn: () => void): void {
    this.onDialogueComplete = fn;
  }

  setOnLineAdvance(fn: () => void): void {
    this.onLineAdvance = fn;
  }

  /** Resize */
  resize(w: number, h: number): void {
    this.canvas.width = w;
    this.canvas.height = h;
  }

  /** Dispose */
  dispose(): void {
    this.hideDialogue();
  }
}
