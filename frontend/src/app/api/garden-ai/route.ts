export const maxDuration = 60; // Allow up to 60s for AI responses

import { NextRequest, NextResponse, after } from 'next/server'
import type { AIMessage, MemoryFact } from '@/lib/ai-runtime/types'
import { getTextContent } from '@/lib/ai-runtime/types'
import { formatMemoryContext, extractMemories, mergeMemories } from '@/lib/ai-runtime/memory'
import { createRouter } from '@/lib/ai-runtime/router'
import { createGardenBrain } from '@/lib/ai/garden-brain'
import { buildGardenActionExtractionPrompt, parseGardenActions } from '@/lib/gardenActions'
import { kv } from '@/lib/kv'

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
    const [soulText, cloudMemories] = await Promise.all([
      brain.loadSoul?.().catch(() => null) ?? null,
      brain.loadMemories?.(effectiveUserId).catch(() => []) ?? [],
    ])

    // Use cloud memories if available, otherwise fall back to client-sent memories
    const memories = (cloudMemories && (cloudMemories as MemoryFact[]).length > 0)
      ? cloudMemories
      : (clientMemories as MemoryFact[] || [])

    const ctx = { userId: effectiveUserId, sessionId: effectiveUserId, messages, geohash: geohash || undefined, userContext }
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

    // ─── Build Anthropic request with streaming ─────────────
    const systemParts: string[] = [fullSystemPrompt]
    const apiMessages: { role: string; content: AIMessage['content'] }[] = []

    for (const msg of llmMessages) {
      if (msg.role === 'system') {
        systemParts.push(getTextContent(msg.content))
      } else {
        apiMessages.push({ role: msg.role, content: msg.content })
      }
    }

    if (apiMessages.length > 0 && apiMessages[0].role === 'assistant') {
      apiMessages.unshift({ role: 'user', content: '(conversation continues)' })
    }

    // Merge consecutive same-role (only strings)
    const merged: { role: string; content: AIMessage['content'] }[] = []
    for (const msg of apiMessages) {
      const prev = merged.length > 0 ? merged[merged.length - 1] : null
      if (prev && prev.role === msg.role && typeof prev.content === 'string' && typeof msg.content === 'string') {
        prev.content += '\n\n' + msg.content
      } else {
        merged.push({ ...msg })
      }
    }

    const anthropicBody = {
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      stream: true,
      system: systemParts.join('\n\n'),
      messages: merged,
    }

    // ─── Stream from Anthropic ──────────────────────────────
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(anthropicBody),
    })

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text().catch(() => 'Unknown error')
      console.error('[Garden AI] Anthropic error:', anthropicRes.status, errText)
      return NextResponse.json(
        { error: `AI service error: ${anthropicRes.status}` },
        { status: 502 }
      )
    }

    // Shared state for the stream — captured by after() closure
    const streamState = {
      fullResponse: '',
      done: false,
      extractedMemories: null as MemoryFact[] | null,
    }

    const encoder = new TextEncoder()

    const stream = new ReadableStream({
      async start(controller) {
        const reader = anthropicRes.body!.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() ?? ''

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6).trim()
                if (data === '[DONE]') continue

                try {
                  const event = JSON.parse(data)
                  if (event.type === 'content_block_delta' && event.delta?.text) {
                    const text = event.delta.text
                    streamState.fullResponse += text
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`))
                  }
                } catch {
                  // Skip malformed SSE events
                }
              }
            }
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
              const actionRes = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'x-api-key': process.env.ANTHROPIC_API_KEY!,
                  'anthropic-version': '2023-06-01',
                },
                body: JSON.stringify({
                  model: 'claude-haiku-4-5-20251001',
                  max_tokens: 500,
                  messages: [{ role: 'user', content: extractionPrompt }],
                }),
              })
              if (actionRes.ok) {
                const actionData = await actionRes.json()
                const actionText = actionData.content?.[0]?.text || ''
                const actions = parseGardenActions(actionText)
                if (actions.length > 0) {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ gardenActions: actions })}\n\n`))
                  console.log('[Garden AI] Extracted', actions.length, 'garden actions for:', effectiveUserId)
                }
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
