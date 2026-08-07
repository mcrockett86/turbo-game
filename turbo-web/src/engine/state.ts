// ===== Game State Manager =====
// Central state management with pub/sub events

import { CONFIG, SAVE_SCHEMA_VERSION, DEFAULT_DIFFICULTY, DIFFICULTY_PRESETS, DOG_TRAIT_MODIFIERS, DOG_TRAIT_THREAT_BONUS, COMPANION_HELP_CHANCE, type DifficultyKey, type DifficultyConfig } from '@/config';
import type {
  GameState, GameEvent, Room, Companion, Threat,
} from '@/types';

// ---- Default State ----
function createDefaultState(): GameState {
  return {
    selectedDog: null,
    currentDog: null,
    happiness: 80,

    currentZone: null,
    currentZoneIndex: 0,
    currentRoom: null,
    currentRoomIndex: 0,
    isHome: false,
    gamePhase: 'select',
    difficulty: DEFAULT_DIFFICULTY as DifficultyKey,

    inventory: Array(CONFIG.inventorySlots).fill(null).map(() => ({ item: null, count: 0 })),

    companions: [],
    activeCompanion: null,

    hintsUnlocked: [],
    mapFragments: 0,
    routeProgress: 0,

    flags: {},

    threatActive: false,
    currentThreat: null,

    startTime: Date.now(),
    highScore: 0,
  };
}

// ---- Event Callbacks ----
type EventCallback = (event: GameEvent) => void;
export const listeners = new Map<string, Set<EventCallback>>();

function emit(event: GameEvent): void {
  const set = listeners.get(event.type);
  if (set) {
    set.forEach(cb => cb(event));
  }
}

function on(type: string, cb: EventCallback): void {
  if (!listeners.has(type)) listeners.set(type, new Set());
  listeners.get(type)!.add(cb);
}

function off(type: string, cb: EventCallback): void {
  const set = listeners.get(type);
  if (set) set.delete(cb);
}

// ---- State Transitions ----
function selectDog(dogId: string, dogData: any): void {
  State.state.selectedDog = dogId;
  State.state.currentDog = dogData;
  State.state.gamePhase = 'playing';
  State.state.startTime = Date.now();
  emit({ type: 'dog-selected', dogId });
}

function enterZone(zoneId: string, zoneData: any): void {
  State.state.currentZone = zoneId;
  State.state.currentZoneIndex = CONFIG.zones.indexOf(zoneId);
  State.state.gamePhase = 'playing';
  emit({
    type: 'zone-entered',
    zoneId,
    zoneName: zoneData.name,
    zoneDesc: zoneData.desc,
  });
}

function enterRoom(roomId: string, roomIndex: number): void {
  State.state.currentRoom = roomId;
  State.state.currentRoomIndex = roomIndex;
  emit({ type: 'room-entered', roomId });

  // Happiness decay for entering a new room (difficulty-scaled)
  const diff = getDifficultyConfig();
  const decay = diff.happinessDecayPerRoom;
  State.state.happiness = Math.max(0, State.state.happiness - decay);
  emit({
    type: 'happiness-changed',
    newHappiness: State.state.happiness,
    delta: -decay,
  });
}

function collectItem(itemId: string, itemName: string): boolean {
  // Find empty slot or increment existing
  for (const slot of State.state.inventory) {
    if (slot.item === itemId) {
      slot.count++;
      emit({ type: 'item-collected', itemId, itemName });
      return true;
    }
  }
  // Find empty slot
  for (const slot of State.state.inventory) {
    if (slot.item === null) {
      slot.item = itemId;
      slot.count = 1;
      emit({ type: 'item-collected', itemId, itemName });
      return true;
    }
  }
  return false; // inventory full
}

function useItem(itemId: string): boolean {
  const slot = State.state.inventory.find(s => s.item === itemId);
  if (!slot || slot.count <= 0) return false;

  slot.count--;
  if (slot.count <= 0) slot.item = null;

  // Apply item effects (difficulty-scaled via comfortItemBonus)
  const diff = getDifficultyConfig();
  const comfortBonus = diff.comfortItemBonus;

  switch (itemId) {
    case 'treat':
      State.state.happiness = Math.min(CONFIG.happinessMax, State.state.happiness + Math.round(CONFIG.happinessItemTreat * comfortBonus));
      break;
    case 'toy':
      State.state.happiness = Math.min(CONFIG.happinessMax, State.state.happiness + Math.round(CONFIG.happinessItemToy * comfortBonus));
      break;
    case 'map_fragment':
      State.state.mapFragments++;
      break;
    case 'key':
      State.state.flags['hasKey'] = true;
      break;
    // New item categories
    case 'warm_blanket':
    case 'favorite_toy':
    case 'blanket':
      State.state.happiness = Math.min(CONFIG.happinessMax, State.state.happiness + Math.round(CONFIG.happinessItemComfort * comfortBonus));
      break;
    case 'golden_treat':
    case 'diamond_bone':
    case 'magic_bone':
      State.state.happiness = Math.min(CONFIG.happinessMax, State.state.happiness + Math.round(CONFIG.happinessItemRare * comfortBonus));
      break;
    case 'home_photo':
    case 'letter':
    case 'diary_page':
      State.state.happiness = Math.min(CONFIG.happinessMax, State.state.happiness + Math.round(CONFIG.happinessItemStory * comfortBonus));
      break;
  }

  emit({ type: 'item-used', itemId });
  return true;
}

function meetCompanion(companion: Companion): void {
  if (!State.state.companions.find(c => c.id === companion.id)) {
    State.state.companions.push(companion);
    emit({ type: 'companion-met', companion });
  }
}

function activateCompanion(companionId: string): void {
  State.state.activeCompanion = companionId;
  emit({ type: 'companion-activated', companionId });
}

function unlockHint(hintId: string): void {
  if (!State.state.hintsUnlocked.includes(hintId)) {
    State.state.hintsUnlocked.push(hintId);
    State.state.routeProgress = Math.min(5, State.state.hintsUnlocked.length);
    emit({ type: 'hint-unlocked', hintId });
  }
}

function startThreat(threat: Threat): void {
  State.state.threatActive = true;
  State.state.currentThreat = threat;
  emit({ type: 'threat-started', threat });
}

function resolveThreat(success: boolean): void {
  const diff = getDifficultyConfig();
  let delta = success ? diff.threatSuccessBonus : diff.threatFailPenalty;

  // Dog trait bonus: if threat type matches a trait, amplify the outcome
  if (success && State.state.currentThreat) {
    const threatType = State.state.currentThreat.type;
    const dog = State.state.currentDog;
    if (dog && dog.trait && DOG_TRAIT_THREAT_BONUS[dog.trait]) {
      const supportedTypes = DOG_TRAIT_THREAT_BONUS[dog.trait];
      if (supportedTypes.includes(threatType)) {
        const traitMod = DOG_TRAIT_MODIFIERS[dog.trait] ?? 1;
        // Bonus: add a fraction of the success bonus based on trait modifier
        delta = Math.round(delta * (1 + (traitMod - 1) * 0.5));
      }
    }
  }

  State.state.happiness = Math.max(CONFIG.happinessMin, Math.min(CONFIG.happinessMax, State.state.happiness + delta));
  State.state.threatActive = false;
  State.state.currentThreat = null;
  emit({ type: 'threat-resolved', success });
  emit({
    type: 'happiness-changed',
    newHappiness: State.state.happiness,
    delta,
  });
}

function showDialogue(text: string, speaker: string): void {
  emit({ type: 'dialogue-show', text, speaker });
}

function hideDialogue(): void {
  emit({ type: 'dialogue-hide' });
}

function togglePanel(panel: string, open: boolean): void {
  emit({ type: 'panel-toggle', panel, open });
}

function startTransition(zoneName: string, zoneDesc: string): void {
  State.state.gamePhase = 'transition';
  emit({ type: 'transition-start', zoneName, zoneDesc });
}

function endTransition(): void {
  State.state.gamePhase = 'playing';
  emit({ type: 'transition-end' });
}

function updateHUD(dogName: string, happiness: number): void {
  emit({ type: 'hud-update', dogName, happiness });
}

function gameOver(): void {
  State.state.gamePhase = 'gameover';
  emit({ type: 'game-over' });
}

function gameWin(): void {
  const time = (Date.now() - State.state.startTime) / 1000;
  const score = Math.floor(10000 - time + State.state.happiness * 10 + State.state.companions.length * 500);
  if (score > State.state.highScore) State.state.highScore = score;
  emit({
    type: 'game-win',
    score,
    time,
    companions: State.state.companions.length,
    items: State.state.inventory.filter(s => s.item !== null).length,
  });
}

// ---- Save Schema ----

interface SaveWrapper {
  saveVersion: number;
  timestamp: number;
  state: GameState;
}

// ---- Persistence ----

/** Deep-clone a GameState using structured clone (safe for plain data). */
function cloneState(state: GameState): GameState {
  const serialized = JSON.stringify(state);
  return JSON.parse(serialized) as GameState;
}

/** Validate a parsed save wrapper before accepting it. */
function validateSave(data: unknown): data is SaveWrapper {
  if (data === null || typeof data !== 'object') return false;
  const obj = data as Record<string, unknown>;

  // Schema version check
  if (typeof obj.saveVersion !== 'number' || obj.saveVersion !== SAVE_SCHEMA_VERSION) {
    return false;
  }

  // Timestamp check
  if (typeof obj.timestamp !== 'number') return false;

  // State must be a non-null object
  if (typeof obj.state !== 'object' || obj.state === null) return false;
  const s = obj.state as Record<string, unknown>;

  // Required top-level fields
  if (typeof s.happiness !== 'number') return false;
  if (typeof s.gamePhase !== 'string') return false;
  if (typeof s.selectedDog !== 'string' && s.selectedDog !== null) return false;
  if (typeof s.currentZone !== 'string' && s.currentZone !== null) return false;

  // Happiness bounds
  if (s.happiness < 0 || s.happiness > 100) return false;

  // Inventory must be an array
  if (!Array.isArray(s.inventory)) return false;
  if (s.inventory.length !== CONFIG.inventorySlots) return false;

  return true;
}

function saveGame(): void {
  try {
    const wrapper: SaveWrapper = {
      saveVersion: SAVE_SCHEMA_VERSION,
      timestamp: Date.now(),
      state: cloneState(State.state),
    };
    localStorage.setItem('turbo-save', JSON.stringify(wrapper));
  } catch { /* ignore */ }
}

function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem('turbo-save');
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!validateSave(parsed)) return null;

    return cloneState(parsed.state);
  } catch {
    return null;
  }
}

function clearSave(): void {
  localStorage.removeItem('turbo-save');
}

// ---- Difficulty Scaling ----

function setDifficulty(key: DifficultyKey): void {
  State.state.difficulty = key;
  emit({ type: 'difficulty-changed' as GameEvent['type'], difficulty: key });
}

function getDifficultyConfig(): DifficultyConfig {
  return DIFFICULTY_PRESETS[State.state.difficulty];
}

/** Get the dog trait modifier for the currently selected dog. */
function getDogTraitModifier(): number {
  const dog = State.state.currentDog;
  if (!dog || !dog.trait) return 1;
  return DOG_TRAIT_MODIFIERS[dog.trait] ?? 1;
}

/** Get the companion auto-help chance for the current difficulty. */
function getCompanionHelpChance(): number {
  return COMPANION_HELP_CHANCE[State.state.difficulty];
}

// ---- Public API ----
// Use a local variable to avoid bare `State` references in the minified build.
// Internal functions reference `s` (resolved at call time, not definition time),
// and the export is assigned after all functions are defined.
const s = {
  listeners,
  state: createDefaultState() as GameState,
  get(): GameState { return { ...s.state }; },
  getRef(): GameState { return s.state; },
  selectDog,
  enterZone,
  enterRoom,
  collectItem,
  useItem,
  meetCompanion,
  activateCompanion,
  unlockHint,
  startThreat,
  resolveThreat,
  showDialogue,
  hideDialogue,
  togglePanel,
  startTransition,
  endTransition,
  updateHUD,
  gameOver,
  gameWin,
  save: saveGame,
  load: loadGame,
  clearSave,
  setDifficulty,
  getDifficultyConfig,
  getDogTraitModifier,
  getCompanionHelpChance,
  on,
  off,
  emit,
};

/** The global game state singleton. Exported after all internal functions are defined. */
export const State = s;
