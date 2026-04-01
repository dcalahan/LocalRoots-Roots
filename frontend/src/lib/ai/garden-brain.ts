/**
 * Garden Brain — implements the Common Area Brain interface for Local Roots Garden AI.
 *
 * A gardening assistant that remembers user preferences (zone, plants, soil type)
 * across sessions. Uses Vercel KV for persistence (same infra as ambassador payments).
 */

import type {
  Brain,
  BrainContext,
  AIMessage,
  MemoryFact,
  RouterConfig,
  MemoryConfig,
} from '@/lib/ai-runtime/types'
import { kv } from '@vercel/kv'
import cropGrowingData from '@/data/crop-growing-data.json'
import techniqueGuides from '@/data/technique-guides.json'

// ─── KV Key Helpers ────────────────────────────────────────

const kvKey = {
  memories: (userId: string) => `garden:memories:${userId}`,
  conversation: (userId: string) => `garden:conv:${userId}`,
  soul: () => 'garden:soul',
}

// ─── Garden Context Builder ────────────────────────────────

function buildGardenContext(): string {
  const popularCrops = [
    'tomato-cherry', 'tomato-beefsteak', 'pepper-bell-green', 'cucumber',
    'lettuce-romaine', 'spinach', 'carrot', 'basil', 'cilantro', 'onion-yellow',
    'garlic', 'potato', 'broccoli', 'kale', 'radish', 'beet', 'okra',
    'squash-zucchini', 'bean-snap', 'pea-sugar-snap', 'corn-sweet',
  ]

  const crops = (cropGrowingData as { crops: Record<string, any> }).crops

  const cropSummaries = popularCrops
    .filter(id => crops[id])
    .map(id => {
      const crop = crops[id]
      const startIndoors = crop.startIndoors
        ? `Start indoors ${crop.startIndoors.weeksBeforeLastFrost} weeks before last frost`
        : null
      const directSow = crop.directSow
        ? `Direct sow ${crop.directSow.weeksAfterLastFrost || 0} weeks after last frost (soil temp ${crop.directSow.minSoilTempF}°F+)`
        : null
      const transplant = crop.transplant
        ? `Transplant ${crop.transplant.weeksAfterLastFrost || 0} weeks after last frost`
        : null

      return `**${crop.name}**: ${[startIndoors, directSow, transplant].filter(Boolean).join('. ')}. Days to maturity: ${crop.daysToMaturity.min}-${crop.daysToMaturity.max}. ${crop.tips?.[0] || ''}`
    })
    .join('\n')

  const guides = (techniqueGuides as { guides: Record<string, any> }).guides
  const guideSummaries = Object.values(guides)
    .map((guide: any) => `**${guide.title}**: ${guide.description}`)
    .join('\n')

  return `
LOCAL ROOTS GROWING GUIDE DATA:

USDA Hardiness Zones determine planting dates based on frost:
- Zone 4-5: Last frost mid-May, first frost early October
- Zone 6: Last frost late April, first frost mid-October
- Zone 7: Last frost mid-April, first frost late October
- Zone 8: Last frost late March, first frost mid-November
- Zone 9-10: Last frost February or year-round growing

CROP PLANTING GUIDE:
${cropSummaries}

TECHNIQUE GUIDES AVAILABLE:
${guideSummaries}

NATURAL GROWING PRINCIPLES:
- Build healthy soil with compost and mulch
- Encourage beneficial insects (ladybugs, lacewings, parasitic wasps)
- Use row covers for pest prevention
- Natural pest remedies: neem oil, insecticidal soap, BT for caterpillars
- Companion planting: tomatoes + basil, carrots + onions, Three Sisters (corn + beans + squash)
- Water at soil level to prevent disease, mulch to retain moisture
`
}

// ─── Initial Soul ──────────────────────────────────────────

const INITIAL_GARDEN_SOUL = `GARDEN ASSISTANT SOUL — LEARNED BEHAVIORS:

COMMUNICATION STYLE:
- Keep answers concise but helpful (2-4 paragraphs max unless they ask for detail)
- Be encouraging — gardening should be fun!
- Recommend natural/organic methods over chemical solutions
- If you don't know something specific, say so honestly

GARDENING KNOWLEDGE:
- Always consider the user's zone when giving timing advice
- Mention companion planting opportunities naturally
- Suggest succession planting for continuous harvests
- Remind about soil health as the foundation of good growing
- Recommend starting small for new gardeners

LOCAL ROOTS CONTEXT:
- Users may be sellers on the LocalRoots marketplace (neighbors selling homegrown produce)
- Mention Local Roots features when relevant (planting calendar, technique guides)
- If someone asks about selling produce, encourage them to check out the sell page

If someone asks about something unrelated to gardening, politely redirect to gardening topics.`

// ─── Router Config ─────────────────────────────────────────

function getGardenRouterConfig(): RouterConfig {
  return {
    tiers: {
      standard: {
        provider: 'anthropic',
        model: 'claude-haiku-4-5-20251001',
        endpoint: 'https://api.anthropic.com/v1/messages',
        apiKey: process.env.ANTHROPIC_API_KEY || '',
      },
    },
  }
}

// ─── Memory Config ─────────────────────────────────────────

const gardenMemoryConfig: MemoryConfig = {
  conversationWindow: {
    enabled: true,
    windowSize: 20,
    summarizeThreshold: 30,
  },
  entityMemory: {
    enabled: true,
    maxFacts: 100,
    extractionPrompt: `You extract gardening-related facts about a user from their conversations. Return ONLY a JSON array of new facts worth remembering for future conversations. Focus on: their growing zone, garden setup, plants they grow, soil type, experience level, and gardening goals.`,
    categories: [
      'garden_setup',        // zone, bed type, irrigation, soil
      'growing_preference',  // organic, favorite crops, companion planting style
      'garden_history',      // what they grew, pest issues, harvests
      'schedule',            // planting dates, watering schedule
      'personal',            // experience level, goals
    ],
  },
  soul: {
    enabled: true,
    initialSoul: INITIAL_GARDEN_SOUL,
  },
}

// ─── Create Garden Brain ───────────────────────────────────

export function createGardenBrain(): Brain {
  return {
    productSlug: 'local-roots',
    routerConfig: getGardenRouterConfig(),
    memoryConfig: gardenMemoryConfig,
    actionTypes: [],

    getSystemPrompt(ctx: BrainContext): string {
      const today = new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })

      return `You are the Local Roots Garden Assistant, a friendly and knowledgeable AI helper for home gardeners. You help people grow food successfully using natural, organic methods.

Today is ${today}. Use this date for seasonal recommendations — tell users what to plant NOW, what to start indoors, and what to prepare for next season.

Your knowledge includes:
- When to plant vegetables based on hardiness zones and frost dates
- Seed starting, transplanting, and harvesting timing
- Natural pest control and disease prevention
- Companion planting and crop rotation
- Composting, soil building, and organic fertilizers
- Raised bed gardening and space optimization

GUIDELINES:
1. Give practical, actionable advice based on the user's zone if known
2. Recommend natural/organic methods over chemical solutions
3. Be encouraging - gardening should be fun!
4. Keep answers concise but helpful (2-4 paragraphs max unless they ask for detail)
5. If you don't know something specific, say so and suggest they research further
6. Mention Local Roots features when relevant (planting calendar, technique guides)
7. For zone-specific timing, always clarify what zone you're assuming if not specified
8. When the user shares a photo, identify the plant, diagnose any visible issues (pests, disease, nutrient deficiency), and give actionable advice

If someone asks about something unrelated to gardening, politely redirect to gardening topics.`
    },

    async loadContext(_ctx: BrainContext): Promise<string> {
      return buildGardenContext()
    },

    // ─── Memory Persistence (Vercel KV) ─────────────────

    async loadMemories(userId: string): Promise<MemoryFact[]> {
      try {
        const data = await kv.get<MemoryFact[]>(kvKey.memories(userId))
        return data || []
      } catch {
        return []
      }
    },

    async saveMemories(userId: string, memories: MemoryFact[]): Promise<void> {
      await kv.set(kvKey.memories(userId), memories)
    },

    async loadSoul(): Promise<string> {
      try {
        const soul = await kv.get<string>(kvKey.soul())
        return (soul || INITIAL_GARDEN_SOUL) + '\n\n'
      } catch {
        return INITIAL_GARDEN_SOUL + '\n\n'
      }
    },

    async loadConversationSummary(sessionId: string): Promise<string | null> {
      try {
        const data = await kv.get<{ messages: AIMessage[]; summary?: string }>(kvKey.conversation(sessionId))
        return data?.summary ?? null
      } catch {
        return null
      }
    },

    async saveConversation(
      sessionId: string,
      messages: AIMessage[],
      summary?: string,
    ): Promise<void> {
      const data: { messages: AIMessage[]; summary?: string } = { messages }
      if (summary !== undefined) data.summary = summary
      await kv.set(kvKey.conversation(sessionId), data)
    },
  }
}
