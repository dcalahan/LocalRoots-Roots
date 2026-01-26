# LocalRoots Project Guidelines

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

## Development

```bash
# Frontend
cd frontend && npm run dev

# Cloudflare tunnel for phone testing
cloudflared tunnel --url http://localhost:3000

# Smart contracts
cd contracts && forge build
```

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

## Known Issues

- **Privy HTML warnings:** Console shows `<div>` inside `<p>` warnings - this is a Privy internal bug, cosmetic only
- **DNS propagation:** After domain changes, can take up to 48 hours for full propagation
