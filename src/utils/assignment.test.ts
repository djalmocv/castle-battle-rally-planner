import { describe, it, expect } from 'vitest';
import { GridSettings, PriorityLevel, RallyLead } from '../types';
import {
  getDistanceToCastle,
  checkOverlap,
  checkOverlapWithCastle,
  generateSortedCandidates,
  assignPositions,
  isValidState,
} from './assignment';

const baseSettings: GridSettings = {
  width: 32,
  height: 32,
  castleSize: 12,
  castleX: 10,
  castleY: 10,
  snapMode: '2x2',
  autoSide: 'both',
};

const makeLead = (overrides: Partial<RallyLead> = {}): RallyLead => ({
  id: overrides.id ?? `lead-${Math.random().toString(36).slice(2)}`,
  name: overrides.name ?? 'Lead',
  priority: overrides.priority ?? PriorityLevel.Normal,
  position: overrides.position ?? null,
  locked: overrides.locked ?? false,
  notes: overrides.notes,
  petSlotId: overrides.petSlotId,
  usesPet: overrides.usesPet,
  onlineForSvs: overrides.onlineForSvs,
});

describe('getDistanceToCastle', () => {
  it('is zero when the city center coincides with the castle center', () => {
    // Castle center = (10 + 6, 10 + 6) = (16, 16); city center = (x + 1, y + 1)
    expect(getDistanceToCastle(15, 15, baseSettings)).toBe(0);
  });

  it('grows with distance from the castle', () => {
    const near = getDistanceToCastle(15, 15, baseSettings);
    const far = getDistanceToCastle(0, 0, baseSettings);
    expect(far).toBeGreaterThan(near);
  });
});

describe('checkOverlap', () => {
  it('detects overlapping 2x2 cities', () => {
    expect(checkOverlap({ x: 4, y: 4 }, { x: 5, y: 5 })).toBe(true);
    expect(checkOverlap({ x: 4, y: 4 }, { x: 4, y: 4 })).toBe(true);
  });

  it('returns false when cities are two or more cells apart', () => {
    expect(checkOverlap({ x: 4, y: 4 }, { x: 6, y: 4 })).toBe(false);
    expect(checkOverlap({ x: 4, y: 4 }, { x: 4, y: 6 })).toBe(false);
  });
});

describe('checkOverlapWithCastle', () => {
  it('flags positions inside the castle footprint', () => {
    expect(checkOverlapWithCastle({ x: 12, y: 12 }, baseSettings)).toBe(true);
  });

  it('allows positions clear of the castle', () => {
    expect(checkOverlapWithCastle({ x: 0, y: 0 }, baseSettings)).toBe(false);
    expect(checkOverlapWithCastle({ x: 22, y: 22 }, baseSettings)).toBe(false);
  });
});

describe('generateSortedCandidates', () => {
  it('produces castle-free, in-bounds, ascending-distance candidates', () => {
    const candidates = generateSortedCandidates(baseSettings);
    expect(candidates.length).toBeGreaterThan(0);

    // None overlap the castle and all fit in bounds
    for (const c of candidates) {
      expect(checkOverlapWithCastle(c, baseSettings)).toBe(false);
      expect(c.x).toBeGreaterThanOrEqual(0);
      expect(c.y).toBeGreaterThanOrEqual(0);
      expect(c.x).toBeLessThanOrEqual(baseSettings.width - 2);
      expect(c.y).toBeLessThanOrEqual(baseSettings.height - 2);
    }

    // Distances are non-decreasing
    for (let i = 1; i < candidates.length; i++) {
      const prev = getDistanceToCastle(candidates[i - 1].x, candidates[i - 1].y, baseSettings);
      const curr = getDistanceToCastle(candidates[i].x, candidates[i].y, baseSettings);
      expect(curr).toBeGreaterThanOrEqual(prev);
    }
  });

  it('respects 2x2 snap mode (even coordinates only)', () => {
    const candidates = generateSortedCandidates(baseSettings);
    for (const c of candidates) {
      expect(c.x % 2).toBe(0);
      expect(c.y % 2).toBe(0);
    }
  });

  it('filters to a single side when autoSide is set', () => {
    const left = generateSortedCandidates({ ...baseSettings, autoSide: 'left' });
    expect(left.every((c) => c.x <= c.y)).toBe(true);

    const right = generateSortedCandidates({ ...baseSettings, autoSide: 'right' });
    expect(right.every((c) => c.x >= c.y)).toBe(true);
  });
});

describe('assignPositions', () => {
  it('assigns non-overlapping positions to unlocked online leads', () => {
    const leads = [makeLead({ id: 'a' }), makeLead({ id: 'b' }), makeLead({ id: 'c' })];
    const result = assignPositions(leads, baseSettings);

    const positions = result.map((l) => l.position).filter((p): p is NonNullable<typeof p> => p !== null);
    expect(positions.length).toBe(3);

    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        expect(checkOverlap(positions[i], positions[j])).toBe(false);
      }
    }
  });

  it('preserves locked lead positions', () => {
    const locked = makeLead({ id: 'locked', locked: true, position: { x: 0, y: 0 } });
    const result = assignPositions([locked, makeLead({ id: 'b' })], baseSettings);
    const lockedResult = result.find((l) => l.id === 'locked')!;
    expect(lockedResult.position).toEqual({ x: 0, y: 0 });
  });

  it('clears positions for leads that are offline for SvS', () => {
    const offline = makeLead({ id: 'off', onlineForSvs: false, position: { x: 4, y: 4 } });
    const result = assignPositions([offline], baseSettings);
    expect(result.find((l) => l.id === 'off')!.position).toBeNull();
  });

  it('places higher-priority leads closer to the castle', () => {
    const low = makeLead({ id: 'low', priority: PriorityLevel.Lowest });
    const high = makeLead({ id: 'high', priority: PriorityLevel.Highest });
    const result = assignPositions([low, high], baseSettings);

    const highPos = result.find((l) => l.id === 'high')!.position!;
    const lowPos = result.find((l) => l.id === 'low')!.position!;
    const highDist = getDistanceToCastle(highPos.x, highPos.y, baseSettings);
    const lowDist = getDistanceToCastle(lowPos.x, lowPos.y, baseSettings);
    expect(highDist).toBeLessThanOrEqual(lowDist);
  });
});

describe('isValidState', () => {
  it('rejects out-of-bounds positions', () => {
    expect(isValidState({ x: -2, y: 0 }, 'x', [], baseSettings)).toBe(false);
    expect(isValidState({ x: 31, y: 0 }, 'x', [], baseSettings)).toBe(false);
  });

  it('rejects castle overlaps', () => {
    expect(isValidState({ x: 12, y: 12 }, 'x', [], baseSettings)).toBe(false);
  });

  it('rejects misaligned positions in 2x2 snap mode', () => {
    expect(isValidState({ x: 1, y: 0 }, 'x', [], baseSettings)).toBe(false);
  });

  it('rejects overlaps with other leads but ignores the excluded lead', () => {
    const other = makeLead({ id: 'other', position: { x: 4, y: 4 } });
    expect(isValidState({ x: 4, y: 4 }, 'self', [other], baseSettings)).toBe(false);
    expect(isValidState({ x: 4, y: 4 }, 'other', [other], baseSettings)).toBe(true);
  });

  it('accepts a clear, aligned, in-bounds position', () => {
    expect(isValidState({ x: 0, y: 0 }, 'x', [], baseSettings)).toBe(true);
  });
});
