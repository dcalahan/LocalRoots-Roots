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
- add_plant: User says they planted, started, or put in a crop. May include bedName.
- remove_plant: User says a plant died, they pulled it, or removed it
- mark_harvested: User says they harvested or picked a crop
- update_plant: User says they moved a plant or changed something about it
- add_bed: User says they built/added a new bed/tower/container ("I built a new raised bed", "I added a tower")
- update_bed: User renamed a bed or changed its notes
- delete_bed: User removed/dismantled a bed
- assign_plant_to_bed: User says they put an existing plant in a specific bed

CROP ID MAPPING (use these exact IDs):
${cropList}

BED TYPES: raised-bed, in-ground, tower, container, greenhouse, other

RULES:
- Only extract actions the user explicitly stated — NEVER infer from questions or AI suggestions
- "I planted tomatoes in Bed 1" = add_plant with cropId "tomato-cherry" (or appropriate), bedName "Bed 1"
- "I just put in 6 cherry tomato plants" = add_plant with cropId "tomato-cherry", quantity 6
- "I built a new raised bed called Bed 3" = add_bed with bedName "Bed 3", bedType "raised-bed"
- "I added an indoor tower" = add_bed with bedName "Tower" (or whatever they called it), bedType "tower"
- If the user mentions a specific variety name (e.g. "Better Boy tomatoes", "Mojito Mint"), set cropId to the closest parent crop AND set customVarietyName to the variety name. Example: "Better Boy tomatoes" → cropId "tomato-beefsteak", customVarietyName "Better Boy Tomato"
- If you can't confidently map to a crop ID, skip it
- ONLY include plantingDate if the user explicitly stated when they planted ("I planted yesterday", "I put them in April 14", "today", etc.). NEVER default to today's date — leave plantingDate OFF the action entirely if the user didn't say when. The downstream system will surface a clear "no planting date" gap rather than guessing wrong.
- RELATIVE DATE REFERENCES: If the user said the new plant went in relative to another plant ("same day as the tomatoes", "a week before the peppers", "right after I put in the basil"), look earlier in the CONVERSATION (and in any prior assistant messages that referenced specific dates) for the referenced plant's planting date and compute the date from that reference. Same day = same ISO date; "a week before" = subtract 7 days; "two days after" = add 2 days. If the referenced date is clearly resolvable from the conversation, set plantingDate to the computed ISO date. If you cannot find the referenced date in the conversation, omit plantingDate rather than guessing.
- Default quantity to 1 if not specified
- Default method to "transplant" unless they say "seeds" (direct-sow) or "started indoors" (start-indoors)

CONVERSATION:
${conversation}

Return ONLY a JSON array of actions. Examples:
[{"action":"add_plant","cropId":"tomato-cherry","quantity":6,"plantingDate":"2026-04-03","method":"transplant","bedName":"Bed 1"}]
[{"action":"add_plant","cropId":"tomato-beefsteak","customVarietyName":"Better Boy Tomato","quantity":3,"plantingDate":"2026-04-03","method":"transplant"}]
[{"action":"add_bed","bedName":"Tower","bedType":"tower"}]
[{"action":"remove_plant","cropId":"basil","reason":"died"}]
[{"action":"mark_harvested","cropId":"cucumber"}]
[{"action":"assign_plant_to_bed","cropId":"basil","bedName":"Bed 2"}]
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
    const validTypes = [
      'add_plant', 'remove_plant', 'mark_harvested', 'update_plant',
      'add_bed', 'update_bed', 'delete_bed', 'assign_plant_to_bed',
    ];
    const cropRequired = ['add_plant', 'remove_plant', 'mark_harvested', 'update_plant', 'assign_plant_to_bed'];
    for (const item of parsed) {
      if (!item.action || !validTypes.includes(item.action)) continue;
      if (cropRequired.includes(item.action) && !item.cropId) continue;
      if (item.action === 'add_bed' && !item.bedName) continue;

      validActions.push({
        action: item.action,
        cropId: item.cropId,
        customVarietyName: item.customVarietyName,
        quantity: item.quantity ? Number(item.quantity) : undefined,
        plantingDate: item.plantingDate,
        method: item.method,
        location: item.location,
        notes: item.notes,
        reason: item.reason,
        field: item.field,
        value: item.value,
        bedId: item.bedId,
        bedName: item.bedName,
        bedType: item.bedType,
        widthInches: item.widthInches ? Number(item.widthInches) : undefined,
        lengthInches: item.lengthInches ? Number(item.lengthInches) : undefined,
      });
    }

    return validActions;
  } catch {
    return [];
  }
}
