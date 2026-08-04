/**
 * Tests for the endgame renderer (engine/endgame.ts).
 *
 * Covers score calculation, state transitions, and win/lose conditions.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EndgameRenderer } from '@/engine/endgame';

// ---- Helpers ----

function createCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 600;
  document.body.appendChild(canvas);
  return canvas;
}

describe('EndgameRenderer — State Transitions', () => {
  let canvas: HTMLCanvasElement;
  let renderer: EndgameRenderer;

  beforeEach(() => {
    canvas = createCanvas();
    renderer = new EndgameRenderer(canvas);
  });

  afterEach(() => {
    renderer.dispose();
    canvas.remove();
  });

  it('starts in playing state', () => {
    expect(renderer.getState()).toBe('playing');
  });

  it('transitions to won state', () => {
    renderer.setState('won');
    expect(renderer.getState()).toBe('won');
  });

  it('transitions to lost state', () => {
    renderer.setState('lost');
    expect(renderer.getState()).toBe('lost');
  });

  it('transitions to transitioning state', () => {
    renderer.setState('transitioning');
    expect(renderer.getState()).toBe('transitioning');
  });
});

describe('EndgameRenderer — Score Data', () => {
  let canvas: HTMLCanvasElement;
  let renderer: EndgameRenderer;

  beforeEach(() => {
    canvas = createCanvas();
    renderer = new EndgameRenderer(canvas);
  });

  afterEach(() => {
    renderer.dispose();
    canvas.remove();
  });

  it('sets score data correctly', () => {
    renderer.setScoreData(
      9500,
      120,
      8,
      3,
      5,
      95
    );

    const data = renderer.getScoreData();
    expect(data.score).toBe(9500);
    expect(data.timePlayed).toBe(120);
    expect(data.itemsCollected).toBe(8);
    expect(data.companionsMet).toBe(3);
    expect(data.threatsResolved).toBe(5);
    expect(data.maxHappiness).toBe(95);
  });

  it('returns default score data when not set', () => {
    const data = renderer.getScoreData();
    expect(data.score).toBe(0);
    expect(data.timePlayed).toBe(0);
    expect(data.itemsCollected).toBe(0);
    expect(data.companionsMet).toBe(0);
    expect(data.threatsResolved).toBe(0);
    expect(data.maxHappiness).toBe(50);
  });

  it('updates score data after initial set', () => {
    renderer.setScoreData(1000, 30, 2, 1, 0, 80);
    renderer.setScoreData(5000, 60, 5, 2, 3, 90);

    const data = renderer.getScoreData();
    expect(data.score).toBe(5000);
    expect(data.timePlayed).toBe(60);
  });
});

describe('EndgameRenderer — Final Dialogue', () => {
  let canvas: HTMLCanvasElement;
  let renderer: EndgameRenderer;

  beforeEach(() => {
    canvas = createCanvas();
    renderer = new EndgameRenderer(canvas);
  });

  afterEach(() => {
    renderer.dispose();
    canvas.remove();
  });

  it('sets final dialogue', () => {
    renderer.setFinalDialogue('You made it home, Turbo!');
    expect(renderer['data'].finalDialogue).toBe('You made it home, Turbo!');
  });

  it('defaults to empty dialogue', () => {
    expect(renderer['data'].finalDialogue).toBe('');
  });
});

describe('EndgameRenderer — Animation Progress', () => {
  let canvas: HTMLCanvasElement;
  let renderer: EndgameRenderer;

  beforeEach(() => {
    canvas = createCanvas();
    renderer = new EndgameRenderer(canvas);
  });

  afterEach(() => {
    renderer.dispose();
    canvas.remove();
  });

  it('resets animation progress on state change', () => {
    renderer.setState('won');
    expect(renderer['data'].animProgress).toBe(0);
  });
});

describe('EndgameRenderer — Restart Callback', () => {
  let canvas: HTMLCanvasElement;
  let renderer: EndgameRenderer;

  beforeEach(() => {
    canvas = createCanvas();
    renderer = new EndgameRenderer(canvas);
  });

  afterEach(() => {
    renderer.dispose();
    canvas.remove();
  });

  it('invokes onRestart when won and button clicked', () => {
    let restarted = false;
    renderer.setOnRestart(() => { restarted = true; });

    renderer.setState('won');

    // Simulate click within button bounds
    const mockEvent = {
      clientX: 400,
      clientY: 480,
    } as MouseEvent;

    renderer.handleClick(mockEvent);
    expect(restarted).toBe(true);
  });

  it('invokes onRestart when lost and button clicked', () => {
    let restarted = false;
    renderer.setOnRestart(() => { restarted = true; });

    renderer.setState('lost');

    const mockEvent = {
      clientX: 400,
      clientY: 480,
    } as MouseEvent;

    renderer.handleClick(mockEvent);
    expect(restarted).toBe(true);
  });

  it('does not restart when in playing state', () => {
    let restarted = false;
    renderer.setOnRestart(() => { restarted = true; });

    const mockEvent = {
      clientX: 400,
      clientY: 480,
    } as MouseEvent;

    renderer.handleClick(mockEvent);
    expect(restarted).toBe(false);
  });

  it('does not restart when click is outside button', () => {
    let restarted = false;
    renderer.setOnRestart(() => { restarted = true; });

    renderer.setState('won');

    const mockEvent = {
      clientX: 100,
      clientY: 100,
    } as MouseEvent;

    renderer.handleClick(mockEvent);
    expect(restarted).toBe(false);
  });
});

describe('EndgameRenderer — Menu Callback', () => {
  let canvas: HTMLCanvasElement;
  let renderer: EndgameRenderer;

  beforeEach(() => {
    canvas = createCanvas();
    renderer = new EndgameRenderer(canvas);
  });

  afterEach(() => {
    renderer.dispose();
    canvas.remove();
  });

  it('invokes onMenu callback when set', () => {
    let menued = false;
    renderer.setOnMenu(() => { menued = true; });

    expect(typeof renderer['onMenu']).toBe('function');
  });
});

describe('EndgameRenderer — Resize', () => {
  let canvas: HTMLCanvasElement;
  let renderer: EndgameRenderer;

  beforeEach(() => {
    canvas = createCanvas();
    renderer = new EndgameRenderer(canvas);
  });

  afterEach(() => {
    renderer.dispose();
    canvas.remove();
  });

  it('updates canvas dimensions', () => {
    renderer.resize(1024, 768);
    expect(canvas.width).toBe(1024);
    expect(canvas.height).toBe(768);
  });
});

describe('EndgameRenderer — Dispose', () => {
  let canvas: HTMLCanvasElement;
  let renderer: EndgameRenderer;

  beforeEach(() => {
    canvas = createCanvas();
    renderer = new EndgameRenderer(canvas);
  });

  afterEach(() => {
    canvas.remove();
  });

  it('stops render loop on dispose', () => {
    renderer.setState('won');
    renderer.dispose();

    expect(() => renderer.dispose()).not.toThrow();
  });
});
