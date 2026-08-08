/**
 * TP Zone 2D Renderer — Top-Down Open World
 *
 * Renders open-world TP zones as top-down 2D maps using Canvas 2D.
 * Replaces the Three.js TpEngine with a simpler, faster 2D renderer.
 *
 * Features:
 * - Ground plane with grass patches
 * - Obstacles: fences, trees, benches, bushes as 2D shapes
 * - Player as top-down dog shape or emoji
 * - NPC dogs as colored top-down shapes
 * - Scent trail as fading dots
 * - Feature markers as shapes + emoji + labels
 * - Radial gradient fog from player position
 * - Color overlay lighting per zone
 * - WASD movement with obstacle collision
 * - NPC wander AI
 * - Same public API as original TpEngine
 */

import { CONFIG } from '@/config';
import { State } from '@/engine/state';
import type { Zone, NPC, Obstacle, RoomFeatureExtended } from '@/types';

// ---- Constants ----
const NPC_SPEED = 0.8;
const NPC_CHANGE_INTERVAL = 4000;
const SMAX_DIST = 12;
const PLAYER_RADIUS = 8;
const MIN_FPS = 30;
const Scent_TRAIL_MAX = 30;
const Scent_TRAIL_INTERVAL = 0.3; // minimum distance between points

// ---- Zone Lighting Data ----
interface ZoneLighting {
  ambientColor: string;
  ambientIntensity: number;
  sunColor: string;
  sunIntensity: number;
  skyColor: string;
  groundColor: string;
}

const ZONE_LIGHT_MAP: Record<string, ZoneLighting> = {
  dog_park: {
    ambientColor: '#4a6a3a',
    ambientIntensity: 0.5,
    sunColor: '#fff5e0',
    sunIntensity: 0.9,
    skyColor: '#87CEEB',
    groundColor: '#4a7c3f',
  },
  apartment: {
    ambientColor: '#2a2a4a',
    ambientIntensity: 0.3,
    sunColor: '#4466aa',
    sunIntensity: 0.3,
    skyColor: '#1a1a3a',
    groundColor: '#3a3a4a',
  },
  shelter: {
    ambientColor: '#3a3a2a',
    ambientIntensity: 0.4,
    sunColor: '#aa8844',
    sunIntensity: 0.6,
    skyColor: '#4a4a3a',
    groundColor: '#4a4a3a',
  },
  neighborhood: {
    ambientColor: '#3a4a5a',
    ambientIntensity: 0.45,
    sunColor: '#88aacc',
    sunIntensity: 0.7,
    skyColor: '#6a8aaa',
    groundColor: '#5a6a4a',
  },
  home: {
    ambientColor: '#4a3a2a',
    ambientIntensity: 0.5,
    sunColor: '#ffcc88',
    sunIntensity: 0.8,
    skyColor: '#8a6a4a',
    groundColor: '#5a4a3a',
  },
  lake: {
    ambientColor: '#3a5a6a',
    ambientIntensity: 0.6,
    sunColor: '#aae0ff',
    sunIntensity: 0.8,
    skyColor: '#87CEEB',
    groundColor: '#2d5a1e',
  },
  pet_store: {
    ambientColor: '#4a3a4a',
    ambientIntensity: 0.6,
    sunColor: '#ff88aa',
    sunIntensity: 0.7,
    skyColor: '#ffb6c1',
    groundColor: '#FFB6C1',
  },
  dog_show: {
    ambientColor: '#4a4a3a',
    ambientIntensity: 0.5,
    sunColor: '#fff5e0',
    sunIntensity: 0.8,
    skyColor: '#87CEEB',
    groundColor: '#8B4513',
  },
  forest: {
    ambientColor: '#1a3a1a',
    ambientIntensity: 0.3,
    sunColor: '#88cc44',
    sunIntensity: 0.4,
    skyColor: '#2F4F4F',
    groundColor: '#1a3a0a',
  },
  beach: {
    ambientColor: '#5a6a5a',
    ambientIntensity: 0.6,
    sunColor: '#fff5e0',
    sunIntensity: 0.9,
    skyColor: '#87CEEB',
    groundColor: '#F4A460',
  },
  mountain: {
    ambientColor: '#3a4a5a',
    ambientIntensity: 0.4,
    sunColor: '#aaccff',
    sunIntensity: 0.7,
    skyColor: '#4682B4',
    groundColor: '#708090',
  },
  garden: {
    ambientColor: '#3a5a3a',
    ambientIntensity: 0.7,
    sunColor: '#88ff44',
    sunIntensity: 0.8,
    skyColor: '#FFB6C1',
    groundColor: '#4a7a3a',
  },
  library: {
    ambientColor: '#3a3a2a',
    ambientIntensity: 0.5,
    sunColor: '#ccaa66',
    sunIntensity: 0.5,
    skyColor: '#D2B48C',
    groundColor: '#8B4513',
  },
  market: {
    ambientColor: '#4a4a3a',
    ambientIntensity: 0.6,
    sunColor: '#ffcc44',
    sunIntensity: 0.7,
    skyColor: '#FFD700',
    groundColor: '#8a7a4a',
  },
  cave: {
    ambientColor: '#1a1a2a',
    ambientIntensity: 0.15,
    sunColor: '#4466aa',
    sunIntensity: 0.2,
    skyColor: '#2F4F4F',
    groundColor: '#4682B4',
  },
  waterfall: {
    ambientColor: '#3a5a5a',
    ambientIntensity: 0.5,
    sunColor: '#aae0ff',
    sunIntensity: 0.7,
    skyColor: '#87CEEB',
    groundColor: '#2d5a1e',
  },
  park_secret: {
    ambientColor: '#0a0a2a',
    ambientIntensity: 0.1,
    sunColor: '#4a4aff',
    sunIntensity: 0.1,
    skyColor: '#191970',
    groundColor: '#2d5a1e',
  },
};

// ---- Helper: parse hex color ----
function hexToRgba(hex: string, alpha: number = 1): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function darkenHex(hex: string, factor: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${Math.floor(r * factor)},${Math.floor(g * factor)},${Math.floor(b * factor)})`;
}

// ---- NPC Model (2D) ----
interface NPCModel2D {
  npc: NPC;
  targetX: number;
  targetZ: number;
  wanderTimer: number;
  tailPhase: number;
  idleBounce: number;
}

// ---- Obstacle Hitbox ----
interface ObstacleHitbox {
  type: 'rect' | 'circle';
  x: number;
  z: number;
  w?: number;
  h?: number;
  r?: number;
}

// ---- Scent Trail ----
interface ScentPoint2D {
  x: number;
  z: number;
  alpha: number;
}

// ---- Feature Draw Info ----
interface FeatureDrawInfo {
  feature: RoomFeatureExtended;
  glowPhase: number;
  isHovered: boolean;
}

// ---- Main TP 2D Engine ----
export class TpEngine2D {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private zoneId!: string;
  private zoneData!: Zone;
  private playerX: number = 0;
  private playerZ: number = 0;
  private playerAngle: number = 0;
  private isMoving: boolean = false;
  private keys: Set<string> = new Set();
  private moveSpeed: number;
  private animFrame: number | null = null;
  private lastFrameTime: number = 0;
  private glowTime: number = 0;
  private happinessInterval: number | null = null;
  // NPCs
  private npcModels: Map<string, NPCModel2D> = new Map();
  // Obstacles
  private obstacleHitboxes: ObstacleHitbox[] = [];
  // Obstacle visual data for rendering
  private obstacleVisuals: Array<{
    obs: Obstacle;
    hitbox: ObstacleHitbox;
  }> = [];
  // Features
  private featureDraws: Map<string, FeatureDrawInfo> = new Map();
  // Scent trail
  private scentTrail: ScentPoint2D[] = [];
  private lastScentPos: { x: number; z: number } = { x: 0, z: 0 };
  // Hover state
  private hoveredFeature: RoomFeatureExtended | null = null;
  private hoveredNpc: NPC | null = null;
  // Callbacks
  private onFeatureClick: ((type: string, data: any) => void) | null = null;
  private onNpcClick: ((npc: NPC) => void) | null = null;
  // Bound listeners
  private boundClick: ((e: MouseEvent) => void) | null = null;
  private boundKeydown: ((e: KeyboardEvent) => void) | null = null;
  private boundKeyup: ((e: KeyboardEvent) => void) | null = null;
  // State
  private isPaused: boolean = false;
  private disposed = false;
  // Canvas bounds
  private halfWorld = 15; // world units from center

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.moveSpeed = CONFIG.tpMoveSpeed;
  }

  // ---- Initialization ----

  init(zoneId: string, zoneData: Zone): void {
    if (this.disposed) return;
    console.log('[TP2D] init called:', zoneId);

    this.zoneId = zoneId;
    this.zoneData = zoneData;
    this.clear();
    this.buildZone();
  }

  /** Clear previous state */
  private clear(): void {
    this.npcModels.clear();
    this.obstacleHitboxes = [];
    this.obstacleVisuals = [];
    this.featureDraws.clear();
    this.scentTrail = [];
    this.keys.clear();
    this.playerX = 0;
    this.playerZ = 0;
    this.playerAngle = 0;
    this.lastScentPos = { x: 0, z: 0 };
    this.hoveredFeature = null;
    this.hoveredNpc = null;
  }

  /** Build the zone environment */
  private buildZone(): void {
    // Ground
    // (drawn in render)

    // Obstacles
    if (this.zoneData.obstacles) {
      for (const obs of this.zoneData.obstacles) {
        const hitbox: ObstacleHitbox = {
          type: obs.type === 'tree' || obs.type === 'bush' ? 'circle' : 'rect',
          x: obs.x,
          z: obs.z,
          w: obs.width || 0,
          h: obs.height || 0,
          r: obs.type === 'bush' ? (obs.width || 0.5) : undefined,
        };
        this.obstacleHitboxes.push(hitbox);
        this.obstacleVisuals.push({ obs, hitbox });
      }
    }

    // NPCs
    if (this.zoneData.npcs) {
      for (const npcData of this.zoneData.npcs) {
        const model: NPCModel2D = {
          npc: npcData,
          targetX: npcData.x + (Math.random() - 0.5) * 6,
          targetZ: npcData.z + (Math.random() - 0.5) * 6,
          wanderTimer: 0,
          tailPhase: Math.random() * Math.PI * 2,
          idleBounce: 0,
        };
        this.npcModels.set(npcData.id, model);
      }
    }

    // Features
    if (this.zoneData.features) {
      for (const feature of this.zoneData.features) {
        this.featureDraws.set(feature.id || feature.type, {
          feature,
          glowPhase: Math.random() * Math.PI * 2,
          isHovered: false,
        });
      }
    }

    // Click handler (remove previous to prevent duplicates)
    if (this.boundClick) {
      this.canvas.removeEventListener('click', this.boundClick);
    }
    this.boundClick = (e: MouseEvent) => this.onClick(e);
    this.canvas.addEventListener('click', this.boundClick);

    // Key handlers
    this.boundKeydown = (e: KeyboardEvent) => this.onKeyDown(e);
    this.boundKeyup = (e: KeyboardEvent) => this.onKeyUp(e);
    this.canvas.addEventListener('keydown', this.boundKeydown);
    this.canvas.addEventListener('keyup', this.boundKeyup);

    // Start render loop
    this.lastFrameTime = performance.now();
    console.log('[TP2D] Starting animate loop...');
    this.animate();
  }

  // ---- Event Handlers ----

  private onClick(event: MouseEvent): void {
    if (this.isPaused) return;

    const rect = this.canvas.getBoundingClientRect();
    const mx = event.clientX - rect.left - this.canvas.width / 2;
    const my = event.clientY - rect.top - this.canvas.height / 2;

    // Convert to world coords
    const worldX = mx;
    const worldZ = my;

    // Check feature clicks (distance-based)
    if (this.hoveredFeature) {
      const f = this.hoveredFeature;
      const dx = worldX - f.x;
      const dz = worldZ - f.z;
      if (Math.sqrt(dx * dx + dz * dz) < Math.max(f.w, f.h) / 2 + 10) {
        this.onFeatureClick?.(f.type, f);
        return;
      }
    }

    // Check NPC clicks
    if (this.hoveredNpc) {
      const npc = this.hoveredNpc;
      const dx = worldX - npc.x;
      const dz = worldZ - npc.z;
      if (Math.sqrt(dx * dx + dz * dz) < 15) {
        this.onNpcClick?.(npc);
        return;
      }
    }
  }

  onKeyDown(key: string): void {
    this.keys.add(key.toLowerCase());
  }

  onKeyUp(key: string): void {
    this.keys.delete(key.toLowerCase());
  }

  // ---- Movement ----

  private updateMovement(delta: number): void {
    const moveDir = { x: 0, z: 0 };
    if (this.keys.has('w') || this.keys.has('arrowup')) moveDir.z -= 1;
    if (this.keys.has('s') || this.keys.has('arrowdown')) moveDir.z += 1;
    if (this.keys.has('a') || this.keys.has('arrowleft')) moveDir.x -= 1;
    if (this.keys.has('d') || this.keys.has('arrowright')) moveDir.x += 1;

    this.isMoving = moveDir.x !== 0 || moveDir.z !== 0;

    if (this.isMoving) {
      // Normalize
      const len = Math.sqrt(moveDir.x * moveDir.x + moveDir.z * moveDir.z);
      moveDir.x /= len;
      moveDir.z /= len;

      // Camera-relative movement (top-down, so directional keys move absolute)
      const newX = this.playerX + moveDir.x * this.moveSpeed * delta;
      const newZ = this.playerZ + moveDir.z * this.moveSpeed * delta;

      // Clamp to bounds
      const clampedX = Math.max(-this.halfWorld, Math.min(this.halfWorld, newX));
      const clampedZ = Math.max(-this.halfWorld, Math.min(this.halfWorld, newZ));

      // Obstacle collision
      let blocked = false;
      for (const hitbox of this.obstacleHitboxes) {
        if (hitbox.type === 'rect') {
          const hw = (hitbox.w || 0) / 2 + PLAYER_RADIUS;
          const hh = (hitbox.h || 0) / 2 + PLAYER_RADIUS;
          if (
            clampedX > hitbox.x - hw &&
            clampedX < hitbox.x + hw &&
            clampedZ > hitbox.z - hh &&
            clampedZ < hitbox.z + hh
          ) {
            blocked = true;
            break;
          }
        } else if (hitbox.type === 'circle') {
          const r = (hitbox.r || 0.5) + PLAYER_RADIUS;
          const dx = clampedX - hitbox.x;
          const dz = clampedZ - hitbox.z;
          if (Math.sqrt(dx * dx + dz * dz) < r) {
            blocked = true;
            break;
          }
        }
      }

      if (!blocked) {
        this.playerX = clampedX;
        this.playerZ = clampedZ;
      }

      // Face movement direction
      this.playerAngle = Math.atan2(moveDir.x, moveDir.z);

      // Scent trail
      const dist = Math.sqrt(
        (this.playerX - this.lastScentPos.x) ** 2 +
        (this.playerZ - this.lastScentPos.z) ** 2
      );
      if (dist >= Scent_TRAIL_INTERVAL) {
        this.scentTrail.push({
          x: this.playerX,
          z: this.playerZ,
          alpha: 0.6,
        });
        this.lastScentPos = { x: this.playerX, z: this.playerZ };
        if (this.scentTrail.length > Scent_TRAIL_MAX) {
          this.scentTrail.shift();
        }
      }
    }
  }

  // ---- Animation Loop ----

  private animate(): void {
    this.animFrame = requestAnimationFrame(() => this.animate());

    const now = performance.now();
    const delta = Math.min((now - this.lastFrameTime) / 1000, 1 / MIN_FPS);
    this.lastFrameTime = now;

    this.glowTime += delta;

    if (!this.isPaused) {
      this.updateMovement(delta);
      this.updateNPCs(delta, this.glowTime);
    }

    this.render();
  }

  // ---- NPC Update ----

  private updateNPCs(delta: number, time: number): void {
    for (const [id, model] of this.npcModels) {
      model.wanderTimer += delta * 1000;

      // Wander
      const dx = model.targetX - model.npc.x;
      const dz = model.targetZ - model.npc.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist < 0.5 || model.wanderTimer > NPC_CHANGE_INTERVAL) {
        model.targetX = model.npc.x + (Math.random() - 0.5) * 12;
        model.targetZ = model.npc.z + (Math.random() - 0.5) * 12;
        model.wanderTimer = 0;
      }

      // Move toward target
      if (dist > 0.3) {
        const moveX = (dx / dist) * NPC_SPEED * delta;
        const moveZ = (dz / dist) * NPC_SPEED * delta;
        model.npc.x += moveX;
        model.npc.z += moveZ;
      }

      // Tail wag
      model.tailPhase += delta * (dist > 0.5 ? 5 : 2);

      // Idle bounce
      model.idleBounce = Math.sin(time * 2) * 0.015;
    }
  }

  // ---- Render ----

  private render(): void {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Clear
    const lighting = ZONE_LIGHT_MAP[this.zoneId] || ZONE_LIGHT_MAP.dog_park;
    ctx.fillStyle = lighting.skyColor;
    ctx.fillRect(0, 0, w, h);

    // Camera offset (center on player)
    const camX = this.playerX;
    const camZ = this.playerZ;

    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.scale(1, 1);
    ctx.translate(-camX, -camZ);

    // ---- Draw Ground ----
    ctx.fillStyle = this.zoneData.groundColor || '#4a7c3f';
    ctx.fillRect(-camX - w / 2, -camZ - h / 2, w, h);

    // Grass patches
    const grassMat = '#5a9c4f';
    ctx.fillStyle = grassMat;
    for (let i = 0; i < 50; i++) {
      // Deterministic pseudo-random positions
      const gx = ((i * 7919 + 3) % 300 - 150);
      const gz = ((i * 6271 + 7) % 300 - 150);
      const gw = 0.2 + (i % 3) * 0.1;
      const gh = 0.3 + (i % 4) * 0.1;
      ctx.fillRect(gx - gw / 2, gz - gh / 2, gw, gh);
    }

    // ---- Draw Obstacles ----
    for (const { obs, hitbox } of this.obstacleVisuals) {
      switch (obs.type) {
        case 'tree': {
          // Canopy
          ctx.fillStyle = obs.leafColor || '#2d5a1e';
          ctx.beginPath();
          ctx.arc(hitbox.x, hitbox.z, 0.8, 0, Math.PI * 2);
          ctx.fill();
          // Trunk
          ctx.fillStyle = obs.trunkColor || '#5a3a1a';
          ctx.fillRect(hitbox.x - 0.1, hitbox.z, 0.2, 0.5);
          break;
        }
        case 'fence': {
          ctx.fillStyle = obs.color || '#8B4513';
          // Posts
          const postCount = Math.max(2, Math.ceil((obs.width || 4) / 1.5));
          for (let p = 0; p <= postCount; p++) {
            const px = hitbox.x - (obs.width || 4) / 2 + p * ((obs.width || 4) / postCount);
            ctx.fillRect(px - 0.05, hitbox.z - 0.5, 0.1, 1.0);
          }
          // Rails
          ctx.fillRect(hitbox.x - (obs.width || 4) / 2, hitbox.z - 0.4, obs.width || 4, 0.08);
          ctx.fillRect(hitbox.x - (obs.width || 4) / 2, hitbox.z + 0.1, obs.width || 4, 0.08);
          break;
        }
        case 'bench': {
          ctx.fillStyle = obs.color || '#8B6914';
          // Seat
          ctx.fillRect(hitbox.x - (obs.width || 2) / 2, hitbox.z - 0.15, obs.width || 2, 0.15);
          // Legs
          ctx.fillStyle = '#3a3a3a';
          const legW = 0.06;
          const legH = 0.3;
          ctx.fillRect(hitbox.x - (obs.width || 2) / 2 + 0.15, hitbox.z - 0.15, legW, legH);
          ctx.fillRect(hitbox.x + (obs.width || 2) / 2 - 0.15 - legW, hitbox.z - 0.15, legW, legH);
          break;
        }
        case 'bush': {
          ctx.fillStyle = obs.color || '#2d6a1e';
          const sizes = [0.4, 0.3, 0.25];
          for (let s = 0; s < sizes.length; s++) {
            const ox = (Math.sin(s * 3.7) * 0.15);
            const oz = (Math.cos(s * 2.3) * 0.15);
            ctx.beginPath();
            ctx.arc(hitbox.x + ox, hitbox.z + oz, sizes[s], 0, Math.PI * 2);
            ctx.fill();
          }
          break;
        }
      }
    }

    // ---- Draw Features ----
    for (const [key, fInfo] of this.featureDraws) {
      const f = fInfo.feature;
      const glowPulse = 0.2 + 0.15 * Math.sin(this.glowTime * 3 + fInfo.glowPhase);

      // Glow ring for non-locked features
      if (!f.locked) {
        const ringRadius = Math.max(f.w, f.h) / 2 + 6 + (fInfo.isHovered ? 3 : 0) + Math.sin(this.glowTime * 2) * 2;
        ctx.beginPath();
        ctx.arc(f.x, f.z, ringRadius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(240, 192, 64, ${glowPulse})`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Hover highlight
      if (fInfo.isHovered) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.strokeRect(
          f.x - f.w / 2 - 4,
          f.z - f.h / 2 - 4,
          f.w + 8,
          f.h + 8,
        );
      }

      // Feature shape (reuse same logic as FP renderer)
      this.drawFeatureShape2D(ctx, f);

      // Label
      const labelY = f.z - Math.max(f.w, f.h) / 2 - 16;
      drawLabel(ctx, f.label, f.x, labelY, 11, f.locked ? '#ff4444' : '#f0c040');
    }

    // ---- Draw Scent Trail ----
    for (let i = 0; i < this.scentTrail.length; i++) {
      const p = this.scentTrail[i];
      const alpha = (i / this.scentTrail.length) * p.alpha;
      ctx.fillStyle = `rgba(255, 165, 0, ${alpha})`;
      ctx.beginPath();
      ctx.arc(p.x, p.z, 0.1 + alpha * 0.15, 0, Math.PI * 2);
      ctx.fill();
    }

    // ---- Draw NPCs ----
    for (const [id, model] of this.npcModels) {
      this.drawNPC(ctx, model.npc, model.tailPhase, model.idleBounce);
    }

    // ---- Draw Player ----
    this.drawPlayer2D(ctx);

    // ---- Draw Fog (radial gradient from player) ----
    const fogNear = 12;
    const fogFar = 35;
    const fogRadius = 20;
    const fogGrad = ctx.createRadialGradient(
      camX, camZ, fogNear,
      camX, camZ, fogRadius,
    );
    const fogColor = lighting.skyColor;
    fogGrad.addColorStop(0, hexToRgba(fogColor, 0));
    fogGrad.addColorStop(0.6, hexToRgba(fogColor, 0.2));
    fogGrad.addColorStop(1, hexToRgba(fogColor, 0.7));
    ctx.fillStyle = fogGrad;
    ctx.fillRect(
      camX - fogRadius,
      camZ - fogRadius,
      fogRadius * 2,
      fogRadius * 2,
    );

    // ---- Draw Lighting Overlay ----
    const sunIntensity = lighting.sunIntensity;
    const overlayAlpha = 0.03 + sunIntensity * 0.08;
    ctx.fillStyle = hexToRgba(lighting.sunColor, overlayAlpha);
    ctx.fillRect(
      camX - fogRadius,
      camZ - fogRadius,
      fogRadius * 2,
      fogRadius * 2,
    );

    ctx.restore();
  }

  /** Draw a feature shape (shared with FP renderer) */
  private drawFeatureShape2D(ctx: CanvasRenderingContext2D, feature: RoomFeatureExtended): void {
    const { x, z, w, h, type, locked } = feature;
    const color = locked ? '#ff4444' : '#f0c040';
    const opacity = locked ? 0.6 : 0.85;

    ctx.globalAlpha = opacity;
    ctx.fillStyle = color;

    switch (type) {
      case 'water_bowl':
        ctx.beginPath();
        ctx.arc(x, z, Math.max(w, h) / 2, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'fire_hydrant':
        ctx.beginPath();
        ctx.arc(x, z, Math.min(w, h) / 3, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'scent_post':
        ctx.fillRect(x - 0.05, z - h / 2, 0.1, h);
        ctx.beginPath();
        ctx.arc(x, z - h / 2, 0.12, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'treasure':
        ctx.beginPath();
        ctx.arc(x, z, Math.max(w, h) / 2, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'return_gate':
        // Two posts + arch
        ctx.fillRect(x - 0.3, z - 0.6, 0.06, 1.2);
        ctx.fillRect(x + 0.24, z - 0.6, 0.06, 1.2);
        ctx.beginPath();
        ctx.arc(x, z - 0.6, 0.3, Math.PI, 0);
        ctx.fill();
        break;
      case 'cave_entrance':
        ctx.fillRect(x - 0.5, z - 0.75, 0.3, 1.5);
        ctx.fillRect(x + 0.2, z - 0.75, 0.3, 1.5);
        ctx.fillRect(x - 0.5, z - 1.4, 1.0, 0.3);
        break;
      case 'water':
        ctx.beginPath();
        ctx.arc(x, z, Math.max(w, h) / 2, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'dog_show':
        ctx.beginPath();
        ctx.arc(x, z, Math.max(w, h) / 2, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'fountain':
        ctx.beginPath();
        ctx.arc(x, z, Math.max(w, h) / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x, z, Math.max(w, h) / 4, 0, Math.PI * 2);
        ctx.fillStyle = locked ? '#ff4444' : '#f0c040';
        ctx.fill();
        break;
      case 'lure':
        ctx.save();
        ctx.translate(x, z);
        ctx.beginPath();
        ctx.moveTo(0.1, 0);
        ctx.lineTo(-0.05, -0.08);
        ctx.lineTo(-0.05, 0.08);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        break;
      default:
        ctx.fillRect(x - w / 2, z - h / 2, w, h);
    }

    ctx.globalAlpha = 1;
  }

  /** Draw NPC dog (top-down) */
  private drawNPC(ctx: CanvasRenderingContext2D, npc: NPC, tailPhase: number, bounce: number): void {
    const color = npc.color || '#8B4513';
    const accent = npc.accentColor || '#D2691E';

    // Body
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(npc.x, npc.z + bounce, 0.5, 0.3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Head
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(npc.x + 0.4, npc.z + bounce, 0.2, 0, Math.PI * 2);
    ctx.fill();

    // Tail (wagging)
    const tailWag = Math.sin(tailPhase) * 0.3;
    ctx.strokeStyle = color;
    ctx.lineWidth = 0.06;
    ctx.beginPath();
    ctx.moveTo(npc.x - 0.4, npc.z + bounce);
    ctx.lineTo(npc.x - 0.7, npc.z + bounce + tailWag);
    ctx.stroke();
  }

  /** Draw player dog (top-down) */
  private drawPlayer2D(ctx: CanvasRenderingContext2D): void {
    const sx = this.playerX;
    const sy = this.playerZ;
    const color = this.zoneData.dogColor || '#d4a574';
    const accent = this.zoneData.accentColor || '#ff6b35';

    // Player glow
    const glowGrad = ctx.createRadialGradient(sx, sy, 0, sx, sy, PLAYER_RADIUS + 10);
    glowGrad.addColorStop(0, hexToRgba(color, 0.3));
    glowGrad.addColorStop(1, hexToRgba(color, 0));
    ctx.fillStyle = glowGrad;
    ctx.beginPath();
    ctx.arc(sx, sy, PLAYER_RADIUS + 10, 0, Math.PI * 2);
    ctx.fill();

    // Body
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(sx, sy, 0.5, 0.3, this.playerAngle, 0, Math.PI * 2);
    ctx.fill();

    // Head
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(
      sx + Math.cos(this.playerAngle) * 0.4,
      sy + Math.sin(this.playerAngle) * 0.4,
      0.2, 0, Math.PI * 2
    );
    ctx.fill();

    // Border
    ctx.strokeStyle = darkenHex(color, 0.7);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(sx, sy, 0.5, 0.3, this.playerAngle, 0, Math.PI * 2);
    ctx.stroke();

    // Direction indicator
    if (this.isMoving) {
      const len = 0.6;
      ctx.strokeStyle = '#ff9900';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(
        sx + Math.cos(this.playerAngle) * len,
        sy + Math.sin(this.playerAngle) * len,
      );
      ctx.stroke();
    }
  }

  // ---- Hover Detection ----

  private updateHover(mx: number, my: number): void {
    const worldX = mx;
    const worldZ = my;

    // Reset
    this.hoveredFeature = null;
    this.hoveredNpc = null;

    // Check features
    let closestDist = 50;
    for (const [key, fInfo] of this.featureDraws) {
      const f = fInfo.feature;
      const dx = worldX - f.x;
      const dz = worldZ - f.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      const halfW = f.w / 2 + 10;
      const halfH = f.h / 2 + 10;
      if (
        Math.abs(dx) < halfW &&
        Math.abs(dz) < halfH &&
        dist < closestDist
      ) {
        closestDist = dist;
        this.hoveredFeature = f;
      }
    }

    // Check NPCs
    for (const [id, model] of this.npcModels) {
      const dx = worldX - model.npc.x;
      const dz = worldZ - model.npc.z;
      if (Math.sqrt(dx * dx + dz * dz) < 15) {
        this.hoveredNpc = model.npc;
      }
    }

    // Update feature hover states
    for (const [key, fInfo] of this.featureDraws) {
      fInfo.isHovered = fInfo.feature === this.hoveredFeature;
    }

    this.canvas.style.cursor = (this.hoveredFeature || this.hoveredNpc) ? 'pointer' : 'default';
  }

  // ---- Public API ----

  setOnFeatureClick(fn: (type: string, data: any) => void): void {
    this.onFeatureClick = fn;
  }

  setOnNpcClick(fn: (npc: NPC) => void): void {
    this.onNpcClick = fn;
  }

  update(delta: number, time: number): void {
    // Handled in animate loop
  }

  resize(width: number, height: number): void {
    this.canvas.width = width;
    this.canvas.height = height;
  }

  getDogPosition(): { x: number; z: number } {
    return { x: this.playerX, z: this.playerZ };
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    if (this.animFrame !== null) {
      cancelAnimationFrame(this.animFrame);
      this.animFrame = null;
    }

    this.canvas.removeEventListener('click', this.boundClick!);
    this.canvas.removeEventListener('keydown', this.boundKeydown!);
    this.canvas.removeEventListener('keyup', this.boundKeyup!);

    this.npcModels.clear();
    this.obstacleHitboxes = [];
    this.obstacleVisuals = [];
    this.featureDraws.clear();
    this.scentTrail = [];
    this.keys.clear();

    if (this.happinessInterval) {
      window.clearInterval(this.happinessInterval);
      this.happinessInterval = null;
    }
  }
}

// ---- Shared Helper: draw label ----
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

  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(x - w / 2, y - h / 2, w, h);

  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
}
