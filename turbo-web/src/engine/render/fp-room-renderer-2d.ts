/**
 * FP Room 2D Renderer — Top-Down Map View
 *
 * Renders rooms as top-down 2D maps using Canvas 2D.
 * Replaces the Three.js FpRoomRenderer with a simpler, faster 2D renderer.
 *
 * Features:
 * - Room floor + walls as rectangles
 * - Features as colored shapes + emoji + labels
 * - Exits as door rectangles + arrow indicators
 * - Radial gradient fog from player position
 * - Color overlay lighting per zone
 * - Hover detection via distance check
 * - WASD movement with wall collision
 * - Same public API as original FpRoomRenderer
 */

import { CONFIG } from '@/config';
import { State } from '@/engine/state';
import type { Room, RoomFeature, Zone } from '@/types';

// ---- Constants ----
const HOVER_DISTANCE = 60; // pixels
const EXIT_ARROW_ROTATION_SPEED = 0.5; // radians per second
const GLOW_PULSE_SPEED = 3; // Hz
const MIN_FPS = 30;
const TRANSITION_DURATION = 600; // ms
const PLAYER_RADIUS = 8; // collision radius

// ---- Zone Lighting Data (from original fp-renderer.ts) ----
interface ZoneLighting {
  ambientColor: string;
  ambientIntensity: number;
  directionalColor: string;
  directionalIntensity: number;
  fogColor: string;
  fogNear: number;
  fogFar: number;
  timeOfDay: number; // 0-1 where 0=midnight, 0.5=noon
}

const ZONE_LIGHTING: Record<string, ZoneLighting> = {
  apartment: {
    ambientColor: '#2a2a4a',
    ambientIntensity: 0.4,
    directionalColor: '#4466aa',
    directionalIntensity: 0.6,
    fogColor: '#1a1a2e',
    fogNear: 3,
    fogFar: 35,
    timeOfDay: 0.2, // Night
  },
  shelter: {
    ambientColor: '#3a3a2a',
    ambientIntensity: 0.5,
    directionalColor: '#aa8844',
    directionalIntensity: 0.7,
    fogColor: '#2a2a1a',
    fogNear: 10,
    fogFar: 30,
    timeOfDay: 0.6, // Morning
  },
  home: {
    ambientColor: '#4a3a2a',
    ambientIntensity: 0.6,
    directionalColor: '#ffcc88',
    directionalIntensity: 0.8,
    fogColor: '#3a2a1a',
    fogNear: 12,
    fogFar: 35,
    timeOfDay: 0.75, // Afternoon
  },
  pet_store: {
    ambientColor: '#4a3a4a',
    ambientIntensity: 0.6,
    directionalColor: '#ff88aa',
    directionalIntensity: 0.8,
    fogColor: '#3a2a3a',
    fogNear: 10,
    fogFar: 40,
    timeOfDay: 0.5,
  },
  garden: {
    ambientColor: '#3a4a2a',
    ambientIntensity: 0.7,
    directionalColor: '#88cc44',
    directionalIntensity: 0.9,
    fogColor: '#2a3a1a',
    fogNear: 12,
    fogFar: 45,
    timeOfDay: 0.65,
  },
  library: {
    ambientColor: '#3a3a2a',
    ambientIntensity: 0.5,
    directionalColor: '#ccaa66',
    directionalIntensity: 0.7,
    fogColor: '#2a2a1a',
    fogNear: 10,
    fogFar: 35,
    timeOfDay: 0.4,
  },
  market: {
    ambientColor: '#4a4a3a',
    ambientIntensity: 0.6,
    directionalColor: '#ffcc44',
    directionalIntensity: 0.8,
    fogColor: '#3a3a2a',
    fogNear: 12,
    fogFar: 40,
    timeOfDay: 0.55,
  },
  cave: {
    ambientColor: '#1a1a2a',
    ambientIntensity: 0.2,
    directionalColor: '#4466aa',
    directionalIntensity: 0.3,
    fogColor: '#0a0a1a',
    fogNear: 5,
    fogFar: 25,
    timeOfDay: 0.0,
  },
  default: {
    ambientColor: '#3a3a5a',
    ambientIntensity: 0.45,
    directionalColor: '#8888aa',
    directionalIntensity: 0.65,
    fogColor: '#1a1a2e',
    fogNear: 15,
    fogFar: 50,
    timeOfDay: 0.4,
  },
};

// ---- Helper: darken a hex color ----
function darkenHex(hex: string, factor: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${Math.floor(r * factor)},${Math.floor(g * factor)},${Math.floor(b * factor)})`;
}

// ---- Helper: lighten a hex color ----
function lightenHex(hex: string, factor: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${Math.min(255, Math.floor(r + (255 - r) * factor))},${Math.min(255, Math.floor(g + (255 - g) * factor))},${Math.min(255, Math.floor(b + (255 - b) * factor))})`;
}

// ---- Helper: parse hex color to rgba ----
function hexToRgba(hex: string, alpha: number = 1): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ---- Feature Shape Drawing ----
function drawFeatureShape(ctx: CanvasRenderingContext2D, feature: RoomFeature): void {
  const { x, y, w, h, type, locked } = feature;
  const color = locked ? '#ff4444' : '#f0c040';
  const opacity = locked ? 0.6 : 0.85;

  ctx.globalAlpha = opacity;
  ctx.fillStyle = color;

  switch (type) {
    case 'tv':
      // Rectangle with screen detail
      ctx.fillRect(x - w / 2, y - h / 2, w, h);
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 2;
      ctx.strokeRect(x - w / 2, y - h / 2, w, h);
      break;

    case 'food':
      // Circle (bowl/plate)
      ctx.beginPath();
      ctx.arc(x, y, Math.max(w, h) / 2, 0, Math.PI * 2);
      ctx.fill();
      break;

    case 'hint':
      // Diamond
      ctx.beginPath();
      ctx.moveTo(x, y - h / 2);
      ctx.lineTo(x + w / 2, y);
      ctx.lineTo(x, y + h / 2);
      ctx.lineTo(x - w / 2, y);
      ctx.closePath();
      ctx.fill();
      break;

    case 'door':
      // Door shape
      ctx.fillRect(x - w / 2, y - h / 2, w, h);
      ctx.strokeStyle = locked ? '#ff0000' : '#888';
      ctx.lineWidth = 2;
      ctx.strokeRect(x - w / 2, y - h / 2, w, h);
      break;

    case 'cat':
      // Triangle (ominous)
      ctx.beginPath();
      ctx.moveTo(x, y - h / 2);
      ctx.lineTo(x + w / 2, y + h / 2);
      ctx.lineTo(x - w / 2, y + h / 2);
      ctx.closePath();
      ctx.fill();
      break;

    case 'dog_friend':
      // Circle with friendly color
      ctx.beginPath();
      ctx.arc(x, y, Math.max(w, h) / 2, 0, Math.PI * 2);
      ctx.fill();
      break;

    case 'person':
      // Tall rectangle (standing figure)
      ctx.fillRect(x - w / 2, y - h / 2, w, h);
      break;

    case 'home':
      // Star shape (special)
      drawStar(ctx, x, y, 5, Math.max(w, h) / 2, Math.max(w, h) / 4);
      ctx.fill();
      break;

    case 'tree_clue':
      // Tree shape
      ctx.fillRect(x - 3, y, 6, h / 2); // trunk
      ctx.beginPath();
      ctx.arc(x, y - h / 4, w / 2, 0, Math.PI * 2);
      ctx.fill();
      break;

    case 'water':
    case 'water_bowl':
      // Blue circle
      ctx.beginPath();
      ctx.arc(x, y, Math.max(w, h) / 2, 0, Math.PI * 2);
      ctx.fill();
      break;

    case 'pet_shop':
    case 'celebration':
      // Rounded rectangle
      const radius = 10;
      const rx = x - w / 2;
      const ry = y - h / 2;
      ctx.beginPath();
      ctx.moveTo(rx + radius, ry);
      ctx.lineTo(rx + w - radius, ry);
      ctx.quadraticCurveTo(rx + w, ry, rx + w, ry + radius);
      ctx.lineTo(rx + w, ry + h - radius);
      ctx.quadraticCurveTo(rx + w, ry + h, rx + w - radius, ry + h);
      ctx.lineTo(rx + radius, ry + h);
      ctx.quadraticCurveTo(rx, ry + h, rx, ry + h - radius);
      ctx.lineTo(rx, ry + radius);
      ctx.quadraticCurveTo(rx, ry, rx + radius, ry);
      ctx.closePath();
      ctx.fill();
      break;

    case 'secret_passage':
      // X shape (hidden)
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-w / 2, -2, w, 4);
      ctx.fillRect(-2, -h / 2, 4, h);
      ctx.restore();
      break;

    case 'fountain':
      // Concentric circles
      ctx.beginPath();
      ctx.arc(x, y, Math.max(w, h) / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x, y, Math.max(w, h) / 4, 0, Math.PI * 2);
      ctx.fillStyle = locked ? '#ff4444' : '#f0c040';
      ctx.fill();
      break;

    case 'mailbox':
      // Rectangle with top
      ctx.fillRect(x - w / 2, y - h / 2, w, h);
      ctx.beginPath();
      ctx.arc(x, y - h / 2, w / 2, Math.PI, 0);
      ctx.fill();
      break;

    case 'fire_hydrant':
      // Small circle
      ctx.beginPath();
      ctx.arc(x, y, Math.min(w, h) / 3, 0, Math.PI * 2);
      ctx.fill();
      break;

    case 'scent_post':
      // Tall thin rectangle
      ctx.fillRect(x - 3, y - h / 2, 6, h);
      ctx.beginPath();
      ctx.arc(x, y - h / 2, 8, 0, Math.PI * 2);
      ctx.fill();
      break;

    case 'treasure':
      // Glowing circle
      ctx.beginPath();
      ctx.arc(x, y, Math.max(w, h) / 2, 0, Math.PI * 2);
      ctx.fill();
      break;

    case 'locked_door':
    case 'door':
      ctx.fillRect(x - w / 2, y - h / 2, w, h);
      break;

    case 'bridge':
      // Horizontal bar
      ctx.fillRect(x - w / 2, y - 4, w, 8);
      break;

    case 'trap':
      // Warning triangle
      ctx.beginPath();
      ctx.moveTo(x, y - h / 2);
      ctx.lineTo(x + w / 2, y + h / 2);
      ctx.lineTo(x - w / 2, y + h / 2);
      ctx.closePath();
      ctx.fill();
      break;

    case 'treasure_chest':
      // Box shape
      ctx.fillRect(x - w / 2, y - h / 2, w, h);
      ctx.strokeStyle = '#8B4513';
      ctx.lineWidth = 2;
      ctx.strokeRect(x - w / 2, y - h / 2, w, h);
      break;

    case 'companion_trap':
      // Circle with X
      ctx.beginPath();
      ctx.arc(x, y, Math.max(w, h) / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x - 8, y - 8);
      ctx.lineTo(x + 8, y + 8);
      ctx.moveTo(x + 8, y - 8);
      ctx.lineTo(x - 8, y + 8);
      ctx.stroke();
      break;

    case 'music_box':
      // Music note shape
      ctx.beginPath();
      ctx.arc(x, y + 5, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(x + 4, y - 15, 3, 20);
      ctx.beginPath();
      ctx.moveTo(x + 7, y - 15);
      ctx.lineTo(x + 15, y - 20);
      ctx.lineTo(x + 15, y - 12);
      ctx.closePath();
      ctx.fill();
      break;

    case 'choice':
      // Two overlapping circles
      ctx.beginPath();
      ctx.arc(x - 10, y, Math.max(w, h) / 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x + 10, y, Math.max(w, h) / 3, 0, Math.PI * 2);
      ctx.fill();
      break;

    case 'lure':
      // Arrow shape
      ctx.save();
      ctx.translate(x, y);
      ctx.beginPath();
      ctx.moveTo(10, 0);
      ctx.lineTo(-5, -8);
      ctx.lineTo(-5, 8);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      break;

    case 'traffic':
      // Rectangle (car)
      ctx.fillRect(x - w / 2, y - h / 2, w, h);
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 1;
      ctx.strokeRect(x - w / 2, y - h / 2, w, h);
      break;

    case 'bully':
      // Red X
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-w / 2, -3, w, 6);
      ctx.fillRect(-3, -h / 2, 6, h);
      ctx.restore();
      break;

    case 'storm':
      // Lightning bolt
      ctx.save();
      ctx.translate(x, y);
      ctx.beginPath();
      ctx.moveTo(5, -h / 2);
      ctx.lineTo(-5, 0);
      ctx.lineTo(2, 0);
      ctx.lineTo(-5, h / 2);
      ctx.lineTo(5, 0);
      ctx.lineTo(-2, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      break;

    case 'vacuum':
      // Rectangle with hose
      ctx.fillRect(x - w / 2, y - h / 2, w, h);
      ctx.beginPath();
      ctx.arc(x + w / 2, y - h / 4, 5, 0, Math.PI * 2);
      ctx.fill();
      break;

    default:
      // Generic rectangle
      ctx.fillRect(x - w / 2, y - h / 2, w, h);
  }

  ctx.globalAlpha = 1;
}

// ---- Helper: draw star shape ----
function drawStar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  spikes: number,
  outerRadius: number,
  innerRadius: number,
): void {
  let rot = (Math.PI / 2) * 3;
  const step = Math.PI / spikes;
  ctx.beginPath();
  ctx.moveTo(cx, cy - outerRadius);
  for (let i = 0; i < spikes; i++) {
    ctx.lineTo(cx + Math.cos(rot) * outerRadius, cy + Math.sin(rot) * outerRadius);
    rot += step;
    ctx.lineTo(cx + Math.cos(rot) * innerRadius, cy + Math.sin(rot) * innerRadius);
    rot += step;
  }
  ctx.lineTo(cx, cy - outerRadius);
  ctx.closePath();
}

// ---- Helper: draw label with background ----
function drawLabel(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  fontSize: number = 12,
  color: string = '#f0c040',
): void {
  ctx.font = `bold ${fontSize}px Courier New`;
  const metrics = ctx.measureText(text);
  const padding = 4;
  const w = metrics.width + padding * 2;
  const h = fontSize + padding * 2;

  // Background
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(x - w / 2, y - h / 2, w, h);

  // Text
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
}

// ---- Feature State (for animation) ----
interface FeatureState {
  feature: RoomFeature;
  glowPhase: number;
  isHovered: boolean;
}

// ---- Exit State (for animation) ----
interface ExitState {
  exitRoomId: string;
  wallSide: 'north' | 'south' | 'east' | 'west';
  arrowAngle: number;
}

// ---- Main Renderer Class ----
export class FpRoomRenderer2D {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private room!: Room;
  private roomIndex!: number;
  private zoneId!: string;
  private zoneData!: Zone;
  private playerX: number = 0;
  private playerZ: number = 0;
  private targetPlayerX: number = 0;
  private targetPlayerZ: number = 0;
  private transitioning: boolean = false;
  private transitionStart: number = 0;
  private transitionFromX: number = 0;
  private transitionFromZ: number = 0;
  private keys: Set<string> = new Set();
  private moveSpeed: number;
  private featureStates: Map<string, FeatureState> = new Map();
  private exitStates: ExitState[] = [];
  private hoveredFeature: RoomFeature | null = null;
  private glowTime: number = 0;
  private happinessInterval: number | null = null;
  private animationId: number | null = null;
  private lastFrameTime: number = 0;
  private onFeatureClick: ((feature: RoomFeature) => void) | null = null;
  private onExitClick: ((exitRoomId: string) => void) | null = null;
  // Bound listeners for cleanup
  private boundKeyDown: ((e: KeyboardEvent) => void) | null = null;
  private boundKeyUp: ((e: KeyboardEvent) => void) | null = null;
  private boundMouseMove: ((e: MouseEvent) => void) | null = null;
  private boundClick: ((e: MouseEvent) => void) | null = null;
  private disposed = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.moveSpeed = CONFIG.fpMoveSpeed;
  }

  // ---- Initialization ----

  init(zoneId: string, zoneData: Zone, roomIndex: number): void {
    if (this.disposed) return;
    console.log('[FP2D] init called:', zoneId, roomIndex);

    this.zoneId = zoneId;
    this.zoneData = zoneData;
    this.roomIndex = roomIndex;
    this.room = zoneData.rooms![roomIndex];
    console.log('[FP2D] Room:', this.room.id, this.room.w, 'x', this.room.d);

    // Start player at center of room
    this.playerX = 0;
    this.playerZ = 0;
    this.targetPlayerX = 0;
    this.targetPlayerZ = 0;

    // Initialize feature states
    const features = this.room.features || [];
    for (const feature of features) {
      this.featureStates.set(feature.type, {
        feature,
        glowPhase: Math.random() * Math.PI * 2,
        isHovered: false,
      });
    }

    // Initialize exit states
    this.exitStates = this.computeExitStates();

    // Setup events
    this.setupEvents();

    // Start render loop
    this.lastFrameTime = performance.now();
    console.log('[FP2D] Starting animate loop...');
    this.animate();

    // Start happiness decay
    this.startHappinessDecay();
  }

  /** Compute exit positions on room walls */
  private computeExitStates(): ExitState[] {
    const states: ExitState[] = [];
    const hw = this.room.w / 2;
    const hd = this.room.d / 2;
    const exits = this.room.exits || [];

    for (let i = 0; i < exits.length; i++) {
      const exitId = exits[i];
      let wallSide: 'north' | 'south' | 'east' | 'west';
      let ex = 0;
      let ez = 0;

      if (i === 0) {
        wallSide = 'north';
        ex = 0;
        ez = -hd;
      } else if (i === 1) {
        wallSide = 'east';
        ex = hw;
        ez = 0;
      } else if (i === 2) {
        wallSide = 'south';
        ex = 0;
        ez = hd;
      } else {
        wallSide = 'west';
        ex = -hw;
        ez = 0;
      }

      states.push({ exitRoomId: exitId, wallSide, arrowAngle: 0 });
    }

    return states;
  }

  private setupEvents(): void {
    this.boundKeyDown = (e: KeyboardEvent) => this.onKeyDown(e);
    this.boundKeyUp = (e: KeyboardEvent) => this.onKeyUp(e);
    this.boundMouseMove = (e: MouseEvent) => this.onMouseMove(e);
    this.boundClick = (e: MouseEvent) => this.onClick(e);

    this.canvas.addEventListener('mousemove', this.boundMouseMove);
    this.canvas.addEventListener('click', this.boundClick);
    window.addEventListener('keydown', this.boundKeyDown);
    window.addEventListener('keyup', this.boundKeyUp);
  }

  // ---- Keyboard event routing (called from main.ts) ----

  handleKeyDown(event: KeyboardEvent): void {
    this.onKeyDown(event);
  }

  handleKeyUp(event: KeyboardEvent): void {
    this.onKeyUp(event);
  }

  // ---- Event Handlers ----

  private onKeyDown(event: KeyboardEvent): void {
    this.keys.add(event.key.toLowerCase());
  }

  private onKeyUp(event: KeyboardEvent): void {
    this.keys.delete(event.key.toLowerCase());
  }

  private onMouseMove(event: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    const mx = event.clientX - rect.left - this.canvas.width / 2;
    const my = event.clientY - rect.top - this.canvas.height / 2;

    // Convert screen coords to world coords (player is at center)
    const worldX = mx;
    const worldZ = my;

    let closestFeature: RoomFeature | null = null;
    let closestDist = HOVER_DISTANCE;

    for (const [key, state] of this.featureStates) {
      const f = state.feature;
      const dx = worldX - f.x;
      const dz = worldZ - f.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      // Check if within feature bounds
      const halfW = f.w / 2 + 10;
      const halfH = f.h / 2 + 10;
      if (
        Math.abs(dx) < halfW &&
        Math.abs(dz) < halfH &&
        dist < closestDist
      ) {
        closestDist = dist;
        closestFeature = f;
      }
    }

    this.hoveredFeature = closestFeature;
    this.canvas.style.cursor = closestFeature ? 'pointer' : 'default';

    // Update hover states
    for (const [key, state] of this.featureStates) {
      state.isHovered = state.feature === closestFeature;
    }
  }

  private onClick(event: MouseEvent): void {
    if (this.hoveredFeature) {
      this.onFeatureClick?.(this.hoveredFeature);
      return;
    }

    // Check exit clicks
    const rect = this.canvas.getBoundingClientRect();
    const mx = event.clientX - rect.left - this.canvas.width / 2;
    const my = event.clientY - rect.top - this.canvas.height / 2;

    for (const exit of this.exitStates) {
      const hw = this.room.w / 2;
      const hd = this.room.d / 2;
      let ex = 0, ez = 0;

      switch (exit.wallSide) {
        case 'north': ex = 0; ez = -hd; break;
        case 'east': ex = hw; ez = 0; break;
        case 'south': ex = 0; ez = hd; break;
        case 'west': ex = -hw; ez = 0; break;
      }

      const dx = mx - ex;
      const dz = my - ez;
      if (Math.sqrt(dx * dx + dz * dz) < 30) {
        this.onExitClick?.(exit.exitRoomId);
        return;
      }
    }
  }

  // ---- Movement ----

  private updateMovement(delta: number): void {
    const speed = this.moveSpeed * delta;
    let newX = this.playerX;
    let newZ = this.playerZ;

    if (this.keys.has('w') || this.keys.has('arrowup')) newZ -= speed;
    if (this.keys.has('s') || this.keys.has('arrowdown')) newZ += speed;
    if (this.keys.has('a') || this.keys.has('arrowleft')) newX -= speed;
    if (this.keys.has('d') || this.keys.has('arrowright')) newX += speed;

    // Clamp to room bounds (with margin for player radius)
    const margin = PLAYER_RADIUS;
    const minX = -this.room.w / 2 + margin;
    const maxX = this.room.w / 2 - margin;
    const minZ = -this.room.d / 2 + margin;
    const maxZ = this.room.d / 2 - margin;

    newX = Math.max(minX, Math.min(maxX, newX));
    newZ = Math.max(minZ, Math.min(maxZ, newZ));

    this.playerX = newX;
    this.playerZ = newZ;
  }

  // ---- Animation Loop ----

  private animate(): void {
    this.animationId = requestAnimationFrame(() => this.animate());

    const now = performance.now();
    const delta = Math.min((now - this.lastFrameTime) / 1000, 1 / MIN_FPS);
    this.lastFrameTime = now;

    this.glowTime += delta;

    // Update movement
    this.updateMovement(delta);

    // Update transition animation
    if (this.transitioning) {
      const elapsed = now - this.transitionStart;
      const t = Math.min(1, elapsed / TRANSITION_DURATION);
      // Ease in-out cubic
      const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      this.playerX = this.transitionFromX + (this.targetPlayerX - this.transitionFromX) * ease;
      this.playerZ = this.transitionFromZ + (this.targetPlayerZ - this.transitionFromZ) * ease;
      if (t >= 1) {
        this.transitioning = false;
        this.playerX = this.targetPlayerX;
        this.playerZ = this.targetPlayerZ;
      }
    }

    // Render
    this.render();
  }

  // ---- Render ----

  private render(): void {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Clear
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, w, h);

    // Camera offset (center on player)
    const camX = this.playerX;
    const camZ = this.playerZ;

    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.scale(1, 1); // No zoom needed — room data is already in pixel units
    ctx.translate(-camX, -camZ);

    // ---- Draw Room ----

    // Floor
    ctx.fillStyle = this.room.color;
    ctx.fillRect(-this.room.w / 2, -this.room.d / 2, this.room.w, this.room.d);

    // Walls (4 border rectangles, darker shade)
    const wallColor = darkenHex(this.room.color, 0.6);
    const wallThickness = 6;
    const hw = this.room.w / 2;
    const hd = this.room.d / 2;

    // Back wall (north)
    ctx.fillStyle = wallColor;
    ctx.fillRect(-hw, -hd - wallThickness, this.room.w, wallThickness);
    // Front wall (south)
    ctx.fillRect(-hw, hd, this.room.w, wallThickness);
    // Left wall (west)
    ctx.fillRect(-hw - wallThickness, -hd, wallThickness, this.room.d);
    // Right wall (east)
    ctx.fillRect(hw, -hd, wallThickness, this.room.d);

    // ---- Draw Features ----

    for (const [key, state] of this.featureStates) {
      const f = state.feature;
      const glowPulse = 0.2 + 0.15 * Math.sin(this.glowTime * GLOW_PULSE_SPEED + state.glowPhase);

      // Glow ring for non-locked features
      if (!f.locked) {
        const ringRadius = Math.max(f.w, f.h) / 2 + 8 + (state.isHovered ? 4 : 0) + Math.sin(this.glowTime * 2) * 3;
        ctx.beginPath();
        ctx.arc(f.x, f.z, ringRadius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(240, 192, 64, ${glowPulse})`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Hover highlight
      if (state.isHovered) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.strokeRect(
          f.x - f.w / 2 - 4,
          f.z - f.h / 2 - 4,
          f.w + 8,
          f.h + 8,
        );
      }

      // Feature shape
      drawFeatureShape(ctx, f);

      // Label
      const labelY = f.z - Math.max(f.w, f.h) / 2 - 16;
      drawLabel(ctx, f.label, f.x, labelY, 11, f.locked ? '#ff4444' : '#f0c040');
    }

    // ---- Draw Exits ----

    for (const exit of this.exitStates) {
      const hw = this.room.w / 2;
      const hd = this.room.d / 2;
      let ex = 0, ez = 0;

      switch (exit.wallSide) {
        case 'north': ex = 0; ez = -hd; break;
        case 'east': ex = hw; ez = 0; break;
        case 'south': ex = 0; ez = hd; break;
        case 'west': ex = -hw; ez = 0; break;
      }

      // Door rectangle
      ctx.fillStyle = '#8a8a8a';
      if (exit.wallSide === 'north' || exit.wallSide === 'south') {
        ctx.fillRect(ex - 12, ez - 3, 24, 6);
      } else {
        ctx.fillRect(ex - 3, ez - 12, 6, 24);
      }

      // Arrow marker above door
      exit.arrowAngle += delta * EXIT_ARROW_ROTATION_SPEED;
      const arrowDist = 20;
      let ax = ex, az = ez;
      switch (exit.wallSide) {
        case 'north': az -= arrowDist; break;
        case 'east': ax += arrowDist; break;
        case 'south': az += arrowDist; break;
        case 'west': ax -= arrowDist; break;
      }

      // Pulsing arrow
      const arrowAlpha = 0.5 + 0.3 * Math.sin(this.glowTime * 2);
      ctx.save();
      ctx.translate(ax, az);
      ctx.rotate(exit.wallSide === 'north' ? -Math.PI / 2 : exit.wallSide === 'south' ? Math.PI / 2 : exit.wallSide === 'east' ? 0 : Math.PI);
      ctx.fillStyle = `rgba(74, 222, 128, ${arrowAlpha})`;
      ctx.beginPath();
      ctx.moveTo(6, 0);
      ctx.lineTo(-4, -5);
      ctx.lineTo(-4, 5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // Label
      drawLabel(ctx, `→ ${exit.exitRoomId}`, ax, az + 16, 10, '#4ade80');
    }

    // ---- Draw Fog (radial gradient from player) ----

    const lighting = ZONE_LIGHTING[this.zoneId] || ZONE_LIGHTING.default;
    const fogNear = lighting.fogNear;
    const fogFar = lighting.fogFar;

    const fogRadius = Math.max(this.room.w, this.room.d) * 0.6;
    const gradient = ctx.createRadialGradient(
      camX, camZ, fogNear,
      camX, camZ, fogRadius,
    );
    const fogColor = lighting.fogColor;
    gradient.addColorStop(0, hexToRgba(fogColor, 0));
    gradient.addColorStop(0.5, hexToRgba(fogColor, 0.3));
    gradient.addColorStop(1, hexToRgba(fogColor, 0.85));

    ctx.fillStyle = gradient;
    ctx.fillRect(
      camX - fogRadius,
      camZ - fogRadius,
      fogRadius * 2,
      fogRadius * 2,
    );

    // ---- Draw Lighting Overlay ----

    const tod = lighting.timeOfDay;
    const sunIntensity = Math.sin(tod * Math.PI);
    const overlayAlpha = 0.05 + sunIntensity * 0.1;
    const overlayColor = lighting.directionalColor;

    ctx.fillStyle = hexToRgba(overlayColor, overlayAlpha);
    ctx.fillRect(
      camX - fogRadius,
      camZ - fogRadius,
      fogRadius * 2,
      fogRadius * 2,
    );

    ctx.restore();

    // ---- Draw Player ----

    this.drawPlayer(ctx, w / 2, h / 2);
  }

  /** Draw the player (dog) at screen center */
  private drawPlayer(ctx: CanvasRenderingContext2D, sx: number, sy: number): void {
    const color = this.zoneData.dogColor || '#d4a574';

    // Player glow
    const glowGrad = ctx.createRadialGradient(sx, sy, 0, sx, sy, PLAYER_RADIUS + 10);
    glowGrad.addColorStop(0, hexToRgba(color, 0.3));
    glowGrad.addColorStop(1, hexToRgba(color, 0));
    ctx.fillStyle = glowGrad;
    ctx.beginPath();
    ctx.arc(sx, sy, PLAYER_RADIUS + 10, 0, Math.PI * 2);
    ctx.fill();

    // Player body (circle)
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(sx, sy, PLAYER_RADIUS, 0, Math.PI * 2);
    ctx.fill();

    // Player border
    ctx.strokeStyle = darkenHex(color, 0.7);
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Direction indicator (arrow pointing in movement direction)
    let dirX = 0, dirZ = 0;
    if (this.keys.has('w') || this.keys.has('arrowup')) dirZ = -1;
    if (this.keys.has('s') || this.keys.has('arrowdown')) dirZ = 1;
    if (this.keys.has('a') || this.keys.has('arrowleft')) dirX = -1;
    if (this.keys.has('d') || this.keys.has('arrowright')) dirX = 1;

    if (dirX !== 0 || dirZ !== 0) {
      const angle = Math.atan2(dirZ, dirX);
      const len = PLAYER_RADIUS + 8;
      ctx.strokeStyle = '#ff9900';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + Math.cos(angle) * len, sy + Math.sin(angle) * len);
      ctx.stroke();
    }
  }

  // ---- Public API ----

  setOnFeatureClick(cb: ((feature: RoomFeature) => void) | null): void {
    this.onFeatureClick = cb;
  }

  setOnExitClick(cb: ((exitRoomId: string) => void) | null): void {
    this.onExitClick = cb;
  }

  getCameraPosition(): { x: number; z: number } {
    return { x: this.playerX, z: this.playerZ };
  }

  moveTo(x: number, z: number): void {
    const clampedX = Math.max(-this.room.w / 2 + PLAYER_RADIUS, Math.min(this.room.w / 2 - PLAYER_RADIUS, x));
    const clampedZ = Math.max(-this.room.d / 2 + PLAYER_RADIUS, Math.min(this.room.d / 2 - PLAYER_RADIUS, z));
    this.transitionFromX = this.playerX;
    this.transitionFromZ = this.playerZ;
    this.targetPlayerX = clampedX;
    this.targetPlayerZ = clampedZ;
    this.transitioning = true;
    this.transitionStart = performance.now();
  }

  getRoom(): Room {
    return this.room;
  }

  getZoneId(): string {
    return this.zoneId;
  }

  startHappinessDecay(): void {
    if (this.happinessInterval) return;
    this.happinessInterval = window.setInterval(() => {
      const decay = CONFIG.happinessDecayPerSecond;
      const current = State.state.happiness;
      if (current > 0) {
        State.state.happiness = Math.max(0, current - decay);
        if (State.state.happiness <= 0) {
          State.gameOver();
        }
      }
    }, 1000);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }

    window.removeEventListener('keydown', this.boundKeyDown!);
    window.removeEventListener('keyup', this.boundKeyUp!);

    this.canvas.removeEventListener('mousemove', this.boundMouseMove!);
    this.canvas.removeEventListener('click', this.boundClick!);

    this.featureStates.clear();
    this.exitStates = [];
    this.keys.clear();

    if (this.happinessInterval) {
      window.clearInterval(this.happinessInterval);
      this.happinessInterval = null;
    }
  }
}
