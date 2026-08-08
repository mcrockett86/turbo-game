# Plan: 3D → 2D Top-Down Renderer

## Goal

Replace all Three.js WebGL rendering with Canvas 2D rendering. After conversion, **all three game views ("FP", "TP", and Search) use the same top-down camera perspective** — the game becomes a fully top-down 2D experience. Game data, state management, UI overlays, and game logic remain unchanged — only the rendering layer changes.

## Reference

The existing `SearchRenderer` (`src/engine/render/search-renderer.ts`) is already 2D and serves as the architectural template. It uses:
- `CanvasRenderingContext2D` for all drawing
- Camera offset + transform for viewport centering
- Direct shape drawing (rectangles, arcs, paths)
- `requestAnimationFrame` loop with delta timing
- Bound event listeners with proper cleanup

## Scope

| Renderer | Status | Zones Affected |
|----------|--------|----------------|
| `FpRoomRenderer` | Replace | apartment, shelter, neighborhood, home, pet_store, garden, library, market, cave (9 zones, ~50 rooms) |
| `TpEngine` | Replace | dog_park, lake, dog_show, forest, beach, mountain, waterfall, park_secret (8 zones) |
| `SearchRenderer` | Already 2D | — |

Total: **17 zones → 2D rendering**

## Architecture

### New Files

| File | Purpose |
|------|---------|
| `src/engine/render/fp-room-renderer-2d.ts` | 2D top-down FP room renderer |
| `src/engine/render/tp-engine-2d.ts` | 2D top-down TP zone renderer |

### Retained Files (unchanged)

- `src/engine/render/search-renderer.ts` — already 2D
- `src/main.ts` — wiring updated to use 2D renderers
- `src/config.ts` — no changes needed
- `src/data.ts` — no changes needed
- `src/types.ts` — no changes needed
- `src/engine/state.ts` — no changes needed
- All overlay renderers (HUD, dialogue, inventory, etc.) — unchanged

### Architecture Diagram

```
main.ts
  ├── FpRoomRenderer2D  ← replaces FpRoomRenderer (fp-view canvas, now top-down)
  ├── TpEngine2D        ← replaces TpEngine (tp-view canvas, now top-down)
  ├── SearchRenderer    ← unchanged (human-view canvas)
  └── Overlay renderers ← unchanged (all canvas overlays)

Note: FpRoomRenderer2D and TpEngine2D share the same camera model
(top-down orthographic). They differ only in scene content:
- FP renderer: enclosed rooms with walls, doors, room features
- TP renderer: open area with obstacles, NPCs, scattered features
```

## Camera Perspective Convergence

After this migration, **all three game views use the same top-down camera**:

| View | Before | After |
|------|--------|-------|
| FP (room zones) | First-person 3D walk-through | Top-down room map |
| TP (open zones) | Third-person open world | Top-down open world |
| Search | Already top-down 2D | Already top-down 2D |

The visual perspective is identical — a bird's-eye view centered on the player. The difference is **gameplay structure**, not camera angle:
- FP zones = enclosed rooms with door-based transitions
- TP zones = open areas with obstacles and NPC interactions
- Search = static top-down puzzle view (unchanged)

This is a simplification: the rendering code between FP and TP will share more patterns than the current 3D versions do.

## Rendering Model (Canvas 2D)

### Common Pattern (from SearchRenderer)

```typescript
class Base2DRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private cameraOffset = { x: 0, y: 0 }; // world → screen center
  private worldScale = 1; // world units → pixels

  protected saveWorldTransform(): void {
    this.ctx.save();
    this.ctx.translate(
      this.canvas.width / 2 - this.cameraOffset.x * this.worldScale,
      this.canvas.height / 2 - this.cameraOffset.y * this.worldScale
    );
    this.ctx.scale(this.worldScale, this.worldScale);
  }

  protected restoreWorldTransform(): void {
    this.ctx.restore();
  }

  // Draw in world coords (auto-transformed)
  protected drawRect(x, y, w, h, fill): void {
    this.ctx.fillStyle = fill;
    this.ctx.fillRect(x, y, w, h);
  }

  // Draw in screen coords (no transform)
  protected drawScreenRect(x, y, w, h, fill): void {
    this.ctx.fillStyle = fill;
    this.ctx.fillRect(x, y, w, h);
  }
}
```

### FP Room (Top-Down Map View)

**What the 3D version does:**
- 3D room with floor, 4 walls, ceiling (PerspectiveCamera looking down)
- Feature markers (3D boxes with glow rings)
- Exit markers (door frames + arrows)
- Fog (Three.js Fog)
- Lighting (ambient + directional + point)

**2D replacement — identical camera to TP and Search:**

```
┌─────────────────────────┐
│  [wall]                 │
│  ┌───────────────────┐  │
│  │                   │  │
│  │   [feature]       │  │
│  │                   │  │
│  │      ● player     │  │
│  │                   │  │
│  │   [feature]       │  │
│  └───────────────────┘  │
│          [exit]         │
└─────────────────────────┘
```

- **Floor**: filled rectangle in room color
- **Walls**: 4 border rectangles (darker shade of wall color)
- **Ceiling**: not visible in top-down (skip)
- **Features**: colored shapes + emoji/icon + label sprite
- **Exits**: door rectangle on wall + arrow indicator
- **Fog**: radial gradient vignette from center to edges (zone-aware)
- **Lighting**: overlay tint (warm/cool) based on time-of-day
- **Player**: small circle/emoji with direction indicator

### TP Zone (Top-Down Open World)

**What the 3D version does:**
- Open world ground plane with grass patches
- Procedural dog model (3D primitives)
- NPC dog models (3D primitives)
- Obstacles: fences, trees, benches, bushes
- Scent trail (particle system)
- Features: water bowls, fire hydrants, scent posts, treasure, return gates
- Fog (zone-aware)
- Lighting (ambient + directional + hemisphere)

**2D replacement:**

```
        [tree]
            ⬤
    ┌───────────────┐
    │  ╱╲  [bench]  │
    │ ╱  ╲          │
    │●─────────●    │  ← player + NPC
    │ ╲  ╱          │
    │  ╲╱  [tree]   │
    │       ⬤       │
    └───────────────┘
```

- **Ground**: filled rectangle in ground color + scattered grass patches
- **Trees**: green circle (canopy) + brown rectangle (trunk)
- **Fences**: series of small rectangles (posts) + horizontal lines (rails)
- **Benches**: brown rectangle with legs
- **Bushes**: cluster of green circles
- **Dog player**: top-down dog shape (ellipse body + circle head) or emoji 🐕
- **NPC dogs**: same shape, different color
- **Scent trail**: fading dots behind player
- **Features**: colored icons/shapes with emoji + label
- **Fog**: radial gradient from player position
- **Lighting**: sky color overlay with opacity based on zone time-of-day

### Player Sprite

```
Top-down dog shape:
    ┌───┐
    │ 👃│ nose (front)
   ┌┴───┴┐
   │ ◉ ◉ │ eyes
   │     │
  ┌┴─────┴┐
  │ ◄ body ►│
  └───────┘
```

Simplified: ellipse body + circle head with direction indicator (line from center showing facing direction).

## Implementation Steps

### Step 1: FP Room 2D Renderer (`fp-room-renderer-2d.ts`)

- [ ] Create `FpRoomRenderer2D` class with same public API as `FpRoomRenderer`
  - `init(zoneId, zoneData, roomIndex)`
  - `handleKeyDown(e)`, `handleKeyUp(e)`
  - `setOnFeatureClick(cb)`, `setOnExitClick(cb)`
  - `moveTo(x, z)`, `getCameraPosition()`
  - `dispose()`
- [ ] Implement `buildRoom()` — draw floor, walls, features, exits
- [ ] Implement `render()` — clear → save transform → draw room → restore → draw HUD overlay
- [ ] Implement `update(delta)` — movement, collision with walls, feature proximity
- [ ] Implement fog as radial gradient from player position
- [ ] Implement lighting overlay per zone
- [ ] Replicate hover effect (scale glow ring → brighten feature border)
- [ ] Replicate exit arrow animation (rotation)
- [ ] Replicate feature glow pulse animation

### Step 2: TP Zone 2D Renderer (`tp-engine-2d.ts`)

- [ ] Create `TpEngine2D` class with same public API as `TpEngine`
  - `init(zoneId, zoneData)`
  - `onKeyDown(key)`, `onKeyUp(key)`
  - `update(delta, time)`
  - `setOnFeatureClick(cb)`, `setOnNpcClick(cb)`
  - `resize(w, h)`, `dispose()`
- [ ] Implement `buildZone()` — draw ground, obstacles, features, NPCs
- [ ] Implement `render()` — clear → save transform → draw world → restore → draw player/NPCs → restore → draw HUD
- [ ] Implement `update(delta)` — player movement, NPC AI, obstacle collision
- [ ] Implement dog sprite (top-down shape or emoji)
- [ ] Implement NPC dog sprites (colored top-down shapes)
- [ ] Implement scent trail (fading dots)
- [ ] Replicate obstacle collision (circle vs rect/circle hitboxes)
- [ ] Replicate NPC wander AI (target-based movement)
- [ ] Replicate feature click detection (raycasting → distance check in world coords)
- [ ] Replicate NPC click detection
- [ ] Implement fog as radial gradient from player
- [ ] Implement zone lighting overlay

### Step 3: Wire Up `main.ts`

- [ ] Import `FpRoomRenderer2D` and `TpEngine2D`
- [ ] Replace `FpRoomRenderer` type with `FpRoomRenderer2D` in `fpRenderer` variable
- [ ] Replace `TpEngine` type with `TpEngine2D` in `tpEngine` variable
- [ ] Update `startFPView()` to instantiate `FpRoomRenderer2D`
- [ ] Update `startTPView()` to instantiate `TpEngine2D`
- [ ] Update `transitionToZone()` dispose logic
- [ ] Update `resetGame()` dispose logic
- [ ] Remove Three.js import from `main.ts` (if only used for renderer types)

### Step 4: Remove Three.js Dependency

- [ ] Remove `import * as THREE from 'three'` from `fp-room-renderer-2d.ts` and `tp-engine-2d.ts`
- [ ] Evaluate if Three.js is still needed elsewhere (it's used by the old renderers)
- [ ] If old renderers are fully replaced, remove Three.js from `package.json`
- [ ] Update `tsconfig` if needed

### Step 5: Update `index.html`

- [ ] Verify all canvas elements have `tabindex="0"` where needed (already done for human-canvas)
- [ ] Consider adding `cursor: none` or custom cursor for game canvases

### Step 6: CSS Adjustments

- [ ] Review `style.css` for any Three.js-specific canvas styling
- [ ] Ensure overlay positioning works with 2D rendering
- [ ] Test responsive canvas sizing

### Step 7: Build & Test

- [ ] `npm run build` — verify no TypeScript errors
- [ ] Test all FP zones (apartment, shelter, neighborhood, home, pet_store, garden, library, market, cave)
- [ ] Test all TP zones (dog_park, lake, dog_show, forest, beach, mountain, waterfall, park_secret)
- [ ] Test search view (unchanged)
- [ ] Test zone transitions
- [ ] Test all interactions (feature clicks, exit clicks, NPC clicks)
- [ ] Test movement and collision
- [ ] Test happiness decay
- [ ] Test inventory, companions, hints panels
- [ ] Test game win/lose conditions
- [ ] Test dog selection screen

## Data Mapping

### Room Data → 2D

| 3D Property | 2D Usage | Notes |
|-------------|----------|-------|
| `room.w` | room width (pixels) | Direct mapping |
| `room.d` | room depth (pixels) | Direct mapping |
| `room.h` | wall thickness/height | Not visible in top-down; may use for wall "thickness" visual (extruded edge effect) |
| `room.color` | floor fill color | Direct mapping |
| `room.exits[]` | door positions on walls | Use exit index to determine wall position |
| `room.features[]` | feature positions | `x, y` → 2D position; `w, h` → shape size |

### Zone Data → 2D

| 3D Property | 2D Usage | Notes |
|-------------|----------|-------|
| `zone.skyColor` | sky/background tint | Used as fade color on zone transitions |
| `zone.groundColor` | ground fill color | Direct mapping |
| `zone.dogColor` | player dog body color | Direct mapping |
| `zone.accentColor` | UI/feature accent | Direct mapping |
| `zone.obstacles[]` | obstacle shapes | `x, z` → 2D position; `width, height` → size |
| `zone.npcs[]` | NPC positions | `x, z` → 2D position; `color` → dog body color |
| `zone.features[]` | feature positions | `x, z` → 2D position; `w, h` → size |

## Removed Three.js Features

| Feature | 2D Replacement |
|---------|----------------|
| 3D geometry (BoxGeometry, PlaneGeometry, etc.) | Canvas 2D `fillRect`, `arc`, `ellipse`, `path` |
| MeshStandardMaterial | Canvas fillStyle/strokeStyle |
| PerspectiveCamera | None (top-down = fixed orthographic, identical for FP/TP/Search) |
| WebGLRenderer | Canvas 2D `fillRect`, `fillText`, etc. |
| Fog | Radial gradient overlay |
| Lighting (ambient, directional, point, hemisphere) | Color overlay with opacity |
| ShadowMap | None (flat 2D) |
| Raycaster | Distance check from click position to objects in world coords |
| Sprite (labels) | `fillText` with background rect |
| CanvasTexture (labels) | `fillText` with background rect |
| Animation (tail wag, leg swing) | Simple shape offset, color pulse, or emoji swap |
| Transition animations | CSS transitions or Canvas 2D interpolation |

## Risk Assessment

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Feature click detection breaks | Medium | Use distance-based hit testing instead of raycasting |
| Room collision different in 2D | Low | Same AABB collision, just no Y-axis |
| NPC wander AI needs tuning | Medium | Use same logic, adjust speed/scale |
| Visual fidelity loss | Medium | This is intentional; focus on clarity over realism |
| Performance regression | Low | Canvas 2D is generally faster than WebGL for this complexity |
| Zone transition visual mismatch | Low | Use CSS transitions for screen fades |
| FP/TP visual disconnect feels jarring | Low | Both use same top-down camera — actually a benefit, not a risk |

## Success Criteria

1. All 17 zones render correctly in 2D with consistent top-down perspective
2. All interactions work (features, exits, NPCs)
3. Movement and collision feel good
4. Build succeeds with no Three.js dependency
5. Visual style is clear and readable
6. No regression in game logic (happiness, inventory, companions, etc.)
7. FP/TP zone transitions feel visually consistent (same camera, different layout)
