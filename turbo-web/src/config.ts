// ===== Game Configuration =====

export const SAVE_SCHEMA_VERSION = 1;

// ---- Difficulty Scaling ----

export const DIFFICULTY_PRESETS = {
  easy: {
    name: 'Easy',
    happinessDecayPerSecond: 0.02,
    threatSpeedMultiplier: 0.7,
    threatTimeLimitMultiplier: 1.8,
    happinessDecayPerRoom: 0.5,
    dogTraitBonus: 1.3,
    companionHelpChance: 0.5,
    threatFailPenalty: -8,
    threatSuccessBonus: 8,
    comfortItemBonus: 1.5,
  },
  normal: {
    name: 'Normal',
    happinessDecayPerSecond: 0.05,
    threatSpeedMultiplier: 1.0,
    threatTimeLimitMultiplier: 1.0,
    happinessDecayPerRoom: 2,
    dogTraitBonus: 1.0,
    companionHelpChance: 0.25,
    threatFailPenalty: -15,
    threatSuccessBonus: 5,
    comfortItemBonus: 1.0,
  },
  hard: {
    name: 'Hard',
    happinessDecayPerSecond: 0.08,
    threatSpeedMultiplier: 1.2,
    threatTimeLimitMultiplier: 0.75,
    happinessDecayPerRoom: 3,
    dogTraitBonus: 0.9,
    companionHelpChance: 0.1,
    threatFailPenalty: -20,
    threatSuccessBonus: 3,
    comfortItemBonus: 0.8,
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
  // New fields for finer difficulty control
  threatFailPenalty: number;
  threatSuccessBonus: number;
  comfortItemBonus: number;
}

/** Default difficulty applied at game start. */
export const DEFAULT_DIFFICULTY: DifficultyKey = 'normal';

/** Dog trait modifiers — per-trait multiplier for gameplay effects.
 * Speed: threat evasion (timing/sneak threats easier)
 * Brave: combat threats easier, intimidation bonus
 * Happiness: comfort items more effective, slower decay
 * Sniff: find hidden items/threats faster, better route hints
 * Compact: inventory +1 slot, smaller hitbox for sneak threats */
export const DOG_TRAIT_MODIFIERS: Record<string, number> = {
  '🏃 Speed': 1.25,
  '🛡️ Brave': 1.2,
  '😊 Happiness': 1.15,
  '👃 Sniff': 1.3,
  '🎒 Compact': 1.1,
};

/** Which threat types each trait helps with (multiplier above). */
export const DOG_TRAIT_THREAT_BONUS: Record<string, string[]> = {
  '🏃 Speed': ['timing', 'sneak'],
  '🛡️ Brave': ['combat'],
  '😊 Happiness': ['comfort'],
  '👃 Sniff': ['timing', 'comfort'],
  '🎒 Compact': ['sneak', 'combat'],
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

  // FP movement
  fpMoveSpeed: 2.5,
  fpMaxRoomMove: 0.8,

  // TP movement
  tpMoveSpeed: 3,
  tpTurnSpeed: 0.04,

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
  happinessItemComfort: 12,
  happinessItemRare: 20,
  happinessItemStory: 15,

  // Inventory
  inventorySlots: 16,

  // Manga
  mangaTimer: 5,
  mangaComboLength: 4,

  // Audio
  masterVolume: 1.0,
  musicVolume: 0.7,
  sfxVolume: 0.8,

  // Colors (hex strings for Canvas 2D)
  colors: {
    sky: '#1a1a2e',
    ground: '#4a7a3a',
    wall: '#8a8a9a',
    floor: '#6a6a6a',
    highlight: '#f0c040',
    success: '#4ade80',
    danger: '#ff4444',
    ui: '#2a2a4a',
  },

  // Debug
  debug: false,
};
