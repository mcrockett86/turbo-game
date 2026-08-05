# Turbo: Lost & Found — Development Plan

## Task State Machine

> **How to use:** This plan is the source of truth. Each session should:
> 1. Read this file to find the first `TODO` item
> 2. Work on it, applying code to the project
> 3. Update its status to `✅ DONE` when complete
> 4. Move on to the next `TODO`
>
> **Statuses:** `TODO` → `IN_PROGRESS` → `DONE`
> **Rule:** Only one `IN_PROGRESS` at a time. Never skip ahead.

| # | Component | Status | Notes |
|---|-----------|--------|-------|
| 1.1 | Vite + TS setup | ✅ DONE | package.json, vite.config.ts, tsconfig.json |
| 1.2 | Entry HTML + types + config | ✅ DONE | index.html, types.ts, config.ts |
| 1.3 | Game data | ✅ DONE | data.ts (5 dogs, 5 zones, 8 items, 5 threats) |
| 1.4 | State manager | ✅ DONE | engine/state.ts (pub/sub, save/load, transitions) |
| 1.5 | Audio manager | ✅ DONE | engine/audio.ts (Howler + Web Audio fallback) |
| 1.6 | Bootstrap / dog select | ✅ DONE | main.ts (bootstrap, dog select, procedural portraits) |
| 1.7 | Build verified | ✅ DONE | `vite build` compiles cleanly (10 modules, ~512KB) |
| 2.1 | FP room renderer | ✅ DONE | Three.js rooms, WASD, features, exits, fog, lighting |
| 2.2 | TP adventure renderer | ✅ DONE | Dog model, NPC wander, obstacles, scent trail |
| 2.3 | Human search interlude | ✅ DONE | Top-down map, scent markers, compass |
| 2.4 | Threat system | ✅ DONE | Traffic timing, cat/bully combat, storm, vacuum |
| 3.1 | Manga cutaway combat | ✅ DONE | Panel layout, QTE mini-game, effects |
| 3.2 | Inventory system | ✅ DONE | 4x4 grid, pickup, use, combine |
| 3.3 | Companion system | ✅ DONE | Meet, manage, active bonus |
| 3.4 | Hint/route system | ✅ DONE | Progressive unlocks, route display |
| 3.5 | Zone transitions | ✅ DONE | Fade, audio crossfade, camera pan |
| 4.1 | HUD | ✅ DONE | Happiness bar, zone indicator, panel toggles |
| 4.2 | Dialogue system | ✅ DONE | Typewriter, personality lines |
| 4.3 | Visual effects | ✅ DONE | Particles, screen shake, lighting |
| 4.4 | Endgame (win/lose) | ✅ DONE | Celebration, found by shelter, restart |
| 5.1 | Unit testing framework | ✅ DONE | vitest + jsdom, 7 test files, 187 tests passing |
| 0.1 | HUD wiring | ✅ DONE | HUDRenderer auto-synced from State | 
| 0.2 | Dialogue wiring | ✅ DONE | DialogueRenderer with typewriter + SPACE advance |
| 0.3 | Inventory panel | ✅ DONE | InventoryRenderer canvas overlay |
| 0.4 | Companion panel | ✅ DONE | CompanionRenderer canvas overlay |
| 0.5 | Hint panel | ✅ DONE | HintRouteRenderer canvas overlay |
| 0.6 | Threat system | ✅ DONE | ThreatManager + SPACE mini-game input |
| 0.7 | Manga combat | ✅ DONE | MangaCombatRenderer overlay |
| 0.8 | Visual effects | ✅ DONE | VisualEffectsRenderer particles/shake |
| 0.9 | Endgame | ✅ DONE | EndgameRenderer win/lose screens |

## ✅ Unit Testing Framework — COMPLETE

> All 7 test files written, 187 tests passing.
>
> | Test File | Tests | Coverage |
> |-----------|-------|----------|
> | `state.test.ts` | 49 | State transitions, pub/sub, persistence, happiness bounds |
> | `inventory.test.ts` | 21 | Item add/remove, stacking, hasItem, getItemCount |
> | `companions.test.ts` | 22 | Meet/activate/deactivate, bonus calculation, follow |
> | `hints.test.ts` | 20 | Unlock hints, reveal routes, canUnlockHint |
> | `threats.test.ts` | 23 | Start/stop, combat/storm/vacuum mini-games, resolution |
> | `endgame.test.ts` | 17 | State transitions, score data, callbacks, resize |
> | `data-validation.test.ts` | 35 | DOGS/ZONES/ITEMS/THREATS integrity, config validation |
>
> **Framework:** vitest + jsdom (native Vite integration, zero config)
>
> ### Tasks Completed:
> 1. ✅ Evaluate frameworks → selected **vitest** (native Vite, TypeScript, Jest-compatible API)
> 2. ✅ Install vitest + jsdom
> 3. ✅ Configure vitest in `turbo-web/vite.config.ts`
> 4. ✅ Write tests for pure logic modules: `state.ts`, `inventory.ts`, `companions.ts`, `hints.ts`, `threats.ts`, `endgame.ts`
> 5. ✅ Write data validation tests for `data.ts` (zone layouts, item references, threat types, dog fields, config bounds)
> 6. ✅ All 187 tests passing

## ✅ Phase 1 — Zone Type Routing (COMPLETE)

Route game zones to their correct renderers based on `zone.type`.

**Implemented:**
- `transitionToZone()` now dispatches to FP/TP/Search based on `zone.type`
- `startTPView()` — initializes TpEngine with feature/NPC callbacks
- `startSearchView()` — initializes SearchRenderer with home-found callback
- `renderOverlays()` calls `tpEngine.update()` and `searchRenderer.update()` when active
- Keyboard input routed to active renderer
- Proper cleanup: dispose inactive renderers on zone transition
- Canvas visibility toggling per zone type

**Next priorities:**
1. Phase 2: Zone data complete — dog_park ✅, apartment ✅, shelter ✅, neighborhood ✅, home ✅ all done
2. Phase 3: Polish (SFX, particles, save/load fixes, difficulty scaling)

---

## Overview

Web-based adventure game: a lost dog's journey home through 5 zones.
**Tech stack:** Vite + TypeScript + Three.js (3D rendering) + Howler.js (audio)

---

## Architecture

```
turbo-game/
├── index.html           # UI skeleton (done)
├── css/style.css        # Styling (done)
├── js/data.js           # Game data (done)
├── js/main.js           # Game engine (done)
├── turbo-web/           # Vite + TS build ✅ COMPLETE
│   ├── index.html
│   ├── src/
│   │   ├── main.ts           # Bootstrap, dog select, FP/TP integration
│   │   ├── data.ts           # DOGS, ZONES, ITEMS, THREATS
│   │   ├── types.ts          # Shared TypeScript types
│   │   ├── config.ts         # Game configuration
│   │   └── engine/
│   │       ├── state.ts      # State manager (pub/sub)
│   │       ├── audio.ts      # Audio manager (Howler + Web Audio)
│   │       ├── threats.ts    # Threat system (traffic, cat, bully, storm, vacuum)
│   │       ├── inventory.ts  # Inventory system (4x4 grid)
│   │       ├── companions.ts # Companion manager (meet, follow, bonus)
│   │       ├── hints.ts      # Hint/route system (6 hints, 4 routes)
│   │       ├── transitions.ts# Zone transitions (fade/wipe/zoom/slide)
│   │       ├── hud.ts        # HUD (happiness, zone, panels)
│   │       ├── dialogue.ts   # Dialogue system (typewriter)
│   │       ├── effects.ts    # Visual effects (particles, shake, lights)
│   │       ├── endgame.ts    # Endgame (win/lose screens)
│   │       └── render/
│   │           ├── fp-renderer.ts   # First-person room renderer
│   │           ├── tp-renderer.ts   # Third-person adventure renderer
│   │           ├── search-renderer.ts # Human search interlude
│   │           └── manga-combat.ts  # Manga cutaway combat overlay
│   └── dist/            # Build output
├── assets/
│   ├── sprites/         # Dog portraits, item icons, threat sprites
│   ├── sounds/          # Music tracks, SFX
│   └── fonts/           # Game fonts
└── PLAN.md              # This file
```

**Game flow:** Dog Select → FP Rooms → TP Adventure → Human Interlude → ... → Home

---

## Component Breakdown

### Phase 1: Foundation

#### 1.1 Turbo-web (Vite + TypeScript Setup) ✅ COMPLETE
- `package.json` — deps: three, howler, vite
- `vite.config.ts` — dev server, alias `@/` → `turbo-web/src/`
- `turbo-web/index.html` — entry HTML (loads main.ts)
- `turbo-web/src/main.ts` — bootstrap: load data, init engine, start game
- `turbo-web/src/types.ts` — shared TypeScript types (Dog, Zone, Item, Threat, GameState)
- `turbo-web/src/config.ts` — game config (screen sizes, speeds, defaults)
- **Build verified:** `vite build` compiles cleanly (8 modules, ~20KB output)

#### 1.2 State Manager ✅ COMPLETE
- `turbo-web/src/engine/state.ts` — Central game state with pub/sub events
- State transitions: `selectDog()`, `enterZone()`, `enterRoom()`, `collectItem()`, `useItem()`, `meetCompanion()`, `activateCompanion()`, `unlockHint()`, `startThreat()`, `resolveThreat()`, `gameOver()`, `gameWin()`
- Save/load to localStorage
- State change events for UI updates

#### 1.3 Audio Manager ✅ COMPLETE
- `turbo-web/src/engine/audio.ts` — Howler.js wrapper with Web Audio API fallback
- Music tracks per zone (suburban, dog_park, apartment, shelter, home, combat, quiet)
- SFX library: footsteps, barks (3 variants), door sounds, item pickup/use, traffic, cat hiss, dog growl, thunder, vacuum, manga sting/hit, success/fail, victory/defeat
- Web Audio oscillator fallback for when audio files are missing
- Volume controls, mute toggle
- Dynamic music transitions (crossfade between zones)

---

### Phase 2: Core Gameplay

#### 2.1 Dog Selection Screen ✅ COMPLETE
- `turbo-web/src/screens/dog-select.ts`
- Render dog cards from DOGS data
- Canvas-drawn dog portraits (procedural, no sprites needed yet)
- Trait description display
- Selected dog highlight + intro dialogue
- "Start Adventure" button → triggers zone transition

#### 2.2 First-Person Room Renderer ✅ COMPLETE
- `turbo-web/src/engine/render/fp-renderer.ts`
- Three.js scene per room with proper imports from 'three'
- WASD movement within room bounds
- Room geometry: walls, floor, ceiling from room data (w, h, d, color)
- Exit markers with door frames and animated arrows
- Feature markers with glow rings and hover effects
- Raycasting for feature/exit click detection
- Fog + ambient lighting per room color
- Smooth camera transitions between rooms
- Material caching for performance
- Label sprites for features and exits
- `engine/render/fp-renderer.ts` — Main renderer class
- `engine/render/fp-renderer.ts` — CameraController (easing transitions)
- `engine/render/fp-renderer.ts` — buildRoomGeometry, buildFeatureMarker, buildExitMarker
- `engine/render/fp-renderer.ts` — setupLighting, setupFog
- `main.ts` — Integration: startFPView(), handleFeatureClick(), handleExitClick(), transitionToZone()

#### 2.3 Third-Person Adventure Renderer ✅ COMPLETE
- `turbo-web/src/engine/render/tp-renderer.ts`
- **DogModel**: Procedural 3D dog built from primitives (body, head, ears, tail, legs, collar)
- **NPCModel**: Wandering NPC dogs with tail wag, leg animation, target-seeking
- **ObstacleBuilder**: Fence, tree, bench, bush creation from primitives
- **ScentTrail**: Particle trail behind dog (30 points, orange glow)
- **FollowCameraController**: Smooth camera follow with offset and easing
- WASD movement with camera-relative direction
- Obstacle collision detection (circle and AABB hitboxes)
- Click handler for feature/NPC interaction via raycasting
- `engine/render/tp-renderer.ts` — DogModel, NPCModel, ObstacleBuilder, ScentTrail, FollowCameraController, TpEngine
- `main.ts` — Integration: startTPView(), handleFeatureClick(), handleNpcClick()

#### 2.4 Human Search Interlude ✅ COMPLETE
- `turbo-web/src/engine/render/search-renderer.ts`
- **SearchRenderer**: Top-down 2D map with camera tracking
- **ScentTrail**: Orange particle trail from dog's path
- **Compass**: Minimap compass in top-left corner with needle
- **Proximity Bar**: Bottom-center bar showing distance to home (green→red)
- **Home Marker**: Glowing golden house icon with distance-based glow intensity
- WASD movement, mouse for direction
- Scent point decay over 30 seconds
- Home found detection (distance < 0.5)
- `engine/render/search-renderer.ts` — SearchRenderer
- `main.ts` — Integration: startSearchView(), addScentPoint(), handleHomeFound()

#### 2.5 Threat System ✅ COMPLETE
- `turbo-web/src/engine/threats.ts`
- **ThreatManager**: Manages all threat encounters
- **Traffic mini-game**: Cars with collision detection, gap timing (2s window)
- **Cat/Bully combat**: Rhythm-based QTE with pulse bar and target zone
- **Storm mini-game**: Lightning flashes, thunder timer, shelter progress
- **Vacuum mini-game**: Moving vacuum with detection level and safe zones
- Each threat type has unique resolution mechanic
- Score-based resolution (70-90 points)
- `engine/threats.ts` — ThreatManager, TrafficState, CombatState, StormState, VacuumState

---

### Phase 3: Systems & UI

#### 3.1 Manga Cutaway Combat ✅ COMPLETE
- `turbo-web/src/engine/render/manga-combat.ts`
- **MangaCombatRenderer**: Full-screen manga-style combat overlay
- **Panel layouts**: standard (3-panel), dramatic (2 large + 1 small), closeup (2-panel)
- **QTE indicators**: Animated rings with hit detection
- **Visual effects**: Speed lines, flash on hit, combo counter
- **Text rendering**: Word-wrapped dialogue, SFX text, action titles
- **Animation loop**: Shake, zoom, flash effects per panel type
- `engine/render/manga-combat.ts` — MangaCombatRenderer, MangaPanel, QTEIndicator

#### 3.2 Inventory System ✅ COMPLETE
- `turbo-web/src/engine/inventory.ts`
- **InventoryRenderer**: 4x4 grid inventory with item display
- **Item types**: treat(🍖), bone(🦴), collar_piece(🔑), compass(🧭), water_bottle(💧), comfort_stone(💎), photo_fragment(📷), home_key(🗝️)
- **Stacking**: Up to 99 of same item per slot
- **UI**: Panel with hover/selection states, item info sidebar
- **Use button**: Per-item action trigger
- **Text wrapping**: Auto-wrap item descriptions
- `engine/inventory.ts` — InventoryRenderer, ITEM_TYPES map

#### 3.3 Companion System ✅ COMPLETE
- `turbo-web/src/engine/companions.ts`
- **CompanionManager**: Meet, activate, manage companions
- **Follow behavior**: Smooth follow behind player (1.5 unit distance)
- **Bonuses**: Happiness boost (10%), Speed boost (20%), Scent detection (15%), Courage (10%)
- **Dialogue**: Random companion lines on activation
- **Position tracking**: Companion position updates each frame
- `engine/companions.ts` — CompanionManager, BONUS_TYPES map

#### 3.4 Hint/Route System ✅ COMPLETE
- `turbo-web/src/engine/hints.ts`
- **HintRouteRenderer**: Hint panel with route display
- **6 hints**: tree_clue, first_crossing, park_entrance, water_bowl, shelter_direction, home_found
- **4 routes**: suburban→park, park→lake, lake→shelter_road, shelter_road→home
- **Unlock conditions**: Flag-based (found_tree, near_road, has_compass, etc.)
- **UI**: Unlocked hints list, revealed routes list with distances
- `engine/hints.ts` — HintRouteRenderer, HINTS map, ROUTES array

#### 3.5 Zone Transitions ✅ COMPLETE
- `turbo-web/src/engine/transitions.ts`
- **ZoneTransitionRenderer**: Transition overlay with 4 types
- **Fade**: Smooth alpha crossfade with zone name text
- **Wipe**: Left-to-right wipe with erase-back
- **Zoom**: Camera zoom in/out with zone name
- **Slide**: Slide-out/slide-in with zone name
- **Timing**: Progress-based (0-1), auto-completes at 1.0
- `engine/transitions.ts` — ZoneTransitionRenderer

---

### Phase 4: Polish

#### 4.1 HUD ✅ COMPLETE
- `turbo-web/src/engine/hud.ts`
- **HUDRenderer**: Game state overlay display
- **Dog info**: Name + happiness bar (green gradient, percentage)
- **Zone indicator**: Centered zone name with background
- **Status**: Item count 🎒, companion name 🐕
- **Panel hints**: Bottom-left [I]nventory [C]ompanion [H]ints
- **Threat indicator**: Pulsing red border + warning text when active
- `engine/hud.ts` — HUDRenderer, HUDState interface

#### 4.2 Dialogue System ✅ COMPLETE
- `turbo-web/src/engine/dialogue.ts`
- **DialogueRenderer**: Typewriter text display
- **Text rendering**: Character-by-character reveal with cursor
- **Speaker**: Yellow name prefix ("Turbo:")
- **Auto-advance**: Optional auto-advance after display time
- **Word wrap**: Line breaking at max chars
- **Continue prompt**: Pulsing "Press SPACE" when complete
- `engine/dialogue.ts` — DialogueRenderer, DialogueState interface

#### 4.3 Visual Effects ✅ COMPLETE
- `turbo-web/src/engine/effects.ts`
- **VisualEffectsRenderer**: Particle system + screen shake + lighting
- **Particles**: 4 types (sparkle, rain, dust, light), 200 max
- **Screen shake**: Intensity/duration-based with decay
- **Light pulses**: Radial gradient lights with fade
- **Animation loop**: Continuous update/render
- `engine/effects.ts` — VisualEffectsRenderer, Particle, ShakeState, LightPulse

#### 4.4 Endgame ✅ COMPLETE
- `turbo-web/src/engine/endgame.ts`
- **EndgameRenderer**: Win/lose screen with celebration
- **Win screen**: Celebration particles, score, stats, "PLAY AGAIN" button
- **Lose screen**: "LOST..." title, encouragement, "TRY AGAIN" button
- **Score**: Time played, items collected, companions met, threats resolved, max happiness
- **Final dialogue**: Personalized ending message
- `engine/endgame.ts` — EndgameRenderer, EndgameState enum

---

## Current Status (updated 2026-08-05)

All 17 components fully implemented + Phase 0 wiring complete + Phase 4 game flow assembled (~5,500 lines of code).

### Phase 4: Game Flow Assembly — COMPLETE

| # | Task | Status |
|---|------|--------|
| 4.1 | Dog select screen with "Start Adventure" button | ✅ DONE |
| 4.2 | Full zone routing (fixed `'human'` → `'search'` bug) | ✅ DONE |
| 4.3 | Room navigation via exit clicking | ✅ DONE |
| 4.4 | Feature interaction (food, hint, door, cat, dog_friend, home, etc.) | ✅ DONE |
| 4.5 | Threat mini-games (overlay shown, SPACE input wired) | ✅ DONE |
| 4.6 | Hint system wiring (unlock events → hint panel) | ✅ DONE |
| 4.7 | Companion system wiring (meet/activate events) | ✅ DONE |
| 4.8 | Win condition (stops render loop, shows endgame) | ✅ DONE |
| 4.9 | Lose condition (stops render loop, shows endgame) | ✅ DONE |
| 4.10 | Full game loop test | ✅ DONE (build compiles, 207/207 tests pass) |

### Key fixes applied:
- Zone type routing: `'human'` → `'search'` (search view now triggers correctly)
- Added visible "Start Adventure" button on dog select screen
- Win/lose conditions now stop render loop and dispose active zone renderer
- Added `startHappinessDecay()` to `FpRoomRenderer` with proper cleanup
- Removed duplicate `setOnLineAdvance` callback
- Fixed `renderOverlays` endgame draw to use `draw()` instead of `startRenderLoop()`

| Phase | Component | Lines | Status |
|-------|-----------|-------|--------|
| 1 | Vite + TS setup | — | ✅ DONE |
| 1 | State manager | 285 | ✅ DONE |
| 1 | Audio manager | 287 | ✅ DONE |
| 1 | Dog select screen (in main.ts) | — | ✅ DONE |
| 2 | FP room renderer | 666 | ✅ DONE |
| 2 | TP adventure renderer | 1,145 | ✅ DONE |
| 2 | Human search interlude | 458 | ✅ DONE |
| 2 | Threat system | 464 | ✅ DONE |
| 3 | Manga cutaway combat | 407 | ✅ DONE |
| 3 | Inventory system | 406 | ✅ DONE |
| 3 | Companion system | 154 | ✅ DONE |
| 3 | Hint/route system | 413 | ✅ DONE |
| 3 | Zone transitions | 255 | ✅ DONE |
| 4 | HUD | 259 | ✅ DONE |
| 4 | Dialogue system | 225 | ✅ DONE |
| 4 | Visual effects | 249 | ✅ DONE |
| 4 | Endgame (win/lose) | 280 | ✅ DONE |

---

## ✅ Phase 0: Wire Up All Disconnected Components — COMPLETE

> All 17 engine components wired into `main.ts` with event-driven overlay updates.
>
> ### Tasks Completed:
> 1. ✅ **0.1 HUD** — `HUDRenderer` instantiated, auto-synced from State every frame
> 2. ✅ **0.2 Dialogue** — `DialogueRenderer` with typewriter, SPACE advance, auto-hide
> 3. ✅ **0.3 Inventory** — `InventoryRenderer` panel with [I] toggle, mouse hover/click, USE button
> 4. ✅ **0.4 Companion** — `CompanionRenderer` panel with [C] toggle, active highlight, pack list
> 5. ✅ **0.5 Hint** — `HintRouteRenderer` panel with [H] toggle, unlocked hints, revealed routes
> 6. ✅ **0.6 Threat** — `ThreatManager` wired to State events, SPACE input for mini-games
> 7. ✅ **0.7 Manga Combat** — `MangaCombatRenderer` overlay for cat/bully threats
> 8. ✅ **0.8 Visual Effects** — `VisualEffectsRenderer` particles, shake, light pulses
> 9. ✅ **0.9 Endgame** — `EndgameRenderer` win/lose screens with score, PLAY AGAIN button
>
> ### Architecture:
> - **Unified render loop** — single `requestAnimationFrame` drives all overlay canvases
> - **Event-driven wiring** — `State.on()` subscriptions auto-update overlays on game events
> - **Keyboard input** — SPACE advances dialogue / triggers threat mini-games, I/C/H toggles panels
> - **Canvas cleanup** — removed duplicate canvas elements from index.html
> - **CompanionRenderer** — added new canvas overlay class to `companions.ts`
>
> ### Files Modified:
> - `turbo-web/src/main.ts` — Full rewrite: 220+ lines of overlay wiring
> - `turbo-web/src/engine/companions.ts` — Added `CompanionRenderer` class (~150 lines)
> - `turbo-web/index.html` — Removed duplicate canvas elements
>
> ### Test Results: 187/187 passing ✅

## Unit Testing — Framework Investigation

### Framework Candidates

| Framework | Vite Native | TypeScript | Ecosystem | Learning Curve | Best For |
|-----------|-------------|------------|-----------|----------------|----------|
| **vitest** ✅ | ✅ Yes | ✅ First-class | Growing fast | Low | Vite projects — zero config, fast |
| jest | ❌ Requires setup | ✅ Via ts-jest | Massive, mature | Medium | Large codebases, mature tooling |
| ava | ❌ Requires setup | ✅ Native | Small | Low | Simple, concurrent tests |
| tap | ❌ Requires setup | ⚠️ Limited | Large | High | Node.js focused |

### Recommendation: **vitest**

**Why:**
- Native Vite integration — no extra config needed, just install and run
- TypeScript support out of the box — no ts-jest setup
- Jest-compatible API — `describe`, `it`, `expect` work the same
- Fast — uses esbuild for transpilation (10-100x faster than jest)
- Mocking — `vi.mock()` for Canvas2D, Howler, Three.js
- Snapshot testing — built-in for visual regression
- Coverage — `@vitest/coverage-v8` for code coverage

**Installation:**
```bash
cd turbo-web
npm install -D vitest @types/node jsdom
```

**Config (`turbo-web/vite.config.ts` or `vitest.config.ts`):**
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/engine/**/*.ts', 'src/data.ts'],
    },
  },
});
```

### Test Plan

| Priority | Module | Test Type | What to Test |
|----------|--------|-----------|--------------|
| P0 | `state.ts` | Unit | State transitions, pub/sub events, save/load, happiness bounds |
| P0 | `inventory.ts` | Unit | Item add/remove, stacking, hasItem, getItemCount |
| P0 | `companions.ts` | Unit | Meet/activate/deactivate, bonus calculation, follow behavior |
| P0 | `hints.ts` | Unit | Unlock conditions, route reveal, canUnlockHint |
| P0 | `threats.ts` | Unit | Threat state machine, mini-game logic, resolution/fail |
| P0 | `endgame.ts` | Unit | Score calculation, state transitions, win/lose conditions |
| P1 | `data.ts` | Validation | All zones have valid rooms, all items referenced exist, threat types valid |
| P1 | `audio.ts` | Unit | Music/SFX resolution, fallback logic, mute toggle |
| P1 | `transitions.ts` | Unit | Transition types, timing, completion |
| P2 | Canvas renderers | Visual | Snapshot test rendered output (mock Canvas2D) |

### Data Validation Tests (Critical)

These catch broken references before integration:

```typescript
// data-validation.test.ts
// - All ZONES have valid room layouts (rooms array, exits reference valid rooms)
// - All ITEMS referenced in zones actually exist in ITEMS map
// - All THREAT types map to valid mini-game handlers
// - All DOGS have required fields (id, name, breed, trait, colors, personality, lines)
// - No orphaned references (every exit in a room points to a real room)
// - Zone types match renderer support ('fp' | 'tp' | 'search')
```

---

## 🔥 Next Steps: Integration Plan

All engine files are written. The gap is **main.ts wiring**. Here's the priority order:

### Phase 0: Wiring (Critical Path — Makes Game Playable)

| # | Task | Files to modify | Impact |
|---|------|-----------------|--------|
| 0.1 | Wire up **HUD** in main.ts | `main.ts` | Shows happiness, zone, item count — visible feedback |
| 0.2 | Wire up **Dialogue** in main.ts | `main.ts` | Character speech, story progression |
| 0.3 | Wire up **Inventory panel** (canvas overlay) | `main.ts` | Toggle [I], render 4x4 grid |
| 0.4 | Wire up **Companion panel** (canvas overlay) | `main.ts` | Toggle [C], show active companion |
| 0.5 | Wire up **Hint panel** (canvas overlay) | `main.ts` | Toggle [H], show unlocked hints/routes |
| 0.6 | Wire up **Threat system** in main.ts | `main.ts` | Show threat overlay, handle SPACE input |
| 0.7 | Wire up **Manga combat** overlay | `main.ts` | Full-screen combat for cat/bully threats |
| 0.8 | Wire up **Visual effects** (particles/shake) | `main.ts` | Item pickup sparkles, threat shake |
| 0.9 | Wire up **Endgame** (win/lose screens) | `main.ts` | Victory/defeat with score |

### Phase 1: Zone Type Routing (Game Flow)

| # | Task | Impact |
|---|------|--------|
| 1.1 | Route `zone.type === 'tp'` → `TpRenderer` | Dog park, other TP zones become 3D adventure |
| 1.2 | Route `zone.type === 'search'` → `SearchRenderer` | Human search interlude zones |
| 1.3 | Wire zone transition callbacks (fade, audio crossfade) | Smooth zone changes |

### Phase 2: Zone Data Completion

| # | Task | Impact | Status |
|---|------|--------|--------|
| 2.1 | Add `dog_park` zone (TP) with NPCs, obstacles, scent trail | Companion meeting | ✅ |
| 2.2 | Add `apartment` zone (FP) with TV, food, toy features | Item collection | ✅ |
| 2.3 | Add `shelter` zone (FP) with kennels, friend meeting | Companion system | ✅ |
| 2.4 | Add `neighborhood` zone (FP) with final approach, home gate | Win condition | ✅ |
| 2.5 | Add `home` zone (FP) with golden gate, celebration | Endgame trigger | ✅ |

### Phase 3: Polish

| # | Task | Impact |
|---|------|--------|
| 3.1 | Add remaining SFX/music placeholder (Web Audio oscillators) | Audio feedback |
| 3.2 | Add screen shake on threat hit/miss | Juice |
| 3.3 | Add particle effects for item pickup, zone entrance | Polish |
| 3.4 | Fix save/load persistence edge cases | Progression | ✅ DONE | save schema versioning, deep clone, validation |
| 3.5 | Add config for difficulty scaling | Replayability | ✅ DONE | presets, dog trait modifiers, companion help chance |

---

## Implementation Order

1. **turbo-web setup** (package.json, vite config, types, config, bootstrap)
2. **State manager** (core game state, save/load)
3. **Audio manager** (Howler wrapper, zone music, SFX)
4. **Dog selection screen** (canvas portraits, trait display)
5. **FP room renderer** (Three.js rooms, camera, movement, features)
6. **TP adventure renderer** (dog model, movement, obstacles, NPCs)
7. **Threat system** (all 4 threat types with mini-games)
8. **Manga cutaway** (combat overlay)
9. **Inventory system** (grid, pickup, use, combine)
10. **Companion system** (meet, manage, active bonus)
11. **Hint system** (progressive unlocks, route display)
12. **Human interlude** (scent dropping, map view)
13. **Zone transitions** (fade, audio crossfade, camera pan)
14. **Dialogue system** (typewriter, personality lines)
15. **HUD** (happiness bar, zone indicator, panel toggles)
16. **Visual effects** (particles, screen shake, lighting)
17. **Endgame** (win/lose states, restart)

---

## Key Design Notes

- **No external assets needed initially** — all sprites drawn procedurally on canvas
- **Audio can start with Web Audio API oscillators** for placeholder SFX
- **Three.js for all 3D** — FP rooms and TP zones
- **Manga cutaways use 2D canvas overlay** — not 3D
- **Human interlude is 2D top-down** — simpler canvas rendering
- **Progressive disclosure** — hints unlock as you explore
- **Dog trait affects gameplay** — not just cosmetic, changes difficulty/mechanics

---

## 🔜 Remaining Work — Next Steps Plan

> **Current state:** All 17 engine modules written, 207 tests passing, save/load + difficulty scaling complete. The game has all the *pieces* but they are not assembled into a *playable experience*. This plan describes what needs to happen next.

### Phase 4: Assemble the Game Flow (Make It Playable) ✅ COMPLETE

**Goal:** Connect all existing pieces into a complete, playable game loop.

All 10 tasks completed. Game now has:
- Visible "Start Adventure" button on dog select
- Correct zone type routing (FP/TP/Search)
- Room navigation via exit clicking
- Feature interaction (items, hints, threats, companions)
- Win/lose conditions that stop render loop and show endgame
- Happiness decay timer in FP view
- Endgame canvas draw (not startRenderLoop)

Build compiles, 207/207 tests pass.

### Phase 5: Audio (Placeholder → Polish)

**Goal:** Replace oscillator fallbacks with actual audio.

| # | Task | Files | Impact |
|---|------|-------|--------|
| 5.1 | **Zone music tracks** — create or source 5 ambient tracks (suburban, dog_park, apartment, shelter, home) | `assets/sounds/`, `engine/audio.ts` | Each zone has distinct mood |
| 5.2 | **SFX library** — create or source 15+ SFX (footsteps, barks, door, item pickup, traffic, cat, thunder, vacuum, manga sting, success/fail) | `assets/sounds/`, `engine/audio.ts` | Game has audio feedback |
| 5.3 | **Audio crossfades** — implement smooth music transitions between zones | `engine/audio.ts` | No jarring audio cuts |
| 5.4 | **Mute toggle** — wire mute button to audio system | `main.ts`, `engine/audio.ts` | Player control |

### Phase 6: Visual Polish

**Goal:** Improve visual quality and juice.

| # | Task | Files | Impact |
|---|------|-------|--------|
| 6.1 | **Dog model upgrade** — replace primitive dog with better procedural model or sprite-based animation | `engine/render/tp-renderer.ts` | Player character looks good |
| 6.2 | **NPC animations** — add tail wag, leg walk cycles, idle bounce to companion NPCs | `engine/render/tp-renderer.ts` | NPCs feel alive |
| 6.3 | **Particle upgrades** — add celebration particles on win, item pickup sparkles, zone entrance effects | `engine/effects.ts` | Visual juice |
| 6.4 | **Screen transitions** — implement smooth fade/wipe between zones, not instant switches | `engine/transitions.ts` | Polished zone changes |
| 6.5 | **Lighting/atmosphere** — add time-of-day lighting, fog density per zone, colored ambient | `engine/render/fp-renderer.ts`, `engine/render/tp-renderer.ts` | Zones feel distinct |
| 6.6 | **UI polish** — improve HUD design, panel styling, cursor states, hover feedback | `engine/hud.ts`, `engine/dialogue.ts`, `engine/inventory.ts` | UI feels professional |

### Phase 7: Content & Balance

**Goal:** Fill out the game world and tune the experience.

| # | Task | Files | Impact |
|---|------|-------|--------|
| 7.1 | **Expand zone data** — add more rooms to each zone (currently 3-5 rooms per zone), add more features, items, NPCs | `data.ts` | Game world feels larger |
| 7.2 | **Add more items** — expand ITEMS map with 10+ items (collar piece, leash, bone, toy, treat, map fragments, etc.) | `data.ts`, `engine/inventory.ts` | More to collect |
| 7.3 | **Add more companions** — expand COMPANIONS with 5+ dogs with unique dialogue, traits, locations | `data.ts`, `engine/companions.ts` | More to discover |
| 7.4 | **Add more threats** — expand THREATS with 8+ threats across all 4 types | `data.ts`, `engine/threats.ts` | More gameplay variety |
| 7.5 | **Balance difficulty** — tune presets using `DIFFICULTY_PRESETS` values, playtest each level | `config.ts`, `main.ts` | Game is fun at all levels |
| 7.6 | **Dog trait tuning** — verify each dog trait actually changes gameplay meaningfully | `config.ts`, `engine/state.ts`, `main.ts` | Dogs feel different to play |

### Phase 8: Mobile & Accessibility

**Goal:** Make the game accessible on more devices.

| # | Task | Files | Impact |
|---|------|-------|--------|
| 8.1 | **Touch controls** — add virtual D-pad for mobile, tap-to-interact | `main.ts`, `engine/render/tp-renderer.ts` | Playable on phones/tablets |
| 8.2 | **Responsive layout** — adapt HUD and panels to different screen sizes | `engine/hud.ts`, `engine/inventory.ts` | Works on all screens |
| 8.3 | **Colorblind mode** — add pattern-based item distinction (not just color) | `engine/render/fp-renderer.ts`, `engine/effects.ts` | Accessible to more players |
| 8.4 | **Text scaling** — allow text size adjustment for dialogue and hints | `engine/dialogue.ts`, `engine/hints.ts` | Readable for more players |
| 8.5 | **Keyboard shortcuts** — add more keybinds (e.g. [1-4] for quick inventory use) | `main.ts` | Power user control |

### Phase 9: Testing & Quality

**Goal:** Ensure reliability before release.

| # | Task | Files | Impact |
|---|------|-------|--------|
| 9.1 | **Integration tests** — write tests for game flow (select dog → enter zone → collect item → resolve threat → win) | `src/**/*.test.ts` | Catch regressions |
| 9.2 | **Data integrity** — expand data-validation tests (all exits valid, all items exist, no dead ends) | `src/data-validation.test.ts` | Catch broken references |
| 9.3 | **Performance profiling** — measure frame time, memory, load time | `vite.config.ts`, Chrome DevTools | Identify bottlenecks |
| 9.4 | **Build optimization** — tree-shake, code-split, lazy-load Three.js | `vite.config.ts` | Smaller bundle, faster load |
| 9.5 | **Browser compatibility** — test on Chrome, Firefox, Safari, Edge | Manual | No browser-specific bugs |

### Phase 10: Deployment

**Goal:** Get the game online.

| # | Task | Files | Impact |
|---|------|-------|--------|
| 10.1 | **Build production** — `vite build` with sourcemaps | `vite.config.ts` | Optimized output |
| 10.2 | **Deploy to GitHub Pages** — configure `vite.config.ts` base path, push dist | `vite.config.ts`, `.github/` | Game is online |
| 10.3 | **Add manifest.json** — PWA support for mobile install | `turbo-web/public/manifest.json` | Installable on phones |
| 10.4 | **Add robots.txt / SEO** — basic metadata for sharing | `turbo-web/public/` | Shareable link |
| 10.5 | **Write README** — game overview, controls, how to play | `README.md` | Players know what to do |

---

### Recommended Execution Order

1. **Phase 4** (game flow) — ✅ COMPLETE — makes the game *playable*
2. **Phase 5** (audio) — next priority — makes the game *feel alive*
3. **Phase 6** (visual polish) — makes the game *look good*
4. **Phase 7** (content) — makes the game *long and varied*
5. **Phase 8** (mobile) — makes the game *accessible*
6. **Phase 9** (testing) — makes the game *reliable*
7. **Phase 10** (deployment) — makes the game *live*

### Estimated Scope

| Phase | Effort | Key Deliverable |
|-------|--------|-----------------|
| 4 | High | Playable game loop |
| 5 | Medium | Full audio |
| 6 | Medium | Visual polish |
| 7 | High | Full content |
| 8 | Medium | Mobile support |
| 9 | Low | Quality assurance |
| 10 | Low | Live deployment |

### Current Test Status

| Test File | Tests | Status |
|-----------|-------|--------|
| `state.test.ts` | 69 | ✅ |
| `inventory.test.ts` | 21 | ✅ |
| `threats.test.ts` | 23 | ✅ |
| `companions.test.ts` | 22 | ✅ |
| `hints.test.ts` | 20 | ✅ |
| `endgame.test.ts` | 17 | ✅ |
| `data-validation.test.ts` | 35 | ✅ |
| **Total** | **207** | **All passing** |
