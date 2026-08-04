/**
 * Threat System — Phase 2.4
 *
 * Manages threat encounters (traffic, cat, bully, storm, vacuum).
 * Each threat type has a unique mini-game resolution.
 *
 * Threat types:
 * - traffic: timing-based crossing
 * - cat: rhythm combat
 * - bully: rhythm intimidation
 * - storm: comfort/shelter
 * - vacuum: stealth/hide
 */

import { CONFIG } from '@/config';
import type { Threat, GameState } from '@/types';

// ---- Threat Types ----
type ThreatType = 'traffic' | 'cat' | 'bully' | 'storm' | 'vacuum';

interface ThreatState {
  type: ThreatType;
  active: boolean;
  phase: 'intro' | 'active' | 'resolved' | 'failed';
  timer: number;
  score: number;
  maxScore: number;
  data: any;
}

// ---- Traffic Mini-Game ----
interface TrafficState {
  cars: { x: number; speed: number; width: number; color: string }[];
  gapTimer: number;
  gapWindow: number;
  isGapOpen: boolean;
  playerReady: boolean;
}

// ---- Cat/Bully Combat Mini-Game ----
interface CombatState {
  rhythmBar: number;
  targetZone: { start: number; end: number };
  pulsePos: number;
  pulseDir: number;
  combo: number;
  maxCombo: number;
  hits: number;
  misses: number;
}

// ---- Storm Mini-Game ----
interface StormState {
  lightningFlash: number;
  thunderTimer: number;
  shelterProgress: number;
  isSeekingShelter: boolean;
}

// ---- Vacuum Mini-Game ----
interface VacuumState {
  vacuumX: number;
  vacuumSpeed: number;
  vacuumRange: number;
  hiding: boolean;
  hideTimer: number;
  safeZones: { x: number; w: number }[];
  detectionLevel: number;
}

// ---- Threat Manager ----
export class ThreatManager {
  private currentThreat: ThreatState | null = null;
  private traffic: TrafficState | null = null;
  private combat: CombatState | null = null;
  private storm: StormState | null = null;
  private vacuum: VacuumState | null = null;
  private animFrame: number | null = null;
  private lastTime: number;
  private onThreatStart: ((threat: Threat) => void) | null = null;
  private onThreatResolved: ((score: number) => void) | null = null;
  private onThreatFailed: ((reason: string) => void) | null = null;
  private onThreatUpdate: ((state: ThreatState) => void) | null = null;

  constructor() {
    this.lastTime = 0;
  }

  /** Start a threat encounter */
  startThreat(threat: Threat): void {
    this.currentThreat = {
      type: threat.type as ThreatType,
      active: true,
      phase: 'intro',
      timer: 0,
      score: 0,
      maxScore: 100,
      data: { ...threat },
    };

    // Initialize mini-game state
    switch (threat.type) {
      case 'traffic':
        this.traffic = this.initTraffic();
        break;
      case 'cat':
      case 'bully':
        this.combat = this.initCombat();
        break;
      case 'storm':
        this.storm = this.initStorm();
        break;
      case 'vacuum':
        this.vacuum = this.initVacuum();
        break;
    }

    this.lastTime = performance.now();
    this.onThreatStart?.(threat);

    // Start the loop
    const loop = (time: number) => {
      const delta = (time - this.lastTime) / 1000;
      this.lastTime = time;
      this.update(delta, time);
      this.animFrame = requestAnimationFrame(loop);
    };
    this.animFrame = requestAnimationFrame(loop);
  }

  /** Stop current threat */
  stop(): void {
    if (this.animFrame) {
      cancelAnimationFrame(this.animFrame);
      this.animFrame = null;
    }
    this.currentThreat = null;
    this.traffic = null;
    this.combat = null;
    this.storm = null;
    this.vacuum = null;
  }

  /** Update threat state */
  private update(delta: number, time: number): void {
    if (!this.currentThreat || !this.currentThreat.active) return;

    this.currentThreat.timer += delta;

    switch (this.currentThreat.type) {
      case 'traffic':
        this.updateTraffic(delta, time);
        break;
      case 'cat':
      case 'bully':
        this.updateCombat(delta, time);
        break;
      case 'storm':
        this.updateStorm(delta, time);
        break;
      case 'vacuum':
        this.updateVacuum(delta, time);
        break;
    }

    this.onThreatUpdate?.(this.currentThreat);
  }

  // ---- Traffic Mini-Game ----
  private initTraffic(): TrafficState {
    const cars = [];
    for (let i = 0; i < 5; i++) {
      cars.push({
        x: -10 + Math.random() * 20,
        speed: 2 + Math.random() * 3,
        width: 1.5 + Math.random(),
        color: ['#ff4444', '#4444ff', '#44ff44', '#ffff44'][Math.floor(Math.random() * 4)],
      });
    }
    return {
      cars,
      gapTimer: 3,
      gapWindow: 2,
      isGapOpen: false,
      playerReady: false,
    };
  }

  private updateTraffic(delta: number, time: number): void {
    if (!this.traffic || !this.currentThreat) return;

    // Update cars
    for (const car of this.traffic.cars) {
      car.x += car.speed * delta;
      if (car.x > 15) car.x = -10;
    }

    // Gap timer
    this.traffic.gapTimer -= delta;
    if (this.traffic.gapTimer <= 0) {
      this.traffic.isGapOpen = !this.traffic.isGapOpen;
      this.traffic.gapTimer = this.traffic.isGapOpen
        ? this.traffic.gapWindow
        : 3 + Math.random() * 2;
    }

    // Check collision
    if (!this.traffic.isGapOpen) {
      for (const car of this.traffic.cars) {
        const carLeft = car.x - car.width / 2;
        const carRight = car.x + car.width / 2;
        if (carLeft < 0 && carRight > 0) {
          this.failThreat('Hit by a car!');
          return;
        }
      }
    }

    // Win condition: survive for time
    if (this.currentThreat.timer > 10) {
      this.resolveThreat(80);
    }
  }

  // ---- Combat Mini-Game ----
  private initCombat(): CombatState {
    return {
      rhythmBar: 0,
      targetZone: { start: 0.3, end: 0.7 },
      pulsePos: 0,
      pulseDir: 1,
      combo: 0,
      maxCombo: 0,
      hits: 0,
      misses: 0,
    };
  }

  private updateCombat(delta: number, time: number): void {
    if (!this.combat || !this.currentThreat) return;

    // Move pulse
    this.combat.pulsePos += this.combat.pulseDir * 2 * delta;
    if (this.combat.pulsePos >= 1 || this.combat.pulsePos <= 0) {
      this.combat.pulseDir *= -1;
    }

    // Win condition
    if (this.combat.hits >= 5) {
      this.resolveThreat(70 + this.combat.maxCombo * 5);
    }

    // Fail condition
    if (this.currentThreat.timer > 15) {
      this.failThreat('Took too long!');
    }
  }

  /** Player presses SPACE during combat */
  combatHit(): boolean {
    if (!this.combat || !this.currentThreat) return false;
    if (this.currentThreat.phase !== 'active') return false;

    const pulseInZone =
      this.combat.pulsePos >= this.combat.targetZone.start &&
      this.combat.pulsePos <= this.combat.targetZone.end;

    if (pulseInZone) {
      this.combat.hits++;
      this.combat.combo++;
      this.combat.maxCombo = Math.max(this.combat.maxCombo, this.combat.combo);
      this.currentThreat.score += 10 + this.combat.combo * 5;
      return true;
    } else {
      this.combat.misses++;
      this.combat.combo = 0;
      return false;
    }
  }

  // ---- Storm Mini-Game ----
  private initStorm(): StormState {
    return {
      lightningFlash: 0,
      thunderTimer: 5,
      shelterProgress: 0,
      isSeekingShelter: true,
    };
  }

  private updateStorm(delta: number, time: number): void {
    if (!this.storm || !this.currentThreat) return;

    // Lightning flash
    this.storm.lightningFlash -= delta * 2;
    if (this.storm.lightningFlash <= 0) {
      this.storm.lightningFlash = 0;
      // Random lightning
      if (Math.random() < 0.01) {
        this.storm.lightningFlash = 1;
        this.storm.thunderTimer = 2;
      }
    }

    // Thunder timer
    this.storm.thunderTimer -= delta;
    if (this.storm.thunderTimer <= 0) {
      // Thunder hits
      if (this.storm.shelterProgress < 0.8) {
        this.failThreat('Caught in the thunder!');
        return;
      }
      this.storm.thunderTimer = 5 + Math.random() * 3;
      this.storm.isSeekingShelter = true;
    }

    // Win condition
    if (this.storm.shelterProgress >= 1) {
      this.resolveThreat(90);
    }
  }

  /** Player seeks shelter */
  seekShelter(): void {
    if (this.storm) {
      this.storm.shelterProgress = Math.min(1, this.storm.shelterProgress + 0.1);
    }
  }

  // ---- Vacuum Mini-Game ----
  private initVacuum(): VacuumState {
    return {
      vacuumX: -10,
      vacuumSpeed: 3,
      vacuumRange: 2,
      hiding: false,
      hideTimer: 0,
      safeZones: [
        { x: -5, w: 2 },
        { x: 3, w: 1.5 },
        { x: 8, w: 2.5 },
      ],
      detectionLevel: 0,
    };
  }

  private updateVacuum(delta: number, time: number): void {
    if (!this.vacuum || !this.currentThreat) return;

    // Move vacuum
    this.vacuum.vacuumX += this.vacuum.vacuumSpeed * delta;
    if (this.vacuum.vacuumX > 15) {
      this.vacuum.vacuumX = -10;
      this.vacuum.vacuumSpeed = 3 + Math.random() * 2;
    }

    // Check if player is in safe zone
    let inSafeZone = false;
    for (const zone of this.vacuum.safeZones) {
      if (Math.abs(0 - zone.x) < zone.w / 2) {
        inSafeZone = true;
        break;
      }
    }

    if (inSafeZone) {
      this.vacuum.detectionLevel = Math.max(0, this.vacuum.detectionLevel - delta * 2);
    } else {
      this.vacuum.detectionLevel = Math.min(1, this.vacuum.detectionLevel + delta * 0.5);
    }

    // Fail if detected too long
    if (this.vacuum.detectionLevel >= 1) {
      this.failThreat('The vacuum found you!');
      return;
    }

    // Win condition
    if (this.currentThreat.timer > 12) {
      this.resolveThreat(85);
    }
  }

  /** Player hides */
  hide(): void {
    if (this.vacuum) {
      this.vacuum.detectionLevel = Math.max(0, this.vacuum.detectionLevel - 0.3);
    }
  }

  // ---- Resolution ----
  private resolveThreat(score: number): void {
    if (!this.currentThreat) return;
    this.currentThreat.active = false;
    this.currentThreat.phase = 'resolved';
    this.currentThreat.score = score;
    this.onThreatResolved?.(score);
    this.stop();
  }

  private failThreat(reason: string): void {
    if (!this.currentThreat) return;
    this.currentThreat.active = false;
    this.currentThreat.phase = 'failed';
    this.onThreatFailed?.(reason);
    this.stop();
  }

  /** Handle player input during threat */
  handleInput(key: string): void {
    if (!this.currentThreat || !this.currentThreat.active) return;

    switch (key) {
      case ' ':
        if (this.currentThreat.type === 'traffic') {
          // Try to cross during gap
          if (this.traffic?.isGapOpen) {
            this.resolveThreat(90);
          } else {
            this.failThreat('Car hit you!');
          }
        } else if (this.currentThreat.type === 'cat' || this.currentThreat.type === 'bully') {
          this.combatHit();
        } else if (this.currentThreat.type === 'storm') {
          this.seekShelter();
        } else if (this.currentThreat.type === 'vacuum') {
          this.hide();
        }
        break;
      case 'h':
        if (this.currentThreat.type === 'vacuum') {
          this.hide();
        }
        break;
    }
  }

  // ---- Callbacks ----
  setOnThreatStart(fn: (threat: Threat) => void): void {
    this.onThreatStart = fn;
  }

  setOnThreatResolved(fn: (score: number) => void): void {
    this.onThreatResolved = fn;
  }

  setOnThreatFailed(fn: (reason: string) => void): void {
    this.onThreatFailed = fn;
  }

  setOnThreatUpdate(fn: (state: ThreatState) => void): void {
    this.onThreatUpdate = fn;
  }

  /** Get current threat state */
  getCurrentThreat(): ThreatState | null {
    return this.currentThreat;
  }

  /** Dispose */
  dispose(): void {
    this.stop();
  }
}
