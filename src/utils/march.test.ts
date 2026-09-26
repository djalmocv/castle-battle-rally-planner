import { describe, it, expect } from 'vitest';
import { GridSettings } from '../types';
import {
  getMarchSeconds,
  getMarchTimeToCastle,
  formatMarchTime,
} from './march';

const settings: GridSettings = {
  width: 32,
  height: 32,
  castleSize: 12,
  castleX: 10,
  castleY: 10,
  snapMode: '2x2',
  autoSide: 'both',
};

describe('getMarchSeconds', () => {
  it('matches the reference (no-pet) chart anchors', () => {
    // Calibrated against in-app distance -> chart time pairs.
    expect(getMarchSeconds(7.1, false)).toBe(36);
    expect(getMarchSeconds(7.6, false)).toBe(39);
    expect(getMarchSeconds(8.6, false)).toBe(43);
    expect(getMarchSeconds(9.5, false)).toBe(47);
    expect(getMarchSeconds(9.9, false)).toBe(48);
    expect(getMarchSeconds(15.6, false)).toBe(73);
  });

  it('matches the reference (with-pet) chart anchors', () => {
    expect(getMarchSeconds(7, true)).toBe(30);
    expect(getMarchSeconds(7.6, true)).toBe(32);
    expect(getMarchSeconds(8.6, true)).toBe(36);
    expect(getMarchSeconds(9.5, true)).toBe(39);
    expect(getMarchSeconds(9.9, true)).toBe(40);
    expect(getMarchSeconds(10.3, true)).toBe(41);
  });

  it('rounds to the nearest whole second', () => {
    // 5.6 + 5.425 * 7 / 1.25 = 35.98 -> 36 (nearest, not up)
    expect(getMarchSeconds(7, false)).toBe(36);
    // 5.6 + 5.425 * 7.1 / 1.25 = 36.41 -> 36 (does not round up)
    expect(getMarchSeconds(7.1, false)).toBe(36);
  });

  it('is faster with a pet (higher speed => less time)', () => {
    const noPet = getMarchSeconds(12, false);
    const withPet = getMarchSeconds(12, true);
    expect(withPet).toBeLessThan(noPet);
  });

  it('matches the with-pet chart anchor (36s no-pet -> 30s with pet)', () => {
    expect(getMarchSeconds(7, false)).toBe(36);
    expect(getMarchSeconds(7, true)).toBe(30);
  });

  it('applies the fixed overhead at zero distance', () => {
    // Only the speed-independent overhead remains.
    expect(getMarchSeconds(0, false)).toBe(6); // round(5.91)
    expect(getMarchSeconds(0, true)).toBe(6); // round(6.25)
  });
});

describe('getMarchTimeToCastle', () => {
  it('computes time from a grid position via distance to castle center', () => {
    // Castle center is (16, 16); a 2x2 city at (8, 15) has center (9, 16) -> distance 7
    expect(getMarchTimeToCastle(8, 15, settings, false)).toBe(36);
  });

  it('gives a shorter time for the same position when using a pet', () => {
    const noPet = getMarchTimeToCastle(0, 0, settings, false);
    const withPet = getMarchTimeToCastle(0, 0, settings, true);
    expect(withPet).toBeLessThan(noPet);
  });

  it('matches the closest-city anchor with a pet (30s)', () => {
    // 2x2 city at (8, 15) -> center (9, 16), distance 7 -> 36s no-pet, 30s with pet
    expect(getMarchTimeToCastle(8, 15, settings, true)).toBe(30);
  });
});

describe('formatMarchTime', () => {
  it('formats sub-minute values with a trailing s', () => {
    expect(formatMarchTime(36)).toBe('36s');
    expect(formatMarchTime(59)).toBe('59s');
  });

  it('formats minute-plus values as "Xm SSs"', () => {
    expect(formatMarchTime(60)).toBe('1m 00s');
    expect(formatMarchTime(109)).toBe('1m 49s');
    expect(formatMarchTime(125)).toBe('2m 05s');
  });
});
