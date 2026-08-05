// ===== Game Configuration =====

export const SAVE_SCHEMA_VERSION = 1;

// ---- Difficulty Scaling ----

export const DIFFICULTY_PRESETS = {
  easy: {
    name: 'Easy',
    happinessDecayPerSecond: 0.03,
    threatSpeedMultiplier: 0.8,
    threatTimeLimitMultiplier: 1.5,
    happinessDecayPerRoom: 1,
    dogTraitBonus: 1.2,
    companionHelpChance: 0.4,
  },
  normal: {
    name: 'Normal',
    happinessDecayPerSecond: 0.05,
    threatSpeedMultiplier: 1.0,
    threatTimeLimitMultiplier: 1.0,
    happinessDecayPerRoom: 2,
    dogTraitBonus: 1.0,
    companionHelpChance: 0.25,
  },
  hard: {
    name: 'Hard',
    happinessDecayPerSecond: 0.08,
    threatSpeedMultiplier: 1.3,
    threatTimeLimitMultiplier: 0.7,
    happinessDecayPerRoom: 3,
    dogTraitBonus: 0.8,
    companionHelpChance: 0.1,
  },
} as const;

export type DifficultyKey = keyof typeof DIFFICULTY_PRESETS;

export interface DifficultyConfig {
  name: string;
  happinessDecayPerSecond: number;
  threatSpeedMultiplier: number;
  threatTimeLimitMultiplier: number;
  happinessDecayPerRoom: number;
  dogTraitBonus: number;
  companionHelpChance: number;
}

/** Default difficulty applied at game start. */
export const DEFAULT_DIFFICULTY: DifficultyKey = 'normal';

/** Dog trait modifiers — per-trait multiplier for gameplay effects. */
export const DOG_TRAIT_MODIFIERS: Record<string, number> = {
  '🏃 Speed': 1.2,
  '🛡️ Brave': 1.15,
  '😊 Happiness': 1.1,
  '👃 Sniff': 1.25,
  '🎒 Compact': 1.05,
};

/** Base companion auto-help chance per difficulty level. */
export const COMPANION_HELP_CHANCE: Record<DifficultyKey, number> = {
  easy: 0.4,
  normal: 0.25,
  hard: 0.1,
};

export const CONFIG = {
  // Canvas sizes
  canvasWidth: 1280,
  canvasHeight: 720,

  // FP camera
  fpFOV: 60,
  fpNear: 0.1,
  fpFar: 500,
  fpCameraHeight: 30, // dog eye height

  // FP movement
  fpMoveSpeed: 2.5,
  fpMaxRoomMove: 0.8, // fraction of room width/depth

  // TP camera
  tpCameraOffset: { x: 0, y: 45, z: 35 },
  tpCameraAngle: 0,
  tpCameraDist: 50,
  tpMoveSpeed: 3,
  tpTurnSpeed: 0.04,

  // Dog model
  dogBodyWidth: 8,
  dogBodyHeight: 6,
  dogBodyDepth: 12,
  dogHeadSize: 5,
  dogTailLength: 6,
  dogEarSize: 3,

  // Happiness
  happinessMax: 100,
  happinessMin: 0,
  happinessDecayPerRoom: 2,
  happinessDecayPerSecond: 0.05,
  happinessThreatFail: -15,
  happinessThreatSuccess: 5,
  happinessItemTreat: 10,
  happinessItemToy: 5,
  happinessItemFriend: 8,

  // Inventory
  inventorySlots: 16,

  // Manga cutaway
  mangaTimer: 5, // seconds for combo mini-game
  mangaComboLength: 4, // number of button presses needed

  // Audio
  masterVolume: 1.0,
  musicVolume: 0.7,
  sfxVolume: 0.8,

  // Lighting
  ambientIntensity: 0.4,
  directionalIntensity: 0.8,

  // Fog
  fpFogNear: 100,
  fpFogFar: 400,
  tpFogNear: 150,
  tpFogFar: 500,

  // Zone progression
  zones: ['suburban_streets', 'dog_park', 'apartment', 'shelter', 'neighborhood'],
  homes: ['neighborhood'],

  // Colors
  colors: {
    sky: 0x1a1a2e,
    ground: 0x4a7a3a,
    wall: 0x8a8a9a,
    floor: 0x6a6a6a,
    highlight: 0xf0c040,
    success: 0x4ade80,
    danger: 0xff4444,
    ui: 0x2a2a4a,
  },

  // Debug
  debug: false,
};
