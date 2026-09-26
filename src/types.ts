export interface Location2D {
  x: number;
  y: number;
}

export enum PriorityLevel {
  Highest = 1,
  High = 2,
  Normal = 3,
  Low = 4,
  Lowest = 5,
}

export interface RallyLead {
  id: string;
  name: string;
  priority: PriorityLevel;
  position: Location2D | null;
  locked: boolean;
  petSlotId?: string; // Optional manual slot id (e.g., "slot-12-14")
  usesPet?: boolean;  // Player uses a pet
  onlineForSvs?: boolean; // Online for SvS or not
  allianceId?: string; // Which Alliance (see Alliance) this lead belongs to for this rally
}

/**
 * A user-defined tag identifying which allied alliance a rally lead belongs to.
 * Recreated per rally since the set of allies rallying together changes each time.
 */
export interface Alliance {
  id: string;
  name: string;
  colorId: string; // key into ALLIANCE_COLOR_PALETTE (see constants.ts)
}

export interface GridSettings {
  width: number;
  height: number;
  castleSize: number;
  castleX: number;
  castleY: number;
  snapMode: '2x2' | '1x1'; // '2x2' means even coords only (0,2,4...), '1x1' means any coordinate
  autoSide?: 'both' | 'left' | 'right';
}

export interface SavedLayout {
  id: string;
  name: string;
  settings: GridSettings;
  leads: RallyLead[];
  alliances?: Alliance[];
  createdAt: string;
}

/**
 * A synchronized rally "wave": a set of rally leads (by id) that should all
 * land on the castle at the same instant. Because march time depends on
 * position, members launch at staggered times. When a launch sequence is
 * running, startEpochMs marks the moment GO was pressed; a fixed lead-in is
 * added before the first launcher's cue so they have time to react.
 */
export interface RallySyncGroup {
  id: string;
  name: string;
  leadIds: string[];
  /**
   * Subset of leadIds whose pet is active for this rally (uses the faster
   * with-pet march speed). Kept separate from a lead's scheduled usesPet flag,
   * since a pet may be rostered for a later hour but not active for this rally.
   */
  petLeadIds?: string[];
  startEpochMs?: number | null;
}
