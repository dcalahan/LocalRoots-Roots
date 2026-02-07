# LocalRoots

> "Neighbors Feeding Neighbors"

A decentralized marketplace for neighbors to buy and sell homegrown produce using $ROOTS tokens on Base.

**Live Site:** [www.localroots.love](https://www.localroots.love)

## Overview

LocalRoots builds community resilience by incentivizing individuals to grow and share food locally. The platform is fully decentralized - no central servers, censorship-resistant, and community-governed.

**Network:** Base Sepolia Testnet (mainnet launch coming soon)

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   Frontend (Next.js)                        │
│                 Hosted on Vercel                            │
│          Gasless transactions via ERC-2771                  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    The Graph (Indexer)                      │
│           Fast queries for sellers/listings                 │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                Smart Contracts (Base L2)                    │
│  $ROOTS Token │ Marketplace │ Ambassador │ Governance       │
└─────────────────────────────────────────────────────────────┘
```

## Project Structure

```
LocalRoots-Roots/
├── contracts/              # Solidity smart contracts (Foundry)
│   ├── src/
│   │   ├── RootsToken.sol              # $ROOTS ERC-20 token (1B supply)
│   │   ├── FounderVesting.sol          # Founder token vesting
│   │   ├── LocalRootsMarketplace.sol   # Main marketplace
│   │   ├── AmbassadorRewards.sol       # Ambassador rewards & Seeds
│   │   ├── DisputeResolution.sol       # Ambassador voting on disputes
│   │   └── GovernmentRequests.sol      # Data request voting
│   └── test/                           # Foundry unit tests
├── frontend/               # Next.js 14 web application
│   ├── src/
│   │   ├── app/                        # App router pages
│   │   ├── components/                 # React components
│   │   ├── hooks/                      # Custom React hooks
│   │   └── lib/                        # Utilities, contracts, wallet config
│   └── tests/e2e/                      # End-to-end tests (vitest + viem)
└── subgraph/               # The Graph indexer
    ├── schema.graphql                  # GraphQL schema
    └── src/                            # Event handlers
```

## Tokenomics ($ROOTS)

**Total Supply: 1,000,000,000 ROOTS**

| Allocation | Amount | Purpose |
|------------|--------|---------|
| Treasury | 400M (40%) | DAO-controlled |
| Ambassador Rewards | 250M (25%) | Ambassador payouts & Seeds |
| Liquidity | 150M (15%) | DEX liquidity |
| Airdrop | 100M (10%) | Initial distribution |
| Founders | 100M (10%) | 3-year vesting, 6-month cliff |

### Seeds System (Pre-Token Economy)

Before $ROOTS tokens are tradeable, ambassadors earn "Seeds" - on-chain points that convert 1:1 to $ROOTS at token launch.

| Action | Seeds Earned |
|--------|--------------|
| Seller: per $1 USDC sale | 500 Seeds |
| Buyer: per $1 USDC purchase | 50 Seeds |
| Ambassador: 25% of sale value | Split: 80% kept, 20% to upline |
| First listing milestone | 50 Seeds |
| First sale milestone | 10,000 Seeds |
| 5 sales milestone | 25,000 Seeds |
| 15 sales milestone | 50,000 Seeds |
| Voting on disputes/requests | 100 Seeds |

## Features

### For Buyers
- Browse local growers by location (geohash)
- Purchase produce with $ROOTS or credit card
- Choose pickup or delivery
- Raise disputes within 48h
- Garden AI assistant for growing tips

### For Sellers
- Gasless transactions (no ETH needed)
- Create storefront with photos and description
- List products with pricing in $ROOTS
- Set delivery/pickup options and radius
- Manage orders and inventory

### For Ambassadors
- Earn Seeds (25% of sale value) from recruited sellers
- Multi-level structure with upline sharing
- Dashboard to track earnings and recruits
- Vote on disputes and government data requests
- Shareable cards for recruiting

### Governance
- **Dispute Resolution:** Ambassador voting on buyer disputes (72h window)
- **Government Requests:** Vote on food safety data requests
- **Strike System:** Automatic seller suspension after 3 lost disputes
- **Early-Stage Whitelist:** Trusted voters can participate before qualifying

## Tech Stack

- **Frontend:** Next.js 14, TypeScript, Tailwind CSS
- **Authentication:** Privy (email/social login with embedded wallets)
- **Wallet Support:** WalletConnect, Coinbase Wallet, MetaMask
- **Gasless Tx:** ERC-2771 meta-transactions via relay
- **Smart Contracts:** Solidity 0.8.24, Foundry
- **Indexing:** The Graph
- **IPFS:** Pinata (images, metadata, evidence)
- **Payments:** ROOTS token, credit card via thirdweb Pay

## Development

### Prerequisites

- Node.js 18+
- Foundry (forge, cast, anvil)
- Git

### Setup

```bash
# Clone the repository
git clone https://github.com/dcalahan/LocalRoots-Roots.git
cd LocalRoots-Roots

# Install contract dependencies
cd contracts
forge install

# Build contracts
forge build

# Install frontend dependencies
cd ../frontend
npm install

# Copy environment template
cp .env.example .env.local
# Edit .env.local with your keys

# Run frontend dev server
npm run dev
```

### Testing

```bash
# Contract unit tests (Foundry)
cd contracts
forge test

# E2E tests against Base Sepolia
cd frontend
npm run test:e2e        # Core lifecycle
npm run test:e2e:full   # All tests (lifecycle + dispute + activation)
```

### Contract Addresses (Base Sepolia)

```
ROOTS Token:          0x21952Cb029da00902EDA5c83a01825Ae2E645e03
Marketplace:          0xBAc288595e52AF2dDF560CEaEf90064463c08f0d
Ambassador Rewards:   0xC596B9FcCAC989abf4B4244EC8c74CF8d50DDB91
ERC2771 Forwarder:    0xd6632078F9ad1Fb03a9Babd2908cBA4D00D43F74
Dispute Resolution:   0xa0C993bB951E3a6dF0C96602439bb6557acfBB41
Government Requests:  0x9464B2b76047Da4eb6fD8E60245998f1c747DC33
```

## Brand Colors

| Color | Hex | Use |
|-------|-----|-----|
| Primary (Coral) | #EB6851 | Buttons, CTAs, accents |
| Secondary (Teal) | #3EBFAC | Garden/grow features |
| Gray | #818181 | Body text |
| Cream | #F5F0EE | Backgrounds |

## Roadmap

- [x] Core marketplace (buy/sell/fulfill)
- [x] Ambassador rewards & Seeds system
- [x] Gasless transactions for sellers
- [x] Dispute resolution with voting
- [x] Government data request voting
- [ ] $ROOTS token launch on mainnet
- [ ] Credit card payments (mainnet only)
- [ ] Mobile app
- [ ] Geographic voting (regional disputes)

## License

MIT
