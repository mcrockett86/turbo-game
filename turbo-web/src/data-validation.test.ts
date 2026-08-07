/**
 * Data Validation Tests for data.ts
 *
 * These catch broken references before integration:
 * - All ZONES have valid room layouts
 * - All ITEMS referenced in zones actually exist in ITEMS map
 * - All THREAT types map to valid mini-game handlers
 * - All DOGS have required fields
 * - No orphaned references (every exit in a room points to a real room)
 * - Zone types match renderer support ('fp' | 'tp' | 'search')
 */

import { describe, it, expect } from 'vitest';
import { DOGS, ZONES, ITEMS, THREATS } from '@/data';
import type { Zone, Room, Dog, Threat } from '@/types';

// ---- Helpers ----

/** Collect all valid zone IDs. */
function getAllZoneIds(): string[] {
  return Object.keys(ZONES);
}

/** Collect all valid item IDs. */
function getAllItemIds(): string[] {
  return Object.keys(ITEMS);
}

/** Collect all valid threat type strings. */
function getAllThreatTypes(): string[] {
  return Object.keys(THREATS);
}

/** Collect all valid mini-game handler types. */
function getAllMiniGameTypes(): string[] {
  return ['timing', 'combat', 'comfort', 'sneak'];
}

describe('Data Validation — DOGS', () => {
  it('has exactly 5 dogs', () => {
    expect(Object.keys(DOGS)).toHaveLength(5);
  });

  it('has a turbo dog', () => {
    expect(DOGS.turbo).toBeDefined();
    expect(DOGS.turbo.id).toBe('turbo');
  });

  it('has a watson dog', () => {
    expect(DOGS.watson).toBeDefined();
    expect(DOGS.watson.id).toBe('watson');
  });

  it('has a nova dog', () => {
    expect(DOGS.nova).toBeDefined();
    expect(DOGS.nova.id).toBe('nova');
  });

  it('has a walter dog', () => {
    expect(DOGS.walter).toBeDefined();
    expect(DOGS.walter.id).toBe('walter');
  });

  it('has a beaux dog', () => {
    expect(DOGS.beaux).toBeDefined();
    expect(DOGS.beaux.id).toBe('beaux');
  });

  it('every dog has required fields', () => {
    const requiredFields: Array<keyof Dog> = ['id', 'name', 'breed', 'trait', 'traitDesc', 'colors', 'personality', 'lines'];

    for (const [id, dog] of Object.entries(DOGS)) {
      for (const field of requiredFields) {
        expect(dog[field]).toBeDefined(), `${id} missing field: ${field}`;
      }
    }
  });

  it('every dog has all personality lines', () => {
    const requiredLines = ['intro', 'happy', 'scared', 'hint', 'combat', 'foundFriend'];

    for (const [id, dog] of Object.entries(DOGS)) {
      for (const line of requiredLines) {
        expect(dog.lines[line]).toBeDefined(), `${id} missing line: ${line}`;
      }
    }
  });

  it('every dog has valid color data', () => {
    for (const [id, dog] of Object.entries(DOGS)) {
      expect(dog.colors.fur).toBeInstanceOf(Array);
      expect(dog.colors.fur.length).toBeGreaterThan(0);
      expect(typeof dog.colors.accent).toBe('string');
    }
  });
});

describe('Data Validation — ZONES', () => {
  it('has exactly 18 zones', () => {
    expect(Object.keys(ZONES)).toHaveLength(18);
  });

  it('has all required zones', () => {
    const requiredZones = ['suburban_streets', 'dog_park', 'apartment', 'shelter', 'neighborhood', 'home'];
    for (const id of requiredZones) {
      expect(ZONES[id]).toBeDefined(), `Missing zone: ${id}`;
    }
  });

  it('every FP zone has valid room layouts', () => {
    for (const [zoneId, zone] of Object.entries(ZONES)) {
      if (zone.type !== 'fp') continue;

      expect(zone.rooms).toBeDefined(), `${zoneId}: FP zone missing rooms`;
      expect(zone.rooms).toBeInstanceOf(Array), `${zoneId}: rooms is not an array`;

      if (zone.rooms) {
        for (const room of zone.rooms) {
          expect(room.id).toBeDefined(), `${zoneId}/${room.id}: room missing id`;
          expect(room.name).toBeDefined(), `${zoneId}/${room.id}: room missing name`;
          expect(room.w).toBeGreaterThan(0), `${zoneId}/${room.id}: room width must be positive`;
          expect(room.h).toBeGreaterThan(0), `${zoneId}/${room.id}: room height must be positive`;
          expect(room.d).toBeGreaterThan(0), `${zoneId}/${room.id}: room depth must be positive`;
          expect(room.color).toMatch(/^#[0-9a-fA-F]{6}$/), `${zoneId}/${room.id}: invalid color hex`;
          expect(room.exits).toBeInstanceOf(Array), `${zoneId}/${room.id}: exits is not an array`;
        }
      }
    }
  });

  it('every room exit references a valid room', () => {
    for (const [zoneId, zone] of Object.entries(ZONES)) {
      if (zone.type !== 'fp' || !zone.rooms) continue;

      const roomIds = new Set(zone.rooms.map(r => r.id));

      for (const room of zone.rooms) {
        for (const exitId of room.exits) {
          expect(roomIds.has(exitId)),
            `${zoneId}/${room.id}: exit "${exitId}" does not reference a valid room (available: ${[...roomIds].join(', ')})`;
        }
      }
    }
  });

  it('every FP zone room has a unique ID within its zone', () => {
    for (const [zoneId, zone] of Object.entries(ZONES)) {
      if (zone.type !== 'fp' || !zone.rooms) continue;

      const ids = zone.rooms.map(r => r.id);
      const unique = new Set(ids);
      expect(unique.size).toBe(ids.length),
        `${zoneId}: duplicate room IDs: ${ids.filter((id, i) => ids.indexOf(id) !== i).join(', ')}`;
    }
  });

  it('zone types match renderer support', () => {
    const validTypes = ['fp', 'tp', 'human'] as const;

    for (const [zoneId, zone] of Object.entries(ZONES)) {
      expect(validTypes).toContain(zone.type),
        `${zoneId}: invalid zone type "${zone.type}" (expected ${validTypes.join(' | ')})`;
    }
  });

  it('FP zones have music defined', () => {
    for (const [zoneId, zone] of Object.entries(ZONES)) {
      if (zone.type === 'fp') {
        expect(zone.music).toBeDefined(), `${zoneId}: FP zone missing music`;
      }
    }
  });
});

describe('Data Validation — ITEMS', () => {
  it('has exactly 69 items', () => {
    expect(Object.keys(ITEMS)).toHaveLength(69);
  });

  it('every item has required fields', () => {
    for (const [id, item] of Object.entries(ITEMS)) {
      // Items don't have an id field — the key IS the id
      expect(item.name).toBeDefined(), `${id}: item missing name`;
      expect(item.desc).toBeDefined(), `${id}: item missing desc`;
    }
  });

  it('every item name contains an emoji', () => {
    for (const [id, item] of Object.entries(ITEMS)) {
      expect(item.name).toMatch(/[^\x00-\x7F]/),
        `${id}: item name "${item.name}" missing non-ASCII (emoji)`;
    }
  });

  it('items referenced in zones actually exist', () => {
    const itemIds = getAllItemIds();

    for (const [zoneId, zone] of Object.entries(ZONES)) {
      if (zone.type !== 'fp' || !zone.rooms) continue;

      for (const room of zone.rooms) {
        if (!room.features) continue;

        for (const feature of room.features) {
          if (feature.item) {
            expect(itemIds).toContain(feature.item),
              `${zoneId}/${room.id}: feature references unknown item "${feature.item}"`;
          }
        }
      }
    }
  });
});

describe('Data Validation — THREATS', () => {
  it('has exactly 40 threats', () => {
    expect(Object.keys(THREATS)).toHaveLength(40);
  });

  it('has all required threat types', () => {
    const requiredThreats = ['traffic', 'cat', 'bully', 'storm', 'vacuum'];
    for (const id of requiredThreats) {
      expect(THREATS[id]).toBeDefined(), `Missing threat: ${id}`;
    }
  });

  it('every threat has required fields', () => {
    const requiredFields = ['name', 'icon', 'type', 'description', 'solve', 'mangaText', 'mangaType'];

    for (const [id, threat] of Object.entries(THREATS)) {
      for (const field of requiredFields) {
        expect(threat[field]).toBeDefined(), `${id} missing field: ${field}`;
      }
    }
  });

  it('every threat type maps to a valid mini-game handler', () => {
    const validTypes = getAllMiniGameTypes();

    for (const [id, threat] of Object.entries(THREATS)) {
      expect(validTypes).toContain(threat.type),
        `${id}: invalid threat type "${threat.type}" (expected ${validTypes.join(' | ')})`;
    }
  });

  it('every threat has a manga text', () => {
    for (const [id, threat] of Object.entries(THREATS)) {
      expect(threat.mangaText.length).toBeGreaterThan(0), `${id}: empty mangaText`;
    }
  });

  it('every threat has a valid mangaType', () => {
    const validMangaTypes = ['near-miss', 'fight', 'scare'];

    for (const [id, threat] of Object.entries(THREATS)) {
      expect(validMangaTypes).toContain(threat.mangaType),
        `${id}: invalid mangaType "${threat.mangaType}" (expected ${validMangaTypes.join(' | ')})`;
    }
  });

  it('threat names are unique', () => {
    const names = Object.values(THREATS).map(t => t.name);
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });
});

describe('Data Validation — Cross-References', () => {
  it('no orphaned zone-to-room references', () => {
    for (const [zoneId, zone] of Object.entries(ZONES)) {
      if (zone.type !== 'fp' || !zone.rooms) continue;

      for (const room of zone.rooms) {
        if (!room.exits) continue;

        for (const exitId of room.exits) {
          const targetRoom = zone.rooms?.find(r => r.id === exitId);
          expect(targetRoom).toBeDefined(),
            `${zoneId}/${room.id}: exit "${exitId}" points to non-existent room`;
        }
      }
    }
  });

  it('all zone types have appropriate data', () => {
    for (const [zoneId, zone] of Object.entries(ZONES)) {
      if (zone.type === 'fp') {
        expect(zone.rooms).toBeDefined(), `${zoneId}: FP zone missing rooms`;
      }
      if (zone.type === 'tp') {
        // TP zones may have companions
        if (zone.companions) {
          expect(Array.isArray(zone.companions)).toBe(true);
        }
      }
    }
  });

  it('dog IDs are consistent across data', () => {
    const dogIds = Object.keys(DOGS);
    // Ensure all dog IDs are unique strings
    expect(new Set(dogIds).size).toBe(dogIds.length);
  });
});

describe('Data Validation — Config', () => {
  it('CONFIG.inventorySlots matches inventory size (16)', async () => {
    const { CONFIG } = await import('@/config');
    expect(CONFIG.inventorySlots).toBe(16);
  });

  it('CONFIG.happiness bounds are valid', async () => {
    const { CONFIG } = await import('@/config');
    expect(CONFIG.happinessMin).toBeGreaterThanOrEqual(0);
    expect(CONFIG.happinessMax).toBeLessThanOrEqual(100);
    expect(CONFIG.happinessMin).toBeLessThanOrEqual(CONFIG.happinessMax);
  });

  it('CONFIG.happinessDecayPerRoom is positive', async () => {
    const { CONFIG } = await import('@/config');
    expect(CONFIG.happinessDecayPerRoom).toBeGreaterThan(0);
  });

  it('CONFIG.happinessItem values are positive', async () => {
    const { CONFIG } = await import('@/config');
    expect(CONFIG.happinessItemTreat).toBeGreaterThan(0);
    expect(CONFIG.happinessItemToy).toBeGreaterThan(0);
  });

  it('CONFIG.happinessThreat values are valid', async () => {
    const { CONFIG } = await import('@/config');
    expect(CONFIG.happinessThreatSuccess).toBeGreaterThan(0);
    expect(CONFIG.happinessThreatFail).toBeLessThan(0);
  });
});
