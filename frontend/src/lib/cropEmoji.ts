/**
 * Crop emoji helper — pick a representative emoji for a crop ID.
 * Falls back to category emoji, then a generic seedling.
 */

import { getCropGrowingInfo } from '@/lib/plantingCalendar';

const categoryEmoji: Record<string, string> = {
  nightshades: '🍅',
  cucurbits: '🥒',
  greens: '🥬',
  roots: '🥕',
  alliums: '🧅',
  legumes: '🫘',
  herbs: '🌿',
  brassicas: '🥦',
  berries: '🫐',
  'tree-fruit': '🍎',
  citrus: '🍋',
  grains: '🌽',
};

export function getCropEmoji(cropId: string): string {
  if (cropId.startsWith('tomato')) return '🍅';
  if (cropId.startsWith('pepper')) return '🌶️';
  if (cropId.startsWith('lettuce')) return '🥬';
  if (cropId === 'basil') return '🌿';
  if (cropId === 'mint') return '🌿';
  if (cropId === 'thyme') return '🌿';
  if (cropId === 'rosemary') return '🌿';
  if (cropId === 'chives') return '🧅';
  if (cropId === 'dill') return '🌿';
  if (cropId === 'cucumber' || cropId === 'cucumber-pickling') return '🥒';
  if (cropId === 'corn' || cropId === 'corn-sweet') return '🌽';
  if (cropId === 'strawberry') return '🍓';
  if (cropId === 'blueberry') return '🫐';
  if (cropId === 'carrot') return '🥕';

  const info = getCropGrowingInfo(cropId);
  if (info?.category && categoryEmoji[info.category]) return categoryEmoji[info.category];

  return '🌱';
}
