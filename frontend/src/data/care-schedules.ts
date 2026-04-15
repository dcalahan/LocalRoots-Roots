/**
 * Care schedules — bolting timings and pruning rules per crop.
 *
 * Kept as a small TS module (not JSON) to avoid bloating the main crop
 * database and to keep this feature self-contained.
 */

export interface BoltingInfo {
  /** Days after planting when bolting commonly begins */
  daysToBoltMin: number;
  /** Days after planting when bolting is nearly inevitable */
  daysToBoltMax: number;
  /** Temperature (°F) above which bolting accelerates */
  heatTriggerF?: number;
  /** Primary trigger — helps Sage give the right advice */
  trigger: 'heat' | 'daylength' | 'age';
  /** Specific actionable advice for this crop */
  advice: string;
}

export type PruningType =
  | 'pinch-top'
  | 'sucker'
  | 'cutback'
  | 'deadhead'
  | 'shape';

export interface PruningRule {
  /** Days after planting when this rule first applies */
  triggerDays: number;
  type: PruningType;
  title: string;
  message: string;
  actionHint: string;
  /** Recur every N days after first trigger */
  recurringDays: number;
}

export const BOLTING_DATA: Record<string, BoltingInfo> = {
  'cilantro': {
    daysToBoltMin: 45, daysToBoltMax: 60, heatTriggerF: 75, trigger: 'heat',
    advice: 'Harvest now. Cilantro flowers are edible (they become coriander seed) — let some go to seed for a free future crop.',
  },
  'lettuce-romaine': {
    daysToBoltMin: 55, daysToBoltMax: 75, heatTriggerF: 80, trigger: 'heat',
    advice: 'Harvest whole heads now. Leaves turn bitter within days once the stalk shoots up.',
  },
  'lettuce-butterhead': {
    daysToBoltMin: 55, daysToBoltMax: 75, heatTriggerF: 80, trigger: 'heat',
    advice: 'Harvest whole heads now. Leaves turn bitter within days.',
  },
  'lettuce-leaf': {
    daysToBoltMin: 50, daysToBoltMax: 70, heatTriggerF: 80, trigger: 'heat',
    advice: 'Harvest now. Succession-plant a heat-tolerant variety if it is still hot.',
  },
  'spinach': {
    daysToBoltMin: 45, daysToBoltMax: 65, heatTriggerF: 75, trigger: 'daylength',
    advice: 'Harvest all leaves now. Spinach bolts on long days regardless of heat.',
  },
  'arugula': {
    daysToBoltMin: 40, daysToBoltMax: 55, heatTriggerF: 75, trigger: 'heat',
    advice: 'Pull whole plants and use the flowers — they are peppery and great in salads.',
  },
  'basil': {
    daysToBoltMin: 75, daysToBoltMax: 100, trigger: 'age',
    advice: 'Pinch flower buds as they form to keep leaves coming. Once fully bolted, harvest the whole plant.',
  },
  'broccoli': {
    daysToBoltMin: 70, daysToBoltMax: 90, heatTriggerF: 80, trigger: 'heat',
    advice: 'Harvest the central head now, before the buds open into yellow flowers. Side shoots will keep coming.',
  },
  'bok-choy': {
    daysToBoltMin: 50, daysToBoltMax: 65, heatTriggerF: 75, trigger: 'heat',
    advice: 'Harvest whole plants now — quality drops fast after bolting starts.',
  },
  'radish': {
    daysToBoltMin: 40, daysToBoltMax: 55, heatTriggerF: 80, trigger: 'heat',
    advice: 'Pull any remaining radishes — the roots turn woody once the plant bolts.',
  },
  'dill': {
    daysToBoltMin: 60, daysToBoltMax: 80, trigger: 'age',
    advice: 'Let some plants flower for dill seed (and pollinators). Succession-sow for continuous fresh fronds.',
  },
};

export const PRUNING_DATA: Record<string, PruningRule[]> = {
  'basil': [{
    triggerDays: 21, type: 'pinch-top',
    title: 'Time to pinch your basil',
    message: 'Your basil has about 4 leaf pairs — pinching the top now doubles the harvest.',
    actionHint: 'Cut just above the 2nd leaf pair from the top. Use the trimmings in tonight\'s dinner.',
    recurringDays: 14,
  }],
  'tomato-cherry': [{
    triggerDays: 30, type: 'sucker',
    title: 'Sucker your tomatoes',
    message: 'Pinch out the small shoots in the crotch between stem and branches to focus energy on fruit.',
    actionHint: 'Snap off suckers when they are under 4 inches. Larger suckers can be rooted into new plants.',
    recurringDays: 10,
  }],
  'tomato-beefsteak': [{
    triggerDays: 30, type: 'sucker',
    title: 'Sucker your tomatoes',
    message: 'Indeterminate tomatoes need weekly suckering to keep fruit size up.',
    actionHint: 'Snap off side shoots below the first flower cluster. Keep 1–2 main stems.',
    recurringDays: 10,
  }],
  'mint': [{
    triggerDays: 45, type: 'cutback',
    title: 'Cut back your mint',
    message: 'A hard cutback keeps mint tender and prevents it from going woody and flowering.',
    actionHint: 'Cut the whole plant back by half. It will bounce back in about 10 days.',
    recurringDays: 30,
  }],
  'oregano': [{
    triggerDays: 45, type: 'cutback',
    title: 'Cut back your oregano',
    message: 'Regular cutbacks keep oregano leafy instead of going to flower.',
    actionHint: 'Cut back by a third. Dry the trimmings for winter.',
    recurringDays: 30,
  }],
  'thyme': [{
    triggerDays: 45, type: 'cutback',
    title: 'Light trim for your thyme',
    message: 'Thyme gets woody without regular trimming.',
    actionHint: 'Snip the top third of each stem. Avoid cutting into hard wood.',
    recurringDays: 30,
  }],
  'rosemary': [{
    triggerDays: 60, type: 'shape',
    title: 'Shape your rosemary',
    message: 'A light shaping keeps rosemary productive and prevents leggy growth.',
    actionHint: 'Trim up to a third of new green growth. Never cut into bare brown wood.',
    recurringDays: 60,
  }],
  'pepper-bell-green': [{
    triggerDays: 21, type: 'pinch-top',
    title: 'Top your pepper plants (optional)',
    message: 'Pinching the growing tip early makes bushier plants with more peppers.',
    actionHint: 'Pinch off the very top set of leaves once plant is ~8 inches tall.',
    recurringDays: 999,
  }],
  'cucumber': [{
    triggerDays: 30, type: 'pinch-top',
    title: 'Pinch cucumber side shoots',
    message: 'Pinching early side shoots on vining cukes keeps energy in the main vine.',
    actionHint: 'Pinch any side shoots below the first 4–5 leaves.',
    recurringDays: 999,
  }],
};

export function getBoltingInfo(cropId: string): BoltingInfo | null {
  return BOLTING_DATA[cropId] ?? null;
}

export function getPruningRules(cropId: string): PruningRule[] {
  return PRUNING_DATA[cropId] ?? [];
}
