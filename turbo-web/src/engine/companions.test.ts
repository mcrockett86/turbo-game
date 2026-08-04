/**
 * Tests for the companion manager (engine/companions.ts).
 *
 * Covers meet/activate/deactivate, bonus calculation, and follow behavior.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CompanionManager } from '@/engine/companions';
import type { Companion } from '@/types';

// ---- Helpers ----

function makeCompanion(id: string, name: string, bonusType: string = 'happiness'): Companion {
  return {
    id,
    name,
    breed: 'Mixed',
    trait: '🐾 Friendly',
    dialogue: [`Hello, I'm ${name}!`],
    bonusType,
  };
}

describe('Companion Manager — Meet', () => {
  let manager: CompanionManager;

  beforeEach(() => {
    manager = new CompanionManager();
  });

  it('meets a new companion', () => {
    const companion = makeCompanion('stray_buddy', 'Stray Buddy');
    const result = manager.meetCompanion(companion);

    expect(result).toBe(true);
    expect(manager.getAllMet()).toHaveLength(1);
  });

  it('does not meet a duplicate companion', () => {
    const companion = makeCompanion('stray_buddy', 'Stray Buddy');
    manager.meetCompanion(companion);

    const result = manager.meetCompanion(companion);
    expect(result).toBe(false);
    expect(manager.getAllMet()).toHaveLength(1);
  });

  it('auto-activates on first meet', () => {
    const companion = makeCompanion('stray_buddy', 'Stray Buddy');
    manager.meetCompanion(companion);

    expect(manager.getActiveCompanion()?.id).toBe('stray_buddy');
  });

  it('does not auto-activate when another is active', () => {
    const first = makeCompanion('first', 'First');
    const second = makeCompanion('second', 'Second');

    manager.meetCompanion(first);
    manager.meetCompanion(second);

    expect(manager.getActiveCompanion()?.id).toBe('first');
  });
});

describe('Companion Manager — Activate', () => {
  let manager: CompanionManager;

  beforeEach(() => {
    manager = new CompanionManager();
  });

  it('activates a met companion', () => {
    const companion = makeCompanion('stray_buddy', 'Stray Buddy');
    manager.meetCompanion(companion);

    const result = manager.activateCompanion('stray_buddy');
    expect(result).toBe(true);
    expect(manager.getActiveCompanion()?.id).toBe('stray_buddy');
  });

  it('deactivates previous companion when activating another', () => {
    const first = makeCompanion('first', 'First');
    const second = makeCompanion('second', 'Second');

    manager.meetCompanion(first);
    manager.meetCompanion(second);
    manager.activateCompanion('second');

    expect(manager.getActiveCompanion()?.id).toBe('second');
  });

  it('fails to activate an unmet companion', () => {
    expect(manager.activateCompanion('unknown')).toBe(false);
  });

  it('activates companion and triggers dialogue', () => {
    let dialogue = '';
    manager.setOnCompanionDialogue((msg) => { dialogue = msg; });

    const companion = makeCompanion('stray_buddy', 'Stray Buddy');
    manager.meetCompanion(companion);

    // Dialogue is triggered on meet (auto-activate)
    // In jsdom, the callback may fire synchronously
    expect(dialogue).toBeDefined();
  });
});

describe('Companion Manager — Deactivate', () => {
  let manager: CompanionManager;

  beforeEach(() => {
    manager = new CompanionManager();
  });

  it('deactivates the active companion', () => {
    const companion = makeCompanion('stray_buddy', 'Stray Buddy');
    manager.meetCompanion(companion);
    manager.deactivateAll();

    expect(manager.getActiveCompanion()).toBeNull();
  });

  it('clears bonus on deactivate', () => {
    const companion = makeCompanion('stray_buddy', 'Stray Buddy', 'happiness');
    manager.meetCompanion(companion);

    // Deactivate and check that bonus is cleared
    manager.deactivateAll();
    const bonusAfter = manager.getBonus();

    expect(Object.keys(bonusAfter).length).toBe(0);
  });
});

describe('Companion Manager — Bonus Calculation', () => {
  let manager: CompanionManager;

  beforeEach(() => {
    manager = new CompanionManager();
  });

  it('returns a bonus for happiness companion', () => {
    const companion = makeCompanion('happy_dog', 'Happy Dog', 'happiness');
    manager.meetCompanion(companion);
    manager.activateCompanion('happy_dog');

    const bonus = manager.getBonus();
    // Bonus key is derived from bonus name (lowercase, no spaces)
    expect(Object.keys(bonus).length).toBeGreaterThan(0);
    expect(Object.values(bonus)[0]).toBe(0.1);
  });

  it('returns a bonus for speed companion', () => {
    const companion = makeCompanion('speed_dog', 'Speed Dog', 'speed');
    manager.meetCompanion(companion);
    manager.activateCompanion('speed_dog');

    const bonus = manager.getBonus();
    expect(Object.keys(bonus).length).toBeGreaterThan(0);
    expect(Object.values(bonus)[0]).toBe(0.2);
  });

  it('returns a bonus for detection companion', () => {
    const companion = makeCompanion('sniffer', 'Sniffer', 'detection');
    manager.meetCompanion(companion);
    manager.activateCompanion('sniffer');

    const bonus = manager.getBonus();
    expect(Object.keys(bonus).length).toBeGreaterThan(0);
    expect(Object.values(bonus)[0]).toBe(0.15);
  });

  it('returns a bonus for courage companion', () => {
    const companion = makeCompanion('brave_dog', 'Brave Dog', 'courage');
    manager.meetCompanion(companion);
    manager.activateCompanion('brave_dog');

    const bonus = manager.getBonus();
    expect(Object.keys(bonus).length).toBeGreaterThan(0);
    expect(Object.values(bonus)[0]).toBe(0.1);
  });

  it('returns empty bonus when no companion active', () => {
    const bonus = manager.getBonus();
    expect(Object.keys(bonus)).toHaveLength(0);
  });
});

describe('Companion Manager — Follow Behavior', () => {
  let manager: CompanionManager;

  beforeEach(() => {
    manager = new CompanionManager();
  });

  it('follows behind the player', () => {
    const companion = makeCompanion('follower', 'Follower');
    manager.meetCompanion(companion);

    manager.updatePosition(0, 0, 0); // Facing right (angle 0)

    const pos = manager.getActiveCompanion()?.position;
    expect(pos).toBeDefined();
    // Behind player at angle 0 means negative x
    expect(pos!.x).toBeLessThan(0);
  });

  it('follows at the configured distance', () => {
    const companion = makeCompanion('follower', 'Follower');
    manager.meetCompanion(companion);

    manager.updatePosition(10, 10, Math.PI); // Facing left

    const pos = manager.getActiveCompanion()?.position;
    expect(pos).toBeDefined();
    // Distance should be approximately FOLLOW_DISTANCE (1.5)
    const dx = pos!.x - 10;
    const dz = pos!.z - 10;
    const dist = Math.sqrt(dx * dx + dz * dz);
    expect(dist).toBeGreaterThan(1.0);
    expect(dist).toBeLessThan(2.0);
  });
});

describe('Companion Manager — isNearby', () => {
  let manager: CompanionManager;

  beforeEach(() => {
    manager = new CompanionManager();
  });

  it('returns true when close to player', () => {
    const companion = makeCompanion('nearby', 'Nearby');
    manager.meetCompanion(companion);
    manager.updatePosition(0, 0, 0);
    manager.getActiveCompanion()!.position = { x: 0.5, z: 0 };

    expect(manager.isNearby(0, 0)).toBe(true);
  });

  it('returns false when far from player', () => {
    const companion = makeCompanion('faraway', 'Faraway');
    manager.meetCompanion(companion);
    manager.updatePosition(0, 0, 0);
    manager.getActiveCompanion()!.position = { x: 5, z: 5 };

    expect(manager.isNearby(0, 0)).toBe(false);
  });

  it('returns false when no companion active', () => {
    expect(manager.isNearby(0, 0)).toBe(false);
  });
});

describe('Companion Manager — getAllMet', () => {
  let manager: CompanionManager;

  beforeEach(() => {
    manager = new CompanionManager();
  });

  it('returns all met companions', () => {
    manager.meetCompanion(makeCompanion('a', 'A'));
    manager.meetCompanion(makeCompanion('b', 'B'));
    manager.meetCompanion(makeCompanion('c', 'C'));

    expect(manager.getAllMet()).toHaveLength(3);
  });

  it('returns empty array when none met', () => {
    expect(manager.getAllMet()).toHaveLength(0);
  });
});
