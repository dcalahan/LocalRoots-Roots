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

## Contract Addresses

All contract addresses must be from the same deployment. If one changes, verify all are updated in `.env.local`:
- `NEXT_PUBLIC_ROOTS_TOKEN_ADDRESS`
- `NEXT_PUBLIC_MARKETPLACE_ADDRESS`
- `NEXT_PUBLIC_AMBASSADOR_REWARDS_ADDRESS`
- `NEXT_PUBLIC_FORWARDER_ADDRESS`

## Development

```bash
# Frontend
cd frontend && npm run dev

# Cloudflare tunnel for phone testing
cloudflared tunnel --url http://localhost:3000

# Smart contracts
cd contracts && forge build
```
