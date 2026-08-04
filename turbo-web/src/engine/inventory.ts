/**
 * Inventory System — Phase 3.2
 *
 * 4x4 grid inventory with pickup, use, and combine mechanics.
 * Items have type, icon, description, and usage effects.
 */

import { ITEMS } from '@/data';
import type { Item, InventorySlot } from '@/types';

// ---- Constants ----
const INVENTORY_SIZE = 4; // 4x4 grid
const MAX_STACK = 99;

// ---- Item Type Map ----
const ITEM_TYPES: Record<string, { icon: string; category: string }> = {
  treat: { icon: '🍖', category: 'food' },
  bone: { icon: '🦴', category: 'tool' },
  collar_piece: { icon: '🔑', category: 'key' },
  compass: { icon: '🧭', category: 'tool' },
  water_bottle: { icon: '💧', category: 'food' },
  comfort_stone: { icon: '💎', category: 'comfort' },
  photo_fragment: { icon: '📷', category: 'clue' },
  home_key: { icon: '🗝️', category: 'key' },
};

// ---- Renderer ----
export class InventoryRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private slots: InventorySlot[];
  private selectedItem: number | null = null;
  private isVisible: boolean;
  private onItemUse: ((item: Item) => void) | null = null;
  private onItemDrop: ((item: Item) => void) | null = null;
  private onItemCombine: ((from: Item, to: Item) => boolean) | null = null;
  private animFrame: number | null = null;
  private lastTime: number;
  private hoverSlot: number | null = null;
  private pulseTime: number;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.slots = Array.from({ length: INVENTORY_SIZE * INVENTORY_SIZE }, () => ({
      item: null,
      count: 0,
    }));
    this.isVisible = false;
    this.lastTime = 0;
    this.pulseTime = 0;
  }

  /** Add item to inventory */
  addItem(itemId: string, count: number = 1): boolean {
    const itemDef = { id: itemId, ...ITEMS[itemId as keyof typeof ITEMS] };
    if (!itemDef) return false;

    // Try to stack existing
    for (const slot of this.slots) {
      if (slot.item?.id === itemId && slot.count < MAX_STACK) {
        const add = Math.min(count, MAX_STACK - slot.count);
        slot.count += add;
        count -= add;
        if (count <= 0) return true;
      }
    }

    // Find empty slot
    for (const slot of this.slots) {
      if (!slot.item) {
        slot.item = itemDef;
        slot.count = Math.min(count, MAX_STACK);
        count -= slot.count;
        if (count <= 0) return true;
      }
    }

    return count <= 0;
  }

  /** Remove item from inventory */
  removeItem(itemId: string, count: number = 1): boolean {
    let remaining = count;
    for (let i = this.slots.length - 1; i >= 0; i--) {
      const slot = this.slots[i];
      if (slot.item?.id === itemId) {
        const remove = Math.min(remaining, slot.count);
        slot.count -= remove;
        remaining -= remove;
        if (slot.count <= 0) {
          slot.item = null;
          slot.count = 0;
        }
        if (remaining <= 0) return true;
      }
    }
    return remaining <= 0;
  }

  /** Get item count */
  getItemCount(itemId: string): number {
    let total = 0;
    for (const slot of this.slots) {
      if (slot.item?.id === itemId) {
        total += slot.count;
      }
    }
    return total;
  }

  /** Has item */
  hasItem(itemId: string): boolean {
    return this.getItemCount(itemId) > 0;
  }

  /** Toggle visibility */
  toggle(): void {
    this.isVisible = !this.isVisible;
    if (this.isVisible) {
      this.lastTime = performance.now();
      this.startRenderLoop();
    } else {
      if (this.animFrame) {
        cancelAnimationFrame(this.animFrame);
        this.animFrame = null;
      }
    }
  }

  /** Show inventory */
  show(): void {
    this.isVisible = true;
    this.lastTime = performance.now();
    this.startRenderLoop();
  }

  /** Hide inventory */
  hide(): void {
    this.isVisible = false;
    if (this.animFrame) {
      cancelAnimationFrame(this.animFrame);
      this.animFrame = null;
    }
  }

  /** Main render loop */
  private startRenderLoop(): void {
    const loop = (time: number) => {
      if (!this.isVisible) return;
      const delta = (time - this.lastTime) / 1000;
      this.lastTime = time;
      this.pulseTime += delta;
      this.render();
      this.animFrame = requestAnimationFrame(loop);
    };
    this.animFrame = requestAnimationFrame(loop);
  }

  /** Render inventory */
  private render(): void {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Background overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, w, h);

    // Inventory panel
    const panelW = Math.min(400, w * 0.8);
    const panelH = Math.min(400, h * 0.8);
    const panelX = (w - panelW) / 2;
    const panelY = (h - panelH) / 2;

    // Panel background
    ctx.fillStyle = '#2a2a3a';
    ctx.fillRect(panelX, panelY, panelW, panelH);

    // Panel border
    ctx.strokeStyle = '#555577';
    ctx.lineWidth = 3;
    ctx.strokeRect(panelX, panelY, panelW, panelH);

    // Title
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('INVENTORY', w / 2, panelY + 15);

    // Grid
    const gridX = panelX + 20;
    const gridY = panelY + 50;
    const cellSize = Math.min((panelW - 40) / INVENTORY_SIZE, (panelH - 100) / INVENTORY_SIZE, 80);
    const gap = 8;

    for (let row = 0; row < INVENTORY_SIZE; row++) {
      for (let col = 0; col < INVENTORY_SIZE; col++) {
        const idx = row * INVENTORY_SIZE + col;
        const cellX = gridX + col * (cellSize + gap);
        const cellY = gridY + row * (cellSize + gap);

        // Cell background
        const isHover = this.hoverSlot === idx;
        const isSelected = this.selectedItem === idx;
        ctx.fillStyle = isSelected ? '#444466' : isHover ? '#3a3a5a' : '#1a1a2a';
        ctx.fillRect(cellX, cellY, cellSize, cellSize);

        // Cell border
        ctx.strokeStyle = isSelected ? '#ffcc00' : isHover ? '#666688' : '#333344';
        ctx.lineWidth = isSelected ? 2 : 1;
        ctx.strokeRect(cellX, cellY, cellSize, cellSize);

        // Item
        const slot = this.slots[idx];
        if (slot.item) {
          const itemInfo = ITEM_TYPES[slot.item.id];
          const icon = itemInfo?.icon || '❓';

          // Icon
          ctx.font = `${cellSize * 0.5}px serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(icon, cellX + cellSize / 2, cellY + cellSize * 0.4);

          // Count
          if (slot.count > 1) {
            ctx.fillStyle = '#ffffff';
            ctx.font = `bold ${cellSize * 0.18}px monospace`;
            ctx.textAlign = 'right';
            ctx.textBaseline = 'bottom';
            ctx.fillText(String(slot.count), cellX + cellSize - 4, cellY + cellSize - 4);
          }
        }
      }
    }

    // Item info panel (right side)
    if (this.selectedItem !== null && this.selectedItem < this.slots.length) {
      const slot = this.slots[this.selectedItem];
      if (slot.item) {
        const infoX = panelX + panelW - 160;
        const infoY = panelY + 50;

        ctx.fillStyle = '#1a1a2a';
        ctx.fillRect(infoX, infoY, 140, 120);
        ctx.strokeStyle = '#555577';
        ctx.lineWidth = 1;
        ctx.strokeRect(infoX, infoY, 140, 120);

        // Item name
        ctx.fillStyle = '#ffcc00';
        ctx.font = 'bold 14px monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(slot.item.name, infoX + 10, infoY + 10);

        // Description
        ctx.fillStyle = '#cccccc';
        ctx.font = '11px monospace';
        const descLines = this.wrapText(slot.item.desc || '', 120, 13);
        for (let i = 0; i < descLines.length; i++) {
          ctx.fillText(descLines[i], infoX + 10, infoY + 35 + i * 13);
        }

        // Use button
        const useX = infoX + 10;
        const useY = infoY + 100;
        ctx.fillStyle = '#44aa44';
        ctx.fillRect(useX, useY, 50, 20);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('USE', useX + 25, useY + 14);
      }
    }

    // Close hint
    ctx.fillStyle = '#888888';
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('Press I to close', w / 2, panelY + panelH - 10);
  }

  /** Wrap text for display */
  private wrapText(text: string, maxWidth: number, lineHeight: number): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let line = '';

    for (const word of words) {
      const testLine = line + word + ' ';
      if (this.ctx.measureText(testLine).width > maxWidth && line !== '') {
        lines.push(line.trim());
        line = word + ' ';
      } else {
        line = testLine;
      }
    }
    if (line.trim()) lines.push(line.trim());
    return lines;
  }

  /** Handle mouse hover */
  handleMouseMove(e: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const panelW = Math.min(400, this.canvas.width * 0.8);
    const panelH = Math.min(400, this.canvas.height * 0.8);
    const panelX = (this.canvas.width - panelW) / 2;
    const panelY = (this.canvas.height - panelH) / 2;

    const gridX = panelX + 20;
    const gridY = panelY + 50;
    const cellSize = Math.min((panelW - 40) / INVENTORY_SIZE, (panelH - 100) / INVENTORY_SIZE, 80);
    const gap = 8;

    let found = -1;
    for (let row = 0; row < INVENTORY_SIZE; row++) {
      for (let col = 0; col < INVENTORY_SIZE; col++) {
        const idx = row * INVENTORY_SIZE + col;
        const cellX = gridX + col * (cellSize + gap);
        const cellY = gridY + row * (cellSize + gap);
        if (mx >= cellX && mx <= cellX + cellSize && my >= cellY && my <= cellY + cellSize) {
          found = idx;
        }
      }
    }
    this.hoverSlot = found;
  }

  /** Handle mouse click */
  handleClick(e: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const panelW = Math.min(400, this.canvas.width * 0.8);
    const panelH = Math.min(400, this.canvas.height * 0.8);
    const panelX = (this.canvas.width - panelW) / 2;
    const panelY = (this.canvas.height - panelH) / 2;

    const gridX = panelX + 20;
    const gridY = panelY + 50;
    const cellSize = Math.min((panelW - 40) / INVENTORY_SIZE, (panelH - 100) / INVENTORY_SIZE, 80);
    const gap = 8;

    for (let row = 0; row < INVENTORY_SIZE; row++) {
      for (let col = 0; col < INVENTORY_SIZE; col++) {
        const idx = row * INVENTORY_SIZE + col;
        const cellX = gridX + col * (cellSize + gap);
        const cellY = gridY + row * (cellSize + gap);
        if (mx >= cellX && mx <= cellX + cellSize && my >= cellY && my <= cellY + cellSize) {
          this.selectedItem = this.selectedItem === idx ? null : idx;
          return;
        }
      }
    }

    // Check use button
    const infoX = panelX + panelW - 160;
    const infoY = panelY + 170;
    if (
      this.selectedItem !== null &&
      this.selectedItem < this.slots.length &&
      this.slots[this.selectedItem].item &&
      mx >= infoX + 10 &&
      mx <= infoX + 60 &&
      my >= infoY &&
      my <= infoY + 20
    ) {
      const item = this.slots[this.selectedItem].item!;
      this.onItemUse?.(item);
    }
  }

  // ---- Callbacks ----
  setOnItemUse(fn: (item: Item) => void): void {
    this.onItemUse = fn;
  }

  setOnItemDrop(fn: (item: Item) => void): void {
    this.onItemDrop = fn;
  }

  setOnItemCombine(fn: (from: Item, to: Item) => boolean): void {
    this.onItemCombine = fn;
  }

  /** Resize */
  resize(w: number, h: number): void {
    this.canvas.width = w;
    this.canvas.height = h;
  }

  /** Dispose */
  dispose(): void {
    if (this.animFrame) {
      cancelAnimationFrame(this.animFrame);
    }
  }
}
