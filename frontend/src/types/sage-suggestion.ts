/**
 * Sage App Suggestions
 *
 * When users mention friction, ideas, bugs, or feature requests in chat,
 * Sage offers to pass it to the dev team. On user confirmation, the
 * conversation is summarized into a structured suggestion and stored in
 * Vercel KV for the admin to triage.
 *
 * Plan: ~/.claude/plans/zany-meandering-kazoo.md
 */

export type SuggestionCategory =
  | 'bug'
  | 'friction'
  | 'feature'
  | 'praise'
  | 'question';

export type SuggestionArea =
  | 'grow'
  | 'sell'
  | 'buy'
  | 'ambassador'
  | 'sage'
  | 'general';

export type SuggestionSeverity = 'low' | 'medium' | 'high';

export type SuggestionStatus =
  | 'new'
  | 'triaged'
  | 'in_progress'
  | 'shipped'
  | 'wontfix';

export interface SageSuggestion {
  id: string;
  /** Privy ID, or null if user wasn't signed in. */
  userId: string | null;
  /** The exact user message (last user turn) that triggered the capture. */
  userQuote: string;
  /** Sage's one-line distillation of what the user wants. */
  sageSummary: string;
  category: SuggestionCategory;
  area: SuggestionArea;
  severity: SuggestionSeverity;
  status: SuggestionStatus;
  /** ISO 8601 timestamp. */
  createdAt: string;
  reviewedAt?: string;
  /** Admin's wallet address or Privy ID. */
  reviewedBy?: string;
  /** Admin notes added during triage. */
  notes?: string;
}

export const SUGGESTION_CATEGORIES: SuggestionCategory[] = [
  'bug',
  'friction',
  'feature',
  'praise',
  'question',
];

export const SUGGESTION_AREAS: SuggestionArea[] = [
  'grow',
  'sell',
  'buy',
  'ambassador',
  'sage',
  'general',
];

export const SUGGESTION_STATUSES: SuggestionStatus[] = [
  'new',
  'triaged',
  'in_progress',
  'shipped',
  'wontfix',
];
