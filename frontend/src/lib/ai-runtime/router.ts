/**
 * Multi-provider tiered AI routing with retry logic.
 *
 * Extracted from UnderContract/Ask Hans's router.ts (295 lines).
 * Supports Groq, Anthropic, and Venice.ai with automatic format conversion,
 * exponential backoff, 429 Retry-After handling, and timeout per tier.
 */

import type {
  AIProvider,
  AIRequest,
  AIResponse,
  AITier,
  MessageContent,
  ProviderConfig,
  Router,
  RouterConfig,
} from './types'
import { getTextContent } from './types'

const DEFAULT_TIMEOUTS: Record<AITier, number> = {
  fast: 15_000,
  standard: 55_000,
  premium: 55_000,
}

const DEFAULT_MAX_RETRIES = 3

// ─── Tier Detection ─────────────────────────────────────────

function getTierForAction(action: string, config: RouterConfig): AITier {
  if (config.fastActions?.includes(action) && config.tiers.fast) {
    return 'fast'
  }
  if (config.premiumActions?.includes(action)) {
    return 'premium'
  }
  return 'standard'
}

function getProviderForTier(tier: AITier, config: RouterConfig): ProviderConfig {
  if (tier === 'fast' && config.tiers.fast) return config.tiers.fast
  if (tier === 'premium' && config.tiers.premium) return config.tiers.premium
  // Fall back to standard for any tier that isn't configured
  return config.tiers.standard
}

// ─── Provider Name (logging) ────────────────────────────────

function providerName(provider: AIProvider): string {
  switch (provider) {
    case 'groq': return 'Groq'
    case 'anthropic': return 'Anthropic'
    case 'venice': return 'Venice AI'
  }
}

// ─── Anthropic Format Conversion ────────────────────────────
// Anthropic Messages API uses a different format from OpenAI-compatible APIs.
// System messages → single system string, alternating roles enforced.

function formatForAnthropic(params: {
  messages: { role: string; content: MessageContent }[]
  temperature?: number
  maxTokens?: number
  model: string
}) {
  const systemParts: string[] = []
  const messages: { role: string; content: MessageContent }[] = []

  for (const msg of params.messages) {
    if (msg.role === 'system') {
      systemParts.push(getTextContent(msg.content))
    } else if (msg.role === 'user' || msg.role === 'assistant') {
      messages.push({ role: msg.role, content: msg.content })
    }
  }

  // Anthropic requires messages to start with a user message
  if (messages.length > 0 && messages[0].role === 'assistant') {
    messages.unshift({ role: 'user', content: '(conversation continues)' })
  }

  // Anthropic requires alternating user/assistant — merge consecutive same-role
  // Only merge when both are strings; content with image blocks stays separate
  const merged: { role: string; content: MessageContent }[] = []
  for (const msg of messages) {
    const prev = merged.length > 0 ? merged[merged.length - 1] : null
    if (prev && prev.role === msg.role && typeof prev.content === 'string' && typeof msg.content === 'string') {
      prev.content += '\n\n' + msg.content
    } else {
      merged.push({ ...msg })
    }
  }

  const body: Record<string, unknown> = {
    model: params.model,
    messages: merged,
    max_tokens: params.maxTokens ?? 2000,
  }

  if (systemParts.length > 0) {
    body.system = systemParts.join('\n\n')
  }

  if (params.temperature !== undefined) {
    body.temperature = params.temperature
  }

  return body
}

// ─── Normalize Anthropic Response ───────────────────────────
// Convert Anthropic's response format to OpenAI-compatible shape
// so all consumers work with a single interface.

function normalizeAnthropicResponse(data: {
  content: Array<{ type: string; text?: string }>
  stop_reason?: string
  model?: string
  usage?: { input_tokens: number; output_tokens: number }
}): AIResponse {
  const text = data.content
    ?.filter((block) => block.type === 'text')
    ?.map((block) => block.text)
    ?.join('') ?? ''

  return {
    choices: [
      {
        message: { role: 'assistant', content: text },
        finish_reason: data.stop_reason === 'end_turn' ? 'stop' : data.stop_reason,
      },
    ],
    model: data.model,
    usage: data.usage
      ? {
          prompt_tokens: data.usage.input_tokens,
          completion_tokens: data.usage.output_tokens,
          total_tokens: data.usage.input_tokens + data.usage.output_tokens,
        }
      : undefined,
  }
}

// ─── Create Router ──────────────────────────────────────────

export function createRouter(config: RouterConfig): Router {
  const maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES

  return {
    async call(request: AIRequest): Promise<AIResponse> {
      const tier = getTierForAction(request.action, config)
      const provider = getProviderForTier(tier, config)
      const { model, endpoint, apiKey } = provider
      const name = providerName(provider.provider)
      const timeoutMs = config.timeouts?.[tier] ?? DEFAULT_TIMEOUTS[tier]

      // Build headers based on provider
      const headers: Record<string, string> =
        provider.provider === 'anthropic'
          ? {
              'Content-Type': 'application/json',
              'x-api-key': apiKey,
              'anthropic-version': '2023-06-01',
              ...provider.headers,
            }
          : {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${apiKey}`,
              ...provider.headers,
            }

      // Build body based on provider
      const body =
        provider.provider === 'anthropic'
          ? JSON.stringify(formatForAnthropic({ ...request, model }))
          : JSON.stringify({
              model,
              messages: request.messages,
              temperature: request.temperature ?? 0.7,
              max_tokens: request.maxTokens ?? 2000,
            })

      // Retry with exponential backoff on timeout, 5xx, or 429
      let lastError: Error | null = null

      for (let attempt = 0; attempt < maxRetries; attempt++) {
        if (attempt > 0) {
          const backoffMs = Math.pow(2, attempt - 1) * 1000 + Math.random() * 500
          console.warn(
            `${name} retry ${attempt}/${maxRetries - 1}, waiting ${Math.round(backoffMs)}ms [model=${model}]`
          )
          await new Promise((resolve) => setTimeout(resolve, backoffMs))
        }

        try {
          const response = await fetch(endpoint, {
            method: 'POST',
            headers,
            body,
            signal: AbortSignal.timeout(timeoutMs),
          })

          if (response.ok) {
            const data = await response.json()
            return provider.provider === 'anthropic'
              ? normalizeAnthropicResponse(data)
              : data
          }

          const errorBody = await response.text().catch(() => 'Unable to read error body')

          // 429 rate limit — respect Retry-After header
          if (response.status === 429) {
            const retryAfter = response.headers.get('retry-after')
            const waitMs = retryAfter
              ? (parseInt(retryAfter, 10) || 1) * 1000
              : Math.pow(2, attempt) * 1000

            if (attempt < maxRetries - 1) {
              console.warn(
                `${name} rate limited (429), waiting ${waitMs}ms before retry ${attempt + 1}/${maxRetries - 1}`
              )
              await new Promise((resolve) => setTimeout(resolve, waitMs))
              lastError = new Error(`${name} rate limited (429) — ${errorBody.slice(0, 200)}`)
              continue
            }
            throw new Error(`${name} rate limited after ${maxRetries} attempts — ${errorBody.slice(0, 200)}`)
          }

          // 5xx server errors — retry
          if (response.status >= 500 && attempt < maxRetries - 1) {
            console.warn(`${name} ${response.status} error (attempt ${attempt + 1}), retrying`)
            lastError = new Error(
              `${name} error: ${response.status} ${response.statusText} — ${errorBody.slice(0, 200)}`
            )
            continue
          }

          // 4xx (not 429) or exhausted retries — fail immediately
          throw new Error(
            `${name} error: ${response.status} ${response.statusText} — ${errorBody.slice(0, 200)}`
          )
        } catch (err) {
          // Timeout — retry with backoff
          if (
            err instanceof Error &&
            (err.name === 'TimeoutError' || err.name === 'AbortError') &&
            attempt < maxRetries - 1
          ) {
            console.warn(`${name} timeout (attempt ${attempt + 1}), will retry [model=${model}]`)
            lastError = err
            continue
          }
          throw err
        }
      }

      throw lastError || new Error(`${name} request failed after ${maxRetries} retries`)
    },
  }
}
