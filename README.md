# 🐾 Turbo: Lost & Found

A browser-based adventure game where you play as a lost dog navigating the world to find your way home. Choose from 5 unique dogs, each with distinct traits and personalities, and explore procedurally-generated zones filled with threats, companions, and clues.

## 🎮 Game Overview

**Premise:** You're a dog who's wandered far from home. Navigate through suburban streets, dog parks, apartments, animal shelters, and neighborhoods — meeting new friends, avoiding dangers, and following scent trails back to the gate you remember.

**Features:**
- **5 playable dogs** — Turbo (Alaskan Husky), Watson (German Shepherd), Nova (Golden Retriever), Walter (English Bulldog), Beaux (Chihuahua)
- **3 view modes** — First-person exploration, third-person adventure, human search interludes
- **5 zones** — Suburban Streets, Dog Park, Apartment, Animal Shelter, Neighborhood
- **Threat mini-games** — Traffic timing, manga-style combat, storm shelter, vacuum sneak
- **Inventory system** — Collect treats, toys, clues, and companions
- **Companion system** — Meet and manage fellow dogs for bonuses
- **Progressive hints** — Route guidance unlocks as you explore
- **Visual effects** — Particles, screen shake, lighting transitions

## 🛠️ Tech Stack

- **TypeScript** — Full type safety across all engine modules
- **Three.js** — 3D rendering for first-person rooms and third-person zones
- **Vite** — Fast dev server and build tooling
- **Vitest** + **jsdom** — Unit testing with 187 tests across 7 test files
- **Howler.js** — Audio management with Web Audio fallback
- **Canvas 2D** — HUD, dialogue, inventory, and effects overlays

## 📁 Project Structure

```
turbo-game/
├── turbo-web/                 # Web game (main project)
│   ├── src/
│   │   ├── main.ts            # Entry point, render loop, event wiring
│   │   ├── config.ts          # Game configuration constants
│   │   ├── data.ts            # Dogs, zones, items, threats data
│   │   ├── types.ts           # Shared TypeScript interfaces
│   │   ├── engine/
│   │   │   ├── state.ts       # Game state machine + pub/sub
│   │   │   ├── audio.ts       # Howler audio manager
│   │   │   ├── hud.ts         # HUD renderer
│   │   │   ├── dialogue.ts    # Dialogue system
│   │   │   ├── inventory.ts   # Inventory system
│   │   │   ├── companions.ts  # Companion system + renderer
│   │   │   ├── hints.ts       # Hint/route system
│   │   │   ├── threats.ts     # Threat manager
│   │   │   ├── effects.ts     # Visual effects (particles, shake)
│   │   │   ├── endgame.ts     # Win/lose screens
│   │   │   ├── transitions.ts # Zone transition logic
│   │   │   ├── render/
│   │   │   │   ├── fp-renderer.ts     # First-person room renderer
│   │   │   │   ├── tp-renderer.ts     # Third-person adventure renderer
│   │   │   │   ├── search-renderer.ts # Human search interlude
│   │   │   │   └── manga-combat.ts    # Manga cutaway combat
│   │   │   └── *.test.ts      # Unit tests (187 tests)
│   │   ├── config.ts          # Game configuration
│   │   ├── data.ts            # Game data (dogs, zones, items, threats)
│   │   ├── types.ts           # TypeScript types
│   │   └── main.ts            # Entry point
│   ├── index.html             # Game HTML
│   ├── package.json           # Dependencies + scripts
│   ├── vite.config.ts         # Vite + Vitest config
│   └── tsconfig.json          # TypeScript config
├── PLAN.md                    # Development plan + task tracker
├── css/
│   └── style.css              # Game styles
├── dist/                      # Build output (gitignored)
├── .gitignore
└── README.md
```

## 🚀 Getting Started

### Prerequisites

- **Node.js** ≥ 18 (with npm or npx)
- A modern browser (Chrome, Firefox, Edge, or Safari)
- **xvfb** (for analysis test automation) — see below

### Install Dependencies

```bash
cd turbo-game/turbo-web
npm install
```

This installs:
- **Runtime:** `three` (3D rendering), `howler` (audio)
- **Dev tools:** `vite` (build), `typescript` (compilation), `vitest` (testing), `jsdom` (test environment)

### System Requirements for Analysis Test Automation

The automated analysis scripts (`analyze`, `analyze:sim`, `test:analysis`, `test:all`) use Playwright with WebGL rendering, which requires a virtual display server. Install xvfb before running these commands:

```bash
# Debian/Ubuntu
sudo apt-get install xvfb

# RHEL/CentOS/Fedora
sudo yum install xorg-x11-server-Xvfb

# macOS (via Homebrew)
brew install --cask xquartz
# Then use: xvfb-run is not available on macOS; use XQuartz + X11 forwarding
```

**Important:** The analysis tests require a running Vite dev server on port 3000 and xvfb installed. Start the dev server first:

```bash
cd turbo-game/turbo-web
npm run dev
# Wait for "VITE v6.x.x ready in XXX ms"
# Then in another terminal:
npm run test:analysis    # or
npm run test:all
```

### Run Tests

```bash
cd turbo-game/turbo-web
npm test
```

**187 tests** across 7 test files — all passing ✅

| Test File | Tests | Covers |
|-----------|-------|--------|
| `state.test.ts` | 49 | Game state machine, events, transitions |
| `data-validation.test.ts` | 35 | Data integrity, type safety, references |
| `inventory.test.ts` | 21 | Item pickup, use, combine, capacity |
| `companions.test.ts` | 19 | Companion meet, manage, bonuses |
| `hints.test.ts` | 19 | Hint unlocking, route display |
| `threats.test.ts` | 17 | Threat spawning, mini-game logic |
| `endgame.test.ts` | 17 | Win/lose conditions, scoring |

### Automated Analysis Scripts

These scripts automate game playthroughs with browser automation (Playwright + xvfb) and generate reports. They require a running Vite dev server and xvfb installed.

```bash
cd turbo-game/turbo-web
npm run analyze          # Run deep analysis (all 5 dogs)
npm run analyze:sim      # Run playthrough simulation
npm run test:analysis    # Run analysis as vitest tests
npm run test:all         # Run unit tests + analysis tests
```

| Script | Command | What it does |
|--------|---------|-------------|
| `analyze` | `xvfb-run npx tsx deep-analysis.ts` | Runs full deep-analysis across all 5 dogs — DOM inspection, canvas rendering checks, UI panel testing, keyboard interaction, and generates `deep-analysis-report.md` |
| `analyze:sim` | `xvfb-run npx tsx playthrough-sim.ts` | Runs playthrough simulation across all 5 dogs — tracks zones visited, items collected, companions met, happiness timelines, and generates `playthrough-report.md` |
| `test:analysis` | `node scripts/run-analysis.mjs` | Runs 6 vitest smoke tests that verify both analysis scripts complete successfully and produce valid output files (reports + screenshots). **~10 min runtime** (5 dogs × 2 min each) |
| `test:all` | `vitest run && node scripts/run-analysis.mjs` | Runs the full suite: unit tests first, then analysis integration tests (chained — analysis only runs if unit tests pass). **~10 min runtime** |

> **Note:** Each analysis script runs all 5 dogs sequentially (~2 min per dog). The `test:analysis` and `test:all` scripts take ~10 minutes total. Consider running them in CI only, not during local development.

### Build

```bash
cd turbo-game/turbo-web
npm run build
```

Compiles TypeScript → outputs to `turbo-web/dist/` (~512KB minified bundle).

### Run Locally (Dev Server)

```bash
cd turbo-game/turbo-web
npm run dev
```

Opens the game at `http://localhost:5173` with hot-reload.

### Preview Production Build

```bash
cd turbo-game/turbo-web
npm run preview
```

Serves the built `dist/` folder locally for testing the production build.

## 🎮 How to Play

1. **Choose your dog** from the selection screen — each has unique traits
2. **Explore** using WASD/arrow keys (first-person) or cursor keys (third-person)
3. **Collect items** by walking over them — open inventory with [I]
4. **Meet companions** — manage your pack with [C]
5. **View hints** — route guidance with [H]
6. **Handle threats** — press SPACE for timing/combat mini-games
7. **Find your way home** — follow clues back to the gate

### Controls

| Key | Action |
|-----|--------|
| **WASD / Arrow Keys** | Move |
| **SPACE** | Advance dialogue / trigger threat mini-game |
| **I** | Toggle inventory panel |
| **C** | Toggle companion panel |
| **H** | Toggle hint/route panel |

## 📦 Deployment

### Option 1: GitHub Pages

```bash
cd turbo-game/turbo-web

# Set the base path in vite.config.ts to match your repo name
# Then build and deploy:
npx vite build
```

Push the `dist/` contents to the `gh-pages` branch (or use a GitHub Actions workflow).

### Option 2: Netlify / Vercel

Connect your `turbo-game` repository to Netlify or Vercel:

| Setting | Value |
|---------|-------|
| **Build command** | `cd turbo-web && npm run build` |
| **Publish directory** | `turbo-web/dist` |

### Option 3: Static Hosting

The `dist/` folder is a self-contained static site. Upload it to any web server:

```bash
# Build first
cd turbo-game/turbo-web && npm run build

# Then copy dist/ to your server
scp -r dist/* user@yourserver:/var/www/turbo-game/
```

### Option 4: GitHub Repository

The game source is on GitHub:

**https://github.com/mcrockett86/turbo-game**

## 📐 Architecture

### State Machine

The game uses an event-driven state machine (`engine/state.ts`) with pub/sub:

```
DogSelect → ZoneEnter → FPExplore ↔ TPAdventure ↔ HumanSearch
     → ThreatMiniGame → MangaCombat → ZoneExit → Endgame(Win/Lose)
```

### Rendering

- **Unified render loop** — single `requestAnimationFrame` drives all canvases
- **Three.js** — 3D rendering for FP rooms and TP zones
- **Canvas 2D** — HUD, dialogue, inventory, companion, hint, effects, endgame overlays
- **Event-driven updates** — `State.on()` subscriptions auto-update overlays on game events

### Engine Modules

Each engine module is a self-contained system with its own renderer:

| Module | Responsibility |
|--------|---------------|
| `state` | Game state machine, event bus, save/load |
| `audio` | Howler.js audio with Web Audio fallback |
| `hud` | HUD renderer (dog name, happiness bar) |
| `dialogue` | Dialogue system with typewriter effect |
| `inventory` | 16-slot inventory grid, pickup/use/combine |
| `companions` | Meet/manage companions, active bonuses |
| `hints` | Progressive hint unlocking, route display |
| `threats` | Threat spawning, mini-game management |
| `effects` | Particles, screen shake, light pulses |
| `endgame` | Win/lose screens with score |

## 🧪 Development

### Code Quality

The project follows strict software development guidelines:

- **SOLID principles** — Single Responsibility, Open/Closed, Liskov Substitution, Interface Segregation, Dependency Inversion
- **KISS** — Keep it simple, prefer composition over inheritance
- **DRY** — Extract common logic, avoid duplication
- **Intention-revealing names** — Variables, functions, and classes tell you why they exist
- **FIRST principles for tests** — Fast, Independent, Repeatable, Self-Validating, Timely

For full details, see the **software-developer** skill at `~/.npm-global/lib/node_modules/openclaw/skills/software-developer/SKILL.md`.

### Adding a New Zone

1. Add zone data to `src/data.ts` (`ZONES` record)
2. Set `type: 'fp' | 'tp' | 'human'` for the view mode
3. Add rooms (FP) or obstacles/NPCs (TP)
4. Update `CONFIG.zones` if adding to progression
5. Add tests in `src/engine/` if the zone introduces new mechanics

### Adding a New Threat

1. Add threat data to `src/data.ts` (`THREATS` record)
2. Set `type: 'timing' | 'combat' | 'comfort' | 'sneak'`
3. Implement mini-game logic in `src/engine/threats.ts`
4. Add manga cutaway text in `mangaText` and `mangaType`
5. Add tests in `src/engine/threats.test.ts`

## 📜 Development Plan

The full development plan with task tracking is in [`PLAN.md`](PLAN.md).

**Current status:** Phase 0 complete — all 17 engine components wired up. 187/187 tests passing.

## 📄 License

Private project — all rights reserved.
