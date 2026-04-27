import produceData from '@/data/produce-seeds.json';
import { getCropGrowingInfo } from './plantingCalendar';

export interface ProduceItem {
  id: string;
  name: string;
  category: string;
  seasonStart: number;
  seasonEnd: number;
  image: string;
  tags: string[];
}

/**
 * Joined catalog entry — combines `produce-seeds.json` (photos, seasons,
 * tags — the visual data the Sell flow uses) with `crop-growing-data.json`
 * (planting/harvest/care data — the operational data My Garden + Sage use).
 *
 * The two catalogs share crop IDs (`tomato-cherry`, `basil`, etc.) but
 * never reconciled. This is the API-layer join that lets a single picker
 * component serve both flows. Crops that exist in only one catalog
 * gracefully fall back: if no produce-seeds entry, image is null and the
 * caller renders an emoji+name fallback.
 */
export interface CatalogItem {
  id: string;
  name: string;
  category: string;
  /** From produce-seeds.json — null if crop is grow-only */
  image: string | null;
  /** Month range 1-12 — null if crop is grow-only */
  seasonStart: number | null;
  seasonEnd: number | null;
  tags: string[];
  /** From crop-growing-data.json — null if crop is sell-only */
  daysToMaturity: { min: number; max: number } | null;
  isPerennial: boolean;
  hasBoltingData: boolean;
  hasPruningData: boolean;
}

export interface UnitOfMeasure {
  id: string;
  name: string;
  abbreviation: string;
}

// Type assertion for the imported data
const { produce, units } = produceData as {
  produce: ProduceItem[];
  units: UnitOfMeasure[];
};

/**
 * Get all produce items
 */
export function getAllProduce(): ProduceItem[] {
  return produce;
}

/**
 * Get all units of measure
 */
export function getAllUnits(): UnitOfMeasure[] {
  return units;
}

/**
 * Get produce by ID
 */
export function getProduceById(id: string): ProduceItem | undefined {
  return produce.find((p) => p.id === id);
}

/**
 * Get unit by ID
 */
export function getUnitById(id: string): UnitOfMeasure | undefined {
  return units.find((u) => u.id === id);
}

/**
 * Get produce items by category
 */
export function getProduceByCategory(category: string): ProduceItem[] {
  return produce.filter((p) => p.category === category);
}

/**
 * Get all unique categories
 */
export function getCategories(): string[] {
  const categories = new Set(produce.map((p) => p.category));
  return Array.from(categories).sort();
}

/**
 * Search produce by name or tags
 */
export function searchProduce(query: string): ProduceItem[] {
  const lowerQuery = query.toLowerCase();
  return produce.filter(
    (p) =>
      p.name.toLowerCase().includes(lowerQuery) ||
      p.tags.some((tag) => tag.toLowerCase().includes(lowerQuery))
  );
}

/**
 * Get produce that is currently in season
 */
export function getInSeasonProduce(month?: number): ProduceItem[] {
  const currentMonth = month ?? new Date().getMonth() + 1; // 1-12

  return produce.filter((p) => {
    if (p.seasonStart <= p.seasonEnd) {
      // Normal range (e.g., May-September)
      return currentMonth >= p.seasonStart && currentMonth <= p.seasonEnd;
    } else {
      // Wrapping range (e.g., October-February)
      return currentMonth >= p.seasonStart || currentMonth <= p.seasonEnd;
    }
  });
}

/**
 * Format category name for display (capitalize, replace hyphens)
 */
export function formatCategoryName(category: string): string {
  return category
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Get month name from number
 */
export function getMonthName(month: number): string {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return months[month - 1] || '';
}

/**
 * Format season range as readable string
 */
export function formatSeasonRange(startMonth: number, endMonth: number): string {
  return `${getMonthName(startMonth)} - ${getMonthName(endMonth)}`;
}

/**
 * Get a joined CatalogItem for a crop ID. Joins produce-seeds.json with
 * crop-growing-data.json so a single object carries both visual and
 * operational data. Returns null only if the crop ID exists in neither
 * catalog (very rare — would mean a corrupt cropId in My Garden state).
 *
 * Used by ListFromGardenSheet to render plant inventory with photos,
 * and by the future shared ProducePicker component (V2) for both Sell
 * and Grow flows.
 */
export function getCatalogItem(cropId: string): CatalogItem | null {
  const produceItem = produce.find((p) => p.id === cropId);
  const growingInfo = getCropGrowingInfo(cropId);

  if (!produceItem && !growingInfo) return null;

  // Prefer produce-seeds for name + category (cleaner display strings),
  // fall back to crop-growing-data
  const name = produceItem?.name || growingInfo?.name || cropId;
  const category = produceItem?.category || growingInfo?.category || 'other';

  return {
    id: cropId,
    name,
    category,
    image: produceItem?.image || null,
    seasonStart: produceItem?.seasonStart ?? null,
    seasonEnd: produceItem?.seasonEnd ?? null,
    tags: produceItem?.tags || [],
    daysToMaturity: growingInfo?.daysToMaturity || null,
    isPerennial: growingInfo?.isPerennial || false,
    hasBoltingData: !!(growingInfo as unknown as { bolting?: unknown })?.bolting,
    hasPruningData: !!((growingInfo as unknown as { pruning?: unknown[] })?.pruning?.length),
  };
}

/**
 * Resolve a listing's display image. Single source of truth used by both
 * buyer-side `lib/listingData.ts` and seller-side `useSellerListings.ts`
 * — Doug's principle (Apr 28 2026): the two surfaces must stay in sync.
 *
 * Priority:
 *   1. The seller's uploaded photo for this specific listing
 *   2. The catalog photo for the produce ID (e.g. basil-default.jpg)
 *   3. null — caller renders an emoji or other fallback
 *
 * @param data Parsed listing metadata. Both `images` (array of IPFS hashes
 *             or URLs) and `produceId` (catalog key like "basil") are
 *             read; missing fields are tolerated.
 * @param resolveImageRef A function that converts an IPFS hash or http URL
 *             to a usable display URL. Different consumers have different
 *             gateway preferences, so the resolver is injected.
 */
export function resolveListingImage(
  data: { images?: unknown[]; produceId?: string },
  resolveImageRef: (ref: string | null | undefined) => string | null,
): string | null {
  const uploaded = resolveImageRef(data.images?.[0] as string | null | undefined);
  if (uploaded) return uploaded;
  if (data.produceId) {
    return getCatalogItem(data.produceId)?.image ?? null;
  }
  return null;
}
