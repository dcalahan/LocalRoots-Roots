# LocalRoots Project Guidelines

## Product Positioning — CRITICAL CONTEXT

LocalRoots is a **gardening companion first, marketplace inside.** The AI gardening assistant is the front door — it delivers immediate single-player value. The marketplace (buy/sell local food) is a feature that emerges naturally when users have surplus harvest. "Neighbors Feeding Neighbors" is the brand soul, woven into every page (header tagline, footer), but NOT the headline.

**Rules for all UI/copy/marketing work:**
- Lead with gardening value, not marketplace
- Never mention blockchain, crypto, tokens, or wallets in user-facing copy
- No tokenomics, allocation, or $ROOTS details on the website until pre-launch (~early 2027). Publishing token info now invites regulatory scrutiny with no upside.
- Position selling as "sharing extras with neighbors"
- Primary CTA is "Start Growing" not "Browse Produce" or "Start Selling"
- The AI should feel like a knowledgeable friend, not a product feature

## Zero Liability via Decentralization — STRATEGIC PRINCIPLE

**Doug's North Star (Apr 26 2026):** "Host food listings (food-safety liability is real) is why this must be a decentralized application. I want zero liability."

LocalRoots is **infrastructure, not an operator.** The decentralized architecture isn't just censorship-resistant — it's the legal foundation for zero-liability defense. Every architectural decision should preserve this posture:

- **Sellers are the food producers.** They list, they sell, they are legally responsible. LocalRoots does not inspect, certify, or guarantee food safety.
- **Buyers transact directly with sellers.** Smart contract escrow holds funds; LocalRoots never custodies money.
- **Disputes are decided by ambassador voting on-chain.** LocalRoots does not adjudicate. Ambassadors do.
- **No platform fees.** Every dollar goes to the seller. LocalRoots earns nothing from individual transactions, which strengthens the "we're not a service provider" defense.
- **Open-source contracts + multi-relayer goal + IPFS frontend goal.** Anyone could fork and run a competing instance — LocalRoots-the-codebase outlives LocalRoots-the-company.

**Architectural rules that follow from this principle:**
- Never centralize what can be decentralized. KV is currently the biggest violation (see Decentralization Roadmap).
- Never custody user funds. Ever.
- Never let a single LocalRoots entity decide a dispute. Ambassadors vote; outcomes are on-chain.
- Don't add features that make us look like an operator (e.g. "LocalRoots curates the best gardens" → bad; "the marketplace exists, gardeners list themselves" → good).
- ToS language must reflect the protocol-not-service framing. See `/terms` page.

**Why this matters legally (paraphrased — not legal advice):** Food-safety liability typically attaches to the producer and to operators who hold themselves out as merchants of the food. A protocol that facilitates peer-to-peer transactions without taking custody, without inspecting product, and without setting prices is structurally closer to the open internet than to a grocery store. The decentralization isn't decorative — it's the specific defense.

**Reference:** Section 6 of `/terms` page contains the full zero-liability clause. Update there if the principle expands.

## Tokenomics: Proposed, Not Final — STRATEGIC PRINCIPLE

**Doug's framing (Apr 27 2026):** "Maybe make the tokenomics a proposed or probable tokenomics? The treasury feels and reads large to me."

The allocation chart on `/about/tokenomics` (40% community treasury, 25% ambassadors, 15% founders, 10% liquidity, 10% airdrop) is **PROPOSED, not final.** Until contracts deploy at $ROOTS launch, every percentage in that chart should be treated as a working draft and labeled as such in user-facing copy.

**Rules:**
- Any time the allocation chart is rendered, it must include a "Proposed Allocation (Subject to Change)" header or equivalent qualifier. Never present allocations as locked in.
- The 40% treasury figure is under active review — Doug feels it reads as too large a slice. Proposals to reduce the treasury and reallocate (likely to ambassadors and/or airdrop) should be evaluated as ambassador prominence increases.
- Pre-launch, never publish a final number anywhere (page, marketing email, Slack post) without flagging it as proposed.
- Specific dates ("spring 2027 launch", etc.) should not appear in user-facing copy. The marketplace is live; the token launch is "later" — that's all.

**Revisit when:** marketplace has 100+ active sellers OR Common Area outreach moves from cold to warm at scale. By then we'll have real signal on what proportion of value goes where, and Doug will lock in numbers.

**See also:** `feedback_no_founder_allocation_copy.md` memory says "never highlight founder allocation in public copy." That memory is in tension with Doug's Apr 27 instruction to keep the allocations on the tokenomics page so ambassadors can see them. Resolution: the chart stays for now (ambassadors need it for their own pitch), but the "Founding Team" line is the most regulatory-sensitive — re-evaluate before any major outreach push.

## Ambassadors Are Critical Infrastructure — STRATEGIC PRINCIPLE

**Doug's framing (Apr 27 2026):** "Ambassadors need to be highlighted much more as we onboard them. I think we undersell how important they are throughout the application as well as how much they can make. Ambassadors are critical for success."

LocalRoots's growth model lives or dies on ambassadors. They are not a side feature — they are the distribution layer. Every gardener and every buyer in a new region most likely arrived through an ambassador. The platform's economics (25% of every sale flows up the chain for a year) is generous on purpose, because ambassadors do the work the platform can't do at scale: actually meeting humans in their actual neighborhoods.

**Rules for every UI/copy/marketing decision:**
- **Lead with ambassadors in growth-side copy.** When explaining "how does this network grow," the answer is ambassadors, not Common Area, not SEO, not paid acquisition.
- **Surface ambassador earning potential prominently.** Today the app underplays the math. Sellers see Roots Points multipliers; ambassadors should see equally prominent surfacing of "your potential earnings" — both cash commission today and Roots Points share at token launch.
- **Ambassador prominence in the seller flow.** When a seller sees who recruited them on `/sell/register`, that's good — but the connection should persist (e.g. on the seller dashboard: "Your ambassador: [name] — message them with questions"). Right now the recruiter relationship goes invisible after registration.
- **Public ambassador showcasing.** Top ambassadors deserve their own visibility, not just an internal leaderboard. Consider a public `/ambassadors` page showing active ambassadors by region. (Privacy-respecting — opt-in display name + region only.)
- **The Chief Ambassador tier** (Matt Hunt + future) needs special UI treatment. Their recruits, their region, their share of GMV are all on-chain — surface them.
- **Compensation visibility.** A registered ambassador's dashboard should answer "what would I make if I recruit X sellers" with concrete numbers, not vague language.
- **Ambassador-driven UX in the buyer flow too.** When a buyer transacts with a seller, somewhere in the flow it should be discoverable that "this seller was recruited by [ambassador name]" — gives ambassadors their flowers and gives buyers a hook to say "huh, I should be an ambassador too."

**Anti-patterns to avoid:**
- "Become an Ambassador" buried in a footer link or hidden behind dropdown menus
- Generic "earn rewards" copy that treats ambassadors as a tier of buyer/seller — they're a different role with a different value prop
- Calling them "referrers" or "marketers" — they're community organizers; copy should reflect that

**The big picture:** Pre-launch, ambassadors are taking risk on an unproven platform for cash now and Roots Points later. We owe them the spotlight. Post-launch, ambassadors are the reason new regions onboard. They never stop mattering.

**Track in:** `project_ambassador_prominence_push.md` (next session — full UX/copy plan for elevating ambassador prominence across the app).

## Session Startup - DO THIS FIRST

**Start a Background Slack Listener** at the beginning of every session.

**If MCP tools are available** (check for `mcp__slack-bridge__check_replies`):
- Use a background agent that polls `mcp__slack-bridge__check_replies` every ~60 seconds
- Respond to new messages via `mcp__slack-bridge__send_message`
- The listener should be silent (no status messages) and only act when there are new messages

**If MCP tools are NOT available** (fallback):
```bash
# Start bash-based Slack poller for #claude-localroots (C0AELQC8GDV)
rm -f /tmp/slack-localroots-messages /tmp/slack-localroots-last-ts
nohup /tmp/slack-poll-localroots.sh > /tmp/slack-poll-localroots.log 2>&1 &
```
Check for messages: `cat /tmp/slack-localroots-messages`
Send message: Use curl with Slack API (token in script)

This allows Doug to communicate via Slack while Claude works on tasks.

## Color Palette - ALWAYS USE THESE

Never use generic Tailwind colors (green-600, emerald-50, etc.). Always use the brand palette:

- `roots-primary` (`#EB6851`) - Coral/orange. Primary actions, CTAs.
- `roots-secondary` (`#3EBFAC`) - Teal. Garden/grow features, secondary actions.
- `roots-cream` (`#F5F0EE`) - Light background, text on dark backgrounds.
- `roots-gray` (`#818181`) - Body text, muted content.

Use opacity variants (e.g., `bg-roots-secondary/10`) for lighter shades instead of separate color classes.

## Wallet Architecture - CRITICAL

### Route-Based Wallet Context

The app is route-aware for wallet connections:
- `/buy/*` routes → Show `BuyerWalletModal` (external wallets + test wallet + Privy for credit card buyers)
- `/sell/*` routes → Show Privy login directly
- `/ambassador/*` routes → Show Privy login directly

This is controlled by `UnifiedWalletButton` in the header, which checks `usePathname()`.

### Buyers (Two Types)

**1. Crypto Buyers (External Wallets)**
- Use WalletConnect, Coinbase Wallet, or browser extensions (MetaMask, etc.)
- Connected via wagmi/viem
- Orders tied to their external wallet address
- Must reconnect same wallet to view orders

**2. Credit Card Buyers (Privy)**
- Pay with credit card via thirdweb Pay
- Get a Privy embedded wallet tied to their email/phone
- Can "Login with Email" to view past orders
- Orders tied to their Privy wallet address

### Sellers & Ambassadors

Both sellers and ambassadors use Privy embedded wallets with gasless meta-transactions:

**Authentication Flow:**
1. User clicks "Login" on `/sell/*` or `/ambassador/*` routes
2. Privy login modal appears (email, phone, or social login)
3. Privy creates an embedded wallet tied to their identity
4. User never needs ETH for gas - all transactions are gasless

**Gasless Transaction Flow (ERC-2771):**
1. User initiates action (register seller, create listing, register ambassador, etc.)
2. `useGaslessTransaction` hook encodes the contract call
3. User signs an EIP-712 typed message (ForwardRequest) via Privy wallet
4. Signed request is sent to `/api/relay` endpoint
5. Relayer wallet (funded with ETH) submits transaction to ERC2771Forwarder contract
6. Forwarder calls target contract with user's address as `_msgSender()`
7. User's action is recorded on-chain without them paying gas

**Key Hooks:**
- `useGaslessTransaction` - Core hook for all gasless operations
- `useRegisterSeller` - Seller registration (gasless)
- `useCreateListing` - Create product listings (gasless)
- `useRegisterAmbassador` - Ambassador registration (gasless)

**Important:**
- Sellers/ambassadors should NEVER use wagmi's `useAccount()` - always use `usePrivy()` and `useWallets()`
- The relayer wallet (`RELAYER_PRIVATE_KEY` env var) must have ETH to pay gas
- All contracts must inherit from OpenZeppelin's `ERC2771Context` to support meta-transactions

### localStorage Tracking

`buyer_wallet_type` key tracks how buyer connected:
- `'external'` - WalletConnect, Coinbase, browser extension
- `'privy'` - Credit card buyer via email login
- `'test'` - Test wallet (dev only)
- Cleared on disconnect

### Test Wallet
- Only available when `NEXT_PUBLIC_TEST_WALLET_PRIVATE_KEY` is set
- **Never shown in production** - don't set that env var in prod
- **Never auto-connects** - must be explicitly selected
- Uses sessionStorage for persistence within browser session
- Used for internal testing only

### UI Language
- Don't mention specific wallet brands (not "MetaMask", just "your wallet")
- Buyers "Sign In" on `/buy/*` routes
- Sellers/Ambassadors "Login" on `/sell/*` and `/ambassador/*` routes

## Key Components

| Component | Purpose |
|-----------|---------|
| `UnifiedWalletButton` | Route-aware wallet button in header - shows `BuyerWalletModal` on `/buy/*`, Privy login on `/sell/*` and `/ambassador/*` |
| `BuyerWalletModal` | Modal for buyer wallet options (external wallets, test wallet, email login for credit card users) |
| `usePrivy` / `useWallets` | Privy authentication hooks - use for sellers, ambassadors, and credit card buyers |
| `useAccount` (wagmi) | External wallet state for crypto buyers |
| `useBuyerOrders` | Fetches orders - supports both wagmi and Privy addresses |
| `useGaslessTransaction` | Gasless meta-transactions for sellers/ambassadors via Privy wallet |
| `useAdminStatus` | Checks admin status - supports both wagmi AND Privy wallets |

## Admin Dashboard

**Route:** `/admin`

**Access:** Must be in the `isAdmin` mapping on the LocalRootsMarketplace contract. Supports both external wallets (wagmi) and Privy embedded wallets.

**Adding admins:** Use `addAdmin(address)` on the marketplace contract from an existing admin wallet.

**Tabs:**
- **Live Activity** - Real-time feed of sellers, listings, orders
- **Registrations** - View/suspend/unsuspend sellers and ambassadors
- **Orders** - View orders, cancel with refund
- **Disputes** - View all disputes, admin resolve with reason
- **Admin Management** - Add/remove admins, manage voter whitelist
- **Operations Treasury** - Gnosis Safe for USDC payments

**Key files:**
- `frontend/src/app/admin/page.tsx` - Main admin dashboard
- `frontend/src/hooks/useAdminStatus.ts` - Admin check (wagmi + Privy)
- `frontend/src/hooks/useAdminActions.ts` - Admin write actions (suspend, unsuspend, etc.)
- `frontend/src/components/admin/DisputesTab.tsx` - Dispute management
- `frontend/src/components/admin/RegistrationsTab.tsx` - Seller/ambassador management
- `frontend/src/components/admin/AdminManagementTab.tsx` - Admin + voter whitelist management
- `frontend/src/components/admin/OrdersTab.tsx` - Order management
- `frontend/src/components/admin/operations/*` - Operations Treasury (Gnosis Safe)

## Ambassador Compensation (Pre-Launch)

**CRITICAL: Cash payments are TEMPORARY.** Once $ROOTS token launches, ambassadors are paid ONLY in $ROOTS tokens automatically on-chain. All cash payment tracking code will be deleted.

Ambassadors receive **two forms of compensation** during pre-launch:

| Reward | Amount | Paid Via | Timing | Status |
|--------|--------|----------|--------|--------|
| **Cash Commission** | 25% of sale value | Venmo / PayPal / Zelle (manual) | Now | TEMPORARY |
| **Seeds** | 25% of sale value | On-chain events (automatic) | Converts to $ROOTS at launch | Permanent |

**How it works:**
- When a recruited seller makes a sale, the ambassador chain earns 25% as cash commission
- The same 25% is ALSO recorded as Seeds on-chain (automatic)
- Cash is paid manually via Venmo/PayPal/Zelle - founder tracks and pays directly
- 80/20 split up the chain: recruiter keeps 80%, passes 20% to upline

**Cash Payment Tracking System (TEMPORARY):**
- Uses Vercel KV for simple key-value storage (easy to tear down)
- Ambassador sets payment preferences in their profile (stored in IPFS)
- Admin sees all ambassadors and balances in Admin Dashboard → Ambassador Payments tab
- Admin manually marks payments as sent after paying via Venmo/PayPal/Zelle

**Key Files (DELETE at $ROOTS launch):**
- `frontend/src/app/api/payments/route.ts` - Payment CRUD API
- `frontend/src/hooks/useAmbassadorPayments.ts` - Fetch payment records
- `frontend/src/hooks/useRecordPayment.ts` - Admin record payment
- `frontend/src/components/ambassador/PaymentStatusCard.tsx` - Ambassador dashboard
- `frontend/src/components/ambassador/PaymentPreferencesModal.tsx` - Set Venmo/PayPal/Zelle
- `frontend/src/components/admin/AmbassadorPaymentsTab.tsx` - Admin payment management
- `frontend/src/components/admin/MarkPaidModal.tsx` - Record payment modal

**Why cash instead of crypto?** Target ambassadors (college students, non-crypto-native people) use Venmo, not crypto wallets. Meet them where they are.

**Why both cash and Seeds?** Ambassadors get real money now (cash) plus equity upside (Seeds → $ROOTS). This rewards early ambassadors who are taking a risk on an unproven platform.

## Sell + My Garden + Sage Unification — STRATEGIC PLAN

**Status (Apr 26 2026):** approved by Doug, in active build.

### Why this exists

LocalRoots evolved in three layers added at different times: Sell marketplace (Q1 2026), then My Garden plant tracking (Q2 2026), then Sage AI (Q2 2026). The Sell-side "Add Produce Listing" picker is visually polished (real photos, category chips, In Season filter, search). The Grow-side "Add Plants to My Garden" picker is functional but plain (emoji-only, text-button grid). Both pickers share crop IDs (`tomato-cherry`, `basil`, etc.) but live in separate JSON catalogs (`produce-seeds.json` for Sell — has photos, seasons; `crop-growing-data.json` for Grow — has planting/harvest/bolting/pruning data). They never reconciled.

The Sage system already mutates My Garden state from chat (`add_plant`, `mark_pruned`, etc. via `gardenActions.ts`). It does NOT yet drive listing creation.

The seller's blank profile state ("Your Garden / Seedling") happens when on-chain `seller.storefrontIpfs` is empty/minimal. The PublicGardenProfile (KV-backed via `/api/gardener-profile`) typically has the user's real garden name, bio, photos, and location — those should auto-populate the seller profile.

### Plan, in 4 phases

**V1 — `ListFromGardenSheet` (small, ships first):**
- New component `frontend/src/components/seller/ListFromGardenSheet.tsx`. Bottom sheet shown when user clicks "Add Listing" on `/sell/dashboard`. Reads `gardenPlants` (already on dashboard via `useMyGarden`), joins each plant with `getProduceById(cropId)` for photo, renders an inventory grid. Tap plant → routes to `/sell/listings/new?source=garden&crop=<id>&qty=<qty>` (existing prefill contract). Footer: "List something else →" routes to `/sell/listings/new` clean. Skipped entirely if user has no plants.
- `frontend/src/lib/produce.ts` adds `getCatalogItem(cropId)` helper that joins photo+season from `produce-seeds.json` with name+category from `crop-growing-data.json`. Used by `ListFromGardenSheet` to handle crops that exist in the garden but not in produce-seeds (custom varieties fall back to parent crop's photo).
- `frontend/src/app/sell/dashboard/page.tsx` swaps the two `<Link href="/sell/listings/new">` wrappers for buttons that open the sheet (with link-fallback when no plants).

**V2 — Shared `ProducePicker` + bolting/pruning backfill (refactor):**
- Extract `frontend/src/components/produce/ProducePicker.tsx` — shared search input + In Season filter + category chips + photo grid + empty state. Generic over `mode: 'single' | 'multi'`. Renders cards with photos from `produce-seeds.json`, falling back to category-emoji+name for crops only in `crop-growing-data.json`.
- `frontend/src/components/seller/ProduceSelector.tsx` becomes a thin wrapper over `<ProducePicker mode="single" />`.
- `frontend/src/components/grow/AddPlantsModal.tsx` step-1 grid replaced by `<ProducePicker mode="multi" categoryEmoji />`. Bed picker + custom-variety flow + step-2 (planting date / method / quantity) stay in `AddPlantsModal`.
- **Bolting/pruning backfill in `frontend/src/data/crop-growing-data.json`:** today only ~6 crops have `bolting` data and ~4 have `pruning` data. Fill these for every applicable crop using horticultural defaults:
  - `bolting: { daysToBoltMin, daysToBoltMax, heatTriggerF, advice }` — applies to leafy greens (lettuce, spinach, arugula, kale, cilantro, basil, chard, mustards, etc.) and some heat-sensitive root crops (radish, fennel, dill, fennel)
  - `pruning: [{ triggerDays, recurringDays, type, title, message, actionHint }]` — applies to indeterminate tomatoes (suckers from day 30, every 14d), basil (pinch top from day 21, every 14d), cucumbers + squash (vine training from day 35), mint (cutbacks from day 45 every 21d), peppers (top pinch optional)
  - Crops with no relevant bolting/pruning (most root vegetables, most fruits) get the field omitted — code already handles this.
- This data flows through the existing `careAlerts.ts` system so Sage's "ATTENTION NEEDED" + "UPCOMING / ROUTINE CARE" tiers automatically improve once the backfill lands.

**V2.5 — Sage `create_listing_draft` action:**
- New action verb in `frontend/src/lib/gardenActions.ts`: `{action: 'create_listing_draft', cropId, quantity, pricePerUnit?, notes?}`. Extraction prompt teaches Sage to recognize "list X for sale", "I want to sell my Y", etc.
- Handler routes user to `/sell/listings/new?source=sage&crop=<id>&qty=<qty>` rather than directly creating on-chain. Sage drafts; user signs. **Critical for the zero-liability posture: Sage suggests, the user transacts.**
- `garden-brain.ts` "TRACKING POWERS" section extended.

**Already shipped before this plan formed:**
- `EditSellerProfileModal` pre-fill from PublicGardenProfile (so seller profile populates from existing garden data)
- `SellerRegistrationForm` pre-fill from PublicGardenProfile + listing-intent routing from My Garden Sell button
- Sell button on every plant card in My Garden (`GardenPlantCard.tsx` → `app:list-for-sale` event → routes to listing form with crop pre-filled)
- Geohash full-precision restored (delivery-radius accuracy required it)
- Seller pickup address moved to private KV (Phase 1 privacy)

### File-by-file ownership

| File | Phase | Role |
|---|---|---|
| `frontend/src/components/seller/ListFromGardenSheet.tsx` | V1 (new) | Inventory popup on Add Listing |
| `frontend/src/lib/produce.ts` | V1 (modify) | `getCatalogItem` join helper |
| `frontend/src/app/sell/dashboard/page.tsx` | V1 (modify) | Wire sheet to Add Listing buttons |
| `frontend/src/components/produce/ProducePicker.tsx` | V2 (new) | Shared picker |
| `frontend/src/components/seller/ProduceSelector.tsx` | V2 (modify) | Becomes wrapper |
| `frontend/src/components/grow/AddPlantsModal.tsx` | V2 (modify) | Use shared picker |
| `frontend/src/data/crop-growing-data.json` | V2 (modify) | Bolting/pruning backfill |
| `frontend/src/lib/gardenActions.ts` | V2.5 (modify) | New action verb |
| `frontend/src/lib/ai/garden-brain.ts` | V2.5 (modify) | System prompt extended |

### Open architectural notes

- **Catalog reconciliation strategy:** keep two JSON files (`produce-seeds.json` for photos+seasons; `crop-growing-data.json` for planting/harvest/care). Join at the API layer (`getCatalogItem`) rather than hard-merging. Defer hard merge until both files have stabilized.
- **Custom varieties:** when a user has a Mojito Mint plant (custom variety of mint), the picker should show the photo from the parent crop (mint) but display the variety name. Already supported by `gardenStatus.getCropDisplayName(cropId, customVarietyName)`.
- **Seeds → Roots Points rebrand:** the rebrand is mostly complete. KNOWN LEAK (Doug, Apr 26 2026): the `/leaderboard` page (linked from "Early Adopter Bonus → Learn more") still uses old "Seeds" terminology. Track in a follow-up commit alongside V1.
- **Visual delta tolerance:** during V1, AddPlantsModal still looks plain. That's fine — V2 fixes it. Don't ship V1 with a half-refactored picker.

## Unified Profile (`/profile`)

**Shipped Apr 27 2026.** One page owns everything users edit about themselves. Replaces the old per-feature modal pattern (EditSellerProfileModal, PaymentPreferencesModal) where profile editing was scattered across surfaces.

**Sections:**

| Section | Source of truth | Read-only display? |
|---|---|---|
| Identity | Privy (email, phone, wallet) | Yes — login methods managed via wallet menu |
| Gardener | KV `garden:profile:{userId}` (via `usePublicGardenProfile`) | No — embeds existing `<PublicGardenSettings />` |
| Seller | On-chain seller record + IPFS metadata + KV `seller:pickup:{owner}` | No — pickup/delivery toggles, radius, private pickup address |
| Ambassador | IPFS via `ambassador.profileIpfs` | No — Venmo/PayPal/Zelle prefs (TEMPORARY pre-$ROOTS) |
| Buyer | n/a | Placeholder — saved delivery addresses coming soon |

**Single-name principle:** Storefront name, photo, and bio are NOT editable in the Seller section — they're INHERITED from the gardener profile and shown read-only. One name across the whole app. Doug's call (Apr 27 2026): "make them the same."

**Setup gating on `/sell/dashboard`:** A seller profile counts as ready-to-sell when (1) gardener-derived name is non-empty, (2) gardener-derived bio is non-empty, (3) at least one of `offersPickup` or `offersDelivery` is true. If incomplete, the dashboard renders a banner listing what's missing and disables the Add Listing button. Soft gate (not redirect) — user can still see their orders, just can't list.

**Discoverability:** `UnifiedWalletButton` in the header includes a "Profile" link when the user is signed in. Don't bury this — it's the entry point to all profile editing.

**Routing convention:** `?section=identity|gardener|seller|ambassador|buyer` scrolls to the named section on load and highlights it. Use this for deep links from elsewhere (e.g. seller dashboard's "Edit Profile" → `/profile?section=seller`).

**Files:**
- `frontend/src/app/profile/page.tsx` — the page itself, sectioned client component, Suspense-wrapped for `useSearchParams`
- `frontend/src/components/grow/PublicGardenSettings.tsx` — embedded as the Gardener section
- `frontend/src/hooks/usePublicGardenProfile.ts` + `useSellerProfile.ts` + `useAmbassadorProfile.ts` — read hooks
- `frontend/src/hooks/useUpdateSeller.ts` + `useUpdateAmbassadorProfile.ts` — write hooks (gasless via Privy)
- `frontend/src/lib/sellerPickup.ts` — signature-gated KV save/load for private pickup info

**Deprecated (do not link to):**
- `EditSellerProfileModal` — kept in tree for now in case of stragglers, but no UI surfaces it. Replace any new use with a link to `/profile?section=seller`.
- `PaymentPreferencesModal` — same. `PaymentStatusCard` now links to `/profile?section=ambassador`.

**Known gaps:**
- Buyer section is a placeholder. Saved delivery addresses + pickup history when a real flow exists.
- No way yet to edit Privy login methods from `/profile` — that lives in the Privy modal menu. Acceptable for v1.
- The seller "save" flow uploads metadata to IPFS using gardener fields. If the gardener profile changes, the seller storefront is NOT auto-resynced — the user has to come back to `/profile` and re-save. Future improvement: a "Sync from Gardener" affordance, or a hook that re-uploads when the gardener saves.

## Orders Architecture

The app has two separate order viewing experiences based on authentication method:

### Crypto Buyers (`/buy/orders`)
- **All crypto purchases** (pickup AND delivery) use external wallets only
- Connect wallet to view orders tied to that address
- Delivery info stored on IPFS (`buyerInfoIpfs` field)
- **No Privy needed**
- Uses `useBuyerOrders` hook with wagmi address

### Privy Users (`/orders`) - Unified Orders Hub
Single email login shows role-based tabs:

| Tab | Shows When | Hook |
|-----|------------|------|
| My Purchases | User has credit card orders | `useBuyerOrders` (Privy address) |
| My Sales | User is registered seller | `useSellerOrders` |
| My Referrals | User is registered ambassador | `useAmbassadorOrders` |

**Role Detection:**
- `useSellerStatus` - checks if Privy address is registered seller
- `useAmbassadorStatus` - checks if Privy address is registered ambassador
- Credit card orders detected by querying orders with Privy wallet as buyer

**Key Files:**
- `frontend/src/app/buy/orders/page.tsx` - Crypto buyer orders (external wallet)
- `frontend/src/app/orders/page.tsx` - Unified orders hub (Privy users)
- `frontend/src/hooks/useBuyerOrders.ts` - Supports both wagmi and Privy addresses
- `frontend/src/hooks/useSellerOrders.ts` - Seller order management
- `frontend/src/hooks/useAmbassadorOrders.ts` - Ambassador referral orders

### Summary Table

| User Type | Auth Method | Orders View |
|-----------|-------------|-------------|
| Crypto buyer (pickup) | External wallet | `/buy/orders` |
| Crypto buyer (delivery) | External wallet | `/buy/orders` |
| Credit card buyer | Privy (email) | `/orders` |
| Seller | Privy (email) | `/orders` |
| Ambassador | Privy (email) | `/orders` |

## Contract Addresses (Base MAINNET — LIVE since April 25 2026)

**Phase 1 deployment via `DeployPhase1.s.sol`:**
- `NEXT_PUBLIC_MARKETPLACE_ADDRESS` = `0x00c779cdc392d8c99B6649F8002e4A1C57E644b7`
- `NEXT_PUBLIC_AMBASSADOR_REWARDS_ADDRESS` = `0xdf6351e0f46CFb02Dab17a62E5D89D175689BeBE`
- `NEXT_PUBLIC_FORWARDER_ADDRESS` = `0x6ad1513BAA05cBA3354F4367326F0f63fC25A0Dd`
- `NEXT_PUBLIC_DISPUTE_RESOLUTION_ADDRESS` = `0x7789aCB26FD08A2f33664ebC0b60eE4fa0D5420d`
- `NEXT_PUBLIC_USDC_ADDRESS` = `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` (Circle official Base mainnet USDC)
- `NEXT_PUBLIC_ROOTS_TOKEN_ADDRESS` = `0x0000000000000000000000000000000000000000` (Phase 2 / Q1 2027 — not yet deployed)
- `NEXT_PUBLIC_USDT_ADDRESS` = `0x0000000000000000000000000000000000000000` (USDC-only on mainnet)
- `NEXT_PUBLIC_NETWORK` = `mainnet` (gates `chainConfig.ts` flip)
- `NEXT_PUBLIC_COINBASE_PROJECT_ID` = `37ee8da0-6945-4c8f-9f73-f7cb5bc4dabc`

**Not deployed to mainnet (out of v1 scope):**
- `GovernmentRequests` — ambassador governance for data requests (defer to Phase 1.5)
- `OperationsTreasury` (Gnosis Safe) — admin operations multisig (optional)

**Admin role on AmbassadorRewards** transferred from deployer → `0x30C4343A742F922Ea8cF10e2042919C873274879` (Doug's Privy wallet) post-deployment via `addAdmin` + `removeAdmin` calls. Deployer wallet has zero residual rights.

**Mainnet wallets:**
- Admin (Privy): `0x30C4343A742F922Ea8cF10e2042919C873274879`
- Relayer (gas): `0xe2034722F2973814CF829179889b7C27D8D00452` — funded with 0.05 ETH; private key in Vercel `RELAYER_PRIVATE_KEY`
- Deployer (abandoned): `0x6fC7F0e04Ce4e9C7684F71b9991FEf50a84e2e03` — single-use, no contract rights

**Testnet (Base Sepolia) addresses — DEPRECATED (kept for historical reference only):**
<details><summary>Click to expand testnet addresses (do not use)</summary>

- Marketplace: `0xb3E31B84Ed6d22DD84eFd193282eafc00Eb32F22`
- AmbassadorRewards: `0x8D546152e4A39680C00Aa61d914f38878083B1c8`
- Forwarder: `0x3DeE6FcBE0D28E3C772b6f57ca83B0652eC01F20`
- USDC (Sepolia): `0x036CbD53842c5426634e7929541eC2318f3dCF7e`
- DisputeResolution: `0xf195E2005538ae55f2559930A8C641A0f9709D6C`
- GovernmentRequests: `0x9464B2b76047Da4eb6fD8E60245998f1c747DC33`
</details>

All contract addresses must be from the same deployment. If one changes, verify all are updated in Vercel env vars AND fallback addresses in `frontend/src/lib/contracts/*.ts`.

## Test Wallet Configuration

The test wallet is the deployer wallet, pre-funded with tokens for testing:

**Address:** `0x40b98F81f19eF4e64633D791F24C886Ce8dcF99c`
**Private Key:** Set via `NEXT_PUBLIC_TEST_WALLET_PRIVATE_KEY` in `.env.local`

**Balances (replenish if needed):**
- ETH: ~0.004 ETH (for gas on approvals/transactions)
- ROOTS: ~650M ROOTS
- USDC: 10,000 USDC (MockUSDC)
- USDT: 10,000 USDT (MockUSDT)

**Minting Test Stablecoins:**
```bash
# Mint USDC to test wallet
cast send 0xBe0D90a4C6BBC99a37BA0A5aA9Ffaa894f826e06 "mint(address,uint256)" \
  0x40b98F81f19eF4e64633D791F24C886Ce8dcF99c 10000000000 \
  --private-key $DEPLOYER_KEY --rpc-url https://sepolia.base.org

# Mint USDT to test wallet
cast send 0x3c69B46E4Ab4141F0089a5289dBC20f33A36981b "mint(address,uint256)" \
  0x40b98F81f19eF4e64633D791F24C886Ce8dcF99c 10000000000 \
  --private-key $DEPLOYER_KEY --rpc-url https://sepolia.base.org
```

**Adding Payment Tokens to Marketplace:**
If deploying fresh contracts, payment tokens must be added to the marketplace:
```bash
MARKETPLACE=0xBAc288595e52AF2dDF560CEaEf90064463c08f0d
cast send $MARKETPLACE "addPaymentToken(address)" <TOKEN_ADDRESS> \
  --private-key $DEPLOYER_KEY --rpc-url https://sepolia.base.org
```

## Production Deployment

**Hosting:** Vercel (free tier)
**Domain:** localroots.love / www.localroots.love
**DNS:** Managed by Vercel (nameservers: ns1.vercel-dns.com, ns2.vercel-dns.com)

**Environment Variables (Vercel):**

Required for core functionality:
- `NEXT_PUBLIC_ROOTS_TOKEN_ADDRESS` - ROOTS token contract
- `NEXT_PUBLIC_MARKETPLACE_ADDRESS` - Marketplace contract
- `NEXT_PUBLIC_AMBASSADOR_REWARDS_ADDRESS` - Ambassador rewards contract
- `NEXT_PUBLIC_FORWARDER_ADDRESS` - ERC2771 forwarder contract
- `NEXT_PUBLIC_USDC_ADDRESS` - MockUSDC contract (testnet)
- `NEXT_PUBLIC_USDT_ADDRESS` - MockUSDT contract (testnet)
- `RELAYER_PRIVATE_KEY` - Wallet that pays gas for meta-transactions (NOT public!)
- `NEXT_PUBLIC_PRIVY_APP_ID` - Privy app ID
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` - WalletConnect project ID
- `NEXT_PUBLIC_PINATA_JWT` - Pinata API token for IPFS uploads
- `NEXT_PUBLIC_PINATA_GATEWAY` - Pinata gateway (gateway.pinata.cloud)
- `NEXT_PUBLIC_THIRDWEB_CLIENT_ID` - thirdweb client ID for Pay
- `ANTHROPIC_API_KEY` - For Sage (AI gardening companion)

Optional for testing:
- `NEXT_PUBLIC_TEST_WALLET_PRIVATE_KEY` - Shows "Test Funds" button (REMOVE BEFORE MAINNET!)

**Privy Configuration:**
- Allowed domains must include: `localroots.love`, `www.localroots.love`, `localhost:3000`
- Dashboard: https://dashboard.privy.io/

## Credit Card Payments

**Testnet Limitation:** Credit card payments via thirdweb Pay only work on mainnet. The testnet shows a "Coming Soon" message instead.

**File:** `frontend/src/components/checkout/CreditCardCheckout.tsx`

## AI Knowledge Maintenance

When adding, removing, or changing a user-facing route or feature, update `frontend/src/data/app-knowledge.json` so Sage can guide users to the new feature. This is Sage's knowledge of how the app works — sections, routes, flows, Seeds info, and auth guidance. The brain reads this JSON at runtime and formats it into the system prompt.

### Teaching Sage About New Features — Required Checklist

Every user-facing feature must teach Sage about itself. Silence = user confusion. Before merging:

1. **`frontend/src/data/app-knowledge.json`** — Add the route (path, name, description, authRequired) and any `features: [...]` bullets describing what users can do. If data backs the feature, say where it lives so Sage can reference it.
2. **`frontend/src/lib/ai/garden-brain.ts`** — If the feature has dynamic/data-driven awareness (e.g. "Sage knows bolting windows for these crops"), add or extend a context builder (e.g. `buildCareDataContext`) and include it in `loadContext`. Pull from shared accessors, not hardcoded lists.
3. **Shared data registry** — New content types (collections, regions, crops) go in canonical JSON (e.g. `crop-growing-data.json`, `collections.json`) with typed accessors in `plantingCalendar.ts` or equivalent. One source of truth, many consumers.

Skip any of these and the feature ships but is invisible to Sage. Treat her like a teammate who wasn't in the planning meeting — brief her explicitly.

## Sage — AI Gardening Companion

**Name:** Sage. Always refer to the AI assistant as "Sage" in UI copy, never "Garden AI" or "Garden Assistant."

The `GardenAIChat` component provides AI gardening assistance:
- Available on `/grow` page (visible in navigation header)
- Also available on all `/sell/*` pages via layout wrapper
- Floating chat icon in bottom-right corner (tooltip: "Ask Sage")
- Uses Claude Haiku 4.5 via Anthropic API

### Voice Input/Output

- **Voice input:** Browser-native Web Speech API (`SpeechRecognition`). Mic button between textarea and send button. Pulsing red when listening. Auto-sends on recognition.
- **Voice output:** `SpeechSynthesis` with first-time opt-in. First voice message in a session triggers a card: "Would you like me to read my responses aloud?" Yes enables auto-read for the rest of the session. Speaker toggle in header to disable.
- **iOS Safari zoom fix:** Chat textarea uses `font-size: max(16px, 0.875rem)` and viewport has `maximumScale: 1` to prevent auto-zoom on input focus.
- Both features degrade gracefully — hidden if browser doesn't support.

### Smart Context Chain

Sage automatically gathers user context from multiple sources (priority order):
1. **Seller geohash** (on-chain) — exact location for logged-in sellers
2. **Browser GPS** — zone + frost dates from `GrowingProfileContext`
3. **Vercel IP geo headers** — city-level fallback when GPS is denied (`x-vercel-ip-latitude/longitude/city`)
4. **AI asks the user** — graceful fallback when nothing else is available

**Context passed to AI (all optional, degrades gracefully):**
- Zone, frost dates, growing season, tropical/hemisphere flags
- Location name (e.g., "Hilton Head, SC")
- Confidence level (`precise`, `estimated`, `ip-estimated`)
- User role (seller/buyer/ambassador) — tailors advice accordingly
- Seller's active listings — AI knows what they already grow
- Current season (derived from date + hemisphere)

### Regional Knowledge System

Regional garden intelligence is loaded conditionally based on user's zone/location:
- JSON files in `frontend/src/data/regional/` contain hyperlocal expertise
- Registered in `REGIONAL_DATA` array in `garden-brain.ts`
- Matched by zone OR location name keywords
- First region: **Lowcountry SC (Zone 8a)** — deer pressure, salt tolerance, specific varieties, seasonal calendar, soil amendments, troubleshooting, local resources

**To add a new region:**
1. Create `frontend/src/data/regional/<region-name>.json` (follow `lowcountry-8a.json` schema)
2. Import and add to `REGIONAL_DATA` array in `garden-brain.ts`
3. Include `matchZones` and `matchLocations` arrays for auto-matching

### Persistence Architecture (localStorage-first)

- **localStorage** = primary storage (sync, reliable, instant)
- **Upstash KV** = async cloud backup via `after()` (best-effort)
- Conversations and memories save to localStorage immediately
- Cloud backup happens after response is sent
- Hydration: localStorage first (instant), cloud GET as async fallback
- Client sends `clientMemories` in POST body so server has them even when KV is down

### Memory System

- Entity memory extracts facts from conversations (zone, plants, soil, goals)
- Up to 100 facts per user across categories: garden_setup, growing_preference, garden_history, schedule, personal
- Extraction runs in `after()` via a second Haiku call
- Memories sent back to client as SSE event for localStorage backup

### Key Files

| File | Purpose |
|------|---------|
| `frontend/src/components/grow/GardenAIChat.tsx` | Main chat component, context gathering, localStorage persistence |
| `frontend/src/app/api/garden-ai/route.ts` | API endpoint — streaming, IP geo fallback, after() for saves |
| `frontend/src/lib/ai/garden-brain.ts` | Brain — system prompt, context loading, regional knowledge, memory |
| `frontend/src/lib/kv.ts` | Custom Upstash REST client (replaced broken @vercel/kv) |
| `frontend/src/data/regional/lowcountry-8a.json` | Lowcountry SC regional knowledge |
| `frontend/src/data/community-recipes.json` | Community recipes with companion crop suggestions |
| `frontend/src/data/crop-growing-data.json` | Crop planting guide (20+ crops) |
| `frontend/src/app/api/garden-ai/local/route.ts` | Local marketplace listings endpoint |
| `frontend/src/app/sell/layout.tsx` | Adds chat to sell pages |

### Sage Brain Version — force conversation reset on upgrades

Conversations get stamped with a brain version when they're saved. On the next chat open, if the stored version doesn't match the current `SAGE_BRAIN_VERSION`, the conversation is auto-cleared (server-side and client-side) and the user sees a soft banner: *"Sage learned some new things — starting a fresh chat."* Memories survive — they're user-owned facts about the gardener, not behavior contracts.

**Single source of truth:** `frontend/src/lib/ai/sageBrainVersion.ts` exports `SAGE_BRAIN_VERSION = 'YYYY-MM-DD-short-slug'`.

**Bump it whenever you ship a Sage change that should invalidate prior conversations:**
- Add or change action verbs in `gardenActions.ts`
- Restructure the system prompt (new sections, behavior rules)
- Change knowledge files in ways that materially alter Sage's answers (`app-knowledge.json`, `regional/*`, crop data behavior)
- Swap the model (e.g. Claude ↔ Venice)
- Fix a fabrication or priming bug where stale conversation context would keep poisoning new responses

Format: `YYYY-MM-DD-short-slug` — date is what matters, slug is for grep. The version is stamped on `garden:conv:{userId}` saves and checked on `GET /api/garden-ai`. Client-side localStorage `garden:conv:{userId}` carries `{ version, messages }`. Old unversioned localStorage shape is treated as stale and reset.

**Don't bump for trivial changes** (UI tweaks, copy fixes that don't change Sage's answers). Bumping clears every active user's conversation, so save it for changes the user would actually feel.

## Sage App Suggestions

Sage can capture user feedback (bugs, feature ideas, friction) during chat and forward it to the dev team. Captured suggestions appear in the admin dashboard under the **Sage Suggestions** tab.

**Capture flow (gated on explicit user confirmation):**
1. User expresses friction / idea / bug in chat
2. Sage answers their actual question, then offers: *"Want me to pass this along to the dev team?"*
3. User confirms with a clear yes
4. Sage replies with a phrase containing *"noted for the team"* or *"passed along"* — that phrase is the trigger
5. After the response sends, a second Haiku call extracts a structured suggestion → KV write

**Sage NEVER captures without explicit user confirmation.** If the user declines or pivots, nothing is logged. The system prompt enforces this.

**Privacy:** only the user's last message (`userQuote`) and Sage's distillation (`sageSummary`) are stored. Full conversations are not persisted alongside the suggestion. Privy ID stored when available, anonymous IP-keyed otherwise.

**Rate limit:** 5 suggestions per user (or anonymous IP) per UTC day, enforced server-side via KV counter.

**KV schema:**
- `sage:suggestion:{id}` — full record (`SageSuggestion` JSON)
- `sage:suggestions:index` — array of IDs, newest first, capped at 1000
- `sage:suggestions:rate:{userKey}:{YYYYMMDD}` — daily counter

**Admin UI:** `/admin?tab=suggestions` — table view with category/area/status filters, mark triaged / in_progress / shipped / wontfix, add notes per entry. Status badges: new (coral), triaged (yellow), in_progress (blue), shipped (green), wontfix (gray).

**Cost:** the extraction Haiku call only fires when a heuristic prefilter detects a confirmation phrase in Sage's last message. On chats without a capture, cost is zero.

**Key files:**

| File | Purpose |
|------|---------|
| `frontend/src/types/sage-suggestion.ts` | TypeScript types and constants (categories, areas, statuses) |
| `frontend/src/lib/sageSuggestions.ts` | Extraction prompt, parser, KV helpers, heuristic prefilter |
| `frontend/src/app/api/sage-suggestions/route.ts` | Admin GET (list) + PATCH (update status/notes). On-chain admin check via `marketplace.isAdmin`. |
| `frontend/src/components/admin/SuggestionsTab.tsx` | Admin dashboard tab — list, filter, expand, status actions, notes editor |
| `frontend/src/app/api/garden-ai/route.ts` | Calls extraction in the existing `after()` block (after memory extraction) |
| `frontend/src/lib/ai/garden-brain.ts` | System prompt teaches Sage when/how to offer capture and the confirmation phrase requirement |
| `frontend/src/data/app-knowledge.json` | `feedback` flow — Sage knows to mention this when users ask "how do I send feedback?" |

**Plan reference:** `~/.claude/plans/zany-meandering-kazoo.md` has the full design + verification plan.

## Deployment Workflow - IMPORTANT

**Always deploy after making changes.** The user tests exclusively on `www.localroots.love`, not locally. After every change:

1. Commit changes to `main`
2. Push to `origin/main`
3. Vercel auto-deploys from the push

This will change when we go into soft launch or launch. Until then, always deploy.

## Development

```bash
# Frontend
cd frontend && npm run dev

# Cloudflare tunnel for phone testing
cloudflared tunnel --url http://localhost:3000

# Smart contracts
cd contracts && forge build
```

## Debugging Production Issues

**Debug Banner Pattern:** When a page isn't working correctly in production, add a temporary visible debug banner showing key state variables. This is faster than asking users to open browser console.

Example:
```tsx
{/* Debug Banner - REMOVE BEFORE LAUNCH */}
<div className="bg-yellow-100 border-b border-yellow-300 px-4 py-2 text-xs font-mono">
  <strong>DEBUG:</strong> connected={String(isConnected)} | loading={String(isLoading)} |
  isAmbassador={String(isAmbassador)} | error={error || 'none'}
</div>
```

**Common Issues Found via Debug Banners:**
- Trailing spaces in env vars (viem error: `Address "0x123... " is invalid`)
- Wrong contract address (fallback vs env var mismatch)
- Wallet address mismatch (Privy vs wagmi)
- Loading state stuck (async hook not resolving)

**Env Var Gotcha:** When setting env vars via CLI, trailing whitespace or newlines cause silent failures. Viem shows "Address is invalid" if there's whitespace.

**Safe way to set Vercel env vars:**
```bash
# DON'T use echo or here-strings (they add newlines):
echo "0x123..." | npx vercel env add VAR production  # BAD - adds \n

# DO use printf to a temp file:
printf '0x4C5c8765b1a5fbed6fAf2Bd9F1adBee587d92154' > /tmp/val.txt
cat /tmp/val.txt | npx vercel env add NEXT_PUBLIC_AMBASSADOR_REWARDS_ADDRESS production
rm /tmp/val.txt

# Verify with env pull:
npx vercel env pull .env.check --environment=production
grep YOUR_VAR .env.check  # Should show no \n inside quotes
```

## E2E Testing

End-to-end tests run directly against Base Sepolia contracts using vitest + viem. Tests the full marketplace lifecycle without needing a browser (Privy OAuth can't be automated).

**Running tests:**
```bash
cd frontend

# Core lifecycle (ambassador → seller → listing → purchases → fulfillment)
npm run test:e2e              # ~50 seconds

# Individual test suites
npm run test:e2e:activation   # Seller activation (2 unique buyers)
npm run test:e2e:dispute      # Dispute → refund flow
npm run test:e2e:state        # Order state machine edge cases
npm run test:e2e:suspension   # Admin seller suspension
npm run test:e2e:listing      # Listing deactivation
npm run test:e2e:payment      # Payment token configuration
npm run test:e2e:payments     # Ambassador cash payments (TEMPORARY)

# Full suite (lifecycle + activation + dispute)
npm run test:e2e:full

# Settlement (run 48+ hours after lifecycle)
npm run test:e2e:settle
```

**Test suite summary (98 total tests):**

| Test File | Tests | Purpose |
|-----------|-------|---------|
| lifecycle.test.ts | 13 | Full marketplace flow: register → list → buy → fulfill |
| activation.test.ts | 10 | Seller activation with 2 unique buyers |
| dispute.test.ts | 14 | Buyer dispute → seller refund flow |
| state-machine.test.ts | 16 | Invalid state transitions & auth checks |
| suspension.test.ts | 15 | Admin suspend/unsuspend seller |
| listing.test.ts | 9 | Seller deactivate/reactivate listing |
| payment-tokens.test.ts | 8 | Phase 2 ROOTS payment, stablecoin requirements |
| payments.test.ts | 13 | Ambassador cash payment tracking (TEMPORARY) |
| settlement.test.ts | varies | Claim funds after 48h dispute window |

**Key files:**
```
frontend/tests/e2e/
  .env.test              # Test wallet PKs, contract addresses (gitignored)
  .test-state.json       # Auto-generated: persists state between phases
  vitest.config.ts       # Config with 5-min timeout, env loading
  lib/
    clients.ts           # Viem clients for all roles (5 wallets)
    contracts.ts         # ABIs + addresses (re-exports from src/)
    gasless.ts           # EIP-712 signing + relay API
    assertions.ts        # Balance checks, contract state readers
```

**Test wallets** (Base Sepolia TESTNET only):
- Deployer: `0x40b98F81f19eF4e64633D791F24C886Ce8dcF99c` (also admin)
- Seller: `0xde061f740C49BD9Dc0c25e4FC5eF9E0CF6ED00e0`
- Buyer: `0x0C0f738485B07bd98b6f0633C62C2c87e1b366c0`
- Buyer2: `0xe2f32e89b47C9eAe7429B70007f223303452Ff5b` (for activation tests)
- Ambassador: `0x76CDc4B652AB397D345F893f5bdE14dE4632a8Eb`

**Notes:**
- Uses production relay API (`https://www.localroots.love/api/relay`)
- Includes 3s delays after writes for RPC node sync
- Tests are idempotent (handle re-runs gracefully)
- Buyer/Buyer2 need ETH for gas + ROOTS for purchases

**Key contract behaviors verified:**
- Suspended sellers CAN accept existing orders (buyer protection)
- Suspended sellers cannot create listings or receive new purchases
- Stablecoin payments require swap router (not currently configured)
- Seller activation requires 2 completed orders from 2 unique buyers
- Dispute window (48h) must pass before seller can claim funds

**Future E2E Tests (Tier 3 — implement later):**
- Ambassador Governance (flagging/voting) — No frontend hooks, 3-day voting window
- Ambassador Cooldown (24h) — Can't fast-forward on live testnet
- Geohash Discovery — Not used in current UI
- Circuit Breakers (daily/weekly caps) — Requires massive treasury manipulation
- Phase Transition (Phase 1 → Phase 2) — One-time operation, already in Phase 2

## Redeploying Contracts

```bash
cd contracts

# Set environment variables
export PRIVATE_KEY=<deployer-private-key>
export FOUNDER_ADDRESS=<founder-wallet>
export LIQUIDITY_POOL_ADDRESS=<liquidity-pool-wallet>
export TREASURY_ADDRESS=<treasury-wallet>
export AIRDROP_ADDRESS=<airdrop-wallet>

# Deploy all contracts
forge script script/Deploy.s.sol:DeployAll --rpc-url https://sepolia.base.org --broadcast -vvv

# Update frontend/.env.local with new addresses
```

### CRITICAL: Update Fallback Addresses in TypeScript

**Problem:** Each contract TypeScript file has a hardcoded fallback address used if the env var fails to load. If you redeploy a contract but don't update the fallback, the frontend may silently query the OLD contract.

**After any contract redeploy, update these files:**

| Contract | TypeScript File | Variable |
|----------|-----------------|----------|
| Marketplace | `frontend/src/lib/contracts/marketplace.ts` | `MARKETPLACE_ADDRESS` |
| AmbassadorRewards | `frontend/src/lib/contracts/ambassador.ts` | `AMBASSADOR_REWARDS_ADDRESS` |
| DisputeResolution | `frontend/src/lib/contracts/disputeResolution.ts` | `DISPUTE_RESOLUTION_ADDRESS` |
| GovernmentRequests | `frontend/src/lib/contracts/governmentRequests.ts` | `GOVERNMENT_REQUESTS_ADDRESS` |
| ERC2771Forwarder | `frontend/src/lib/contracts/forwarder.ts` | `FORWARDER_ADDRESS` |
| OperationsTreasury | `frontend/src/lib/contracts/operationsTreasury.ts` | `OPERATIONS_TREASURY_ADDRESS` |

**Example pattern in each file:**
```typescript
export const AMBASSADOR_REWARDS_ADDRESS: Address = (
  process.env.NEXT_PUBLIC_AMBASSADOR_REWARDS_ADDRESS ||
  '0x4C5c8765b1a5fbed6fAf2Bd9F1adBee587d92154'  // <-- UPDATE THIS!
) as Address;
```

**Full redeploy checklist:**
1. Deploy new contract(s) via forge
2. Update `frontend/.env.local` with new address(es)
3. Update Vercel env vars: `npx vercel env add NEXT_PUBLIC_<CONTRACT>_ADDRESS`
4. **Update fallback address in TypeScript file(s)**
5. Update this CLAUDE.md "Contract Addresses" section
6. Commit and push to trigger Vercel redeploy

## Mainnet Launch Checklist

### Environment & Secrets
- [ ] Remove `NEXT_PUBLIC_TEST_WALLET_PRIVATE_KEY` from Vercel (disables test wallet)
- [ ] Set `INITIAL_ADMIN` env var to your mainnet wallet address (separate from deployer)
- [ ] Generate fresh `RELAYER_PRIVATE_KEY` for mainnet relayer wallet
- [ ] Fund mainnet relayer wallet with ETH for gas

### Contract Addresses (Critical!)
- [ ] Deploy all contracts to Base Mainnet
- [ ] Update ALL Vercel env vars with mainnet addresses:
  - `NEXT_PUBLIC_ROOTS_TOKEN_ADDRESS`
  - `NEXT_PUBLIC_MARKETPLACE_ADDRESS`
  - `NEXT_PUBLIC_AMBASSADOR_REWARDS_ADDRESS`
  - `NEXT_PUBLIC_FORWARDER_ADDRESS`
  - `NEXT_PUBLIC_USDC_ADDRESS` (real USDC on Base)
  - `NEXT_PUBLIC_USDT_ADDRESS` (real USDT on Base)
  - `NEXT_PUBLIC_DISPUTE_RESOLUTION_ADDRESS`
  - `NEXT_PUBLIC_GOVERNMENT_REQUESTS_ADDRESS`
- [ ] **Update fallback addresses in ALL TypeScript files** (see "Redeploying Contracts" section)
  - `frontend/src/lib/contracts/marketplace.ts`
  - `frontend/src/lib/contracts/ambassador.ts`
  - `frontend/src/lib/contracts/disputeResolution.ts`
  - `frontend/src/lib/contracts/governmentRequests.ts`
  - `frontend/src/lib/contracts/forwarder.ts`
  - `frontend/src/lib/contracts/operationsTreasury.ts`
- [ ] Update RPC URL: `NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL` → `NEXT_PUBLIC_BASE_RPC_URL` (or rename)
- [ ] Update BaseScan links in UI (sepolia.basescan.org → basescan.org)

### Third-Party Services
- [ ] Verify credit card payments work (thirdweb Pay requires mainnet)
- [ ] Update Privy allowed domains if needed
- [ ] Update The Graph subgraph URL to mainnet deployment

### Security
- [ ] Consider multi-sig (Gnosis Safe) as admin for added security
- [ ] Audit relayer wallet permissions
- [ ] Verify all admin addresses are correct before first transaction

## Decentralization Roadmap

**Goal:** Friendly to users, but defensible. Eventually self-sustaining without any single operator.

### Principle: Progressive Decentralization

```
┌─────────────────────────────────────────────────────┐
│                   USER EXPERIENCE                    │
│                                                      │
│   Grandma types localroots.love → it just works     │
│                                                      │
├─────────────────────────────────────────────────────┤
│                   UNDER THE HOOD                     │
│                                                      │
│   Domain: Privacy jurisdiction (can migrate fast)   │
│   Backup: Blockchain domain (can't be seized)       │
│   Frontend: IPFS (can't be taken down)              │
│   Contracts: On-chain (already unstoppable)         │
│   Relayers: Multiple (no single point of failure)   │
│                                                      │
└─────────────────────────────────────────────────────┘
```

### Phase 1: Reduce Single Points of Failure (Current Priority)

| Component | Current | Target |
|-----------|---------|--------|
| Domain Registrar | Vercel DNS (US) | Njalla (Nevis) or Iceland-based |
| Blockchain Domain | None | `localroots.eth` or `localroots.crypto` |
| DNS | Vercel | Keep for now (easy to migrate) |
| Hosting | Vercel | Keep for now (user-friendly) |
| Smart Contracts | Base Sepolia | Base Mainnet |

**Checklist:**
- [ ] Audit current domain registrar setup
- [ ] Secure `localroots.eth` (~$15/yr) or `localroots.crypto` (~$40 one-time)
- [ ] Transfer `.love` domain to Njalla or Iceland registrar (Orangewebsite, 1984 Hosting)
- [ ] Document fallback access methods

**Privacy-Friendly Registrar Options:**
- **Njalla** (Nevis) - Acts as proxy owner, strongest privacy
- **Orangewebsite** (Iceland) - Strong free speech laws, accepts crypto
- **1984 Hosting** (Iceland) - Privacy-focused, transparent

### Phase 2: Decentralized Fallbacks (Medium-term)

| Component | Action |
|-----------|--------|
| Frontend | Deploy to IPFS via Fleek alongside Vercel |
| Blockchain domain | Point ENS/Unstoppable to IPFS hash |
| Documentation | "How to access if site is down" guide for users |
| Multiple gateways | localroots.love, localroots.eth.limo, IPFS gateway |

**Checklist:**
- [ ] Set up Fleek for automatic IPFS deployments
- [ ] Configure ENS to point to IPFS content hash
- [ ] Write user guide for alternative access methods
- [ ] Test all access paths work correctly

### Phase 3: Distribute Operations (Long-term)

| Component | Action |
|-----------|--------|
| Relayer | Multiple community-run relayers (not just founder wallet) |
| Treasury | Multi-sig with trusted community members |
| Governance | DAO for protocol upgrades, fee changes |
| Code | Fully open-source, documented so anyone can deploy |
| **Mutable user state** | **Migrate off Vercel KV (single-source-of-takedown)** |

**Checklist:**
- [ ] Open-source all code with deployment documentation
- [ ] Set up multi-sig treasury (Gnosis Safe or similar)
- [ ] Create relayer documentation for community operators
- [ ] Design governance token/DAO structure
- [ ] Eliminate Vercel KV (see "KV Decentralization" below)

#### KV Decentralization — why it matters

**Doug's framing (Apr 26 2026):** "We need to eliminate KV as it is a single source of elimination of Local Roots by a government agency."

Vercel KV (Upstash Redis) is the single chokepoint for nearly all mutable user state in the app. A subpoena or court order to either Vercel or Upstash could:
- Force handover of every user's Sage conversations + memory facts
- Force handover of seller pickup addresses (PII)
- Force handover of buyer delivery addresses (Phase 2 work)
- Disable the service entirely with a single takedown notice

**What lives in KV today (audit point — keep updated):**

| Key pattern | Data | Privacy class |
|---|---|---|
| `garden:conv:{userId}` | Sage conversation history | User-owned |
| `garden:memories:{userId}` | Sage entity memory facts | User-owned |
| `garden:my-garden:{userId}` | Plant + bed data | User-owned |
| `garden:dismissals:{userId}` | Care alert dismissals | User-owned |
| `seller:pickup:{ownerLower}` | Seller exact street address | **Sensitive (PII)** |
| `sage:suggestion:{id}` + index | Bug reports / feature requests | Quasi-public |
| `sage:soul` | Sage's persona evolution | App config |
| `collection:<slug>` + index | Common Area garden collections | Public |
| `payment:*` | Ambassador cash payment tracking | TEMPORARY (deletes at $ROOTS launch) |

**Architectural options (no decision yet, document trade-offs):**

| Option | Fits which data | Trade-offs |
|---|---|---|
| **Ceramic Network** (decentralized mutable streams, IPFS-backed, DID-aware) | Conversations, memories, my-garden, dismissals — anything user-owned | Requires Ceramic node infra; user identity → Ceramic DID layer; medium ecosystem maturity |
| **Encrypted IPFS + on-chain CID pointer** | Sensitive PII (pickup, delivery addresses) — encrypt with recipient's pubkey, publish encrypted blob, store CID in order metadata or contract event | Mutability via versioning; encryption key management is the hard part |
| **OrbitDB / Gun.js** (P2P databases) | Real-time-feeling collaborative data | Requires online peers; weaker durability guarantees |
| **WeaveDB / Polybase** (decentralized SQL on Arweave/L1) | Structured queryable data (suggestions, collections) | Newer, smaller ecosystem |
| **On-chain (EVM)** | Tiny structured records (e.g. dismissals as events) | Gas costs; not for variable-size strings |

**Likely target architecture (initial sketch — not decided):**
- User-owned mutable data (Sage convos, memories, my-garden, dismissals) → **Ceramic streams** keyed by Privy-derived DID. User retains control even if LocalRoots disappears.
- Sensitive PII (pickup, delivery addresses) → **encrypted IPFS** keyed to the counterparty's wallet pubkey, CID delivered via order events. Even if storage is subpoenaed, contents are unreadable without the counterparty's signing key.
- Public app data (Sage suggestions, collections) → can stay on a centralized index (a search problem, not a censorship problem) but with a decentralized canonical store underneath.

**Why this is multi-month, not a sprint:**
- Selecting the storage layer requires PoC + load testing
- User identity migration: today's Privy-only flow → DID-bridged
- Migration path for existing data
- Encryption-at-rest for PII requires key-management UX (probably tied to Privy embedded wallet's signing capability)
- Every API route that currently calls `kv.get/set/del` becomes a call to the abstraction layer, with a migration period where both backends co-exist

**No new code paths should add new KV keys without flagging them in this table.** Treat KV usage as technical debt against the decentralization goal.

### Phase 4: Full Autonomy (Eventual)

- Multiple frontends exist (run by different people/orgs)
- Protocol upgrades via on-chain governance
- Treasury controlled by token holders
- Founder is one voice among many
- LocalRoots continues even if founder disappears

## Growth Strategy & Virality (Future)

### Ambassador Persona

**Who can be an ambassador?** Anyone, anywhere in the world.

Don't assume ambassadors are local to the gardeners they recruit. They might be:
- A college student recruiting in their hometown remotely (primary use case)
- Crypto-native people who find the project online and start it in their area
- Believers in the mission who discover LocalRoots and want to help

**The tools and guides must work for all of these.** Remote ambassadors need shareable cards and referral links. Local ambassadors need patience scripts for non-tech-savvy gardeners. Both need clear messaging about the mission (food resilience, not "crypto app").

### Target Market
- **Community gardens** with hundreds of gardeners (e.g., Heritage Farm at Sea Pines)
- **Older neighbors** who may not be crypto-native but are active gardeners
- **NextDoor users** - key channel for local community reach

### Ambassador Sharing Tools — Shareable Cards (Implemented)

**4 shareable card types** (canvas-generated 1080x1920 PNG, Instagram Stories format):

| Card | Theme | Headline | CTA | URL |
|------|-------|----------|-----|-----|
| Recruit Sellers | Coral | "Help feed your neighbors" | "Start selling" | `/sell/register?ref={id}` |
| Recruit Ambassadors | Teal | "Earn 25%" highlight box | "Become an Ambassador" | `/ambassador/register?ref={id}` |
| Seller Listing | Teal | "Fresh from your neighbor" + price | "Order now" | `/buy` |
| Ambassador Listing | Coral | "My neighbor is selling" | "Shop local" | `/buy` |

**Card Design (consistent across all types):**
- Cream background (`#F5F0EE`) matching app style
- Brand color accent bar at top (coral or teal)
- Rounded rectangle produce images (24px radius)
- Clear typography hierarchy
- Colored CTA buttons (not white pills)
- Sprout emoji + `localroots.love` footer

**Key Files:**
- `frontend/src/lib/shareCards.ts` — Canvas engine + share utilities + pre-written text
- `frontend/src/components/ShareCardModal.tsx` — Reusable modal (preview, channel buttons, loading)
- `frontend/src/lib/geohashLocation.ts` — `reverseGeocodeWithNeighborhood()` for listing cards

**Share Channels (two tiers):**

| Tier | Channels | Behavior |
|------|----------|----------|
| Image-based | Instagram, Facebook, NextDoor | Downloads image + toast with instructions |
| Text-based | Copy Link, SMS, Email, Save | Opens share intent or copies link |

**Platform Notes:**
- Instagram/Facebook have no web share API for images — must download and post manually
- NextDoor has no create-post URL — opens `nextdoor.com` + copies text to clipboard
- SMS/Email use `sms:` and `mailto:` links (text only, no image attachment)
- Native Share button uses Web Share API with file (works on mobile)

**Data Sources:**
- Seller name: `useSellerProfile().profile.metadata.name`
- Ambassador name: `useAmbassadorProfile()` via `ambassador.profileIpfs`
- Ambassador ID: `useAmbassadorStatus().ambassadorId` (string)
- Listing data: `useSellerListings()` → `listing.metadata` (produceName, images, unit)
- Geohash: `seller.geohash` on-chain → decoded to lat/lng → neighborhood

**Technical Notes:**
- Canvas runs client-side only (not SSR)
- Produce photos loaded via `new Image()` with CORS — emoji fallback on load fail
- Data URLs converted to File objects for Web Share API
- `navigator.canShare({ files })` check before file share attempt
- Nominatim rate limit: 1 req/sec, cache by geohash prefix

### Ambassador Sharing Tools — Future
- [ ] Printable flyers/QR codes for farmers markets, community boards

### Ambassador Onboarding Tools (Implemented)

**Guide pages** at `/ambassador/guide/*`:

| Route | Purpose |
|-------|---------|
| `/ambassador/guide/find-gardeners` | Comprehensive guide: vision, inspire new growers, connect existing, how to reach people |
| `/ambassador/guide/help-register` | Step-by-step registration walkthrough, tips, common issues |
| `/ambassador/guide/first-listing` | Listing creation guide, photo tips, pricing advice |

**Quick Actions** on dashboard link to these guides. All guides include share card integration.

**Still needed:**
- [ ] Video tutorials for common tasks
- [ ] FAQ section addressing crypto concerns

### Community Garden Partnerships
- Strategy: Recruit entire gardens as seller communities
- Pitch: "Your garden already grows together - now sell together"
- Target: Active community gardens with 50+ gardeners
- First target: https://www.seapinesliving.com/property-owners/community-partners/heritage-farm/

### Virality Mechanics (Learn from The Fitness Streak)
- [ ] Referral bonuses for buyers (not just sellers)
- [ ] Social sharing rewards (Seeds tokens)
- [ ] Milestone-based incentives
- [ ] Leaderboards with tangible rewards

## Social Login Configuration

**Enabled Methods:** Google, Apple, Instagram, Email, SMS

**Order in Privy modal:** Social options first (for non-crypto-native target audience)

**Note:** Facebook is NOT supported by Privy.

**Adding providers:**
1. Enable in Privy Dashboard > Login Methods
2. Update `loginMethods` array in `providers.tsx`
3. Configure OAuth credentials in Privy Dashboard

## Ambassador Governance

### Dispute Resolution

Ambassadors vote on buyer disputes to determine outcomes (refund buyer or release funds to seller).

**Flow:**
1. Buyer disputes order with reason + optional IPFS evidence
2. Seller responds with reason + optional IPFS evidence
3. 72-hour voting window opens
4. Ambassadors vote (must have 1+ activated seller to vote)
5. Majority wins (minimum 5 votes required)
6. If no quorum: extend 48h, then auto-refund buyer

**Vote Reason Requirement:** Ambassadors must provide a reason (minimum 20 characters) when voting.

**Seeds Rewards:**
- 100 Seeds per vote
- +50 bonus Seeds if voted with majority

**Strike System:**
- Seller loses dispute → +1 strike
- 3 strikes → auto-suspension
- Buyer wins frivolous dispute → +1 buyer strike

**Admin Override:** Contract has admin resolve function for emergencies, but we avoid using it. Instead, use the voter whitelist (see "Early-Stage Voter Whitelist" below) so all resolutions appear as normal votes, maintaining decentralization precedent.

**Routes:**
- `/ambassador/disputes` — Ambassador disputes dashboard (vote on open disputes)

**Hooks:**
- `useDisputes()` — Fetch all disputes
- `useVoteOnDispute()` — Cast vote with reason (gasless)
- `useResolveDispute()` — Finalize after voting ends

**Files:**
- `frontend/src/app/ambassador/disputes/page.tsx` — Disputes dashboard
- `frontend/src/components/disputes/DisputeCard.tsx` — Dispute display card
- `frontend/src/components/disputes/DisputeVoteModal.tsx` — Voting UI with reason field
- `frontend/src/components/disputes/DisputeEvidence.tsx` — Evidence display
- `frontend/src/hooks/useDisputes.ts` — Fetch disputes from contract
- `frontend/src/hooks/useVoteOnDispute.ts` — Vote + resolve hooks
- `frontend/src/lib/contracts/disputeResolution.ts` — ABI + address

### Government Data Requests

Government agencies can request transaction data for food safety; ambassadors vote on legitimacy.

**Flow:**
1. Government submits request (credentials, justification, jurisdiction)
2. 5-day voting window opens
3. Ambassadors vote approve/deny (minimum 10 votes)
4. If approved: admin uploads data export
5. All requests publicly logged for transparency

**Admin Override:** Contract has admin resolve function for emergencies, but we avoid using it. Instead, use the voter whitelist (see "Early-Stage Voter Whitelist" below) so all resolutions appear as normal votes, maintaining decentralization precedent.

**Routes:**
- `/government` — Public government relations page
- `/government/request` — Submit new request form
- `/government/requests` — Public request log (transparency)
- `/ambassador/governance` — Ambassador voting on government requests

**Hooks:**
- `useGovernmentRequests()` — Fetch all requests
- `useVoteOnGovRequest()` — Cast vote (gasless)

**Files:**
- `frontend/src/app/government/page.tsx` — Public landing page
- `frontend/src/app/government/request/page.tsx` — Request submission form
- `frontend/src/app/government/requests/page.tsx` — Public request log
- `frontend/src/app/ambassador/governance/page.tsx` — Ambassador voting page
- `frontend/src/hooks/useGovernmentRequests.ts` — Fetch requests
- `frontend/src/hooks/useVoteOnGovRequest.ts` — Vote hook
- `frontend/src/lib/contracts/governmentRequests.ts` — ABI + address

### Governance Contracts (Base Sepolia)

Deployed Feb 7 2026 (with voter whitelist):
- `NEXT_PUBLIC_DISPUTE_RESOLUTION_ADDRESS` = `0xa0C993bB951E3a6dF0C96602439bb6557acfBB41`
- `NEXT_PUBLIC_GOVERNMENT_REQUESTS_ADDRESS` = `0x9464B2b76047Da4eb6fD8E60245998f1c747DC33`

**Subgraph entities:**
- `Dispute`, `DisputeVote`, `UserStrikes` — Dispute tracking
- `GovernmentRequest`, `GovernmentRequestVote` — Request tracking
- `GovernanceStats` — Aggregate statistics

### Early-Stage Voter Whitelist

**Philosophy:** Once LocalRoots converts to $ROOTS tokens, there must be NO admin override. The platform must be fully decentralized - no founder control over dispute outcomes.

**Why whitelist instead of admin override:**
- Admin override creates two classes of resolution: "voted" vs "admin resolved"
- Sets precedent that admin can override community decisions
- Must be removed for true decentralization
- Whitelisted voters participate normally in voting, just bypassing the "activated seller" requirement

**Contract feature:** `whitelistedVoters` mapping on DisputeResolution and GovernmentRequests contracts:
- Whitelisted addresses can vote like any ambassador
- No special "admin resolved" flag - just normal votes
- Can be emptied when enough qualified voters exist
- Completely removable for full decentralization

**Admin functions:**
- `addWhitelistedVoter(address voter)` — Add address to whitelist
- `removeWhitelistedVoter(address voter)` — Remove address from whitelist
- `whitelistedVoters(address)` — Check if address is whitelisted

**Decentralization roadmap:**

| Phase | Whitelist Status | Voting |
|-------|------------------|--------|
| Early Stage (NOW) | Founder + trusted early ambassadors | All votes equal, no "admin resolved" |
| Growth (10+ Qualified) | Shrink whitelist as ambassadors qualify naturally | Founder becomes 1 of many |
| Crypto Launch ($ROOTS) | Empty whitelist | All voters must be qualified |
| Geographic Voting (50+) | No whitelist | Regional routing, local quorum |

**Key principle:** The whitelist is a TEMPORARY bridge, not a permanent feature. It exists only because:
1. Platform is new, not enough qualified voters
2. Someone needs to resolve disputes
3. We don't want "admin override" precedent

## Anti-Gaming & Fraud Prevention (All On-Chain)

**30 mechanisms across 3 contracts** — all enforced at the smart contract level, not frontend. No client can bypass them.

### Key Protections (AmbassadorRewards.sol)

| Mechanism | How It Works |
|-----------|-------------|
| **Seller Activation Gate** | Zero rewards until recruited seller has 2 orders from 2 unique buyers |
| **7-Day Reward Vesting** | Rewards clawed back if order disputed within vesting window |
| **Daily Treasury Cap** | Max 0.5% of initial treasury outflow per day |
| **Weekly Ambassador Cap** | Max 10,000 ROOTS per ambassador per week |
| **24-Hour Cooldown** | New ambassadors can't earn for 24h after registration |
| **1-Year Reward Expiry** | Rewards stop flowing 365 days after seller recruitment |
| **Full Clawback on Suspension** | ALL pending rewards recovered when ambassador suspended |
| **Max Chain Depth** | Reward chain walks max 10 levels up |
| **Ambassador Flagging** | Any ambassador can flag another; community votes over 3 days |

### Key Protections (DisputeResolution.sol)

| Mechanism | How It Works |
|-----------|-------------|
| **3-Strike Auto-Suspension** | Sellers/buyers auto-suspended after 3 lost disputes |
| **5-Vote Quorum** | Disputes need 5+ votes; extends 48h then auto-refunds buyer |
| **Frivolous Dispute Detection** | Buyer gets strike if seller wins with >80% vote margin |
| **Vote Reason Requirement** | Min 20 characters per vote — no lazy clicking |
| **Voter Qualification** | Must have 1+ activated seller to vote (unless whitelisted) |

### Key Protections (LocalRootsMarketplace.sol)

| Mechanism | How It Works |
|-----------|-------------|
| **2-Day Dispute Window** | Buyers can dispute within 48h of completion |
| **Escrow Hold** | Funds locked in contract until dispute window expires |
| **Proof-of-Delivery** | Seller must upload IPFS proof before order completion |
| **Admin Suspension** | Admin or dispute contract can suspend sellers with reason |

**Design philosophy:** Any single attack might succeed once, but vesting + clawback + strikes make it unprofitable to repeat. Daily/weekly caps limit maximum damage from any exploit.

## Marketing & Outreach Strategy

**Marketing is handled by Common Area's NIF (Nightly Idea Factory)**, not LocalRoots. LocalRoots is the guinea pig for extending Common Area's data collection infrastructure beyond real estate.

**Approach:** LocalRoots becomes a new constituent type in Common Area's existing discovery pipeline. Three new intel tables (`intel_community_gardens`, `intel_farmers_markets`, `intel_food_influencers`) plug into the same county-level discovery job state machine used for HOAs and contractors.

**Roll-out:** County-by-county, starting with Beaufort County SC (Heritage Farm, Seabrook), then Lowcountry SC, coastal GA, Bay Area (Emily Bach), Atlanta (James Carr).

**Ambassador handoff:** Within 12 months, NIF shifts from sending cold outreach to feeding discovered targets to ambassadors. NIF keeps doing discovery, content generation, and analytics. Ambassadors do the warm outreach.

**Content engine:** Pulls from existing `crop-growing-data.json` and regional knowledge files to auto-generate seasonal posts by zone. Zero manual work from Doug.

**Full plan:** `/Users/dougcalahan/Downloads/localroots-marketing-plan-for-common-area.md` (handed to Common Area NIF for implementation).

**Common Area's implementation plan:** Uses `localroots_` prefixed tables in Common Area Supabase (consumer pattern, not core constituent). Radius-based geography (not county FIPS). Marketing waves follow growing zones south-to-north. Shared Resend email infrastructure benefits all products. Key addition needed: UTM parameters on outreach links to track Sage usage back to email campaigns.

### Collections Sync API (Common Area ↔ LocalRoots)

Autonomous server-to-server sync. Common Area NIF proposes gardens and resolves slugs without human/git handoff. Static `frontend/src/data/collections.json` is the seed; runtime additions go to Vercel KV (`collection:<slug>` + `collections:index`).

**Endpoints** (Bearer auth via `COLLECTIONS_SYNC_TOKEN`):

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/collections/propose` | Propose new gardens — server generates slugs, idempotent by name+city, max 200/batch. Re-posting returns existing slug in `created` (not `skipped`) |
| GET | `/api/collections/resolve?slugs=a,b,c` | Resolve specific slugs → `{ slug, name, city, state, buyer_url, poster_url, active, added_date, source }` |
| GET | `/api/collections/resolve?since=ISO8601` | Delta fetch of all collections added on/after date. Accepts full ISO8601 or `YYYY-MM-DD` |

**Common Area cadence:** slug-sync cron every 6h. First fire re-posts the 85 qualified gardens (idempotent backfill), steady trickle after. Weekly digest to `#claude-localroots` (`C0AELQC8GDV`) Monday 9am ET.

**Env vars required (Vercel Production):**
- `COLLECTIONS_SYNC_TOKEN` — shared secret with Common Area, ≥16 chars. Fail-closed if missing.

**Key files:**
- `frontend/src/app/api/collections/propose/route.ts`
- `frontend/src/app/api/collections/resolve/route.ts`
- `frontend/src/lib/syncAuth.ts` — Bearer + `timingSafeEqual`
- `frontend/src/lib/collections.ts` — `getCollectionAsync`, `upsertCollectionToKV`, `generateUniqueSlug`, `collectionBuyerUrl`, `collectionPosterUrl`

**Page rendering:** `/garden/[slug]` and `/garden/[slug]/poster` are async server components using `getCollectionAsync` — KV-added gardens render the same as seeded ones.

**Deactivation sync (future):** v1 uses `?since=` polling, so deactivations propagate within 6h. When tighter sync is needed, expose `POST /api/localroots/garden-event` accepting `{ slug, event: 'deactivated' | 'reactivated' | 'updated' }` and Common Area pushes deltas. Parked until requested.

## Social Sharing

**Reference:** Common Area's [Social Sharing Guide](https://github.com/dcalahan/nightly-idea-factory/blob/master/support/LOCALROOTS-SOCIAL-SHARING-GUIDE.md) — platform-specific rules for URL placement, hashtag counts, image dimensions, posting times.

**Full plan:** `~/.claude/plans/zany-meandering-kazoo.md` — complete inventory of share surfaces, Facebook architecture, verification checklist.

### How Facebook Sharing Works (CRITICAL)

Facebook does NOT discover URLs on its own. It only scrapes a URL's OG tags when explicitly told to via the Graph API or Sharing Debugger. Without proactive scraping, Facebook shows the generic `localroots.love` fallback image for every shared URL.

**Architecture:** After every profile/garden data save, we call Facebook's Graph API to pre-warm the OG cache:

```
POST graph.facebook.com/?id={url}&scrape=true&access_token={appId}|{appSecret}
```

**Utility:** `frontend/src/lib/facebookOgScrape.ts` — `warmFacebookOgCache(path)`. Fire-and-forget, silent no-op when env vars missing (dev).

**Call sites:**

| Route | Trigger | Path scraped |
|-------|---------|-------------|
| `POST /api/gardener-profile` | User saves public garden profile | `/gardeners/${userId}` |
| `PUT /api/my-garden` | Plants/beds change (only if user has public profile) | `/gardeners/${userId}` |
| `POST /api/collections/propose` | Common Area adds a garden | `/garden/${slug}` |
| `POST /api/relay` | Seller creates a listing (gasless) | `/buy/listings/${listingId}` |

**Environment variables (Vercel):**
- `FACEBOOK_APP_ID` — from developers.facebook.com (free app, no approval needed)
- `FACEBOOK_APP_SECRET` — from the same app dashboard

### OG Meta (Dynamic)

| Page | URL pattern | OG image source | OG title source |
|------|-------------|-----------------|-----------------|
| Garden collection | `/garden/[slug]` | Hero image or `og-image.png` fallback | `garden.name` |
| Gardener profile | `/gardeners/[userId]` | Garden photo → profile photo → `og-image.png` | `gardener.displayName` |
| Listing detail | `/buy/listings/[id]` | Listing photo from IPFS (Pinata gateway) | `listing.produceName` |
| All other pages | Various | `og-image.png` (static from `layout.tsx`) | Layout default |

**Gardener profile technical notes:**
- Server component uses **inline Upstash REST call** (not `lib/kv.ts`) because the kv module fails silently in RSC on Vercel
- Applies `decodeURIComponent()` to userId param — Privy IDs have colons that get URL-encoded
- `export const dynamic = 'force-dynamic'` prevents static caching

**Listing detail technical notes:**
- Server component split: `page.tsx` (server, `generateMetadata`) + `ListingDetailClient.tsx` (client, interactive UI)
- Data fetched server-side via shared `lib/listingData.ts` (viem RPC + IPFS fetch, no browser APIs)
- Uses `React.cache()` to deduplicate fetch between `generateMetadata` and page render
- OG images use Pinata gateway (`gateway.pinata.cloud`) for reliability with FB crawler
- 5-second timeout on IPFS fetches to avoid slow page loads

### Share Surfaces

| Surface | Component | URL shared | Dynamic OG? |
|---------|-----------|-----------|-------------|
| My Garden → Share | `MyGardenView.tsx` → `ShareCardModal` (`my-garden` type) | `/gardeners/{userId}` | ✅ Yes |
| Garden page → Share | `GardenShareButton.tsx` (Web Share API + clipboard) | `/garden/{slug}` | ✅ Yes |
| Listing → Share | `buy/listings/[id]/page.tsx` (Web Share API + clipboard) | `/buy/listings/{id}` | ✅ Yes |
| Seller dashboard → Share listing | `ShareCardModal` (`seller-listing` type) | `/buy/listings/{id}` | ✅ Yes |
| Ambassador/Seller dashboards | `ShareCardModal` (recruit card types) | Various `/sell/`, `/ambassador/` | ❌ No (static, generic OG fine) |

**5 share card types** (canvas-generated 1080×1920 PNG): `recruit-sellers`, `recruit-ambassadors`, `seller-listing`, `ambassador-listing`, `my-garden`

### Platform Rules (from Common Area guide)

| Platform | Key rule | Implementation |
|----------|----------|----------------|
| **Facebook** | URL must be on line 1. Uploading a custom image kills the OG link preview card. | FB share copies link+caption only (no image download). OG preview does the work. |
| **Instagram** | URLs not clickable in captions. Can't auto-attach link stickers from web. | iOS native share sheet sends image. Copies garden URL to clipboard (not caption) for link sticker. IG tip with tappable URL shown in modal. |
| **SMS/Email/NextDoor** | URL inline | Standard share text |

### SEO

- `sitemap.xml` — static pages + all active garden pages (seed + KV, dynamic)
- `robots.txt` — allows `/`, disallows `/api/` and `/admin/`

### Key Files

| File | Purpose |
|------|---------|
| `frontend/src/lib/facebookOgScrape.ts` | Facebook Graph API OG cache warming (fire-and-forget) |
| `frontend/src/lib/shareCards.ts` | Canvas card generator (5 types), platform-specific share text |
| `frontend/src/components/ShareCardModal.tsx` | Reusable share modal — FB copies link+caption only, no image |
| `frontend/src/components/grow/MyGardenView.tsx` | My Garden share button (coral) → ShareCardModal |
| `frontend/src/app/garden/[slug]/GardenShareButton.tsx` | Garden page share button (Web Share API) |
| `frontend/src/app/gardeners/[userId]/page.tsx` | Gardener profile — server component with dynamic OG, inline KV |
| `frontend/src/app/buy/listings/[id]/page.tsx` | Listing detail — server component with dynamic OG |
| `frontend/src/app/buy/listings/[id]/ListingDetailClient.tsx` | Listing detail — client component (cart, share, interactive) |
| `frontend/src/lib/listingData.ts` | Server-safe listing data fetch (contract RPC + IPFS) |
| `frontend/src/app/sitemap.ts` | Dynamic sitemap |
| `frontend/src/app/robots.ts` | Robots.txt |

## Known Issues

- **Privy HTML warnings:** Console shows `<div>` inside `<p>` warnings - this is a Privy internal bug, cosmetic only
- **DNS propagation:** After domain changes, can take up to 48 hours for full propagation
- **Seller earnings page uses mock data:** FIXED (Feb 2026) - Now uses real data from `useSellerOrders()`

## Roots Points vs $ROOTS — CRITICAL TERMINOLOGY

**REBRAND IN PROGRESS (decided April 2026):** the loyalty currency is now called **Roots Points** (RP) in all user-facing UI, NOT "Seeds." Reason: Matt Hunt and other non-crypto-native testers literally thought "Seeds" meant LocalRoots was mailing seed packets. Full plan in `~/.claude/plans/roots-points-rebrand-and-bootstrap-honesty.md`.

**During pre-launch (NOW):** Sellers and ambassadors earn **Roots Points** (the loyalty rewards program), NOT $ROOTS tokens.

- Roots Points are on-chain events tracked in the subgraph (the underlying data structure is still called `Seeds` internally for now — variable names, hook names like `useSeeds`, etc. — that's a separate refactor; user-facing copy is what matters first)
- Roots Points convert to $ROOTS tokens at a fixed ratio when the token launches (spring 2027)
- **The UI must say "Roots Points" everywhere, NOT "Seeds" and NOT "ROOTS" or "$ROOTS"** until Phase 2 launches

**At $ROOTS launch (Phase 2, spring 2027):** Roots Points become $ROOTS tokens via airdrop. After launch, participants earn $ROOTS directly.

**Correct terminology in user-facing copy:**

| Context | Pre-Launch (NOW) | Post-Launch ($ROOTS) |
|---------|------------------|----------------------|
| What sellers earn | Roots Points | $ROOTS |
| What ambassadors earn | Roots Points + cash | $ROOTS |
| Dashboard label | "Roots Points earned" | "$ROOTS earned" |
| Balance label | "Roots Points balance" | "$ROOTS balance" |

**Internal code is fine to keep using `Seeds`** in variable/function names (`useSeeds`, `formatSeeds`, etc.) until a dedicated rename refactor — those don't reach users. New code can use either.

**Known leak fixed Apr 26 2026:** `/about/tokenomics` page (linked from Early Adopter Bonus banner's "Learn more") was still rendering "Seeds" in 40+ places. Now uses "Roots Points." If you find another page with user-facing "Seeds" copy, it's a bug — fix on sight.

## $ROOTS Token Launch — Distribution & Wallet

### Token Distribution Strategy

Two distribution methods based on wallet type:

| User Type | Wallet Type | Distribution Method | User Action |
|-----------|-------------|---------------------|-------------|
| Sellers | Privy (email) | Auto-distribute | None — see balance on login |
| Ambassadors | Privy (email) | Auto-distribute | None — see balance on login |
| Credit Card Buyers | Privy (email) | Auto-distribute | None — see balance on login |
| Crypto Buyers | External (MetaMask, etc.) | Merkle claim | Go to `/claim`, connect wallet, claim |

**Why two methods?**
- Privy users: We have their wallet addresses, can batch-transfer directly
- External users: No direct access, need Merkle proof for trustless claims

### Distribution Scripts

**Directory:** `scripts/distribution/`

| Script | Purpose |
|--------|---------|
| `fetchPrivyUsers.ts` | Query Privy Management API for all Privy wallet addresses |
| `calculateAllocations.ts` | Calculate ROOTS from Seeds snapshot (subgraph query) |
| `batchTransfer.ts` | Execute batch ROOTS transfers to Privy wallets |

**Execution flow:**
1. Snapshot Seeds from subgraph → all earners with balances
2. Query Privy API → get all Privy-created wallet addresses
3. Separate: Privy wallets vs External wallets
4. Privy users → Batch transfer ROOTS directly (50 per tx)
5. External users → Generate Merkle tree for `/claim` page

**Environment variables (server-side only):**
```bash
PRIVY_API_SECRET=xxx          # Privy Management API (never expose publicly)
DEPLOYER_PRIVATE_KEY=xxx      # For batch transfers from treasury
```

### Wallet Page

**Route:** `/wallet`

Unified wallet dashboard for all users (Privy and external).

**Layout:**
```
┌─────────────────────────────────────────┐
│            Your Wallet                   │
├─────────────────────────────────────────┤
│ TOKEN BALANCES                           │
│  🔸 ROOTS    12,450.00    $124.50       │
│  💵 USDC        150.00    $150.00       │
│  💵 USDT         25.00     $25.00       │
│  ⚡ ETH          0.0234    $87.50       │
├─────────────────────────────────────────┤
│ RECEIVE        │  SEND                   │
│ [QR Code]      │  [Select Token ▼]      │
│ 0x40b9...cF99  │  Recipient: [______]   │
│ [📋 Copy]      │  Amount: [___] [MAX]   │
│                │  [Send ROOTS]           │
├─────────────────────────────────────────┤
│ SWAP (Coming Soon)                       │
│ Swap ROOTS ↔ USDC on Aerodrome          │
└─────────────────────────────────────────┘
```

**Components:**

| Component | File | Purpose |
|-----------|------|---------|
| `WalletDashboard` | `components/wallet/WalletDashboard.tsx` | Main container |
| `SendTokenModal` | `components/wallet/SendTokenModal.tsx` | Modal for sending tokens |
| `ReceiveTokenSection` | `components/wallet/ReceiveTokenSection.tsx` | Address + QR code |
| `SwapWidget` | `components/wallet/SwapWidget.tsx` | Swap UI (post-launch) |

**Hooks:**

| Hook | File | Purpose |
|------|------|---------|
| `useWalletBalances` | `hooks/useWalletBalances.ts` | Fetch ROOTS, USDC, USDT, ETH balances |
| `useSendToken` | `hooks/useSendToken.ts` | Execute ERC20/ETH transfers |
| `useAerodromeSwap` | `hooks/useAerodromeSwap.ts` | Swap via Aerodrome (post-launch) |

### Aerodrome DEX Integration

**Choice:** Aerodrome — native Base DEX with largest TVL, ve(3,3) model for liquidity incentives.

**Contract:** `frontend/src/lib/contracts/aerodrome.ts`
```typescript
// Aerodrome Router on Base Mainnet
export const AERODROME_ROUTER_ADDRESS = '0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43';
```

**Swap flow:**
1. User selects ROOTS → USDC (or vice versa)
2. `getAmountsOut()` → show estimated output
3. User confirms with slippage tolerance
4. `approve()` ROOTS to Aerodrome router (if needed)
5. `swapExactTokensForTokens()` → execute swap
6. Show success with new balances

**Environment variable:**
```bash
NEXT_PUBLIC_AERODROME_ROUTER_ADDRESS=0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43
```

### Phase Transition Infrastructure (Already Completed)

The following v1 infrastructure is already implemented:

- `usePhase` hook for phase detection (Phase 1 = Seeds, Phase 2 = ROOTS)
- Phase-aware labels in dashboard/earnings pages
- `/claim` page for Merkle-based airdrop
- `useAirdropClaim` hook
- `seedsAirdrop.ts` contract library
- Phase transition E2E tests
- Airdrop E2E tests
- `DeployPhase2.s.sol` deployment scripts
- `GenerateMerkleTree.ts` script

### Key Files for Token Launch

| Purpose | File Path |
|---------|-----------|
| Subgraph queries | `frontend/src/hooks/useSeeds.ts` |
| ERC20 operations | `frontend/src/hooks/useTokenApproval.ts` |
| Balance display | `frontend/src/components/FundsAvailable.tsx` |
| Privy wallet signing | `frontend/src/hooks/useGaslessTransaction.ts` |
| Merkle tree generation | `contracts/script/GenerateMerkleTree.ts` |
| Phase detection | `frontend/src/hooks/usePhase.ts` |
| Airdrop claims | `frontend/src/hooks/useAirdropClaim.ts` |
