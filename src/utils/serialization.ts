import { GridSettings, RallyLead, PriorityLevel, Alliance } from '../types';

interface CompressedLead {
  n: string;          // Name
  p: PriorityLevel;   // Priority
  x?: number;         // X coordinate (if preset)
  y?: number;         // Y coordinate (if preset)
  l?: number;         // Locked (1 = true, undefined = false)
  s?: string;         // Pet Slot ID (optional)
  u?: number;         // Uses Pet (1 = true, undefined = false)
  f?: number;         // Offline for SvS (1 = offline; undefined/absent = online)
  al?: string;        // Alliance id (references an entry in CompressedLayout.al)
}

interface CompressedAlliance {
  i: string; // id
  n: string; // name
  c: string; // colorId
}

interface CompressedLayout {
  w: number;          // width
  h: number;          // height
  s: number;          // castleSize
  x: number;          // castleX
  y: number;          // castleY
  m: '2x2' | '1x1';   // snapMode
  a?: 'both' | 'left' | 'right'; // autoSide
  al?: CompressedAlliance[]; // alliance tag definitions
  le: CompressedLead[];
}

/**
 * Encodes settings, leads, and alliance tags into a compact Base64 string for URL sharing.
 */
export function serializeLayout(settings: GridSettings, leads: RallyLead[], alliances: Alliance[]): string {
  const compressed: CompressedLayout = {
    w: settings.width,
    h: settings.height,
    s: settings.castleSize,
    x: settings.castleX,
    y: settings.castleY,
    m: settings.snapMode,
    a: settings.autoSide,
    al: alliances.map((a) => ({ i: a.id, n: a.name, c: a.colorId })),
    le: leads.map((l) => {
      const c: CompressedLead = {
        n: l.name,
        p: l.priority,
      };
      if (l.position) {
        c.x = l.position.x;
        c.y = l.position.y;
      }
      if (l.locked) c.l = 1;
      if (l.petSlotId) c.s = l.petSlotId;
      if (l.usesPet) c.u = 1;
      if (l.onlineForSvs === false) c.f = 1;
      if (l.allianceId) c.al = l.allianceId;
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
  alliances: Alliance[];
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
        priority: l.p || PriorityLevel.Normal,
        position: l.x !== undefined && l.y !== undefined ? { x: l.x, y: l.y } : null,
        locked: l.l === 1,
        petSlotId: l.s,
        usesPet: l.u === 1,
        onlineForSvs: l.f === 1 ? false : true,
        allianceId: l.al,
      };
    });

    // Build Alliance tag definitions
    const alliances: Alliance[] = (parsed.al || []).map((a) => ({
      id: a.i,
      name: a.n,
      colorId: a.c,
    }));

    return { settings, leads, alliances };
  } catch (err) {
    console.error('Failed to deserialize layout string', err);
    return null;
  }
}
