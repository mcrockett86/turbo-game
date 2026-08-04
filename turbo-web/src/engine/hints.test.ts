/**
 * Tests for the hint/route system (engine/hints.ts).
 *
 * Covers unlock conditions, route reveal, and canUnlockHint logic.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { HintRouteRenderer } from '@/engine/hints';
import type { Hint } from '@/engine/hints';

// ---- Helpers ----

function createRenderer(): HintRouteRenderer {
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 600;
  document.body.appendChild(canvas);
  return new HintRouteRenderer(canvas);
}

describe('HintRouteRenderer — Unlock Hints', () => {
  let renderer: HintRouteRenderer;

  beforeEach(() => {
    renderer = createRenderer();
  });

  afterEach(() => {
    renderer.dispose();
    renderer['canvas'].remove();
  });

  it('unlocks a valid hint', () => {
    renderer.unlockHint('tree_clue');
    const hints = renderer.getUnlockedHints();

    expect(hints).toHaveLength(1);
    expect(hints[0].id).toBe('tree_clue');
  });

  it('does not duplicate unlocked hints', () => {
    renderer.unlockHint('tree_clue');
    renderer.unlockHint('tree_clue');

    expect(renderer.getUnlockedHints()).toHaveLength(1);
  });

  it('unlocks multiple hints', () => {
    renderer.unlockHint('tree_clue');
    renderer.unlockHint('first_crossing');
    renderer.unlockHint('park_entrance');

    expect(renderer.getUnlockedHints()).toHaveLength(3);
  });

  it('silently ignores unknown hint IDs', () => {
    renderer.unlockHint('nonexistent_hint');
    expect(renderer.getUnlockedHints()).toHaveLength(0);
  });

  it('returns correct hint data after unlock', () => {
    renderer.unlockHint('tree_clue');
    const hints = renderer.getUnlockedHints();

    expect(hints[0].id).toBe('tree_clue');
    expect(hints[0].title).toBe('Old Tree Marker');
    expect(hints[0].category).toBe('clue');
    expect(hints[0].icon).toBe('🌳');
  });
});

describe('HintRouteRenderer — Route Reveal', () => {
  let renderer: HintRouteRenderer;

  beforeEach(() => {
    renderer = createRenderer();
  });

  afterEach(() => {
    renderer.dispose();
    renderer['canvas'].remove();
  });

  it('reveals a valid route', () => {
    renderer.revealRoute('suburban_streets', 'park_entrance');
    const routes = renderer.getRevealedRoutes();

    expect(routes).toHaveLength(1);
    expect(routes[0].from).toBe('suburban_streets');
    expect(routes[0].to).toBe('park_entrance');
  });

  it('does not duplicate revealed routes', () => {
    renderer.revealRoute('suburban_streets', 'park_entrance');
    renderer.revealRoute('suburban_streets', 'park_entrance');

    expect(renderer.getRevealedRoutes()).toHaveLength(1);
  });

  it('reveals multiple routes', () => {
    renderer.revealRoute('suburban_streets', 'park_entrance');
    renderer.revealRoute('park_entrance', 'lake_clearing');
    renderer.revealRoute('lake_clearing', 'shelter_road');

    expect(renderer.getRevealedRoutes()).toHaveLength(3);
  });

  it('silently ignores unknown route', () => {
    renderer.revealRoute('nowhere', 'else');
    expect(renderer.getRevealedRoutes()).toHaveLength(0);
  });

  it('returns correct route data', () => {
    renderer.revealRoute('suburban_streets', 'park_entrance');
    const routes = renderer.getRevealedRoutes();

    expect(routes[0].distance).toBe(200);
    expect(routes[0].description).toContain('Pine Ridge Park');
  });
});

describe('HintRouteRenderer — canUnlockHint', () => {
  let renderer: HintRouteRenderer;

  beforeEach(() => {
    renderer = createRenderer();
  });

  afterEach(() => {
    renderer.dispose();
    renderer['canvas'].remove();
  });

  it('returns true when flag matches unlock condition', () => {
    expect(renderer.canUnlockHint('tree_clue', { found_tree: true })).toBe(true);
  });

  it('returns false when flag does not match', () => {
    expect(renderer.canUnlockHint('tree_clue', { found_tree: false })).toBe(false);
  });

  it('returns false when flag is missing', () => {
    expect(renderer.canUnlockHint('tree_clue', {})).toBe(false);
  });

  it('returns false for unknown hint ID', () => {
    expect(renderer.canUnlockHint('nonexistent', { found_tree: true })).toBe(false);
  });

  it('validates hint unlock conditions individually', () => {
    // Test each hint with its correct flag
    expect(renderer.canUnlockHint('tree_clue', { found_tree: true })).toBe(true);
    expect(renderer.canUnlockHint('first_crossing', { near_road: true })).toBe(true);
    expect(renderer.canUnlockHint('park_entrance', { found_park: true })).toBe(true);
    // water_bowl hint key is 'water_bowl_help'
    expect(renderer.canUnlockHint('water_bowl_help', { near_water: true })).toBe(true);
    expect(renderer.canUnlockHint('shelter_direction', { has_compass: true })).toBe(true);
    expect(renderer.canUnlockHint('home_found', { at_home: true })).toBe(true);
  });

  it('returns false when wrong flag is provided', () => {
    expect(renderer.canUnlockHint('tree_clue', { near_road: true })).toBe(false);
    expect(renderer.canUnlockHint('park_entrance', { found_tree: true })).toBe(false);
  });
});

describe('HintRouteRenderer — Visibility', () => {
  let renderer: HintRouteRenderer;

  beforeEach(() => {
    renderer = createRenderer();
  });

  afterEach(() => {
    renderer.dispose();
    renderer['canvas'].remove();
  });

  it('toggles visibility', () => {
    renderer.toggle();
    renderer.toggle();
    expect(() => renderer.toggle()).not.toThrow();
  });

  it('show() and hide() work', () => {
    renderer.show();
    renderer.hide();
    renderer.show();
    renderer.hide();
  });

  it('dispose() stops render loop', () => {
    renderer.show();
    renderer.dispose();
    expect(() => renderer.hide()).not.toThrow();
  });
});

describe('HintRouteRenderer — Resize', () => {
  let renderer: HintRouteRenderer;

  beforeEach(() => {
    renderer = createRenderer();
  });

  afterEach(() => {
    renderer.dispose();
    renderer['canvas'].remove();
  });

  it('updates canvas dimensions', () => {
    renderer.resize(1024, 768);
    expect(renderer['canvas'].width).toBe(1024);
    expect(renderer['canvas'].height).toBe(768);
  });
});
