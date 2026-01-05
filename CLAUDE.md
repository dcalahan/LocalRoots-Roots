# LocalRoots Project Guidelines

## Wallet Architecture - CRITICAL

### Buyers
- Use **external wallets only** (WalletConnect, Coinbase Wallet, browser extensions)
- **NEVER use Privy** - Privy is exclusively for sellers/ambassadors
- Payment options: credit card (thirdweb) or their own crypto wallet
- Orders are tied to the wallet that made the purchase

### Sellers & Ambassadors
- Use **Privy embedded wallets** (email/phone login)
- Gasless meta-transactions via ERC-2771 forwarder
- All listings owned by Privy wallet address

### Test Wallet
- Only available when `NEXT_PUBLIC_TEST_WALLET_PRIVATE_KEY` is set
- **Never shown in production** - don't set that env var in prod
- **Never auto-connects** - must be explicitly selected
- Used for internal testing only

### UI Language
- Don't mention specific wallet brands (not "MetaMask", just "your wallet")
- Buyers "connect wallet" or "sign in"
- Sellers/Ambassadors "log in" via Privy

## Key Components

| Component | Purpose |
|-----------|---------|
| `BuyerWalletButton` / `BuyerWalletModal` | External wallet connection for buyers (wagmi) |
| `WalletButton` | Privy login for sellers/ambassadors |
| `usePrivy` / `useWallets` | Privy authentication hooks |
| `useAccount` (wagmi) | External wallet state for buyers |

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
