// ===== Audio Manager =====
// Howler.js wrapper for music and SFX

import { Howl } from 'howler';
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
let crossfadePlayer: Howl | null = null; // temporary for crossfade
let currentMusic: string | null = null;
let masterVolume = CONFIG.masterVolume;
let musicVolume = CONFIG.musicVolume;
let sfxVolume = CONFIG.sfxVolume;
let muted = false;
const CROSSFADE_DURATION = 2000; // ms

// ---- Procedural Music Fallback ----
let musicFallback: {
  ctx: AudioContext | null;
  oscillators: OscillatorNode[];
  gains: GainNode[];
  running: boolean;
} = { ctx: null, oscillators: [], gains: [], running: false };

function startProceduralMusic(zoneId: string): void {
  if (musicFallback.running) stopProceduralMusic();

  const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  musicFallback.ctx = ctx;
  musicFallback.oscillators = [];
  musicFallback.gains = [];

  // Create ambient drone based on zone mood
  const configs: Record<string, { freqs: number[]; type: OscillatorType; vol: number }> = {
    suburban: { freqs: [110, 165, 220], type: 'sine', vol: 0.06 },
    dog_park: { freqs: [220, 330, 440], type: 'sine', vol: 0.08 },
    apartment: { freqs: [90, 135, 180], type: 'triangle', vol: 0.05 },
    shelter: { freqs: [80, 120, 160], type: 'sine', vol: 0.04 },
    home: { freqs: [260, 392, 523], type: 'sine', vol: 0.07 },
    combat: { freqs: [70, 105, 140], type: 'sawtooth', vol: 0.06 },
    quiet: { freqs: [60, 90, 120], type: 'sine', vol: 0.03 },
  };

  const cfg = configs[zoneId] || configs.quiet;

  for (const freq of cfg.freqs) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = cfg.type;
    osc.frequency.value = freq;
    gain.gain.value = cfg.vol * musicVolume;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    musicFallback.oscillators.push(osc);
    musicFallback.gains.push(gain);
  }

  musicFallback.running = true;
}

function stopProceduralMusic(): void {
  if (!musicFallback.running || !musicFallback.ctx) return;
  for (const osc of musicFallback.oscillators) {
    try { osc.stop(); } catch {}
  }
  for (const gain of musicFallback.gains) {
    try { gain.disconnect(); } catch {}
  }
  try { musicFallback.ctx.close(); } catch {}
  musicFallback = { ctx: null, oscillators: [], gains: [], running: false };
}

// ---- Music with Crossfade ----
function playMusic(zoneId: string): void {
  const track = MUSIC_TRACKS[zoneId] || MUSIC_TRACKS.quiet;
  if (currentMusic === track) return;

  // If we have procedural music running, stop it first
  if (musicFallback.running) {
    stopProceduralMusic();
  }

  if (musicPlayer) {
    // Crossfade: fade out old while new fades in
    const oldPlayer = musicPlayer;
    const oldVolume = musicVolume;

    // Start new track
    musicPlayer = new Howl({
      src: [track],
      loop: true,
      volume: 0,
      onload: () => {
        musicPlayer?.play();
        // Crossfade over duration
        musicPlayer?.fade(0, oldVolume, CROSSFADE_DURATION);
        // Fade out old track
        oldPlayer.fade(oldVolume, 0, CROSSFADE_DURATION);
        setTimeout(() => {
          oldPlayer.stop();
          oldPlayer.unload();
        }, CROSSFADE_DURATION + 100);
      },
      onloaderror: () => {
        // Fallback: procedural music
        startProceduralMusic(zoneId);
      },
      onend: () => {
        musicPlayer?.play();
      },
    });
    currentMusic = track;
    return;
  }

  // No current music — just start
  musicPlayer = new Howl({
    src: [track],
    loop: true,
    volume: musicVolume,
    onload: () => {
      musicPlayer?.play();
    },
    onloaderror: () => {
      // Fallback: procedural music
      startProceduralMusic(zoneId);
    },
    onend: () => {
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
  // Also stop procedural music if running
  if (musicFallback.running) {
    stopProceduralMusic();
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
    onplayerror: () => {
      // Fallback: generate tone with Web Audio API
      playFallbackSFX(sfxId);
    },
  });

  sound.play();
}

// ---- Web Audio Fallback (no external files) ----
let sfxAudioContext: AudioContext | null = null;

function getSfxAudioContext(): AudioContext {
  if (!sfxAudioContext || sfxAudioContext.state === 'closed') {
    sfxAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (sfxAudioContext.state === 'suspended') {
    sfxAudioContext.resume();
  }
  return sfxAudioContext;
}

function playFallbackSFX(sfxId: string): void {
  if (muted) return;
  const ctx = getSfxAudioContext();
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
    case 'footsteps':
      // Soft padding steps (noise bursts)
      for (let i = 0; i < 3; i++) {
        const noise = ctx.createBufferSource();
        const buf = ctx.createBuffer(1, ctx.sampleRate * 0.05, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let j = 0; j < data.length; j++) data[j] = (Math.random() * 2 - 1) * 0.15;
        noise.buffer = buf;
        const ng = ctx.createGain();
        noise.connect(ng);
        ng.connect(ctx.destination);
        const t = now + i * 0.1;
        ng.gain.setValueAtTime(0.15 * sfxVolume, t);
        ng.gain.exponentialRampToValueAtTime(0.01, t + 0.08);
        noise.start(t);
        noise.stop(t + 0.08);
      }
      break;
    case 'door_open':
      osc.type = 'sine';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.linearRampToValueAtTime(300, now + 0.3);
      gain.gain.setValueAtTime(0.25 * sfxVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
      osc.start(now);
      osc.stop(now + 0.35);
      break;
    case 'door_close':
      osc.type = 'sine';
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.linearRampToValueAtTime(100, now + 0.15);
      gain.gain.setValueAtTime(0.2 * sfxVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.2);
      break;
    case 'door_locked':
      // Metallic click
      const osc2a = ctx.createOscillator();
      const gain2a = ctx.createGain();
      osc2a.connect(gain2a);
      gain2a.connect(ctx.destination);
      osc2a.type = 'square';
      osc2a.frequency.setValueAtTime(800, now);
      gain2a.gain.setValueAtTime(0.15 * sfxVolume, now);
      gain2a.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
      osc2a.start(now);
      osc2a.stop(now + 0.05);
      break;
    case 'transition_whoosh':
      // Noise sweep
      const noiseSrc = ctx.createBufferSource();
      const noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.6, ctx.sampleRate);
      const noiseData = noiseBuf.getChannelData(0);
      for (let i = 0; i < noiseData.length; i++) noiseData[i] = (Math.random() * 2 - 1);
      noiseSrc.buffer = noiseBuf;
      const noiseGain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(200, now);
      filter.frequency.linearRampToValueAtTime(2000, now + 0.3);
      filter.frequency.linearRampToValueAtTime(400, now + 0.6);
      filter.Q.value = 2;
      noiseGain.gain.setValueAtTime(0.3 * sfxVolume, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);
      noiseSrc.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(ctx.destination);
      noiseSrc.start(now);
      noiseSrc.stop(now + 0.6);
      break;
    case 'item_use':
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(1200, now + 0.08);
      osc.frequency.exponentialRampToValueAtTime(600, now + 0.15);
      gain.gain.setValueAtTime(0.2 * sfxVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.2);
      break;
    case 'item_combine':
      // Two-tone chime
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523, now);
      gain.gain.setValueAtTime(0.15 * sfxVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
      osc.start(now);
      osc.stop(now + 0.15);
      const osc3 = ctx.createOscillator();
      const gain3 = ctx.createGain();
      osc3.connect(gain3);
      gain3.connect(ctx.destination);
      osc3.type = 'sine';
      osc3.frequency.setValueAtTime(784, now + 0.12);
      gain3.gain.setValueAtTime(0.15 * sfxVolume, now + 0.12);
      gain3.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
      osc3.start(now + 0.12);
      osc3.stop(now + 0.35);
      break;
    case 'traffic_near':
      // Low rumble
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(80, now);
      osc.frequency.linearRampToValueAtTime(120, now + 0.5);
      osc.frequency.linearRampToValueAtTime(60, now + 0.8);
      gain.gain.setValueAtTime(0.15 * sfxVolume, now);
      gain.gain.linearRampToValueAtTime(0.3 * sfxVolume, now + 0.3);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.8);
      osc.start(now);
      osc.stop(now + 0.8);
      break;
    case 'cat_hiss':
      // Noise burst
      const hissSrc = ctx.createBufferSource();
      const hissBuf = ctx.createBuffer(1, ctx.sampleRate * 0.4, ctx.sampleRate);
      const hissData = hissBuf.getChannelData(0);
      for (let i = 0; i < hissData.length; i++) hissData[i] = (Math.random() * 2 - 1) * 0.5;
      hissSrc.buffer = hissBuf;
      const hissGain = ctx.createGain();
      const hissFilter = ctx.createBiquadFilter();
      hissFilter.type = 'highpass';
      hissFilter.frequency.value = 3000;
      hissGain.gain.setValueAtTime(0.3 * sfxVolume, now);
      hissGain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
      hissSrc.connect(hissFilter);
      hissFilter.connect(hissGain);
      hissGain.connect(ctx.destination);
      hissSrc.start(now);
      hissSrc.stop(now + 0.4);
      break;
    case 'dog_growl':
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(100, now);
      osc.frequency.linearRampToValueAtTime(70, now + 0.6);
      // Add vibrato
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.value = 8;
      lfoGain.gain.value = 15;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      gain.gain.setValueAtTime(0.25 * sfxVolume, now);
      gain.gain.setValueAtTime(0.25 * sfxVolume, now + 0.3);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.7);
      lfo.start(now);
      lfo.stop(now + 0.7);
      osc.start(now);
      osc.stop(now + 0.7);
      break;
    case 'vacuum':
      // Low drone with modulation
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(90, now);
      gain.gain.setValueAtTime(0.2 * sfxVolume, now);
      const vacLfo = ctx.createOscillator();
      const vacLfoGain = ctx.createGain();
      vacLfo.frequency.value = 3;
      vacLfoGain.gain.value = 20;
      vacLfo.connect(vacLfoGain);
      vacLfoGain.connect(osc.frequency);
      gain.gain.setValueAtTime(0.2 * sfxVolume, now);
      gain.gain.linearRampToValueAtTime(0.3 * sfxVolume, now + 1);
      gain.gain.linearRampToValueAtTime(0.2 * sfxVolume, now + 2);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 2.5);
      vacLfo.start(now);
      vacLfo.stop(now + 2.5);
      osc.start(now);
      osc.stop(now + 2.5);
      break;
    case 'impact':
      // Low thud
      osc.type = 'sine';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.1);
      gain.gain.setValueAtTime(0.4 * sfxVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
      osc.start(now);
      osc.stop(now + 0.15);
      break;
    case 'click':
      osc.type = 'square';
      osc.frequency.setValueAtTime(1000, now);
      gain.gain.setValueAtTime(0.08 * sfxVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.03);
      osc.start(now);
      osc.stop(now + 0.03);
      break;
    case 'select':
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);
      gain.gain.setValueAtTime(0.12 * sfxVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
      osc.start(now);
      osc.stop(now + 0.08);
      break;
    case 'manga_speed_line':
      // Rising sweep
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(200, now);
      osc.frequency.exponentialRampToValueAtTime(2000, now + 0.2);
      gain.gain.setValueAtTime(0.15 * sfxVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
      osc.start(now);
      osc.stop(now + 0.25);
      break;
    case 'victory':
      // Ascending arpeggio
      [523, 659, 784, 1047].forEach((freq, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g);
        g.connect(ctx.destination);
        o.type = 'sine';
        o.frequency.value = freq;
        const t = now + i * 0.12;
        g.gain.setValueAtTime(0.15 * sfxVolume, t);
        g.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
        o.start(t);
        o.stop(t + 0.2);
      });
      break;
    case 'defeat':
      // Descending tone
      osc.type = 'sine';
      osc.frequency.setValueAtTime(400, now);
      osc.frequency.linearRampToValueAtTime(150, now + 0.5);
      gain.gain.setValueAtTime(0.2 * sfxVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);
      osc.start(now);
      osc.stop(now + 0.6);
      break;
    case 'found_home':
      // Happy ascending melody
      [523, 659, 784, 1047, 784, 1047].forEach((freq, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g);
        g.connect(ctx.destination);
        o.type = 'sine';
        o.frequency.value = freq;
        const t = now + i * 0.1;
        g.gain.setValueAtTime(0.12 * sfxVolume, t);
        g.gain.exponentialRampToValueAtTime(0.01, t + 0.12);
        o.start(t);
        o.stop(t + 0.12);
      });
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
