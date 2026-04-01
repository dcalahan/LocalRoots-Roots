/**
 * Three-layer memory system for AI assistants.
 *
 * Layer 1: Conversation history — windowed to N recent messages, older messages summarized
 * Layer 2: Entity memory — per-user facts extracted async from conversations
 * Layer 3: Product soul — global cross-user learnings injected into every prompt
 *
 * Extracted from UnderContract/Ask Hans's memory.ts (237 lines).
 * Decoupled from Supabase — products handle persistence via Brain interface.
 */

import type {
  AIMessage,
  EntityMemoryConfig,
  MemoryFact,
  Router,
} from './types'
import { getTextContent } from './types'

/**
 * Format memory context for injection into the system prompt.
 * Combines soul text and per-user memories into a prompt block.
 */
export function formatMemoryContext(
  memories: MemoryFact[],
  soul?: string | null
): string {
  let context = ''

  if (soul) {
    context += soul + '\n\n'
  }

  if (memories.length > 0) {
    context +=
      'THINGS YOU REMEMBER ABOUT THIS USER:\n' +
      memories.map((m) => `- ${m.fact}`).join('\n') +
      "\n\nUse this knowledge naturally. Don't mention that you \"remembered\" something — just know it.\n"
  }

  return context
}

/**
 * Extract new facts from recent conversation messages.
 * Runs a fast-tier LLM call and deduplicates against existing memories.
 * Returns only the NEW facts (caller handles persistence via Brain.saveMemories).
 */
export async function extractMemories(
  router: Router,
  config: EntityMemoryConfig,
  recentMessages: AIMessage[],
  existingMemories: MemoryFact[]
): Promise<MemoryFact[]> {
  const existingList =
    existingMemories.length > 0
      ? existingMemories.map((m) => `- ${m.fact}`).join('\n')
      : '(none yet)'

  const messagesText = recentMessages
    .map((m) => `${m.role}: ${getTextContent(m.content)}`)
    .join('\n\n')

  const response = await router.call({
    action: 'memory_extraction', // should route to fast tier
    messages: [
      {
        role: 'system',
        content: `${config.extractionPrompt}

Rules:
- Only extract facts NOT already in the existing memory list
- Be specific and concise
- Skip generic conversation filler — only save genuinely useful facts
- Return empty array [] if nothing new to remember
- Return ONLY valid JSON, no other text

Categories: ${config.categories.join(', ')}

EXISTING MEMORIES:
${existingList}`,
      },
      {
        role: 'user',
        content: `Extract new facts from this conversation:\n\n${messagesText}`,
      },
    ],
    temperature: 0.3,
    maxTokens: 500,
  })

  const content = response.choices?.[0]?.message?.content?.trim() ?? '[]'

  // Parse JSON — handle markdown code blocks
  let newFacts: Array<{ fact: string; category: string }>
  try {
    const cleaned = content.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
    newFacts = JSON.parse(cleaned)
  } catch {
    return [] // Bad JSON — skip silently
  }

  if (!Array.isArray(newFacts) || newFacts.length === 0) return []

  // Deduplicate: skip facts that are too similar to existing ones (70% prefix match)
  const deduplicated: MemoryFact[] = []
  for (const f of newFacts) {
    if (!f.fact || typeof f.fact !== 'string') continue
    const factLower = f.fact.toLowerCase()
    const isDuplicate = existingMemories.some(
      (m) =>
        m.fact.toLowerCase() === factLower ||
        (factLower.length > 10 &&
          m.fact
            .toLowerCase()
            .includes(factLower.slice(0, Math.floor(factLower.length * 0.7))))
    )
    if (!isDuplicate) {
      deduplicated.push({
        fact: f.fact,
        category: config.categories.includes(f.category) ? f.category : config.categories[0],
        created_at: new Date().toISOString(),
      })
    }
  }

  return deduplicated
}

/**
 * Merge new memories with existing, respecting the max cap.
 * Removes oldest when exceeding maxFacts.
 */
export function mergeMemories(
  existing: MemoryFact[],
  newFacts: MemoryFact[],
  maxFacts: number
): MemoryFact[] {
  return [...existing, ...newFacts].slice(-maxFacts)
}

/**
 * Summarize old messages into a concise paragraph.
 * Used for conversation windowing — older messages beyond the window
 * are summarized so the LLM retains context without token bloat.
 */
export async function summarizeMessages(
  router: Router,
  messages: AIMessage[]
): Promise<string> {
  const messagesText = messages
    .map((m) => `${m.role}: ${getTextContent(m.content).slice(0, 300)}`)
    .join('\n')

  const response = await router.call({
    action: 'memory_extraction', // fast tier
    messages: [
      {
        role: 'system',
        content:
          'Summarize this conversation history into 2-3 sentences. Focus on: what was discussed, what actions were taken, key decisions made. Be concise.',
      },
      {
        role: 'user',
        content: messagesText,
      },
    ],
    temperature: 0.3,
    maxTokens: 300,
  })

  return response.choices?.[0]?.message?.content?.trim() ?? ''
}
