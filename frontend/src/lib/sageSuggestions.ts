/**
 * Sage App Suggestions — extraction prompt, parser, and KV storage helpers.
 *
 * Parallel to gardenActions.ts but for meta-feedback (bugs/ideas/friction)
 * rather than garden state changes. Runs as a separate Haiku call inside
 * the garden-ai route's `after()` block — fully async, never blocks the
 * user's response.
 *
 * Capture is gated on EXPLICIT user confirmation in the conversation:
 *   1. user expresses a suggestion / bug / friction
 *   2. assistant offers to log it for the team
 *   3. user confirms ("yes", "please do", "go ahead", etc.)
 *   4. assistant confirms with phrase like "noted for the team"
 *
 * Only when all four steps occurred does the extraction return non-null.
 */

import type { AIMessage } from '@/lib/ai-runtime/types';
import { kv } from './kv';
import type {
  SageSuggestion,
  SuggestionArea,
  SuggestionCategory,
  SuggestionSeverity,
  SuggestionStatus,
} from '@/types/sage-suggestion';

// ─── KV keys ───────────────────────────────────────────────

const KV_RECORD = 'sage:suggestion:';
const KV_INDEX = 'sage:suggestions:index';
const KV_RATE = 'sage:suggestions:rate:';

function kvKeyFor(id: string): string {
  return `${KV_RECORD}${id}`;
}

function rateKey(userKey: string, dateYYYYMMDD: string): string {
  return `${KV_RATE}${userKey}:${dateYYYYMMDD}`;
}

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '');
}

// ─── Heuristic prefilter ───────────────────────────────────

/**
 * Cheap check before we spend a Haiku call. Looks at Sage's last reply for
 * a confirmation phrase. If absent, no chance a capture happened — skip.
 */
export function shouldRunSuggestionExtraction(
  recentMessages: AIMessage[],
): boolean {
  // Find the last assistant message
  const lastAssistant = [...recentMessages]
    .reverse()
    .find(m => m.role === 'assistant');
  if (!lastAssistant) return false;

  const text =
    typeof lastAssistant.content === 'string'
      ? lastAssistant.content
      : lastAssistant.content
          .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
          .map(c => c.text)
          .join(' ');

  const lower = text.toLowerCase();
  return (
    lower.includes('noted for the team') ||
    lower.includes('passed along') ||
    lower.includes('passing it along') ||
    lower.includes('passed it along') ||
    lower.includes('logged for the team') ||
    lower.includes("i've noted") ||
    lower.includes('ive noted') ||
    lower.includes('noted this for the team')
  );
}

// ─── Extraction prompt ─────────────────────────────────────

export function buildSuggestionExtractionPrompt(
  recentMessages: AIMessage[],
): string {
  const conversation = recentMessages
    .map(m => {
      const text =
        typeof m.content === 'string'
          ? m.content
          : m.content
              .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
              .map(c => c.text)
              .join(' ') || '[image]';
      return `${m.role}: ${text}`;
    })
    .join('\n');

  return `You extract user feedback from conversations between a user and an AI gardening assistant named Sage.

Sage has the ability to forward suggestions, bug reports, and feature requests to the LocalRoots dev team — but ONLY when the user explicitly confirms.

Look at the conversation below and determine if ALL FOUR of these things happened:
  1. The user expressed an idea, friction, bug, or feature request
  2. Sage offered to pass it to the team
  3. The user EXPLICITLY confirmed ("yes", "yes please", "sure", "go ahead", "do it", "absolutely", etc.)
  4. Sage confirmed it was logged (phrases like "noted for the team", "passed along", "I've noted")

If ALL FOUR happened, return a JSON object with these fields:
  - userQuote: the user's original message that expressed the idea (the FIRST one, not the confirmation). Trim to 500 chars.
  - sageSummary: one-line distillation of what the user wants. Imperative voice ("Add X", "Fix Y", "Make Z work like..."). Under 200 chars.
  - category: one of "bug" | "friction" | "feature" | "praise" | "question"
  - area: one of "grow" | "sell" | "buy" | "ambassador" | "sage" | "general"
  - severity: one of "low" | "medium" | "high"

Category guidance:
  - bug: something is broken or doesn't work
  - friction: something works but is hard/annoying to use
  - feature: brand-new capability they want
  - praise: positive feedback worth recording
  - question: pattern of questions that suggests missing docs or UI

Area guidance:
  - grow: planting, calendar, guides, My Garden, plant tracking
  - sell: seller dashboard, listings, earnings, fulfillment
  - buy: shop, cart, checkout, orders
  - ambassador: ambassador dashboard, recruiting, payments
  - sage: the AI chat itself (Sage's behavior, voice, knowledge)
  - general: anything else (homepage, navigation, accounts)

Severity guidance:
  - low: minor polish, nice-to-have
  - medium: noticeable friction, real value
  - high: blocking the user, data loss, security concern, or strong product signal

If ANY of the four steps did NOT happen, return null. Be strict — false positives are worse than misses.

CONVERSATION:
${conversation}

Return ONLY the JSON object or the literal word null. No prose, no markdown.

Examples:
{"userQuote":"I wish My Garden could auto-detect plants from photos","sageSummary":"Auto-detect plants from photos in My Garden","category":"feature","area":"grow","severity":"medium"}
{"userQuote":"Photos kept failing on my iPhone — never saw an error","sageSummary":"Photo upload fails silently on iOS Safari","category":"bug","area":"sage","severity":"high"}
null

Output:`;
}

// ─── Parser ────────────────────────────────────────────────

export interface ExtractedSuggestion {
  userQuote: string;
  sageSummary: string;
  category: SuggestionCategory;
  area: SuggestionArea;
  severity: SuggestionSeverity;
}

const VALID_CATEGORIES: SuggestionCategory[] = [
  'bug',
  'friction',
  'feature',
  'praise',
  'question',
];
const VALID_AREAS: SuggestionArea[] = [
  'grow',
  'sell',
  'buy',
  'ambassador',
  'sage',
  'general',
];
const VALID_SEVERITIES: SuggestionSeverity[] = ['low', 'medium', 'high'];

function stripHtml(s: string): string {
  return s.replace(/<[^>]*>/g, '');
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max).trim() + '…' : s;
}

export function parseSuggestion(response: string): ExtractedSuggestion | null {
  try {
    const trimmed = response.trim();
    if (
      trimmed === 'null' ||
      trimmed === 'NULL' ||
      trimmed === '' ||
      trimmed === '[]'
    ) {
      return null;
    }

    // Find first { and matching closing brace
    const start = trimmed.indexOf('{');
    if (start === -1) return null;
    const candidate = trimmed.slice(start);
    const end = candidate.lastIndexOf('}');
    if (end === -1) return null;
    const json = candidate.slice(0, end + 1);

    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== 'object') return null;

    const {
      userQuote,
      sageSummary,
      category,
      area,
      severity,
    } = parsed as Record<string, unknown>;

    if (typeof userQuote !== 'string' || !userQuote.trim()) return null;
    if (typeof sageSummary !== 'string' || !sageSummary.trim()) return null;
    if (
      typeof category !== 'string' ||
      !VALID_CATEGORIES.includes(category as SuggestionCategory)
    ) {
      return null;
    }
    if (
      typeof area !== 'string' ||
      !VALID_AREAS.includes(area as SuggestionArea)
    ) {
      return null;
    }
    if (
      typeof severity !== 'string' ||
      !VALID_SEVERITIES.includes(severity as SuggestionSeverity)
    ) {
      return null;
    }

    return {
      userQuote: truncate(stripHtml(userQuote.trim()), 2000),
      sageSummary: truncate(stripHtml(sageSummary.trim()), 2000),
      category: category as SuggestionCategory,
      area: area as SuggestionArea,
      severity: severity as SuggestionSeverity,
    };
  } catch {
    return null;
  }
}

// ─── KV helpers ────────────────────────────────────────────

/**
 * Save a new suggestion to KV. Rate-limits at 5/user/day.
 * Returns the saved suggestion (with id), or null if rate-limited.
 */
export async function saveSuggestion(
  extracted: ExtractedSuggestion,
  userId: string | null,
  /** Anonymous fallback key (e.g., IP). Used only when userId is null. */
  anonKey: string | null,
): Promise<SageSuggestion | null> {
  const userKey = userId || (anonKey ? `anon:${anonKey}` : 'anon:unknown');
  const today = todayUTC();
  const counterKey = rateKey(userKey, today);

  // Check rate limit (5/day)
  try {
    const current = await kv.get<number>(counterKey);
    if (typeof current === 'number' && current >= 5) {
      console.warn(
        '[sage-suggestions] rate-limited:',
        userKey,
        'count:',
        current,
      );
      return null;
    }
    // Increment counter (TTL 24h via SET + EXPIRE — kv module doesn't expose
    // EXPIRE so we just set and let it grow; date-keyed so it auto-rotates
    // and old keys go stale within ~30 days of inactivity).
    await kv.set(counterKey, (current || 0) + 1);
  } catch (err) {
    console.warn(
      '[sage-suggestions] rate check failed (allowing through):',
      err,
    );
  }

  const id = crypto.randomUUID();
  const suggestion: SageSuggestion = {
    id,
    userId,
    userQuote: extracted.userQuote,
    sageSummary: extracted.sageSummary,
    category: extracted.category,
    area: extracted.area,
    severity: extracted.severity,
    status: 'new',
    createdAt: new Date().toISOString(),
  };

  // Write the record
  await kv.set(kvKeyFor(id), suggestion);

  // Prepend to index (newest first)
  try {
    const idx = (await kv.get<string[]>(KV_INDEX)) || [];
    idx.unshift(id);
    // Cap index growth — keep last 1000. Older records remain reachable
    // via direct key if needed.
    await kv.set(KV_INDEX, idx.slice(0, 1000));
  } catch (err) {
    console.error('[sage-suggestions] index update failed:', err);
  }

  console.log(
    '[sage-suggestions] captured:',
    id,
    extracted.category,
    extracted.area,
    extracted.severity,
    `"${extracted.sageSummary.slice(0, 80)}"`,
  );

  return suggestion;
}

/** List suggestions, newest first. */
export async function listSuggestions(
  limit = 100,
  offset = 0,
): Promise<SageSuggestion[]> {
  try {
    const idx = (await kv.get<string[]>(KV_INDEX)) || [];
    const slice = idx.slice(offset, offset + limit);
    const fetched = await Promise.all(
      slice.map(id => kv.get<SageSuggestion>(kvKeyFor(id))),
    );
    return fetched.filter((s): s is SageSuggestion => s !== null);
  } catch (err) {
    console.error('[sage-suggestions] list failed:', err);
    return [];
  }
}

/** Update an existing suggestion (status / notes / reviewer). */
export async function updateSuggestion(
  id: string,
  patch: Partial<
    Pick<SageSuggestion, 'status' | 'notes' | 'reviewedBy' | 'reviewedAt'>
  >,
): Promise<SageSuggestion | null> {
  const existing = await kv.get<SageSuggestion>(kvKeyFor(id));
  if (!existing) return null;
  const updated: SageSuggestion = { ...existing, ...patch };
  await kv.set(kvKeyFor(id), updated);
  return updated;
}

/** Get a single suggestion. */
export async function getSuggestion(id: string): Promise<SageSuggestion | null> {
  return kv.get<SageSuggestion>(kvKeyFor(id));
}
