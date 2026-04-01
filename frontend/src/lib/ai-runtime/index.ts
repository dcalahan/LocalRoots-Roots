/**
 * @common-area/ai-runtime — Shared AI runtime for Common Area products
 *
 * Architecture: "shared runtime, separate brains"
 * - Runtime: model routing, memory, action parsing, streaming, chat orchestration
 * - Brain: each product provides system prompts, domain knowledge, action executors
 *
 * Usage:
 *   import { handleChat, createRouter, parseActions } from '@common-area/ai-runtime'
 */

// Types
export type {
  AgentLoopConfig,
  AIMessage,
  AIProvider,
  AIRequest,
  AIResponse,
  AITier,
  ActionResult,
  Brain,
  BrainContext,
  ChatResult,
  ContentBlock,
  ConversationWindowConfig,
  EntityMemoryConfig,
  ImageBlock,
  MemoryConfig,
  MemoryFact,
  MessageContent,
  NDJSONWriter,
  ParsedAction,
  ProviderConfig,
  Router,
  RouterConfig,
  SoulConfig,
  StreamEvent,
  TextBlock,
  TierConfig,
} from './types'

// Content utilities
export { getTextContent } from './types'

// Router
export { createRouter } from './router'

// Actions
export { parseActions, sortByPriority } from './actions'

// Memory
export {
  extractMemories,
  formatMemoryContext,
  mergeMemories,
  summarizeMessages,
} from './memory'

// Streaming
export { createNDJSONStream, parseNDJSONStream } from './streaming'

// Chat orchestration
export { handleChat } from './chat'
