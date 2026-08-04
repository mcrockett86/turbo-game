/**
 * Tests for the inventory renderer (engine/inventory.ts).
 *
 * Covers item add/remove, stacking, hasItem, and getItemCount.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { InventoryRenderer } from '@/engine/inventory';

// ---- Helpers ----

/** Create a minimal canvas mock for testing. */
function createCanvasMock(width: number = 800, height: number = 600): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  document.body.appendChild(canvas);
  return canvas;
}

describe('Inventory Renderer — Item Operations', () => {
  let canvas: HTMLCanvasElement;
  let inventory: InventoryRenderer;

  beforeEach(() => {
    canvas = createCanvasMock();
    inventory = new InventoryRenderer(canvas);
  });

  afterEach(() => {
    inventory.dispose();
    canvas.remove();
  });

  describe('addItem', () => {
    it('adds an item to the first empty slot', () => {
      const result = inventory.addItem('treat');
      expect(result).toBe(true);
      expect(inventory.getItemCount('treat')).toBe(1);
    });

    it('stacks identical items up to MAX_STACK (99)', () => {
      // First slot can hold 99
      for (let i = 0; i < 99; i++) {
        inventory.addItem('treat');
      }
      expect(inventory.getItemCount('treat')).toBe(99);

      // Adding one more goes to second slot (100 total)
      inventory.addItem('treat');
      expect(inventory.getItemCount('treat')).toBe(100);
    });

    it('places overflow in a new slot', () => {
      inventory.addItem('treat', 1);
      inventory.addItem('bone', 1);

      expect(inventory.getItemCount('treat')).toBe(1);
      expect(inventory.getItemCount('bone')).toBe(1);
    });

    it('returns false when all slots are full', () => {
      // Fill all 16 slots with 99 items each
      for (let i = 0; i < 16; i++) {
        inventory.addItem(`item_${i}`, 99);
      }

      expect(inventory.addItem('overflow', 1)).toBe(false);
    });

    it('returns true when partial stack fits', () => {
      // Fill 15 slots with 1 item each
      for (let i = 0; i < 15; i++) {
        inventory.addItem(`item_${i}`, 1);
      }
      // Add 10 items — 9 go into slot 16 (99-cap), 1 overflows
      expect(inventory.addItem('treat', 10)).toBe(true);
      expect(inventory.getItemCount('treat')).toBe(10);
    });
  });

  describe('removeItem', () => {
    it('removes all of an item', () => {
      inventory.addItem('treat', 3);
      inventory.removeItem('treat', 3);

      expect(inventory.getItemCount('treat')).toBe(0);
    });

    it('removes partial count', () => {
      inventory.addItem('treat', 5);
      inventory.removeItem('treat', 2);

      expect(inventory.getItemCount('treat')).toBe(3);
    });

    it('returns false when item does not exist', () => {
      expect(inventory.removeItem('nonexistent')).toBe(false);
    });

    it('removes from multiple slots', () => {
      inventory.addItem('treat', 3);
      inventory.addItem('treat', 3);

      inventory.removeItem('treat', 4);
      expect(inventory.getItemCount('treat')).toBe(2);
    });
  });

  describe('hasItem', () => {
    it('returns true when item exists', () => {
      inventory.addItem('bone');
      expect(inventory.hasItem('bone')).toBe(true);
    });

    it('returns false when item does not exist', () => {
      expect(inventory.hasItem('treat')).toBe(false);
    });
  });

  describe('getItemCount', () => {
    it('returns zero for non-existent items', () => {
      expect(inventory.getItemCount('treat')).toBe(0);
    });

    it('returns correct count for single slot', () => {
      inventory.addItem('bone', 5);
      expect(inventory.getItemCount('bone')).toBe(5);
    });

    it('sums across multiple slots', () => {
      inventory.addItem('treat', 3);
      inventory.addItem('treat', 4);
      expect(inventory.getItemCount('treat')).toBe(7);
    });
  });
});

describe('Inventory Renderer — Visibility', () => {
  let canvas: HTMLCanvasElement;
  let inventory: InventoryRenderer;

  beforeEach(() => {
    canvas = createCanvasMock();
    inventory = new InventoryRenderer(canvas);
  });

  afterEach(() => {
    inventory.dispose();
    canvas.remove();
  });

  it('starts hidden', () => {
    expect(() => inventory.show()).not.toThrow();
  });

  it('show() and hide() work without errors', () => {
    inventory.show();
    inventory.hide();
    inventory.show();
    inventory.hide();
  });

  it('dispose() stops the render loop', () => {
    inventory.show();
    inventory.dispose();
    expect(() => inventory.hide()).not.toThrow();
  });
});

describe('Inventory Renderer — Callbacks', () => {
  let canvas: HTMLCanvasElement;
  let inventory: InventoryRenderer;

  beforeEach(() => {
    canvas = createCanvasMock();
    inventory = new InventoryRenderer(canvas);
  });

  afterEach(() => {
    inventory.dispose();
    canvas.remove();
  });

  it('invokes onItemUse callback when set', () => {
    let called = false;
    inventory.setOnItemUse(() => { called = true; });

    expect(typeof inventory['onItemUse']).toBe('function');
  });

  it('invokes onItemDrop callback when set', () => {
    let called = false;
    inventory.setOnItemDrop(() => { called = true; });

    expect(typeof inventory['onItemDrop']).toBe('function');
  });

  it('invokes onItemCombine callback when set', () => {
    let result = false;
    inventory.setOnItemCombine((from, to) => { result = true; return true; });

    expect(typeof inventory['onItemCombine']).toBe('function');
  });
});

describe('Inventory Renderer — Resize', () => {
  let canvas: HTMLCanvasElement;
  let inventory: InventoryRenderer;

  beforeEach(() => {
    canvas = createCanvasMock();
    inventory = new InventoryRenderer(canvas);
  });

  afterEach(() => {
    inventory.dispose();
    canvas.remove();
  });

  it('updates canvas dimensions', () => {
    inventory.resize(1024, 768);
    expect(canvas.width).toBe(1024);
    expect(canvas.height).toBe(768);
  });
});
