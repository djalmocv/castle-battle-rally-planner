import { GridSettings, RallyLead, PriorityLevel } from '../types';

interface CompressedLead {
  n: string;          // Name
  o?: string;         // Notes
  p: PriorityLevel;   // Priority
  x?: number;         // X coordinate (if preset)
  y?: number;         // Y coordinate (if preset)
  l?: number;         // Locked (1 = true, undefined = false)
  s?: string;         // Pet Slot ID (optional)
  u?: number;         // Uses Pet (1 = true, undefined = false)
  f?: number;         // Offline for SvS (1 = offline; undefined/absent = online)
}

interface CompressedLayout {
  w: number;          // width
  h: number;          // height
  s: number;          // castleSize
  x: number;          // castleX
  y: number;          // castleY
  m: '2x2' | '1x1';   // snapMode
  a?: 'both' | 'left' | 'right'; // autoSide
  le: CompressedLead[];
}

/**
 * Encodes settings and leads into a compact Base64 string for URL sharing.
 */
export function serializeLayout(settings: GridSettings, leads: RallyLead[]): string {
  const compressed: CompressedLayout = {
    w: settings.width,
    h: settings.height,
    s: settings.castleSize,
    x: settings.castleX,
    y: settings.castleY,
    m: settings.snapMode,
    a: settings.autoSide,
    le: leads.map((l) => {
      const c: CompressedLead = {
        n: l.name,
        p: l.priority,
      };
      if (l.notes) c.o = l.notes;
      if (l.position) {
        c.x = l.position.x;
        c.y = l.position.y;
      }
      if (l.locked) c.l = 1;
      if (l.petSlotId) c.s = l.petSlotId;
      if (l.usesPet) c.u = 1;
      if (l.onlineForSvs === false) c.f = 1;
      return c;
    }),
  };

  try {
    const jsonStr = JSON.stringify(compressed);
    // Encode unicode names properly using btoa + encodeURIComponent
    const utf8Bytes = new TextEncoder().encode(jsonStr);
    const binString = Array.from(utf8Bytes, (byte) => String.fromCharCode(byte)).join('');
    return btoa(binString);
  } catch (err) {
    console.error('Failed to serialize layout', err);
    return '';
  }
}

/**
 * Decodes a Base64 string back into GridSettings and RallyLead list.
 */
export function deserializeLayout(hash: string): {
  settings: GridSettings;
  leads: RallyLead[];
} | null {
  if (!hash) return null;

  try {
    const binString = atob(hash);
    const utf8Bytes = Uint8Array.from(binString, (char) => char.charCodeAt(0));
    const jsonStr = new TextDecoder().decode(utf8Bytes);
    const parsed = JSON.parse(jsonStr) as CompressedLayout;

    // Build GridSettings
    const settings: GridSettings = {
      width: parsed.w || 32,
      height: parsed.h || 32,
      castleSize: parsed.s || 12,
      castleX: parsed.x !== undefined ? parsed.x : 10,
      castleY: parsed.y !== undefined ? parsed.y : 10,
      snapMode: parsed.m || '2x2',
      autoSide: parsed.a || 'both',
    };

    // Build RallyLeads
    const leads: RallyLead[] = (parsed.le || []).map((l, index) => {
      return {
        id: `shared-${index}-${Date.now()}`,
        name: l.n || 'Unnamed',
        notes: l.o || '',
        priority: l.p || PriorityLevel.Normal,
        position: l.x !== undefined && l.y !== undefined ? { x: l.x, y: l.y } : null,
        locked: l.l === 1,
        petSlotId: l.s,
        usesPet: l.u === 1,
        onlineForSvs: l.f === 1 ? false : true,
      };
    });

    return { settings, leads };
  } catch (err) {
    console.error('Failed to deserialize layout string', err);
    return null;
  }
}
