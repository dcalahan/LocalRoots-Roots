import { NextRequest, NextResponse, after } from 'next/server';
import { kv } from '@/lib/kv';
import type { CommunityVariety } from '@/types/my-garden';
import { getCropGrowingInfo } from '@/lib/plantingCalendar';

const KV_KEY = 'variety-registry';

function slugify(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export async function GET() {
  try {
    const registry = await kv.get<CommunityVariety[]>(KV_KEY);
    return NextResponse.json({ varieties: registry || [] });
  } catch {
    return NextResponse.json({ varieties: [] });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name, parentCropId, userId } = await request.json() as {
      name?: string;
      parentCropId?: string;
      userId?: string;
    };

    if (!name?.trim() || !parentCropId || !userId) {
      return NextResponse.json({ error: 'name, parentCropId, userId required' }, { status: 400 });
    }

    const trimmedName = name.trim().slice(0, 80);
    const id = slugify(trimmedName);

    const registry = (await kv.get<CommunityVariety[]>(KV_KEY)) || [];

    // Dedup by normalized name + parent
    const existing = registry.find(
      v => v.id === id && v.parentCropId === parentCropId
    );

    if (existing) {
      existing.useCount += 1;
      await kv.set(KV_KEY, registry);
      return NextResponse.json({ variety: existing });
    }

    const variety: CommunityVariety = {
      id,
      name: trimmedName,
      parentCropId,
      addedBy: userId,
      addedAt: new Date().toISOString(),
      useCount: 1,
    };

    registry.push(variety);
    await kv.set(KV_KEY, registry);

    // Background enrichment via Haiku
    if (process.env.ANTHROPIC_API_KEY) {
      after(async () => {
        try {
          const parentInfo = getCropGrowingInfo(parentCropId);
          const parentName = parentInfo?.name || parentCropId;

          const res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': process.env.ANTHROPIC_API_KEY!,
              'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
              model: 'claude-haiku-4-5-20251001',
              max_tokens: 200,
              messages: [{
                role: 'user',
                content: `Plant variety: "${trimmedName}" (a type of ${parentName}).
Return ONLY valid JSON: { "description": "one sentence about this variety", "maturityAdjustment": 0 }
The maturityAdjustment is days +/- from the generic ${parentName} (${parentInfo?.daysToMaturity?.min || 70}-${parentInfo?.daysToMaturity?.max || 90} days). Use 0 if unknown.`,
              }],
            }),
          });

          if (res.ok) {
            const data = await res.json();
            const text = data?.content?.[0]?.text || '';
            const match = text.match(/\{[\s\S]*\}/);
            if (match) {
              const enrichment = JSON.parse(match[0]);
              // Re-read registry (may have changed) and update
              const current = (await kv.get<CommunityVariety[]>(KV_KEY)) || [];
              const target = current.find(v => v.id === id && v.parentCropId === parentCropId);
              if (target) {
                target.description = enrichment.description?.slice(0, 200);
                target.maturityAdjustment = typeof enrichment.maturityAdjustment === 'number'
                  ? enrichment.maturityAdjustment : 0;
                await kv.set(KV_KEY, current);
              }
            }
          }
        } catch (err) {
          console.error('[variety-registry] enrichment failed:', err);
        }
      });
    }

    return NextResponse.json({ variety });
  } catch (err) {
    console.error('[variety-registry POST] failed:', err);
    return NextResponse.json({ error: 'Save failed' }, { status: 500 });
  }
}
