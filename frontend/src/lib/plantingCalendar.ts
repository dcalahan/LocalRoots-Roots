/**
 * Planting Calendar Utilities
 * Calculates planting schedules based on growing profile and crop data
 */

import cropGrowingData from '@/data/crop-growing-data.json';
import { GrowingProfile, calculatePlantingDate } from './growingZones';

// Types
export type PlantingAction = 'start-indoors' | 'direct-sow' | 'transplant' | 'harvest';

export interface PlantingEvent {
  cropId: string;
  cropName: string;
  action: PlantingAction;
  startDate: Date;
  endDate: Date;
  notes?: string;
}

export interface MonthlyCalendar {
  month: number; // 1-12
  year: number;
  startIndoors: PlantingEvent[];
  directSow: PlantingEvent[];
  transplant: PlantingEvent[];
  harvest: PlantingEvent[];
}

export interface CropTimeline {
  cropId: string;
  cropName: string;
  events: PlantingEvent[];
  isPerennial: boolean;
  notSuitableReason?: string;
}

interface CropGrowingInfo {
  name: string;
  category: string;
  startIndoors: { weeksBeforeLastFrost?: number; weeksBeforeLastFrostMax?: number; yearRound?: boolean } | null;
  directSow: { weeksBeforeLastFrost?: number; weeksAfterLastFrost?: number; minSoilTempF?: number; fallPlanting?: boolean } | null;
  transplant: { weeksBeforeLastFrost?: number; weeksAfterLastFrost?: number; minSoilTempF?: number; dormantPlanting?: boolean } | null;
  fallSow?: { weeksBeforeFirstFrost: number; weeksEnd: number; minZone: number; notes?: string };
  daysToMaturity: { min: number; max: number };
  frostTolerance: string;
  isPerennial: boolean;
  treeFruit?: boolean;
  citrus?: boolean;
  indoorCrop?: boolean;
  tropicalSuitable?: boolean;
  fallPlanting?: boolean;
  harvestWindow: { weeksFromMaturity: number; duration: number };
  requirements?: {
    sunlight: string;
    waterNeeds: string;
    spacingInches: number;
    soilPH: { min: number; max: number } | null;
  };
  companions?: string[];
  avoid?: string[];
  tips?: string[];
}

// Load crop data
const crops = cropGrowingData.crops as Record<string, CropGrowingInfo>;
const nonGrowingItems = cropGrowingData.nonGrowingItems as string[];

// Popular crops for simplified calendar view (~25 most common home garden crops)
export const POPULAR_CROPS = [
  'tomato-cherry',
  'tomato-beefsteak',
  'pepper-bell-green',
  'cucumber',
  'squash-zucchini',
  'lettuce-romaine',
  'spinach',
  'carrot',
  'bean-snap',
  'pea-sugar-snap',
  'basil',
  'cilantro',
  'onion-yellow',
  'garlic',
  'potato',
  'corn-sweet',
  'broccoli',
  'kale',
  'radish',
  'beet',
  'strawberry',
  'watermelon',
  'cantaloupe',
  'pumpkin',
  'jalapeno',
  'okra',
];

/**
 * Get the planting calendar for a specific month
 * @param popularOnly - If true, only include popular crops (default: true)
 */
export function getMonthlyCalendar(
  profile: GrowingProfile,
  month: number,
  year: number,
  popularOnly: boolean = true
): MonthlyCalendar {
  const calendar: MonthlyCalendar = {
    month,
    year,
    startIndoors: [],
    directSow: [],
    transplant: [],
    harvest: [],
  };

  // Determine which crops to include
  const cropIds = popularOnly ? POPULAR_CROPS : Object.keys(crops);

  // Get crop timelines and filter events to this month
  for (const cropId of cropIds) {
    if (nonGrowingItems.includes(cropId)) continue;
    if (!crops[cropId]) continue; // Skip if crop doesn't exist in data

    const timeline = getCropTimeline(cropId, profile, year);
    if (timeline.notSuitableReason) continue;

    for (const event of timeline.events) {
      // Check if event falls within this month
      const eventMonth = event.startDate.getMonth() + 1;
      const eventEndMonth = event.endDate.getMonth() + 1;

      if (eventMonth === month || eventEndMonth === month ||
          (eventMonth < month && eventEndMonth > month)) {
        switch (event.action) {
          case 'start-indoors':
            calendar.startIndoors.push(event);
            break;
          case 'direct-sow':
            calendar.directSow.push(event);
            break;
          case 'transplant':
            calendar.transplant.push(event);
            break;
          case 'harvest':
            calendar.harvest.push(event);
            break;
        }
      }
    }
  }

  // Sort each category by start date
  calendar.startIndoors.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  calendar.directSow.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  calendar.transplant.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  calendar.harvest.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

  return calendar;
}

/**
 * Get complete planting timeline for a specific crop
 */
export function getCropTimeline(
  cropId: string,
  profile: GrowingProfile,
  year: number
): CropTimeline {
  const crop = crops[cropId];

  if (!crop) {
    return {
      cropId,
      cropName: cropId,
      events: [],
      isPerennial: false,
      notSuitableReason: 'Crop data not available',
    };
  }

  // Check if crop is suitable for this region
  if (profile.isTropical && crop.tropicalSuitable === false) {
    return {
      cropId,
      cropName: crop.name,
      events: [],
      isPerennial: crop.isPerennial,
      notSuitableReason: 'Not suitable for tropical climates',
    };
  }

  const events: PlantingEvent[] = [];
  const { lastSpringFrost, firstFallFrost } = profile;

  // Handle indoor crops (year-round)
  if (crop.indoorCrop) {
    // Indoor crops can be started any time
    events.push({
      cropId,
      cropName: crop.name,
      action: 'start-indoors',
      startDate: new Date(year, 0, 1), // Year-round
      endDate: new Date(year, 11, 31),
      notes: 'Year-round indoor growing',
    });

    // Harvest is continuous
    events.push({
      cropId,
      cropName: crop.name,
      action: 'harvest',
      startDate: new Date(year, 0, 1),
      endDate: new Date(year, 11, 31),
      notes: 'Year-round harvest',
    });

    return { cropId, cropName: crop.name, events, isPerennial: crop.isPerennial };
  }

  // Handle fall-planted crops (like garlic)
  if (crop.fallPlanting || crop.directSow?.fallPlanting) {
    const fallPlantStart = calculatePlantingDate(firstFallFrost, 4, true); // 4 weeks before first fall frost
    const fallPlantEnd = calculatePlantingDate(firstFallFrost, 2, true);

    events.push({
      cropId,
      cropName: crop.name,
      action: 'direct-sow',
      startDate: fallPlantStart,
      endDate: fallPlantEnd,
      notes: 'Fall planting for summer harvest',
    });

    // Harvest next summer
    events.push({
      cropId,
      cropName: crop.name,
      action: 'harvest',
      startDate: new Date(year + 1, 5, 15), // Mid-June next year
      endDate: new Date(year + 1, 6, 31), // End of July
      notes: 'Harvest following summer',
    });

    return { cropId, cropName: crop.name, events, isPerennial: crop.isPerennial };
  }

  // Handle perennials (tree fruits, berries)
  if (crop.isPerennial && (crop.treeFruit || crop.citrus)) {
    // Tree fruits: show harvest window only (planting is a one-time thing)
    const harvestStart = getPerennialHarvestStart(cropId, profile, year);
    const harvestDuration = crop.harvestWindow.duration;

    events.push({
      cropId,
      cropName: crop.name,
      action: 'harvest',
      startDate: harvestStart,
      endDate: addWeeks(harvestStart, harvestDuration),
      notes: crop.citrus ? 'Harvest when fruit is colored and fragrant' : 'Check daily for ripeness',
    });

    return { cropId, cropName: crop.name, events, isPerennial: true };
  }

  // Standard annual crop timing

  // Start indoors
  if (crop.startIndoors && !crop.startIndoors.yearRound && crop.startIndoors.weeksBeforeLastFrost !== undefined) {
    const weeksEarly = crop.startIndoors.weeksBeforeLastFrost;
    const weeksEarlyMax = crop.startIndoors.weeksBeforeLastFrostMax || weeksEarly;

    events.push({
      cropId,
      cropName: crop.name,
      action: 'start-indoors',
      startDate: calculatePlantingDate(lastSpringFrost, weeksEarlyMax, true),
      endDate: calculatePlantingDate(lastSpringFrost, weeksEarly, true),
      notes: `Start ${weeksEarlyMax}-${weeksEarly} weeks before last frost`,
    });
  }

  // Direct sow
  if (crop.directSow) {
    let sowStart: Date;
    let sowEnd: Date;

    if (crop.directSow.weeksBeforeLastFrost) {
      // Cool-season crops sown before last frost
      sowStart = calculatePlantingDate(lastSpringFrost, crop.directSow.weeksBeforeLastFrost, true);
      sowEnd = calculatePlantingDate(lastSpringFrost, Math.max(0, crop.directSow.weeksBeforeLastFrost - 4), true);
    } else if (crop.directSow.weeksAfterLastFrost !== undefined) {
      // Warm-season crops sown after last frost
      sowStart = calculatePlantingDate(lastSpringFrost, crop.directSow.weeksAfterLastFrost, false);
      sowEnd = calculatePlantingDate(lastSpringFrost, crop.directSow.weeksAfterLastFrost + 4, false);
    } else {
      // Default to around last frost
      sowStart = lastSpringFrost;
      sowEnd = calculatePlantingDate(lastSpringFrost, 2, false);
    }

    events.push({
      cropId,
      cropName: crop.name,
      action: 'direct-sow',
      startDate: sowStart,
      endDate: sowEnd,
      notes: `Soil temp: ${crop.directSow.minSoilTempF}°F minimum`,
    });
  }

  // Transplant
  if (crop.transplant) {
    let transplantStart: Date;
    let transplantEnd: Date;

    if (crop.transplant.weeksBeforeLastFrost) {
      transplantStart = calculatePlantingDate(lastSpringFrost, crop.transplant.weeksBeforeLastFrost, true);
      transplantEnd = calculatePlantingDate(lastSpringFrost, 0, true);
    } else if (crop.transplant.weeksAfterLastFrost !== undefined) {
      transplantStart = calculatePlantingDate(lastSpringFrost, crop.transplant.weeksAfterLastFrost, false);
      transplantEnd = calculatePlantingDate(lastSpringFrost, crop.transplant.weeksAfterLastFrost + 3, false);
    } else {
      transplantStart = lastSpringFrost;
      transplantEnd = calculatePlantingDate(lastSpringFrost, 2, false);
    }

    events.push({
      cropId,
      cropName: crop.name,
      action: 'transplant',
      startDate: transplantStart,
      endDate: transplantEnd,
      notes: `Soil temp: ${crop.transplant.minSoilTempF}°F minimum`,
    });
  }

  // Fall sowing for cool-season crops in warmer zones
  if (crop.fallSow) {
    // Extract zone number from profile (e.g., "7a" -> 7)
    const zoneNumber = parseInt(profile.zone.replace(/[ab]/i, ''), 10) || 0;

    if (zoneNumber >= crop.fallSow.minZone) {
      const fallSowStart = calculatePlantingDate(firstFallFrost, crop.fallSow.weeksBeforeFirstFrost, true);
      const fallSowEnd = calculatePlantingDate(firstFallFrost, crop.fallSow.weeksEnd, true);

      events.push({
        cropId,
        cropName: crop.name,
        action: 'direct-sow',
        startDate: fallSowStart,
        endDate: fallSowEnd,
        notes: crop.fallSow.notes || 'Fall planting',
      });
    }
  }

  // Calculate harvest window
  const plantingDate = events.find(e => e.action === 'transplant' || e.action === 'direct-sow')?.startDate;
  if (plantingDate) {
    const daysToMaturity = crop.daysToMaturity.min;
    const harvestStart = addDays(plantingDate, daysToMaturity);
    const harvestEnd = addWeeks(harvestStart, crop.harvestWindow.duration);

    // Don't extend harvest past first frost for frost-sensitive crops
    const maxHarvestEnd = crop.frostTolerance === 'none' ? firstFallFrost : harvestEnd;

    events.push({
      cropId,
      cropName: crop.name,
      action: 'harvest',
      startDate: harvestStart,
      endDate: new Date(Math.min(harvestEnd.getTime(), maxHarvestEnd.getTime())),
      notes: `${crop.daysToMaturity.min}-${crop.daysToMaturity.max} days from planting`,
    });
  }

  return { cropId, cropName: crop.name, events, isPerennial: crop.isPerennial };
}

/**
 * Get optimal planting window for a crop
 */
export function getOptimalPlantingWindow(
  cropId: string,
  profile: GrowingProfile
): { start: Date; end: Date; action: PlantingAction } | null {
  const timeline = getCropTimeline(cropId, profile, new Date().getFullYear());

  if (timeline.notSuitableReason || timeline.events.length === 0) {
    return null;
  }

  // Prefer transplant, then direct sow, then start indoors
  const transplant = timeline.events.find(e => e.action === 'transplant');
  if (transplant) {
    return { start: transplant.startDate, end: transplant.endDate, action: 'transplant' };
  }

  const directSow = timeline.events.find(e => e.action === 'direct-sow');
  if (directSow) {
    return { start: directSow.startDate, end: directSow.endDate, action: 'direct-sow' };
  }

  const startIndoors = timeline.events.find(e => e.action === 'start-indoors');
  if (startIndoors) {
    return { start: startIndoors.startDate, end: startIndoors.endDate, action: 'start-indoors' };
  }

  return null;
}

/**
 * Get all crops that can be planted this month
 */
export function getCropsToPlantThisMonth(
  profile: GrowingProfile,
  month?: number,
  year?: number
): Array<{ cropId: string; cropName: string; actions: PlantingAction[] }> {
  const targetMonth = month || new Date().getMonth() + 1;
  const targetYear = year || new Date().getFullYear();

  const calendar = getMonthlyCalendar(profile, targetMonth, targetYear);

  // Combine all planting actions (not harvest)
  const cropActions = new Map<string, { cropName: string; actions: Set<PlantingAction> }>();

  for (const event of [...calendar.startIndoors, ...calendar.directSow, ...calendar.transplant]) {
    if (!cropActions.has(event.cropId)) {
      cropActions.set(event.cropId, { cropName: event.cropName, actions: new Set() });
    }
    cropActions.get(event.cropId)!.actions.add(event.action);
  }

  return Array.from(cropActions.entries()).map(([cropId, data]) => ({
    cropId,
    cropName: data.cropName,
    actions: Array.from(data.actions),
  }));
}

/**
 * Get crops ready to harvest this month
 */
export function getCropsToHarvestThisMonth(
  profile: GrowingProfile,
  month?: number,
  year?: number
): Array<{ cropId: string; cropName: string; notes?: string }> {
  const targetMonth = month || new Date().getMonth() + 1;
  const targetYear = year || new Date().getFullYear();

  const calendar = getMonthlyCalendar(profile, targetMonth, targetYear);

  return calendar.harvest.map(event => ({
    cropId: event.cropId,
    cropName: event.cropName,
    notes: event.notes,
  }));
}

/**
 * Get crop growing info for display
 */
export function getCropGrowingInfo(cropId: string): CropGrowingInfo | null {
  return crops[cropId] || null;
}

/**
 * Check if a crop ID is valid (has growing data)
 */
export function isValidCrop(cropId: string): boolean {
  return cropId in crops && !nonGrowingItems.includes(cropId);
}

/**
 * Get all crop IDs that have growing data
 */
export function getAllGrowableCropIds(): string[] {
  return Object.keys(crops).filter(id => !nonGrowingItems.includes(id));
}

// Helper functions

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function addWeeks(date: Date, weeks: number): Date {
  return addDays(date, weeks * 7);
}

function getPerennialHarvestStart(cropId: string, profile: GrowingProfile, year: number): Date {
  // Simplified harvest timing for perennials based on typical seasons
  const harvestMonths: Record<string, number> = {
    'strawberry': 5,    // May
    'blueberry': 6,     // June
    'raspberry': 6,     // June
    'blackberry': 7,    // July
    'grape': 8,         // August
    'apple': 8,         // August
    'pear': 8,          // August
    'peach': 7,         // July
    'plum': 7,          // July
    'cherry': 6,        // June
    'fig': 8,           // August
    'lemon': 11,        // November (year-round in warm climates)
    'lime': 5,          // May (year-round in warm climates)
    'orange': 11,       // November
    'asparagus': 4,     // April
    'rhubarb': 4,       // April
  };

  let month = harvestMonths[cropId] || 7; // Default to July

  // Adjust for southern hemisphere
  if (profile.isSouthernHemisphere) {
    month = ((month + 5) % 12) + 1;
  }

  return new Date(year, month - 1, 1);
}

/**
 * Format action for display
 */
export function formatAction(action: PlantingAction): string {
  switch (action) {
    case 'start-indoors':
      return 'Start Indoors';
    case 'direct-sow':
      return 'Direct Sow';
    case 'transplant':
      return 'Transplant';
    case 'harvest':
      return 'Harvest';
    default:
      return action;
  }
}

/**
 * Get action color for UI
 */
export function getActionColor(action: PlantingAction): string {
  switch (action) {
    case 'start-indoors':
      return 'purple';
    case 'direct-sow':
      return 'green';
    case 'transplant':
      return 'blue';
    case 'harvest':
      return 'orange';
    default:
      return 'gray';
  }
}
