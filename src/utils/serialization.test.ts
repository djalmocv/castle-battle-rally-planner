import { describe, it, expect } from 'vitest';
import { GridSettings, PriorityLevel, RallyLead } from '../types';
import { serializeLayout, deserializeLayout } from './serialization';

const settings: GridSettings = {
  width: 30,
  height: 28,
  castleSize: 10,
  castleX: 8,
  castleY: 9,
  snapMode: '1x1',
  autoSide: 'right',
};

const leads: RallyLead[] = [
  {
    id: 'orig-1',
    name: 'Commander Ünïcödé',
    notes: 'front line',
    priority: PriorityLevel.Highest,
    position: { x: 4, y: 6 },
    locked: true,
    petSlotId: 'slot-13-15',
    usesPet: true,
    onlineForSvs: false,
  },
  {
    id: 'orig-2',
    name: 'Backup',
    priority: PriorityLevel.Low,
    position: null,
    locked: false,
    onlineForSvs: true,
  },
];

describe('serializeLayout / deserializeLayout', () => {
  it('round-trips settings including autoSide and snapMode', () => {
    const encoded = serializeLayout(settings, leads);
    const decoded = deserializeLayout(encoded);
    expect(decoded).not.toBeNull();
    expect(decoded!.settings).toEqual(settings);
  });

  it('round-trips lead data (name, priority, position, lock, pet, offline)', () => {
    const encoded = serializeLayout(settings, leads);
    const decoded = deserializeLayout(encoded)!;

    const first = decoded.leads[0];
    expect(first.name).toBe('Commander Ünïcödé');
    expect(first.notes).toBe('front line');
    expect(first.priority).toBe(PriorityLevel.Highest);
    expect(first.position).toEqual({ x: 4, y: 6 });
    expect(first.locked).toBe(true);
    expect(first.petSlotId).toBe('slot-13-15');
    expect(first.usesPet).toBe(true);
    expect(first.onlineForSvs).toBe(false);
  });

  it('defaults onlineForSvs to true when the flag is absent', () => {
    const encoded = serializeLayout(settings, leads);
    const decoded = deserializeLayout(encoded)!;
    expect(decoded.leads[1].onlineForSvs).toBe(true);
    expect(decoded.leads[1].position).toBeNull();
    expect(decoded.leads[1].locked).toBe(false);
  });

  it('returns null for empty or invalid input', () => {
    expect(deserializeLayout('')).toBeNull();
    expect(deserializeLayout('not-valid-base64-@@@')).toBeNull();
  });

  it('applies settings defaults when fields are missing', () => {
    // A minimal payload with only a leads array
    const encoded = btoa(JSON.stringify({ le: [] }));
    const decoded = deserializeLayout(encoded)!;
    expect(decoded.settings.width).toBe(32);
    expect(decoded.settings.height).toBe(32);
    expect(decoded.settings.snapMode).toBe('2x2');
    expect(decoded.settings.autoSide).toBe('both');
  });
});
