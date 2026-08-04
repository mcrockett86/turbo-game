// ===== Audio Manager =====
// Howler.js wrapper for music and SFX

import { CONFIG } from '@/config';

// ---- Music Tracks ----
const MUSIC_TRACKS: Record<string, string> = {
  suburban: 'assets/sounds/music/suburban.mp3',
  dog_park: 'assets/sounds/music/dog_park.mp3',
  apartment: 'assets/sounds/music/apartment.mp3',
  shelter: 'assets/sounds/music/shelter.mp3',
  home: 'assets/sounds/music/home.mp3',
  combat: 'assets/sounds/music/combat.mp3',
  quiet: 'assets/sounds/music/quiet.mp3',
};

// ---- Sound Effects ----
const SFX_SOURCES: Record<string, string> = {
  // Movement
  footsteps: 'assets/sounds/sfx/footsteps.mp3',
  bark: 'assets/sounds/sfx/bark.mp3',
  bark_small: 'assets/sounds/sfx/bark_small.mp3',
  bark_loud: 'assets/sounds/sfx/bark_loud.mp3',

  // Environment
  door_open: 'assets/sounds/sfx/door_open.mp3',
  door_close: 'assets/sounds/sfx/door_close.mp3',
  door_locked: 'assets/sounds/sfx/door_locked.mp3',
  transition_whoosh: 'assets/sounds/sfx/transition_whoosh.mp3',

  // Items
  item_pickup: 'assets/sounds/sfx/item_pickup.mp3',
  item_use: 'assets/sounds/sfx/item_use.mp3',
  item_combine: 'assets/sounds/sfx/item_combine.mp3',

  // Threats
  traffic_near: 'assets/sounds/sfx/traffic_near.mp3',
  cat_hiss: 'assets/sounds/sfx/cat_hiss.mp3',
  dog_growl: 'assets/sounds/sfx/dog_growl.mp3',
  thunder: 'assets/sounds/sfx/thunder.mp3',
  vacuum: 'assets/sounds/sfx/vacuum.mp3',
  impact: 'assets/sounds/sfx/impact.mp3',

  // UI
  click: 'assets/sounds/sfx/click.mp3',
  select: 'assets/sounds/sfx/select.mp3',
  success: 'assets/sounds/sfx/success.mp3',
  fail: 'assets/sounds/sfx/fail.mp3',

  // Manga cutaway
  manga_sting: 'assets/sounds/sfx/manga_sting.mp3',
  manga_hit: 'assets/sounds/sfx/manga_hit.mp3',
  manga_speed_line: 'assets/sounds/sfx/manga_speed_line.mp3',

  // Victory / defeat
  victory: 'assets/sounds/sfx/victory.mp3',
  defeat: 'assets/sounds/sfx/defeat.mp3',
  found_home: 'assets/sounds/sfx/found_home.mp3',
};

// ---- State ----
let musicPlayer: Howl | null = null;
let currentMusic: string | null = null;
let masterVolume = CONFIG.masterVolume;
let musicVolume = CONFIG.musicVolume;
let sfxVolume = CONFIG.sfxVolume;
let muted = false;

// ---- Music ----
function playMusic(zoneId: string): void {
  const track = MUSIC_TRACKS[zoneId] || MUSIC_TRACKS.quiet;
  if (currentMusic === track) return;

  // Stop current
  if (musicPlayer) {
    musicPlayer.fade(musicVolume, 0, 1000);
    setTimeout(() => musicPlayer?.unload(), 1100);
  }

  // Start new
  musicPlayer = new Howl({
    src: [track],
    loop: true,
    volume: musicVolume,
    onload: () => {
      musicPlayer?.play();
    },
    onend: () => {
      // Restart loop
      musicPlayer?.play();
    },
  });

  currentMusic = track;
}

function stopMusic(): void {
  if (musicPlayer) {
    musicPlayer.fade(musicVolume, 0, 500);
    setTimeout(() => {
      musicPlayer?.stop();
      musicPlayer?.unload();
      musicPlayer = null;
    }, 600);
    currentMusic = null;
  }
}

function setMusicVolume(vol: number): void {
  musicVolume = Math.max(0, Math.min(1, vol));
  if (musicPlayer && !muted) {
    musicPlayer.volume(musicVolume);
  }
}

// ---- SFX ----
function playSFX(sfxId: string, pitch: number = 1): void {
  if (muted) return;

  const src = SFX_SOURCES[sfxId];
  if (!src) {
    console.warn(`[Audio] Unknown SFX: ${sfxId}`);
    return;
  }

  const sound = new Howl({
    src: [src],
    volume: sfxVolume,
    rate: pitch,
    onloaderror: () => {
      // Fallback: generate tone with Web Audio API
      playFallbackSFX(sfxId);
    },
  });

  sound.play();
}

// ---- Web Audio Fallback (no external files) ----
function playFallbackSFX(sfxId: string): void {
  if (muted) return;
  const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);

  const now = ctx.currentTime;

  switch (sfxId) {
    case 'bark':
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.exponentialRampToValueAtTime(150, now + 0.15);
      gain.gain.setValueAtTime(0.3 * sfxVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.2);
      break;
    case 'bark_small':
      osc.type = 'square';
      osc.frequency.setValueAtTime(500, now);
      osc.frequency.exponentialRampToValueAtTime(300, now + 0.08);
      gain.gain.setValueAtTime(0.2 * sfxVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
      osc.start(now);
      osc.stop(now + 0.1);
      break;
    case 'bark_loud':
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(200, now);
      osc.frequency.exponentialRampToValueAtTime(80, now + 0.3);
      gain.gain.setValueAtTime(0.4 * sfxVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
      osc.start(now);
      osc.stop(now + 0.35);
      break;
    case 'item_pickup':
      osc.type = 'sine';
      osc.frequency.setValueAtTime(400, now);
      osc.frequency.exponentialRampToValueAtTime(800, now + 0.15);
      gain.gain.setValueAtTime(0.2 * sfxVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.2);
      break;
    case 'success':
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523, now);
      gain.gain.setValueAtTime(0.2 * sfxVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(659, now + 0.15);
      gain2.gain.setValueAtTime(0.2 * sfxVolume, now + 0.15);
      gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.45);
      osc2.start(now + 0.15);
      osc2.stop(now + 0.45);
      break;
    case 'fail':
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.exponentialRampToValueAtTime(100, now + 0.3);
      gain.gain.setValueAtTime(0.2 * sfxVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
      osc.start(now);
      osc.stop(now + 0.35);
      break;
    case 'thunder':
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(60, now);
      osc.frequency.exponentialRampToValueAtTime(30, now + 0.5);
      gain.gain.setValueAtTime(0.5 * sfxVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);
      osc.start(now);
      osc.stop(now + 0.6);
      break;
    case 'manga_sting':
      osc.type = 'square';
      osc.frequency.setValueAtTime(880, now);
      gain.gain.setValueAtTime(0.3 * sfxVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
      osc.start(now);
      osc.stop(now + 0.15);
      break;
    case 'manga_hit':
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(100, now);
      gain.gain.setValueAtTime(0.4 * sfxVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
      osc.start(now);
      osc.stop(now + 0.1);
      break;
    default:
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      gain.gain.setValueAtTime(0.1 * sfxVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
      osc.start(now);
      osc.stop(now + 0.1);
  }
}

// ---- Mute ----
function toggleMute(): boolean {
  muted = !muted;
  if (muted) {
    if (musicPlayer) musicPlayer.volume(0);
  } else {
    if (musicPlayer) musicPlayer.volume(musicVolume);
  }
  return muted;
}

function setMasterVolume(vol: number): void {
  masterVolume = Math.max(0, Math.min(1, vol));
  if (musicPlayer && !muted) musicPlayer.volume(musicVolume * masterVolume);
}

// ---- Public API ----
export const Audio = {
  playMusic,
  stopMusic,
  setMusicVolume,

  playSFX,

  toggleMute,
  setMasterVolume,

  get muted() { return muted; },
  get masterVolume() { return masterVolume; },
  get musicVolume() { return musicVolume; },
  get sfxVolume() { return sfxVolume; },
};

// ---- Web Audio Context Resume ----
// Browsers require user gesture to start AudioContext
document.addEventListener('click', () => {
  const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
}, { once: true });
