/**
 * Action block parser for AI responses.
 *
 * AI models output inline action blocks in the format:
 *   <<<ACTION:type>>>JSON<<<END_ACTION>>>
 *
 * The parser extracts these blocks, returning clean display text
 * and an array of parsed actions for the product's executor.
 *
 * Extracted from UnderContract/Ask Hans's actions.ts (lines 46-73).
 * The executor (850+ lines in Hans) stays in each product.
 */

import type { ParsedAction } from './types'

const ACTION_REGEX = /<<<ACTION:(\w+)>>>\s*([\s\S]*?)\s*<<<END_ACTION>>>/g

/**
 * Parse action blocks from AI response text.
 * Returns clean text (action blocks removed) and parsed actions.
 */
export function parseActions<T extends string = string>(
  content: string
): { cleanContent: string; actions: ParsedAction<T>[] } {
  const actions: ParsedAction<T>[] = []
  let cleanContent = content

  let match
  // Reset regex state for each call
  ACTION_REGEX.lastIndex = 0
  while ((match = ACTION_REGEX.exec(content)) !== null) {
    try {
      const type = match[1] as T
      const data = JSON.parse(match[2].trim())
      actions.push({ type, data })
    } catch {
      // Skip malformed action blocks — chat still works
    }
    cleanContent = cleanContent.replace(match[0], '')
  }

  // Clean up extra whitespace left by removed action blocks
  cleanContent = cleanContent.replace(/\n{3,}/g, '\n\n').trim()

  return { cleanContent, actions }
}

/**
 * Sort actions by priority for execution ordering.
 * Lower priority number = executes first.
 * E.g., Hans runs create_client (0) before create_deal (1) before others (10).
 */
export function sortByPriority<T extends string>(
  actions: ParsedAction<T>[],
  priorities: Partial<Record<T, number>>
): ParsedAction<T>[] {
  return [...actions].sort((a, b) => {
    const pa = priorities[a.type] ?? 10
    const pb = priorities[b.type] ?? 10
    return pa - pb
  })
}
