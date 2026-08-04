// ===== Game State Manager =====
// Central state management with pub/sub events

import { CONFIG } from '@/config';
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

  // Happiness decay for entering a new room
  State.state.happiness = Math.max(0, State.state.happiness - CONFIG.happinessDecayPerRoom);
  emit({
    type: 'happiness-changed',
    newHappiness: State.state.happiness,
    delta: -CONFIG.happinessDecayPerRoom,
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

  // Apply item effects
  switch (itemId) {
    case 'treat':
      State.state.happiness = Math.min(CONFIG.happinessMax, State.state.happiness + CONFIG.happinessItemTreat);
      break;
    case 'toy':
      State.state.happiness = Math.min(CONFIG.happinessMax, State.state.happiness + CONFIG.happinessItemToy);
      break;
    case 'map_fragment':
      State.state.mapFragments++;
      break;
    case 'key':
      State.state.flags['hasKey'] = true;
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
  const delta = success ? CONFIG.happinessThreatSuccess : CONFIG.happinessThreatFail;
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

// ---- Persistence ----
function saveGame(): void {
  try {
    localStorage.setItem('turbo-save', JSON.stringify(State.state));
  } catch { /* ignore */ }
}

function loadGame(): GameState | null {
  try {
    const data = localStorage.getItem('turbo-save');
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

function clearSave(): void {
  localStorage.removeItem('turbo-save');
}

// ---- Public API ----
export const State = {
  listeners,

  state: createDefaultState() as GameState,

  get(): GameState { return { ...State.state }; },
  getRef(): GameState { return State.state; },

  // Transitions
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

  // Persistence
  save: saveGame,
  load: loadGame,
  clearSave,

  // Events
  on,
  off,
  emit,
};
