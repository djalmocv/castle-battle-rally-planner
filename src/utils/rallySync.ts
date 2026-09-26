import { GridSettings, RallyLead } from '../types';
import { getMarchTimeToCastle } from './march';

/** One member's role in a synchronized rally wave. */
export interface RallyMemberPlan {
  lead: RallyLead;
  marchSeconds: number;
  /** Seconds after the first launcher this lead should launch (0 = launch first). */
  launchOffsetSeconds: number;
}

/** The computed launch sequence for a rally wave. */
export interface RallyPlan {
  /** Assigned members, sorted so the first launcher (longest march) comes first. */
  members: RallyMemberPlan[];
  /** Members that have no map position yet and cannot be timed. */
  unassigned: RallyLead[];
  /** Time from the first launch until impact, i.e. the longest march in the wave. */
  maxMarchSeconds: number;
  /** The lead that launches first, or null when the wave has no timable members. */
  anchorLeadId: string | null;
}

/**
 * Builds the staggered launch plan for a set of rally leads so that every
 * member's march lands on the castle at the same instant. The member with the
 * longest march launches first (offset 0); everyone else launches later by the
 * difference between their march time and the longest one.
 *
 * `usesPet` decides whether each lead marches at the faster with-pet speed for
 * this rally. It defaults to the lead's scheduled `usesPet` flag, but callers
 * can override it (e.g. a pet is rostered for a later hour and not active now).
 */
export function computeRallyPlan(
  members: RallyLead[],
  settings: GridSettings,
  usesPet: (lead: RallyLead) => boolean = (lead) => Boolean(lead.usesPet)
): RallyPlan {
  const assigned = members.filter((lead) => lead.position !== null);
  const unassigned = members.filter((lead) => lead.position === null);

  const withMarch = assigned.map((lead) => ({
    lead,
    marchSeconds: getMarchTimeToCastle(lead.position!.x, lead.position!.y, settings, usesPet(lead)),
  }));

  const maxMarchSeconds = withMarch.reduce((max, m) => Math.max(max, m.marchSeconds), 0);

  let anchorLeadId: string | null = null;
  let anchorMarch = -1;
  for (const m of withMarch) {
    if (m.marchSeconds > anchorMarch) {
      anchorMarch = m.marchSeconds;
      anchorLeadId = m.lead.id;
    }
  }

  const memberPlans: RallyMemberPlan[] = withMarch
    .map((m) => ({
      lead: m.lead,
      marchSeconds: m.marchSeconds,
      launchOffsetSeconds: maxMarchSeconds - m.marchSeconds,
    }))
    .sort(
      (a, b) =>
        a.launchOffsetSeconds - b.launchOffsetSeconds ||
        a.lead.name.localeCompare(b.lead.name)
    );

  return {
    members: memberPlans,
    unassigned,
    maxMarchSeconds,
    anchorLeadId,
  };
}

/**
 * The wall-clock epoch (ms) at which a lead must launch to hit the given impact
 * time, based on their march duration.
 */
export function getLaunchEpochMs(impactEpochMs: number, marchSeconds: number): number {
  return impactEpochMs - marchSeconds * 1000;
}

/**
 * Formats a signed second offset relative to the first launcher, e.g. "+0s",
 * "+25s", "+1m 12s".
 */
export function formatLaunchOffset(seconds: number): string {
  if (seconds < 60) return `+${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `+${minutes}m ${remainder.toString().padStart(2, '0')}s`;
}
