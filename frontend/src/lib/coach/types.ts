/**
 * Sage Coach — shared types. Mirrors the Hans Coach schema
 * (undercontract/src/lib/coach/review.ts) adapted for LR's KV storage and
 * gardening domain.
 */

export const FINDING_TYPES = [
  'advice_error',       // horticulturally wrong advice — the 100%-accuracy domain
  'fabrication',        // invented garden data not in context (plant/date/count)
  'repetition',         // same/filler question repeated — the disengagement driver
  'ignored_instruction', // user said stop X, Sage kept going
  'persona_slip',       // chatbot reflexes, scripted openers, empty enthusiasm
  'knowledge_gap',      // lacked gardening knowledge the user expected
  'user_correction',    // user corrected Sage
  'friction',           // user repeated self / disengaged / abandoned
  'feature_request',    // verb the user reached for that Sage couldn't do
  'delight',            // a moment that worked — protection target
] as const
export type FindingType = (typeof FINDING_TYPES)[number]

export type Severity = 'low' | 'medium' | 'high'

/** Distilled minimal replay case — the L3 eval asset, banked from L2 onward. */
export interface CoachReproCase {
  transcript_excerpt: string
  expected_behavior: string
  forbidden_behavior?: string | null
  context_notes?: string | null
}

/** L2 "Brain PR": a concrete global prompt-rule patch, human-reviewed, never auto-applied. */
export interface CoachBrainProposal {
  proposed_rule: string
  placement_hint?: string | null
  rationale?: string | null
  /** Set when the behavior is ALREADY covered by an existing rule — then this
   *  is model non-compliance / regression evidence, NOT a new-rule proposal. */
  already_covered_by?: string | null
}

/** L2.5 safe-channel auto-memory: a per-user suppression/preference fact. */
export interface CoachAutoMemory {
  fact: string
}

/** What the analyst LLM returns per finding. */
export interface CoachFinding {
  finding_type: FindingType
  severity: Severity
  evidence: string
  suggestion: string
  repro_case?: CoachReproCase | null
  brain_proposal?: CoachBrainProposal | null
  auto_memory?: CoachAutoMemory | null
}

/** A finding enriched with the conversation it came from. */
export interface StoredFinding extends CoachFinding {
  userId: string
  /** Truncated display label — a DID is not human-friendly; we shorten it. */
  userLabel: string
  ref: string // `conversation:{did}`
  digestDate: string
}

/** A conversation prepared for review. */
export interface ConversationBundle {
  userId: string
  userLabel: string
  ref: string
  transcript: string
  updatedAt: string
}

/** Persisted repro case (the L3 bank). */
export interface StoredReproCase extends CoachReproCase {
  id: string
  kind: 'failure' | 'delight'
  finding_type: FindingType
  userId: string
  createdAt: string
  status: 'active' | 'retired'
}

/** Persisted brain proposal (the L2 review queue). */
export interface StoredBrainProposal {
  id: string
  proposed_rule: string
  placement_hint: string | null
  rationale: string | null
  finding_type: FindingType
  evidence: string
  repro_excerpt: string | null
  status: 'proposed' | 'approved' | 'applied' | 'rejected'
  createdAt: string
  reviewedAt?: string | null
  appliedInVersion?: string | null
}

/** Audit record of an L2.5 auto-memory write. */
export interface StoredMemWrite {
  userId: string
  userLabel: string
  fact: string
  createdAt: string
  revertedAt?: string | null
}

/** The rendered nightly digest, stored for the admin tab. */
export interface CoachDigest {
  date: string
  reviewed: number
  findingsCount: number
  delightsCount: number
  proposalsCount: number
  memWritesCount: number
  reproBankedCount: number
  html: string
  generatedAt: string
}
