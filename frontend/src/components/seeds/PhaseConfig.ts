// Phase 1 configuration constants

// Phase 1 launch date (November 1, 2026)
export const PHASE1_LAUNCH = new Date('2026-11-01T00:00:00Z');
export const DAY_90 = new Date(PHASE1_LAUNCH.getTime() + 90 * 24 * 60 * 60 * 1000);
export const DAY_180 = new Date(PHASE1_LAUNCH.getTime() + 180 * 24 * 60 * 60 * 1000);

// Seeds rates
export const SEEDS_PER_DOLLAR_SELLER = 500;
export const SEEDS_PER_DOLLAR_BUYER = 50;
export const AMBASSADOR_COMMISSION_PERCENT = 25;
export const AMBASSADOR_RECRUITMENT_BONUS = 2500;

// Seller milestones
export const SELLER_MILESTONES = [
  { name: 'First listing', seeds: 50, requirement: 'Create your first listing' },
  { name: 'First sale', seeds: 10000, requirement: 'Complete your first sale' },
  { name: '5 sales', seeds: 25000, requirement: 'Complete 5 sales' },
  { name: '15 sales', seeds: 50000, requirement: 'Complete 15 sales' },
];

// Seller Tiers (based on completed sales)
export interface SellerTier {
  name: string;
  minSales: number;
  emoji: string;
  color: string;
  bgColor: string;
  borderColor: string;
  description: string;
}

export const SELLER_TIERS: SellerTier[] = [
  {
    name: 'Seedling',
    minSales: 0,
    emoji: '🌱',
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    description: 'Just getting started'
  },
  {
    name: 'Sprout',
    minSales: 1,
    emoji: '🌿',
    color: 'text-green-700',
    bgColor: 'bg-green-100',
    borderColor: 'border-green-300',
    description: 'Made your first sale!'
  },
  {
    name: 'Grower',
    minSales: 5,
    emoji: '🪴',
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-300',
    description: 'Building momentum'
  },
  {
    name: 'Harvester',
    minSales: 15,
    emoji: '🌻',
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-300',
    description: 'Trusted by the community'
  },
  {
    name: 'Master Gardener',
    minSales: 50,
    emoji: '🌳',
    color: 'text-amber-700',
    bgColor: 'bg-amber-100',
    borderColor: 'border-amber-400',
    description: 'Local legend'
  },
];

export function getSellerTier(completedSales: number): SellerTier {
  // Find the highest tier the seller qualifies for
  for (let i = SELLER_TIERS.length - 1; i >= 0; i--) {
    if (completedSales >= SELLER_TIERS[i].minSales) {
      return SELLER_TIERS[i];
    }
  }
  return SELLER_TIERS[0];
}

export function getNextSellerTier(completedSales: number): SellerTier | null {
  const currentTier = getSellerTier(completedSales);
  const currentIndex = SELLER_TIERS.findIndex(t => t.name === currentTier.name);
  if (currentIndex < SELLER_TIERS.length - 1) {
    return SELLER_TIERS[currentIndex + 1];
  }
  return null;
}

// Ambassador Tiers (based on recruited sellers)
export interface AmbassadorTier {
  name: string;
  minRecruits: number;
  emoji: string;
  color: string;
  bgColor: string;
  borderColor: string;
  description: string;
}

export const AMBASSADOR_TIERS: AmbassadorTier[] = [
  {
    name: 'Scout',
    minRecruits: 0,
    emoji: '🔍',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    description: 'Finding new farmers'
  },
  {
    name: 'Connector',
    minRecruits: 1,
    emoji: '🤝',
    color: 'text-blue-700',
    bgColor: 'bg-blue-100',
    borderColor: 'border-blue-300',
    description: 'First farmer recruited!'
  },
  {
    name: 'Community Builder',
    minRecruits: 5,
    emoji: '🏘️',
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50',
    borderColor: 'border-indigo-300',
    description: 'Growing the network'
  },
  {
    name: 'Regional Champion',
    minRecruits: 15,
    emoji: '🏆',
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-300',
    description: 'Local food champion'
  },
  {
    name: 'Local Roots Legend',
    minRecruits: 50,
    emoji: '👑',
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-400',
    description: 'Movement leader'
  },
];

export function getAmbassadorTier(recruitedSellers: number): AmbassadorTier {
  for (let i = AMBASSADOR_TIERS.length - 1; i >= 0; i--) {
    if (recruitedSellers >= AMBASSADOR_TIERS[i].minRecruits) {
      return AMBASSADOR_TIERS[i];
    }
  }
  return AMBASSADOR_TIERS[0];
}

export function getNextAmbassadorTier(recruitedSellers: number): AmbassadorTier | null {
  const currentTier = getAmbassadorTier(recruitedSellers);
  const currentIndex = AMBASSADOR_TIERS.findIndex(t => t.name === currentTier.name);
  if (currentIndex < AMBASSADOR_TIERS.length - 1) {
    return AMBASSADOR_TIERS[currentIndex + 1];
  }
  return null;
}

export interface MultiplierInfo {
  multiplier: number;
  multiplierDisplay: string;
  daysRemaining: number;
  period: string;
  isActive: boolean;
}

export function getMultiplierInfo(): MultiplierInfo {
  const now = new Date();

  if (now < PHASE1_LAUNCH) {
    const daysUntilLaunch = Math.ceil((PHASE1_LAUNCH.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
    return {
      multiplier: 2.0,
      multiplierDisplay: '2x',
      daysRemaining: daysUntilLaunch + 90,
      period: 'at launch',
      isActive: false
    };
  }

  if (now < DAY_90) {
    const daysRemaining = Math.ceil((DAY_90.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
    return {
      multiplier: 2.0,
      multiplierDisplay: '2x',
      daysRemaining,
      period: 'first 90 days',
      isActive: true
    };
  }

  if (now < DAY_180) {
    const daysRemaining = Math.ceil((DAY_180.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
    return {
      multiplier: 1.5,
      multiplierDisplay: '1.5x',
      daysRemaining,
      period: 'days 91-180',
      isActive: true
    };
  }

  return {
    multiplier: 1.0,
    multiplierDisplay: '1x',
    daysRemaining: 0,
    period: 'standard',
    isActive: false
  };
}

export function calculateSeeds(usdAmount: number, isSeller: boolean): number {
  const baseSeeds = usdAmount * (isSeller ? SEEDS_PER_DOLLAR_SELLER : SEEDS_PER_DOLLAR_BUYER);
  const { multiplier } = getMultiplierInfo();
  return Math.floor(baseSeeds * multiplier);
}

export function formatSeeds(seeds: number): string {
  if (seeds >= 1000000) {
    return (seeds / 1000000).toFixed(1) + 'M';
  }
  if (seeds >= 1000) {
    return (seeds / 1000).toFixed(1) + 'K';
  }
  return seeds.toLocaleString();
}
