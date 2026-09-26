import { PriorityLevel } from './types';

/**
 * Shared, single-source-of-truth style + label definitions used across the
 * map, roster list, and overlays. Centralizing these prevents the color and
 * pet-slot mappings from drifting out of sync between components.
 */

// --- Pet rotation time slots ---------------------------------------------

export interface PetTimeSlot {
  id: string;
  label: string; // Full label including UTC zone, e.g. "12:00–14:00 UTC"
}

export const PET_TIME_SLOTS: PetTimeSlot[] = [
  { id: 'slot-12-14', label: '12:00–14:00 UTC' },
  { id: 'slot-13-15', label: '13:00–15:00 UTC' },
  { id: 'slot-14-16', label: '14:00–16:00 UTC' },
  { id: 'slot-15-17', label: '15:00–17:00 UTC' },
];

export const DEFAULT_PET_SLOT_ID = 'slot-12-14';

/** Full pet-slot label including the UTC zone (falls back to the first slot). */
export function getPetSlotLabel(id?: string): string {
  const slot = PET_TIME_SLOTS.find((s) => s.id === id);
  return (slot ?? PET_TIME_SLOTS[0]).label;
}

/** Short pet-slot label without the zone suffix, e.g. "12:00–14:00". */
export function getPetSlotShortLabel(id?: string): string {
  return getPetSlotLabel(id).split(' ')[0];
}

// --- Priority styles ------------------------------------------------------

export interface PriorityStyle {
  name: string;
  fill: string;   // SVG city fill
  stroke: string; // SVG city stroke
  text: string;   // SVG text color
  badgeClass: string;     // Lighter badge used on the map legend / hover panel
  listBadgeClass: string; // Darker badge used in the roster list
}

export const PRIORITY_STYLES: Record<PriorityLevel, PriorityStyle> = {
  [PriorityLevel.Highest]: {
    name: 'Highest',
    fill: '#a855f7',
    stroke: '#c084fc',
    text: '#ffffff',
    badgeClass: 'bg-purple-500/20 text-purple-400 border-purple-500/40',
    listBadgeClass: 'bg-purple-950/50 text-purple-400 border-purple-500/30',
  },
  [PriorityLevel.High]: {
    name: 'High',
    fill: '#3b82f6',
    stroke: '#60a5fa',
    text: '#ffffff',
    badgeClass: 'bg-blue-500/20 text-blue-400 border-blue-500/40',
    listBadgeClass: 'bg-blue-950/50 text-blue-400 border-blue-500/30',
  },
  [PriorityLevel.Normal]: {
    name: 'Normal',
    fill: '#10b981',
    stroke: '#34d399',
    text: '#ffffff',
    badgeClass: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
    listBadgeClass: 'bg-emerald-950/50 text-emerald-400 border-emerald-500/30',
  },
  [PriorityLevel.Low]: {
    name: 'Low',
    fill: '#f59e0b',
    stroke: '#fbbf24',
    text: '#ffffff',
    badgeClass: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
    listBadgeClass: 'bg-amber-950/50 text-amber-400 border-amber-500/30',
  },
  [PriorityLevel.Lowest]: {
    name: 'Lowest',
    fill: '#64748b',
    stroke: '#94a3b8',
    text: '#ffffff',
    badgeClass: 'bg-slate-500/20 text-slate-400 border-slate-500/40',
    listBadgeClass: 'bg-slate-900 text-slate-400 border-slate-700/50',
  },
};

/** Returns the style for a priority level (falls back to Normal). */
export function getPriorityStyle(level: PriorityLevel): PriorityStyle {
  return PRIORITY_STYLES[level] ?? PRIORITY_STYLES[PriorityLevel.Normal];
}
