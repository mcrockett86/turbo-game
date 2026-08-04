/**
 * Companion System — Phase 3.3
 *
 * Manages dog companions: meeting, managing, and active bonuses.
 * Companions follow the player, provide dialogue, and grant bonuses.
 */

import type { Companion } from '@/types';

// ---- Constants ----
const FOLLOW_DISTANCE = 1.5;
const FOLLOW_SPEED = 3;
const BONUS_TYPES = {
  happiness: { name: 'Happiness Boost', icon: '😊', value: 0.1 },
  speed: { name: 'Speed Boost', icon: '⚡', value: 0.2 },
  detection: { name: 'Scent Detection', icon: '👃', value: 0.15 },
  courage: { name: 'Courage', icon: '🦁', value: 0.1 },
};

// ---- Companion Manager ----
export class CompanionManager {
  private companions: Map<string, Companion> = new Map();
  private activeCompanion: string | null = null;
  private followOffset: { x: number; z: number };
  private lastUpdate: number;
  private onCompanionChange: ((companion: Companion | null) => void) | null = null;
  private onCompanionDialogue: ((dialogue: string) => void) | null = null;

  constructor() {
    this.followOffset = { x: FOLLOW_DISTANCE, z: 0 };
    this.lastUpdate = 0;
  }

  /** Meet a new companion */
  meetCompanion(companion: Companion): boolean {
    if (this.companions.has(companion.id)) {
      return false; // Already met
    }
    this.companions.set(companion.id, {
      ...companion,
      met: true,
      active: false,
      bonusActive: false,
    });

    // Auto-activate if no companion is active
    if (!this.activeCompanion) {
      this.activeCompanion = companion.id;
      this.onCompanionChange?.(this.companions.get(companion.id)!);
    }

    return true;
  }

  /** Activate a companion */
  activateCompanion(id: string): boolean {
    const companion = this.companions.get(id);
    if (!companion || !companion.met) return false;

    // Deactivate previous
    if (this.activeCompanion) {
      const prev = this.companions.get(this.activeCompanion);
      if (prev) {
        prev.active = false;
        prev.bonusActive = false;
      }
    }

    this.activeCompanion = id;
    companion.active = true;
    companion.bonusActive = true;

    this.onCompanionChange?.(companion);
    this.onCompanionDialogue?.(companion.dialogue[0]);
    return true;
  }

  /** Deactivate all companions */
  deactivateAll(): void {
    if (this.activeCompanion) {
      const companion = this.companions.get(this.activeCompanion);
      if (companion) {
        companion.active = false;
        companion.bonusActive = false;
      }
    }
    this.activeCompanion = null;
    this.onCompanionChange?.(null);
  }

  /** Get active companion */
  getActiveCompanion(): Companion | null {
    if (!this.activeCompanion) return null;
    return this.companions.get(this.activeCompanion) || null;
  }

  /** Get all met companions */
  getAllMet(): Companion[] {
    return Array.from(this.companions.values()).filter((c) => c.met);
  }

  /** Update companion position */
  updatePosition(playerX: number, playerZ: number, playerAngle: number): void {
    const companion = this.getActiveCompanion();
    if (!companion) return;

    // Calculate follow position behind player
    const angle = playerAngle + Math.PI; // Behind
    const targetX = playerX + Math.cos(angle) * FOLLOW_DISTANCE;
    const targetZ = playerZ + Math.sin(angle) * FOLLOW_DISTANCE;

    // Smooth follow
    const dx = targetX - (companion.position?.x ?? playerX);
    const dz = targetZ - (companion.position?.z ?? playerZ);
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist > 0.1) {
      const speed = Math.min(FOLLOW_SPEED, dist);
      companion.position = {
        x: (companion.position?.x ?? playerX) + (dx / dist) * speed,
        z: (companion.position?.z ?? playerZ) + (dz / dist) * speed,
      };
    }
  }

  /** Get companion bonus */
  getBonus(): Partial<Record<'happiness' | 'speed' | 'detection' | 'courage', number>> {
    const companion = this.getActiveCompanion();
    if (!companion || !companion.bonusActive) return {};

    const bonus = BONUS_TYPES[companion.bonusType as keyof typeof BONUS_TYPES];
    if (!bonus) return {};

    return { [bonus.name.toLowerCase().replace(' ', '') as keyof typeof BONUS_TYPES]: bonus.value };
  }

  /** Check if companion is nearby */
  isNearby(playerX: number, playerZ: number): boolean {
    const companion = this.getActiveCompanion();
    if (!companion?.position) return false;
    const dx = playerX - companion.position.x;
    const dz = playerZ - companion.position.z;
    return Math.sqrt(dx * dx + dz * dz) < 2;
  }

  // ---- Callbacks ----
  setOnCompanionChange(fn: (companion: Companion | null) => void): void {
    this.onCompanionChange = fn;
  }

  setOnCompanionDialogue(fn: (dialogue: string) => void): void {
    this.onCompanionDialogue = fn;
  }
}
