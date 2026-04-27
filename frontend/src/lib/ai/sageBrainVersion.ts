/**
 * Sage Brain Version — single source of truth for forcing conversation
 * resets when we ship Sage upgrades.
 *
 * BUMP THIS WHENEVER YOU:
 *   - Add or change action verbs in gardenActions.ts
 *   - Restructure the system prompt (new sections, behavior rules)
 *   - Change knowledge files (app-knowledge.json, regional/*, crop data
 *     in ways that materially alter Sage's answers)
 *   - Swap the model (e.g. Claude ↔ Venice)
 *   - Fix a fabrication or priming bug where stale conversation context
 *     would keep poisoning new responses
 *
 * On bump:
 *   - GET /api/garden-ai reads stored conversation, sees version mismatch,
 *     deletes the conversation from KV, returns reset:true to client.
 *   - GardenAIChat.tsx hydration sees the same mismatch in localStorage
 *     and clears local state, shows the "Sage learned some new things"
 *     banner over the empty chat.
 *   - Memories survive (they're user-owned facts), only the
 *     back-and-forth conversation gets a fresh start.
 *
 * Format: YYYY-MM-DD-short-slug. Date is what matters; slug is for grep.
 */
export const SAGE_BRAIN_VERSION = '2026-04-27-harvest-prep';
