/**
 * Tests for the state manager (engine/state.ts).
 *
 * Covers state transitions, pub/sub events, persistence, and
 * happiness bounds enforcement.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { State } from '@/engine/state';
import type { GameState, Companion, Threat, GameEvent } from '@/types';

// ---- Helpers ----

/** Reset state to defaults and clear listeners between tests. */
function resetState(): void {
  const defaults = {
    selectedDog: null,
    currentDog: null,
    happiness: 80,
    currentZone: null,
    currentZoneIndex: 0,
    currentRoom: null,
    currentRoomIndex: 0,
    isHome: false,
    gamePhase: 'select' as const,
    inventory: Array(16).fill(null).map(() => ({ item: null, count: 0 })),
    companions: [],
    activeCompanion: null,
    hintsUnlocked: [],
    mapFragments: 0,
    routeProgress: 0,
    flags: {},
    threatActive: false,
    currentThreat: null,
    startTime: 0,
    highScore: 0,
  };

  const ref = State.getRef();
  Object.assign(ref, defaults);

  // Clear listeners
  State.listeners.clear();
}

describe('State Manager — Initialization', () => {
  beforeEach(resetState);

  it('starts with default happiness of 80', () => {
    expect(State.state.happiness).toBe(80);
  });

  it('starts in select phase', () => {
    expect(State.state.gamePhase).toBe('select');
  });

  it('starts with empty inventory (16 slots)', () => {
    expect(State.state.inventory).toHaveLength(16);
    expect(State.state.inventory.every(s => s.item === null)).toBe(true);
  });

  it('starts with no companions', () => {
    expect(State.state.companions).toHaveLength(0);
  });

  it('starts with no unlocked hints', () => {
    expect(State.state.hintsUnlocked).toHaveLength(0);
  });
});

describe('State Manager — Dog Selection', () => {
  beforeEach(resetState);

  it('sets selected dog and switches to playing phase', () => {
    State.selectDog('turbo', { id: 'turbo', name: 'Turbo' });

    expect(State.state.selectedDog).toBe('turbo');
    expect(State.state.currentDog).toEqual({ id: 'turbo', name: 'Turbo' });
    expect(State.state.gamePhase).toBe('playing');
  });

  it('records start time on dog selection', () => {
    const before = Date.now();
    State.selectDog('watson', { id: 'watson', name: 'Watson' });
    const after = Date.now();

    expect(State.state.startTime).toBeGreaterThanOrEqual(before);
    expect(State.state.startTime).toBeLessThanOrEqual(after);
  });

  it('emits dog-selected event', () => {
    let received: GameEvent | null = null;
    State.on('dog-selected', (e) => { received = e; });

    State.selectDog('nova', { id: 'nova', name: 'Nova' });

    expect(received).not.toBeNull();
    expect(received!.type).toBe('dog-selected');
    expect((received as any).dogId).toBe('nova');
  });
});

describe('State Manager — Zone Transitions', () => {
  beforeEach(resetState);

  it('enters a zone and emits event', () => {
    const zoneData = { id: 'suburban_streets', name: 'Suburban Streets', desc: 'Wide sidewalks' };
    let received: GameEvent | null = null;
    State.on('zone-entered', (e) => { received = e; });

    State.enterZone('suburban_streets', zoneData);

    expect(State.state.currentZone).toBe('suburban_streets');
    expect(received!.type).toBe('zone-entered');
    expect((received as any).zoneId).toBe('suburban_streets');
    expect((received as any).zoneName).toBe('Suburban Streets');
  });

  it('enters a room and emits event', () => {
    let received: GameEvent | null = null;
    State.on('room-entered', (e) => { received = e; });

    State.enterRoom('start', 0);

    expect(State.state.currentRoom).toBe('start');
    expect(State.state.currentRoomIndex).toBe(0);
    expect(received!.type).toBe('room-entered');
  });

  it('decreases happiness on room entry', () => {
    State.state.happiness = 80;
    State.enterRoom('start', 0);

    expect(State.state.happiness).toBe(78);
  });

  it('emits happiness-changed when entering room', () => {
    let received: GameEvent | null = null;
    State.on('happiness-changed', (e) => { received = e; });

    State.enterRoom('start', 0);

    expect(received!.type).toBe('happiness-changed');
    expect((received as any).delta).toBe(-2);
  });
});

describe('State Manager — Inventory Operations', () => {
  beforeEach(resetState);

  it('collects an item into the first empty slot', () => {
    const collected = State.collectItem('treat', 'Treat');

    expect(collected).toBe(true);
    expect(State.state.inventory[0].item).toBe('treat');
    expect(State.state.inventory[0].count).toBe(1);
  });

  it('returns false when inventory is full', () => {
    // Fill all 16 slots
    for (let i = 0; i < 16; i++) {
      State.collectItem(`item_${i}`, `Item ${i}`);
    }

    expect(State.collectItem('extra', 'Extra')).toBe(false);
  });

  it('stacks identical items', () => {
    State.collectItem('treat', 'Treat');
    State.collectItem('treat', 'Treat');
    State.collectItem('treat', 'Treat');

    expect(State.state.inventory[0].item).toBe('treat');
    expect(State.state.inventory[0].count).toBe(3);
  });

  it('uses an item and reduces count', () => {
    State.collectItem('treat', 'Treat');
    State.collectItem('treat', 'Treat');

    const used = State.useItem('treat');

    expect(used).toBe(true);
    expect(State.state.inventory[0].count).toBe(1);
  });

  it('removes slot when count reaches zero', () => {
    State.collectItem('treat', 'Treat');

    State.useItem('treat');

    expect(State.state.inventory[0].item).toBeNull();
    expect(State.state.inventory[0].count).toBe(0);
  });

  it('applies treat happiness boost on use', () => {
    State.state.happiness = 50;
    State.collectItem('treat', 'Treat');

    State.useItem('treat');

    expect(State.state.happiness).toBe(60);
  });

  it('clamps happiness to max on item use', () => {
    State.state.happiness = 95;
    State.collectItem('treat', 'Treat');

    State.useItem('treat');

    expect(State.state.happiness).toBe(100);
  });

  it('applies key flag on use', () => {
    State.collectItem('key', 'Key');

    State.useItem('key');

    expect(State.state.flags.hasKey).toBe(true);
  });

  it('emits item-collected event', () => {
    let received: GameEvent | null = null;
    State.on('item-collected', (e) => { received = e; });

    State.collectItem('bone', 'Bone');

    expect(received!.type).toBe('item-collected');
    expect((received as any).itemId).toBe('bone');
  });

  it('emits item-used event', () => {
    State.collectItem('treat', 'Treat');
    let received: GameEvent | null = null;
    State.on('item-used', (e) => { received = e; });

    State.useItem('treat');

    expect(received!.type).toBe('item-used');
    expect((received as any).itemId).toBe('treat');
  });
});

describe('State Manager — Companion Operations', () => {
  beforeEach(resetState);

  it('meets a new companion', () => {
    const companion: Companion = {
      id: 'stray_buddy',
      name: 'Stray Buddy',
      breed: 'Mixed',
      trait: '🐾 Friendly',
      dialogue: ['Woof!'],
      bonusType: 'happiness',
    };

    State.meetCompanion(companion);

    expect(State.state.companions).toHaveLength(1);
    expect(State.state.companions[0].id).toBe('stray_buddy');
  });

  it('does not duplicate an already-met companion', () => {
    const companion: Companion = {
      id: 'stray_buddy',
      name: 'Stray Buddy',
      breed: 'Mixed',
      trait: '🐾 Friendly',
      dialogue: ['Woof!'],
      bonusType: 'happiness',
    };

    State.meetCompanion(companion);
    State.meetCompanion(companion);

    expect(State.state.companions).toHaveLength(1);
  });

  it('activates a companion', () => {
    const companion: Companion = {
      id: 'stray_buddy',
      name: 'Stray Buddy',
      breed: 'Mixed',
      trait: '🐾 Friendly',
      dialogue: ['Woof!'],
      bonusType: 'happiness',
    };

    State.meetCompanion(companion);
    State.activateCompanion('stray_buddy');

    expect(State.state.activeCompanion).toBe('stray_buddy');
  });

  it('emits companion-met event', () => {
    let received: GameEvent | null = null;
    State.on('companion-met', (e) => { received = e; });

    const companion: Companion = {
      id: 'stray_buddy',
      name: 'Stray Buddy',
      breed: 'Mixed',
      trait: '🐾 Friendly',
      dialogue: ['Woof!'],
      bonusType: 'happiness',
    };

    State.meetCompanion(companion);

    expect(received!.type).toBe('companion-met');
  });

  it('emits companion-activated event', () => {
    let received: GameEvent | null = null;
    State.on('companion-activated', (e) => { received = e; });

    const companion: Companion = {
      id: 'stray_buddy',
      name: 'Stray Buddy',
      breed: 'Mixed',
      trait: '🐾 Friendly',
      dialogue: ['Woof!'],
      bonusType: 'happiness',
    };

    State.meetCompanion(companion);
    State.activateCompanion('stray_buddy');

    expect(received!.type).toBe('companion-activated');
    expect((received as any).companionId).toBe('stray_buddy');
  });
});

describe('State Manager — Hint System', () => {
  beforeEach(resetState);

  it('unlocks a hint', () => {
    State.unlockHint('tree_clue');

    expect(State.state.hintsUnlocked).toContain('tree_clue');
  });

  it('does not duplicate unlocked hints', () => {
    State.unlockHint('tree_clue');
    State.unlockHint('tree_clue');

    expect(State.state.hintsUnlocked.filter(h => h === 'tree_clue')).toHaveLength(1);
  });

  it('updates route progress on hint unlock', () => {
    State.unlockHint('tree_clue');
    State.unlockHint('first_crossing');
    State.unlockHint('park_entrance');

    expect(State.state.routeProgress).toBe(3);
  });

  it('caps route progress at 5', () => {
    State.unlockHint('tree_clue');
    State.unlockHint('first_crossing');
    State.unlockHint('park_entrance');
    State.unlockHint('water_bowl');
    State.unlockHint('shelter_direction');
    State.unlockHint('home_found');
    State.unlockHint('extra_hint'); // This won't be in HINTS but won't error

    expect(State.state.routeProgress).toBeLessThanOrEqual(5);
  });

  it('emits hint-unlocked event', () => {
    let received: GameEvent | null = null;
    State.on('hint-unlocked', (e) => { received = e; });

    State.unlockHint('tree_clue');

    expect(received!.type).toBe('hint-unlocked');
    expect((received as any).hintId).toBe('tree_clue');
  });
});

describe('State Manager — Threat System', () => {
  beforeEach(resetState);

  it('starts a threat', () => {
    const threat: Threat = {
      name: 'Traffic',
      icon: '🚗',
      type: 'timing',
      description: 'Cars zooming',
      solve: 'Press SPACE',
      mangaText: 'SCREEEECH!',
      mangaType: 'near-miss',
    };

    State.startThreat(threat);

    expect(State.state.threatActive).toBe(true);
    expect(State.state.currentThreat).toEqual(threat);
  });

  it('resolves a threat successfully', () => {
    const threat: Threat = {
      name: 'Traffic',
      icon: '🚗',
      type: 'timing',
      description: 'Cars zooming',
      solve: 'Press SPACE',
      mangaText: 'SCREEEECH!',
      mangaType: 'near-miss',
    };

    State.state.happiness = 70;
    State.startThreat(threat);
    State.resolveThreat(true);

    expect(State.state.threatActive).toBe(false);
    expect(State.state.currentThreat).toBeNull();
  });

  it('resolves a threat failure', () => {
    const threat: Threat = {
      name: 'Traffic',
      icon: '🚗',
      type: 'timing',
      description: 'Cars zooming',
      solve: 'Press SPACE',
      mangaText: 'SCREEEECH!',
      mangaType: 'near-miss',
    };

    State.state.happiness = 50;
    State.startThreat(threat);
    State.resolveThreat(false);

    expect(State.state.threatActive).toBe(false);
    expect(State.state.currentThreat).toBeNull();
  });

  it('emits threat-started event', () => {
    let received: GameEvent | null = null;
    State.on('threat-started', (e) => { received = e; });

    const threat: Threat = {
      name: 'Traffic',
      icon: '🚗',
      type: 'timing',
      description: 'Cars zooming',
      solve: 'Press SPACE',
      mangaText: 'SCREEEECH!',
      mangaType: 'near-miss',
    };

    State.startThreat(threat);

    expect(received!.type).toBe('threat-started');
  });

  it('emits threat-resolved event', () => {
    let received: GameEvent | null = null;
    State.on('threat-resolved', (e) => { received = e; });

    const threat: Threat = {
      name: 'Traffic',
      icon: '🚗',
      type: 'timing',
      description: 'Cars zooming',
      solve: 'Press SPACE',
      mangaText: 'SCREEEECH!',
      mangaType: 'near-miss',
    };

    State.startThreat(threat);
    State.resolveThreat(true);

    expect(received!.type).toBe('threat-resolved');
    expect((received as any).success).toBe(true);
  });
});

describe('State Manager — Happiness Bounds', () => {
  beforeEach(resetState);

  it('clamps happiness to minimum on threat fail', () => {
    State.state.happiness = 5;
    const threat: Threat = {
      name: 'Traffic',
      icon: '🚗',
      type: 'timing',
      description: 'Cars zooming',
      solve: 'Press SPACE',
      mangaText: 'SCREEEECH!',
      mangaType: 'near-miss',
    };

    State.startThreat(threat);
    State.resolveThreat(false);

    expect(State.state.happiness).toBeGreaterThanOrEqual(0);
  });

  it('clamps happiness to maximum on item use', () => {
    State.state.happiness = 95;
    State.collectItem('treat', 'Treat');
    State.useItem('treat');

    expect(State.state.happiness).toBe(100);
  });
});

describe('State Manager — Game Over / Win', () => {
  beforeEach(resetState);

  it('sets game over phase and emits event', () => {
    let received: GameEvent | null = null;
    State.on('game-over', (e) => { received = e; });

    State.gameOver();

    expect(State.state.gamePhase).toBe('gameover');
    expect(received).not.toBeNull();
  });

  it('calculates score on win', () => {
    State.state.happiness = 80;
    State.state.startTime = Date.now() - 60000; // 60 seconds ago
    State.state.companions = [{ id: 'c1', name: 'C', breed: 'B', trait: 'T', dialogue: [] } as Companion];

    let received: GameEvent | null = null;
    State.on('game-win', (e) => { received = e; });

    State.gameWin();

    expect(received).not.toBeNull();
    expect((received as any).score).toBeGreaterThan(0);
    expect((received as any).time).toBeGreaterThan(0);
  });

  it('updates high score on win', () => {
    State.state.happiness = 100;
    State.state.startTime = Date.now() - 10000;

    State.gameWin();

    expect(State.state.highScore).toBeGreaterThan(0);
  });
});

describe('State Manager — Persistence', () => {
  beforeEach(() => {
    resetState();
    localStorage.clear();
  });

  it('saves game to localStorage', () => {
    State.state.selectedDog = 'turbo';
    State.state.happiness = 75;
    State.save();

    const saved = localStorage.getItem('turbo-save');
    expect(saved).not.toBeNull();

    const parsed = JSON.parse(saved!);
    expect(parsed.saveVersion).toBe(1);
    expect(parsed.state.selectedDog).toBe('turbo');
    expect(parsed.state.happiness).toBe(75);
  });

  it('loads saved game', () => {
    State.state.selectedDog = 'watson';
    State.state.happiness = 60;
    State.save();

    // Reset state
    resetState();

    const loaded = State.load();
    expect(loaded).not.toBeNull();
    expect(loaded!.selectedDog).toBe('watson');
    expect(loaded!.happiness).toBe(60);
  });

  it('returns null when no save exists', () => {
    localStorage.clear();
    expect(State.load()).toBeNull();
  });

  it('clears save', () => {
    State.save();
    State.clearSave();
    expect(localStorage.getItem('turbo-save')).toBeNull();
  });

  it('deep clones state on save (no shared refs)', () => {
    State.state.selectedDog = 'turbo';
    State.state.happiness = 75;
    State.state.inventory[0].item = 'treat';
    State.state.inventory[0].count = 3;
    State.save();

    // Mutate the live state after save
    State.state.selectedDog = 'mutated';
    State.state.inventory[0].count = 999;

    // Load should return the original saved values
    const loaded = State.load();
    expect(loaded!.selectedDog).toBe('turbo');
    expect(loaded!.inventory[0].count).toBe(3);
  });

  it('rejects corrupted JSON', () => {
    localStorage.setItem('turbo-save', 'not valid json{{{');
    expect(State.load()).toBeNull();
  });

  it('rejects save with wrong schema version', () => {
    localStorage.setItem('turbo-save', JSON.stringify({
      saveVersion: 99,
      timestamp: Date.now(),
      state: { ...State.state },
    }));
    expect(State.load()).toBeNull();
  });

  it('rejects save missing required fields', () => {
    localStorage.setItem('turbo-save', JSON.stringify({
      saveVersion: 1,
      timestamp: Date.now(),
      state: { happiness: 50 }, // missing gamePhase, selectedDog, etc.
    }));
    expect(State.load()).toBeNull();
  });

  it('rejects save with out-of-range happiness', () => {
    localStorage.setItem('turbo-save', JSON.stringify({
      saveVersion: 1,
      timestamp: Date.now(),
      state: { ...State.state, happiness: 150 },
    }));
    expect(State.load()).toBeNull();
  });

  it('rejects save with non-array inventory', () => {
    localStorage.setItem('turbo-save', JSON.stringify({
      saveVersion: 1,
      timestamp: Date.now(),
      state: { ...State.state, inventory: 'not-an-array' },
    }));
    expect(State.load()).toBeNull();
  });

  it('rejects save with wrong inventory slot count', () => {
    localStorage.setItem('turbo-save', JSON.stringify({
      saveVersion: 1,
      timestamp: Date.now(),
      state: { ...State.state, inventory: Array(10).fill(null).map(() => ({ item: null, count: 0 })) },
    }));
    expect(State.load()).toBeNull();
  });

  it('accepts valid save with all fields present', () => {
    State.state.selectedDog = 'nova';
    State.state.happiness = 42;
    State.state.gamePhase = 'playing';
    State.save();

    const loaded = State.load();
    expect(loaded).not.toBeNull();
    expect(loaded!.selectedDog).toBe('nova');
    expect(loaded!.happiness).toBe(42);
    expect(loaded!.gamePhase).toBe('playing');
  });
});

describe('State Manager — Pub/Sub Events', () => {
  beforeEach(resetState);

  it('removes a listener with off', () => {
    let called = false;
    const cb = () => { called = true; };

    State.on('test-event' as any, cb);
    State.off('test-event' as any, cb);

    State.emit({ type: 'test-event' as any });
    expect(called).toBe(false);
  });

  it('calls multiple listeners for same event', () => {
    let count = 0;
    const cb1 = () => { count++; };
    const cb2 = () => { count++; };

    State.on('test-event' as any, cb1);
    State.on('test-event' as any, cb2);

    State.emit({ type: 'test-event' as any });
    expect(count).toBe(2);
  });
});

describe('State Manager — get() returns copy', () => {
  beforeEach(resetState);

  it('returns a shallow copy of state', () => {
    const copy = State.get();
    const ref = State.getRef();

    expect(copy).not.toBe(ref);
    expect(copy.happiness).toBe(ref.happiness);
  });
});

describe('State Manager — Difficulty Scaling', () => {
  beforeEach(resetState);

  it('starts with normal difficulty', () => {
    expect(State.state.difficulty).toBe('normal');
  });

  it('sets difficulty to easy', () => {
    State.setDifficulty('easy');
    expect(State.state.difficulty).toBe('easy');
  });

  it('sets difficulty to hard', () => {
    State.setDifficulty('hard');
    expect(State.state.difficulty).toBe('hard');
  });

  it('getDifficultyConfig returns correct values for easy', () => {
    State.setDifficulty('easy');
    const config = State.getDifficultyConfig();
    expect(config.name).toBe('Easy');
    expect(config.happinessDecayPerSecond).toBe(0.02);
    expect(config.threatSpeedMultiplier).toBe(0.7);
    expect(config.threatTimeLimitMultiplier).toBe(1.8);
    expect(config.happinessDecayPerRoom).toBe(0.5);
    expect(config.dogTraitBonus).toBe(1.3);
    expect(config.companionHelpChance).toBe(0.5);
  });

  it('getDifficultyConfig returns correct values for normal', () => {
    State.setDifficulty('normal');
    const config = State.getDifficultyConfig();
    expect(config.name).toBe('Normal');
    expect(config.happinessDecayPerSecond).toBe(0.05);
    expect(config.threatSpeedMultiplier).toBe(1.0);
    expect(config.threatTimeLimitMultiplier).toBe(1.0);
    expect(config.happinessDecayPerRoom).toBe(2);
    expect(config.dogTraitBonus).toBe(1.0);
    expect(config.companionHelpChance).toBe(0.25);
  });

  it('getDifficultyConfig returns correct values for hard', () => {
    State.setDifficulty('hard');
    const config = State.getDifficultyConfig();
    expect(config.name).toBe('Hard');
    expect(config.happinessDecayPerSecond).toBe(0.08);
    expect(config.threatSpeedMultiplier).toBe(1.2);
    expect(config.threatTimeLimitMultiplier).toBe(0.75);
    expect(config.happinessDecayPerRoom).toBe(3);
    expect(config.dogTraitBonus).toBe(0.9);
    expect(config.companionHelpChance).toBe(0.1);
  });

  it('getDogTraitModifier returns correct modifier for Speed trait', () => {
    State.state.currentDog = { id: 'turbo', name: 'Turbo', breed: 'Alaskan Husky', trait: '🏃 Speed', traitDesc: '', colors: { fur: [], accent: '#000' }, personality: [], lines: { intro: '', happy: '', scared: '', hint: '', combat: '', foundFriend: '' } } as any;
    expect(State.getDogTraitModifier()).toBe(1.25);
  });

  it('getDogTraitModifier returns correct modifier for Brave trait', () => {
    State.state.currentDog = { id: 'watson', name: 'Watson', breed: 'German Shepherd', trait: '🛡️ Brave', traitDesc: '', colors: { fur: [], accent: '#000' }, personality: [], lines: { intro: '', happy: '', scared: '', hint: '', combat: '', foundFriend: '' } } as any;
    expect(State.getDogTraitModifier()).toBe(1.2);
  });

  it('getDogTraitModifier returns 1 for unknown trait', () => {
    State.state.currentDog = { id: 'unknown', name: 'Unknown', breed: 'Mixed', trait: '🤷 Unknown', traitDesc: '', colors: { fur: [], accent: '#000' }, personality: [], lines: { intro: '', happy: '', scared: '', hint: '', combat: '', foundFriend: '' } } as any;
    expect(State.getDogTraitModifier()).toBe(1);
  });

  it('getDogTraitModifier returns 1 when no dog selected', () => {
    State.state.currentDog = null;
    expect(State.getDogTraitModifier()).toBe(1);
  });

  it('getCompanionHelpChance returns correct values per difficulty', () => {
    State.setDifficulty('easy');
    expect(State.getCompanionHelpChance()).toBe(0.4);

    State.setDifficulty('normal');
    expect(State.getCompanionHelpChance()).toBe(0.25);

    State.setDifficulty('hard');
    expect(State.getCompanionHelpChance()).toBe(0.1);
  });

  it('emits difficulty-changed event on setDifficulty', () => {
    let received: GameEvent | null = null;
    State.on('difficulty-changed', (e) => { received = e; });

    State.setDifficulty('hard');

    expect(received).not.toBeNull();
    expect(received!.type).toBe('difficulty-changed');
    expect((received as any).difficulty).toBe('hard');
  });
});
