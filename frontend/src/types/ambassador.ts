export interface Ambassador {
  address: string;
  name: string;
  registeredAt: number;
  referredBy?: string; // Address of ambassador who recruited them
}

export interface PendingGrower {
  id: string;
  claimCode: string;
  gardenName: string;
  farmerName: string;
  photoUrl: string; // base64 or blob URL for now
  location: string;
  createdAt: number;
  ambassadorAddress: string;
  claimed: boolean;
  claimedAt?: number;
  claimedByAddress?: string;
}

export interface AmbassadorStats {
  totalGrowersOnboarded: number;
  pendingGrowers: number;
  activeGrowers: number;
  totalEarnings: bigint;
  ambassadorsRecruited: number;
}
