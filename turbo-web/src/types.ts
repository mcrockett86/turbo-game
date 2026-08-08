// ===== Shared TypeScript Types for Turbo: Lost & Found =====

// ---- Dog ----
export interface Dog {
  id: string;
  name: string;
  breed: string;
  trait: string;
  traitDesc: string;
  colors: { fur: string[]; accent: string };
  personality: string[];
  lines: {
    intro: string;
    happy: string;
    scared: string;
    hint: string;
    combat: string;
    foundFriend: string;
  };
}

// ---- Room ----
export interface RoomFeature {
  type: 'traffic' | 'hint' | 'food' | 'door' | 'cat' | 'bully' | 'storm' | 'vacuum'
      | 'tv' | 'dog_friend' | 'person' | 'home' | 'choice' | 'tree_clue'
      | 'water' | 'pet_shop' | 'dog_show' | 'locked_door' | 'secret_passage'
      | 'lure' | 'bridge' | 'trap' | 'treasure_chest' | 'companion_trap'
      | 'music_box' | 'fountain' | 'mailbox' | 'fire_hydrant' | 'scent_post'
      | 'treasure' | 'water_bowl' | 'celebration' | 'return_gate' | 'cave_entrance';
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  item?: string;
  locked?: boolean;
}

export interface Room {
  id: string;
  name: string;
  w: number;
  h: number;
  d: number;
  color: string;
  exits: string[];
  features?: RoomFeature[];
  isEntrance?: boolean;
  entranceZone?: string;
  isHome?: boolean;
}

// ---- Zone ----
export interface Zone {
  id: string;
  name: string;
  desc: string;
  type: 'fp' | 'tp' | 'human';
  rooms?: Room[];
  music?: string;
  companions?: string[];
  hint?: string;
  skyColor?: string;
  groundColor?: string;
  dogColor?: string;
  accentColor?: string;
  obstacles?: Obstacle[];
  npcs?: NPC[];
  features?: RoomFeatureExtended[];
  returnZone?: string;
}

// ---- Item ----
export interface Item {
  id: string;
  name: string;
  desc: string;
}

// ---- Threat ----
export interface Threat {
  name: string;
  icon: string;
  type: 'timing' | 'combat' | 'comfort' | 'sneak';
  description: string;
  solve: string;
  mangaText: string;
  mangaType: 'near-miss' | 'fight' | 'scare';
}

// ---- NPC ----
export interface NPC {
  id: string;
  name: string;
  color: string;
  accentColor: string;
  x: number;
  z: number;
  dialogue?: string[];
}

// ---- Obstacle ----
export interface Obstacle {
  type: 'fence' | 'tree' | 'bench' | 'bush';
  x: number;
  z: number;
  width?: number;
  height?: number;
  color?: string;
  trunkColor?: string;
  leafColor?: string;
  rotation?: number;
}

// ---- ScentPoint ----
export interface ScentPoint {
  x: number;
  y: number;
  strength: number;
  timestamp: number;
}

// ---- RoomFeature (extended) ----
// Used for TP zone features which may use z instead of y and omit w/h.
// We re-declare y/w/h as optional to allow TP zone feature literals.
export interface RoomFeatureExtended {
  type: 'traffic' | 'hint' | 'food' | 'door' | 'cat' | 'bully' | 'storm' | 'vacuum'
      | 'tv' | 'dog_friend' | 'person' | 'home' | 'choice' | 'tree_clue'
      | 'water' | 'pet_shop' | 'dog_show' | 'locked_door' | 'secret_passage'
      | 'lure' | 'bridge' | 'trap' | 'treasure_chest' | 'companion_trap'
      | 'music_box' | 'fountain' | 'mailbox' | 'fire_hydrant' | 'scent_post'
      | 'treasure' | 'water_bowl' | 'celebration' | 'return_gate' | 'cave_entrance';
  x: number;
  y?: number; // optional — TP zones may use z instead
  w?: number; // optional — TP zones may omit
  h?: number; // optional — TP zones may omit
  z?: number; // TP zones use z instead of y
  label: string;
  id?: string;
  item?: string;
  locked?: boolean;
}

// ---- Zone (extended) ----
export interface ZoneExtended extends Zone {
  skyColor?: string;
  groundColor?: string;
  dogColor?: string;
  accentColor?: string;
  obstacles?: Obstacle[];
  npcs?: NPC[];
  features?: RoomFeatureExtended[];
}

// ---- Inventory Slot ----
export interface InventorySlot {
  item: Item | null;
  count: number;
}

// ---- Companion ----
export interface Companion {
  id: string;
  name: string;
  breed: string;
  trait: string;
  dialogue: string[];
  met?: boolean;
  active?: boolean;
  bonusActive?: boolean;
  bonusType?: string;
  position?: { x: number; z: number };
  color?: string;
  accentColor?: string;
}

// ---- GameState ----
export interface GameState {
  // Player
  selectedDog: string | null;
  currentDog: Dog | null;
  happiness: number; // 0-100

  // Progression
  currentZone: string | null;
  currentZoneIndex: number;
  currentRoom: string | null;
  currentRoomIndex: number;
  isHome: boolean;
  gamePhase: 'select' | 'playing' | 'transition' | 'manga' | 'gameover' | 'win';
  difficulty: 'easy' | 'normal' | 'hard';

  // Inventory
  inventory: InventorySlot[]; // max 16 slots

  // Companions
  companions: Companion[];
  activeCompanion: string | null;

  // Hints
  hintsUnlocked: string[];
  mapFragments: number;
  routeProgress: number; // 0-5 (number of zones completed)

  // Flags
  flags: Record<string, boolean>;

  // Combat
  threatActive: boolean;
  currentThreat: Threat | null;

  // Timing
  startTime: number;
  highScore: number;
}

// ---- Event Types ----
export type GameEvent =
  | { type: 'dog-selected'; dogId: string }
  | { type: 'zone-entered'; zoneId: string; zoneName: string; zoneDesc: string }
  | { type: 'room-entered'; roomId: string }
  | { type: 'item-collected'; itemId: string; itemName: string }
  | { type: 'item-used'; itemId: string }
  | { type: 'companion-met'; companion: Companion }
  | { type: 'companion-activated'; companionId: string }
  | { type: 'hint-unlocked'; hintId: string }
  | { type: 'threat-started'; threat: Threat }
  | { type: 'threat-resolved'; success: boolean }
  | { type: 'happiness-changed'; newHappiness: number; delta: number }
  | { type: 'dialogue-show'; text: string; speaker: string }
  | { type: 'dialogue-hide' }
  | { type: 'panel-toggle'; panel: string; open: boolean }
  | { type: 'transition-start'; zoneName: string; zoneDesc: string }
  | { type: 'transition-end' }
  | { type: 'hud-update'; dogName: string; happiness: number }
  | { type: 'difficulty-changed'; difficulty: string }
  | { type: 'game-over' }
  | { type: 'game-win'; score: number; time: number; companions: number; items: number };

// ---- Manga Cutaway State ----
export interface MangaState {
  active: boolean;
  text: string;
  mangaType: 'near-miss' | 'fight' | 'scare';
  threatName: string;
  comboSequence: number[]; // button press sequence for combat
  comboIndex: number;
  timer: number; // countdown seconds
}

// ---- Three.js Scene State ----
export interface SceneState {
  scene: any; // THREE.Scene
  camera: any; // THREE.PerspectiveCamera or THREE.OrthographicCamera
  renderer: any; // THREE.WebGLRenderer
  clock: any; // THREE.Clock
  controls: any;
}

// ---- Room 3D State ----
export interface Room3DState {
  scene: any;
  camera: any;
  renderer: any;
  walls: any[];
  floor: any;
  ceiling: any;
  exits: any[]; // exit markers
  features: any[]; // interactive feature markers
  lights: any[];
  currentRoomId: string;
  playerPos: { x: number; z: number };
  moveSpeed: number;
  keys: Set<string>;
  raycaster: any; // THREE.Raycaster
  mouse: any; // { x: number; y: number }
  hoveredFeature: RoomFeature | null;
}

// ---- TP Zone State ----
export interface TPZoneState {
  scene: any;
  camera: any;
  renderer: any;
  clock: any;
  dog: any; // THREE.Group (dog model)
  obstacles: any[]; // THREE.Mesh[]
  npcs: any[]; // THREE.Group[] (companion NPCs)
  items: any[]; // THREE.Group[] (ground items)
  playerPos: { x: number; z: number };
  playerVel: { x: number; z: number };
  moveSpeed: number;
  keys: Set<string>;
  cameraOffset: { x: number; y: number; z: number };
  cameraAngle: number;
  cameraDist: number;
}

// ---- Human View State ----
export interface HumanViewState {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  mapScale: number;
  scentMarkers: { x: number; y: number; radius: number; alpha: number }[];
  knownAreas: { x: number; y: number; w: number; h: number }[];
  scentsRemaining: number;
  maxScents: number;
  timer: number;
  isPlaying: boolean;
}
