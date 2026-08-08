// ===== First-Person Room Renderer =====
// Renders rooms in Three.js with WASD movement, feature interaction,
// exit markers, fog, and lighting.

import {
  AmbientLight,
  BoxGeometry,
  CanvasTexture,
  ConeGeometry,
  DirectionalLight,
  Fog,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  PointLight,
  Raycaster,
  Scene,
  Sprite,
  SpriteMaterial,
  Vector2,
  Vector3,
  WebGLRenderer,
  Color,
} from 'three';

import { CONFIG } from '@/config';
import { State } from '@/engine/state';
import type { Room, RoomFeature, Zone } from '@/types';

// ---- Constants ----
const WALL_SEGMENTS = 1;
const FLOOR_SEGMENTS = 1;
const CEILING_SEGMENTS = 1;
const EXIT_MARKER_HEIGHT = 2;
const FEATURE_MARKER_HEIGHT = 3;
const HOVER_SCALE = 1.15;
const TRANSITION_DURATION = 600; // ms
const MIN_FPS = 30;

// ---- Material Cache ----
const materialCache = new Map<string, MeshStandardMaterial>();

function getOrCreateMaterial(color: number): MeshStandardMaterial {
  const key = color.toString(16);
  const cached = materialCache.get(key);
  if (cached) return cached;

  const mat = new MeshStandardMaterial({
    color,
    roughness: 0.8,
    metalness: 0.1,
    side: 2, // THREE.DoubleSide
  });
  materialCache.set(key, mat);
  return mat;
}

// ---- Room Geometry Builder ----

function buildRoomGeometry(room: Room, scaledW?: number, scaledH?: number, scaledD?: number): Group {
  const group = new Group();
  group.name = `room-${room.id}`;

  const w = scaledW || room.w;
  const h = scaledH || room.h;
  const d = scaledD || room.d;
  const hw = w / 2;
  const hd = d / 2;

  // Floor
  const floorGeo = new PlaneGeometry(w, d, FLOOR_SEGMENTS, FLOOR_SEGMENTS);
  floorGeo.rotateX(-Math.PI / 2);
  const floorMat = getOrCreateMaterial(0x555555);
  const floor = new Mesh(floorGeo, floorMat);
  floor.position.y = 0;
  floor.name = 'floor';
  group.add(floor);

  // Ceiling
  const ceilGeo = new PlaneGeometry(w, d, CEILING_SEGMENTS, CEILING_SEGMENTS);
  ceilGeo.rotateX(Math.PI / 2);
  const ceilMat = getOrCreateMaterial(0x333333);
  const ceiling = new Mesh(ceilGeo, ceilMat);
  ceiling.position.y = h;
  ceiling.name = 'ceiling';
  group.add(ceiling);

  // Walls
  const wallConfigs = [
    { axis: 'x' as const, pos: -hw, rotY: 0, label: 'wall_back' },
    { axis: 'x' as const, pos: hw, rotY: Math.PI, label: 'wall_front' },
    { axis: 'z' as const, pos: -hd, rotY: Math.PI / 2, label: 'wall_left' },
    { axis: 'z' as const, pos: hd, rotY: -Math.PI / 2, label: 'wall_right' },
  ];

  for (const cfg of wallConfigs) {
    const wallW = cfg.axis === 'x' ? d : w;
    const wallH = h;

    const wallGeo = new PlaneGeometry(wallW, wallH, WALL_SEGMENTS, WALL_SEGMENTS);
    const wallColor = parseInt(room.color.replace('#', '0x'), 16);
    const wallMat = getOrCreateMaterial(wallColor);
    const wall = new Mesh(wallGeo, wallMat);
    wall.position[cfg.axis] = cfg.pos;
    wall.position.y = h / 2;
    wall.rotation.y = cfg.rotY;
    wall.name = cfg.label;
    group.add(wall);
  }

  return group;
}

// ---- Feature Renderer ----

function buildFeatureMarker(feature: RoomFeature): Group {
  const group = new Group();
  group.name = `feature-${feature.type}`;
  group.userData = { feature };

  const markerGeo = new BoxGeometry(feature.w, feature.h, 0.5);
  const baseColor = feature.locked ? 0xff4444 : 0xf0c040;
  const markerMat = new MeshStandardMaterial({
    color: baseColor,
    emissive: baseColor,
    emissiveIntensity: feature.locked ? 0.2 : 0.5,
    transparent: true,
    opacity: feature.locked ? 0.6 : 0.85,
  });
  const marker = new Mesh(markerGeo, markerMat);
  marker.position.set(feature.x, feature.y, FEATURE_MARKER_HEIGHT);
  group.add(marker);

  // Label sprite
  const label = createLabel(feature.label);
  label.position.set(feature.x, feature.y + feature.h / 2 + 8, FEATURE_MARKER_HEIGHT);
  group.add(label);

  // Glow ring for non-locked features
  if (!feature.locked) {
    const ringGeo = new ConeGeometry(1, 0.1, 32);
    const ringMat = new MeshBasicMaterial({
      color: 0xf0c040,
      transparent: true,
      opacity: 0.3,
      side: 2, // THREE.DoubleSide
    });
    const ring = new Mesh(ringGeo, ringMat);
    ring.position.set(feature.x, feature.y, FEATURE_MARKER_HEIGHT + 0.3);
    ring.rotation.x = -Math.PI / 2;
    ring.name = 'glow-ring';
    group.add(ring);
  }

  return group;
}

function createLabel(text: string): Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, 256, 64);
  ctx.font = 'bold 24px Courier New';
  ctx.fillStyle = '#f0c040';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 32);

  const texture = new CanvasTexture(canvas);
  const mat = new SpriteMaterial({ map: texture, transparent: true });
  const sprite = new Sprite(mat);
  sprite.scale.set(12, 3, 1);
  return sprite;
}

// ---- Exit Renderer ----

function buildExitMarker(
  exitRoomId: string,
  room: Room,
  roomIndex: number,
  zoneData: Zone,
  scale: number = 1,
): Group {
  const zoneRooms = zoneData.rooms;
  const roomData = zoneRooms?.find(r => r.id === room.id);

  if (!roomData) return new Group();

  // Find the wall this exit is on
  const exits = roomData.exits;
  const exitIdx = exits.indexOf(exitRoomId);
  if (exitIdx === -1) return new Group();

  const group = new Group();
  group.name = `exit-${exitRoomId}`;
  group.userData = { exitRoomId, roomIndex };

  // Door frame (scaled)
  const doorW = 12 * scale;
  const doorH = 4 * scale;
  const doorGeo = new BoxGeometry(doorW, doorH, 1);
  const doorMat = getOrCreateMaterial(0x8a8a8a);
  const door = new Mesh(doorGeo, doorMat);

  // Position exit on the correct wall (scaled)
  const hw = (room.w * scale) / 2;
  const hd = (room.d * scale) / 2;

  // Simple heuristic: first exit goes up (north), others spread out
  let exitX = 0;
  let exitZ = -hd;
  let rotY = Math.PI / 2;

  if (exitIdx === 0) {
    // North wall
    exitZ = -hd;
    rotY = Math.PI / 2;
  } else if (exitIdx === 1) {
    // East wall
    exitX = hw;
    rotY = 0;
  } else if (exitIdx === 2) {
    // South wall
    exitZ = hd;
    rotY = -Math.PI / 2;
  } else {
    // West wall
    exitX = -hw;
    rotY = Math.PI;
  }

  door.position.set(exitX, doorH / 2, exitZ);
  door.rotation.y = rotY;
  group.add(door);

  // Arrow marker above door (scaled, positioned relative to door)
  const arrowGeo = new ConeGeometry(3 * scale, 5 * scale, 4);
  const arrowMat = new MeshStandardMaterial({
    color: 0x4ade80,
    emissive: 0x4ade80,
    emissiveIntensity: 0.6,
  });
  const arrow = new Mesh(arrowGeo, arrowMat);
  arrow.position.set(exitX, doorH + 3 * scale, exitZ);
  arrow.rotation.z = rotY;
  group.add(arrow);

  // Label (scaled)
  const label = createLabel(`→ ${exitRoomId}`);
  label.position.set(exitX, doorH + 6 * scale, exitZ);
  group.add(label);

  return group;
}

// ---- Lighting Controller ----

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

function setupLighting(scene: Scene, room: Room, zoneId: string = 'default', scaledW?: number, scaledH?: number, scaledD?: number): Group {
  const lightGroup = new Group();
  lightGroup.name = 'lights';

  const w = scaledW || room.w;
  const h = scaledH || room.h;
  const d = scaledD || room.d;

  const lighting = ZONE_LIGHTING[zoneId] || ZONE_LIGHTING.default;

  // Ambient light (colored per zone)
  const ambient = new AmbientLight(
    new Color(lighting.ambientColor),
    lighting.ambientIntensity,
  );
  lightGroup.add(ambient);

  // Directional light (simulates a window/door, color shifts with time-of-day)
  const tod = lighting.timeOfDay;
  const sunIntensity = Math.sin(tod * Math.PI);
  const dirColor = new Color(lighting.directionalColor).multiplyScalar(0.5 + sunIntensity * 0.5);
  const dirLight = new DirectionalLight(dirColor, CONFIG.directionalIntensity * sunIntensity + 0.2);
  dirLight.position.set(w / 3, h * sunIntensity + 2, -d / 3);
  lightGroup.add(dirLight);

  // Point light near center (warm glow, intensity varies)
  const pointIntensity = 0.3 + sunIntensity * 0.4;
  const pointLight = new PointLight(0xf0c040, pointIntensity, w * 0.8);
  pointLight.position.set(0, h * 0.7, 0);
  lightGroup.add(pointLight);

  scene.add(lightGroup);
  return lightGroup;
}

// ---- Fog Setup ----

function setupFog(scene: Scene, zoneId: string = 'default', roomW?: number, roomD?: number): void {
  const lighting = ZONE_LIGHTING[zoneId] || ZONE_LIGHTING.default;
  // Scale fog to room dimensions so visibility covers the playable area
  const baseFogFar = lighting.fogFar;
  const roomScale = (roomW && roomD) ? Math.max(roomW, roomD) / 200 : 1;
  const fogFar = baseFogFar * roomScale;
  const fogNear = lighting.fogNear * roomScale;
  scene.fog = new Fog(new Color(lighting.fogColor), fogNear, fogFar);
}

// ---- Camera Controller ----

class CameraController {
  private camera: PerspectiveCamera;
  private room: Room;
  private scaledW: number;
  private scaledD: number;
  private currentPos: Vector3;
  private targetPos: Vector3;
  private transitioning: boolean;
  private transitionStart: number;
  private startPos: Vector3;
  private endPos: Vector3;

  constructor(camera: PerspectiveCamera, room: Room, initialPos: Vector3, scaledW: number, scaledD: number) {
    this.camera = camera;
    this.room = room;
    this.scaledW = scaledW;
    this.scaledD = scaledD;
    this.currentPos = initialPos.clone();
    this.targetPos = initialPos.clone();
    this.transitioning = false;
    this.transitionStart = 0;
    this.startPos = new Vector3();
    this.endPos = new Vector3();
  }

  getPosition(): Vector3 {
    return this.currentPos.clone();
  }

  setPosition(x: number, y: number, z: number): void {
    this.currentPos.set(x, y, z);
    this.targetPos.set(x, y, z);
    this.camera.position.copy(this.currentPos);
  }

  clampPosition(x: number, z: number): { x: number; z: number } {
    const margin = 2;
    const minX = -this.scaledW / 2 + margin;
    const maxX = this.scaledW / 2 - margin;
    const minZ = -this.scaledD / 2 + margin;
    const maxZ = this.scaledD / 2 - margin;
    return {
      x: Math.max(minX, Math.min(maxX, x)),
      z: Math.max(minZ, Math.min(maxZ, z)),
    };
  }

  startTransition(target: Vector3): void {
    this.startPos.copy(this.currentPos);
    this.endPos.copy(target);
    this.transitioning = true;
    this.transitionStart = performance.now();
  }

  update(delta: number): void {
    if (this.transitioning) {
      const elapsed = performance.now() - this.transitionStart;
      const t = Math.min(1, elapsed / TRANSITION_DURATION);
      const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

      this.currentPos.lerpVectors(this.startPos, this.endPos, ease);
      this.camera.position.copy(this.currentPos);

      if (t >= 1) {
        this.transitioning = false;
        this.currentPos.copy(this.endPos);
      }
    }
  }
}

// ---- Main Renderer Class ----

export class FpRoomRenderer {
  private scene!: Scene;
  private camera!: PerspectiveCamera;
  private renderer!: WebGLRenderer;
  private cameraController!: CameraController;
  private room!: Room;
  private roomIndex!: number;
  private zoneId!: string;
  private zoneData!: Zone;
  private roomGroup: Group | null = null;
  private featureGroups: Map<string, Group> = new Map();
  private exitGroups: Map<string, Group> = new Map();
  private lightGroup: Group | null = null;
  private keys: Set<string> = new Set();
  private moveSpeed: number;
  private roomScale: number = 1.0; // Data units -> world units
  private raycaster: Raycaster;
  private mouse: Vector2;
  private hoveredFeature: RoomFeature | null = null;
  private onFeatureClick: ((feature: RoomFeature) => void) | null = null;
  private onExitClick: ((exitRoomId: string) => void) | null = null;
  private animationId: number | null = null;
  private lastFrameTime: number = 0;
  private canvas: HTMLCanvasElement;
  private glowTime: number = 0;
  private happinessTimer: number = 0;
  private happinessInterval: number | null = null;
  // Store bound listeners so dispose() can remove them
  private boundKeyDown: ((e: KeyboardEvent) => void) | null = null;
  private boundKeyUp: ((e: KeyboardEvent) => void) | null = null;
  private boundMouseMove: ((e: MouseEvent) => void) | null = null;
  private boundClick: ((e: MouseEvent) => void) | null = null;
  private disposed = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.moveSpeed = CONFIG.fpMoveSpeed;
    this.raycaster = new Raycaster();
    this.mouse = new Vector2();
  }

  // ---- Initialization ----

  init(zoneId: string, zoneData: Zone, roomIndex: number): void {
    if (this.disposed) return;
    console.log('[FP] init called:', zoneId, roomIndex);

    this.zoneId = zoneId;
    this.zoneData = zoneData;
    this.roomIndex = roomIndex;
    this.room = zoneData.rooms![roomIndex];
    console.log('[FP] Room:', this.room.id, this.room.w, 'x', this.room.h, 'x', this.room.d);

    // Scene
    this.scene = new Scene();
    this.scene.background = new Color(0x1a1a2e);

    // Camera
    const aspect = this.canvas.width / this.canvas.height;
    this.camera = new PerspectiveCamera(
      CONFIG.fpFOV,
      aspect,
      CONFIG.fpNear,
      CONFIG.fpFar,
    );

    // Renderer
    this.renderer = new WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: false,
    });

    // Verify WebGL context was created successfully
    const gl = (this.renderer as any).getContext();
    if (!gl) {
      console.error('[FP] WebGL context creation failed — canvas may not support WebGL');
      this.canvas.style.background = '#ff6b6b';
      this.canvas.style.display = 'flex';
      this.canvas.style.alignItems = 'center';
      this.canvas.style.justifyContent = 'center';
      // Create overlay text
      const overlay = document.createElement('div');
      overlay.style.color = '#fff';
      overlay.style.fontFamily = 'monospace';
      overlay.style.fontSize = '18px';
      overlay.style.textAlign = 'center';
      overlay.style.padding = '20px';
      overlay.innerHTML = '<strong>WebGL not available</strong><br>This browser does not support WebGL rendering.';
      this.canvas.parentElement?.appendChild(overlay);
      return;
    }

    this.renderer.setSize(this.canvas.width, this.canvas.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = false;

    // Camera controller (use scaled room dimensions for clamping)
    const s = this.roomScale;
    const sw = this.room.w * s;
    const sh = this.room.h * s;
    const sd = this.room.d * s;
    const cameraHeight = CONFIG.fpCameraHeight;
    const startPos = new Vector3(0, cameraHeight, 0);
    this.cameraController = new CameraController(this.camera, this.room, startPos, sw, sd);
    this.camera.position.copy(startPos);

    // Build room
    this.buildRoom();

    // Setup events
    this.setupEvents();

    // Start loop
    this.lastFrameTime = performance.now();
    console.log('[FP] Starting animate loop...');
    this.animate();
    console.log('[FP] Animate loop started');

    // Start happiness decay
    this.startHappinessDecay();
  }

  private buildRoom(): void {
    // Scale room geometry from data units to world units
    const s = this.roomScale;
    const sw = this.room.w * s;
    const sh = this.room.h * s;
    const sd = this.room.d * s;

    console.log('[FP] Building room with scale', s, '->', sw, 'x', sh, 'x', sd);
    // Room geometry (scaled)
    this.roomGroup = buildRoomGeometry(this.room, sw, sh, sd);
    this.scene.add(this.roomGroup);
    console.log('[FP] Room built:', this.roomGroup.children.length, 'children');

    // Lighting
    this.lightGroup = setupLighting(this.scene, this.room, this.zoneId, sw, sh, sd);

    // Fog (scale to room dimensions)
    setupFog(this.scene, this.zoneId, sw, sd);

    // Features (positions scaled)
    const features = this.room.features || [];
    for (const feature of features) {
      const scaledFeature = {
        ...feature,
        x: feature.x * s,
        y: feature.y * s,
        w: feature.w * s,
        h: feature.h * s,
      };
      const group = buildFeatureMarker(scaledFeature);
      this.featureGroups.set(feature.type, group);
      this.scene.add(group);
    }

    // Exits (positions scaled)
    const exits = this.room.exits || [];
    for (const exitId of exits) {
      const group = buildExitMarker(exitId, this.room, this.roomIndex, this.zoneData, s);
      this.exitGroups.set(exitId, group);
      this.scene.add(group);
    }
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

  private onMouseMove(event: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);

    // Check feature intersections
    const featureMeshes: Mesh[] = [];
    this.featureGroups.forEach(group => {
      group.traverse(child => {
        if (child instanceof Mesh) featureMeshes.push(child);
      });
    });

    const intersects = this.raycaster.intersectObjects(featureMeshes, false);
    const prevHovered = this.hoveredFeature;

    if (intersects.length > 0) {
      const hit = intersects[0].object.parent;
      if (hit && (hit as any).userData.feature) {
        this.hoveredFeature = (hit as any).userData.feature;
        this.canvas.style.cursor = 'pointer';

        // Hover effect: scale glow ring
        const ring = hit.getObjectByName('glow-ring');
        if (ring instanceof Mesh) {
          ring.scale.setScalar(HOVER_SCALE);
        }
        return;
      }
    }

    // No hover
    this.hoveredFeature = null;
    this.canvas.style.cursor = 'default';

    // Reset previous hover
    if (prevHovered) {
      const prevGroup = this.featureGroups.get(prevHovered.type);
      if (prevGroup) {
        const ring = prevGroup.getObjectByName('glow-ring');
        if (ring instanceof Mesh) {
          ring.scale.setScalar(1);
        }
      }
    }
  }

  private onClick(event: MouseEvent): void {
    if (!this.hoveredFeature) return;

    // Check if it's a feature click
    if (this.onFeatureClick) {
      this.onFeatureClick(this.hoveredFeature);
      return;
    }

    // Check exit clicks
    const rect = this.canvas.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);

    const exitMeshes: Mesh[] = [];
    this.exitGroups.forEach(group => {
      group.traverse(child => {
        if (child instanceof Mesh) exitMeshes.push(child);
      });
    });

    const intersects = this.raycaster.intersectObjects(exitMeshes, false);
    if (intersects.length > 0) {
      const hit = intersects[0].object.parent;
      if (hit && (hit as any).userData.exitRoomId && this.onExitClick) {
        this.onExitClick((hit as any).userData.exitRoomId);
      }
    }
  }

  private onKeyDown(event: KeyboardEvent): void {
    this.keys.add(event.key.toLowerCase());
  }

  private onKeyUp(event: KeyboardEvent): void {
    this.keys.delete(event.key.toLowerCase());
  }

  // ---- Movement ----

  private updateMovement(delta: number): void {
    const speed = this.moveSpeed * delta;
    let newX = this.cameraController.getPosition().x;
    let newZ = this.cameraController.getPosition().z;

    if (this.keys.has('w') || this.keys.has('arrowup')) newZ -= speed;
    if (this.keys.has('s') || this.keys.has('arrowdown')) newZ += speed;
    if (this.keys.has('a') || this.keys.has('arrowleft')) newX -= speed;
    if (this.keys.has('d') || this.keys.has('arrowright')) newX += speed;

    const clamped = this.cameraController.clampPosition(newX, newZ);
    this.cameraController.setPosition(clamped.x, CONFIG.fpCameraHeight, clamped.z);
  }

  // ---- Animation Loop ----

  private animate(): void {
    console.log('[FP] animate called');
    this.animationId = requestAnimationFrame(() => this.animate());

    const now = performance.now();
    const delta = Math.min((now - this.lastFrameTime) / 1000, 1 / MIN_FPS);
    this.lastFrameTime = now;

    // Update camera
    this.cameraController.update(delta);

    // Update movement
    this.updateMovement(delta);

    // Animate feature glow
    this.glowTime += delta;
    this.featureGroups.forEach(group => {
      const ring = group.getObjectByName('glow-ring');
      if (ring instanceof Mesh) {
        const pulse = 0.2 + 0.15 * Math.sin(this.glowTime * 3);
        (ring.material as MeshBasicMaterial).opacity = pulse;
        const scale = this.hoveredFeature && (group.userData as any).feature === this.hoveredFeature
          ? HOVER_SCALE
          : 1 + 0.05 * Math.sin(this.glowTime * 2);
        ring.scale.setScalar(scale);
      }
    });

    // Animate exit arrows
    this.exitGroups.forEach(group => {
      const arrow = group.children.find(c => c instanceof Mesh && c.geometry.type === 'ConeGeometry');
      if (arrow instanceof Mesh) {
        arrow.rotation.z += delta * 0.5;
        arrow.position.y = this.room.h - 2 + Math.sin(this.glowTime * 2) * 0.5;
      }
    });

    // Render
    this.renderer.render(this.scene, this.camera);
  }

  // ---- Public API ----

  setOnFeatureClick(cb: ((feature: RoomFeature) => void) | null): void {
    this.onFeatureClick = cb;
  }

  setOnExitClick(cb: ((exitRoomId: string) => void) | null): void {
    this.onExitClick = cb;
  }

  getCameraPosition(): { x: number; z: number } {
    const pos = this.cameraController.getPosition();
    return { x: pos.x, z: pos.z };
  }

  moveTo(x: number, z: number): void {
    const clamped = this.cameraController.clampPosition(x, z);
    const target = new Vector3(clamped.x, CONFIG.fpCameraHeight, clamped.z);
    this.cameraController.startTransition(target);
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

    this.renderer.dispose();
    this.featureGroups.clear();
    this.exitGroups.clear();

    // Clean up happiness decay timer
    if (this.happinessInterval) {
      window.clearInterval(this.happinessInterval);
      this.happinessInterval = null;
    }
  }
}
