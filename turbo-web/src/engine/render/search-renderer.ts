/**
 * Human Search Interlude Renderer — Phase 2.3
 *
 * Top-down 2D map view for the "searching for home" interlude.
 * Renders a compass, scent trail, and proximity indicators.
 */

import { CONFIG } from '@/config';

// ---- Types ----
interface ScentPoint {
  x: number;
  y: number;
  strength: number;
  timestamp: number;
}

interface SearchState {
  playerX: number;
  playerY: number;
  playerAngle: number;
  scentPoints: ScentPoint[];
  homeLocation: { x: number; y: number };
  compassHeading: number;
  isSearching: boolean;
  proximity: number;
  lastTick: number;
}

// ---- Constants ----
const MAP_SIZE = 40;
const SCENT_DECAY = 0.001;
const PROXIMITY_THRESHOLD = 3;
const COMPASS_SPEED = 0.5;
const PLAYER_SPEED = 2;

// ---- Renderer ----
export class SearchRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private state: SearchState;
  private animFrame: number | null = null;
  private onProximityChange: ((proximity: number) => void) | null = null;
  private onHomeFound: (() => void) | null = null;
  private lastTime: number;
  // Bound listeners for proper cleanup
  private boundKeydown: ((e: KeyboardEvent) => void) | null = null;
  private boundMousemove: ((e: MouseEvent) => void) | null = null;
  private disposed = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.lastTime = 0;

    this.state = {
      playerX: 0,
      playerY: 0,
      playerAngle: -Math.PI / 2,
      scentPoints: [],
      homeLocation: { x: 0, y: -15 },
      compassHeading: 0,
      isSearching: true,
      proximity: 0,
      lastTick: 0,
    };

    this.setupInput();
  }

  /** Initialize with home location */
  init(homeX: number, homeY: number): void {
    this.state.homeLocation = { x: homeX, y: homeY };
    this.state.playerX = 0;
    this.state.playerY = 0;
    this.state.scentPoints = [];
    this.state.isSearching = true;
    this.state.proximity = 0;
    this.state.compassHeading = 0;
  }

  /** Add a scent point to the trail */
  addScentPoint(x: number, y: number, strength: number = 1): void {
    this.state.scentPoints.push({
      x,
      y,
      strength,
      timestamp: Date.now(),
    });

    // Decay old scent points
    this.state.scentPoints = this.state.scentPoints.filter(
      (p) => Date.now() - p.timestamp < 30000,
    );
  }

  /** Update player position */
  setPlayerPosition(x: number, y: number): void {
    this.state.playerX = x;
    this.state.playerY = y;
  }

  /** Update compass heading */
  setCompassHeading(heading: number): void {
    this.state.compassHeading = heading;
  }

  /** Update player angle from mouse */
  updatePlayerAngle(angle: number): void {
    this.state.playerAngle = angle;
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

  /** Update game state */
  private update(delta: number): void {
    if (!this.state.isSearching) return;

    // Decay scent strength
    for (const point of this.state.scentPoints) {
      point.strength = Math.max(0, point.strength - SCENT_DECAY * delta);
    }
    this.state.scentPoints = this.state.scentPoints.filter(
      (p) => p.strength > 0.01,
    );

    // Calculate proximity to home
    const dx = this.state.homeLocation.x - this.state.playerX;
    const dy = this.state.homeLocation.y - this.state.playerY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    this.state.proximity = Math.max(0, 1 - dist / PROXIMITY_THRESHOLD);

    // Check if home is found
    if (dist < 0.5) {
      this.state.isSearching = false;
      this.onHomeFound?.();
    }

    // Update compass heading
    if (this.state.compassHeading !== 0) {
      const targetAngle = Math.atan2(
        this.state.homeLocation.x - this.state.playerX,
        this.state.homeLocation.y - this.state.playerY,
      );
      this.state.compassHeading += (targetAngle - this.state.compassHeading) * COMPASS_SPEED * delta;
    }

    // Trigger proximity callback
    this.onProximityChange?.(this.state.proximity);
  }

  /** Render the scene */
  private render(): void {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Clear
    ctx.fillStyle = '#1a2a1a';
    ctx.fillRect(0, 0, w, h);

    // Camera offset (center on player)
    const camX = this.state.playerX;
    const camY = this.state.playerY;
    const scale = Math.min(w, h) / MAP_SIZE;

    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.scale(scale, scale);
    ctx.translate(-camX, -camY);

    // Draw grid
    ctx.strokeStyle = 'rgba(100, 150, 100, 0.15)';
    ctx.lineWidth = 0.05 / scale;
    for (let i = -MAP_SIZE / 2; i <= MAP_SIZE / 2; i += 1) {
      ctx.beginPath();
      ctx.moveTo(i, -MAP_SIZE / 2);
      ctx.lineTo(i, MAP_SIZE / 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-MAP_SIZE / 2, i);
      ctx.lineTo(MAP_SIZE / 2, i);
      ctx.stroke();
    }

    // Draw scent trail
    const points = this.state.scentPoints;
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const alpha = p.strength * 0.6;
      const radius = 0.15 + p.strength * 0.2;

      ctx.beginPath();
      ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 165, 0, ${alpha})`;
      ctx.fill();
    }

    // Draw home marker
    const home = this.state.homeLocation;
    const homeDist = Math.sqrt(
      (home.x - camX) ** 2 + (home.y - camY) ** 2,
    );

    // Home glow
    const glowRadius = 0.5 + this.state.proximity * 0.5;
    const gradient = ctx.createRadialGradient(home.x, home.y, 0, home.x, home.y, glowRadius);
    gradient.addColorStop(0, `rgba(255, 255, 100, ${0.3 + this.state.proximity * 0.3})`);
    gradient.addColorStop(1, 'rgba(255, 255, 100, 0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(home.x, home.y, glowRadius, 0, Math.PI * 2);
    ctx.fill();

    // Home icon
    ctx.fillStyle = '#ffd700';
    ctx.font = `${0.4}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🏠', home.x, home.y);

    // Draw compass indicator
    if (this.state.compassHeading !== 0) {
      const compassX = home.x;
      const compassY = home.y - 1.0;
      const compassAngle = Math.atan2(home.y - camY, home.x - camX);

      // Arrow line
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 0.03;
      ctx.setLineDash([0.1, 0.1]);
      ctx.beginPath();
      ctx.moveTo(camX, camY);
      ctx.lineTo(compassX, compassY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Arrow head
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.beginPath();
      ctx.moveTo(compassX, compassY);
      const arrowLen = 0.2;
      const angle = compassAngle;
      ctx.lineTo(
        compassX - arrowLen * Math.cos(angle - 0.3),
        compassY - arrowLen * Math.sin(angle - 0.3),
      );
      ctx.lineTo(
        compassX - arrowLen * Math.cos(angle + 0.3),
        compassY - arrowLen * Math.sin(angle + 0.3),
      );
      ctx.closePath();
      ctx.fill();
    }

    // Draw player
    const px = camX;
    const py = camY;

    // Player glow
    const playerGlow = ctx.createRadialGradient(px, py, 0, px, py, 0.5);
    playerGlow.addColorStop(0, 'rgba(255, 200, 100, 0.3)');
    playerGlow.addColorStop(1, 'rgba(255, 200, 100, 0)');
    ctx.fillStyle = playerGlow;
    ctx.beginPath();
    ctx.arc(px, py, 0.5, 0, Math.PI * 2);
    ctx.fill();

    // Player body (circle)
    ctx.fillStyle = '#ffcc66';
    ctx.beginPath();
    ctx.arc(px, py, 0.2, 0, Math.PI * 2);
    ctx.fill();

    // Player direction indicator
    ctx.strokeStyle = '#ff9900';
    ctx.lineWidth = 0.04;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(
      px + Math.cos(this.state.playerAngle) * 0.3,
      py + Math.sin(this.state.playerAngle) * 0.3,
    );
    ctx.stroke();

    ctx.restore();

    // Draw minimap compass (top-left corner)
    this.drawMinimapCompass();

    // Draw proximity bar (bottom)
    this.drawProximityBar();

    // Draw "Home Found" overlay
    if (!this.state.isSearching) {
      this.drawHomeFoundOverlay();
    }
  }

  /** Draw minimap compass */
  private drawMinimapCompass(): void {
    const ctx = this.ctx;
    const size = 60;
    const x = 20;
    const y = 20;

    // Background circle
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // N label
    ctx.fillStyle = '#ff4444';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('N', x + size / 2, y + 10);

    // Compass needle
    const needleAngle = this.state.compassHeading;
    const needleLen = size / 3;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(
      x + size / 2 - Math.sin(needleAngle) * needleLen,
      y + size / 2 + Math.cos(needleAngle) * needleLen,
    );
    ctx.lineTo(
      x + size / 2 + Math.sin(needleAngle) * needleLen,
      y + size / 2 - Math.cos(needleAngle) * needleLen,
    );
    ctx.stroke();

    // Center dot
    ctx.fillStyle = '#ffcc66';
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  /** Draw proximity bar */
  private drawProximityBar(): void {
    const ctx = this.ctx;
    const barWidth = 200;
    const barHeight = 8;
    const x = (this.canvas.width - barWidth) / 2;
    const y = this.canvas.height - 40;

    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(x - 2, y - 2, barWidth + 4, barHeight + 4);

    // Fill
    const fillWidth = barWidth * this.state.proximity;
    const r = Math.floor(255 * this.state.proximity);
    const g = Math.floor(255 * (1 - this.state.proximity));
    ctx.fillStyle = `rgb(${r}, ${g}, 50)`;
    ctx.fillRect(x, y, fillWidth, barHeight);

    // Label
    ctx.fillStyle = '#ffffff';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('HOME PROXIMITY', x + barWidth / 2, y - 4);
  }

  /** Draw home found overlay */
  private drawHomeFoundOverlay(): void {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Fade overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, w, h);

    // Text
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 32px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('HOME FOUND!', w / 2, h / 2 - 30);

    ctx.fillStyle = '#ffffff';
    ctx.font = '16px monospace';
    ctx.fillText('You made it home, Turbo!', w / 2, h / 2 + 20);
  }

  // ---- Input ----
  private setupInput(): void {
    this.boundKeydown = (e: KeyboardEvent) => {
      if (!this.state.isSearching) return;
      const speed = PLAYER_SPEED * 0.016;
      switch (e.key.toLowerCase()) {
        case 'w':
        case 'arrowup':
          this.state.playerY += speed;
          break;
        case 's':
        case 'arrowdown':
          this.state.playerY -= speed;
          break;
        case 'a':
        case 'arrowleft':
          this.state.playerX -= speed;
          break;
        case 'd':
        case 'arrowright':
          this.state.playerX += speed;
          break;
      }
    };

    this.boundMousemove = (e: MouseEvent) => {
      const rect = this.canvas.getBoundingClientRect();
      const mx = (e.clientX - rect.left - this.canvas.width / 2) / Math.min(this.canvas.width, this.canvas.height);
      const my = (e.clientY - rect.top - this.canvas.height / 2) / Math.min(this.canvas.width, this.canvas.height);
      const angle = Math.atan2(my, mx);
      this.updatePlayerAngle(angle);
    };

    this.canvas.addEventListener('keydown', this.boundKeydown);
    this.canvas.addEventListener('mousemove', this.boundMousemove);
  }

  // ---- Callbacks ----
  setOnProximityChange(fn: (proximity: number) => void): void {
    this.onProximityChange = fn;
  }

  setOnHomeFound(fn: () => void): void {
    this.onHomeFound = fn;
  }

  /** Dispose */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    this.stop();
    this.canvas.removeEventListener('keydown', this.boundKeydown!);
    this.canvas.removeEventListener('mousemove', this.boundMousemove!);
  }
}
