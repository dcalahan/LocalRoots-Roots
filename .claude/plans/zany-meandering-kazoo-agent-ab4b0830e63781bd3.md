# Garden AI Brain Migration Plan

## Overview
Migrate Local Roots Garden AI from direct Anthropic SDK calls to the `@common-area/ai-runtime` Brain pattern with per-user memory backed by Supabase. Follow the Hans Brain reference implementation closely.

---

## Step 1: Supabase Setup (New Dependency)

Local Roots has zero Supabase today. Create a new Supabase project and add three tables.

### Table: `garden_conversations`
```sql
CREATE TABLE garden_conversations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id text NOT NULL,
  context_type text NOT NULL DEFAULT 'garden',
  messages jsonb NOT NULL DEFAULT '[]',
  summary text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX idx_garden_conv_user ON garden_conversations(user_id, context_type);
```

### Table: `garden_memories`
```sql
CREATE TABLE garden_memories (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id text NOT NULL,
  fact text NOT NULL,
  category text NOT NULL,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_garden_mem_user ON garden_memories(user_id);
```

### Table: `garden_soul`
```sql
CREATE TABLE garden_soul (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  soul_text text NOT NULL,
  updated_at timestamptz DEFAULT now()
);
```

### Memory Categories for Gardening
- `garden_setup` — zone, location, garden type (raised bed, in-ground), size, sun exposure
- `growing_preference` — organic-only, favorite crops, planting methods, seed starting prefs
- `garden_history` — past successes/failures, pest problems, soil conditions
- `schedule` — when they garden, availability, planting calendar preferences
- `personal` — name, experience level, why they garden

### Environment Variables Needed
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
ANTHROPIC_API_KEY=...            # already exists
```

### New npm Dependencies
```
@supabase/supabase-js
@common-area/ai-runtime          # restricted — need npm access grant
```

---

## Step 2: Supabase Client Files

### NEW: `frontend/src/lib/supabase/admin.ts`
Server-only admin client using service role key for all Brain writes. Pattern from Hans:
```typescript
import { createClient } from '@supabase/supabase-js'
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
```

### NEW: `frontend/src/lib/supabase/client.ts`
Browser client using anon key (for optional client-side reads).

---

## Step 3: GardenBrain Implementation

### NEW: `frontend/src/lib/ai/garden-brain.ts`

Move `buildGardenContext()` and `buildSystemPrompt()` from the current route.ts into this file as module-level helpers. The JSON file loading stays identical.

Key design decisions:
- **No actions** — `actionTypes: []`. Garden AI is purely conversational.
- **User ID = wallet address** (lowercased), passed from client
- **Session ID format**: `garden:{walletAddress}` (single conversation per user)
- **Router**: Haiku only (single standard tier, no fast/premium)
- **Memory maxFacts: 50** (gardeners need fewer than real estate agents)

The Brain implementation follows Hans exactly for persistence methods:
- `loadMemories(userId)` — SELECT from garden_memories WHERE user_id
- `saveMemories(userId, memories)` — INSERT into garden_memories (deduplicated)
- `loadSoul()` — SELECT from garden_soul, fallback to hardcoded initial soul
- `loadConversationSummary(sessionId)` — parse sessionId as `garden:{userId}`, SELECT summary from garden_conversations
- `saveConversation(sessionId, messages, summary?)` — UPSERT into garden_conversations

Key difference from Hans: Hans stores memories in `agents.preferences` JSONB. Garden Brain uses a dedicated `garden_memories` table since there is no users table.

`getSystemPrompt()` reuses the existing prompt text but adds today's date injection (from Hans pattern) for temporal awareness.

`loadContext()` calls the existing `buildGardenContext()` function (JSON knowledge base) and appends user zone info from `ctx.contextIds`.

---

## Step 4: Replace API Route

### MODIFY: `frontend/src/app/api/garden-ai/route.ts`

Replace the 227-line direct Anthropic call with a thin handleChat wrapper (~40 lines), matching Hans's `api/ai/chat/route.ts` pattern:

1. Parse request body (same shape as today + new `userId` field)
2. Get wallet address, lowercase it
3. Create brain via `createGardenBrain()`
4. Build AIMessage array from conversationHistory + new message
5. Call `handleChat(brain, { userId, sessionId, contextIds, messages })`
6. Return `{ reply: result.cleanContent, usage: result.response.usage }`

**Unauthenticated fallback**: When userId is null, sessionId is undefined. The runtime skips save/load of conversations and memories. Chat works stateless, identical to today.

The response shape (`{ reply, usage }`) stays the same so the frontend is backward-compatible during migration.

---

## Step 5: Conversation History Endpoint

### NEW: `frontend/src/app/api/garden-ai/history/route.ts`

GET endpoint that returns stored conversation for a wallet address:
- Query param: `userId` (wallet address)
- Returns: `{ messages: AIMessage[], summary: string | null }`
- Uses admin client to read from garden_conversations

---

## Step 6: Chat Component Changes

### MODIFY: `frontend/src/components/grow/GardenAIChat.tsx`

Changes:
1. Import `useAccount` from wagmi to get wallet address
2. On chat open (when connected): fetch GET `/api/garden-ai/history?userId={address}` to restore previous messages
3. Send `userId: address?.toLowerCase()` in every POST request body
4. Add a "New conversation" button that clears local messages and optionally clears server-side

The existing `useGrowingProfileSafe()` stays — zone context still passes through as `userContext`.

---

## Step 7: Implementation Sequence

Execute in this order to avoid breaking the /grow page:

1. Set up Supabase project + run CREATE TABLE statements
2. Add env vars to `.env.local` and Vercel
3. `npm install @supabase/supabase-js @common-area/ai-runtime`
4. Create `lib/supabase/admin.ts` and `lib/supabase/client.ts`
5. Create `lib/ai/garden-brain.ts` — move prompt/context logic, add memory persistence
6. Update `api/garden-ai/route.ts` — swap to handleChat wrapper
7. Create `api/garden-ai/history/route.ts`
8. Update `GardenAIChat.tsx` — add wallet identity + conversation loading
9. Test with both connected wallet and anonymous users

---

## Architecture

```
GardenAIChat.tsx
  |-- useAccount() -> wallet address
  |-- GET /api/garden-ai/history -> load previous messages
  +-- POST /api/garden-ai
        |-- createGardenBrain()
        +-- handleChat(brain, context)
              |-- brain.loadSoul() -> garden_soul table
              |-- brain.loadMemories(userId) -> garden_memories table
              |-- brain.getSystemPrompt() -> persona + date
              |-- brain.loadContext() -> JSON knowledge base + zone
              |-- brain.loadConversationSummary() -> garden_conversations
              |-- router.call() -> Anthropic Haiku
              |-- brain.saveConversation() -> garden_conversations
              +-- extractMemories() (background) -> brain.saveMemories()
```

---

## Open Questions

1. **ai-runtime access**: Package is restricted. Alternative: copy runtime source locally like GateKeeper does at `src/lib/ai-runtime/`.
2. **Rate limiting for anonymous users**: Consider IP-based limiting or requiring wallet for memory features.
3. **Soul evolution**: Start with static soul, add cross-user learning later.
