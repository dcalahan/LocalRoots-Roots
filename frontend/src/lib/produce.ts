import produceData from '@/../../data/produce-seeds.json';

export interface ProduceItem {
  id: string;
  name: string;
  category: string;
  seasonStart: number;
  seasonEnd: number;
  image: string;
  tags: string[];
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
