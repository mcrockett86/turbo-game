/**
 * Hint/Route System — Phase 3.4
 *
 * Progressive hint unlocks and route display for finding home.
 * Hints unlock as the player collects clues and progresses.
 * Routes show the path from current location to home.
 */

// ---- Hint Definitions ----
interface Hint {
  id: string;
  title: string;
  description: string;
  unlockCondition: string;
  unlockText: string;
  icon: string;
  category: 'route' | 'clue' | 'tip';
}

// ---- Route Definitions ----
interface RouteSegment {
  from: string;
  to: string;
  distance: number;
  description: string;
  requirement?: string;
  revealed: boolean;
}

// ---- Hint Data ----
const HINTS: Record<string, Hint> = {
  tree_clue: {
    id: 'tree_clue',
    title: 'Old Tree Marker',
    description: 'You remember scratching your name under this tree. The shelter is probably nearby.',
    unlockCondition: 'found_tree',
    unlockText: 'You found a familiar tree!',
    icon: '🌳',
    category: 'clue',
  },
  first_crossing: {
    id: 'first_crossing',
    title: 'First Road',
    description: 'Cross the road carefully when there is a gap in traffic. Cars go fast!',
    unlockCondition: 'near_road',
    unlockText: 'You see a road ahead...',
    icon: '🚗',
    category: 'tip',
  },
  park_entrance: {
    id: 'park_entrance',
    title: 'Park Entrance',
    description: 'The park has a big gate. Look for the blue sign that says "Pine Ridge Park".',
    unlockCondition: 'found_park',
    unlockText: 'You found the park entrance!',
    icon: '🏞️',
    category: 'route',
  },
  water_bowl_help: {
    id: 'water_bowl',
    title: 'Water Bowl',
    description: 'A water bowl might be near a house. Dogs usually drink near homes!',
    unlockCondition: 'near_water',
    unlockText: 'You spotted a water bowl!',
    icon: '💧',
    category: 'clue',
  },
  shelter_direction: {
    id: 'shelter_direction',
    title: 'Shelter Direction',
    description: 'The shelter is north of here. You can smell it! Follow the scent trail.',
    unlockCondition: 'has_compass',
    unlockText: 'Your compass points north!',
    icon: '🧭',
    category: 'route',
  },
  home_found: {
    id: 'home_found',
    title: 'Home!',
    description: 'You found your home! The golden gate and the smell of home.',
    unlockCondition: 'at_home',
    unlockText: 'You are home!',
    icon: '🏠',
    category: 'route',
  },
};

// ---- Route Data ----
const ROUTES: RouteSegment[] = [
  {
    from: 'suburban_streets',
    to: 'park_entrance',
    distance: 200,
    description: 'Follow the sidewalk to Pine Ridge Park',
    revealed: false,
  },
  {
    from: 'park_entrance',
    to: 'lake_clearing',
    distance: 150,
    description: 'Walk along the lake path',
    revealed: false,
  },
  {
    from: 'lake_clearing',
    to: 'shelter_road',
    distance: 300,
    description: 'Take the road north toward the shelter',
    requirement: 'has_compass',
    revealed: false,
  },
  {
    from: 'shelter_road',
    to: 'home',
    distance: 100,
    description: 'Follow the scent trail to your home',
    revealed: false,
  },
];

// ---- Renderer ----
export class HintRouteRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private unlockedHints: Set<string>;
  private revealedRoutes: Set<string>;
  private selectedHint: string | null = null;
  private isVisible: boolean;
  private animFrame: number | null = null;
  private lastTime: number;
  private onHintSelect: ((hint: Hint) => void) | null = null;
  private onRouteSelect: ((route: RouteSegment) => void) | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.unlockedHints = new Set();
    this.revealedRoutes = new Set();
    this.isVisible = false;
    this.lastTime = 0;
  }

  /** Unlock a hint */
  unlockHint(hintId: string): void {
    const hint = HINTS[hintId];
    if (hint && !this.unlockedHints.has(hintId)) {
      this.unlockedHints.add(hintId);
      this.onHintSelect?.(hint);
    }
  }

  /** Reveal a route */
  revealRoute(from: string, to: string): void {
    const route = ROUTES.find((r) => r.from === from && r.to === to);
    if (route && !this.revealedRoutes.has(route.from)) {
      this.revealedRoutes.add(route.from);
      this.onRouteSelect?.(route);
    }
  }

  /** Check if hint can be unlocked */
  canUnlockHint(hintId: string, flags: Record<string, boolean>): boolean {
    const hint = HINTS[hintId];
    if (!hint) return false;
    return !!flags[hint.unlockCondition];
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

  /** Show */
  show(): void {
    this.isVisible = true;
    this.lastTime = performance.now();
    this.startRenderLoop();
  }

  /** Hide */
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
      this.render();
      this.animFrame = requestAnimationFrame(loop);
    };
    this.animFrame = requestAnimationFrame(loop);
  }

  /** Render hint/route panel */
  private render(): void {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Background overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, w, h);

    // Panel
    const panelW = Math.min(350, w * 0.7);
    const panelH = Math.min(500, h * 0.8);
    const panelX = (w - panelW) / 2;
    const panelY = (h - panelH) / 2;

    ctx.fillStyle = '#1a1a2a';
    ctx.fillRect(panelX, panelY, panelW, panelH);
    ctx.strokeStyle = '#444466';
    ctx.lineWidth = 2;
    ctx.strokeRect(panelX, panelY, panelW, panelH);

    // Title
    ctx.fillStyle = '#ffcc00';
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('HINTS & ROUTES', w / 2, panelY + 15);

    // Unlocked hints section
    const hintsY = panelY + 50;
    let y = hintsY;

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('UNLOCKED HINTS', panelX + 15, y);
    y += 25;

    // Divider
    ctx.strokeStyle = '#333344';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(panelX + 15, y);
    ctx.lineTo(panelX + panelW - 15, y);
    ctx.stroke();
    y += 10;

    // Hint items
    for (const hintId of this.unlockedHints) {
      const hint = HINTS[hintId];
      if (!hint) continue;

      const isSelected = this.selectedHint === hintId;
      ctx.fillStyle = isSelected ? '#333355' : '#0a0a1a';
      ctx.fillRect(panelX + 15, y, panelW - 30, 60);

      if (isSelected) {
        ctx.strokeStyle = '#ffcc00';
        ctx.lineWidth = 2;
        ctx.strokeRect(panelX + 15, y, panelW - 30, 60);
      }

      // Icon
      ctx.font = '24px serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(hint.icon, panelX + 20, y + 5);

      // Title
      ctx.fillStyle = isSelected ? '#ffcc00' : '#ffffff';
      ctx.font = 'bold 13px monospace';
      ctx.fillText(hint.title, panelX + 55, y + 8);

      // Description (short)
      ctx.fillStyle = '#aaaaaa';
      ctx.font = '11px monospace';
      const desc = hint.description.substring(0, 50) + (hint.description.length > 50 ? '...' : '');
      ctx.fillText(desc, panelX + 55, y + 30);

      y += 70;
    }

    // Routes section
    const routesY = y + 20;
    if (routesY < panelY + panelH - 80) {
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'left';
      ctx.fillText('REVEALED ROUTES', panelX + 15, routesY);
      y = routesY + 25;

      // Divider
      ctx.strokeStyle = '#333344';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(panelX + 15, y);
      ctx.lineTo(panelX + panelW - 15, y);
      ctx.stroke();
      y += 10;

      // Route items
      for (const route of ROUTES) {
        if (!this.revealedRoutes.has(route.from)) continue;

        const isRevealed = this.revealedRoutes.has(route.from);
        ctx.fillStyle = isRevealed ? '#0a2a0a' : '#1a1a1a';
        ctx.fillRect(panelX + 15, y, panelW - 30, 40);

        // Arrow icon
        ctx.font = '16px serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText('→', panelX + 20, y + 8);

        // Route info
        ctx.fillStyle = '#ffffff';
        ctx.font = '11px monospace';
        ctx.fillText(`${route.from} → ${route.to}`, panelX + 45, y + 8);

        // Distance
        ctx.fillStyle = '#888888';
        ctx.font = '10px monospace';
        ctx.fillText(`${route.distance}m`, panelX + 20, y + 28);

        y += 50;
      }
    }

    // Close hint
    ctx.fillStyle = '#888888';
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('Press H to close', w / 2, panelY + panelH - 10);
  }

  /** Handle click */
  handleClick(e: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const panelW = Math.min(350, this.canvas.width * 0.7);
    const panelH = Math.min(500, this.canvas.height * 0.8);
    const panelX = (this.canvas.width - panelW) / 2;
    const panelY = (this.canvas.height - panelH) / 2;

    // Check hint items
    let y = panelY + 80;
    for (const hintId of this.unlockedHints) {
      const hint = HINTS[hintId];
      if (!hint) continue;

      if (
        mx >= panelX + 15 &&
        mx <= panelX + panelW - 15 &&
        my >= y &&
        my <= y + 60
      ) {
        this.selectedHint = this.selectedHint === hintId ? null : hintId;
        if (this.selectedHint) {
          this.onHintSelect?.(hint);
        }
        return;
      }
      y += 70;
    }
  }

  /** Get unlocked hints */
  getUnlockedHints(): Hint[] {
    return Array.from(this.unlockedHints)
      .map((id) => HINTS[id])
      .filter((h): h is Hint => !!h);
  }

  /** Get revealed routes */
  getRevealedRoutes(): RouteSegment[] {
    return ROUTES.filter((r) => this.revealedRoutes.has(r.from));
  }

  // ---- Callbacks ----
  setOnHintSelect(fn: (hint: Hint) => void): void {
    this.onHintSelect = fn;
  }

  setOnRouteSelect(fn: (route: RouteSegment) => void): void {
    this.onRouteSelect = fn;
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
