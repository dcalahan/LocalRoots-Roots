import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Load data files at runtime
function loadDataFiles() {
  const dataDir = path.join(process.cwd(), '..', 'data');

  try {
    const cropGrowingData = JSON.parse(
      fs.readFileSync(path.join(dataDir, 'crop-growing-data.json'), 'utf-8')
    );
    const techniqueGuides = JSON.parse(
      fs.readFileSync(path.join(dataDir, 'technique-guides.json'), 'utf-8')
    );
    return { cropGrowingData, techniqueGuides };
  } catch {
    // Fallback: try relative path from frontend root
    try {
      const altDataDir = path.join(process.cwd(), 'data');
      const cropGrowingData = JSON.parse(
        fs.readFileSync(path.join(altDataDir, 'crop-growing-data.json'), 'utf-8')
      );
      const techniqueGuides = JSON.parse(
        fs.readFileSync(path.join(altDataDir, 'technique-guides.json'), 'utf-8')
      );
      return { cropGrowingData, techniqueGuides };
    } catch {
      console.error('[Garden AI] Could not load data files');
      return { cropGrowingData: { crops: {} }, techniqueGuides: { guides: {} } };
    }
  }
}

// Build a condensed context from our growing guides
function buildGardenContext(): string {
  const { cropGrowingData, techniqueGuides } = loadDataFiles();

  // Get popular crops summary
  const popularCrops = [
    'tomato-cherry', 'tomato-beefsteak', 'pepper-bell-green', 'cucumber',
    'lettuce-romaine', 'spinach', 'carrot', 'basil', 'cilantro', 'onion-yellow',
    'garlic', 'potato', 'broccoli', 'kale', 'radish', 'beet', 'okra',
    'squash-zucchini', 'bean-snap', 'pea-sugar-snap', 'corn-sweet'
  ];

  const crops = cropGrowingData.crops as Record<string, any>;

  const cropSummaries = popularCrops
    .filter(id => crops[id])
    .map(id => {
      const crop = crops[id];
      const startIndoors = crop.startIndoors
        ? `Start indoors ${crop.startIndoors.weeksBeforeLastFrost} weeks before last frost`
        : null;
      const directSow = crop.directSow
        ? `Direct sow ${crop.directSow.weeksAfterLastFrost || 0} weeks after last frost (soil temp ${crop.directSow.minSoilTempF}°F+)`
        : null;
      const transplant = crop.transplant
        ? `Transplant ${crop.transplant.weeksAfterLastFrost || 0} weeks after last frost`
        : null;

      return `**${crop.name}**: ${[startIndoors, directSow, transplant].filter(Boolean).join('. ')}. Days to maturity: ${crop.daysToMaturity.min}-${crop.daysToMaturity.max}. ${crop.tips?.[0] || ''}`;
    })
    .join('\n');

  // Get technique guides summary
  const guides = techniqueGuides.guides as Record<string, any>;
  const guideSummaries = Object.values(guides)
    .map((guide: any) => `**${guide.title}**: ${guide.description}`)
    .join('\n');

  // Zone info
  const zoneInfo = `
USDA Hardiness Zones determine planting dates based on frost:
- Zone 4-5: Last frost mid-May, first frost early October
- Zone 6: Last frost late April, first frost mid-October
- Zone 7: Last frost mid-April, first frost late October
- Zone 8: Last frost late March, first frost mid-November
- Zone 9-10: Last frost February or year-round growing
`;

  return `
LOCAL ROOTS GROWING GUIDE DATA:

${zoneInfo}

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
`;
}

interface UserContext {
  zone?: string;
  lastFrostDate?: string;
  firstFrostDate?: string;
  growingSeasonDays?: number;
}

function buildSystemPrompt(userContext?: UserContext): string {
  const gardenContext = buildGardenContext();

  // Add personalized zone info if available
  const userZoneInfo = userContext?.zone
    ? `
USER'S GROWING PROFILE (use this for personalized recommendations):
- USDA Hardiness Zone: ${userContext.zone}
- Last Spring Frost Date: ${userContext.lastFrostDate || 'unknown'}
- First Fall Frost Date: ${userContext.firstFrostDate || 'unknown'}
- Growing Season Length: ${userContext.growingSeasonDays || 'unknown'} days

Since you know the user's zone, provide specific planting dates and timing advice tailored to Zone ${userContext.zone}.
`
    : `
USER'S ZONE: Not specified. Ask them for their USDA zone or location to give more accurate timing advice.
`;

  return `You are the Local Roots Garden Assistant, a friendly and knowledgeable AI helper for home gardeners. You help people grow food successfully using natural, organic methods.

Your knowledge includes:
- When to plant vegetables based on hardiness zones and frost dates
- Seed starting, transplanting, and harvesting timing
- Natural pest control and disease prevention
- Companion planting and crop rotation
- Composting, soil building, and organic fertilizers
- Raised bed gardening and space optimization

${userZoneInfo}

${gardenContext}

GUIDELINES:
1. Give practical, actionable advice based on the user's zone${userContext?.zone ? ` (they're in Zone ${userContext.zone})` : ''}
2. Recommend natural/organic methods over chemical solutions
3. Be encouraging - gardening should be fun!
4. Keep answers concise but helpful (2-4 paragraphs max unless they ask for detail)
5. If you don't know something specific, say so and suggest they research further
6. Mention Local Roots features when relevant (planting calendar, technique guides)
7. ${userContext?.zone ? `Use the user's Zone ${userContext.zone} frost dates for specific timing` : 'For zone-specific timing, always clarify what zone you\'re assuming if not specified'}

If someone asks about something unrelated to gardening, politely redirect to gardening topics.`;
}

export async function POST(request: NextRequest) {
  try {
    // Check for API key
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'Garden AI is not configured. Please add ANTHROPIC_API_KEY to environment.' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { message, conversationHistory = [], userContext } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    // Rate limiting could be added here based on IP or wallet address

    // Build messages array with conversation history
    const messages: Anthropic.MessageParam[] = [
      ...conversationHistory.slice(-10), // Keep last 10 messages for context
      { role: 'user', content: message }
    ];

    // Build system prompt with user context (zone, frost dates, etc.)
    const systemPrompt = buildSystemPrompt(userContext as UserContext | undefined);

    // Call Claude API (using Haiku for cost efficiency)
    const response = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    });

    // Extract text response
    const textContent = response.content.find(block => block.type === 'text');
    const reply = textContent?.type === 'text' ? textContent.text : 'I apologize, I could not generate a response.';

    return NextResponse.json({
      reply,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      }
    });

  } catch (error) {
    console.error('[Garden AI] Error:', error);

    if (error instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: `API Error: ${error.message}` },
        { status: error.status || 500 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to get response from Garden AI' },
      { status: 500 }
    );
  }
}
