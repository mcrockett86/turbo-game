// ===== Turbo: Lost & Found — Main Entry Point =====
// Bootstraps the game engine, loads data, initializes systems

import { DOGS, ZONES, ITEMS, THREATS } from './data';
import { State } from '@/engine/state';
import { Audio } from '@/engine/audio';
import { CONFIG } from '@/config';
import { FpRoomRenderer } from '@/engine/render/fp-renderer';
import { TpEngine } from '@/engine/render/tp-renderer';
import { SearchRenderer } from '@/engine/render/search-renderer';
import { HUDRenderer } from '@/engine/hud';
import { DialogueRenderer } from '@/engine/dialogue';
import { InventoryRenderer } from '@/engine/inventory';
import { CompanionRenderer } from '@/engine/companions';
import { HintRouteRenderer } from '@/engine/hints';
import { VisualEffectsRenderer } from '@/engine/effects';
import { EndgameRenderer } from '@/engine/endgame';
import { MangaCombatRenderer } from '@/engine/render/manga-combat';
import { ThreatManager } from '@/engine/threats';
import type { GameState, GameEvent, Dog, Zone, Room, RoomFeature, Companion, NPC } from '@/types';

// ---- Active renderer instances ----
let fpRenderer: FpRoomRenderer | null = null;
let tpEngine: TpEngine | null = null;
let searchRenderer: SearchRenderer | null = null;

// ---- Active zone type tracking ----
let activeZoneType: 'fp' | 'tp' | 'search' | null = null;

// ---- Transition renderer ----
import { ZoneTransitionRenderer } from '@/engine/transitions';
let transitionRenderer: ZoneTransitionRenderer | null = null;

// ---- Canvas Overlay Instances ----
let hudRenderer: HUDRenderer | null = null;
let dialogueRenderer: DialogueRenderer | null = null;
let inventoryRenderer: InventoryRenderer | null = null;
let companionRenderer: CompanionRenderer | null = null;
let hintRenderer: HintRouteRenderer | null = null;
let effectsRenderer: VisualEffectsRenderer | null = null;
let endgameRenderer: EndgameRenderer | null = null;
let mangaRenderer: MangaCombatRenderer | null = null;
let threatManager: ThreatManager | null = null;

// ---- Panel visibility ----
let panelsOpen: Record<string, boolean> = {
  inventory: false,
  companion: false,
  hint: false,
};

// ---- Unified render loop ----
let animFrameId: number | null = null;
let isRunning = false;

function startRenderLoop(): void {
  if (isRunning) return;
  isRunning = true;

  const loop = (time: number) => {
    renderOverlays(time);
    animFrameId = requestAnimationFrame(loop);
  };
  animFrameId = requestAnimationFrame(loop);
}

function stopRenderLoop(): void {
  if (animFrameId) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }
  isRunning = false;
}

function renderOverlays(_time: number): void {
  // Sync HUD state from current game state
  if (hudRenderer) {
    const s = State.state;
    const itemCount = s.inventory.reduce((sum, slot) => sum + (slot.count || 0), 0);
    hudRenderer.updateState({
      dogName: s.currentDog?.name || 'Turbo',
      happiness: s.happiness,
      currentZone: s.currentZone || '',
      currentRoom: s.currentRoom || '',
      itemCount,
      companionName: s.activeCompanion || null,
      isTransitioning: s.gamePhase === 'transition',
      threatActive: s.threatActive,
    });
  }

  // Sync inventory slots from State
  if (inventoryRenderer && panelsOpen.inventory) {
    const slots = (inventoryRenderer as any).slots;
    if (slots) {
      for (let i = 0; i < slots.length; i++) {
        const src = State.state.inventory[i];
        slots[i] = src && src.count > 0
          ? { item: src.item, count: src.count }
          : { item: null, count: 0 };
      }
    }
  }

  // Sync companion data
  if (companionRenderer) {
    const met = State.state.companions;
    const active = State.state.activeCompanion
      ? met.find(c => c.id === State.state.activeCompanion) || null
      : null;
    companionRenderer.setCompanions(met, active);
  }

  // Update TP engine if active
  if (tpEngine && activeZoneType === 'tp') {
    const delta = 1 / 60; // ~60fps
    tpEngine.update(delta, time);
  }

  // Update search renderer if active
  if (searchRenderer && activeZoneType === 'search') {
    searchRenderer.update(1 / 60);
  }

  // Effects overlay — update particles in the unified loop
  if (effectsRenderer && !document.getElementById('effects-canvas')?.classList.contains('hidden')) {
    effectsRenderer.update(1 / 60);
    effectsRenderer.render();
  }

  // Endgame overlay — only draw if in a terminal state
  if (endgameRenderer) {
    const state = endgameRenderer.getState();
    if (state === 'won' || state === 'lost') {
      endgameRenderer.draw();
    }
  }
}

// ---- Canvas Sizing Helper ----
function sizeCanvasToWindow(canvas: HTMLCanvasElement): void {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

// ---- Initialization ----
function init(): void {
  console.log('[Turbo] Initializing...');

  // Load or create state
  const saved = State.load();
  if (saved && saved.currentDog) {
    State.state = { ...State.state, ...saved };
    console.log('[Turbo] Loaded save from', new Date(saved.startTime).toLocaleString());
  }

  // Initialize overlay renderers
  initOverlays();

  // Setup event listeners for UI updates
  setupUI();

  // Wire State events to overlay updates
  wireStateEvents();

  // Render dog selection screen
  renderDogSelect();

  // Show initial HUD
  State.updateHUD('Turbo', State.state.happiness);
  document.getElementById('hud')!.classList.remove('hidden');

  console.log('[Turbo] Ready!');
}

// ---- Initialize All Overlay Renderers ----
function initOverlays(): void {
  // HUD
  const hudCanvas = document.getElementById('hud-canvas');
  if (hudCanvas instanceof HTMLCanvasElement) {
    hudRenderer = new HUDRenderer(hudCanvas);
    hudRenderer.start();
    hudRenderer.setOnPanelToggle((panel) => {
      togglePanel(panel);
    });
  }

  // Dialogue
  const dialogCanvas = document.getElementById('dialogue-canvas');
  if (dialogCanvas instanceof HTMLCanvasElement) {
    dialogueRenderer = new DialogueRenderer(dialogCanvas);
    dialogueRenderer.setOnDialogueComplete(() => {
      // Auto-hide dialogue after completion
      setTimeout(() => {
        const ds = (dialogueRenderer as any).state;
        if (dialogueRenderer && (!ds || !ds.isTyping)) {
          dialogueRenderer.hideDialogue();
          document.getElementById('dialogue-canvas')?.classList.add('hidden');
        }
      }, 1000);
    });
    dialogueRenderer.setOnLineAdvance(() => {
      if (dialogueRenderer) dialogueRenderer.advanceLine();
    });
  }

  // Inventory
  const invCanvas = document.getElementById('inventory-canvas');
  if (invCanvas instanceof HTMLCanvasElement) {
    inventoryRenderer = new InventoryRenderer(invCanvas);
    inventoryRenderer.setOnItemUse((item) => {
      useItem(item);
    });
    inventoryRenderer.setOnItemDrop((item) => {
      dropItem(item);
    });
  }

  // Companion panel
  const compCanvas = document.getElementById('companion-canvas');
  if (compCanvas instanceof HTMLCanvasElement) {
    companionRenderer = new CompanionRenderer(compCanvas);
  }

  // Hint panel
  const hintCanvas = document.getElementById('hint-canvas');
  if (hintCanvas instanceof HTMLCanvasElement) {
    hintRenderer = new HintRouteRenderer(hintCanvas);
    hintRenderer.setOnHintSelect((hint) => {
      console.log('[Turbo] Hint selected:', hint.title);
    });
    hintRenderer.setOnRouteSelect((route) => {
      console.log('[Turbo] Route revealed:', `${route.from} → ${route.to}`);
    });
  }

  // Effects
  const fxCanvas = document.getElementById('effects-canvas');
  if (fxCanvas instanceof HTMLCanvasElement) {
    effectsRenderer = new VisualEffectsRenderer(fxCanvas);
  }

  // Endgame
  const endCanvas = document.getElementById('endgame-canvas');
  if (endCanvas instanceof HTMLCanvasElement) {
    endgameRenderer = new EndgameRenderer(endCanvas);
    endgameRenderer.setOnRestart(() => {
      restartGame();
    });
    endgameRenderer.setOnMenu(() => {
      backToMenu();
    });
  }

  // Manga combat
  const mangaCanvas = document.getElementById('manga-canvas');
  if (mangaCanvas instanceof HTMLCanvasElement) {
    mangaRenderer = new MangaCombatRenderer(mangaCanvas);
  }

  // Threat manager
  threatManager = new ThreatManager();
  threatManager.setOnThreatStart((threat) => {
    console.log('[Turbo] Threat started:', threat.type);
    showThreatOverlay(threat);
  });
  threatManager.setOnThreatResolved((score) => {
    console.log('[Turbo] Threat resolved with score:', score);
    State.resolveThreat(true);
    hideThreatOverlay();
  });
  threatManager.setOnThreatFailed((reason) => {
    console.log('[Turbo] Threat failed:', reason);
    State.resolveThreat(false);
    hideThreatOverlay();
  });
  threatManager.setOnThreatUpdate((state) => {
    if (hudRenderer) {
      hudRenderer.setThreatActive(state.active);
    }
  });

  // Start unified render loop
  startRenderLoop();
}

// ---- Wire State Events to Overlays ----
function wireStateEvents(): void {
  // Dog selected
  State.on('dog-selected', ((event: GameEvent) => {
    const e = event as GameEvent & { dogId: string };
    const dog = DOGS[e.dogId as keyof typeof DOGS];
    if (dog && hudRenderer) hudRenderer.setDogName(dog.name);
    if (dog && dialogueRenderer) {
      dialogueRenderer.showDialogue(dog.lines.intro, dog.name);
      document.getElementById('dialogue-canvas')?.classList.remove('hidden');
    }
  }) as Parameters<typeof State.on>[1]);

  // Zone entered
  State.on('zone-entered', ((event: GameEvent) => {
    const e = event as GameEvent & { zoneName: string };
    if (hudRenderer) hudRenderer.setZone(e.zoneName);
    if (dialogueRenderer) {
      dialogueRenderer.showDialogue(`Entered: ${e.zoneName}`, 'System');
      document.getElementById('dialogue-canvas')?.classList.remove('hidden');
    }
  }) as Parameters<typeof State.on>[1]);

  // Room entered
  State.on('room-entered', ((event: GameEvent) => {
    const e = event as GameEvent & { roomId: string };
    if (hudRenderer) hudRenderer.updateState({ currentRoom: e.roomId });
  }) as Parameters<typeof State.on>[1]);

  // Item collected
  State.on('item-collected', ((event: GameEvent) => {
    if (hudRenderer) hudRenderer.setItemCount(State.state.inventory.reduce((sum, slot) => sum + (slot.count || 0), 0));
    if (effectsRenderer) {
      effectsRenderer.spawnParticles(window.innerWidth / 2, window.innerHeight / 2, 15, 'sparkle', '#ffcc00');
    }
  }) as Parameters<typeof State.on>[1]);

  // Item used
  State.on('item-used', ((event: GameEvent) => {
    if (hudRenderer) hudRenderer.setItemCount(State.state.inventory.reduce((sum, slot) => sum + (slot.count || 0), 0));
  }) as Parameters<typeof State.on>[1]);

  // Companion met
  State.on('companion-met', ((event: GameEvent) => {
    const e = event as GameEvent & { companion: Companion };
    if (companionRenderer) companionRenderer.show();
    if (dialogueRenderer) {
      dialogueRenderer.showDialogue(`Met ${e.companion.name}!`, 'Turbo');
      document.getElementById('dialogue-canvas')?.classList.remove('hidden');
    }
  }) as Parameters<typeof State.on>[1]);

  // Companion activated
  State.on('companion-activated', ((event: GameEvent) => {
    const e = event as GameEvent & { companionId: string };
    const companion = State.state.companions.find(c => c.id === e.companionId);
    if (companion && hudRenderer) hudRenderer.setCompanion(companion.name);
    if (companion && dialogueRenderer) {
      dialogueRenderer.showDialogue(companion.dialogue[0], companion.name);
      document.getElementById('dialogue-canvas')?.classList.remove('hidden');
    }
  }) as Parameters<typeof State.on>[1]);

  // Hint unlocked
  State.on('hint-unlocked', ((event: GameEvent) => {
    const e = event as GameEvent & { hintId: string };
    if (hintRenderer) hintRenderer.unlockHint(e.hintId);
    if (dialogueRenderer) {
      dialogueRenderer.showDialogue(`New hint: ${e.hintId}`, 'System');
      document.getElementById('dialogue-canvas')?.classList.remove('hidden');
    }
  }) as Parameters<typeof State.on>[1]);

  // Route revealed (we derive this from hints)
  // No dedicated event needed — hint unlock handles it

  // Threat started
  State.on('threat-started', ((event: GameEvent) => {
    if (hudRenderer) hudRenderer.setThreatActive(true);
  }) as Parameters<typeof State.on>[1]);

  // Threat resolved
  State.on('threat-resolved', ((event: GameEvent) => {
    const e = event as GameEvent & { success: boolean };
    if (hudRenderer) hudRenderer.setThreatActive(false);
    if (effectsRenderer) {
      effectsRenderer.triggerShake(e.success ? 0.3 : 0.5, e.success ? 0.5 : 1.0);
    }
  }) as Parameters<typeof State.on>[1]);

  // Happiness changed
  State.on('happiness-changed', ((event: GameEvent) => {
    const e = event as GameEvent & { newHappiness: number };
    if (hudRenderer) hudRenderer.setHappiness(e.newHappiness);
  }) as Parameters<typeof State.on>[1]);

  // Game won
  State.on('game-win', ((event: GameEvent) => {
    const e = event as GameEvent & { score: number; time: number; companions: number; items: number };
    // Stop active zone renderer
    fpRenderer?.dispose(); fpRenderer = null;
    tpEngine?.dispose(); tpEngine = null;
    searchRenderer?.stop(); searchRenderer?.dispose(); searchRenderer = null;
    activeZoneType = null;
    // Stop render loop
    stopRenderLoop();
    // Show endgame
    if (endgameRenderer) {
      endgameRenderer.setState('won');
      endgameRenderer.setScoreData(e.score, e.time, e.items, e.companions, 0, State.state.happiness);
      endgameRenderer.setFinalDialogue('You made it home, Turbo!');
      document.getElementById('endgame-canvas')?.classList.remove('hidden');
    }
  }) as Parameters<typeof State.on>[1]);

  // Game over
  State.on('game-over', ((event: GameEvent) => {
    // Stop active zone renderer
    fpRenderer?.dispose(); fpRenderer = null;
    tpEngine?.dispose(); tpEngine = null;
    searchRenderer?.stop(); searchRenderer?.dispose(); searchRenderer = null;
    activeZoneType = null;
    // Stop render loop
    stopRenderLoop();
    // Show endgame
    if (endgameRenderer) {
      endgameRenderer.setState('lost');
      endgameRenderer.setScoreData(0, (Date.now() - State.state.startTime) / 1000, State.state.inventory.filter(s => s.item !== null).length, State.state.companions.length, 0, State.state.happiness);
      endgameRenderer.setFinalDialogue("Don't give up, Turbo!");
      document.getElementById('endgame-canvas')?.classList.remove('hidden');
    }
  }) as Parameters<typeof State.on>[1]);

  // HUD update
  State.on('hud-update', ((event: GameEvent) => {
    const e = event as GameEvent & { dogName: string; happiness: number };
    if (hudRenderer) {
      hudRenderer.setHappiness(e.happiness);
      hudRenderer.setDogName(e.dogName);
    }
  }) as Parameters<typeof State.on>[1]);

  // Dialogue show
  State.on('dialogue-show', ((event: GameEvent) => {
    const e = event as GameEvent & { text: string; speaker: string };
    if (dialogueRenderer) {
      dialogueRenderer.showDialogue(e.text, e.speaker);
      document.getElementById('dialogue-canvas')?.classList.remove('hidden');
    }
  }) as Parameters<typeof State.on>[1]);

  // Dialogue hide
  State.on('dialogue-hide', ((event: GameEvent) => {
    if (dialogueRenderer) {
      dialogueRenderer.hideDialogue();
      document.getElementById('dialogue-canvas')?.classList.add('hidden');
    }
  }) as Parameters<typeof State.on>[1]);

  // Panel toggle
  State.on('panel-toggle', ((event: GameEvent) => {
    const e = event as GameEvent & { panel: string; open: boolean };
    panelsOpen[e.panel] = e.open;

    if (e.panel === 'inventory') {
      if (inventoryRenderer) {
        e.open ? inventoryRenderer.show() : inventoryRenderer.hide();
        const el = document.getElementById('inventory-canvas');
        if (el) e.open ? el.classList.remove('hidden') : el.classList.add('hidden');
      }
    } else if (e.panel === 'companion') {
      if (companionRenderer) {
        e.open ? companionRenderer.show() : companionRenderer.hide();
        const el = document.getElementById('companion-canvas');
        if (el) e.open ? el.classList.remove('hidden') : el.classList.add('hidden');
      }
    } else if (e.panel === 'hint') {
      if (hintRenderer) {
        e.open ? hintRenderer.show() : hintRenderer.hide();
        const el = document.getElementById('hint-canvas');
        if (el) e.open ? el.classList.remove('hidden') : el.classList.add('hidden');
      }
    }
  }) as Parameters<typeof State.on>[1]);

  // Transition start
  State.on('transition-start', ((_event: GameEvent) => {
    // Transition flash effect (optional polish)
  }) as Parameters<typeof State.on>[1]);

  // Transition end
  State.on('transition-end', ((_event: GameEvent) => {
    // Transition flash effect (optional polish)
  }) as Parameters<typeof State.on>[1]);
}

// ---- UI Event Setup ----
function setupUI(): void {
  // Panel buttons
  document.getElementById('inv-btn')?.addEventListener('click', () => {
    Audio.playSFX('click');
    togglePanel('inventory');
  });
  document.getElementById('comp-btn')?.addEventListener('click', () => {
    Audio.playSFX('click');
    togglePanel('companion');
  });
  document.getElementById('hint-btn')?.addEventListener('click', () => {
    Audio.playSFX('click');
    togglePanel('hint');
  });
  document.getElementById('close-inv')?.addEventListener('click', () => {
    Audio.playSFX('click');
    togglePanel('inventory');
  });

  // Keyboard
  document.addEventListener('keydown', handleKeyDown);
  document.addEventListener('keyup', handleKeyUp);

  // Window resize
  window.addEventListener('resize', onWindowResize);
}

function onWindowResize(): void {
  // Resize all canvases
  const canvasIds = [
    'fp-canvas', 'tp-canvas', 'human-canvas',
    'hud-canvas', 'dialogue-canvas', 'inventory-canvas',
    'companion-canvas', 'hint-canvas', 'manga-canvas',
    'effects-canvas', 'endgame-canvas',
  ];

  for (const id of canvasIds) {
    const el = document.getElementById(id);
    if (el instanceof HTMLCanvasElement) {
      sizeCanvasToWindow(el);
    }
  }

  // Resize renderers
  if (hudRenderer) hudRenderer.resize(window.innerWidth, window.innerHeight);
  if (dialogueRenderer) dialogueRenderer.resize(window.innerWidth, window.innerHeight);
  if (inventoryRenderer) inventoryRenderer.resize(window.innerWidth, window.innerHeight);
  if (companionRenderer) companionRenderer.resize(window.innerWidth, window.innerHeight);
  if (hintRenderer) hintRenderer.resize(window.innerWidth, window.innerHeight);
  if (effectsRenderer) effectsRenderer.resize(window.innerWidth, window.innerHeight);
  if (endgameRenderer) endgameRenderer.resize(window.innerWidth, window.innerHeight);
  if (mangaRenderer) mangaRenderer.resize(window.innerWidth, window.innerHeight);
}

function togglePanel(name: string): void {
  panelsOpen[name] = !panelsOpen[name];
  State.togglePanel(name, panelsOpen[name]);
}

// ---- Dog Selection ----
function renderDogSelect(): void {
  const grid = document.getElementById('dog-grid');
  if (!grid) return;

  grid.innerHTML = '';

  // Add start button if it doesn't exist
  let startBtn = document.getElementById('start-adventure-btn');
  if (!startBtn) {
    startBtn = document.createElement('button');
    startBtn.id = 'start-adventure-btn';
    startBtn.className = 'start-btn';
    startBtn.textContent = '🐾 Start Adventure';
    startBtn.style.display = 'none';
    startBtn.addEventListener('click', () => {
      Audio.playSFX('select');
      const selected = document.querySelector('.dog-card.selected');
      if (selected) {
        const dogId = selected.dataset.dogId;
        const dog = DOGS[dogId as keyof typeof DOGS];
        if (dog) startAdventure(dogId, dog);
      }
    });
    document.getElementById('dog-select')?.appendChild(startBtn);
  }

  for (const dogId of Object.keys(DOGS)) {
    const dog = DOGS[dogId as keyof typeof DOGS];
    const card = document.createElement('div');
    card.className = 'dog-card';
    card.dataset.dogId = dogId;

    // Dog portrait canvas
    const canvas = document.createElement('canvas');
    canvas.width = 120;
    canvas.height = 120;
    canvas.style.width = '120px';
    canvas.style.height = '120px';
    drawDogPortrait(canvas, dog);

    const nameEl = document.createElement('div');
    nameEl.className = 'dog-name';
    nameEl.textContent = dog.name;

    const breedEl = document.createElement('div');
    breedEl.className = 'dog-breed';
    breedEl.textContent = dog.breed;

    const traitEl = document.createElement('div');
    traitEl.className = 'dog-trait';
    traitEl.textContent = dog.trait;

    card.appendChild(canvas);
    card.appendChild(nameEl);
    card.appendChild(breedEl);
    card.appendChild(traitEl);

    card.addEventListener('click', () => selectDog(dogId, card));
    grid.appendChild(card);
  }
}

function selectDog(dogId: string, card: HTMLElement): void {
  Audio.playSFX('select');

  // Highlight selected
  document.querySelectorAll('.dog-card').forEach(c => c.classList.remove('selected'));
  card.classList.add('selected');

  const dog = DOGS[dogId as keyof typeof DOGS];
  if (!dog) return;

  // Show intro dialogue
  State.showDialogue(dog.lines.intro, dog.name);
  Audio.playSFX('bark');

  // Show start button
  const startBtn = document.getElementById('start-adventure-btn');
  if (startBtn) startBtn.style.display = 'block';
}

// ---- Start Adventure ----
function startAdventure(dogId: string, dog: Dog): void {
  State.selectDog(dogId, dog);
  State.hideDialogue();
  State.updateHUD(dog.name, State.state.happiness);

  // Enter first zone
  const firstZone = ZONES['suburban_streets'];
  if (firstZone) {
    State.enterZone('suburban_streets', firstZone);
    Audio.playMusic('suburban');
    showZoneTransition(firstZone.name, firstZone.desc);

    // Enter first room after transition
    setTimeout(() => {
      State.enterRoom('start', 0);
      State.endTransition();
      startFPView();
    }, 2500);
  }
}

// ---- Zone Transition ----
function showZoneTransition(name: string, desc: string): void {
  const el = document.getElementById('zone-transition');
  if (!el) return;
  el.classList.remove('hidden');

  document.getElementById('zone-name')!.textContent = name;
  document.getElementById('zone-desc')!.textContent = desc;
  Audio.playSFX('transition_whoosh');

  setTimeout(() => {
    el.classList.add('hidden');
    State.endTransition();
  }, 2500);
}

// ---- FP View (placeholder) ----
function startFPView(): void {
  console.log('[Turbo] Starting FP view...');
  const canvasEl = document.getElementById('fp-canvas');
  if (!canvasEl || !(canvasEl instanceof HTMLCanvasElement)) return;
  const canvas = canvasEl;

  canvas.style.display = 'block';

  // Dispose previous renderer if switching rooms
  fpRenderer?.dispose();

  // Initialize renderer
  fpRenderer = new FpRoomRenderer(canvas);

  // Get current zone and room
  const zoneId = State.state.currentZone;
  const zoneIndex = State.state.currentZoneIndex;
  const roomIndex = State.state.currentRoomIndex;

  if (!zoneId || !ZONES[zoneId as keyof typeof ZONES]) return;

  const zoneData = ZONES[zoneId as keyof typeof ZONES];
  if (!('rooms' in zoneData) || !zoneData.rooms || roomIndex >= zoneData.rooms.length) return;

  fpRenderer.init(zoneId, zoneData, roomIndex);

  // Wire up feature clicks
  fpRenderer.setOnFeatureClick((feature: RoomFeature) => {
    handleFeatureClick(feature);
  });

  // Wire up exit clicks
  fpRenderer.setOnExitClick((exitRoomId: string) => {
    handleExitClick(exitRoomId);
  });

  // Start happiness decay timer
  if (!fpRenderer.happinessInterval) {
    fpRenderer.startHappinessDecay();
  }

  // Show HUD
  document.getElementById('hud')!.classList.remove('hidden');
}

// ---- Feature Click Handler ----
function handleFeatureClick(feature: RoomFeature): void {
  console.log('[Turbo] Feature clicked:', feature.type, feature.label);

  switch (feature.type) {
    case 'food':
      if (feature.item) {
        State.collectItem(feature.item, ITEMS[feature.item as keyof typeof ITEMS]?.name || 'Food');
        Audio.playSFX('item_pickup');
        State.showDialogue('Found ' + (ITEMS[feature.item as keyof typeof ITEMS]?.name || 'something') + '!', 'Turbo');
      }
      break;

    case 'hint':
      if (feature.item) {
        State.collectItem(feature.item, ITEMS[feature.item as keyof typeof ITEMS]?.name || 'Clue');
        Audio.playSFX('item_pickup');
        State.unlockHint(feature.item);
        State.showDialogue('A clue! Maybe this will help find the way home.', 'Turbo');
      }
      break;

    case 'door':
      if (feature.locked) {
        if (State.state.flags['hasKey']) {
          feature.locked = false;
          Audio.playSFX('door_open');
          State.showDialogue('The key works! The door creaks open.', 'Turbo');
        } else {
          Audio.playSFX('door_locked');
          State.showDialogue('It\'s locked. Need a key.', 'Turbo');
        }
      } else {
        Audio.playSFX('door_open');
        if (feature.item) {
          State.collectItem(feature.item, ITEMS[feature.item as keyof typeof ITEMS]?.name || 'Key');
        }
      }
      break;

    case 'cat':
      Audio.playSFX('cat_hiss');
      State.startThreat({ ...THREATS.cat, solve: 'Press SPACE when the cat is distracted' });
      State.showDialogue('A mean cat hisses at you! *growls*', 'Turbo');
      break;

    case 'dog_friend':
      Audio.playSFX('bark');
      State.meetCompanion({
        id: 'shelter_dog',
        name: 'Buddy',
        breed: 'Mixed Breed',
        trait: '🐾 Loyal',
        dialogue: ['Woof! Want to play?', 'I\'ll follow you anywhere!', '*wags tail*'],
      });
      State.showDialogue('A new friend! *wags tail furiously*', 'Turbo');
      break;

    case 'tv':
      Audio.playSFX('bark');
      State.showDialogue('The TV barks back! ...Wait, that\'s weird.', 'Turbo');
      break;

    case 'person':
      State.showDialogue('"Have you seen a dog like him?" ...They don\'t recognize me.', 'Turbo');
      break;

    case 'home':
      Audio.playSFX('found_home');
      State.gameWin();
      State.showDialogue('Home. Sweet home. *happy tail wags*', 'Turbo');
      break;

    case 'tree_clue':
      if (feature.item) {
        State.collectItem(feature.item, 'Tree Clue');
        Audio.playSFX('item_pickup');
        State.unlockHint('tree_clue');
        State.showDialogue('This tree! I remember scratching my name here!', 'Turbo');
      }
      break;

    default:
      State.showDialogue(feature.label, 'Turbo');
  }
}

// ---- Exit Click Handler ----
function handleExitClick(exitRoomId: string): void {
  console.log('[Turbo] Moving to:', exitRoomId);

  const currentZoneId = State.state.currentZone;
  if (!currentZoneId) return;
  const currentZone = ZONES[currentZoneId as keyof typeof ZONES];
  if (!currentZone || !('rooms' in currentZone) || !currentZone.rooms) return;

  const room = currentZone.rooms.find((r: Room) => r.id === State.state.currentRoom);
  if (!room) return;

  if (room.isEntrance && room.entranceZone) {
    transitionToZone(room.entranceZone);
    return;
  }

  const targetRoomIndex = currentZone.rooms.findIndex((r: Room) => r.id === exitRoomId);
  if (targetRoomIndex < 0) return;

  State.enterRoom(exitRoomId, targetRoomIndex);
  fpRenderer?.moveTo(0, 0);

  const targetRoom = currentZone.rooms[targetRoomIndex];
  State.showDialogue('You enter: ' + targetRoom.name, 'Turbo');
}

// ---- Zone Type Routing (Phase 1) ----
function transitionToZone(zoneId: string): void {
  const zoneData = ZONES[zoneId as keyof typeof ZONES];
  if (!zoneData) return;

  const zoneType = zoneData.type;
  const zoneWithRooms = zoneData as Zone & { rooms: Room[] };

  // Dispose inactive renderers
  if (zoneType !== 'fp') {
    fpRenderer?.dispose();
    fpRenderer = null;
  }
  if (zoneType !== 'tp') {
    tpEngine?.dispose();
    tpEngine = null;
  }
  if (zoneType !== 'search') {
    if (searchRenderer) {
      searchRenderer.stop();
      searchRenderer.dispose();
      searchRenderer = null;
    }
  }

  // Hide TP/search canvases, show relevant one
  const tpCanvas = document.getElementById('tp-canvas');
  const fpCanvas = document.getElementById('fp-canvas');
  const humanCanvas = document.getElementById('human-canvas');

  if (tpCanvas instanceof HTMLCanvasElement) tpCanvas.style.display = 'none';
  if (fpCanvas instanceof HTMLCanvasElement) fpCanvas.style.display = 'none';
  if (humanCanvas instanceof HTMLCanvasElement) humanCanvas.style.display = 'none';

  State.startTransition(zoneWithRooms.name, zoneWithRooms.desc);
  Audio.playMusic(zoneId);

  // Use ZoneTransitionRenderer for smooth transition
  const transitionCanvas = document.getElementById('effects-canvas');
  if (transitionCanvas instanceof HTMLCanvasElement) {
    if (!transitionRenderer) {
      transitionRenderer = new ZoneTransitionRenderer(transitionCanvas);
    }
    const types: Array<'fade' | 'wipe' | 'zoom' | 'slide'> = ['fade', 'wipe', 'zoom', 'slide'];
    const chosenType = types[Math.floor(Math.random() * types.length)];
    transitionRenderer.startTransition(chosenType, zoneWithRooms.name, 1.5, () => {
      // After transition completes
      State.enterZone(zoneId, zoneData);
      State.endTransition();
      activeZoneType = zoneType;

      switch (zoneType) {
        case 'fp':
          if (zoneWithRooms.rooms && zoneWithRooms.rooms.length > 0) {
            startFPView();
          }
          break;
        case 'tp':
          startTPView(zoneId, zoneData);
          break;
        case 'search':
          startSearchView(zoneId, zoneData);
          break;
      }

      // Hide transition canvas
      if (document.getElementById('effects-canvas')) {
        document.getElementById('effects-canvas')?.classList.add('hidden');
      }
    });
    // Show transition canvas
    document.getElementById('effects-canvas')?.classList.remove('hidden');
  } else {
    // Fallback: instant transition
    State.enterZone(zoneId, zoneData);
    State.endTransition();
    activeZoneType = zoneType;

    switch (zoneType) {
      case 'fp':
        if (zoneWithRooms.rooms && zoneWithRooms.rooms.length > 0) {
          startFPView();
        }
        break;
      case 'tp':
        startTPView(zoneId, zoneData);
        break;
      case 'search':
        startSearchView(zoneId, zoneData);
        break;
    }
  }
}

// ---- TP View (Phase 1) ----
function startTPView(zoneId: string, zoneData: Zone): void {
  console.log('[Turbo] Starting TP view for zone:', zoneId);
  const canvasEl = document.getElementById('tp-canvas');
  if (!canvasEl || !(canvasEl instanceof HTMLCanvasElement)) return;
  const canvas = canvasEl;

  canvas.style.display = 'block';

  // Dispose previous engine
  tpEngine?.dispose();

  // Initialize engine
  tpEngine = new TpEngine(canvas);
  tpEngine.init(zoneId, zoneData);

  // Wire up callbacks
  tpEngine.setOnFeatureClick((type: string, data: any) => {
    console.log('[Turbo] TP feature clicked:', type, data);
    if (type === 'treasure' || type === 'scent_post') {
      State.collectItem('treasure', 'Scent Clue');
      Audio.playSFX('item_pickup');
      State.showDialogue('Found a scent clue! This leads somewhere familiar.', 'Turbo');
    }
    if (type === 'water_bowl') {
      State.state.happiness = Math.min(CONFIG.happinessMax, State.state.happiness + 5);
      State.updateHUD(State.state.currentDog?.name || 'Turbo', State.state.happiness);
      State.showDialogue('Refreshing! *gulps water*', 'Turbo');
    }
    if (type === 'fire_hydrant') {
      State.showDialogue('A good sniff. *sniff sniff*', 'Turbo');
    }
  });

  tpEngine.setOnNpcClick((npc: NPC) => {
    console.log('[Turbo] NPC clicked:', npc.name);
    if (npc.dialogue && npc.dialogue.length > 0) {
      // Check if this NPC is a companion
      const companionId = npc.id;
      const existing = State.state.companions.find(c => c.id === companionId);
      if (existing && !existing.active) {
        State.activateCompanion(companionId);
        State.showDialogue(npc.dialogue[0], npc.name);
      } else if (!existing) {
        State.meetCompanion({
          id: companionId,
          name: npc.name,
          breed: npc.name,
          trait: '🐾 New Friend',
          dialogue: npc.dialogue,
          met: true,
          active: false,
        });
        State.showDialogue(npc.dialogue[0], npc.name);
      } else {
        const line = npc.dialogue[Math.floor(Math.random() * npc.dialogue.length)];
        State.showDialogue(line, npc.name);
      }
    }
  });

  // Show HUD
  document.getElementById('hud')!.classList.remove('hidden');
}

// ---- Search View (Phase 1) ----
function startSearchView(zoneId: string, zoneData: Zone): void {
  console.log('[Turbo] Starting search view for zone:', zoneId);
  const canvasEl = document.getElementById('human-canvas');
  if (!canvasEl || !(canvasEl instanceof HTMLCanvasElement)) return;
  const canvas = canvasEl;

  canvas.style.display = 'block';

  // Dispose previous renderer
  if (searchRenderer) {
    searchRenderer.stop();
    searchRenderer.dispose();
  }

  // Initialize renderer
  searchRenderer = new SearchRenderer(canvas);

  // Default home location (can be overridden by zone data)
  const homeX = (zoneData as any).homeX || 0;
  const homeY = (zoneData as any).homeY || -15;
  searchRenderer.init(homeX, homeY);

  // Wire up home found callback
  searchRenderer.setOnHomeFound(() => {
    console.log('[Turbo] Home found in search view!');
    State.gameWin();
    State.showDialogue('Home. Sweet home. *happy tail wags*', 'Turbo');
    // Stop search render loop on win
    searchRenderer?.stop();
  });

  // Start render loop
  searchRenderer.start();

  // Show HUD
  document.getElementById('hud')!.classList.remove('hidden');
}

// ---- Zone Type Guard ----
function hasRooms(zone: Zone): zone is Zone & { rooms: Room[] } {
  return 'rooms' in zone && Array.isArray(zone.rooms);
}

// ---- Threat Overlay ----
function showThreatOverlay(threat: any): void {
  if (mangaRenderer) {
    (mangaRenderer as any).startCombat(threat.type, threat.solve || '', threat.sfx || '');
    document.getElementById('manga-canvas')?.classList.remove('hidden');
  }
  if (effectsRenderer) {
    effectsRenderer.triggerShake(0.4, 0.8);
  }
}

function hideThreatOverlay(): void {
  if (mangaRenderer) {
    mangaRenderer.stop();
    document.getElementById('manga-canvas')?.classList.add('hidden');
  }
}

// ---- Item Actions ----
function useItem(item: any): void {
  Audio.playSFX('item_use');
  State.useItem(item.id);
  if (effectsRenderer) {
    effectsRenderer.spawnParticles(
      window.innerWidth / 2,
      window.innerHeight / 2,
      10,
      'sparkle',
      '#88ff88'
    );
  }
}

function dropItem(item: any): void {
  Audio.playSFX('item_drop');
  // Note: dropItem not in State API — just log for now
  console.log('[Turbo] Dropped item:', item.id);
}

// ---- Restart / Menu ----
function restartGame(): void {
  localStorage.removeItem('turbo-save');
  resetGame();
}

function backToMenu(): void {
  resetGame();
}

// ---- Full Game Reset ----
function resetGame(): void {
  // Stop render loop
  stopRenderLoop();

  // Dispose all renderers
  fpRenderer?.dispose();
  fpRenderer = null;
  tpEngine?.dispose();
  tpEngine = null;
  searchRenderer?.stop();
  searchRenderer?.dispose();
  searchRenderer = null;
  transitionRenderer?.dispose();
  transitionRenderer = null;

  // Hide all canvases
  const canvasIds = [
    'fp-canvas', 'tp-canvas', 'human-canvas',
    'hud-canvas', 'dialogue-canvas', 'inventory-canvas',
    'companion-canvas', 'hint-canvas', 'manga-canvas',
    'effects-canvas', 'endgame-canvas',
  ];
  for (const id of canvasIds) {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  }

  // Hide HTML overlays
  const overlayIds = ['hud', 'zone-transition'];
  for (const id of overlayIds) {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  }

  // Reset state
  State.state = {
    selectedDog: null,
    currentDog: null,
    happiness: 80,
    currentZone: null,
    currentZoneIndex: 0,
    currentRoom: null,
    currentRoomIndex: 0,
    isHome: false,
    gamePhase: 'select',
    difficulty: 'normal',
    inventory: Array(CONFIG.inventorySlots).fill(null).map(() => ({ item: null, count: 0 })),
    companions: [],
    activeCompanion: null,
    hintsUnlocked: [],
    mapFragments: 0,
    routeProgress: 0,
    flags: {},
    threatActive: false,
    currentThreat: null,
    startTime: Date.now(),
    highScore: 0,
  };

  // Reset panels
  panelsOpen = { inventory: false, companion: false, hint: false };

  // Re-init overlays
  initOverlays();

  // Re-show dog select
  renderDogSelect();
  document.getElementById('dog-select')?.classList.remove('hidden');

  console.log('[Turbo] Game reset complete.');
}

// ---- Dog Portrait Drawing (procedural) ----
function drawDogPortrait(canvas: HTMLCanvasElement, dog: Dog): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;
  const cx = w / 2;
  const cy = h / 2;

  ctx.fillStyle = '#2a2a4a';
  ctx.fillRect(0, 0, w, h);

  const furColors = dog.colors.fur;
  ctx.fillStyle = furColors[0];

  ctx.beginPath();
  ctx.ellipse(cx, cy - 5, 30, 35, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = furColors[1];
  ctx.beginPath();
  ctx.ellipse(cx, cy + 15, 15, 12, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 12, 5, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.ellipse(cx - 12, cy - 12, 7, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx + 12, cy - 12, 7, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = furColors[2] || '#3a3a3a';
  ctx.beginPath();
  ctx.ellipse(cx - 11, cy - 11, 4, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx + 13, cy - 11, 4, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(cx - 9, cy - 14, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx + 15, cy - 14, 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = furColors[0];
  ctx.beginPath();
  ctx.ellipse(cx - 28, cy - 30, 10, 18, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx + 28, cy - 30, 10, 18, 0.3, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = furColors[1];
  ctx.beginPath();
  ctx.ellipse(cx - 28, cy - 28, 5, 10, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx + 28, cy - 28, 5, 10, 0.3, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = furColors[2] || '#3a3a3a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy + 18, 6, 0.1 * Math.PI, 0.9 * Math.PI);
  ctx.stroke();

  ctx.strokeStyle = dog.colors.accent;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(cx, cy - 5, 32, 37, 0, 0, Math.PI * 2);
  ctx.stroke();
}

// ---- Keyboard Handlers ----
function handleKeyDown(e: KeyboardEvent): void {
  // Panel toggles
  if (e.key === 'i' || e.key === 'I') {
    togglePanel('inventory');
    return;
  }
  if (e.key === 'c' || e.key === 'C') {
    togglePanel('companion');
    return;
  }
  if (e.key === 'h' || e.key === 'H') {
    togglePanel('hint');
    return;
  }

  // Space: dialogue advancement or threat input
  if (e.key === ' ' || e.key === 'Spacebar') {
    e.preventDefault();

    // Advance dialogue if typing or complete
    if (dialogueRenderer) {
      const ds = (dialogueRenderer as any).state;
      if (ds && ds.isVisible) {
        if (ds.isTyping) {
          dialogueRenderer.skip();
        } else {
          dialogueRenderer.advanceLine();
        }
        return;
      }
    }

    // Threat input
    if (threatManager && threatManager.getCurrentThreat()?.active) {
      threatManager.handleInput(' ');
      return;
    }

    // Fallback: combat hit
    if (threatManager && 'combatHit' in threatManager && typeof (threatManager as any).combatHit === 'function') {
      (threatManager as any).combatHit();
    }

    return;
  }

  // Escape: close panels
  if (e.key === 'Escape') {
    for (const panel of ['inventory', 'companion', 'hint'] as const) {
      if (panelsOpen[panel]) {
        togglePanel(panel);
      }
    }
    return;
  }

  // Route to active renderer
  if (activeZoneType === 'fp' && fpRenderer) {
    if ('handleKeyDown' in fpRenderer && typeof (fpRenderer as any).handleKeyDown === 'function') {
      (fpRenderer as any).handleKeyDown(e);
    }
  } else if (activeZoneType === 'tp' && tpEngine) {
    tpEngine.onKeyDown(e.key.toLowerCase());
  } else if (activeZoneType === 'search' && searchRenderer) {
    // Search view uses its own internal key handler, but we need to ensure
    // the canvas has focus for keyboard events to fire
    const humanCanvas = document.getElementById('human-canvas');
    if (humanCanvas instanceof HTMLCanvasElement) {
      humanCanvas.focus();
    }
  }
}

function handleKeyUp(e: KeyboardEvent): void {
  if (activeZoneType === 'fp' && fpRenderer) {
    if ('handleKeyUp' in fpRenderer && typeof (fpRenderer as any).handleKeyUp === 'function') {
      (fpRenderer as any).handleKeyUp(e);
    }
  } else if (activeZoneType === 'tp' && tpEngine) {
    tpEngine.onKeyUp(e.key.toLowerCase());
  }
}

// ---- Auto-save ----
setInterval(() => {
  State.save();
}, 30000);

// ---- Boot ----
window.addEventListener('DOMContentLoaded', init);
