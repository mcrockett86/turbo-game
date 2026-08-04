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

function buildRoomGeometry(room: Room): Group {
  const group = new Group();
  group.name = `room-${room.id}`;

  const hw = room.w / 2;
  const hd = room.d / 2;

  // Floor
  const floorGeo = new PlaneGeometry(room.w, room.d, FLOOR_SEGMENTS, FLOOR_SEGMENTS);
  floorGeo.rotateX(-Math.PI / 2);
  const floorMat = getOrCreateMaterial(0x555555);
  const floor = new Mesh(floorGeo, floorMat);
  floor.position.y = 0;
  floor.name = 'floor';
  group.add(floor);

  // Ceiling
  const ceilGeo = new PlaneGeometry(room.w, room.d, CEILING_SEGMENTS, CEILING_SEGMENTS);
  ceilGeo.rotateX(Math.PI / 2);
  const ceilMat = getOrCreateMaterial(0x333333);
  const ceiling = new Mesh(ceilGeo, ceilMat);
  ceiling.position.y = room.h;
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
    const wallW = cfg.axis === 'x' ? room.d : room.w;
    const wallH = room.h;

    const wallGeo = new PlaneGeometry(wallW, wallH, WALL_SEGMENTS, WALL_SEGMENTS);
    const wallColor = parseInt(room.color.replace('#', '0x'), 16);
    const wallMat = getOrCreateMaterial(wallColor);
    const wall = new Mesh(wallGeo, wallMat);
    wall.position[cfg.axis] = cfg.pos;
    wall.position.y = room.h / 2;
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

  // Door frame
  const doorW = 12;
  const doorH = room.h * 0.7;
  const doorGeo = new BoxGeometry(doorW, doorH, 1);
  const doorMat = getOrCreateMaterial(0x8a8a8a);
  const door = new Mesh(doorGeo, doorMat);

  // Position exit on the correct wall
  const hw = room.w / 2;
  const hd = room.d / 2;

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

  door.position.set(exitX, room.h / 2, exitZ);
  door.rotation.y = rotY;
  group.add(door);

  // Arrow marker above door
  const arrowGeo = new ConeGeometry(3, 5, 4);
  const arrowMat = new MeshStandardMaterial({
    color: 0x4ade80,
    emissive: 0x4ade80,
    emissiveIntensity: 0.6,
  });
  const arrow = new Mesh(arrowGeo, arrowMat);
  arrow.position.set(exitX, room.h - 2, exitZ);
  arrow.rotation.z = rotY;
  group.add(arrow);

  // Label
  const label = createLabel(`→ ${exitRoomId}`);
  label.position.set(exitX, room.h + 5, exitZ);
  group.add(label);

  return group;
}

// ---- Lighting Controller ----

function setupLighting(scene: Scene, room: Room): Group {
  const lightGroup = new Group();
  lightGroup.name = 'lights';

  // Ambient light
  const ambient = new AmbientLight(0xffffff, CONFIG.ambientIntensity);
  lightGroup.add(ambient);

  // Directional light (simulates a window/door)
  const dirLight = new DirectionalLight(0xffeedd, CONFIG.directionalIntensity);
  dirLight.position.set(room.w / 3, room.h, -room.d / 3);
  lightGroup.add(dirLight);

  // Point light near center (warm glow)
  const pointLight = new PointLight(0xf0c040, 0.5, room.w * 0.8);
  pointLight.position.set(0, room.h - 2, 0);
  lightGroup.add(pointLight);

  scene.add(lightGroup);
  return lightGroup;
}

// ---- Fog Setup ----

function setupFog(scene: Scene, near: number, far: number): void {
  scene.fog = new Fog(0x1a1a2e, near, far);
}

// ---- Camera Controller ----

class CameraController {
  private camera: PerspectiveCamera;
  private room: Room;
  private currentPos: Vector3;
  private targetPos: Vector3;
  private transitioning: boolean;
  private transitionStart: number;
  private startPos: Vector3;
  private endPos: Vector3;

  constructor(camera: PerspectiveCamera, room: Room, initialPos: Vector3) {
    this.camera = camera;
    this.room = room;
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
    const margin = 5;
    const minX = -this.room.w / 2 + margin;
    const maxX = this.room.w / 2 - margin;
    const minZ = -this.room.d / 2 + margin;
    const maxZ = this.room.d / 2 - margin;
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
  private raycaster: Raycaster;
  private mouse: Vector2;
  private hoveredFeature: RoomFeature | null = null;
  private onFeatureClick: ((feature: RoomFeature) => void) | null = null;
  private onExitClick: ((exitRoomId: string) => void) | null = null;
  private animationId: number | null = null;
  private lastFrameTime: number = 0;
  private canvas: HTMLCanvasElement;
  private glowTime: number = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.moveSpeed = CONFIG.fpMoveSpeed;
    this.raycaster = new Raycaster();
    this.mouse = new Vector2();
  }

  // ---- Initialization ----

  init(zoneId: string, zoneData: Zone, roomIndex: number): void {
    this.zoneId = zoneId;
    this.zoneData = zoneData;
    this.roomIndex = roomIndex;
    this.room = zoneData.rooms![roomIndex];

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
    this.renderer.setSize(this.canvas.width, this.canvas.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = false;

    // Camera controller
    const startPos = new Vector3(0, CONFIG.fpCameraHeight, 0);
    this.cameraController = new CameraController(this.camera, this.room, startPos);
    this.camera.position.copy(startPos);

    // Build room
    this.buildRoom();

    // Setup events
    this.setupEvents();

    // Start loop
    this.lastFrameTime = performance.now();
    this.animate();
  }

  private buildRoom(): void {
    // Room geometry
    this.roomGroup = buildRoomGeometry(this.room);
    this.scene.add(this.roomGroup);

    // Lighting
    this.lightGroup = setupLighting(this.scene, this.room);

    // Fog
    setupFog(this.scene, CONFIG.fpFogNear, CONFIG.fpFogFar);

    // Features
    const features = this.room.features || [];
    for (const feature of features) {
      const group = buildFeatureMarker(feature);
      this.featureGroups.set(feature.type, group);
      this.scene.add(group);
    }

    // Exits
    const exits = this.room.exits || [];
    for (const exitId of exits) {
      const group = buildExitMarker(exitId, this.room, this.roomIndex, this.zoneData);
      this.exitGroups.set(exitId, group);
      this.scene.add(group);
    }
  }

  private setupEvents(): void {
    this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
    this.canvas.addEventListener('click', (e) => this.onClick(e));
    window.addEventListener('keydown', (e) => this.onKeyDown(e));
    window.addEventListener('keyup', (e) => this.onKeyUp(e));
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

  dispose(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }

    window.removeEventListener('keydown', this.onKeyDown.bind(this));
    window.removeEventListener('keyup', this.onKeyUp.bind(this));

    this.canvas.removeEventListener('mousemove', this.onMouseMove.bind(this));
    this.canvas.removeEventListener('click', this.onClick.bind(this));

    this.renderer.dispose();
    this.featureGroups.clear();
    this.exitGroups.clear();
  }
}
