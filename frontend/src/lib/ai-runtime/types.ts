// ─── Provider & Routing ─────────────────────────────────────

export type AIProvider = 'groq' | 'anthropic' | 'venice'
export type AITier = 'fast' | 'standard' | 'premium'

export interface ProviderConfig {
  provider: AIProvider
  model: string
  endpoint: string
  apiKey: string
  /** Provider-specific headers beyond auth */
  headers?: Record<string, string>
}

export interface TierConfig {
  fast?: ProviderConfig
  standard: ProviderConfig
  premium?: ProviderConfig
}

export interface RouterConfig {
  tiers: TierConfig
  /** Actions that route to fast tier (e.g., 'sms_processing', 'memory_extraction') */
  fastActions?: string[]
  /** Actions that route to premium tier (e.g., 'document_processing', 'contract_review') */
  premiumActions?: string[]
  /** Timeout overrides per tier in ms. Defaults: fast=15000, standard=55000, premium=55000 */
  timeouts?: Partial<Record<AITier, number>>
  /** Max retries on timeout/5xx/429. Default: 3 */
  maxRetries?: number
}

// ─── Content Blocks (vision support) ────────────────────────

export type TextBlock = { type: 'text'; text: string }
export type ImageBlock = {
  type: 'image'
  source: { type: 'base64'; media_type: string; data: string }
}
export type ContentBlock = TextBlock | ImageBlock

/** Message content — string for text-only, ContentBlock[] for multimodal */
export type MessageContent = string | ContentBlock[]

/** Extract text from any content shape. Images are skipped. */
export function getTextContent(content: MessageContent): string {
  if (typeof content === 'string') return content
  return content
    .filter((b): b is TextBlock => b.type === 'text')
    .map(b => b.text)
    .join('\n')
}

export interface AIMessage {
  role: 'system' | 'user' | 'assistant'
  content: MessageContent
}

export interface AIRequest {
  action: string
  messages: AIMessage[]
  temperature?: number
  maxTokens?: number
}

/** Normalized response — all providers produce this shape */
export interface AIResponse {
  choices: Array<{
    message: { role: string; content: string }
    finish_reason?: string
  }>
  model?: string
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

// ─── Actions ────────────────────────────────────────────────

export interface ParsedAction<T extends string = string> {
  type: T
  data: Record<string, unknown>
}

export interface ActionResult<T extends string = string> {
  type: T
  status: 'success' | 'error'
  data?: Record<string, unknown>
  error?: string
}

// ─── Memory ─────────────────────────────────────────────────

export interface MemoryFact {
  fact: string
  category: string
  created_at: string
}

export interface ConversationWindowConfig {
  enabled: boolean
  /** Messages to send to LLM. Default: 20 */
  windowSize: number
  /** Trigger summarization after this many messages. Default: 30 */
  summarizeThreshold: number
}

export interface EntityMemoryConfig {
  enabled: boolean
  /** Max stored facts per user. Default: 100 */
  maxFacts: number
  /** Product-specific extraction prompt — tells the LLM what facts to extract */
  extractionPrompt: string
  /** Valid categories for this product's memories */
  categories: string[]
}

export interface SoulConfig {
  enabled: boolean
  /** Hardcoded fallback soul text (used when DB load fails) */
  initialSoul: string
}

export interface MemoryConfig {
  conversationWindow?: ConversationWindowConfig
  entityMemory?: EntityMemoryConfig
  soul?: SoulConfig
}

// ─── Brain Interface ────────────────────────────────────────
// Each product implements this to plug into the shared runtime.

export interface AgentLoopConfig {
  /** Enable the agentic loop — LLM can take actions, see results, and continue */
  enabled: boolean
  /** Max LLM turns per request. Default: 3, hard cap: 5 */
  maxTurns?: number
  /** Max actions the LLM can fire per turn. Default: 5 */
  maxActionsPerTurn?: number
  /** Total action budget across all turns. Default: 10 */
  maxTotalActions?: number
}

export interface BrainContext {
  /** User/agent ID */
  userId: string
  /** Session/conversation identifier */
  sessionId?: string
  /** Product-specific mode (e.g., 'onboarding', 'deal', 'dashboard', 'analysis') */
  mode?: string
  /** Product-specific context IDs (e.g., { dealId: '...', clientId: '...' }) */
  contextIds?: Record<string, string>
  /** Incoming messages from the client */
  messages: AIMessage[]
  /** Enable agentic loop — LLM takes actions, sees results, continues. Default: off */
  agentLoop?: AgentLoopConfig
}

export interface Brain<TAction extends string = string> {
  /** Unique product identifier */
  productSlug: string

  /** Router configuration — providers, tiers, action routing */
  routerConfig: RouterConfig

  /** Memory configuration. Omit entirely for single-turn (e.g., GateKeeper analysis). */
  memoryConfig?: MemoryConfig

  /** Action types this brain supports. Empty array = no action parsing. */
  actionTypes: TAction[]

  /**
   * Build the system prompt for a given context.
   * Product controls all domain knowledge and prompt structure.
   */
  getSystemPrompt(context: BrainContext): Promise<string> | string

  /**
   * Load additional context to inject after system prompt.
   * E.g., current deal details, client list, community profile.
   * Return empty string if no additional context needed.
   */
  loadContext(context: BrainContext): Promise<string>

  /**
   * Execute parsed actions against the product's database.
   * Only called if actionTypes is non-empty and actions were found in the response.
   */
  executeActions?(
    actions: ParsedAction<TAction>[],
    context: BrainContext
  ): Promise<ActionResult<TAction>[]>

  // ─── Memory persistence (only called if memoryConfig enables the layer) ───

  /** Load stored memories for a user. */
  loadMemories?(userId: string): Promise<MemoryFact[]>

  /** Save extracted memories for a user. */
  saveMemories?(userId: string, memories: MemoryFact[]): Promise<void>

  /** Load the product soul text from DB. */
  loadSoul?(): Promise<string>

  /** Load existing conversation summary for message windowing. */
  loadConversationSummary?(sessionId: string): Promise<string | null>

  /** Save conversation messages and optional summary. */
  saveConversation?(
    sessionId: string,
    messages: AIMessage[],
    summary?: string
  ): Promise<void>

  /**
   * Override tier detection for special cases.
   * E.g., Hans detects document uploads → premium tier.
   * Return undefined to fall through to default action-list matching.
   */
  detectTier?(messages: AIMessage[], action: string): AITier | undefined
}

// ─── Chat Result ────────────────────────────────────────────

export interface ChatResult<TAction extends string = string> {
  /** Full normalized AI response */
  response: AIResponse
  /** Response text with action blocks stripped */
  cleanContent: string
  /** Executed action results (empty if no actions) */
  actions: ActionResult<TAction>[]
  /** Number of LLM calls made (1 = single turn, >1 = agentic loop) */
  turns?: number
}

// ─── Streaming ──────────────────────────────────────────────

export interface StreamEvent<T = unknown> {
  type: 'started' | 'progress' | 'delta' | 'action' | 'complete' | 'error'
  content?: string
  data?: T
}

export interface NDJSONWriter<T = unknown> {
  write(data: T): void
  close(): void
}

export interface Router {
  call(request: AIRequest): Promise<AIResponse>
}
