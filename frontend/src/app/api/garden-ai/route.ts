import { NextRequest, NextResponse } from 'next/server'
import { handleChat } from '@/lib/ai-runtime'
import type { AIMessage, BrainContext } from '@/lib/ai-runtime/types'
import { createGardenBrain } from '@/lib/ai/garden-brain'
import { kv } from '@vercel/kv'

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
    const { message, conversationHistory = [], userId, images, image } = body

    // Support both single image (legacy) and multiple images
    const imageList: { base64: string; mediaType: string }[] = images
      || (image ? [image] : [])

    if (!message && imageList.length === 0) {
      return NextResponse.json({ error: 'Message or image is required' }, { status: 400 })
    }

    // Build user message content — with images if provided
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
    const context: BrainContext = {
      userId: effectiveUserId,
      sessionId: effectiveUserId,
      messages,
    }

    const result = await handleChat(brain, context)

    return NextResponse.json({
      reply: result.cleanContent,
      usage: result.response.usage,
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
    return NextResponse.json({ messages: [] })
  }

  try {
    const data = await kv.get<{ messages: AIMessage[] }>(`garden:conv:${userId}`)
    const messages = (data?.messages || []).filter(m => m.role !== 'system')
    return NextResponse.json({ messages })
  } catch {
    return NextResponse.json({ messages: [] })
  }
}
