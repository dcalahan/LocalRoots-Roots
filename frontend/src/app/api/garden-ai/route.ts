import { NextRequest, NextResponse } from 'next/server'
import { handleChat } from '@common-area/ai-runtime'
import type { AIMessage, BrainContext } from '@common-area/ai-runtime/types'
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
    const { message, conversationHistory = [], userId } = body

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    const messages: AIMessage[] = [
      ...conversationHistory.map((m: { role: string; content: string }) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user' as const, content: message },
    ]

    const context: BrainContext = {
      userId: userId || 'anonymous',
      sessionId: userId || undefined,
      messages,
    }

    const result = await handleChat(brain, context)

    return NextResponse.json({
      reply: result.cleanContent,
      usage: result.response.usage,
    })
  } catch (error) {
    console.error('[Garden AI] Error:', error)
    return NextResponse.json(
      { error: 'Failed to get response from Garden AI' },
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
