import { GridSettings } from '../types';
import { getDistanceToCastle } from './assignment';

/**
 * March speed settings, expressed as a percentage bonus on top of the base
 * (100%) march speed. A higher bonus means a shorter travel time. In this
 * simplified model there are exactly two settings:
 *   - Without a pet: +25%
 *   - With a pet:    +55%
 */
export const MARCH_SPEED_NO_PET = 25;
export const MARCH_SPEED_WITH_PET = 55;

/**
 * Per-mode linear calibration of march time against straight-line distance to
 * the castle center: seconds = overhead + perTile * distance. Each speed
 * setting is fitted independently from the reference chart because the fixed
 * overhead differs slightly between them, so a single shared constant cannot
 * reproduce every value. Verified data points (in-app distance -> chart time):
 *
 *   No-pet:   7.1->36, 7.6->39, 8.6->43, 9.5->47, 9.9->48, 15.6->73
 *   With-pet: 7.0->30, 7.6->32, 8.6->36, 9.5->39, 9.9->40, 10.3->41
 */
const NO_PET_OVERHEAD_SECONDS = 5.91;
const NO_PET_SECONDS_PER_TILE = 4.297;
const WITH_PET_OVERHEAD_SECONDS = 6.25;
const WITH_PET_SECONDS_PER_TILE = 3.411;

/**
 * March time (in whole seconds) for a given straight-line distance to the
 * castle center: a fixed overhead plus distance-based travel time, using the
 * calibration for the selected speed setting. Rounded to the nearest second to
 * match the reference chart.
 */
export function getMarchSeconds(distance: number, usesPet: boolean): number {
  const overhead = usesPet ? WITH_PET_OVERHEAD_SECONDS : NO_PET_OVERHEAD_SECONDS;
  const perTile = usesPet ? WITH_PET_SECONDS_PER_TILE : NO_PET_SECONDS_PER_TILE;
  return Math.round(overhead + perTile * distance);
}

/**
 * March time (in whole seconds) for a 2x2 city at the given grid position,
 * marching to the castle at the center of the grid configuration.
 */
export function getMarchTimeToCastle(
  cityX: number,
  cityY: number,
  settings: GridSettings,
  usesPet: boolean
): number {
  const distance = getDistanceToCastle(cityX, cityY, settings);
  return getMarchSeconds(distance, usesPet);
}

/**
 * Formats a march time in seconds as a compact label, e.g. "36s" or "1m 49s".
 */
export function formatMarchTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}m ${remainder.toString().padStart(2, '0')}s`;
}
