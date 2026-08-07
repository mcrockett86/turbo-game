/**
 * Connectivity Graph Test
 *
 * Verifies that all zones are reachable from suburban_streets
 * and that all zones have a return path back.
 */

import { describe, it, expect } from 'vitest';
import { ZONES } from './data';
import type { Zone } from './types';

describe('Connectivity Graph', () => {
  // All known zone IDs
  const allZoneIds = Object.keys(ZONES);

  it('has all zones defined', () => {
    expect(allZoneIds.length).toBeGreaterThan(10);
    expect(allZoneIds).toContain('suburban_streets');
    expect(allZoneIds).toContain('dog_park');
    expect(allZoneIds).toContain('lake');
    expect(allZoneIds).toContain('forest');
    expect(allZoneIds).toContain('beach');
    expect(allZoneIds).toContain('mountain');
    expect(allZoneIds).toContain('waterfall');
    expect(allZoneIds).toContain('dog_show');
    expect(allZoneIds).toContain('park_secret');
    expect(allZoneIds).toContain('pet_store');
    expect(allZoneIds).toContain('garden');
    expect(allZoneIds).toContain('library');
    expect(allZoneIds).toContain('market');
    expect(allZoneIds).toContain('cave');
  });

  it('suburban_streets has forward exits to all new zones', () => {
    const fpZone = ZONES['suburban_streets'] as Zone & { rooms: any[] };
    expect(fpZone).toBeDefined();
    expect(fpZone.rooms).toBeDefined();

    const entranceRooms = fpZone.rooms.filter((r: any) => r.isEntrance && r.entranceZone);
    const exitTargets = entranceRooms.map((r: any) => r.entranceZone);

    // All FP zone exits
    expect(exitTargets).toContain('pet_store');
    expect(exitTargets).toContain('garden');
    expect(exitTargets).toContain('library');
    expect(exitTargets).toContain('market');
    expect(exitTargets).toContain('dog_show');
    expect(exitTargets).toContain('lake');
    expect(exitTargets).toContain('forest');
    expect(exitTargets).toContain('beach');
    expect(exitTargets).toContain('mountain');
    expect(exitTargets).toContain('waterfall');
    expect(exitTargets).toContain('park_secret');
  });

  it('FP zones have return exits to suburban_streets', () => {
    const fpZones = ['pet_store', 'garden', 'library', 'market'];
    for (const zoneId of fpZones) {
      const zone = ZONES[zoneId] as Zone & { rooms: any[] };
      expect(zone).toBeDefined();
      expect(zone.rooms).toBeDefined();
      const entranceRoom = zone.rooms.find((r: any) => r.isEntrance && r.entranceZone);
      expect(entranceRoom).toBeDefined();
      expect(entranceRoom.entranceZone).toBe('suburban_streets');
    }
  });

  it('TP zones have returnZone set to suburban_streets', () => {
    const tpZones = ['dog_park', 'lake', 'forest', 'beach', 'mountain', 'waterfall', 'dog_show', 'park_secret'];
    for (const zoneId of tpZones) {
      const zone = ZONES[zoneId] as any;
      expect(zone).toBeDefined();
      expect(zone.type).toBe('tp');
      expect(zone.returnZone).toBe('suburban_streets');
      // Must have a return_gate feature
      const returnGate = zone.features?.find((f: any) => f.type === 'return_gate');
      expect(returnGate).toBeDefined();
      expect(returnGate.id).toMatch(/exit/);
    }
  });

  it('cave zone has return exit to forest', () => {
    const caveZone = ZONES['cave'] as Zone & { rooms: any[] };
    expect(caveZone).toBeDefined();
    expect(caveZone.rooms).toBeDefined();
    const entranceRoom = caveZone.rooms.find((r: any) => r.isEntrance && r.entranceZone);
    expect(entranceRoom).toBeDefined();
    expect(entranceRoom.entranceZone).toBe('forest');
  });

  it('forest zone has cave_entrance feature', () => {
    const forestZone = ZONES['forest'] as any;
    expect(forestZone).toBeDefined();
    const caveFeature = forestZone.features?.find((f: any) => f.type === 'cave_entrance');
    expect(caveFeature).toBeDefined();
  });

  it('all zones are reachable from suburban_streets (BFS)', () => {
    const visited = new Set<string>();
    const queue: string[] = ['suburban_streets'];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);

      const zone = ZONES[current as keyof typeof ZONES];
      if (!zone) continue;

      // FP zone: follow entranceZone exits
      if ('rooms' in zone && zone.rooms) {
        for (const room of zone.rooms as any[]) {
          if (room.isEntrance && room.entranceZone && !visited.has(room.entranceZone)) {
            queue.push(room.entranceZone);
          }
        }
      }

      // TP zone: follow returnZone
      if ((zone as any).returnZone && !visited.has((zone as any).returnZone)) {
        queue.push((zone as any).returnZone);
      }

      // Check for cave_entrance feature (forest -> cave)
      if (zone.features) {
        for (const feature of zone.features as any[]) {
          if (feature.type === 'cave_entrance' && !visited.has('cave')) {
            queue.push('cave');
          }
        }
      }
    }

    // All zones should be reachable
    for (const zoneId of allZoneIds) {
      expect(visited.has(zoneId)).toBe(true);
    }
  });

  it('all zones can return to suburban_streets (reverse BFS)', () => {
    const visited = new Set<string>();
    const queue: string[] = ['suburban_streets'];

    // Build reverse adjacency map
    const reverseEdges: Record<string, string[]> = {};
    for (const zoneId of allZoneIds) {
      reverseEdges[zoneId] = [];
    }

    for (const zoneId of allZoneIds) {
      const zone = ZONES[zoneId as keyof typeof ZONES];
      if (!zone) continue;

      // FP zone: entranceZone defines where you go FROM this zone
      if ('rooms' in zone && zone.rooms) {
        for (const room of zone.rooms as any[]) {
          if (room.isEntrance && room.entranceZone) {
            // From this zone -> entranceZone
            if (!reverseEdges[room.entranceZone]) reverseEdges[room.entranceZone] = [];
            reverseEdges[room.entranceZone].push(zoneId);
          }
        }
      }

      // TP zone: returnZone defines where you go FROM this zone
      if ((zone as any).returnZone) {
        const rz = (zone as any).returnZone;
        if (!reverseEdges[rz]) reverseEdges[rz] = [];
        reverseEdges[rz].push(zoneId);
      }

      // cave_entrance feature: forest -> cave (reverse: cave can return via its entranceZone)
      if (zone.features) {
        for (const feature of zone.features as any[]) {
          if (feature.type === 'cave_entrance' && !reverseEdges['cave']) {
            reverseEdges['cave'].push(zoneId);
          }
        }
      }
    }

    // BFS from suburban_streets on reverse graph
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);

      const neighbors = reverseEdges[current] || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          queue.push(neighbor);
        }
      }
    }

    // All zones should be able to reach suburban_streets
    for (const zoneId of allZoneIds) {
      expect(visited.has(zoneId)).toBe(true);
    }
  });
});
