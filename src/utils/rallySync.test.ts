import { describe, it, expect } from 'vitest';
import { GridSettings, RallyLead, PriorityLevel } from '../types';
import { computeRallyPlan, getLaunchEpochMs, formatLaunchOffset } from './rallySync';
import { getMarchTimeToCastle } from './march';

const settings: GridSettings = {
  width: 32,
  height: 32,
  castleSize: 12,
  castleX: 10,
  castleY: 10,
  snapMode: '2x2',
  autoSide: 'both',
};

function makeLead(id: string, name: string, x: number | null, y: number | null): RallyLead {
  return {
    id,
    name,
    priority: PriorityLevel.Normal,
    position: x === null || y === null ? null : { x, y },
    locked: false,
  };
}

describe('computeRallyPlan', () => {
  it('orders members so the longest march launches first (offset 0)', () => {
    // Castle center (16,16). Closer city marches less, so it launches later.
    const near = makeLead('near', 'Near', 8, 15); // distance 7 -> smaller march
    const far = makeLead('far', 'Far', 0, 0); // corner -> larger march
    const plan = computeRallyPlan([near, far], settings);

    expect(plan.members[0].lead.id).toBe('far');
    expect(plan.members[0].launchOffsetSeconds).toBe(0);
    expect(plan.anchorLeadId).toBe('far');
    expect(plan.members[1].lead.id).toBe('near');
  });

  it('sets each offset to the gap versus the longest march', () => {
    const near = makeLead('near', 'Near', 8, 15);
    const far = makeLead('far', 'Far', 0, 0);
    const nearMarch = getMarchTimeToCastle(8, 15, settings, false);
    const farMarch = getMarchTimeToCastle(0, 0, settings, false);
    const plan = computeRallyPlan([near, far], settings);

    expect(plan.maxMarchSeconds).toBe(farMarch);
    const nearPlan = plan.members.find((m) => m.lead.id === 'near')!;
    expect(nearPlan.launchOffsetSeconds).toBe(farMarch - nearMarch);
  });

  it('splits out members without a map position', () => {
    const placed = makeLead('a', 'Placed', 8, 15);
    const floating = makeLead('b', 'Floating', null, null);
    const plan = computeRallyPlan([placed, floating], settings);

    expect(plan.members).toHaveLength(1);
    expect(plan.unassigned).toHaveLength(1);
    expect(plan.unassigned[0].id).toBe('b');
  });

  it('handles an empty wave', () => {
    const plan = computeRallyPlan([], settings);
    expect(plan.members).toHaveLength(0);
    expect(plan.maxMarchSeconds).toBe(0);
    expect(plan.anchorLeadId).toBeNull();
  });

  it('uses the pet-active predicate instead of the lead usesPet flag', () => {
    const lead = makeLead('a', 'Scout', 8, 15);
    lead.usesPet = true; // scheduled pet, but not active for this rally

    const noPetMarch = getMarchTimeToCastle(8, 15, settings, false);
    const withPetMarch = getMarchTimeToCastle(8, 15, settings, true);
    expect(withPetMarch).toBeLessThan(noPetMarch);

    // Predicate says pet is NOT active -> should use the slower no-pet march.
    const planNoPet = computeRallyPlan([lead], settings, () => false);
    expect(planNoPet.members[0].marchSeconds).toBe(noPetMarch);

    // Predicate says pet IS active -> faster with-pet march.
    const planPet = computeRallyPlan([lead], settings, () => true);
    expect(planPet.members[0].marchSeconds).toBe(withPetMarch);
  });
});

describe('getLaunchEpochMs', () => {
  it('places the launch march-seconds before impact', () => {
    const impact = 1_000_000_000_000;
    expect(getLaunchEpochMs(impact, 48)).toBe(impact - 48_000);
  });
});

describe('formatLaunchOffset', () => {
  it('formats sub-minute offsets', () => {
    expect(formatLaunchOffset(0)).toBe('+0s');
    expect(formatLaunchOffset(25)).toBe('+25s');
  });

  it('formats minute-plus offsets', () => {
    expect(formatLaunchOffset(72)).toBe('+1m 12s');
  });
});
