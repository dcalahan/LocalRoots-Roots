# Local Roots

> "Neighbors Feeding Neighbors"

A decentralized marketplace for neighbors to buy and sell homegrown produce using $ROOTS tokens on Base.

## Overview

Local Roots builds community resilience by incentivizing individuals to grow and share food locally. The platform is fully decentralized - no central servers, censorship-resistant, and community-governed.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                 Frontend (Next.js)                      │
│           Hosted on IPFS / Vercel                       │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                  The Graph (Indexer)                    │
│         Fast queries for sellers/listings               │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│              Smart Contracts (Base L2)                  │
│  $ROOTS Token │ Marketplace │ Ambassador Rewards        │
└─────────────────────────────────────────────────────────┘
```

## Project Structure

```
LocalRoots-Roots/
├── contracts/          # Solidity smart contracts (Foundry)
│   ├── src/
│   │   ├── RootsToken.sol           # $ROOTS ERC-20 token
│   │   ├── FounderVesting.sol       # Founder token vesting
│   │   ├── LocalRootsMarketplace.sol # Main marketplace
│   │   └── AmbassadorRewards.sol    # Ambassador MLM system
│   └── script/
│       └── Deploy.s.sol             # Deployment scripts
├── frontend/           # Next.js web application
│   └── src/
│       ├── app/                     # App router pages
│       ├── components/              # React components
│       └── lib/                     # wagmi config
└── subgraph/           # The Graph indexer
    ├── schema.graphql               # GraphQL schema
    └── src/                         # Event handlers
```

## Tokenomics ($ROOTS)

**Total Supply: 100,000,000 ROOTS**

| Allocation | Amount | Purpose |
|------------|--------|---------|
| Founders | 10M (10%) | 3-year vesting, 6-month cliff |
| Ambassador Rewards | 25M (25%) | Ongoing ambassador payouts |
| Liquidity | 15M (15%) | Aerodrome LP on Base |
| Treasury | 40M (40%) | DAO-controlled |
| Airdrop | 10M (10%) | Initial distribution |

## Features

### For Buyers
- Browse local growers by location (geohash)
- Purchase produce with $ROOTS
- Choose pickup or delivery
- Dispute resolution within 2 days

### For Sellers
- Create storefront with photos and description
- List products with pricing in $ROOTS
- Set delivery/pickup options and radius
- Manage orders and inventory

### For Ambassadors
- Earn 25% of sales from recruited sellers (first year)
- Multi-level structure with senior ambassador cut
- Dashboard to track earnings and recruits

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

# Run frontend dev server
npm run dev
```

### Testing

```bash
# Run contract tests
cd contracts
forge test

# Run frontend tests
cd frontend
npm test
```

### Deployment

1. Set environment variables:
```bash
export PRIVATE_KEY=your_deployer_private_key
export FOUNDER_ADDRESS=0x...
export LIQUIDITY_POOL_ADDRESS=0x...
export TREASURY_ADDRESS=0x...
export AIRDROP_ADDRESS=0x...
```

2. Deploy to Base Sepolia (testnet):
```bash
cd contracts
forge script script/Deploy.s.sol:DeployAll --rpc-url base_sepolia --broadcast
```

3. Update contract addresses in frontend `.env`

4. Deploy subgraph to The Graph Studio

## Brand Colors

| Color | Hex | Use |
|-------|-----|-----|
| Primary | #EB6851 | Buttons, accents |
| Secondary | #3EBFAC | Secondary actions |
| Gray | #818181 | Text |
| Cream | #F5F0EE | Backgrounds |

## License

MIT
