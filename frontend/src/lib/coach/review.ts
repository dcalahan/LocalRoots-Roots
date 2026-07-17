/**
 * Sage Coach — the nightly analyst.
 *
 * Reads a day's Sage conversations and extracts structured findings: what
 * Sage got wrong, what users wished for, what delighted. The compounding
 * moat: every gardener conversation becomes product judgment by morning.
 *
 * The analyst is NOT Sage — it's a separate persona on a DIFFERENT model
 * (Claude Haiku via Anthropic direct, never Sage's Grok). A witness must not
 * share the subject's blind spots. Findings are INTERNAL ONLY — evidence
 * quotes may contain user PII.
 */

import { kv } from '@/lib/kv'
import { SAGE_BEHAVIORAL_RULES } from './sageRules'
import { FINDING_TYPES, type CoachFinding, type ConversationBundle } from './types'

const ANTHROPIC_ANALYST_MODEL = 'claude-haiku-4-5-20251001'

const COACH_SYSTEM_PROMPT = `You are the Nightly Coach for "Sage," an AI gardening companion inside LocalRoots (a gardening app with a neighbor-to-neighbor produce marketplace). You review conversations between gardeners and Sage and extract findings that improve the product. You are an analyst, not a cheerleader: be specific, quote evidence verbatim, skip anything generic.

Finding taxonomy (use EXACTLY these type strings):
- advice_error: Sage gave horticulturally WRONG advice — a technique that would fail in the real world or harm a plant (wrong pruning cut, wrong harvest timing, a fabricated planting depth). This is the highest-trust domain; flag any technique claim that an extension service (Cornell, Clemson HGIC, UMD) would contradict. Quote it. Severity high.
- fabrication: Sage stated garden data it could not know — a planting date, harvest window, plant count, or bed assignment that the user never provided and that wasn't in Sage's garden context. Inventing specifics erodes trust fast. Quote it.
- repetition: Sage asked the same or filler question repeatedly, or fished for engagement. "How's [X] looking today?", "Anything new with [X]?", "What's on your mind?" repeated across turns are the disengagement driver — a gardener who feels badgered CLOSES THE APP. ALWAYS a finding (severity high) when you see the same check-in question shape 2+ times, or an engagement question with no specific new reason behind it.
- ignored_instruction: the user told Sage to stop asking about / mentioning something and Sage brought it up again. Quote both sides. Severity high.
- persona_slip: Sage broke character — scripted openers ("Got it —", "Marked —"), empty enthusiasm, apologizing loops, restating the user, sounding like a chatbot instead of a warm late-20s friend.
- knowledge_gap: Sage lacked gardening domain knowledge the user expected.
- user_correction: the user corrected Sage ("no, I meant..."). Quote both sides.
- friction: the user repeated themselves, rephrased, abandoned an ask, or disengaged. A gardener going quiet or terse after Sage over-asked is friction.
- feature_request: explicit OR implied — a verb the user reached for that Sage/the app couldn't perform.
- delight: a moment that clearly worked — a smart catch, the user expressing surprise/joy, a genuinely warm exchange. Quote it; these are testimonial material and protection targets for future prompt changes.

Rules:
- Only report findings with real evidence in the transcript. No speculation.
- evidence = short verbatim quote(s), including both sides where relevant.
- suggestion = one concrete sentence: the fix, the feature, or (for delight) what to protect.
- severity: high = wrong horticulture, fabrication, or something that would drive the user away; medium = real friction; low = polish.
- A clean, unremarkable conversation yields ZERO findings. That is a fine answer.

REPRO CASES (mandatory for every high/medium finding AND every delight):
Also emit "repro_case" — a distilled, replayable version of the moment, for a future regression/eval suite:
- transcript_excerpt: the MINIMAL exchange (2-6 lines, "USER:"/"SAGE:" format) that reproduces the moment. Trim everything inessential.
- expected_behavior: one or two sentences — exactly what Sage should have said or done there.
- forbidden_behavior: (nullable) what Sage must NOT say/do in that spot.
- context_notes: (nullable) garden state a replay would need (e.g. "user has 3 tomato plants, all mid-season, no new state changes").
For delights: expected_behavior = what Sage DID (the behavior to protect); forbidden_behavior = the regression to guard against.

BRAIN PROPOSALS (only when a finding implies a GLOBAL behavior fix, not a one-user preference):
Emit "brain_proposal" — a draft prompt-rule patch for human review (NEVER auto-applied):
- proposed_rule: the SMALLEST exact rule text that fixes the case, imperative style matching the current rules below. Smaller is better; never propose a broad rewrite.
- placement_hint: where it belongs (e.g. "new rule 11" or "strengthen rule 2").
- rationale: one sentence.
- FIRST check the CURRENT behavioral rules below. If the behavior is ALREADY covered by an existing rule, DO NOT propose a duplicate — set already_covered_by to e.g. "rule 2" and proposed_rule to a one-line note like "Already covered by rule 2 — model non-compliance; strengthen the rule or bank the eval case." That distinction matters more than a new rule.
Current behavioral rules in Sage's contract:
${'```'}
${SAGE_BEHAVIORAL_RULES.trim()}
${'```'}

AUTO-MEMORY (only in these narrow situations — this is the safe, per-user channel):
Emit "auto_memory" with a single "fact" string when EITHER:
(a) the user told Sage to stop asking about / mentioning / checking on something — fact like "Do not proactively bring up [topic]; user said stop — only if they raise it or the data changes materially"; or
(b) a repetition finding where the user showed annoyance or disengagement — fact like "Do not ask filler check-in questions ('how's X looking today?'); this user disengages from repeated questions. Ask only when there's a specific new reason (a plant changed state, they asked something, or genuine ambiguity)."; or
(c) a clear STABLE preference Sage ignored (response length, style, how they like to be talked to).
NEVER emit auto_memory about what the app can or cannot do (capabilities), about gardening facts (the normal memory system owns those), or for one-off requests. Suppressions and stable preferences only. Write the fact plainly in second person about the user.

Respond with ONLY a JSON array (possibly empty), no prose. Omit repro_case/brain_proposal/auto_memory keys when not applicable:
[{"finding_type":"...","severity":"...","evidence":"...","suggestion":"...","repro_case":{"transcript_excerpt":"...","expected_behavior":"...","forbidden_behavior":null,"context_notes":null},"brain_proposal":{"proposed_rule":"...","placement_hint":"...","rationale":"...","already_covered_by":null},"auto_memory":{"fact":"..."}}]`

/**
 * The analyst completion — Anthropic Claude Haiku DIRECT. Deliberately not
 * Sage's provider: the witness runs on a different model than the subject.
 * Returns raw text (a JSON array as a string). Throws on API failure so the
 * cron can skip that one conversation and continue.
 */
async function coachAnalyze(systemPrompt: string, userContent: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set — Coach analyst unavailable')

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: ANTHROPIC_ANALYST_MODEL,
      max_tokens: 4000,
      temperature: 0.2,
      system: systemPrompt,
      messages: [{ role: 'user', content: userContent }],
    }),
  })
  if (!res.ok) {
    const errText = await res.text().catch(() => 'unknown')
    throw new Error(`Coach analyst Anthropic ${res.status}: ${errText.slice(0, 200)}`)
  }
  const data = (await res.json()) as { content?: Array<{ text?: string }> }
  return data.content?.[0]?.text || '[]'
}

/**
 * Flatten one message's content to plain text for the transcript.
 *
 * CRITICAL: image content blocks carry base64 payloads that can be hundreds
 * of KB each. JSON.stringify-ing them floods the analyst's window and pushes
 * the real conversation out of view — which produced false-positive
 * "fabrication" findings (Sage's correct callback to something the user said
 * looked invented because the user's message had been shoved out by an image
 * blob). Replace any non-text block with a compact [image] marker, mirroring
 * what the main garden-ai extraction path already does.
 */
function flattenContent(content: unknown): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map((block) => {
        if (block && typeof block === 'object') {
          const b = block as { type?: string; text?: string }
          if (b.type === 'text' && typeof b.text === 'string') return b.text
          return '[image]'
        }
        return typeof block === 'string' ? block : '[image]'
      })
      .join(' ')
  }
  if (content && typeof content === 'object') {
    const b = content as { type?: string; text?: string }
    if (b.type === 'text' && typeof b.text === 'string') return b.text
    return '[image]'
  }
  return ''
}

/** Render a conversation's messages into a compact transcript for review. */
export function renderTranscript(
  messages: Array<{ role: string; content: unknown }>,
  maxChars = 6000,
): string {
  const lines = messages.map((m) => {
    const who = m.role === 'user' ? 'USER' : 'SAGE'
    return `${who}: ${flattenContent(m.content)}`
  })
  let out = lines.join('\n')
  if (out.length > maxChars) out = '…' + out.slice(-maxChars)
  return out
}

/** Review one conversation bundle → findings. */
export async function reviewConversation(bundle: ConversationBundle): Promise<CoachFinding[]> {
  const text = await coachAnalyze(
    COACH_SYSTEM_PROMPT,
    `User: ${bundle.userLabel}\n\nTranscript:\n${bundle.transcript}`,
  )

  // Tolerate fenced or prefixed JSON.
  const start = text.indexOf('[')
  if (start === -1) return []
  let raw = text.slice(start, (text.lastIndexOf(']') + 1) || undefined)
  try {
    // Repair a truncated array (maxTokens cut): drop the incomplete trailing
    // object and close the array — better to lose one finding than the night.
    try {
      JSON.parse(raw)
    } catch {
      const lastComplete = raw.lastIndexOf('},')
      if (lastComplete === -1) return []
      raw = raw.slice(0, lastComplete + 1) + ']'
    }
    const parsed = JSON.parse(raw) as CoachFinding[]
    return parsed
      .filter(
        (f) =>
          FINDING_TYPES.includes(f.finding_type) &&
          typeof f.evidence === 'string' &&
          f.evidence.length > 0,
      )
      .map((f) => ({
        ...f,
        // Drop malformed nested payloads rather than failing the finding.
        repro_case:
          f.repro_case &&
          typeof f.repro_case.transcript_excerpt === 'string' &&
          typeof f.repro_case.expected_behavior === 'string'
            ? f.repro_case
            : null,
        brain_proposal:
          f.brain_proposal && typeof f.brain_proposal.proposed_rule === 'string'
            ? f.brain_proposal
            : null,
        auto_memory:
          f.auto_memory &&
          typeof f.auto_memory.fact === 'string' &&
          f.auto_memory.fact.length > 0
            ? f.auto_memory
            : null,
      }))
  } catch {
    return []
  }
}

interface StoredConversation {
  messages?: Array<{ role: string; content: unknown }>
  updatedAt?: string
}

/** Shorten a Privy DID into a stable, human-scannable label. */
function labelForUser(userId: string): string {
  // did:privy:cmju7ppmx01m5l20c2pzijusm → privy:cmju…jusm
  const bare = userId.replace(/^did:privy:/, '')
  if (bare.length <= 12) return `privy:${bare}`
  return `privy:${bare.slice(0, 6)}…${bare.slice(-4)}`
}

/**
 * Gather the last-24h Sage conversations from KV.
 *
 * `garden:conv:{userId}` blobs carry their own `updatedAt`, so we window
 * correctly without any hot-path changes: KEYS the namespace, read each,
 * keep those touched since `sinceISO`. Review only the tail (prior nights
 * already reviewed older messages).
 */
export async function gatherConversations(sinceISO: string): Promise<ConversationBundle[]> {
  const keys = await kv.keys('garden:conv:*')
  const bundles: ConversationBundle[] = []
  const since = new Date(sinceISO).getTime()

  for (const key of keys) {
    try {
      const data = await kv.get<StoredConversation>(key)
      if (!data?.messages || data.messages.length === 0) continue
      const updatedAt = data.updatedAt ?? ''
      const ts = updatedAt ? new Date(updatedAt).getTime() : 0
      if (!ts || ts < since) continue // not touched in the window
      const userId = key.replace(/^garden:conv:/, '')
      bundles.push({
        userId,
        userLabel: labelForUser(userId),
        ref: `conversation:${userId}`,
        transcript: renderTranscript(data.messages.slice(-30)),
        updatedAt,
      })
    } catch (err) {
      console.error(`[Sage Coach] failed to read ${key}:`, err instanceof Error ? err.message : err)
    }
  }
  return bundles
}
