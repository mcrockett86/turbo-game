/**
 * TP Adventure Renderer — Phase 2.2
 *
 * Third-person open-world renderer for the dog park zone.
 * Renders a procedural dog model, WASD movement, obstacles, NPCs,
 * scent trails, and environmental interaction.
 *
 * Architecture:
 * - TPEngine: main class, owns scene/camera/renderer
 * - DogModel: procedural 3D dog built from primitives
 * - NPCManager: spawns/manages NPC dog models
 * - ObstacleManager: spawns/manages obstacles (fences, trees, etc.)
 * - ScentTrail: visual scent trail behind the dog
 * - CameraController: smooth follow camera
 */

import * as THREE from 'three';
import { CONFIG } from '@/config';
import type { Zone, Room, NPC, Obstacle, ScentPoint, RoomFeatureExtended } from '@/types';

// ---- Constants ----
const NPC_SPEED = 0.8;
const OBSTACLE_HEIGHT = 1.5;
const NPC_CHANGE_INTERVAL = 4000;
const SMAX_DIST = 12;

// ---- Dog Model Builder (Upgraded) ----
class DogModel {
  private group: THREE.Group;
  private bodyMesh: THREE.Mesh;
  private headMesh: THREE.Mesh;
  private tailGroup: THREE.Group;
  private earL: THREE.Mesh;
  private earR: THREE.Mesh;
  private legPositions: { base: THREE.Vector3; mesh: THREE.Mesh }[] = [];
  private snoutMesh!: THREE.Mesh;
  private noseMesh!: THREE.Mesh;
  private eyeL!: THREE.Mesh;
  private eyeR!: THREE.Mesh;
  private collarMesh!: THREE.Mesh;
  private tongueMesh!: THREE.Mesh;
  private eyeHighlightL!: THREE.Mesh;
  private eyeHighlightR!: THREE.Mesh;
  private breathOffset: number = 0;
  private isHappy: boolean = false;
  private tailSpeed: number = 5;
  private idleBobPhase: number = 0;

  constructor(color: string, accentColor: string) {
    this.group = new THREE.Group();
    this.group.name = 'dog_model';

    const furColor = new THREE.Color(color);
    const accent = new THREE.Color(accentColor);

    // Body — rounded with breathing
    const bodyGeo = new THREE.BoxGeometry(1.2, 0.7, 0.6, 2, 2, 2);
    // Round the body vertices slightly
    const pos = bodyGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      const len = Math.sqrt(x * x + y * y + z * z);
      if (len > 0) {
        const target = 0.65;
        const factor = 0.7 + 0.3 * (target / (len || 1));
        pos.setX(i, x * factor);
        pos.setY(i, y * factor);
        pos.setZ(i, z * factor);
      }
    }
    bodyGeo.computeVertexNormals();
    const bodyMat = new THREE.MeshStandardMaterial({
      color: furColor,
      roughness: 0.7,
      metalness: 0.05,
    });
    this.bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    this.bodyMesh.position.set(0, 0.55, 0);
    this.bodyMesh.castShadow = true;
    this.group.add(this.bodyMesh);

    // Head
    const headGeo = new THREE.BoxGeometry(0.4, 0.4, 0.35);
    const headMat = new THREE.MeshStandardMaterial({
      color: furColor,
      roughness: 0.8,
      metalness: 0.05,
    });
    this.headMesh = new THREE.Mesh(headGeo, headMat);
    this.headMesh.position.set(0.7, 0.85, 0);
    this.headMesh.castShadow = true;
    this.group.add(this.headMesh);

    // Snout
    const snoutGeo = new THREE.BoxGeometry(0.2, 0.15, 0.2);
    const snoutMat = new THREE.MeshStandardMaterial({
      color: accent,
      roughness: 0.8,
    });
    const snout = new THREE.Mesh(snoutGeo, snoutMat);
    snout.position.set(0.95, 0.75, 0);
    this.group.add(snout);

    // Nose
    const noseGeo = new THREE.SphereGeometry(0.04, 8, 8);
    const noseMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a });
    const nose = new THREE.Mesh(noseGeo, noseMat);
    nose.position.set(1.05, 0.78, 0);
    this.group.add(nose);

    // Eyes with highlights
    const eyeGeo = new THREE.SphereGeometry(0.04, 8, 8);
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x2a1a0a });
    this.eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    this.eyeL.position.set(0.72, 0.95, 0.12);
    this.group.add(this.eyeL);
    this.eyeR = new THREE.Mesh(eyeGeo, eyeMat);
    this.eyeR.position.set(0.72, 0.95, -0.12);
    this.group.add(this.eyeR);

    // Eye highlights (catchlight)
    const hlGeo = new THREE.SphereGeometry(0.015, 6, 6);
    const hlMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.eyeHighlightL = new THREE.Mesh(hlGeo, hlMat);
    this.eyeHighlightL.position.set(0.73, 0.96, 0.14);
    this.group.add(this.eyeHighlightL);
    this.eyeHighlightR = new THREE.Mesh(hlGeo, hlMat);
    this.eyeHighlightR.position.set(0.73, 0.96, -0.1);
    this.group.add(this.eyeHighlightR);

    // Ears
    const earGeo = new THREE.BoxGeometry(0.12, 0.25, 0.08);
    const earMat = new THREE.MeshStandardMaterial({
      color: accent,
      roughness: 0.8,
    });
    this.earL = new THREE.Mesh(earGeo, earMat);
    this.earL.position.set(0.65, 1.1, 0.12);
    this.earL.rotation.z = -0.3;
    this.group.add(this.earL);
    this.earR = new THREE.Mesh(earGeo, earMat);
    this.earR.position.set(0.65, 1.1, -0.12);
    this.earR.rotation.z = 0.3;
    this.group.add(this.earR);

    // Tail (group for animation)
    this.tailGroup = new THREE.Group();
    this.tailGroup.position.set(-0.6, 0.75, 0);
    const tailGeo = new THREE.BoxGeometry(0.5, 0.08, 0.08);
    const tailMat = new THREE.MeshStandardMaterial({
      color: furColor,
      roughness: 0.8,
    });
    const tailMesh = new THREE.Mesh(tailGeo, tailMat);
    tailMesh.position.set(0.25, 0, 0);
    this.tailGroup.add(tailMesh);
    this.group.add(this.tailGroup);

    // Legs
    const legGeo = new THREE.BoxGeometry(0.12, 0.4, 0.12);
    const legMat = new THREE.MeshStandardMaterial({
      color: furColor,
      roughness: 0.8,
    });
    const legPositions = [
      { x: 0.35, z: 0.2 },
      { x: 0.35, z: -0.2 },
      { x: -0.35, z: 0.2 },
      { x: -0.35, z: -0.2 },
    ];
    for (const pos of legPositions) {
      const mesh = new THREE.Mesh(legGeo, legMat);
      mesh.position.set(pos.x, 0.2, pos.z);
      mesh.castShadow = true;
      this.group.add(mesh);
      this.legPositions.push({ base: new THREE.Vector3(pos.x, 0.2, pos.z), mesh });
    }

    // Collar
    const collarGeo = new THREE.TorusGeometry(0.22, 0.03, 8, 16);
    const collarMat = new THREE.MeshStandardMaterial({
      color: accent,
      roughness: 0.4,
      metalness: 0.3,
    });
    const collar = new THREE.Mesh(collarGeo, collarMat);
    collar.position.set(0.55, 0.65, 0);
    collar.rotation.y = Math.PI / 2;
    this.group.add(collar);

    // Tongue (for happy state)
    const tongueGeo = new THREE.SphereGeometry(0.06, 6, 6);
    tongueGeo.scale(1, 0.5, 0.7);
    const tongueMat = new THREE.MeshStandardMaterial({
      color: 0xff6b8a,
      roughness: 0.6,
    });
    this.tongueMesh = new THREE.Mesh(tongueGeo, tongueMat);
    this.tongueMesh.position.set(0.95, 0.65, 0);
    this.tongueMesh.visible = false;
    this.group.add(this.tongueMesh);
  }

  getGroup(): THREE.Group {
    return this.group;
  }

  setDirection(angle: number): void {
    this.group.rotation.y = angle;
  }

  animateTail(speed: number, time: number): void {
    const wag = Math.sin(time * speed) * 0.4;
    this.tailGroup.rotation.y = wag;
    this.earL.rotation.z = -0.3 + Math.sin(time * speed * 0.7) * 0.05;
    this.earR.rotation.z = 0.3 - Math.sin(time * speed * 0.7) * 0.05;
  }

  setIdleBob(time: number): void {
    this.idleBobPhase = time * 1.5;
    this.group.position.y = Math.sin(this.idleBobPhase) * 0.02;
  }

  setHappy(happy: boolean): void {
    this.isHappy = happy;
    this.tongueMesh.visible = happy;
    // Brighten eyes when happy
    if (happy) {
      this.eyeHighlightL.visible = true;
      this.eyeHighlightR.visible = true;
    } else {
      this.eyeHighlightL.visible = false;
      this.eyeHighlightR.visible = false;
    }
  }

  animateLegs(walkTime: number, isMoving: boolean): void {
    const speed = isMoving ? 8 : 0;
    for (let i = 0; i < this.legPositions.length; i++) {
      const phase = (i % 2 === 0) ? 0 : Math.PI;
      const swing = isMoving ? Math.sin(walkTime * speed + phase) * 0.3 : 0;
      this.legPositions[i].mesh.position.y = this.legPositions[i].base.y + Math.abs(swing) * 0.05;
      this.legPositions[i].mesh.rotation.x = swing;
    }
  }
}

// ---- NPC Model ----
class NPCModel {
  private group: THREE.Group;
  private tailGroup: THREE.Group;
  private walkTime: number;
  private targetPos: THREE.Vector3;
  private wanderTimer: number;
  private idleBounce: number = 0;

  constructor(color: string, accentColor: string) {
    this.walkTime = 0;
    this.wanderTimer = 0;
    this.targetPos = new THREE.Vector3(
      (Math.random() - 0.5) * 10,
      0,
      (Math.random() - 0.5) * 10,
    );

    this.group = new THREE.Group();

    const furColor = new THREE.Color(color);
    const accent = new THREE.Color(accentColor);

    // Body
    const bodyGeo = new THREE.BoxGeometry(1.0, 0.6, 0.5);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: furColor,
      roughness: 0.8,
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.5;
    body.castShadow = true;
    this.group.add(body);

    // Head
    const headGeo = new THREE.BoxGeometry(0.35, 0.35, 0.3);
    const headMat = new THREE.MeshStandardMaterial({
      color: furColor,
      roughness: 0.8,
    });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.set(0.55, 0.8, 0);
    head.castShadow = true;
    this.group.add(head);

    // Tail
    this.tailGroup = new THREE.Group();
    this.tailGroup.position.set(-0.5, 0.65, 0);
    const tailGeo = new THREE.BoxGeometry(0.4, 0.06, 0.06);
    const tailMat = new THREE.MeshStandardMaterial({ color: furColor });
    const tailMesh = new THREE.Mesh(tailGeo, tailMat);
    tailMesh.position.set(0.2, 0, 0);
    this.tailGroup.add(tailMesh);
    this.group.add(this.tailGroup);

    // Legs
    const legGeo = new THREE.BoxGeometry(0.1, 0.35, 0.1);
    const legMat = new THREE.MeshStandardMaterial({ color: furColor });
    const positions = [
      { x: 0.3, z: 0.15 },
      { x: 0.3, z: -0.15 },
      { x: -0.3, z: 0.15 },
      { x: -0.3, z: -0.15 },
    ];
    for (const p of positions) {
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.set(p.x, 0.175, p.z);
      leg.castShadow = true;
      this.group.add(leg);
    }

    this.setTarget(this.targetPos);
  }

  getGroup(): THREE.Group {
    return this.group;
  }

  setTarget(pos: THREE.Vector3): void {
    this.targetPos = pos.clone();
    const dir = new THREE.Vector3().subVectors(pos, this.group.position);
    if (dir.length() > 0.1) {
      this.group.rotation.y = Math.atan2(dir.x, dir.z);
    }
  }

  update(time: number, delta: number): void {
    this.walkTime += delta;
    this.wanderTimer += delta;

    // Wander
    const dist = this.group.position.distanceTo(this.targetPos);
    if (dist < 0.5 || this.wanderTimer > NPC_CHANGE_INTERVAL / 1000) {
      this.targetPos.set(
        (Math.random() - 0.5) * 14,
        0,
        (Math.random() - 0.5) * 14,
      );
      this.wanderTimer = 0;
    }

    // Move toward target
    if (dist > 0.3) {
      const dir = new THREE.Vector3().subVectors(this.targetPos, this.group.position).normalize();
      this.group.position.x += dir.x * NPC_SPEED * delta;
      this.group.position.z += dir.z * NPC_SPEED * delta;
    }

    // Tail wag (faster when moving)
    const wagSpeed = dist > 0.5 ? 5 : 2;
    const wagAmp = dist > 0.5 ? 0.3 : 0.15;
    this.tailGroup.rotation.y = Math.sin(time * wagSpeed) * wagAmp;

    // Idle bounce
    this.idleBounce = Math.sin(time * 2) * 0.015;
    this.group.position.y = this.idleBounce;
  }
}

// ---- Obstacle Builder ----
class ObstacleBuilder {
  static createFence(w: number, h: number, color: string): THREE.Group {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(color),
      roughness: 0.9,
    });

    // Posts
    const postGeo = new THREE.BoxGeometry(0.15, h, 0.15);
    const postCount = Math.max(2, Math.ceil(w / 2));
    for (let i = 0; i <= postCount; i++) {
      const post = new THREE.Mesh(postGeo, mat);
      post.position.set(-w / 2 + i * (w / postCount), h / 2, 0);
      post.castShadow = true;
      group.add(post);
    }

    // Rails
    const railGeo = new THREE.BoxGeometry(w, 0.1, 0.08);
    for (const yPos of [h * 0.33, h * 0.66]) {
      const rail = new THREE.Mesh(railGeo, mat);
      rail.position.y = yPos;
      group.add(rail);
    }

    group.userData.type = 'fence';
    group.userData.hitbox = { w, h, d: 0.1 };
    return group;
  }

  static createTree(height: number, trunkColor: string, leafColor: string): THREE.Group {
    const group = new THREE.Group();

    // Trunk
    const trunkGeo = new THREE.CylinderGeometry(0.15, 0.2, height * 0.4, 8);
    const trunkMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(trunkColor),
      roughness: 0.95,
    });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = height * 0.2;
    trunk.castShadow = true;
    group.add(trunk);

    // Leaves (layered spheres)
    const leafMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(leafColor),
      roughness: 0.8,
    });
    const leafLayers = [
      { r: 0.8, y: height * 0.6 },
      { r: 0.6, y: height * 0.8 },
      { r: 0.4, y: height },
    ];
    for (const l of leafLayers) {
      const geo = new THREE.SphereGeometry(l.r, 8, 6);
      const mesh = new THREE.Mesh(geo, leafMat);
      mesh.position.y = l.y;
      mesh.castShadow = true;
      group.add(mesh);
    }

    group.userData.type = 'tree';
    group.userData.hitbox = { r: 0.3, h: height };
    return group;
  }

  static createBench(w: number, color: string): THREE.Group {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(color),
      roughness: 0.85,
    });

    // Seat
    const seatGeo = new THREE.BoxGeometry(w, 0.08, 0.5);
    const seat = new THREE.Mesh(seatGeo, mat);
    seat.position.y = 0.4;
    group.add(seat);

    // Legs
    const legGeo = new THREE.BoxGeometry(0.08, 0.4, 0.08);
    const legMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a });
    const positions = [
      { x: -w / 2 + 0.2, z: -0.2 },
      { x: -w / 2 + 0.2, z: 0.2 },
      { x: w / 2 - 0.2, z: -0.2 },
      { x: w / 2 - 0.2, z: 0.2 },
    ];
    for (const p of positions) {
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.set(p.x, 0.2, p.z);
      group.add(leg);
    }

    group.userData.type = 'bench';
    group.userData.hitbox = { w: w - 0.2, h: 0.4, d: 0.4 };
    return group;
  }
}

// ---- Scent Trail ----
class ScentTrail {
  private points: THREE.Vector3[] = [];
  private maxPoints: number;
  private lastPos: THREE.Vector3;
  private group: THREE.Group;

  constructor(maxPoints: number) {
    this.maxPoints = maxPoints;
    this.lastPos = new THREE.Vector3();
    this.group = new THREE.Group();
    this.group.name = 'scent_trail';
  }

  addPoint(pos: THREE.Vector3): void {
    if (this.points.length === 0) {
      this.lastPos.copy(pos);
    }

    const dist = pos.distanceTo(this.lastPos);
    if (dist < 0.3) return; // Only add when moved enough

    this.points.push(pos.clone());
    if (this.points.length > this.maxPoints) {
      this.points.shift();
    }
    this.lastPos.copy(pos);
    this.updateVisuals();
  }

  private updateVisuals(): void {
    // Clear old particles
    while (this.group.children.length > 0) {
      const child = this.group.children[0];
      this.group.remove(child);
      (child as any).geometry?.dispose();
    }

    const particleGeo = new THREE.SphereGeometry(0.05, 4, 4);
    for (let i = 0; i < this.points.length; i++) {
      const alpha = (i / this.points.length) * 0.6;
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffa500,
        transparent: true,
        opacity: alpha,
      });
      const particle = new THREE.Mesh(particleGeo, mat);
      particle.position.copy(this.points[i]);
      particle.position.y += 0.1;
      this.group.add(particle);
    }
  }

  getGroup(): THREE.Group {
    return this.group;
  }

  clear(): void {
    this.points = [];
    this.lastPos.set(0, 0, 0);
  }
}

// ---- Camera Controller ----
class FollowCameraController {
  private camera: THREE.PerspectiveCamera;
  private target: THREE.Vector3;
  private offset: THREE.Vector3;
  private currentPos: THREE.Vector3;
  private smoothFactor: number;

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera;
    this.target = new THREE.Vector3();
    this.offset = new THREE.Vector3(0, 4, 6); // Behind and above
    this.currentPos = new THREE.Vector3();
    this.smoothFactor = 0.08;
  }

  setTarget(pos: THREE.Vector3): void {
    this.target.copy(pos);
  }

  update(delta: number): void {
    const desiredPos = new THREE.Vector3().copy(this.target).add(this.offset);
    this.currentPos.lerp(desiredPos, this.smoothFactor + delta * 2);
    this.camera.position.copy(this.currentPos);
    this.camera.lookAt(this.target.x, this.target.y + 0.5, this.target.z);
  }

  setPosition(x: number, y: number, z: number): void {
    this.currentPos.set(x, y, z);
    this.target.set(x, 0, z);
  }
}

// ---- Main TP Engine ----
export class TpEngine {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private cameraController: FollowCameraController;
  private dogModel: DogModel | null = null;
  private scentTrail: ScentTrail | null = null;
  private npcManager: NPCManager;
  private obstacleManager: ObstacleManager;
  private zoneId!: string;
  private zoneData!: Zone;
  private clock: THREE.Clock;
  private keys: Set<string>;
  private moveSpeed: number;
  private animFrame: number | null = null;
  private onFeatureClick: ((type: string, data: any) => void) | null = null;
  private onNpcClick: ((npc: NPC) => void) | null = null;
  private canvasEl: HTMLCanvasElement;
  private raycaster: THREE.Raycaster;
  private mouse: THREE.Vector2;
  private isPaused: boolean;
  private happiness: number;

  constructor(canvas: HTMLCanvasElement) {
    this.canvasEl = canvas;
    this.clock = new THREE.Clock();
    this.keys = new Set();
    this.moveSpeed = CONFIG.tpMoveSpeed;
    this.isPaused = false;
    this.happiness = 50;
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87CEEB);
    this.scene.fog = new THREE.Fog(0x87CEEB, 15, 40);

    // Camera
    this.camera = new THREE.PerspectiveCamera(
      60,
      canvas.width / canvas.height,
      0.1,
      100,
    );
    this.camera.position.set(0, 5, 8);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvasEl,
      antialias: true,
    });
    this.renderer.setSize(canvas.width, canvas.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Camera controller
    this.cameraController = new FollowCameraController(this.camera);

    // NPC manager
    this.npcManager = new NPCManager();

    // Obstacle manager
    this.obstacleManager = new ObstacleManager();
  }

  /** Initialize the zone */
  init(zoneId: string, zoneData: Zone): void {
    this.zoneId = zoneId;
    this.zoneData = zoneData;
    this.clear();
    this.buildZone();
  }

  /** Clear previous state */
  clear(): void {
    // Clear scene objects
    const toRemove: THREE.Object3D[] = [];
    this.scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.Group) {
        toRemove.push(obj);
      }
    });
    for (const obj of toRemove) {
      this.scene.remove(obj);
      obj.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          (child as any).geometry?.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => m.dispose());
          } else if (child.material) {
            child.material.dispose();
          }
        }
      });
    }

    // Remove lights
    const lights: THREE.Light[] = [];
    this.scene.traverse((obj) => {
      if (obj instanceof THREE.Light) lights.push(obj);
    });
    for (const light of lights) {
      this.scene.remove(light);
      light.dispose();
    }

    this.npcManager.clear();
    this.obstacleManager.clear();
    this.dogModel = null;
    this.scentTrail = null;
    this.cameraController.setPosition(0, 5, 8);
  }

  /** Build the zone environment */
  private buildZone(): void {
    const bgColor = this.zoneData.skyColor || '#87CEEB';
    this.scene.background = new THREE.Color(bgColor);

    // Zone-aware fog density
    const fogDensity = this.getFogDensity();
    this.scene.fog = new THREE.Fog(new THREE.Color(bgColor), fogDensity.near, fogDensity.far);

    // Ground
    const groundGeo = new THREE.PlaneGeometry(30, 30, 10, 10);
    const groundMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(this.zoneData.groundColor || '#4a7c3f'),
      roughness: 0.95,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Grass patches (small green planes)
    const grassMat = new THREE.MeshStandardMaterial({
      color: 0x5a9c4f,
      roughness: 1.0,
    });
    for (let i = 0; i < 50; i++) {
      const grassGeo = new THREE.PlaneGeometry(0.3, 0.5);
      const grass = new THREE.Mesh(grassGeo, grassMat);
      grass.rotation.x = -Math.PI / 2;
      grass.position.set(
        (Math.random() - 0.5) * 20,
        0.01,
        (Math.random() - 0.5) * 20,
      );
      this.scene.add(grass);
    }

    // Zone-aware lighting
    const lighting = this.getZoneLighting();
    const ambient = new THREE.AmbientLight(
      new THREE.Color(lighting.ambientColor),
      lighting.ambientIntensity,
    );
    this.scene.add(ambient);

    const sunIntensity = lighting.sunIntensity;
    const sunColor = new THREE.Color(lighting.sunColor).multiplyScalar(sunIntensity);
    const sun = new THREE.DirectionalLight(sunColor, 0.5 + sunIntensity * 0.5);
    sun.position.set(10, 15 * sunIntensity + 5, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 50;
    sun.shadow.camera.left = -15;
    sun.shadow.camera.right = 15;
    sun.shadow.camera.top = 15;
    sun.shadow.camera.bottom = -15;
    this.scene.add(sun);

    // Colored hemisphere light for atmosphere
    const hemiLight = new THREE.HemisphereLight(
      new THREE.Color(lighting.skyColor),
      new THREE.Color(lighting.groundColor),
      0.3,
    );
    this.scene.add(hemiLight);

    // Build obstacles from zone data
    if (this.zoneData.obstacles) {
      for (const obs of this.zoneData.obstacles) {
        const mesh = this.createObstacle(obs);
        if (mesh) {
          this.scene.add(mesh);
          this.obstacleManager.add(mesh);
        }
      }
    }

    // Build NPCs from zone data
    if (this.zoneData.npcs) {
      for (const npcData of this.zoneData.npcs) {
        const npc = this.npcManager.spawn(npcData);
        this.scene.add(npc.getGroup() as any);
      }
    }

    // Build features from zone data
    if (this.zoneData.features) {
      for (const feature of this.zoneData.features) {
        this.createFeature(feature);
      }
    }

    // Player dog
    const dogColor = this.zoneData.dogColor || '#d4a574';
    const accentColor = this.zoneData.accentColor || '#ff6b35';
    this.dogModel = new DogModel(dogColor, accentColor);
    this.scene.add(this.dogModel.getGroup());

    this.scentTrail = new ScentTrail(30);
    this.scene.add(this.scentTrail.getGroup());

    // Camera target
    this.cameraController.setTarget(new THREE.Vector3(0, 0, 0));

    // Setup click handler
    this.setupClickHandler();
  }

  /** Create a visual obstacle from data */
  private createObstacle(obs: Obstacle): THREE.Object3D | null {
    switch (obs.type) {
      case 'fence': {
        const mesh = ObstacleBuilder.createFence(
          obs.width || 4,
          obs.height || OBSTACLE_HEIGHT,
          obs.color || '#8B4513',
        );
        mesh.position.set(obs.x || 0, 0, obs.z || 0);
        if (obs.rotation) mesh.rotation.y = obs.rotation;
        return mesh as any;
      }
      case 'tree': {
        const mesh = ObstacleBuilder.createTree(
          obs.height || 3,
          obs.trunkColor || '#5a3a1a',
          obs.leafColor || '#2d5a1e',
        );
        mesh.position.set(obs.x || 0, 0, obs.z || 0);
        return mesh as any;
      }
      case 'bench': {
        const mesh = ObstacleBuilder.createBench(
          obs.width || 2,
          obs.color || '#8B6914',
        );
        mesh.position.set(obs.x || 0, 0, obs.z || 0);
        if (obs.rotation) mesh.rotation.y = obs.rotation;
        return mesh as any;
      }
      case 'bush': {
        const group = new THREE.Group();
        const bushMat = new THREE.MeshStandardMaterial({
          color: new THREE.Color(obs.color || '#2d6a1e'),
          roughness: 0.9,
        });
        const sizes = [0.5, 0.4, 0.3];
        for (const s of sizes) {
          const geo = new THREE.SphereGeometry(s, 8, 6);
          const mesh = new THREE.Mesh(geo, bushMat);
          mesh.position.set(
            (Math.random() - 0.5) * 0.3,
            s * 0.6,
            (Math.random() - 0.5) * 0.3,
          );
          mesh.castShadow = true;
          group.add(mesh);
        }
        group.position.set(obs.x || 0, 0, obs.z || 0);
        group.userData.type = 'bush';
        group.userData.hitbox = { r: 0.5, h: 0.5 };
        return group;
      }
      default:
        return null;
    }
  }

  /** Get fog density for current zone */
  private getFogDensity(): { near: number; far: number } {
    const zoneFogMap: Record<string, { near: number; far: number }> = {
      dog_park: { near: 12, far: 35 },
      apartment: { near: 8, far: 22 },
      shelter: { near: 10, far: 28 },
      neighborhood: { near: 15, far: 40 },
      home: { near: 14, far: 38 },
    };
    return zoneFogMap[this.zoneId] || { near: 15, far: 40 };
  }

  /** Get zone-aware lighting configuration */
  private getZoneLighting(): {
    ambientColor: string;
    ambientIntensity: number;
    sunColor: string;
    sunIntensity: number;
    skyColor: string;
    groundColor: string;
  } {
    interface ZoneLight {
      ambientColor: string;
      ambientIntensity: number;
      sunColor: string;
      sunIntensity: number;
      skyColor: string;
      groundColor: string;
    }
    const zoneLightMap: Record<string, ZoneLight> = {
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
    };
    return zoneLightMap[this.zoneId] || zoneLightMap.dog_park;
  }

  /** Create a visual feature from data */
  private createFeature(feature: any): void {
    const markerGroup = new THREE.Group();
    markerGroup.position.set(feature.x, 0, feature.z);
    markerGroup.userData = { type: 'feature', featureId: feature.id };

    switch (feature.type) {
      case 'water_bowl': {
        // Bowl base
        const bowlGeo = new THREE.CylinderGeometry(0.3, 0.2, 0.2, 16);
        const bowlMat = new THREE.MeshStandardMaterial({
          color: 0xcc3333,
          roughness: 0.3,
          metalness: 0.6,
        });
        const bowl = new THREE.Mesh(bowlGeo, bowlMat);
        bowl.position.y = 0.1;
        markerGroup.add(bowl);

        // Water
        const waterGeo = new THREE.CylinderGeometry(0.25, 0.25, 0.02, 16);
        const waterMat = new THREE.MeshStandardMaterial({
          color: 0x4488ff,
          roughness: 0.1,
          metalness: 0.8,
          transparent: true,
          opacity: 0.7,
        });
        const water = new THREE.Mesh(waterGeo, waterMat);
        water.position.y = 0.18;
        markerGroup.add(water);
        break;
      }
      case 'fire_hydrant': {
        const hydrantGeo = new THREE.CylinderGeometry(0.15, 0.18, 0.6, 8);
        const hydrantMat = new THREE.MeshStandardMaterial({
          color: 0xff0000,
          roughness: 0.4,
          metalness: 0.5,
        });
        const hydrant = new THREE.Mesh(hydrantGeo, hydrantMat);
        hydrant.position.y = 0.3;
        hydrant.castShadow = true;
        markerGroup.add(hydrant);

        // Top cap
        const capGeo = new THREE.SphereGeometry(0.16, 8, 6);
        const cap = new THREE.Mesh(capGeo, hydrantMat);
        cap.position.y = 0.65;
        markerGroup.add(cap);
        break;
      }
      case 'scent_post': {
        const postGeo = new THREE.CylinderGeometry(0.08, 0.1, 1.0, 8);
        const postMat = new THREE.MeshStandardMaterial({
          color: 0x8B6914,
          roughness: 0.9,
        });
        const post = new THREE.Mesh(postGeo, postMat);
        post.position.y = 0.5;
        markerGroup.add(post);

        // Glowing top
        const glowGeo = new THREE.SphereGeometry(0.12, 8, 8);
        const glowMat = new THREE.MeshBasicMaterial({
          color: 0xffa500,
          transparent: true,
          opacity: 0.6,
        });
        const glow = new THREE.Mesh(glowGeo, glowMat);
        glow.position.y = 1.05;
        markerGroup.add(glow);
        break;
      }
      case 'treasure': {
        // Glowing orb
        const orbGeo = new THREE.SphereGeometry(0.2, 16, 16);
        const orbMat = new THREE.MeshStandardMaterial({
          color: 0xffd700,
          emissive: 0xffa500,
          emissiveIntensity: 0.5,
          roughness: 0.1,
          metalness: 0.8,
        });
        const orb = new THREE.Mesh(orbGeo, orbMat);
        orb.position.y = 0.5;
        markerGroup.add(orb);

        // Glow ring
        const ringGeo = new THREE.TorusGeometry(0.3, 0.03, 8, 32);
        const ringMat = new THREE.MeshBasicMaterial({
          color: 0xffd700,
          transparent: true,
          opacity: 0.4,
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.y = 0.5;
        ring.rotation.x = Math.PI / 2;
        markerGroup.add(ring);
        break;
      }
      case 'path': {
        // Path marker (flat circle on ground)
        const pathGeo = new THREE.CircleGeometry(0.4, 16);
        const pathMat = new THREE.MeshStandardMaterial({
          color: 0xc4a35a,
          roughness: 1.0,
        });
        const pathMesh = new THREE.Mesh(pathGeo, pathMat);
        pathMesh.rotation.x = -Math.PI / 2;
        pathMesh.position.y = 0.02;
        markerGroup.add(pathMesh);
        break;
      }
      default:
        // Generic marker
        const geo = new THREE.BoxGeometry(0.3, 0.3, 0.3);
        const mat = new THREE.MeshStandardMaterial({
          color: 0x888888,
          roughness: 0.5,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.y = 0.15;
        markerGroup.add(mesh);
    }

    this.scene.add(markerGroup);
  }

  /** Setup click handler for features/NPCs */
  private setupClickHandler(): void {
    this.canvasEl.addEventListener('click', (event) => {
      if (this.isPaused) return;

      const rect = this.canvasEl.getBoundingClientRect();
      this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      this.raycaster.setFromCamera(this.mouse, this.camera);

      // Check feature clicks
      const featureGroups: THREE.Object3D[] = [];
      this.scene.traverse((obj) => {
        if (obj instanceof THREE.Group && obj.userData.type === 'feature') {
          featureGroups.push(obj);
        }
      });

      const featureIntersects = this.raycaster.intersectObjects(featureGroups, true);
      if (featureIntersects.length > 0) {
        let target = featureIntersects[0].object;
        while (target && target.userData.type !== 'feature') {
          target = target.parent as any;
        }
        if (target && target.userData.featureId) {
          const featureId = target.userData.featureId;
          const feature = this.zoneData.features?.find((f: any) => f.id === featureId);
          if (feature) {
            this.onFeatureClick?.(feature.type, feature);
          }
        }
        return;
      }

      // Check NPC clicks
      const npcGroups = this.npcManager.getAllGroups();
      const npcIntersects = this.raycaster.intersectObjects(npcGroups, true);
      if (npcIntersects.length > 0) {
        let target = npcIntersects[0].object;
        while (target && !target.userData?.npcId) {
          target = target.parent as any;
        }
        if (target?.userData?.npcId) {
          const npc = this.npcManager.getById(target.userData.npcId);
          if (npc) {
            this.onNpcClick?.(npc);
          }
        }
      }
    });
  }

  /** Handle keyboard input */
  onKeyDown(key: string): void {
    this.keys.add(key.toLowerCase());
  }

  onKeyUp(key: string): void {
    this.keys.delete(key.toLowerCase());
  }

  /** Update game state */
  update(delta: number, time: number): void {
    if (this.isPaused || !this.dogModel) return;

    // Movement
    const moveDir = new THREE.Vector3(0, 0, 0);
    if (this.keys.has('w') || this.keys.has('arrowup')) moveDir.z -= 1;
    if (this.keys.has('s') || this.keys.has('arrowdown')) moveDir.z += 1;
    if (this.keys.has('a') || this.keys.has('arrowleft')) moveDir.x -= 1;
    if (this.keys.has('d') || this.keys.has('arrowright')) moveDir.x += 1;

    const isMoving = moveDir.length() > 0;
    if (isMoving) {
      moveDir.normalize();

      // Camera-relative movement
      const camDir = new THREE.Vector3();
      this.camera.getWorldDirection(camDir);
      camDir.y = 0;
      camDir.normalize();

      const camRight = new THREE.Vector3();
      camRight.crossVectors(camDir, new THREE.Vector3(0, 1, 0));

      const worldMove = new THREE.Vector3();
      worldMove.addScaledVector(camDir, -moveDir.z);
      worldMove.addScaledVector(camRight, moveDir.x);
      worldMove.normalize();

      // Check obstacle collision
      const newPos = new THREE.Vector3().copy(this.dogModel.getGroup().position);
      newPos.x += worldMove.x * this.moveSpeed * delta;
      newPos.z += worldMove.z * this.moveSpeed * delta;

      // Clamp to bounds
      newPos.x = Math.max(-14, Math.min(14, newPos.x));
      newPos.z = Math.max(-14, Math.min(14, newPos.z));

      // Obstacle collision
      let blocked = false;
      for (const obs of this.obstacleManager.getAll()) {
        const hitbox = obs.userData.hitbox;
        if (!hitbox) continue;

        if ('r' in hitbox) {
          const dist = new THREE.Vector2(
            newPos.x - obs.position.x,
            newPos.z - obs.position.z,
          ).length();
          if (dist < hitbox.r + 0.4) {
            blocked = true;
            break;
          }
        } else if ('w' in hitbox) {
          const hw = hitbox.w / 2 + 0.4;
          const hd = hitbox.d / 2 + 0.4;
          if (
            newPos.x > obs.position.x - hw &&
            newPos.x < obs.position.x + hw &&
            newPos.z > obs.position.z - hd &&
            newPos.z < obs.position.z + hd
          ) {
            blocked = true;
            break;
          }
        }
      }

      if (!blocked) {
        this.dogModel.getGroup().position.copy(newPos);
      }

      // Face movement direction
      const angle = Math.atan2(worldMove.x, worldMove.z);
      this.dogModel.setDirection(angle);
    }

    // Animate dog
    this.dogModel.animateTail(5, time);
    this.dogModel.animateLegs(time, isMoving);
    this.dogModel.setIdleBob(time);
    // Toggle happy when near a feature
    const dogPos = this.dogModel.getGroup().position;
    let nearFeature = false;
    if (this.zoneData.features) {
      for (const f of this.zoneData.features) {
        const dx = dogPos.x - f.x;
        const dz = dogPos.z - f.z;
        if (Math.sqrt(dx * dx + dz * dz) < 1.5) {
          nearFeature = true;
          break;
        }
      }
    }
    this.dogModel.setHappy(nearFeature);

    // Scent trail
    if (isMoving && this.scentTrail) {
      this.scentTrail.addPoint(this.dogModel.getGroup().position.clone());
    }

    // Update NPCs
    this.npcManager.update(time, delta);

    // Update camera
    this.cameraController.setTarget(this.dogModel.getGroup().position);
    this.cameraController.update(delta);
  }

  /** Pause/resume */
  setPaused(paused: boolean): void {
    this.isPaused = paused;
  }

  /** Get dog position */
  getDogPosition(): THREE.Vector3 {
    return this.dogModel?.getGroup().position.clone() ?? new THREE.Vector3();
  }

  /** Get dog model */
  getDogModel(): DogModel | null {
    return this.dogModel;
  }

  /** Get renderer */
  getRenderer(): THREE.WebGLRenderer {
    return this.renderer;
  }

  /** Get scene */
  getScene(): THREE.Scene {
    return this.scene;
  }

  /** Resize */
  resize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  /** Dispose */
  dispose(): void {
    this.canvasEl.removeEventListener('click', this.setupClickHandler.bind(this) as any);
    this.renderer.dispose();
    this.npcManager.clear();
    this.obstacleManager.clear();
  }

  // ---- Callbacks ----
  setOnFeatureClick(fn: (type: string, data: any) => void): void {
    this.onFeatureClick = fn;
  }

  setOnNpcClick(fn: (npc: NPC) => void): void {
    this.onNpcClick = fn;
  }
}

// ---- NPC Manager ----
class NPCManager {
  private npcs: Map<string, NPC> = new Map();
  private models: Map<string, NPCModel> = new Map();

  spawn(npcData: NPC): THREE.Group {
    const model = new NPCModel(npcData.color || '#8B4513', npcData.accentColor || '#D2691E');
    model.getGroup().userData.npcId = npcData.id;
    model.getGroup().position.set(npcData.x || 0, 0, npcData.z || 0);
    this.npcs.set(npcData.id, npcData);
    this.models.set(npcData.id, model);
    return model.getGroup();
  }

  update(time: number, delta: number): void {
    for (const [id, model] of this.models) {
      model.update(time, delta);
    }
  }

  getAllGroups(): THREE.Object3D[] {
    return Array.from(this.models.values()).map((m) => m.getGroup());
  }

  getById(id: string): NPC | undefined {
    return this.npcs.get(id);
  }

  clear(): void {
    this.npcs.clear();
    this.models.clear();
  }
}

// ---- Obstacle Manager ----
class ObstacleManager {
  private obstacles: THREE.Object3D[] = [];

  add(obstacle: THREE.Object3D): void {
    this.obstacles.push(obstacle);
  }

  getAll(): THREE.Object3D[] {
    return this.obstacles;
  }

  clear(): void {
    this.obstacles = [];
  }
}
