/**
 * Garden Status — Pure functions for computing plant lifecycle status
 */

import type { GardenPlant, PlantStatus } from '@/types/my-garden';
import { getCropGrowingInfo } from '@/lib/plantingCalendar';

interface CropInfo {
  daysToMaturity: { min: number; max: number };
  harvestWindow?: { duration: number };
  isPerennial?: boolean;
}

/** Days between two dates */
function daysBetween(a: string | Date, b: string | Date): number {
  const msPerDay = 86400000;
  return Math.floor((new Date(b).getTime() - new Date(a).getTime()) / msPerDay);
}

/** Get crop info from the database, with fallback */
function getCropInfo(cropId: string): CropInfo {
  const info = getCropGrowingInfo(cropId);
  if (info) {
    return {
      daysToMaturity: info.daysToMaturity,
      harvestWindow: info.harvestWindow,
      isPerennial: info.isPerennial,
    };
  }
  // Fallback for unknown crops
  return { daysToMaturity: { min: 70, max: 90 }, harvestWindow: { duration: 4 } };
}

/** Compute the current status of a garden plant */
export function computeStatus(
  plant: GardenPlant,
  now: Date = new Date(),
  firstFallFrost?: Date,
): PlantStatus {
  // Manual override takes precedence
  if (plant.manualStatus) return plant.manualStatus;
  if (plant.removedDate) return 'done';
  if (plant.harvestedDate) return 'done';

  const cropInfo = getCropInfo(plant.cropId);
  const elapsed = daysBetween(plant.plantingDate, now);
  const maturityDays = cropInfo.daysToMaturity.min;
  const harvestWeeks = cropInfo.harvestWindow?.duration ?? 4;
  const harvestDays = harvestWeeks * 7;
  const totalDays = maturityDays + harvestDays;

  // Perennial overwintering check
  if (plant.isPerennial && firstFallFrost) {
    const daysPastFrost = daysBetween(firstFallFrost, now);
    if (daysPastFrost > 14) return 'overwintering'; // 2 weeks past frost
  }

  if (elapsed < 0) return 'seedling'; // planted in the future (starting indoors?)

  const pct = elapsed / maturityDays;

  // Transplants skip the seedling stage — they were already past it when planted.
  // Only direct-sown seeds and indoor-started seeds begin as seedlings.
  const isTransplant = plant.plantingMethod === 'transplant';

  if (!isTransplant && pct < 0.25) return 'seedling';
  if (pct < 0.75) return 'growing';
  if (pct < 0.90) return 'near-harvest';
  if (pct < 1.0) return 'ready-to-harvest';
  if (elapsed < totalDays) return 'harvesting';

  // Past harvest window — check frost for frost-sensitive
  return 'done';
}

/** Get estimated harvest date */
export function getEstimatedHarvestDate(plant: GardenPlant): Date {
  const cropInfo = getCropInfo(plant.cropId);
  const plantDate = new Date(plant.plantingDate);
  return new Date(plantDate.getTime() + cropInfo.daysToMaturity.min * 86400000);
}

/** Get progress percentage (0-100) through the lifecycle */
export function getProgressPercent(plant: GardenPlant, now: Date = new Date()): number {
  if (plant.manualStatus === 'done' || plant.harvestedDate || plant.removedDate) return 100;

  const cropInfo = getCropInfo(plant.cropId);
  const elapsed = daysBetween(plant.plantingDate, now);
  const maturityDays = cropInfo.daysToMaturity.min;

  return Math.min(100, Math.max(0, Math.round((elapsed / maturityDays) * 100)));
}

/** Whether to show the sell nudge for this plant */
export function shouldShowSellNudge(plant: GardenPlant): boolean {
  const cropInfo = getCropInfo(plant.cropId);
  const elapsed = daysBetween(plant.plantingDate, new Date());
  const pct = elapsed / cropInfo.daysToMaturity.min;

  return pct >= 0.75
    && plant.quantity > 2
    && !plant.manualStatus
    && !plant.removedDate
    && !plant.harvestedDate;
}

/** Group plants by computed status */
export function groupPlantsByStatus(
  plants: GardenPlant[],
  now: Date = new Date(),
  firstFallFrost?: Date,
): Record<PlantStatus, GardenPlant[]> {
  const groups: Record<PlantStatus, GardenPlant[]> = {
    seedling: [],
    growing: [],
    'near-harvest': [],
    'ready-to-harvest': [],
    harvesting: [],
    done: [],
    overwintering: [],
  };

  for (const plant of plants) {
    const status = computeStatus(plant, now, firstFallFrost);
    groups[status].push(plant);
  }

  return groups;
}

/** Status display config */
export const STATUS_CONFIG: Record<PlantStatus, { label: string; emoji: string; color: string }> = {
  seedling: { label: 'Seedlings', emoji: '🌱', color: 'roots-secondary' },
  growing: { label: 'Growing', emoji: '🌿', color: 'roots-secondary' },
  'near-harvest': { label: 'Almost Ready', emoji: '🍅', color: 'roots-primary' },
  'ready-to-harvest': { label: 'Ready to Harvest', emoji: '🎉', color: 'roots-primary' },
  harvesting: { label: 'Harvesting', emoji: '🧺', color: 'roots-primary' },
  done: { label: 'Done This Season', emoji: '✅', color: 'roots-gray' },
  overwintering: { label: 'Overwintering', emoji: '❄️', color: 'roots-gray' },
};

/** Get crop display name from ID */
export function getCropDisplayName(cropId: string, customVarietyName?: string): string {
  if (customVarietyName) return customVarietyName;
  const info = getCropGrowingInfo(cropId);
  return info?.name || cropId.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
