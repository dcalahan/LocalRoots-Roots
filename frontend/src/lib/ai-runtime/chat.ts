/**
 * Chat orchestration pipeline — the core of the shared AI runtime.
 *
 * Generalizes UnderContract/Ask Hans's chat/route.ts (622 lines) into a
 * framework-agnostic function. Products call handleChat() with their Brain
 * implementation and get back clean content + action results.
 *
 * Orchestration sequence (mirrors Hans exactly):
 * 1. Load soul (if configured)
 * 2. Load memories (if configured)
 * 3. Build system prompt via brain
 * 4. Load additional context via brain
 * 5. Compose full system prompt
 * 6. Window messages (if configured)
 * 7. Detect tier
 * 8. Call AI via router
 * 9. Parse actions
 * 10. Execute actions via brain
 * 11. Save conversation (if configured)
 * 12. Trigger summarization if needed (async)
 * 13. Extract memories in background (fire-and-forget)
 * 14. Return clean content + action results
 */

import type {
  AIMessage,
  ActionResult,
  Brain,
  BrainContext,
  ChatResult,
  Router,
} from './types'
import { createRouter } from './router'
import { parseActions, sortByPriority } from './actions'
import { extractMemories, formatMemoryContext, mergeMemories, summarizeMessages } from './memory'

/**
 * Run the full chat pipeline for a product.
 *
 * This is framework-agnostic — a Next.js API route wraps the result in
 * NextResponse.json(), an Express handler sends it differently.
 */
export async function handleChat<TAction extends string = string>(
  brain: Brain<TAction>,
  context: BrainContext
): Promise<ChatResult<TAction>> {
  const router = createRouter(brain.routerConfig)
  const mc = brain.memoryConfig

  // ─── 1. Load soul ──────────────────────────────────────
  let soulText: string | null = null
  if (mc?.soul?.enabled && brain.loadSoul) {
    try {
      soulText = await brain.loadSoul()
    } catch {
      soulText = mc.soul.initialSoul
    }
  } else if (mc?.soul?.enabled) {
    soulText = mc.soul.initialSoul
  }

  // ─── 2. Load memories ─────────────────────────────────
  let memories: import('./types').MemoryFact[] = []
  if (mc?.entityMemory?.enabled && brain.loadMemories) {
    try {
      memories = await brain.loadMemories(context.userId)
    } catch {
      // Memory load is non-critical
    }
  }

  // ─── 3. Build system prompt ────────────────────────────
  const systemPrompt = await brain.getSystemPrompt(context)

  // ─── 4. Load additional context ────────────────────────
  const additionalContext = await brain.loadContext(context)

  // ─── 5. Compose full system prompt ─────────────────────
  const memoryContext = formatMemoryContext(memories, soulText)
  let fullSystemPrompt = memoryContext + systemPrompt + additionalContext

  // Inject loop-awareness if agentic loop is enabled
  if (context.agentLoop?.enabled) {
    fullSystemPrompt += `\n\nAGENTIC LOOP: When you receive [ACTION_RESULTS], you are seeing the outcomes of actions you just took. Review the results and continue the conversation naturally. React to what happened — summarize findings, confirm what was created, and ask what's next. Do not repeat actions that already succeeded.`
  }

  // ─── 6. Window messages ────────────────────────────────
  let llmMessages = context.messages
  let summaryPrefix = ''
  const windowConfig = mc?.conversationWindow

  if (windowConfig?.enabled) {
    const windowSize = windowConfig.windowSize ?? 20

    if (context.messages.length > windowSize) {
      llmMessages = context.messages.slice(-windowSize)

      // Load existing summary for older messages
      if (context.sessionId && brain.loadConversationSummary) {
        try {
          const summary = await brain.loadConversationSummary(context.sessionId)
          if (summary) {
            summaryPrefix = `Summary of earlier conversation: ${summary}`
          }
        } catch {
          // Summary load is non-critical
        }
      }
    }
  }

  // ─── 7. Detect tier ────────────────────────────────────
  const defaultAction = 'chat'
  let tier = brain.detectTier?.(context.messages, defaultAction)
  if (!tier) {
    // Fall through to default action-list matching (handled by router)
  }
  const aiAction = tier === 'premium' ? 'document_processing'
    : tier === 'fast' ? 'memory_extraction'
    : defaultAction

  // ─── 8-10. Call AI + Parse + Execute (with optional agentic loop) ───
  const systemMessages: AIMessage[] = [
    { role: 'system', content: fullSystemPrompt },
  ]
  if (summaryPrefix) {
    systemMessages.push({ role: 'system', content: summaryPrefix })
  }

  // Agentic loop config
  const loop = context.agentLoop
  const loopEnabled = loop?.enabled === true
  const maxTurns = Math.min(loop?.maxTurns ?? 3, 5)
  const maxActionsPerTurn = loop?.maxActionsPerTurn ?? 5
  const maxTotalActions = loop?.maxTotalActions ?? 10
  const deadline = Date.now() + 50_000 // 50s wall-clock (Vercel 60s limit)

  const allCleanContent: string[] = []
  let allActionResults: ActionResult<TAction>[] = []
  let turnMessages = [...systemMessages, ...llmMessages]
  let turns = 0
  let lastResponse: import('./types').AIResponse | null = null
  // Capture original user messages for conversation save (before loop mutates turnMessages)
  const originalUserMessages = [...context.messages]

  while (turns < maxTurns) {
    turns++

    // Wall-clock check (skip on first turn — always make at least one call)
    if (turns > 1 && Date.now() > deadline) break

    // Call LLM
    const response = await router.call({
      action: aiAction,
      messages: turnMessages,
    })
    lastResponse = response

    const rawContent = response.choices?.[0]?.message?.content ?? ''

    // Parse actions
    let turnCleanContent: string
    let parsedActions: import('./types').ParsedAction<TAction>[]

    if (brain.actionTypes.length > 0) {
      const parsed = parseActions<TAction>(rawContent)
      turnCleanContent = parsed.cleanContent
      parsedActions = parsed.actions.slice(0, maxActionsPerTurn)
    } else {
      turnCleanContent = rawContent
      parsedActions = []
    }

    allCleanContent.push(turnCleanContent)

    // No actions or loop not enabled → execute and break
    if (parsedActions.length === 0 || !loopEnabled) {
      if (parsedActions.length > 0 && brain.executeActions) {
        const results = await brain.executeActions(parsedActions, context)
        allActionResults.push(...results)
      }
      break
    }

    // Check total action budget
    const budgetRemaining = maxTotalActions - allActionResults.length
    if (budgetRemaining <= 0) break
    if (parsedActions.length > budgetRemaining) {
      parsedActions = parsedActions.slice(0, budgetRemaining)
    }

    // Execute actions
    let turnResults: ActionResult<TAction>[] = []
    if (brain.executeActions) {
      turnResults = await brain.executeActions(parsedActions, context)
      allActionResults.push(...turnResults)
    }

    // Intermediate save — uses original messages (not turn-internal action-result messages)
    if (windowConfig?.enabled && context.sessionId && brain.saveConversation) {
      const intermediateMessages: AIMessage[] = [
        ...originalUserMessages,
        ...allCleanContent.filter(Boolean).map(c => ({ role: 'assistant' as const, content: c })),
      ]
      try {
        await brain.saveConversation(context.sessionId, intermediateMessages)
      } catch { /* intermediate save is best-effort */ }
    }

    // If last allowed turn, don't loop back
    if (turns >= maxTurns) break

    // Check deadline before looping
    if (Date.now() > deadline) break

    // Refresh context so next turn sees updated data (e.g., newly created clients)
    try {
      const refreshedContext = await brain.loadContext(context)
      if (refreshedContext !== additionalContext) {
        const refreshedPrompt = memoryContext + systemPrompt + refreshedContext
          + `\n\nAGENTIC LOOP: You are seeing the results of actions you just took. CRITICAL RULES:
1. Do NOT repeat text you already wrote. Your previous response is visible to the user — don't say the same thing again.
2. Do NOT repeat actions that already succeeded.
3. Continue the conversation naturally — react to results, then ask the next question.
4. Keep your response SHORT — the user already saw your previous message.`
        turnMessages[0] = { role: 'system', content: refreshedPrompt }
      }
    } catch {
      // Context refresh is non-critical — stale context is better than crashing
    }

    // Feed action results back to LLM for next turn
    turnMessages.push({ role: 'assistant' as const, content: rawContent })
    turnMessages.push({ role: 'user' as const, content: formatActionResults(turnResults) })
  }

  // Use only the LAST turn's text as the user-facing response.
  // Earlier turns were internal processing (pre-action-results) — the user
  // should see the final synthesis, not the intermediate "thinking aloud."
  // If only 1 turn ran, use that. If multiple turns, use the last non-empty one.
  const nonEmptyContent = allCleanContent.filter(Boolean)
  const cleanContent = nonEmptyContent.length > 1
    ? nonEmptyContent[nonEmptyContent.length - 1]
    : nonEmptyContent.join('\n\n')

  // ─── 11. Save conversation ─────────────────────────────
  if (windowConfig?.enabled && context.sessionId && brain.saveConversation) {
    const allMessages: AIMessage[] = [
      ...originalUserMessages,
      { role: 'assistant', content: cleanContent },
    ]

    try {
      await brain.saveConversation(context.sessionId, allMessages)

      // ─── 12. Trigger summarization if needed (async) ───
      const threshold = windowConfig.summarizeThreshold ?? 30
      if (allMessages.length > threshold) {
        const windowSize = windowConfig.windowSize ?? 20
        const oldMessages = allMessages.slice(0, -windowSize)
        summarizeMessages(router, oldMessages)
          .then(async (summary) => {
            if (summary && brain.saveConversation) {
              await brain.saveConversation(context.sessionId!, allMessages, summary)
            }
          })
          .catch(() => {})
      }
    } catch (err) {
      console.error('Conversation save failed:', err instanceof Error ? err.message : err)
    }
  }

  // ─── 13. Extract memories (fire-and-forget) ────────────
  if (mc?.entityMemory?.enabled && brain.saveMemories) {
    const recentForExtraction: AIMessage[] = [
      ...context.messages.slice(-3),
      { role: 'assistant', content: cleanContent },
    ]

    extractMemories(router, mc.entityMemory, recentForExtraction, memories)
      .then(async (newFacts) => {
        if (newFacts.length > 0 && brain.saveMemories) {
          const merged = mergeMemories(memories, newFacts, mc.entityMemory!.maxFacts ?? 100)
          await brain.saveMemories(context.userId, merged)
        }
      })
      .catch(() => {})
  }

  // ─── 14. Return result ─────────────────────────────────
  const finalResponse = lastResponse!
  return {
    response: {
      ...finalResponse,
      choices: [
        {
          ...finalResponse.choices?.[0],
          message: { role: 'assistant', content: cleanContent },
        },
      ],
    },
    cleanContent,
    actions: allActionResults,
    turns,
  }
}

// ─── Helper: format action results for LLM feedback ──────
function formatActionResults<T extends string>(results: ActionResult<T>[]): string {
  const lines = results.map(r => {
    if (r.status === 'success') {
      return `Action: ${r.type} → success\nResult: ${JSON.stringify(r.data ?? {})}`
    }
    return `Action: ${r.type} → error\nError: ${r.error ?? 'Unknown error'}`
  })
  return `[ACTION_RESULTS]\n${lines.join('\n\n')}\n[/ACTION_RESULTS]\n\nReview these results and continue the conversation naturally. React to what happened and ask the user what's next.`
}
