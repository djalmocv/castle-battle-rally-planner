import { Location2D, GridSettings, RallyLead } from '../types';

/**
 * Calculates Euclidean distance between a 2x2 city's center and the castle's center.
 */
export function getDistanceToCastle(
  cityX: number,
  cityY: number,
  settings: GridSettings
): number {
  const castleCenterX = settings.castleX + settings.castleSize / 2;
  const castleCenterY = settings.castleY + settings.castleSize / 2;
  const cityCenterX = cityX + 1; // Center of 2x2
  const cityCenterY = cityY + 1; // Center of 2x2

  return Math.hypot(cityCenterX - castleCenterX, cityCenterY - castleCenterY);
}

/**
 * Checks if a city at posA overlaps with a city at posB.
 * Two 2x2 cities overlap if their horizontal and vertical offsets are both less than 2 cells.
 */
export function checkOverlap(posA: Location2D, posB: Location2D): boolean {
  return Math.abs(posA.x - posB.x) < 2 && Math.abs(posA.y - posB.y) < 2;
}

/**
 * Checks if a 2x2 position overlaps with the castle.
 */
export function checkOverlapWithCastle(
  pos: Location2D,
  settings: GridSettings
): boolean {
  return (
    pos.x + 2 > settings.castleX &&
    pos.x < settings.castleX + settings.castleSize &&
    pos.y + 2 > settings.castleY &&
    pos.y < settings.castleY + settings.castleSize
  );
}

/**
 * Generates all valid city positions inside the grid bounds that do not overlap with the castle,
 * sorted by ascending distance to the castle center.
 */
export function generateSortedCandidates(settings: GridSettings): Location2D[] {
  const candidates: Location2D[] = [];

  // Grid boundaries for top-left cell of a 2x2 city
  const maxX = settings.width - 2;
  const maxY = settings.height - 2;

  for (let y = 0; y <= maxY; y++) {
    for (let x = 0; x <= maxX; x++) {
      // Apply snap mode (even cells only for 2x2 alignment)
      if (settings.snapMode === '2x2') {
        if (x % 2 !== 0 || y % 2 !== 0) {
          continue;
        }
      }

      const pos = { x, y };

      // Filter candidates based on autoSide value (for 45-deg rotation perspective)
      if (settings.autoSide === 'left') {
        if (x > y) {
          continue; // Keep only left-side of the top corner (x <= y)
        }
      } else if (settings.autoSide === 'right') {
        if (x < y) {
          continue; // Keep only right-side of the top corner (x >= y)
        }
      }

      // Ensure no overlap with the castle
      if (!checkOverlapWithCastle(pos, settings)) {
        candidates.push(pos);
      }
    }
  }

  // Sort candidates by Euclidean distance to castle center
  candidates.sort((a, b) => {
    const distA = getDistanceToCastle(a.x, a.y, settings);
    const distB = getDistanceToCastle(b.x, b.y, settings);
    return distA - distB;
  });

  return candidates;
}

/**
 * Automatically assigns positions to unlocked rally leads.
 * - Preserves positions of locked leads.
 * - Prioritizes leads based on their PriorityLevel (1 is Highest, 5 is Lowest).
 * - Fills positions starting from closest to the castle.
 */
export function assignPositions(
  leads: RallyLead[],
  settings: GridSettings
): RallyLead[] {
  // Create a deep copy of leads to work with
  const updatedLeads: RallyLead[] = leads.map((lead) => ({
    ...lead,
    position: lead.position ? { ...lead.position } : null,
  }));

  // Clear position for any lead that is offline for SvS
  updatedLeads.forEach((lead) => {
    if (lead.onlineForSvs === false) {
      lead.position = null;
    }
  });

  // Identify all occupied positions (locked leads, non-null, and online)
  const lockedLeads = updatedLeads.filter((l) => l.locked && l.position && l.onlineForSvs !== false);
  const lockedPositions = lockedLeads.map((l) => l.position!) as Location2D[];

  // Map out leads that need to be re-assigned
  // (unlocked leads, plus any lead that doesn't have a valid position, and must be online!)
  const leadsToAssign = updatedLeads.filter((l) => !l.locked && l.onlineForSvs !== false);

  // Sort remaining leads by priority (Highest = 1 first)
  // If priority is equal, preserve original list ordering to keep assignment stable
  leadsToAssign.sort((a, b) => a.priority - b.priority);

  // Generate all possible valid position candidates sorted by proximity to castle
  const candidates = generateSortedCandidates(settings);

  // Keep track of all assigned positions in this run
  const assignedPositions = [...lockedPositions];

  // Try to place each unlocked lead
  for (const lead of leadsToAssign) {
    let assigned = false;

    for (const cand of candidates) {
      // Check if cand overlaps with any already assigned or locked positions
      const hasConflict = assignedPositions.some((pos) =>
        checkOverlap(cand, pos)
      );

      if (!hasConflict) {
        // Set lead's position
        const targetLead = updatedLeads.find((l) => l.id === lead.id);
        if (targetLead) {
          targetLead.position = cand;
          assigned = true;
          assignedPositions.push(cand);
          break; // Move to the next lead
        }
      }
    }

    if (!assigned) {
      // No position available in current candidates
      const targetLead = updatedLeads.find((l) => l.id === lead.id);
      if (targetLead) {
        targetLead.position = null;
      }
    }
  }

  return updatedLeads;
}

/**
 * Helper to check if a specific position is fully valid in the current grid configuration:
 * - Within boundaries
 * - Doesn't overlap castle
 * - Doesn't overlap any other placed leads (excluding the lead itself if moving)
 */
export function isValidState(
  pos: Location2D,
  excludeLeadId: string,
  leads: RallyLead[],
  settings: GridSettings
): boolean {
  // 1. Boundaries Check
  if (pos.x < 0 || pos.x > settings.width - 2 || pos.y < 0 || pos.y > settings.height - 2) {
    return false;
  }

  // 2. Castle Overlap
  if (checkOverlapWithCastle(pos, settings)) {
    return false;
  }

  // 3. Alignment check (for manual dragging, apply snaps if settings command it)
  if (settings.snapMode === '2x2') {
    if (pos.x % 2 !== 0 || pos.y % 2 !== 0) {
      return false;
    }
  }

  // 4. Overlaps with other active leads
  for (const lead of leads) {
    if (lead.id !== excludeLeadId && lead.position) {
      if (checkOverlap(pos, lead.position)) {
        return false;
      }
    }
  }

  return true;
}
