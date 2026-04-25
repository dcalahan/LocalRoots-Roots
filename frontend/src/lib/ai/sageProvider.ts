/**
 * Sage provider abstraction — switches between Anthropic Claude and Venice AI
 * via the SAGE_PROVIDER env var.
 *
 * Architecture:
 *   - SAGE_PROVIDER=venice + VENICE_API_KEY set → Venice primary, Claude fallback
 *   - Anything else (default) → Claude direct, no Venice
 *
 * Why fallback matters: Venice's daily DIEM credit cap means Venice can return
 * 429 mid-day when credits run out. Without fallback, Sage would silently break.
 * The fallback to Claude is automatic for any 429/401/403/network errors received
 * BEFORE streaming starts. (Mid-stream failures end with what we have — can't
 * cleanly restart partway through a response.)
 *
 * Public surface:
 *   - getSageProvider() — returns the active config
 *   - streamSageChat() — streaming chat with fallback
 *   - completeSagePrompt() — non-streaming single-shot for extraction calls
 *
 * Plan: ~/.claude/plans/sage-venice-migration.md (TBD)
 */

import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

// ─── Provider config ───────────────────────────────────────

export type SageProviderName = 'anthropic' | 'venice';

interface AnthropicConfig {
  name: 'anthropic';
  apiKey: string;
  model: string;
  /** User-facing label shown in the chat footer. */
  displayName: string;
}

interface VeniceConfig {
  name: 'venice';
  apiKey: string;
  model: string;
  baseUrl: string;
  /** User-facing label shown in the chat footer. */
  displayName: string;
  /** If Venice fails before streaming starts, fall back to this provider. */
  fallback: AnthropicConfig | null;
}

export type SageProviderConfig = AnthropicConfig | VeniceConfig;

const ANTHROPIC_MODEL_DEFAULT = 'claude-haiku-4-5-20251001';
const VENICE_MODEL_DEFAULT = 'llama-3.3-70b';
const VENICE_BASE_URL = 'https://api.venice.ai/api/v1';

function buildAnthropicConfig(): AnthropicConfig | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  return {
    name: 'anthropic',
    apiKey,
    model: ANTHROPIC_MODEL_DEFAULT,
    displayName: 'Claude AI',
  };
}

/**
 * Returns the active Sage provider config based on env vars.
 * Throws if no provider can be configured (no API keys at all).
 */
export function getSageProvider(): SageProviderConfig {
  const requested = process.env.SAGE_PROVIDER?.toLowerCase();
  const veniceKey = process.env.VENICE_API_KEY;

  // Venice path: requested AND key present
  if (requested === 'venice' && veniceKey) {
    return {
      name: 'venice',
      apiKey: veniceKey,
      model: process.env.VENICE_MODEL || VENICE_MODEL_DEFAULT,
      baseUrl: VENICE_BASE_URL,
      displayName: 'Venice AI',
      fallback: buildAnthropicConfig(),
    };
  }

  // Default: Anthropic
  const anthropic = buildAnthropicConfig();
  if (!anthropic) {
    throw new Error('No Sage provider configured: ANTHROPIC_API_KEY is required');
  }
  return anthropic;
}

// ─── Format conversion: shared types ───────────────────────

export interface SageMessage {
  role: 'user' | 'assistant';
  /** Either plain text OR an array of content blocks (for image+text). */
  content:
    | string
    | Array<
        | { type: 'text'; text: string }
        | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }
      >;
}

/**
 * Convert an Anthropic-format message (with image blocks) into OpenAI-compatible
 * format used by Venice. Anthropic uses `{type: 'image', source: {data, media_type}}`,
 * OpenAI uses `{type: 'image_url', image_url: {url: 'data:...base64,...'}}`.
 *
 * Returns the OpenAI SDK's discriminated union type — narrowed per role so TS
 * is happy with the chat.completions.create() call.
 */
function toOpenAIMessage(msg: SageMessage): ChatCompletionMessageParam {
  if (typeof msg.content === 'string') {
    if (msg.role === 'assistant') return { role: 'assistant', content: msg.content };
    return { role: 'user', content: msg.content };
  }
  // Multi-part content (text + images) — only meaningful for user messages
  const parts = msg.content.map(block => {
    if (block.type === 'text') return { type: 'text' as const, text: block.text };
    const dataUrl = `data:${block.source.media_type};base64,${block.source.data}`;
    return { type: 'image_url' as const, image_url: { url: dataUrl } };
  });
  if (msg.role === 'assistant') {
    // Assistants generally don't return images; flatten to text-only
    const text = parts
      .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
      .map(p => p.text)
      .join('\n');
    return { role: 'assistant', content: text };
  }
  return { role: 'user', content: parts };
}

// ─── Streaming chat ────────────────────────────────────────

export interface StreamChatOptions {
  systemPrompt: string;
  messages: SageMessage[];
  maxTokens?: number;
}

/**
 * Stream chat with the active Sage provider. Yields text chunks as they arrive.
 * If Venice is configured and fails before streaming begins, automatically
 * falls back to Claude (logged but invisible to the user).
 */
export async function* streamSageChat(
  opts: StreamChatOptions,
): AsyncGenerator<string, void, unknown> {
  const config = getSageProvider();

  if (config.name === 'venice') {
    try {
      yield* streamFromVenice(config, opts);
      return;
    } catch (err) {
      const fallback = config.fallback;
      if (!fallback) throw err;
      console.warn(
        '[Sage] Venice failed before streaming, falling back to Claude:',
        err instanceof Error ? err.message : String(err),
      );
      yield* streamFromAnthropic(fallback, opts);
      return;
    }
  }

  yield* streamFromAnthropic(config, opts);
}

async function* streamFromVenice(
  config: VeniceConfig,
  opts: StreamChatOptions,
): AsyncGenerator<string, void, unknown> {
  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseUrl,
  });

  const stream = await client.chat.completions.create({
    model: config.model,
    max_tokens: opts.maxTokens ?? 2000,
    stream: true,
    messages: [
      { role: 'system', content: opts.systemPrompt },
      ...opts.messages.map(toOpenAIMessage),
    ],
  });

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    if (typeof delta === 'string' && delta.length > 0) {
      yield delta;
    }
  }
}

async function* streamFromAnthropic(
  config: AnthropicConfig,
  opts: StreamChatOptions,
): AsyncGenerator<string, void, unknown> {
  // Anthropic requires the conversation to start with a user message.
  // If history starts with assistant, prepend a synthetic user message.
  const messages = [...opts.messages];
  if (messages.length > 0 && messages[0].role === 'assistant') {
    messages.unshift({ role: 'user', content: '(conversation continues)' });
  }

  // Anthropic also requires alternating user/assistant — merge consecutive same-role (strings only)
  const merged: SageMessage[] = [];
  for (const m of messages) {
    const prev = merged[merged.length - 1];
    if (prev && prev.role === m.role && typeof prev.content === 'string' && typeof m.content === 'string') {
      prev.content += '\n\n' + m.content;
    } else {
      merged.push({ ...m });
    }
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: opts.maxTokens ?? 2000,
      stream: true,
      system: opts.systemPrompt,
      messages: merged,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => 'unknown');
    throw new Error(`Anthropic ${res.status}: ${errText.slice(0, 200)}`);
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') continue;
        try {
          const event = JSON.parse(data);
          if (event.type === 'content_block_delta' && event.delta?.text) {
            yield event.delta.text as string;
          }
        } catch {
          /* skip malformed SSE event */
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// ─── Single-shot completion (for extraction calls) ─────────

export interface CompleteOptions {
  /** The full user prompt. Treated as a single user message. */
  prompt: string;
  maxTokens?: number;
  /** Optional system prompt prepended. */
  systemPrompt?: string;
}

/**
 * Single-shot completion. Returns the full text response. Used for extraction
 * calls (memory, garden actions, suggestions) that don't need streaming.
 *
 * Same fallback pattern as streamSageChat: Venice primary, Claude on failure.
 */
export async function completeSagePrompt(opts: CompleteOptions): Promise<string> {
  const config = getSageProvider();

  if (config.name === 'venice') {
    try {
      return await completeFromVenice(config, opts);
    } catch (err) {
      const fallback = config.fallback;
      if (!fallback) throw err;
      console.warn(
        '[Sage] Venice extraction failed, falling back to Claude:',
        err instanceof Error ? err.message : String(err),
      );
      return await completeFromAnthropic(fallback, opts);
    }
  }

  return await completeFromAnthropic(config, opts);
}

async function completeFromVenice(config: VeniceConfig, opts: CompleteOptions): Promise<string> {
  const client = new OpenAI({ apiKey: config.apiKey, baseURL: config.baseUrl });
  const messages: Array<{ role: 'system' | 'user'; content: string }> = [];
  if (opts.systemPrompt) messages.push({ role: 'system', content: opts.systemPrompt });
  messages.push({ role: 'user', content: opts.prompt });

  const res = await client.chat.completions.create({
    model: config.model,
    max_tokens: opts.maxTokens ?? 500,
    messages,
  });
  return res.choices[0]?.message?.content || '';
}

async function completeFromAnthropic(config: AnthropicConfig, opts: CompleteOptions): Promise<string> {
  const body: Record<string, unknown> = {
    model: config.model,
    max_tokens: opts.maxTokens ?? 500,
    messages: [{ role: 'user', content: opts.prompt }],
  };
  if (opts.systemPrompt) body.system = opts.systemPrompt;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => 'unknown');
    throw new Error(`Anthropic ${res.status}: ${errText.slice(0, 200)}`);
  }
  const data = (await res.json()) as { content?: Array<{ text?: string }> };
  return data.content?.[0]?.text || '';
}

// ─── Display name (for footer attribution) ─────────────────

/**
 * Returns the display name of the active Sage provider for user-facing UI.
 * "Built on Venice AI" or "Built on Claude AI".
 */
export function getSageDisplayName(): string {
  try {
    return getSageProvider().displayName;
  } catch {
    return 'Claude AI';
  }
}
