# LocalRoots Roots Points Expansion — Strategic Plan

**Status:** APPROVED by Doug May 12 2026. Implementation in progress.
**Author:** Plan agent, May 12 2026.
**For:** Reference during implementation.

---

## Doug's decisions (locked May 12 2026)

All 8 open questions in §6 were answered by Doug. Captured here as a single reference so future Claude sessions don't re-litigate:

1. **Tokenomics split:** APPROVED at 25% treasury / 30% ambassadors / 15% founders / 10% liquidity / 20% airdrop. ("I love the update. This is excellent.")
2. **Tokenomics decision process:** Doug decides directly (no community vote pre-launch).
3. **Header RP pill in Phase 1:** Ship it, visually quiet (small, no animations, no streak badges).
4. **Anon Sage user backfill:** Only credit forward. No retroactive crediting when an anon user signs in later.
5. **Sage chat RP shape:** Fixed +10 daily cap in Phase 1. Depth bonus (+15 for ≥5 messages) only after Phase 1 data shows it's not gameable. Phase 2 decision.
6. **Photo dedup:** YES, perceptual hash check. Adds ~1-2 days to Phase 3; worth it for airdrop integrity.
7. **Off-chain RP visibility:** Private. Visible only on the user's own `/profile` page. The existing on-chain `/leaderboard` stays the public ranking surface.
8. **Tokenomics page disclosure:** Disclose new earning surface, framed as "loyalty rewards" / airline-miles language. Never "compensation" or "payment for using the app."

**No section of this plan is open for revision** without explicit Doug sign-off. Implementation proceeds against the plan as written, with the answers above baked in.

---

---

## 0. Executive summary

Today, Roots Points (RP) earning is bound entirely to on-chain marketplace events: sellers earn on every sale, buyers earn on every purchase, ambassadors earn 25% of upstream sales. Everything funnels through the immutable mainnet marketplace contract emitting `SeedsEarned` events that the subgraph indexes. That model is clean but narrow — it rewards transactions only, and most LocalRoots users today are Sage users who have never bought or sold anything.

This plan expands the earning surface to include **garden engagement** (Sage chat, plant tracking, photos, harvests) and **growth engagement** (recruiting via share cards, public garden profiles). The new RP lives **off-chain in Vercel KV** indexed by Privy ID / wallet, gets summed at airdrop-snapshot time, and rolls up alongside on-chain RP into the merkle generator that produces the `/claim` tree plus the Privy direct-transfer list. No contract changes required — that's the whole point.

This also expands universal awareness — every surface that touches RP needs to telegraph it consistently, with the tokenomics page as the destination for "what does this become."

Three things flow downstream from this:

1. **Tokenomics rebalance** to reflect that the airdrop is now the primary delivery vehicle for "we paid you in upside for using Sage daily for two years."
2. **New gaming risks** — off-chain Sage points are easier to farm than on-chain transaction RP, so wash-trading defense work shifts in scope.
3. **A regulatory-language posture** to manage: "RP for using the app" gets framed as participation/engagement rewards (like airline miles), never as compensation, never with implied $ROOTS values pre-launch.

The plan is staged across three phases over an estimated 3-4 week implementation window before snapshot. Phase 1 is foundation + the highest-leverage awareness surfaces; Phase 2 is breadth; Phase 3 is wash-trading defense + final tokenomics + merkle generator update.

---

## 1. New earning verbs

The current earning verbs (on-chain, immutable):

| Verb | Rate | Surface | Cap |
|---|---|---|---|
| Sale completed | 500 RP / $1 earned (× early-adopter multiplier) | Marketplace contract `purchase()` line 404 | None |
| Purchase completed | 50 RP / $1 spent (× multiplier) | Same | None |
| Ambassador chain commission | 25% of sale value as RP, 80/20 split upstream | AmbassadorRewards contract | None (1-year window) |
| Seller milestones | 50 / 10K / 25K / 50K at 1st / 1st-sale / 5 sales / 15 sales | Marketplace milestone events | One-time |
| Ambassador recruitment bonus | 2,500 RP per activated seller | AmbassadorRewards | One-time per recruit |

**The baseline reference for sizing new verbs:** a $1 buyer purchase = 50 RP. A $1 seller sale = 500 RP. New verbs should sit *below* the $1 buyer purchase in most cases — buying real food is more "valuable" to the network than chatting with Sage, and the relative pricing should reflect that. Engagement verbs that approach or exceed the buyer purchase rate will read as gameable.

### Proposed new verbs

| # | Verb | Trigger condition | Suggested RP | Daily cap | Lifetime cap | Gaming risk | Mitigation |
|---|---|---|---|---|---|---|---|
| 1 | **Daily Sage Conversation** | First user message of the calendar day to `/api/garden-ai/route.ts` POST, where the message has ≥10 characters of actual text content (image-only doesn't count for v1). | 10 RP | 10 (one award) | None | Bot accounts spam the endpoint. Multiple anon users from same IP farming. | Cap at 1/day per Privy ID. Anon users (no Privy ID) don't earn — must be signed in. Server-side debounce on `userId`. |
| 2 | **Sage Conversation Depth Bonus** | User sent ≥5 messages in one calendar day AND received ≥5 Sage replies. Counted from the same POST handler. | +15 RP (total 25 for the day) | 25 total/day | None | Spam short messages to hit count. | Each user message must be ≥10 chars; rate-limit one message per 5 seconds per user. |
| 3 | **Plant Added to Garden** | New `GardenPlant` written via `/api/my-garden` PUT where the plant.id is new AND cropId is a valid catalog crop AND quantity ≥ 1. | 25 RP | 100 (4 plants/day) | 2000 (~80 plants lifetime — generous; serious gardeners welcome) | Add/delete loop. Adding 100 plants for points. | Server-side dedup: only credit if cropId has never been credited for this user OR if this is the first plant added in 30 days for that cropId. Lifetime cap protects from extreme abuse. |
| 4 | **Garden Bed Created** | New `GardenBed` written with a name and a type. | 50 RP | 100 | 500 (~10 beds lifetime) | Spam bed creation. | Server-side check: only the first 10 unique-named beds per user earn. |
| 5 | **Plant Photo Uploaded** | A `GardenPlant` update sets `photoIpfs` for the first time, OR the user uploads a *different* photo of the same plant at least 14 days after the previous credit for that plant. | 30 RP | 90 (3 photos/day, distinct plants) | None | Same photo uploaded 100×. Bot photos. | Server-side: dedupe by `plantId + 14-day window`. Hash photo content on upload, reject identical re-uploads. Don't reward photos uploaded faster than ~5 seconds apart (humanity check). |
| 6 | **Garden Bed Photo Uploaded** | A `GardenBed` update sets `photoIpfs` for the first time OR a new photo replaces the existing one after 30 days. | 50 RP | 50 | None | Same as plant photo. | Same dedup logic at 30-day window for beds (rarer than plant photos). |
| 7 | **Harvest Logged** | A `GardenPlant` gets a `harvestedDate` set (via `markHarvested` or Sage `mark_harvested` action) when none existed. | 40 RP | 200 (5 harvests/day) | None | Plant → harvest loop. | Plant must have been alive ≥21 days before harvest credit fires. Otherwise credited at 10 RP (not zero — sometimes harvests are real and quick, like radishes). |
| 8 | **Plant Status Update** | Notes field, quantity field, or `manualStatus` field changes on an existing plant. | 5 RP | 25 (5 updates/day) | None | Notes spam. | Each update must change content (not just re-save same text). Dedupe by `plantId + field + dayBucket`. |
| 9 | **First Public Garden Profile Published** | `garden-profile:{userId}` record in KV transitions from non-existent (or `published === false`) to `published === true` with bio non-empty AND at least one photo OR one plant. | 200 RP | — | One-time per account | Create-delete-republish loop. | One-time; never re-credits. |
| 10 | **Care Alert Acted On** | User clicks "Done" on a CareAlert (recorded via `/api/care-dismissals` POST) AND the underlying plant was in `prune-now`, `bolting`, `harvest-urgent`, or `bolt-risk` state when dismissed. Mere "dismiss" of a non-urgent alert does NOT earn. | 15 RP | 75 (5 alerts/day) | None | Click-spam dismiss. | Only credits if alert was actually rendered to the user (server checks against `detectGardenAlerts` output at time of dismissal). |
| 11 | **Listing Created (off-chain credit, in addition to existing on-chain seller milestone)** | Seller publishes a listing via the marketplace contract. Off-chain credit fires once per listing.id from subgraph data. | 100 RP | 500 (5 listings/day) | None | Spam listing/delisting. | Listing must remain active ≥48h to count (server polls). Otherwise auto-reversed. Existing "First listing" 50 RP on-chain milestone stays — these stack. |
| 12 | **Ambassador Share Card Sent** | Ambassador opens the share-card modal (`ShareCardModal`) and uses the native share action OR copies the link. Credit fires server-side via a new `/api/share-cards/sent` endpoint. | 5 RP | 50 (10 shares/day) | None | Spam share button. | Per-conversation-target dedup (require user to either grant Web Share API permission with target, OR if pure clipboard, hard cap at 10/day). |
| 13 | **Recruited Gardener Activated** *(stacks with existing on-chain ambassador bonus)* | A new seller registers and is attributed to the ambassador's `referredBy` field. Off-chain credit on activation (after `SELLER_MIN_UNIQUE_BUYERS = 2`). | 1,000 RP | — | None | Already on-chain — no new vector. | Inherits existing on-chain wash filter. |

### Why these numbers

The framework: every off-chain verb at its daily cap should approximately equal **the daily upper bound a serious-engaged user can hit before they're plausibly farming**. Sum the maxes:

- Sage chat (daily, depth bonus): 25 RP
- 4 plant additions × 25 = 100 RP
- 3 plant photos × 30 = 90 RP
- 5 care alerts × 15 = 75 RP
- 5 plant updates × 5 = 25 RP
- 5 harvests × 40 = 200 RP

**Engaged-user max:** ~515 RP/day from non-marketplace activity. That equates to a $10.30/day buyer purchase in RP terms — about the value of buying a CSA bag from a neighbor every day. Feels right: someone genuinely tending a 50-plant garden during peak season *should* earn at roughly that pace from engagement, and that's what the merkle will reward.

**Anonymous Sage users:** by design, they earn nothing — Privy ID is required. This means Sage-only users get the RP system the first time they sign in (with Privy). On the airdrop side, this matches Doug's framing: "our airdrop will airdrop to the Privy wallets of our users." Anon users have no wallet to airdrop to.

### What NOT to credit (proposed exclusions)

I considered and chose not to propose RP for these. Each has a one-line rationale Doug can override:

- **Reading a guide / browsing a recipe.** Too gameable, low signal of intent.
- **Time spent in app.** Bot-trivial, reads like "we paid you to scroll."
- **Voice mode used / TTS played.** Engagement signal but not behavior change.
- **Per-Sage-message past the daily depth bonus.** Linear-scaling per-message rewards is the canonical "spam to earn" vector that ruined every read-to-earn token.

### Storage architecture for off-chain RP

**KV schema (new):**

```
rp:offchain:{privyAddress}              → { total: number, lastUpdated: ISO, byVerb: {verbId: number, count: number, lastEarnedAt: ISO} }
rp:offchain:event:{eventId}             → audit record per credit event (eventId = hash of verb + dedupe key)
rp:offchain:daily:{privyAddress}:{date} → daily caps tracker { [verbId]: count }
rp:offchain:lifetime:{privyAddress}     → lifetime caps tracker { [verbId]: count }
```

`privyAddress` is the lowercased Privy embedded wallet address — the same address that ends up in `scripts/distribution/fetchPrivyUsers.ts`. This is the join key.

**Why KV, not Ceramic / not on-chain:** off-chain RP is by definition not on the marketplace's truth surface. It's a snapshot mechanism that gets folded into the merkle at airdrop time. KV is the right tool, matches existing patterns (cash payments, care dismissals, my-garden). When LocalRoots eventually moves to Ceramic, this is just another KV namespace to port — same pattern.

**Source-of-truth principle:** if KV is lost, off-chain RP is lost. That's an acceptable risk given (a) the data is replayable from existing surfaces (KV my-garden has plant create-dates; subgraph has on-chain events; we can recompute the merkle from primary sources if needed) and (b) the system mirrors a single off-chain merkle event per user at snapshot, not a stream of transactions the user depends on for purchases.

### Surface that emits each verb

| Verb | Emitting surface (file:line approximate) |
|---|---|
| 1, 2 — Sage chat | `frontend/src/app/api/garden-ai/route.ts` — POST handler. Add `creditOffchainRP({verb: 'sage-daily', userId})` after streamSageChat finishes successfully and `userId !== 'anonymous'`. Hook into the existing `after()` block so it doesn't block the stream. |
| 3 — Plant added | `frontend/src/app/api/my-garden/route.ts` PUT handler. Diff incoming `plants` against current KV; for each new plant.id, queue a credit. |
| 4 — Bed created | Same PUT handler. Diff `beds`. |
| 5 — Plant photo | Same PUT handler. Diff plant.photoIpfs transitions. |
| 6 — Bed photo | Same PUT handler. Diff bed.photoIpfs transitions. |
| 7 — Harvest logged | Same PUT handler. Diff plant.harvestedDate transitions. |
| 8 — Plant update | Same PUT handler. Diff notes/quantity/manualStatus fields. |
| 9 — Public garden profile published | `frontend/src/app/api/gardener-profile/route.ts` — on PUT where transitions from `published: false → true`. |
| 10 — Care alert acted on | `frontend/src/app/api/care-dismissals/route.ts` POST handler — when alertId corresponds to an urgent alert. |
| 11 — Listing created (off-chain stack) | New `frontend/src/app/api/listings/credit-rp/route.ts` triggered by a subgraph webhook OR a periodic cron checking new ListingCreated events. Easier path: client-side fire-and-forget on successful listing tx confirmation. |
| 12 — Share card sent | New `frontend/src/app/api/share-cards/sent/route.ts`. `ShareCardModal.tsx` posts to it on share success. |
| 13 — Recruited gardener activated | Existing on-chain SellerActivated event in subgraph. New cron or webhook reads it and credits off-chain RP on top of the existing on-chain ambassador bonus. |

### Server-side validator pattern (shared)

To keep all of these consistent and to make wash-trading defense possible, all credits route through a single shared library: `frontend/src/lib/offchainRP.ts` (new). Each verb has a config:

```ts
// Conceptual — not for implementation now
type OffchainVerbConfig = {
  id: string
  rpAmount: number
  dailyCap?: number
  lifetimeCap?: number
  validate: (input, kvSnapshot) => { ok: boolean, dedupeKey: string }
}
```

The validator:
1. Loads the user's daily and lifetime counters.
2. Checks cap.
3. Computes dedupe key for this credit (e.g. `sage-daily:{userId}:{YYYY-MM-DD}`).
4. If dedupe key already exists in `rp:offchain:event:{eventId}`, no-op.
5. Otherwise, atomically increment counters and write the event record.

Atomic increments via KV's INCR primitive — single shot, no race. Same pattern as `relayer-topup`'s rate limiter (`topup:{address}:{YYYY-MM-DD}`).

### Verification path per verb (Doug's "verify before claiming" principle)

Each verb needs a verification path defined BEFORE shipping. Recommended pattern:

| Verb | Verification path |
|---|---|
| Sage chat | Run two sessions on test mainnet account — message Sage once, see +10 RP; message again same day, see no double-credit. Repeat next day, see +10 RP. |
| Plant added | Add 5 plants in one session via UI → 125 RP total. Try to add 6th → no credit. Same plant cropId re-added 7 days later → no credit (within 30-day window). |
| Photo uploaded | Upload plant photo via UI → +30 RP. Upload identical-bytes photo to same plant → no credit. Wait 14 days, upload different photo → +30 RP. |
| Harvest logged | Plant added today, marked harvested today → +10 RP (not 40, because < 21 days). Plant added 30 days ago, marked harvested today → +40 RP. |
| Care alert acted on | Force a `bolting` alert on a plant (set planting date 75 days ago for arugula in summer), click Done → +15 RP. Click "Done" on a low-urgency alert → no credit. |

Every verb gets a smoke-test scenario in a `tests/offchain-rp.spec.ts` Playwright file before going live. No exceptions.

---

## 2. Tokenomics rebalance proposal

**Important:** the plan keeps all of this labeled "Proposed — Subject to Change" in user-facing copy, per the existing CLAUDE.md tokenomics-is-proposed-not-final principle.

### Current proposed allocation

| Slice | % | Rationale |
|---|---|---|
| Community Treasury | 40% | Ecosystem development, grants, governance pool |
| Ambassador Rewards | 25% | Long-term ambassador compensation |
| Founding Team | 15% | 3-year vesting starting at token launch |
| Liquidity | 10% | USDC pair on Aerodrome |
| Airdrop to Early Users | 10% | Distributed by RP earned |

### Recommended revised allocation (PROPOSED)

| Slice | % | Δ from current | One-sentence rationale |
|---|---|---|---|
| **Airdrop to Early Users** | **20%** | +10 | Doubles to reflect that the broader earning surface (Sage, garden tracking, photos) now makes the airdrop the primary delivery vehicle for "you've been an engaged user for two years — here's your share." |
| **Ambassador Rewards** | **30%** | +5 | Modest bump to honor Doug's "ambassadors are critical infrastructure" principle, especially as the network grows beyond direct-recruit chains into broader regional builders. |
| **Community Treasury** | **25%** | -15 | Still substantial — funds grants, governance, ecosystem, but no longer the dominant slice. Reads as a working pool, not a reserved war chest. |
| **Founding Team** | **15%** | 0 | Unchanged. 3-year vesting from launch. Keeping this stable in case Doug wants to reduce it later in response to feedback (memo `feedback_no_founder_allocation_copy.md`). |
| **Liquidity** | **10%** | 0 | Unchanged. USDC pair on Aerodrome needs sufficient depth to be useful. |

**Total: 100%** ✓

### Why this split

- **The 40 → 25 treasury reduction directly addresses Doug's stated concern** ("The treasury feels and reads large to me"). 25% still funds ecosystem work for years.
- **The +10 to airdrop matches the operational expansion.** Today the airdrop is one of five user-facing reward categories. After this expansion, the airdrop covers off-chain Sage engagement, plant tracking, photos, harvests — most of the gardener flow. The slice should match the load.
- **The +5 to ambassadors keeps them visibly elevated.** Doug's framing: "Ambassadors need to be highlighted much more." Bumping from 25 → 30 is a visible signal in the chart that ambassadors are the largest distributed-to-users category.
- **The split between ambassadors (30) + airdrop (20) = 50%.** Half the total supply flows to users doing user work. That's the headline message: this is community-built infrastructure.

### What this is NOT proposing

- Not changing the per-user RP rates. Still 500 RP/$1 seller, 50 RP/$1 buyer, etc.
- Not changing the per-RP $ROOTS conversion rate at snapshot. The conversion is `userRP / totalRP × airdropPool`. Bigger pool = each user's RP buys more $ROOTS at snapshot. Same fair-share mechanic.
- Not changing what RP earn — just what they convert into.
- Not promising a community vote. (Doug should decide whether this gets voted on by ambassadors or set by him directly. See open questions.)

### Reset risk

This is a UI/copy change to `/about/tokenomics` and a number change in `scripts/distribution/calculateAllocations.ts` (the `AIRDROP_ROOTS_AMOUNT` env var). It does NOT require any contract redeploy because no on-chain contract knows the % split — that's purely an off-chain merkle decision until snapshot. Doug can revise these numbers up until the moment merkle generation runs.

---

## 3. Universal awareness UX

**Principle:** every surface where users do something that earns RP should have a *consistent, small, non-intrusive* affordance that says "+X RP" with a path to the tokenomics page. Three tiers:

1. **Just-in-time feedback** — transient toast / inline pill at the moment of earning.
2. **Ambient display** — always visible header pill showing lifetime RP count.
3. **Educational** — one-time onboarding modal explaining RP → $ROOTS, plus a tokenomics link from every reward affordance.

### Tier 1: Just-in-time feedback (proposed surfaces)

| Surface | File | Current state | Proposed addition |
|---|---|---|---|
| Sage chat — first message of day | `frontend/src/components/grow/GardenAIChat.tsx` (line ~496 sendMessage handler) | Sends message → streams response. No RP feedback. | After successful first-of-day stream completion, render an inline ephemeral pill above the next message: "+10 RP — daily check-in with Sage." Auto-fades after 6s. Linked to `/about/tokenomics`. |
| Plant added | `frontend/src/components/grow/AddPlantsModal.tsx` (final "Add to Garden" step) | Plants added → modal closes silently. | After modal closes, fire a global toast via `useToast()`: "🌱 Plant added — +25 RP (today's earnings: X RP)". Toast is plant-count aware: 3 plants added → "+75 RP". |
| Plant photo uploaded | Plant photo flow (need to confirm exact file — likely a sub-flow within `GardenPlantCard.tsx`) | Photo uploads → updates plant silently. | Toast: "📸 Photo captured — +30 RP." |
| Harvest logged | `frontend/src/components/grow/GardenPlantCard.tsx` line 161 (onHarvest button) | Click → plant marked harvested, no feedback. | Toast: "🌾 Harvest logged — +40 RP." |
| Care alert acted on | `GardenPlantCard.tsx` "Done" button or care-alert flow | Click → alert dismissed silently. | Toast: "✓ Care complete — +15 RP." (Only for urgent-state alerts, matching the credit logic.) |
| Listing created | `frontend/src/app/sell/listings/new` (after submit) | Listing posts on-chain → existing milestone banner. | Existing seller milestone surface stays. Add: toast for the off-chain stack: "Listing live — +100 RP." (Only after the 48h check passes — schedule the toast for the user's next visit if they're not online.) |
| Public garden profile published | `frontend/src/components/grow/PublicGardenSettings.tsx` save handler | Save → success toast. | Update toast copy: "Profile published — +200 RP. Tap to see what these mean →" |
| Bed created | `BedFormModal.tsx` save handler | Bed saved silently. | Toast: "🪴 Bed created — +50 RP." |
| Share card sent | `frontend/src/components/ShareCardModal.tsx` after share | Native share opens, no feedback after. | Toast on share success (Web Share API resolve, OR clipboard copy success): "📣 Shared — +5 RP." |

**Implementation note:** all toasts share a single rendering utility — `frontend/src/lib/rpToast.ts` (new). Centralizes copy, ensures consistent UX, includes the "tap to learn more" hook to `/about/tokenomics`. Prevents drift.

### Tier 2: Ambient display (header pill + profile section)

| Surface | File | Current state | Proposed addition |
|---|---|---|---|
| Header — RP pill next to wallet pill | `frontend/src/components/UnifiedWalletButton.tsx` line 243 (`WalletPill`) | Shows only USD wallet value. RP not visible anywhere always. | New sibling component `RootsPointsPill` rendered next to `WalletPill` when authenticated. Shows total RP (on-chain + off-chain). Tooltip on hover: "Roots Points — convert to $ROOTS at launch. Tap for details." Click → `/about/tokenomics`. |
| Profile page — Your Roots Points section | `frontend/src/app/profile/page.tsx` | Section list: Identity, Gardener, Seller, Ambassador, Buyer. No RP section. | New section "Your Roots Points" — shows total, breakdown by source (sales, purchases, ambassador, off-chain engagement), link to tokenomics. Read-only. Becomes the canonical "where am I in my RP journey" view. |
| Wallet page — RP balance line item | `frontend/src/app/wallet/page.tsx` and `WalletDashboard.tsx` | Wallet shows token balances (ROOTS, USDC, ETH) but no RP. | Add an RP line to the token balance list, prefixed with "🌱 Roots Points" and a "Pre-launch" badge. Click → `/about/tokenomics`. |

The header RP pill is opinionated: I think this should ship even though there's a real concern (Doug's framing: "everyone, everywhere should be aware that they are earning points"). The risk is that it makes the app feel like a points game — see open questions.

### Tier 3: Educational

| Surface | File | Proposed addition |
|---|---|---|
| First-time onboarding modal | `frontend/src/app/grow/page.tsx` (or wherever first-visit detection lives — likely a new useFirstVisit hook) | One-time modal on first signed-in visit: "Welcome to LocalRoots. As you use the app, you'll earn Roots Points — see them in your profile. Tap to learn what they become →" One-time, dismissible, never blocking. |
| Tokenomics link from every RP affordance | Across all surfaces in Tier 1 + 2 | Every "+X RP" affordance includes a discoverable path to `/about/tokenomics`. No exceptions. |
| Garden empty state | `frontend/src/components/grow/MyGardenView.tsx` empty state | When user has no plants, the existing empty state should add: "Add your first plant to start earning Roots Points." |
| Tokenomics page — Sage section | `frontend/src/app/about/tokenomics/page.tsx` "How You Earn Roots Points" section | Expand from 3 cards (Sell / Buy / Build the Network) to 4 cards — add "Garden With Sage" describing the new engagement earning category. |

### What to explicitly NOT do

- **No counter animations** ("+10 RP" flying into a counter). Reads as gamified mobile-game UX, fights the "gardening companion first" positioning.
- **No leaderboards based on off-chain RP.** The current leaderboard at `/leaderboard` is sourced from the subgraph (on-chain). Don't extend it to include off-chain RP — it would invite gaming and feel like a video game ranking system. Off-chain RP exists for the airdrop, not for status display.
- **No streak counters.** ("You've checked in 14 days in a row!") Doug-tested gardening companion positioning gets damaged by Duolingo-style mechanics. The daily Sage RP credit is enough; streaks add gamification psychology nobody asked for.

---

## 4. Privy-wallet airdrop architecture impact

### Anon Sage users — do they have wallets?

Reading `frontend/src/components/grow/GardenAIChat.tsx` lines 168-182: anon Sage users **do not have wallets**. The chat uses a `crypto.randomUUID()` stored in localStorage as the userId. If they never sign in with Privy, they never get a wallet, and they never get an airdrop.

**Implication:** off-chain RP credits are only ever recorded for users with a real Privy or wagmi address. Anon users earn nothing. This is the right call:
- It naturally drives Sage users to sign in (with a clear pitch — "sign in to start earning Roots Points for your garden")
- It prevents the "what's our airdrop liability for anon users" question, because anon users are not in the system
- The Sage product doesn't break for anon users; they just don't accumulate RP

**Conversion path for existing anon Sage users:** when an anon user finally signs in with Privy, we have no clean way to retroactively credit them for prior chat history. Options:
1. Don't backfill — only credit forward from signin. (Simpler. Cleaner. My recommendation.)
2. Backfill by replaying KV `garden:conv:{anonId}` records — but the anonId-to-PrivyId mapping doesn't exist anywhere, and matching by localStorage requires client-side logic.

**Recommendation:** option 1. Doug can override if he feels strongly that early anon users should be rewarded.

### KV → Privy address mapping at snapshot

The existing flow in `scripts/distribution/fetchPrivyUsers.ts` queries the Privy Management API for the list of Privy embedded wallet addresses. That list is the authoritative set of "Privy users we should airdrop to."

**New step needed at snapshot:** read `rp:offchain:{privyAddress}` for every Privy wallet, sum into the per-address total. The Privy address is already lowercased in `calculateAllocations.ts`. Match perfectly.

Pseudo-flow update to `calculateAllocations.ts`:

```
1. Fetch on-chain RP from subgraph (existing — returns seedsBalances per address)
2. Fetch Privy wallets from privy-wallets.json (existing)
3. NEW: For each Privy wallet, read rp:offchain:{address} from KV → add to user's RP total
4. NEW: For each external wallet from subgraph, off-chain RP is 0 by definition (they never had a Privy ID)
5. Apply wash-trading filter (existing for on-chain; expanded to cover off-chain, see below)
6. Compute final $ROOTS allocation pro-rata across total filtered RP
7. Output privy-allocations.json + external-allocations.json
```

### New wash-trading vectors for off-chain RP

The existing on-chain wash filter (per CLAUDE.md line 1832-1851) targets:
- Address-graph cliques (two wallets that exclusively transact with each other)
- Time-correlated activity bursts
- Identical-amount round-trips

Off-chain RP introduces **new** vectors the script needs to defend against:

| Vector | Description | Detection |
|---|---|---|
| **Sage-message spam farm** | One human (or one script) creates 50 Privy accounts, each chats with Sage daily for 60 days, harvests 30K RP across the farm. | Cluster detection: identify Privy accounts with: (a) same IP at registration, (b) same login fingerprint (Privy provides this), (c) Sage conversation patterns with high lexical similarity, (d) no other on-chain activity. Zero out off-chain RP for clustered accounts. |
| **Photo-recycle abuse** | Same person uploads stock photos / AI-generated plant photos to 50 accounts. | Phash photo hashes server-side at upload time. Flag accounts using known stock-photo hashes or with high cross-account hash overlap. |
| **Empty garden bed spam** | Create 10 beds × 5 accounts = 50 × 50 RP = 2,500 RP per account farmed. | Lifetime caps already mitigate (max 500 RP / user from beds). Additional: only first 3 beds per user earn the +50 (proposed adjustment). |
| **Plant-add-remove loop** | Add plant, remove plant, repeat. (Mitigated already by cropId-not-yet-credited check, but worth restating.) | Server-side: `rp:offchain:event:plant-added:{userId}:{cropId}` is a permanent key. Re-adding same cropId never re-credits within 30 days, and the photo dedupe within 14 days catches photo abuse on the same plant. |
| **Care-alert-fire-then-dismiss loop** | Engineer a plant into "bolting" state, dismiss, undo, re-fire. | Care alert credit is per `plantId + cycle`. Cycle is computed from days-since-plant-creation. Re-dismissing same alert doesn't re-credit. |

These all live in the expanded `scripts/distribution/calculateAllocations.ts` wash-filter step, scheduled for the pre-snapshot sprint (per CLAUDE.md line 1832, ~2-3 days work — now bumps to ~5-7 days because of the new vectors).

### Off-chain RP per-user audit trail

Every credit writes an event record (`rp:offchain:event:{eventId}`). At snapshot, the audit script outputs a per-user trail so:
- Doug can spot-check that high earners look legit
- The wash filter can group and inspect suspicious patterns
- Disputes can be reviewed before merkle is signed

This audit step is new; it's part of the merkle generation pipeline, not a separate feature. Plan to dedicate ~1 day to a spreadsheet/CSV export so Doug can scan the top 100 off-chain RP earners by hand before snapshot.

### Doug's admin wallet + test wallet flagging

CLAUDE.md line 1839 already says Doug's admin wallet (`0x30C4343A742F922Ea8cF10e2042919C873274879`) and test wallets get zeroed out at merkle stage. Same logic must zero their off-chain RP too. The wash filter adds these addresses to its always-zero set; off-chain RP for these addresses goes to 0 alongside on-chain.

---

## 5. Implementation sequencing

Three phases. Each has a verification gate that must pass before moving to the next.

### Phase 1 — Foundation (week 1, ~5 days)

**Goal:** infrastructure that can credit a single verb end-to-end, plus the highest-leverage awareness UI shipping.

**What ships:**
- `frontend/src/lib/offchainRP.ts` — shared validator + crediter with cap enforcement and dedup
- KV schema (4 keys per the design above) live in production
- One verb wired end-to-end: **Plant Added** (chosen first because the API path is already well-defined at `/api/my-garden/route.ts`)
- `frontend/src/lib/rpToast.ts` — shared just-in-time RP toast utility
- Toast wired into the AddPlantsModal flow
- `useOffchainRP(privyAddress)` React hook for client-side display
- `RootsPointsPill` component rendered in the header next to `WalletPill`
- New "Your Roots Points" section on `/profile`
- Verification: end-to-end test on production showing: add plant → toast fires → header pill increments → profile shows updated total → KV record exists

**Critical files (Phase 1):**
- `frontend/src/lib/offchainRP.ts` (new)
- `frontend/src/lib/rpToast.ts` (new)
- `frontend/src/app/api/my-garden/route.ts` (modify)
- `frontend/src/components/UnifiedWalletButton.tsx` (add `RootsPointsPill`)
- `frontend/src/app/profile/page.tsx` (add section)
- `frontend/src/hooks/useOffchainRP.ts` (new)

**Verification gate:** Doug-driven end-to-end test on production. Add a plant → see the toast → see the header pill update → see profile section update → cap a day at 100 RP by adding a 5th plant → confirm 5th doesn't credit. Doug signs off explicitly.

### Phase 2 — Expansion (week 2, ~5 days)

**Goal:** roll out the remaining earning verbs and the rest of the awareness UI, including the one-time onboarding modal and tokenomics page update.

**What ships:**
- Remaining verbs wired (Sage chat, photos, harvest, care alert, bed, public profile published, share card, listing off-chain, recruited gardener)
- First-time onboarding modal triggered on first Privy login
- Tokenomics page update: add 4th earning card ("Garden With Sage") + proposed rebalance to 25/30/15/10/20 (with "Subject to Change" remaining)
- Wallet page: RP line item in token balances
- Empty-state copy updates in MyGardenView
- Per-verb verification test in Playwright (tests/offchain-rp.spec.ts)

**Critical files (Phase 2):**
- `frontend/src/app/api/garden-ai/route.ts` (Sage chat credit)
- `frontend/src/app/api/care-dismissals/route.ts` (care alert credit)
- `frontend/src/app/api/gardener-profile/route.ts` (profile-published credit)
- `frontend/src/app/api/share-cards/sent/route.ts` (new — share card credit)
- `frontend/src/app/about/tokenomics/page.tsx` (allocation + Sage earning card)
- `frontend/src/components/wallet/WalletDashboard.tsx` (RP line item)
- `frontend/src/components/RootsPointsOnboardingModal.tsx` (new)

**Verification gate:** every verb has a passing Playwright test that exercises it end-to-end on a test mainnet account. Doug walks through the onboarding modal flow and confirms copy reads right.

### Phase 3 — Pre-snapshot hardening (week 3-4, ~7-10 days)

**Goal:** lock in the wash filter that protects off-chain RP, finalize tokenomics, update the merkle generator, dry-run the airdrop.

**What ships:**
- Expanded wash filter in `scripts/distribution/calculateAllocations.ts` covering all 5 new off-chain vectors
- Photo perceptual-hash service for cross-account hash matching (new — likely a script-only utility, not a runtime service)
- Privy account clustering heuristic (IP + login fingerprint + Sage-message similarity)
- CSV export of top 100 off-chain RP earners for Doug's manual review
- Final tokenomics number lock-in (with Doug's signoff)
- Updated airdrop methodology documentation (per CLAUDE.md line 1841)
- Dry-run of full merkle generation pipeline on testnet snapshot

**Critical files (Phase 3):**
- `scripts/distribution/calculateAllocations.ts` (expanded with off-chain + wash filter)
- New `scripts/distribution/washFilter.ts` (extracted from calculateAllocations for clarity)
- New `scripts/distribution/exportTopEarners.ts` (CSV for Doug review)
- `frontend/src/app/about/tokenomics/page.tsx` (final numbers)
- New `docs/airdrop-methodology.md` (public document)

**Verification gate:** dry-run merkle generation produces (a) sensible distributions, (b) flagged wash-trading addresses with explanations, (c) Doug confirms top 100 list looks legit. Pass = ready to schedule actual snapshot.

### Estimated total: 17-20 working days from start

This is intentionally not 4 weeks of Doug's calendar — it's working time. Phase 3 is the squishy one because wash filter quality depends on what the data looks like at snapshot time. If most users are clearly legit, Phase 3 is shorter; if there's evidence of farming, it's longer.

---

## 6. Open architectural questions for Doug

These are the calls only you can make. Ranked roughly by how much they shape the rest of the plan.

1. **Tokenomics rebalance to 25/30/15/10/20 — accept the proposed split, or adjust?** This drives the airdrop pool size, which drives per-user $ROOTS conversion at snapshot. If you want a different split, name the numbers and I'll re-run the analysis in implementation.

2. **Tokenomics decision — propose for community/ambassador vote, or Doug-decides?** A vote signals decentralization but slows the lock-in. Direct decision is faster, but means you carry the "why these numbers" answer if anyone asks.

3. **Should the header pill ship in Phase 1?** Risk: the app starts feeling like a points game. Benefit: ambient awareness everywhere, which is what you explicitly asked for ("everyone, everywhere should be aware"). My recommendation: ship it but keep it visually quiet (small, no animations, no streak badges). Override if you'd rather keep RP visible only on profile + tokenomics pages.

4. **Anon Sage users — backfill RP when they later sign in, or only credit forward?** My recommendation: only credit forward (simpler, no orphan localStorage→Privy mapping work). You override if you feel strongly about rewarding early anon users.

5. **Sage chat RP — fixed +10 daily cap, or scale with conversation depth (the +15 bonus for ≥5 messages)?** Fixed is safer against gaming and reads honest. Depth-scaled rewards real engagement but invites length-padding spam. My recommendation: ship the +10 daily cap only in Phase 1; add the +15 depth bonus in Phase 2 only after we see real chat data and decide if depth is gameable in practice.

6. **Plant photo dedup — perceptual hash check (catches re-uploads of same photo bytes) yes or no?** Yes adds ~1-2 days of work in Phase 3 and depends on `sharp` or similar. No keeps the dedup window-based only (same plant, 14-day window). My recommendation: yes — the cost of photo abuse on airdrop integrity is too high to leave unhashed.

7. **Off-chain RP — should it be visible on the public `/leaderboard` page, or kept private (only visible on user's own profile)?** My recommendation: keep it private. The on-chain leaderboard already exists at `/leaderboard`; leave that as the public ranking surface (it's the marketplace-activity story). Off-chain RP is private to the user and rolls into the airdrop. Public leaderboards on engagement create gaming incentives.

8. **Tokenomics page — disclose the new earning surface (Sage chat, plant photos, etc.) on `/about/tokenomics`, or keep it minimal?** Disclosure is more honest and helps users understand why they're earning. Risk: regulatory ear-pricking — "you pay users for using your app" reads worse than "you reward marketplace participants." My recommendation: disclose, but with language explicitly framing it as participation rewards (like airline miles for staying engaged with a loyalty program), not compensation. Keep the language "loyalty rewards" everywhere.

---

## Closing notes

- **What this plan deliberately does not change:** the on-chain marketplace, AmbassadorRewards, and DisputeResolution contracts are immutable and stay as-is. Every new earning verb is purely off-chain. The merkle generator stays the snapshot-time integration point. This is a feature about adding rails, not relaying tracks.
- **What this plan deliberately doesn't promise:** specific dates, specific token launch milestones, or specific $ROOTS per RP rates. Everything maps to "we'll announce more as plans firm up" per the existing user-facing posture.
- **The risk I want to flag most loudly:** off-chain RP is a sybil farm magnet. The wash filter is the entire defense, and its quality is bounded by what off-chain signal we have. Be ready in Phase 3 for some uncomfortable judgment calls — there will be borderline accounts, and zeroing them out has reputational risk, but not zeroing them out makes the airdrop unfair to genuine users. Plan to budget time for Doug-side review of the flagged list before merkle signing.

---

### Critical Files for Implementation

- frontend/src/app/api/my-garden/route.ts
- frontend/src/app/api/garden-ai/route.ts
- frontend/src/components/UnifiedWalletButton.tsx
- frontend/src/app/about/tokenomics/page.tsx
- scripts/distribution/calculateAllocations.ts
