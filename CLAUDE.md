# LocalRoots Project Guidelines

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

## Contract Addresses (Base Sepolia Testnet)

Current deployment (2025-01-25):
- `NEXT_PUBLIC_ROOTS_TOKEN_ADDRESS` = `0x21952Cb029da00902EDA5c83a01825Ae2E645e03`
- `NEXT_PUBLIC_MARKETPLACE_ADDRESS` = `0xBAc288595e52AF2dDF560CEaEf90064463c08f0d`
- `NEXT_PUBLIC_AMBASSADOR_REWARDS_ADDRESS` = `0xC596B9FcCAC989abf4B4244EC8c74CF8d50DDB91`
- `NEXT_PUBLIC_FORWARDER_ADDRESS` = `0xd6632078F9ad1Fb03a9Babd2908cBA4D00D43F74`
- `NEXT_PUBLIC_USDC_ADDRESS` = `0xBe0D90a4C6BBC99a37BA0A5aA9Ffaa894f826e06` (MockUSDC - mintable)
- `NEXT_PUBLIC_USDT_ADDRESS` = `0x3c69B46E4Ab4141F0089a5289dBC20f33A36981b` (MockUSDT - mintable)

Governance contracts (2026-02-06):
- `NEXT_PUBLIC_DISPUTE_RESOLUTION_ADDRESS` = `0x8A311F9065D90bA328D297aDfc90951e6076762E`
- `NEXT_PUBLIC_GOVERNMENT_REQUESTS_ADDRESS` = `0x8FD009B0F383AD22f6c3d49A46e1ff004dA17E0D`

All contract addresses must be from the same deployment. If one changes, verify all are updated in `.env.local`.

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
- `ANTHROPIC_API_KEY` - For Garden AI chat

Optional for testing:
- `NEXT_PUBLIC_TEST_WALLET_PRIVATE_KEY` - Shows "Test Funds" button (REMOVE BEFORE MAINNET!)

**Privy Configuration:**
- Allowed domains must include: `localroots.love`, `www.localroots.love`, `localhost:3000`
- Dashboard: https://dashboard.privy.io/

## Credit Card Payments

**Testnet Limitation:** Credit card payments via thirdweb Pay only work on mainnet. The testnet shows a "Coming Soon" message instead.

**File:** `frontend/src/components/checkout/CreditCardCheckout.tsx`

## Garden AI Chat

The `GardenAIChat` component provides AI gardening assistance:
- Available on `/grow` page (visible in navigation header)
- Also available on all `/sell/*` pages via layout wrapper
- Floating chat icon in bottom-right corner

**Files:**
- `frontend/src/components/grow/GardenAIChat.tsx` - Main component
- `frontend/src/app/sell/layout.tsx` - Adds chat to sell pages

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

# Full suite (lifecycle + activation + dispute)
npm run test:e2e:full

# Settlement (run 48+ hours after lifecycle)
npm run test:e2e:settle
```

**Test suite summary (85 total tests):**

| Test File | Tests | Purpose |
|-----------|-------|---------|
| lifecycle.test.ts | 13 | Full marketplace flow: register → list → buy → fulfill |
| activation.test.ts | 10 | Seller activation with 2 unique buyers |
| dispute.test.ts | 14 | Buyer dispute → seller refund flow |
| state-machine.test.ts | 16 | Invalid state transitions & auth checks |
| suspension.test.ts | 15 | Admin suspend/unsuspend seller |
| listing.test.ts | 9 | Seller deactivate/reactivate listing |
| payment-tokens.test.ts | 8 | Phase 2 ROOTS payment, stablecoin requirements |
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

## Mainnet Launch Checklist

- [ ] Remove `NEXT_PUBLIC_TEST_WALLET_PRIVATE_KEY` from Vercel environment variables
- [ ] Update contract addresses to mainnet deployments
- [ ] Verify credit card payments work (thirdweb Pay requires mainnet)
- [ ] Update Privy allowed domains if needed

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

**Checklist:**
- [ ] Open-source all code with deployment documentation
- [ ] Set up multi-sig treasury (Gnosis Safe or similar)
- [ ] Create relayer documentation for community operators
- [ ] Design governance token/DAO structure

### Phase 4: Full Autonomy (Eventual)

- Multiple frontends exist (run by different people/orgs)
- Protocol upgrades via on-chain governance
- Treasury controlled by token holders
- Founder is one voice among many
- LocalRoots continues even if founder disappears

## Growth Strategy & Virality (Future)

### Target Market
- **Community gardens** with hundreds of gardeners (e.g., Heritage Farm at Sea Pines)
- **Older neighbors** who may not be crypto-native but are active gardeners
- **NextDoor users** - key channel for local community reach

### Ambassador Sharing Tools — Shareable Cards (Implemented)

**4 shareable card types** (canvas-generated 1080x1920 PNG, Instagram Stories format):

| Card | Used By | Trigger | URL |
|------|---------|---------|-----|
| 1. Recruit Sellers | Ambassadors | After registration (auto-popup) + dashboard | `/sell/register?ref={id}` |
| 2. Recruit Ambassadors | Ambassadors / Founder | Dashboard | `/ambassador/register?ref={id}` |
| 3. Seller Listing | Sellers | After listing creation + dashboard | `/buy` |
| 4. Ambassador Promotes Listing | Ambassadors | Dashboard per-order | `/buy` |

**Key Files:**
- `frontend/src/lib/shareCards.ts` — Canvas engine + share utilities + pre-written text
- `frontend/src/components/ShareCardModal.tsx` — Reusable modal (preview, channel buttons, loading)
- `frontend/src/lib/geohashLocation.ts` — `reverseGeocodeWithNeighborhood()` for Cards 3 & 4

**Share Channels:** Native share (mobile), Copy Link, SMS, Facebook, Email, NextDoor (Cards 1/3/4 only), Download Image

**NextDoor UX:** No API exists. Flow: copy text to clipboard → open `nextdoor.com/post/` in new tab → toast instruction to paste.

**Neighborhood Resolution:** `reverseGeocodeWithNeighborhood()` uses Nominatim `zoom=18` → extracts `neighbourhood` → `suburb` → `city_district` → `city`. Separate cache from city-level `reverseGeocode()`. Display: "Haynes Manor, Atlanta" or fallback "Atlanta, GA".

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

### Ambassador Onboarding Tools
- [ ] Step-by-step guide for recruiting non-tech-savvy neighbors
- [ ] Video tutorials for common tasks (registering, listing, buying)
- [ ] FAQ section addressing concerns (what is crypto? is it safe?)
- [ ] "Invite a neighbor" flow optimized for simplicity

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

**Admin Override:** Admins can resolve disputes directly with a required reason (for early-stage or urgent cases).

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

**Admin Override:** Admins can approve/deny requests directly with a reason.

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

Deployed Feb 6 2026:
- `NEXT_PUBLIC_DISPUTE_RESOLUTION_ADDRESS` = `0x8A311F9065D90bA328D297aDfc90951e6076762E`
- `NEXT_PUBLIC_GOVERNMENT_REQUESTS_ADDRESS` = `0x8FD009B0F383AD22f6c3d49A46e1ff004dA17E0D`

**Subgraph entities:**
- `Dispute`, `DisputeVote`, `UserStrikes` — Dispute tracking
- `GovernmentRequest`, `GovernmentRequestVote` — Request tracking
- `GovernanceStats` — Aggregate statistics

## Known Issues

- **Privy HTML warnings:** Console shows `<div>` inside `<p>` warnings - this is a Privy internal bug, cosmetic only
- **DNS propagation:** After domain changes, can take up to 48 hours for full propagation
