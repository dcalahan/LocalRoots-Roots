/**
 * My Garden — Personal garden tracking types
 */

export type PlantingMethod = 'direct-sow' | 'transplant' | 'start-indoors';

export type PlantStatus =
  | 'seedling'          // 0–25% of maturity
  | 'growing'           // 25–75% of maturity
  | 'near-harvest'      // 75–90% of maturity (sell nudge appears)
  | 'ready-to-harvest'  // 90–100% of maturity
  | 'harvesting'        // past maturity, within harvest window
  | 'done'              // past harvest window or manually marked
  | 'overwintering'     // perennial outside growing season
  | 'bolt-risk'         // approaching bolting window
  | 'bolting'           // actively bolting — harvest immediately
  | 'needs-pruning';    // pruning rule triggered

export type CareAlertType =
  | 'bolt-risk'
  | 'bolting'
  | 'prune-now'
  | 'prune-overdue'
  | 'frost-warning'
  | 'heat-wave'
  | 'harvest-urgent'
  | 'harvest-ready';

export type CareAlertSeverity = 'info' | 'soon' | 'urgent' | 'critical';

export interface CareAlert {
  /** Stable id: hash of plantId + type + cycle. Used for dedupe and dismissal. */
  id: string;
  plantId: string;
  cropId: string;
  type: CareAlertType;
  severity: CareAlertSeverity;
  title: string;
  message: string;
  actionHint?: string;
  /** Show a "List for sale" CTA — true only for bolting / harvest-urgent */
  sellRamp?: boolean;
  /** True when the alert was elevated or created by weather */
  weatherDriven?: boolean;
  createdAt: string;
  dismissedAt?: string;
}

export type BedType =
  | 'raised-bed'
  | 'in-ground'
  | 'tower'
  | 'container'
  | 'greenhouse'
  | 'other';

export interface GardenBed {
  id: string;            // uuid
  name: string;          // "Bed 1", "Tower", "Front Yard"
  type: BedType;
  photoUrl?: string;     // gateway URL to view
  photoIpfs?: string;    // IPFS CID for portability
  widthInches?: number;
  lengthInches?: number;
  notes?: string;
  createdAt: string;     // ISO date
  order: number;         // display order
}

export interface GardenPlant {
  id: string;                    // uuid
  cropId: string;                // key into crop-growing-data.json (e.g. "tomato-cherry")
  customVarietyName?: string;    // e.g. "Better Boy", "Mojito Mint" — display instead of generic name
  plantingDate: string;          // ISO date (when planted)
  quantity: number;              // how many plants
  plantingMethod: PlantingMethod;
  bedId?: string;                // optional — assigns plant to a GardenBed
  location?: string;             // legacy free text: "raised bed #2", "back patio"
  notes?: string;                // free text
  isPerennial: boolean;          // copied from crop data at add time
  orderInBed?: number;            // custom display order within a bed
  manualStatus?: PlantStatus;    // user override (died, harvested early, etc.)
  harvestedDate?: string;        // when user marked as harvested
  removedDate?: string;          // when user removed from garden
  createdAt: string;             // ISO date
  year: number;                  // growing season year
}

export interface MyGardenData {
  version: 1 | 2;
  plants: GardenPlant[];
  beds?: GardenBed[];            // v2+
}

/** Actions the AI can trigger to update the garden */
export type GardenActionType =
  | 'add_plant'
  | 'remove_plant'
  | 'mark_harvested'
  | 'update_plant'
  | 'add_bed'
  | 'update_bed'
  | 'delete_bed'
  | 'assign_plant_to_bed'
  // ─── Care-alert execution (Sage acts on bolting/pruning/harvest in chat) ─
  | 'mark_pruned'         // user pruned/pinched/suckered — dismiss this cycle
  | 'mark_bolting'        // user said a plant is bolting — set manualStatus
  | 'dismiss_care_alert'; // user said "stop reminding me about X" — dismiss this cycle

export interface GardenAction {
  action: GardenActionType;
  cropId?: string;
  quantity?: number;
  plantingDate?: string;
  method?: PlantingMethod;
  location?: string;
  notes?: string;
  reason?: string;
  field?: string;
  value?: string;
  // bed-related
  customVarietyName?: string;  // variety name from AI extraction
  bedId?: string;
  bedName?: string;     // fuzzy match target for AI ("Bed 1", "Tower")
  bedType?: BedType;
  widthInches?: number;
  lengthInches?: number;
  // care-alert related
  alertType?: CareAlertType;  // for dismiss_care_alert — which alert family to dismiss
}

/** Community-shared plant varieties added by users. */
export interface CommunityVariety {
  id: string;                   // slug: "better-boy-tomato"
  name: string;                 // "Better Boy Tomato"
  parentCropId: string;         // "tomato-beefsteak"
  addedBy: string;              // userId
  addedAt: string;
  useCount: number;
  description?: string;         // AI-enriched
  maturityAdjustment?: number;  // days +/- from parent
}
