// ===== Turbo: Lost & Found — Main Entry Point =====
// Bootstraps the game engine, loads data, initializes systems

import { DOGS, ZONES, ITEMS, THREATS } from './data';
import { State } from '@/engine/state';
import { Audio } from '@/engine/audio';
import { CONFIG } from '@/config';
import { FpRoomRenderer } from '@/engine/render/fp-renderer';
import type { GameState, GameEvent, Dog, Zone, Room, RoomFeature } from '@/types';

// ---- Game Engine (loaded as we build) ----
let engine: any = null;

// ---- FP Renderer Instance ----
let fpRenderer: FpRoomRenderer | null = null;

// ---- Initialization ----
function init(): void {
  console.log('[Turbo] Initializing...');

  // Load or create state
  const saved = State.load();
  if (saved && saved.currentDog) {
    State.state = { ...State.state, ...saved };
    console.log('[Turbo] Loaded save from', new Date(saved.startTime).toLocaleString());
  }

  // Setup event listeners for UI updates
  setupUI();

  // Render dog selection screen
  renderDogSelect();

  // Show initial HUD
  State.updateHUD('Turbo', State.state.happiness);
  document.getElementById('hud')!.classList.remove('hidden');

  console.log('[Turbo] Ready!');
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
}

function togglePanel(name: string): void {
  const panel = document.getElementById(`${name}-panel`);
  if (!panel) return;
  const isOpen = !panel.classList.contains('hidden');
  panel.classList.toggle('hidden');
  State.togglePanel(name, !isOpen);
}

// ---- Dog Selection ----
function renderDogSelect(): void {
  const grid = document.getElementById('dog-grid');
  if (!grid) return;

  grid.innerHTML = '';

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

  // Auto-start after 3 seconds
  setTimeout(() => {
    startAdventure(dogId, dog);
  }, 3000);
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
        // Transition to next zone
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

  // Check if this is a zone entrance
  const currentZoneId = State.state.currentZone;
  if (!currentZoneId) return;
  const currentZone = ZONES[currentZoneId as keyof typeof ZONES];
  if (!currentZone || !('rooms' in currentZone) || !currentZone.rooms) return;

  const room = currentZone.rooms.find((r: Room) => r.id === State.state.currentRoom);
  if (!room) return;

  // Check if exit leads to a new zone
  if (room.isEntrance && room.entranceZone) {
    transitionToZone(room.entranceZone);
    return;
  }

  // Find the target room index
  const targetRoomIndex = currentZone.rooms.findIndex((r: Room) => r.id === exitRoomId);
  if (targetRoomIndex < 0) return;

  // Transition to new room
  State.enterRoom(exitRoomId, targetRoomIndex);
  fpRenderer?.moveTo(0, 0); // Reset to center

  // Show room name
  const targetRoom = currentZone.rooms[targetRoomIndex];
  State.showDialogue('You enter: ' + targetRoom.name, 'Turbo');
}

// ---- Zone Transition ----
function transitionToZone(zoneId: string): void {
  const zoneData = ZONES[zoneId as keyof typeof ZONES];
  if (!zoneData) return;

  const zoneWithRooms = zoneData as Zone & { rooms: Room[] };
  if (!zoneWithRooms.rooms || zoneWithRooms.rooms.length === 0) return;

  // Dispose current renderer
  fpRenderer?.dispose();
  fpRenderer = null;

  // Start transition
  State.startTransition(zoneWithRooms.name, zoneWithRooms.desc);
  Audio.playMusic(zoneId);
  showZoneTransition(zoneWithRooms.name, zoneWithRooms.desc);

  // Enter new zone
  setTimeout(() => {
    State.enterZone(zoneId, zoneWithRooms);
    State.endTransition();

    // Start FP view if zone has rooms
    if (zoneWithRooms.type === 'fp' && zoneWithRooms.rooms.length > 0) {
      startFPView();
    }
  }, 2500);
}

// ---- Zone Type Guard ----
function hasRooms(zone: Zone): zone is Zone & { rooms: Room[] } {
  return 'rooms' in zone && Array.isArray(zone.rooms);
}

// ---- Dog Portrait Drawing (procedural) ----
function drawDogPortrait(canvas: HTMLCanvasElement, dog: Dog): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;
  const cx = w / 2;
  const cy = h / 2;

  // Background
  ctx.fillStyle = '#2a2a4a';
  ctx.fillRect(0, 0, w, h);

  // Dog head shape
  const furColors = dog.colors.fur;
  ctx.fillStyle = furColors[0];

  // Head (ellipse)
  ctx.beginPath();
  ctx.ellipse(cx, cy - 5, 30, 35, 0, 0, Math.PI * 2);
  ctx.fill();

  // Snout
  ctx.fillStyle = furColors[1];
  ctx.beginPath();
  ctx.ellipse(cx, cy + 15, 15, 12, 0, 0, Math.PI * 2);
  ctx.fill();

  // Nose
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 12, 5, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // Eyes
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.ellipse(cx - 12, cy - 12, 7, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx + 12, cy - 12, 7, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  // Pupils
  ctx.fillStyle = furColors[2] || '#3a3a3a';
  ctx.beginPath();
  ctx.ellipse(cx - 11, cy - 11, 4, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx + 13, cy - 11, 4, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Eye shine
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(cx - 9, cy - 14, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx + 15, cy - 14, 2, 0, Math.PI * 2);
  ctx.fill();

  // Ears
  ctx.fillStyle = furColors[0];
  ctx.beginPath();
  ctx.ellipse(cx - 28, cy - 30, 10, 18, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx + 28, cy - 30, 10, 18, 0.3, 0, Math.PI * 2);
  ctx.fill();

  // Inner ears
  ctx.fillStyle = furColors[1];
  ctx.beginPath();
  ctx.ellipse(cx - 28, cy - 28, 5, 10, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx + 28, cy - 28, 5, 10, 0.3, 0, Math.PI * 2);
  ctx.fill();

  // Mouth (happy curve)
  ctx.strokeStyle = furColors[2] || '#3a3a3a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy + 18, 6, 0.1 * Math.PI, 0.9 * Math.PI);
  ctx.stroke();

  // Accent color border
  ctx.strokeStyle = dog.colors.accent;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(cx, cy - 5, 32, 37, 0, 0, Math.PI * 2);
  ctx.stroke();
}

// ---- Keyboard Handlers ----
function handleKeyDown(e: KeyboardEvent): void {
  if (!engine) return;

  switch (e.key) {
    case 'i':
    case 'I':
      togglePanel('inventory');
      break;
    case 'c':
    case 'C':
      togglePanel('companion');
      break;
    case 'h':
    case 'H':
      togglePanel('hint');
      break;
    case 'Escape':
      // Close any open panels
      document.querySelectorAll('.hidden').forEach(p => {});
      break;
  }

  if (engine?.handleKeyDown) {
    engine.handleKeyDown(e);
  }
}

function handleKeyUp(e: KeyboardEvent): void {
  if (engine?.handleKeyUp) {
    engine.handleKeyUp(e);
  }
}

// ---- Auto-save ----
setInterval(() => {
  State.save();
}, 30000); // Save every 30 seconds

// ---- Boot ----
window.addEventListener('DOMContentLoaded', init);
