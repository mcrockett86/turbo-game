# 3D → 2D Migration: Detailed Change Analysis

## Executive Summary

The migration touches **2 renderer files** (`fp-renderer.ts`, `tp-renderer.ts`) that need to be replaced with 2D versions. Everything else in the codebase is either already 2D or needs only minor data/config adjustments.

**No changes needed:** overlays (HUD, dialogue, inventory, companions, hints), transitions, effects, manga combat, threats, state manager, audio, dog select screen, data file, types file, CSS.

---

## 1. Files to Replace (2)

### 1a. `fp-renderer.ts` → `fp-room-renderer-2d.ts`

**What it currently does (2,100+ lines):**
- Three.js scene setup (Scene, PerspectiveCamera, WebGLRenderer, Fog, 4 light types)
- Room geometry: PlaneGeometry floor + PlaneGeometry ceiling + 4 PlaneGeometry walls
- BoxGeometry feature markers with glow rings (ConeGeometry)
- BoxGeometry door frames + ConeGeometry exit arrows
- CanvasTexture-based label sprites
- Raycaster-based hover detection + click detection
- CameraController with lerp-based transitions
- MaterialCache for shared MeshStandardMaterial
- Per-frame: camera update, movement, glow pulse, arrow rotation, WebGL render
- Happiness decay interval

**What the 2D version needs:**
- `CanvasRenderingContext2D` (no Three.js imports)
- Room as data (not geometry): `room.w`, `room.d`, `room.color`, `room.exits[]`, `room.features[]`
- Camera = player position in world coords (no PerspectiveCamera)
- Draw floor as `fillRect(room.x, room.y, room.w, room.d)`
- Draw walls as 4 border rectangles with darker shade
- Draw features as colored shapes + emoji + label text
- Draw exits as door rectangles on walls + arrow text
- Click detection = distance check from screen coords → world coords
- Fog = `createRadialGradient` from player position
- Lighting = color overlay with opacity based on zone time-of-day
- Hover = brighten feature border on proximity check
- Same public API: `init()`, `handleKeyDown()`, `handleKeyUp()`, `setOnFeatureClick()`, `setOnExitClick()`, `moveTo()`, `getCameraPosition()`, `dispose()`

**Key data mapping:**
| 3D Property | 2D Usage |
|---|---|
| `room.w` | room width in pixels |
| `room.d` | room depth in pixels |
| `room.h` | **not needed** (top-down, no ceiling visible) |
| `room.color` | floor fill color |
| `room.exits[]` | exit positions on walls (index → wall side) |
| `room.features[]` | `x, y` → 2D position; `w, h` → shape size |
| `ZONE_LIGHTING` | fog color, fog near/far, overlay tint color |

**Removed concepts:**
- `THREE.Scene`, `THREE.PerspectiveCamera`, `THREE.WebGLRenderer`
- `THREE.Fog`, `THREE.AmbientLight`, `THREE.DirectionalLight`, `THREE.PointLight`
- `THREE.BoxGeometry`, `THREE.PlaneGeometry`, `THREE.ConeGeometry`, `THREE.CylinderGeometry`
- `THREE.Mesh`, `THREE.MeshStandardMaterial`, `THREE.MeshBasicMaterial`
- `THREE.Raycaster`, `THREE.Vector2`, `THREE.Vector3`, `THREE.Color`, `THREE.Group`
- `THREE.Sprite`, `THREE.SpriteMaterial`, `THREE.CanvasTexture`
- `CameraController` class (replaced by player position tracking)
- `materialCache` (replaced by fillStyle/strokeStyle)
- `roomScale` (data units → world units mapping; 2D uses data units directly)

---

### 1b. `tp-renderer.ts` → `tp-engine-2d.ts`

**What it currently does (1,200+ lines):**
- Three.js scene with PerspectiveCamera + WebGLRenderer + shadow maps
- Procedural 3D dog model (body, head, snout, nose, eyes, ears, tail, legs, collar, tongue) — 20+ meshes
- NPC dog models (simplified 3D primitives) — 10+ meshes each
- Obstacle models: fences (posts + rails), trees (trunk + 3 leaf spheres), benches (seat + legs), bushes (3 spheres)
- ScentTrail particle system (30+ spheres)
- FollowCameraController (smooth follow + lookAt)
- Raycaster-based click detection for features + NPCs
- Zone-aware fog + lighting (ambient + directional + hemisphere)
- Per-frame: movement + obstacle collision + dog animation (tail wag, leg swing, idle bob) + NPC wander + camera update

**What the 2D version needs:**
- `CanvasRenderingContext2D` (no Three.js imports)
- Ground as `fillRect` in `zone.groundColor`
- Player as top-down dog shape (ellipse body + circle head + direction line) or emoji 🐕
- Obstacles as 2D shapes:
  - Fence: line + small rectangles (posts)
  - Tree: green circle (canopy) + brown rectangle (trunk)
  - Bench: brown rectangle
  - Bush: cluster of green circles
- NPCs as colored top-down dog shapes (different color per NPC)
- Features as shapes + emoji + label (same as FP renderer)
- Scent trail as fading dots behind player
- Click detection = distance check from screen coords → world coords
- Fog = `createRadialGradient` from player position
- Lighting = sky color overlay with opacity
- Same public API: `init()`, `onKeyDown()`, `onKeyUp()`, `update()`, `setOnFeatureClick()`, `setOnNpcClick()`, `resize()`, `dispose()`

**Key data mapping:**
| 3D Property | 2D Usage |
|---|---|
| `zone.skyColor` | background fill + fog color |
| `zone.groundColor` | ground fill color |
| `zone.dogColor` | player dog body color |
| `zone.accentColor` | UI/feature accent color |
| `zone.obstacles[]` | `x, z` → 2D position; `width, height` → size |
| `zone.npcs[]` | `x, z` → 2D position; `color` → dog body color |
| `zone.features[]` | `x, z` → 2D position; `w, h` → shape size |

**Removed concepts:**
- `THREE.Scene`, `THREE.PerspectiveCamera`, `THREE.WebGLRenderer`
- `THREE.Clock`, `THREE.ShadowMap`, `THREE.PCFSoftShadowMap`
- `THREE.BoxGeometry`, `THREE.SphereGeometry`, `THREE.CylinderGeometry`, `THREE.ConeGeometry`, `THREE.TorusGeometry`, `THREE.CircleGeometry`, `THREE.PlaneGeometry`
- `THREE.Mesh`, `THREE.MeshStandardMaterial`, `THREE.MeshBasicMaterial`
- `THREE.Raycaster`, `THREE.Vector2`, `THREE.Vector3`, `THREE.Color`, `THREE.Group`
- `THREE.AmbientLight`, `THREE.DirectionalLight`, `THREE.HemisphereLight`, `THREE.Fog`
- `DogModel` class (procedural 3D dog — replaced by simple 2D shape or emoji)
- `NPCModel` class (simplified 3D dog — replaced by colored 2D shape)
- `ObstacleBuilder` class (3D primitives — replaced by 2D shapes)
- `ScentTrail` class (sphere particles — replaced by fading dots)
- `FollowCameraController` class (replaced by player position tracking)
- Shadow maps (no shadows in 2D)
- `dogBodyWidth`, `dogBodyHeight`, `dogBodyDepth`, `dogHeadSize`, `dogTailLength`, `dogEarSize` (3D model dimensions)

---

## 2. File to Modify (1)

### 2a. `main.ts`

**Changes needed:**

| Change | Details |
|---|---|
| Import update | Replace `FpRoomRenderer` with `FpRoomRenderer2D`, `TpEngine` with `TpEngine2D` |
| Type declaration | `let fpRenderer: FpRoomRenderer2D \| null = null;` |
| Type declaration | `let tpEngine: TpEngine2D \| null = null;` |
| `startFPView()` | Instantiate `FpRoomRenderer2D` instead of `FpRoomRenderer`; remove WebGL-specific setup (canvas sizing before renderer creation, WebGL context check) |
| `startTPView()` | Instantiate `TpEngine2D` instead of `TpEngine`; remove WebGL-specific setup |
| `transitionToZone()` | No change needed — dispose logic and zone type routing works the same |
| `resetGame()` | No change needed — dispose logic works the same |
| `handleKeyDown()` | Same routing logic — `handleKeyDown`/`handleKeyUp` methods exist on both old and new renderers |
| `handleKeyUp()` | Same routing logic |
| `onWindowResize()` | Remove `tpEngine.resize()` call (2D renderer handles resize differently) |
| **Remove Three.js import** | If `FpRoomRenderer` and `TpEngine` are the only Three.js consumers, remove `import * as THREE` from `main.ts` |

**No changes needed:**
- `initOverlays()` — all overlays already 2D
- `wireStateEvents()` — all event handling is data-driven
- `renderOverlays()` — unified loop already handles TP engine update
- `startAdventure()` — same flow, just different renderer
- `handleFeatureClick()` — same data-driven switch
- `handleExitClick()` — same data-driven switch
- `renderDogSelect()` — already uses 2D Canvas
- `drawDogPortrait()` — already uses 2D Canvas
- `showZoneTransition()` / `hideThreatOverlay()` — already use 2D Canvas
- `useItem()` / `dropItem()` — no renderer dependency
- `restartGame()` / `backToMenu()` — same flow
- `setupUI()` — event listeners on HTML elements, not canvas
- `togglePanel()` — no renderer dependency
- `sizeCanvasToWindow()` — still needed for canvas sizing
- `startRenderLoop()` / `stopRenderLoop()` — still needed for unified overlay loop
- All State event handlers — data-driven, no renderer dependency
- Dog selection logic — already 2D
- Auto-save — no renderer dependency

---

## 3. Files to Modify with Minor Changes (3)

### 3a. `config.ts`

**Changes needed:**

| Config | Current | Change |
|---|---|---|
| `fpFOV` | `60` | **Remove** (no camera in 2D) |
| `fpNear` | `0.1` | **Remove** (no camera in 2D) |
| `fpFar` | `500` | **Remove** (no camera in 2D) |
| `fpCameraHeight` | `30` | **Remove** (top-down, no eye height) |
| `fpMoveSpeed` | `2.5` | **Keep** (movement speed still needed) |
| `fpMaxRoomMove` | `0.8` | **Remove** (not used in 2D) |
| `tpCameraOffset` | `{x:0, y:45, z:35}` | **Remove** (no camera in 2D) |
| `tpCameraAngle` | `0` | **Remove** (no camera in 2D) |
| `tpCameraDist` | `50` | **Remove** (no camera in 2D) |
| `tpMoveSpeed` | `3` | **Keep** (movement speed still needed) |
| `tpTurnSpeed` | `0.04` | **Remove** (top-down, no turning) |
| Dog model dimensions | `dogBodyWidth/Height/Depth`, `dogHeadSize`, `dogTailLength`, `dogEarSize` | **Remove** (no 3D model in 2D) |
| `fpFogNear`/`fpFogFar` | `100`/`400` | **Keep** (used by FP zone fog) |
| `tpFogNear`/`tpFogFar` | `150`/`500` | **Keep** (used by TP zone fog) |
| `canvasWidth`/`canvasHeight` | `1280`/`720` | **Keep** (canvas sizing) |
| `happinessDecayPerSecond` | `0.05` | **Keep** (game logic) |
| All happiness configs | various | **Keep** (game logic) |
| `inventorySlots` | `16` | **Keep** (game logic) |
| `mangaTimer`/`mangaComboLength` | various | **Keep** (game logic) |
| All audio configs | various | **Keep** (game logic) |
| `ambientIntensity`/`directionalIntensity` | `0.4`/`0.8` | **Remove** (no 3D lighting) |
| `colors.sky`/`ground`/`wall`/`floor`/`highlight`/`success`/`danger`/`ui` | various | **Keep** (used by overlays) |
| `debug` | `false` | **Keep** |

### 3b. `types.ts`

**Changes needed:**

| Type | Change |
|---|---|
| `SceneState` interface | **Remove** (Three.js scene state) |
| `Room3DState` interface | **Remove** (Three.js room state) |
| `TPZoneState` interface | **Remove** (Three.js TP zone state) |
| `RoomFeature` type | **Keep** (game data, not renderer-specific) |
| `Room` interface | **Keep** (game data; `h` property becomes unused by renderers) |
| `Zone` interface | **Keep** (game data) |
| `Dog` interface | **Keep** (game data) |
| `NPC` interface | **Keep** (game data) |
| `Obstacle` interface | **Keep** (game data) |
| `RoomFeatureExtended` | **Keep** (extends RoomFeature) |
| `ZoneExtended` | **Keep** (extends Zone) |
| `InventorySlot` | **Keep** (game data) |
| `Companion` | **Keep** (game data) |
| `GameState` | **Keep** (game data) |
| `GameEvent` | **Keep** (game data) |
| `MangaState` | **Keep** (game data) |

### 3c. `data.ts`

**Changes needed:**

| Zone property | Change |
|---|---|
| `fogNear`/`fogFar` on `suburban_streets` | **Remove** (fog handled by renderer, not zone data) |
| `rooms[].h` | **Keep** (used for wall thickness visual, not strictly needed) |
| `rooms[].exits` | **Keep** (game data, not renderer-specific) |
| `rooms[].features[].x, y` | **Keep** (2D position coordinates) |
| `rooms[].features[].w, h` | **Keep** (2D shape size) |
| `zone.skyColor` | **Keep** (background color in 2D) |
| `zone.groundColor` | **Keep** (ground fill color in 2D) |
| `zone.dogColor` | **Keep** (player dog color in 2D) |
| `zone.accentColor` | **Keep** (feature accent in 2D) |
| `zone.obstacles[].x, z` | **Keep** (2D position coordinates) |
| `zone.obstacles[].width, height` | **Keep** (2D size) |
| `zone.npcs[].x, z` | **Keep** (2D position coordinates) |
| `zone.features[].x, z` | **Keep** (2D position coordinates) |
| `zone.features[].w, h` | **Keep** (2D shape size) |
| `returnZone` | **Keep** (game logic) |
| `hint` | **Keep** (game logic) |

**No changes needed:**
- All DOG data (colors, personality, lines)
- All COMPANIONS data
- All ITEMS data
- All THREATS data
- Zone `name`, `desc`, `type`, `music`
- Room `id`, `name`, `color`, `isEntrance`, `entranceZone`, `isHome`

---

## 4. Files to Delete (2)

| File | Reason |
|---|---|
| `src/engine/render/fp-renderer.ts` | Replaced by `fp-room-renderer-2d.ts` |
| `src/engine/render/tp-renderer.ts` | Replaced by `tp-engine-2d.ts` |

---

## 5. Files to Create (2)

| File | Purpose |
|---|---|
| `src/engine/render/fp-room-renderer-2d.ts` | 2D top-down FP room renderer |
| `src/engine/render/tp-engine-2d.ts` | 2D top-down TP zone renderer |

---

## 6. No Changes Needed (Comprehensive List)

### Overlay Renderers (all already 2D Canvas):
- `src/engine/hud.ts` — HUD overlay
- `src/engine/dialogue.ts` — Dialogue overlay
- `src/engine/inventory.ts` — Inventory panel
- `src/engine/companions.ts` — Companion panel
- `src/engine/hints.ts` — Hint/route panel
- `src/engine/endgame.ts` — Endgame screen
- `src/engine/render/manga-combat.ts` — Manga cutaway overlay

### Engine Systems (all data-driven, no renderer dependency):
- `src/engine/state.ts` — State manager
- `src/engine/audio.ts` — Audio system
- `src/engine/threats.ts` — Threat management (no actual Three.js dependency)
- `src/engine/transitions.ts` — Zone transitions (already 2D Canvas)
- `src/engine/effects.ts` — Visual effects (already 2D Canvas)

### Data & Config:
- `src/data.ts` — Game data (minor property removals only)
- `src/types.ts` — Type definitions (minor interface removals only)
- `src/config.ts` — Config (minor property removals only)

### UI & HTML:
- `index.html` — Canvas elements already have correct structure
- `css/style.css` — No Three.js-specific styles

### Other:
- `src/main.ts` — Dog select screen (`drawDogPortrait`) already uses 2D Canvas
- `package.json` — Three.js can remain as a dev dependency (for existing tests) or be removed
- `vite.config.ts` — No changes needed (alias `@/` → `src/` still works)
- `tsconfig.json` — No changes needed

---

## 7. Summary Table

| Category | Files to Replace | Files to Modify | Files to Delete | Files to Create | No Change |
|---|---|---|---|---|---|
| **Renderer** | `fp-renderer.ts`, `tp-renderer.ts` | — | `fp-renderer.ts`, `tp-renderer.ts` | `fp-room-renderer-2d.ts`, `tp-engine-2d.ts` | `search-renderer.ts`, `manga-combat.ts` |
| **Main** | — | `main.ts` | — | — | — |
| **Config** | — | `config.ts`, `types.ts`, `data.ts` | — | — | — |
| **Overlays** | — | — | — | — | `hud.ts`, `dialogue.ts`, `inventory.ts`, `companions.ts`, `hints.ts`, `endgame.ts` |
| **Engine** | — | — | — | — | `state.ts`, `audio.ts`, `threats.ts`, `transitions.ts`, `effects.ts` |

---

## 8. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Feature click detection breaks | Medium | High | Use distance-based hit testing (same as SearchRenderer) |
| Room collision feels wrong | Low | Medium | Use same AABB collision, just in 2D |
| NPC wander AI needs tuning | Medium | Medium | Use same logic, adjust speed/scale |
| Zone transition visual mismatch | Low | Low | Both FP and TP now use same top-down camera |
| Data mapping errors | Medium | High | Map each zone property explicitly in the data table above |
| Build fails (import errors) | Low | High | Update imports in main.ts first, then build |
| Three.js still referenced elsewhere | Low | Medium | grep for THREE imports; only fp/tp renderers use it |
| Performance regression | Low | Low | Canvas 2D is generally faster than WebGL for this complexity |
| Visual fidelity loss | Medium | Low | Intentional; focus on clarity over realism |

---

## 9. Implementation Order

1. **Create `fp-room-renderer-2d.ts`** — simplest scope, 9 zones to validate
2. **Create `tp-engine-2d.ts`** — more complex, 8 zones to validate
3. **Update `main.ts`** — wire up new renderers, remove Three.js imports
4. **Update `config.ts`** — remove 3D-specific config
5. **Update `types.ts`** — remove 3D state interfaces
6. **Update `data.ts`** — remove zone fog properties
7. **Delete `fp-renderer.ts` and `tp-renderer.ts`**
8. **Build & test** — `npm run build` + manual testing
