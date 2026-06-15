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

/**
 * How a crop is harvested — drives whether `mark_harvested` ends the plant
 * or just logs an event. Tagged per-crop in crop-growing-data.json.
 *
 *  - single              one harvest = plant done (head lettuce, radish, garlic)
 *  - continuous          pick one fruit/pod at a time, plant keeps producing (tomato, pepper)
 *  - cut-and-come-again  cut leaves/stems, plant regrows (kale, chard, loose-leaf lettuce)
 *  - pinch               pinch growing tips, plant gets bushier (basil, mint, oregano)
 *  - ambiguous           Sage asks ("was that the last of it?") — cabbage, broccoli
 */
export type HarvestPattern =
  | 'single'
  | 'continuous'
  | 'cut-and-come-again'
  | 'pinch'
  | 'ambiguous';

/** A single harvest event on a plant. Plants accumulate these in `harvestEvents`. */
export interface HarvestEvent {
  date: string;        // ISO date (when picked)
  quantity?: number;   // optional — Sage extracts when natural, UI offers but doesn't enforce
  unit?: 'count' | 'lb' | 'oz' | 'bunch';
  notes?: string;
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
  /** Running log of every harvest event. Plant stays active while populated;
   *  `harvestedDate` is only set when the plant is truly finished (single-
   *  harvest crops, or the user explicitly ends a continuous-bearing plant). */
  harvestEvents?: HarvestEvent[];
  /** Set when the plant is FINISHED — terminal state. For single-harvest
   *  crops this is set on the first harvest; for continuous crops it's set
   *  only via the explicit "end this plant" action. */
  harvestedDate?: string;
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
  // mark_harvested logs a HarvestEvent. The plant stays active UNLESS the
  // crop's harvestPattern is 'single' (head lettuce, radish, garlic, etc.),
  // in which case harvestedDate is also set. Continuous-bearing crops
  // (tomato, pepper, basil, kale) keep producing — only mark_plant_finished
  // ends them.
  | 'mark_harvested'
  // Explicit "I'm done with this plant" — sets harvestedDate regardless of
  // crop pattern. Triggered by user intent ("I pulled the tomatoes",
  // "the basil is done for the season") OR the "End this plant" UI button.
  | 'mark_plant_finished'
  | 'update_plant'
  | 'add_bed'
  | 'update_bed'
  | 'delete_bed'
  | 'assign_plant_to_bed'
  // ─── Care-alert execution (Sage acts on bolting/pruning/harvest in chat) ─
  | 'mark_pruned'         // user pruned/pinched/suckered — dismiss this cycle
  | 'mark_bolting'        // user said a plant is bolting — set manualStatus
  | 'dismiss_care_alert'  // user said "stop reminding me about X" — dismiss this cycle
  // ─── Sell from chat (V2.5 — Sage drafts, user signs) ───
  | 'create_listing_draft'; // user said "list my X for sale" — route to listing form prefilled

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
