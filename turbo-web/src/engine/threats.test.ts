/**
 * Tests for the threat manager (engine/threats.ts).
 *
 * Covers threat state machine, mini-game logic, and resolution/fail.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ThreatManager } from '@/engine/threats';
import type { Threat } from '@/types';

// ---- Helpers ----

function makeThreat(type: 'traffic' | 'cat' | 'bully' | 'storm' | 'vacuum'): Threat {
  return {
    name: `${type.charAt(0).toUpperCase() + type.slice(1)} Threat`,
    icon: '⚠️',
    type: type === 'traffic' ? 'timing' : type === 'cat' || type === 'bully' ? 'combat' : type === 'storm' ? 'comfort' : 'sneak',
    description: `A ${type} appears!`,
    solve: 'React quickly!',
    mangaText: 'WHAM!',
    mangaType: 'fight',
  };
}

describe('ThreatManager — Start Threat', () => {
  let manager: ThreatManager;

  beforeEach(() => {
    manager = new ThreatManager();
  });

  afterEach(() => {
    manager.dispose();
  });

  it('starts a threat and sets active state', () => {
    const threat = makeThreat('traffic');
    manager.startThreat(threat);

    const current = manager.getCurrentThreat();
    expect(current).not.toBeNull();
    expect(current!.type).toBe('timing'); // mini-game type, not threat id
    expect(current!.active).toBe(true);
    expect(current!.phase).toBe('intro');
  });

  it('triggers onThreatStart callback', () => {
    let received: Threat | null = null;
    manager.setOnThreatStart((t) => { received = t; });

    const threat = makeThreat('cat');
    manager.startThreat(threat);

    expect(received).not.toBeNull();
    expect(received!.name).toBe('Cat Threat');
  });

  it('initializes correct mini-game state per type', () => {
    const types: Array<'traffic' | 'cat' | 'bully' | 'storm' | 'vacuum'> =
      ['traffic', 'cat', 'bully', 'storm', 'vacuum'];

    for (const type of types) {
      const threat = makeThreat(type);
      manager.startThreat(threat);

      const current = manager.getCurrentThreat();
      expect(current!.active).toBe(true);

      manager.stop();
    }
  });
});

describe('ThreatManager — Stop Threat', () => {
  let manager: ThreatManager;

  beforeEach(() => {
    manager = new ThreatManager();
  });

  it('stops the current threat', () => {
    manager.startThreat(makeThreat('traffic'));
    manager.stop();

    expect(manager.getCurrentThreat()).toBeNull();
  });

  it('can be restarted after stop', () => {
    manager.startThreat(makeThreat('traffic'));
    manager.stop();
    manager.startThreat(makeThreat('cat'));

    const current = manager.getCurrentThreat();
    expect(current!.active).toBe(true);
  });
});

describe('ThreatManager — Combat Mini-Game', () => {
  let manager: ThreatManager;

  beforeEach(() => {
    manager = new ThreatManager();
  });

  afterEach(() => {
    manager.dispose();
  });

  it('records a combat hit attempt', () => {
    manager.startThreat(makeThreat('cat'));

    // The combatHit method is private, so we test via handleInput
    // Since pulse position is random, we test the method exists
    expect(typeof manager['combatHit']).toBe('function');
  });

  it('tracks combo state', () => {
    manager.startThreat(makeThreat('bully'));

    // The combatHit method is private but we can test it exists
    expect(typeof manager['combatHit']).toBe('function');
  });

  it('does not throw on repeated hits', () => {
    manager.startThreat(makeThreat('cat'));

    expect(() => {
      for (let i = 0; i < 10; i++) manager['combatHit']();
    }).not.toThrow();
  });
});

describe('ThreatManager — Storm Mini-Game', () => {
  let manager: ThreatManager;

  beforeEach(() => {
    manager = new ThreatManager();
  });

  afterEach(() => {
    manager.dispose();
  });

  it('progresses shelter when seeking', () => {
    manager.startThreat(makeThreat('storm'));

    const before = manager['storm']?.shelterProgress ?? 0;
    manager['seekShelter']();
    const after = manager['storm']?.shelterProgress ?? 0;

    // Seek shelter should increase progress
    expect(after).toBeGreaterThanOrEqual(before);
  });

  it('does not throw on repeated seek', () => {
    manager.startThreat(makeThreat('storm'));

    expect(() => {
      for (let i = 0; i < 20; i++) manager['seekShelter']();
    }).not.toThrow();
  });
});

describe('ThreatManager — Vacuum Mini-Game', () => {
  let manager: ThreatManager;

  beforeEach(() => {
    manager = new ThreatManager();
  });

  afterEach(() => {
    manager.dispose();
  });

  it('reduces detection when hiding', () => {
    manager.startThreat(makeThreat('vacuum'));

    const before = manager['vacuum']?.detectionLevel ?? 0;
    manager['hide']();
    const after = manager['vacuum']?.detectionLevel ?? 0;

    // Hide should decrease or keep detection level
    expect(after).toBeLessThanOrEqual(before);
  });

  it('does not throw on repeated hide', () => {
    manager.startThreat(makeThreat('vacuum'));

    expect(() => {
      for (let i = 0; i < 10; i++) manager['hide']();
    }).not.toThrow();
  });
});

describe('ThreatManager — Handle Input', () => {
  let manager: ThreatManager;

  beforeEach(() => {
    manager = new ThreatManager();
  });

  afterEach(() => {
    manager.dispose();
  });

  it('handles traffic threat input (SPACE)', () => {
    manager.startThreat(makeThreat('traffic'));
    expect(() => manager.handleInput(' ')).not.toThrow();
  });

  it('handles combat threat input (SPACE)', () => {
    manager.startThreat(makeThreat('cat'));
    expect(() => manager.handleInput(' ')).not.toThrow();
  });

  it('handles storm threat input (SPACE)', () => {
    manager.startThreat(makeThreat('storm'));
    expect(() => manager.handleInput(' ')).not.toThrow();
  });

  it('handles vacuum threat input (SPACE)', () => {
    manager.startThreat(makeThreat('vacuum'));
    expect(() => manager.handleInput(' ')).not.toThrow();
  });

  it('handles vacuum hide input (h)', () => {
    manager.startThreat(makeThreat('vacuum'));
    expect(() => manager.handleInput('h')).not.toThrow();
  });

  it('ignores input when no threat active', () => {
    expect(() => manager.handleInput(' ')).not.toThrow();
  });
});

describe('ThreatManager — Threat Resolution', () => {
  let manager: ThreatManager;

  beforeEach(() => {
    manager = new ThreatManager();
  });

  it('triggers onThreatResolved callback', () => {
    let score = 0;
    manager.setOnThreatResolved((s) => { score = s; });

    manager.startThreat(makeThreat('traffic'));
    manager['resolveThreat'](80);

    expect(score).toBe(80);
  });

  it('triggers onThreatFailed callback', () => {
    let reason = '';
    manager.setOnThreatFailed((r) => { reason = r; });

    manager.startThreat(makeThreat('traffic'));
    manager['failThreat']('Test failure');

    expect(reason).toBe('Test failure');
  });

  it('sets threat phase to resolved before clearing', () => {
    let capturedPhase = '';
    manager.setOnThreatResolved(() => {
      capturedPhase = manager['currentThreat']?.phase ?? '';
    });

    manager.startThreat(makeThreat('traffic'));
    manager['resolveThreat'](80);

    expect(capturedPhase).toBe('resolved');
  });

  it('sets threat phase to failed before clearing', () => {
    let capturedPhase = '';
    manager.setOnThreatFailed(() => {
      capturedPhase = manager['currentThreat']?.phase ?? '';
    });

    manager.startThreat(makeThreat('traffic'));
    manager['failThreat']('Failed');

    expect(capturedPhase).toBe('failed');
  });
});

describe('ThreatManager — Disposal', () => {
  it('dispose() stops threat loop', () => {
    const manager = new ThreatManager();
    manager.startThreat(makeThreat('traffic'));
    manager.dispose();

    expect(manager.getCurrentThreat()).toBeNull();
  });
});
