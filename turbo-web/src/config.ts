// ===== Game Configuration =====

export const SAVE_SCHEMA_VERSION = 1;

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
