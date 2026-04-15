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
import { kv } from '@/lib/kv'
import cropGrowingData from '@/data/crop-growing-data.json'
import techniqueGuides from '@/data/technique-guides.json'
import communityRecipes from '@/data/community-recipes.json'
import lowcountryData from '@/data/regional/lowcountry-8a.json'
import appKnowledge from '@/data/app-knowledge.json'
import { detectCareAlerts } from '@/lib/careAlerts'
import type { GardenPlant } from '@/types/my-garden'

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

// ─── Recipe Context Builder ───────────────────────────────

function buildRecipeContext(): string {
  const recipes = communityRecipes.recipes
  const recipeLines = recipes.map(r =>
    `- **${r.name}** (${r.credit}): Garden ingredients: ${r.gardenIngredients.join(', ')}. Pantry: ${r.pantryIngredients.join(', ')}. Seasons: ${r.seasons.join(', ')}. ${r.suggestion}`
  ).join('\n')

  return `
COMMUNITY RECIPES (from LocalRoots neighbors):
${recipeLines}

RECIPE GUIDANCE:
- When a user mentions growing a specific crop, suggest COMPANION CROPS that complete a recipe
  Example: User grows tomatoes → suggest planting corn, okra, and cilantro → "Your neighbor Karen makes an amazing 'Summer in a Pan' with those — corn, cherry tomatoes, okra, red onion, cilantro"
- Think of recipes as a REASON TO GROW specific crops, not just an afterthought
- Connect the garden plan to the dinner table — help them plant with meals in mind
- When the user is growing multiple recipe ingredients, share the full recipe
- Mention that recipes come from the LocalRoots community — real neighbors sharing real food
`
}

// ─── Local Listings Fetcher ───────────────────────────────

async function fetchLocalListings(geohash: string): Promise<string> {
  try {
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.NEXT_PUBLIC_VERCEL_URL
        ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
        : 'http://localhost:3000'
    const res = await fetch(`${baseUrl}/api/garden-ai/local?geohash=${encodeURIComponent(geohash)}`, {
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return ''
    const data = await res.json()
    if (!data.produce?.length) return ''

    const lines = data.produce.map((p: { produceName: string; category: string; sellerCount: number }) =>
      `- ${p.produceName} (${p.sellerCount} seller${p.sellerCount > 1 ? 's' : ''})`
    ).join('\n')

    return `
WHAT'S GROWING NEAR YOU (active LocalRoots listings):
${lines}
Total nearby sellers: ${data.totalSellers}

Use this info naturally:
- Mention what neighbors are selling when relevant
- Encourage the user to check the LocalRoots marketplace to buy from or sell to neighbors
- If they're growing something neighbors sell, mention it as community connection
`
  } catch {
    return ''
  }
}

// ─── Enhanced General Advice (from expert consultation) ──────

function buildEnhancedGeneralContext(): string {
  return `
ADVANCED PLANTING TECHNIQUES:
- Tomatoes: Plant DEEP — strip lower leaves, bury stem up to top 4-5 leaves. Roots grow along buried stem = stronger plant. Space 24-36 inches for airflow.
- Peppers: Plant deep like tomatoes. Space 18 inches. Slow to establish — normal to look sad for 2-3 weeks after transplant.
- Cucumbers: Train vertically on trellis — saves space, better airflow, easier harvest. South-facing walls provide heat boost.
- Lettuce: Plant shallow, harvest outer leaves progressively to extend season. Stagger plantings 2 weeks apart. Replace with basil when it bolts in summer heat.
- Mint: CONTAINER ONLY — will take over an entire bed in one season.

PHOTO IDENTIFICATION PROTOCOL:
When a user sends a plant photo:
1. Start with observable features: leaf shape, texture, arrangement (opposite vs alternate), color
2. Note growth habit: spreading, upright, vining, tree vs shrub
3. Ask about smell when crushed — often the most definitive identifier
4. Note location context: forest edge, sun/shade, bed type, other nearby plants
5. Look for flowers or fruit — most definitive for ID
6. Give 2-3 best guesses with distinguishing features between them
7. If uncertain, advise waiting for flowering before making a definitive call
8. NEVER advise removal of an unidentified plant — always wait for confirmed ID

PHOTO DIAGNOSIS TIPS:
- Yellow leaves = freeze stress, iron deficiency, overwatering, or nutrient lockout
- Pink/red roots = alive and actively growing (good sign)
- Multiple stems from crown base = shrub recovering from damage (let it grow)
- Construction debris (white crumbly material) = stucco/concrete raising soil pH
- Tarp line (black dyed mulch vs natural brown) = developer damage to established plantings

PROPAGATION BASICS:
- Stem cuttings: Take 4-6 inch tips, strip lower leaves, dip in rooting hormone, plant in moist well-draining mix
- Division: Best for clumping plants (iris, thyme, ornamental grasses) — dig up, pull apart, replant immediately
- Layering: Pin a low stem to soil while still attached to mother plant — it roots naturally
- Always propagate in the plant's active growth season for best success

GARDEN DESIGN PHILOSOPHY:
- Treat every garden as a mystery to solve collaboratively with the user
- Previous owners often left valuable plants — always look before removing anything
- Established plants have irreplaceable value — resist the impulse to clear everything
- Match plant selection to the user's actual maintenance commitment level
- Celebrate discoveries — finding a surviving established plant is genuinely exciting
`
}

// ─── App Knowledge Context (from app-knowledge.json) ──────────

function buildAppKnowledgeContext(): string {
  const ak = appKnowledge as {
    overview: string
    sections: { id: string; name: string; description: string; routes: { path: string; name: string; description: string; authRequired: boolean }[] }[]
    flows: { id: string; trigger: string; steps: string[] }[]
    seeds: Record<string, string>
    auth: Record<string, string>
    tone: string[]
  }

  let ctx = `\nLOCAL ROOTS APP GUIDE — Use this to help users navigate the app:\n\n`
  ctx += `WHAT IS LOCAL ROOTS:\n${ak.overview}\n\n`

  // Sections & routes
  for (const section of ak.sections) {
    if (section.id === 'other') {
      ctx += `OTHER PAGES:\n`
    } else {
      ctx += `${section.name.toUpperCase()} SECTION (/${section.id}):\n`
    }
    for (const route of section.routes) {
      ctx += `- ${route.name} (${route.path}): ${route.description}\n`
    }
    ctx += '\n'
  }

  // Seeds
  ctx += `SEEDS REWARDS:\n`
  ctx += `- Sellers earn ${ak.seeds.sellers}\n`
  ctx += `- Buyers earn ${ak.seeds.buyers}\n`
  ctx += `- Ambassadors earn ${ak.seeds.ambassadors}\n`
  ctx += `- Early adopter bonus: ${ak.seeds.earlyAdopter}\n`
  ctx += `- ${ak.seeds.conversion}\n`
  ctx += `- Leaderboard: ${ak.seeds.leaderboard}\n\n`

  // Auth
  ctx += `SIGN-IN OPTIONS:\n`
  ctx += `- Sellers & Ambassadors: ${ak.auth.sellersAmbassadors}\n`
  ctx += `- Crypto Buyers: ${ak.auth.cryptoBuyers}\n`
  ctx += `- Credit Card Buyers: ${ak.auth.creditCardBuyers}\n\n`

  // Flows
  ctx += `KEY FLOWS TO GUIDE USERS THROUGH:\n`
  for (const flow of ak.flows) {
    ctx += `When ${flow.trigger}:\n`
    flow.steps.forEach((step, i) => { ctx += `  ${i + 1}. ${step}\n` })
    ctx += '\n'
  }

  // Tone
  ctx += `HOW TO GUIDE USERS:\n`
  for (const rule of ak.tone) {
    ctx += `- ${rule}\n`
  }

  return ctx
}

// ─── Regional Knowledge Loader ──────────────────────────────

interface RegionalData {
  regionId: string
  name: string
  zone: string
  matchZones: string[]
  matchLocations: string[]
  climate: Record<string, string>
  deer?: { severity: string; resistantPlants: string[]; vulnerablePlants: string[]; protectionMethods: string[] }
  vegetables?: { plantingCalendar: { crop: string; when: string; notes: string }[]; recommendedVarieties: Record<string, string[]>; fungalDisease?: { pressure: string; prevention: string[] } }
  ornamentals?: Record<string, unknown>
  edibles?: Record<string, unknown>
  soil?: Record<string, unknown>
  troubleshooting?: { problem: string; cause: string; solution: string }[]
  localResources?: Record<string, unknown>
  seasonalCalendar?: Record<string, { months: string; activities: string[] }>
  designPrinciples?: Record<string, unknown>
}

// Registry of regional knowledge bases — add new regions here
const REGIONAL_DATA: RegionalData[] = [lowcountryData as unknown as RegionalData]

function findRegionalKnowledge(zone?: string, locationName?: string): RegionalData | null {
  if (!zone && !locationName) return null

  for (const region of REGIONAL_DATA) {
    // Match by location name (most specific)
    if (locationName) {
      const lower = locationName.toLowerCase()
      if (region.matchLocations.some(loc => lower.includes(loc))) return region
    }
    // Match by zone
    if (zone && region.matchZones.includes(zone)) return region
  }
  return null
}

function buildRegionalContext(region: RegionalData): string {
  let ctx = `\nREGIONAL EXPERTISE — ${region.name} (Zone ${region.zone}):\n`
  ctx += `You have deep local knowledge of this area. Use it to give hyperlocal advice.\n\n`

  // Climate
  const c = region.climate
  ctx += `CLIMATE: ${c.note || ''}. Summer highs ${c.summerHighs || 'N/A'}. `
  ctx += `Annual rainfall ${c.annualRainfall || 'N/A'}. `
  if (c.saltExposure) ctx += `Salt exposure: ${c.saltExposure}. `
  if (c.humidity) ctx += `Humidity: ${c.humidity}.\n\n`

  // Seasonal calendar
  if (region.seasonalCalendar) {
    ctx += `SEASONAL CALENDAR:\n`
    for (const [season, info] of Object.entries(region.seasonalCalendar)) {
      ctx += `- ${season.charAt(0).toUpperCase() + season.slice(1)} (${info.months}): ${info.activities.join('. ')}.\n`
    }
    ctx += '\n'
  }

  // Soil
  if (region.soil) {
    const s = region.soil as Record<string, unknown>
    ctx += `LOCAL SOIL: ${s.type || 'N/A'}. pH ${s.ph || 'N/A'}. `
    if (s.bestAmendment) ctx += `Best amendment: ${s.bestAmendment}. `
    const warnings = s.warnings as string[] | undefined
    if (warnings?.length) ctx += `Warnings: ${warnings.join('. ')}. `
    ctx += '\n\n'
  }

  // Deer
  if (region.deer) {
    const d = region.deer
    ctx += `DEER PRESSURE: ${d.severity}\n`
    ctx += `Deer-resistant plants: ${d.resistantPlants.join(', ')}\n`
    ctx += `Vulnerable (protect these): ${d.vulnerablePlants.join(', ')}\n`
    ctx += `Protection methods: ${d.protectionMethods.join('. ')}.\n\n`
  }

  // Vegetable specifics
  if (region.vegetables) {
    const v = region.vegetables
    ctx += `LOCAL VEGETABLE GUIDE:\n`
    for (const item of v.plantingCalendar) {
      ctx += `- ${item.crop} (${item.when}): ${item.notes}\n`
    }
    if (v.recommendedVarieties) {
      ctx += `\nRECOMMENDED VARIETIES FOR THIS AREA:\n`
      for (const [crop, varieties] of Object.entries(v.recommendedVarieties)) {
        ctx += `- ${crop}: ${varieties.join(', ')}\n`
      }
    }
    if (v.fungalDisease) {
      ctx += `\nFUNGAL DISEASE: Pressure is ${v.fungalDisease.pressure}. Prevention: ${v.fungalDisease.prevention.join('. ')}.\n`
    }
    ctx += '\n'
  }

  // Troubleshooting
  if (region.troubleshooting) {
    ctx += `COMMON LOCAL PROBLEMS:\n`
    for (const t of region.troubleshooting) {
      ctx += `- ${t.problem}: ${t.cause} → ${t.solution}\n`
    }
    ctx += '\n'
  }

  // Local resources
  if (region.localResources) {
    const lr = region.localResources as Record<string, unknown>
    const nurseries = lr.nurseries as string[] | undefined
    const extension = lr.extension as string | undefined
    if (nurseries?.length) ctx += `LOCAL NURSERIES: ${nurseries.join(', ')}\n`
    if (extension) ctx += `EXTENSION SERVICE: ${extension}\n`
    const hoaNotes = lr.hoaNotes as string | undefined
    if (hoaNotes) ctx += `HOA NOTE: ${hoaNotes}\n`
  }

  return ctx
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

If someone asks about something unrelated to gardening or LocalRoots, politely redirect.`

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
      const now = new Date()
      const today = now.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
      const uc = (ctx as BrainContext & { userContext?: Record<string, unknown> }).userContext || {}

      // Derive current season
      const month = now.getMonth() // 0-11
      const isSouthern = uc.isSouthernHemisphere as boolean | undefined
      const seasonMonth = isSouthern ? (month + 6) % 12 : month
      const season = seasonMonth < 2 || seasonMonth === 11 ? 'winter' :
        seasonMonth < 5 ? 'spring' : seasonMonth < 8 ? 'summer' : 'fall'
      const seasonLabel = `${season.charAt(0).toUpperCase() + season.slice(1)}${isSouthern ? ' (Southern Hemisphere)' : ''}`

      // Build location/zone section
      let locationSection = ''
      const zone = uc.zone as string | undefined
      const locationName = uc.locationName as string | undefined
      const confidence = uc.confidence as string | undefined
      const isTropical = uc.isTropical as boolean | undefined

      if (zone) {
        const locationLabel = locationName ? `in ${locationName} ` : ''
        locationSection = `\nUSER'S GROWING PROFILE:\n`
        locationSection += `- Location: ${locationLabel}USDA Hardiness Zone ${zone}\n`

        if (isTropical) {
          const wetStart = uc.wetSeasonStart as number | undefined
          const wetEnd = uc.wetSeasonEnd as number | undefined
          const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
          locationSection += `- Climate: Tropical (no frost)\n`
          if (wetStart && wetEnd) {
            locationSection += `- Wet season: ${monthNames[wetStart - 1]} to ${monthNames[wetEnd - 1]}\n`
          }
          locationSection += `- Give advice based on wet/dry seasons, NOT frost dates\n`
        } else {
          const lastFrost = uc.lastFrostDate as string | undefined
          const firstFrost = uc.firstFrostDate as string | undefined
          const seasonDays = uc.growingSeasonDays as number | undefined
          if (lastFrost) locationSection += `- Last spring frost: ~${lastFrost}\n`
          if (firstFrost) locationSection += `- First fall frost: ~${firstFrost}\n`
          if (seasonDays) locationSection += `- Growing season: ~${seasonDays} days\n`
          locationSection += `\nSince you know the user's zone, give specific planting dates for Zone ${zone}.\n`
        }

        // Confidence caveat
        if (confidence === 'ip-estimated') {
          locationSection += `\nNote: Zone was estimated from the user's approximate IP location. It's likely correct for general advice, but if they ask for precise planting dates, confirm their exact location first.\n`
        } else if (confidence === 'estimated') {
          locationSection += `\nNote: Zone was estimated from GPS — should be accurate for planting advice.\n`
        }
      } else {
        locationSection = `\nYou don't know the user's growing zone yet. Ask where they garden so you can give zone-specific planting dates.\n`
      }

      // Role-aware guidance
      let roleSection = ''
      const role = uc.primaryRole as string | undefined
      if (role === 'seller') {
        roleSection = `\nUSER ROLE: This user is a SELLER on LocalRoots (they sell homegrown produce to neighbors).
- Focus on production-oriented advice: yield optimization, succession planting for continuous supply, what sells well
- Help them plan crops for market — popular items, presentation tips, harvest timing for peak quality
- They already understand gardening basics — give more advanced/actionable advice\n`
      } else if (role === 'buyer') {
        roleSection = `\nUSER ROLE: This user is a BUYER on LocalRoots (they buy produce from neighbors).
- Focus on seasonal awareness: what's in season now, what to look for
- Encourage them to start growing! They clearly love fresh food
- Mention the LocalRoots marketplace when relevant for finding local produce\n`
      } else if (role === 'ambassador') {
        roleSection = `\nUSER ROLE: This user is a LocalRoots AMBASSADOR (they help recruit sellers).
- They may ask about gardening to better understand what sellers deal with
- Help them speak knowledgeably about growing seasons, common crops, and garden challenges\n`
      }

      // Seller's current listings
      let listingsSection = ''
      const listings = uc.sellerListings as { produceName: string; category: string }[] | undefined
      if (listings && listings.length > 0) {
        const cropList = listings.map(l => l.produceName).join(', ')
        listingsSection = `\nUSER'S ACTIVE SELL LISTINGS (on LocalRoots marketplace): ${cropList}
- Build on what they already grow — suggest companion plants, succession planting, or crops that complement their lineup
- If they ask "what should I plant next?" — suggest crops that pair well with their existing garden\n`
      }

      // User's beds + My Garden (tracked plants)
      let gardenSection = ''
      const myGarden = uc.myGarden as { cropId: string; customVarietyName?: string; plantingDate: string; quantity: number; plantingMethod?: string; location?: string; bedId?: string }[] | undefined
      const gardenBeds = uc.gardenBeds as { id: string; name: string; type: string; widthInches?: number; lengthInches?: number; notes?: string }[] | undefined

      {
        const cropData = (cropGrowingData as { crops: Record<string, { name: string; daysToMaturity: { min: number; max: number } }> }).crops
        const bedById: Record<string, string> = {}
        let bedsBlock = ''
        if (gardenBeds && gardenBeds.length > 0) {
          for (const b of gardenBeds) bedById[b.id] = b.name
          bedsBlock = `\nUSER'S BEDS:\n` + gardenBeds.map(b => {
            const dim = b.widthInches && b.lengthInches ? ` (${b.widthInches}"×${b.lengthInches}")` : ''
            return `- "${b.name}" — ${b.type}${dim}${b.notes ? `, ${b.notes}` : ''}`
          }).join('\n')
        }

        let plantLines = ''
        if (myGarden && myGarden.length > 0) {
          plantLines = myGarden.map(p => {
            const crop = cropData[p.cropId]
            const name = p.customVarietyName || crop?.name || p.cropId
            const planted = new Date(p.plantingDate)
            const daysSincePlanting = Math.floor((Date.now() - planted.getTime()) / 86400000)
            const maturityMin = crop?.daysToMaturity?.min || 60
            const pct = Math.min(100, Math.round((daysSincePlanting / maturityMin) * 100))
            const bedName = p.bedId ? bedById[p.bedId] : undefined
            const bedLabel = bedName ? ` in "${bedName}"` : (p.location ? ` [${p.location}]` : '')
            return `- ${name} (×${p.quantity})${bedLabel}: planted ${p.plantingDate}, ${daysSincePlanting} days ago, ~${pct}% to maturity`
          }).join('\n')
        }

        // Attention needed — bolting, pruning, and harvest-urgency
        let attentionBlock = ''
        if (myGarden && myGarden.length > 0) {
          const now = new Date()
          const lines: string[] = []
          myGarden.forEach((p, idx) => {
            const plant: GardenPlant = {
              id: `ctx-${idx}`,
              cropId: p.cropId,
              customVarietyName: p.customVarietyName,
              plantingDate: p.plantingDate,
              quantity: p.quantity,
              plantingMethod: (p.plantingMethod as GardenPlant['plantingMethod']) || 'transplant',
              bedId: p.bedId,
              location: p.location,
              isPerennial: false,
              createdAt: p.plantingDate,
              year: new Date(p.plantingDate).getFullYear(),
            }
            const alerts = detectCareAlerts(plant, now)
            for (const a of alerts) {
              if (a.severity !== 'urgent' && a.severity !== 'critical') continue
              const crop = cropData[p.cropId]
              const name = p.customVarietyName || crop?.name || p.cropId
              const bedName = p.bedId ? bedById[p.bedId] : undefined
              const bedLabel = bedName ? ` in "${bedName}"` : ''
              lines.push(`- ${name} (×${p.quantity})${bedLabel}: ${a.title.toUpperCase()} — ${a.actionHint || a.message}`)
            }
          })
          if (lines.length > 0) {
            attentionBlock = `\nATTENTION NEEDED IN THIS USER'S GARDEN RIGHT NOW:\n${lines.join('\n')}\n\nWhen the user greets you, mention the most urgent of these by name and offer concrete next steps (harvest, pinch, list for sale, plant a replacement). Don't overwhelm — lead with the single most urgent, then mention you noticed others.\n`
          }
        }

        gardenSection = `${bedsBlock}${attentionBlock}\n\nUSER'S GARDEN (plants they are tracking in My Garden):
${plantLines || '(no plants tracked yet)'}

YOUR GARDEN TRACKING POWERS:
You have the ability to add plants, beds, and more to the user's garden tracker. When the user tells you about their garden, YOU make the changes — the system processes your response automatically. This is one of your most important features.

- When the user says they planted something (e.g. "I planted tomatoes", "I just put in 3 Better Boy tomatoes"), CONFIRM that you've added it to their garden. Say something like "I've added 3 Better Boy Tomatoes to your garden! 🌱"
- When they mention a specific variety (e.g. "Better Boy tomatoes", "Mojito Mint"), acknowledge the variety name specifically
- When they mention building a new bed/tower/container, confirm you've created it
- When they mention harvesting or a plant dying, confirm the update
- When they mention putting a plant in a specific bed, confirm the assignment
- Reference their specific plants AND beds when giving advice ("Your tomatoes in Bed 1 are about X days from harvest...")
- When the user mentions a bed by name, find it by fuzzy match — don't create duplicates
- When harvest approaches, suggest they list surplus on LocalRoots to sell to neighbors
- If someone asks "can you add plants to my garden?" — say YES! Tell them to just describe what they planted and you'll track it for them.\n`
      }

      return `You are Sage, the Local Roots gardening companion — a friendly, knowledgeable AI that helps people grow food successfully using natural, organic methods. You are the heart of the LocalRoots app.

YOUR IDENTITY:
Your name is Sage. Users may call you by name — respond naturally.
In your first response to a new user, introduce yourself: "I'm Sage, your gardening companion."

Today is ${today}. Current season: ${seasonLabel}. Use this for seasonal recommendations — tell users what to plant NOW, what to start indoors, and what to prepare for next season.
${locationSection}${roleSection}${listingsSection}${gardenSection}
Your knowledge includes:
- When to plant vegetables based on hardiness zones and frost dates
- Seed starting, transplanting, and harvesting timing
- Natural pest control and disease prevention
- Companion planting and crop rotation
- Composting, soil building, and organic fertilizers
- Raised bed gardening and space optimization

FIRST INTERACTION:
If the conversation history is empty (this is the user's first message), introduce yourself as Sage and mention their zone and season to show you already know their climate. Example: "I'm Sage! Since you're in Zone 8a and it's early spring, here's what I'd recommend..." This creates an immediate "wow, it knows my area" moment.

GUIDELINES:
1. Give practical, actionable advice based on the user's zone if known
2. Recommend natural/organic methods over chemical solutions
3. Be encouraging - gardening should be fun!
4. Keep answers concise but helpful (2-4 paragraphs max unless they ask for detail)
5. If you don't know something specific, say so and suggest they research further
6. When users ask how to do something in the app, guide them step-by-step. Mention features naturally — don't list routes unprompted.
7. For zone-specific timing, always clarify what zone you're assuming if not specified
8. When the user shares a photo, identify the plant, diagnose any visible issues (pests, disease, nutrient deficiency), and give actionable advice

If someone asks about something unrelated to gardening or LocalRoots, politely redirect.`
    },

    async loadContext(ctx: BrainContext): Promise<string> {
      let context = buildGardenContext()
      context += buildRecipeContext()
      context += buildEnhancedGeneralContext()
      context += buildAppKnowledgeContext()

      // Load regional knowledge if user's zone/location matches
      const uc = (ctx as BrainContext & { userContext?: Record<string, unknown> }).userContext || {}
      const region = findRegionalKnowledge(uc.zone as string, uc.locationName as string)
      if (region) {
        context += buildRegionalContext(region)
      }

      // Load local listings if geohash is available
      const geohash = (ctx as BrainContext & { geohash?: string }).geohash
      if (geohash && geohash.length >= 4) {
        const localContext = await fetchLocalListings(geohash)
        if (localContext) context += localContext
      }

      return context
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
