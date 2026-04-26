export const maxDuration = 60; // Allow up to 60s for AI responses

import { NextRequest, NextResponse, after } from 'next/server'
import type { AIMessage, MemoryFact } from '@/lib/ai-runtime/types'
import { getTextContent } from '@/lib/ai-runtime/types'
import { formatMemoryContext, extractMemories, mergeMemories } from '@/lib/ai-runtime/memory'
import { createRouter } from '@/lib/ai-runtime/router'
import { createGardenBrain } from '@/lib/ai/garden-brain'
import { buildGardenActionExtractionPrompt, parseGardenActions } from '@/lib/gardenActions'
import {
  buildSuggestionExtractionPrompt,
  parseSuggestion,
  saveSuggestion,
  shouldRunSuggestionExtraction,
} from '@/lib/sageSuggestions'
import { kv } from '@/lib/kv'
import { streamSageChat, completeSagePrompt, type SageMessage } from '@/lib/ai/sageProvider'
import { loadServerDismissals } from '@/lib/careDismissals'

const brain = createGardenBrain()

export async function POST(request: NextRequest) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'Garden AI is not configured. Please add ANTHROPIC_API_KEY to environment.' },
        { status: 500 }
      )
    }

    const body = await request.json()
    const { message, conversationHistory = [], userId, images, image, geohash, clientMemories, userContext: clientUserContext } = body

    // ─── Server-side IP geolocation fallback ───
    // If client didn't provide zone info (GPS denied), derive from Vercel's IP geo headers
    let userContext = clientUserContext || {}
    if (!userContext.zone) {
      const ipLat = request.headers.get('x-vercel-ip-latitude')
      const ipLng = request.headers.get('x-vercel-ip-longitude')
      const ipCity = request.headers.get('x-vercel-ip-city')
      const ipRegion = request.headers.get('x-vercel-ip-country-region')

      if (ipLat && ipLng) {
        try {
          // Dynamic import to avoid pulling in the full module at top level
          const { getGrowingProfile } = await import('@/lib/growingZones')
          const lat = parseFloat(ipLat)
          const lng = parseFloat(ipLng)
          if (!isNaN(lat) && !isNaN(lng)) {
            const profile = getGrowingProfile(lat, lng)
            userContext = {
              zone: profile.zone,
              lastFrostDate: profile.lastSpringFrost?.toISOString().split('T')[0],
              firstFrostDate: profile.firstFallFrost?.toISOString().split('T')[0],
              growingSeasonDays: profile.growingSeasonDays,
              isTropical: profile.isTropical || undefined,
              isSouthernHemisphere: profile.isSouthernHemisphere || undefined,
              confidence: 'ip-estimated',
              latitude: lat,
              longitude: lng,
              locationName: ipCity ? (ipRegion ? `${ipCity}, ${ipRegion}` : ipCity) : undefined,
            }
          }
        } catch {
          // growingZones import failed — non-critical, continue without
        }
      }
    }

    const imageList: { base64: string; mediaType: string }[] = images
      || (image ? [image] : [])

    if (!message && imageList.length === 0) {
      return NextResponse.json({ error: 'Message or image is required' }, { status: 400 })
    }

    // Build user message content
    let userContent: AIMessage['content']
    if (imageList.length > 0) {
      userContent = [
        ...imageList.map(img => ({
          type: 'image' as const,
          source: { type: 'base64' as const, media_type: img.mediaType, data: img.base64 },
        })),
        { type: 'text' as const, text: message || 'What is this plant? Any issues you can see?' },
      ]
    } else {
      userContent = message
    }

    const messages: AIMessage[] = [
      ...conversationHistory.map((m: { role: string; content: string }) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user' as const, content: userContent },
    ]

    const effectiveUserId = userId || 'anonymous'

    // ─── Pre-LLM pipeline (parallel KV loads, client fallback) ───
    const [soulText, cloudMemories, dismissals] = await Promise.all([
      brain.loadSoul?.().catch(() => null) ?? null,
      brain.loadMemories?.(effectiveUserId).catch(() => []) ?? [],
      loadServerDismissals(effectiveUserId).catch(() => ({})),
    ])

    // Use cloud memories if available, otherwise fall back to client-sent memories
    const memories = (cloudMemories && (cloudMemories as MemoryFact[]).length > 0)
      ? cloudMemories
      : (clientMemories as MemoryFact[] || [])

    const ctx = { userId: effectiveUserId, sessionId: effectiveUserId, messages, geohash: geohash || undefined, userContext, dismissals }
    const systemPrompt = await brain.getSystemPrompt(ctx)
    const gardenContext = await brain.loadContext(ctx)
    const memoryContext = formatMemoryContext(memories as MemoryFact[], soulText)
    const fullSystemPrompt = memoryContext + systemPrompt + gardenContext

    // Window messages to last 20
    const windowSize = 20
    let llmMessages = messages
    if (messages.length > windowSize) {
      llmMessages = messages.slice(-windowSize)
    }

    // ─── Build messages for Sage provider (Venice or Anthropic) ─────
    // Extract any system messages from history into the systemPrompt; keep
    // user/assistant turns. Provider handles its own format conversion.
    const systemParts: string[] = [fullSystemPrompt]
    const apiMessages: SageMessage[] = []

    for (const msg of llmMessages) {
      if (msg.role === 'system') {
        systemParts.push(getTextContent(msg.content))
      } else if (msg.role === 'user' || msg.role === 'assistant') {
        apiMessages.push({ role: msg.role, content: msg.content as SageMessage['content'] })
      }
    }

    const finalSystemPrompt = systemParts.join('\n\n')

    // Shared state for the stream — captured by after() closure
    const streamState = {
      fullResponse: '',
      done: false,
      extractedMemories: null as MemoryFact[] | null,
    }

    const encoder = new TextEncoder()

    const stream = new ReadableStream({
      async start(controller) {
        try {
          // streamSageChat picks Venice or Anthropic per env var, with fallback
          for await (const text of streamSageChat({
            systemPrompt: finalSystemPrompt,
            messages: apiMessages,
            maxTokens: 2000,
          })) {
            streamState.fullResponse += text
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`))
          }

          streamState.done = true

          // Send current memories to client for localStorage backup
          if (memories && (memories as MemoryFact[]).length > 0) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ memories })}\n\n`))
          }

          // Extract garden actions from conversation (if user is logged in)
          if (userId && streamState.fullResponse) {
            try {
              const recentForActions: AIMessage[] = [
                ...messages.slice(-3),
                { role: 'assistant', content: streamState.fullResponse },
              ]
              const extractionPrompt = buildGardenActionExtractionPrompt(recentForActions)
              const actionText = await completeSagePrompt({
                prompt: extractionPrompt,
                maxTokens: 500,
              })
              console.log('[Garden AI] Action extraction raw:', actionText.slice(0, 200))
              const actions = parseGardenActions(actionText)
              if (actions.length > 0) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ gardenActions: actions })}\n\n`))
                console.log('[Garden AI] Extracted', actions.length, 'garden actions:', JSON.stringify(actions))
              } else {
                console.log('[Garden AI] No actions extracted from conversation')
              }
            } catch (err) {
              console.error('[Garden AI] Garden action extraction failed:', err)
            }
          }

          controller.enqueue(encoder.encode(`data: [DONE]\n\n`))
          controller.close()
        } catch (err) {
          console.error('[Garden AI] Stream error:', err)
          streamState.done = true
          controller.error(err)
        }
      },
    })

    // ─── Schedule memory extraction to run AFTER response is sent ───
    // after() keeps the function alive after the response completes,
    // so slow operations (like another Anthropic API call) don't block the user
    after(async () => {
      // Wait for stream to finish populating fullResponse
      const maxWait = 60_000
      const start = Date.now()
      while (!streamState.done && Date.now() - start < maxWait) {
        await new Promise(r => setTimeout(r, 100))
      }

      if (!streamState.fullResponse) return

      // ─── Save conversation to cloud (best-effort backup) ───
      try {
        const allMessages: AIMessage[] = [
          ...messages,
          { role: 'assistant' as const, content: streamState.fullResponse },
        ]
        await kv.set(`garden:conv:${effectiveUserId}`, { messages: allMessages })
        console.log('[Garden AI] Conv saved for:', effectiveUserId, 'msgs:', allMessages.length)
      } catch (err) {
        console.error('[Garden AI] Conv save failed (non-critical):', String(err))
      }

      // ─── Extract and save memories ───
      try {
        if (brain.memoryConfig?.entityMemory?.enabled && brain.saveMemories) {
          const router = createRouter(brain.routerConfig)
          const recentForExtraction: AIMessage[] = [
            ...messages.slice(-3),
            { role: 'assistant', content: streamState.fullResponse },
          ]
          const mc = brain.memoryConfig.entityMemory
          const newFacts = await extractMemories(router, mc, recentForExtraction, memories as MemoryFact[])
          if (newFacts.length > 0) {
            const mergedMems = mergeMemories(memories as MemoryFact[], newFacts, mc.maxFacts ?? 100)
            await brain.saveMemories(effectiveUserId, mergedMems)
            console.log('[Garden AI] Extracted', newFacts.length, 'memories for:', effectiveUserId)
          }
        }
      } catch (err) {
        console.error('[Garden AI] Memory extraction failed:', err)
      }

      // ─── Extract Sage suggestion (if user confirmed a capture) ───
      // Cheap heuristic prefilter: only run the Haiku call when Sage's
      // last message contains a confirmation phrase. Keeps cost ~zero
      // on chats that don't capture anything.
      try {
        const recentForSuggestion: AIMessage[] = [
          ...messages.slice(-6),
          { role: 'assistant', content: streamState.fullResponse },
        ]
        if (shouldRunSuggestionExtraction(recentForSuggestion)) {
          const prompt = buildSuggestionExtractionPrompt(recentForSuggestion)
          try {
            const sugText = await completeSagePrompt({
              prompt,
              maxTokens: 400,
            })
            const extracted = parseSuggestion(sugText)
            if (extracted) {
              const anonKey =
                request.headers.get('x-vercel-forwarded-for') ||
                request.headers.get('x-forwarded-for') ||
                null
              const cleanUserId = userId && userId !== 'anonymous' ? userId : null
              const saved = await saveSuggestion(extracted, cleanUserId, anonKey)
              if (saved) {
                console.log(
                  '[Garden AI] Sage suggestion captured:',
                  saved.id,
                  saved.category,
                  saved.area,
                )
              }
            } else {
              console.log('[Garden AI] Suggestion prefilter passed but extraction returned null')
            }
          } catch (sugErr) {
            console.error(
              '[Garden AI] Suggestion extraction call failed:',
              sugErr instanceof Error ? sugErr.message : String(sugErr),
            )
          }
        }
      } catch (err) {
        console.error('[Garden AI] Suggestion extraction failed:', err)
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error)
    console.error('[Garden AI] Error:', errMsg, error)
    return NextResponse.json(
      { error: `Failed to get response from Garden AI: ${errMsg}` },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId')
  if (!userId) {
    return NextResponse.json({ messages: [], memories: [] })
  }

  try {
    const [convData, memories] = await Promise.all([
      kv.get<{ messages: AIMessage[] }>(`garden:conv:${userId}`).catch(() => null),
      kv.get<MemoryFact[]>(`garden:memories:${userId}`).catch(() => null),
    ])
    const messages = (convData?.messages || []).filter(m => m.role !== 'system')
    return NextResponse.json({ messages, memories: memories || [] })
  } catch {
    return NextResponse.json({ messages: [], memories: [] })
  }
}

/**
 * DELETE /api/garden-ai?userId=...
 *
 * Clears the user's conversation history from KV. Used by the "New conversation"
 * button in Sage's chat UI. Memories are preserved — those are accumulated facts
 * about the user that are valuable across conversations. Only the back-and-forth
 * messages are wiped, which fixes the conversation-priming issue where Sage gets
 * stuck saying "I don't have access" after one bad exchange.
 *
 * The client also needs to clear its localStorage `garden:conv:{userId}` key —
 * this endpoint just handles the cloud backup side.
 */
export async function DELETE(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId')
  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 })
  }
  try {
    await kv.del(`garden:conv:${userId}`)
    console.log('[Garden AI] Conversation cleared for:', userId)
    return NextResponse.json({ ok: true, cleared: 'conversation' })
  } catch (err) {
    console.error('[Garden AI] Failed to clear conversation:', err)
    return NextResponse.json(
      { error: 'Failed to clear conversation', detail: String(err) },
      { status: 500 },
    )
  }
}
