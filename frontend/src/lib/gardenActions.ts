/**
 * Garden Actions — Extract garden updates from AI conversations
 *
 * After Garden AI responds, we run a second Haiku call to detect if the user
 * mentioned planting, harvesting, or other garden changes. These get applied
 * to the My Garden data automatically.
 */

import type { GardenAction } from '@/types/my-garden';
import type { AIMessage } from '@/lib/ai-runtime/types';
import { getAllGrowableCropIds, getCropGrowingInfo } from '@/lib/plantingCalendar';

/** Build the crop ID lookup string for the extraction prompt */
function buildCropIdList(): string {
  return getAllGrowableCropIds()
    .map(id => {
      const info = getCropGrowingInfo(id);
      return `${id}: ${info?.name || id}`;
    })
    .join('\n');
}

/** Build the extraction prompt */
export function buildGardenActionExtractionPrompt(recentMessages: AIMessage[]): string {
  const cropList = buildCropIdList();
  const conversation = recentMessages
    .map(m => `${m.role}: ${typeof m.content === 'string' ? m.content : '[image]'}`)
    .join('\n');

  return `You extract garden actions from conversations. Given the conversation below, identify any garden changes the user EXPLICITLY stated (not asked about, not the AI suggested — only what the user said they DID or ARE DOING).

VALID ACTIONS:
- add_plant: User says they planted, started, or put in a crop
- remove_plant: User says a plant died, they pulled it, or removed it
- mark_harvested: User says they harvested or picked a crop
- update_plant: User says they moved a plant or changed something about it

CROP ID MAPPING (use these exact IDs):
${cropList}

RULES:
- Only extract actions the user explicitly stated — NEVER infer from questions or AI suggestions
- "I planted tomatoes" = add_plant. "Should I plant tomatoes?" = NO action
- "I just put in 6 cherry tomato plants" = add_plant with cropId "tomato-cherry", quantity 6
- If you can't confidently map to a crop ID, skip it
- Default plantingDate to today if not specified
- Default quantity to 1 if not specified
- Default method to "transplant" unless they say "seeds" (direct-sow) or "started indoors" (start-indoors)

CONVERSATION:
${conversation}

Return ONLY a JSON array of actions. Examples:
[{"action":"add_plant","cropId":"tomato-cherry","quantity":6,"plantingDate":"2026-04-03","method":"transplant"}]
[{"action":"remove_plant","cropId":"basil","reason":"died"}]
[{"action":"mark_harvested","cropId":"cucumber"}]
[]

JSON array:`;
}

/** Parse the AI's response into garden actions */
export function parseGardenActions(response: string): GardenAction[] {
  try {
    // Find the JSON array in the response
    const match = response.match(/\[[\s\S]*?\]/);
    if (!match) return [];

    const parsed = JSON.parse(match[0]);
    if (!Array.isArray(parsed)) return [];

    // Validate each action
    const validActions: GardenAction[] = [];
    for (const item of parsed) {
      if (!item.action || !item.cropId) continue;
      if (!['add_plant', 'remove_plant', 'mark_harvested', 'update_plant'].includes(item.action)) continue;

      validActions.push({
        action: item.action,
        cropId: item.cropId,
        quantity: item.quantity ? Number(item.quantity) : undefined,
        plantingDate: item.plantingDate,
        method: item.method,
        location: item.location,
        notes: item.notes,
        reason: item.reason,
        field: item.field,
        value: item.value,
      });
    }

    return validActions;
  } catch {
    return [];
  }
}
