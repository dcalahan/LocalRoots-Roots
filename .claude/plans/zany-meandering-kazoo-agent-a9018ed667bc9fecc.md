# LocalRoots: Centralization, Regulatory Exposure, and Mainnet Migration Plan

## 1. Current State Assessment — Where You Actually Stand

### What Is Already Decentralized (The Good News)

The core marketplace architecture is strong. Doug should take genuine comfort here:

**Buyer-to-Seller Payments: Fully On-Chain Escrow**
- Funds go directly from buyer wallet into the `LocalRootsMarketplace` smart contract. The founder never touches, custodies, or routes user money. This is the single most important fact for regulatory posture.
- File: `/contracts/src/LocalRootsMarketplace.sol` (1,062 lines, well-structured)

**Fund Release: Automated, No Founder Involvement**
- `claimFunds()` (line 734) is called by the seller after a 48-hour dispute window. The contract enforces proof-of-delivery + time lock. No admin approval needed.

**Dispute Resolution: On-Chain Ambassador Voting**
- Disputes are resolved by ambassador votes, not founder fiat. The voter whitelist is a temporary bridge, not a permanent power grab.

**Operations Treasury: Gnosis Safe Multisig**
- Not a personal wallet. This is correct practice.

**Zero Platform Fees**
- The contract takes 0% of transactions. Ambassador rewards come from a separate treasury fund. This means there is no revenue stream that looks like money transmission.

**Ambassador Rewards (Phase 2): On-Chain Auto-Distribution**
- 80/20 chain splits with circuit breakers. Once $ROOTS launches, the manual payment system is deleted entirely.

### Centralization Risks (What Doug Should Actually Worry About)

**RISK 1 (HIGH): Ambassador Cash Payments via Venmo/PayPal/Zelle**
- Component: `AmbassadorPaymentsTab.tsx` — explicitly marked `TEMPORARY - This entire component will be removed when $ROOTS token launches`
- Admin manually marks ambassadors as paid via personal payment apps
- This is the single biggest regulatory exposure in the entire system
- Creates three distinct problems:
  1. **1099-NEC reporting obligation**: If any ambassador earns >$600/year, IRS requires Form 1099-NEC. Not doing this is not optional.
  2. **Payment app flags**: Venmo/PayPal flag high-volume commercial activity. Could trigger account freezes and SAR filings.
  3. **Money transmitter ambiguity**: While the on-chain flow is clean (buyer->contract->seller), the off-chain cash payments to ambassadors could be characterized as operating a payment business.

**RISK 2 (MEDIUM): Single Relayer Wallet**
- One `RELAYER_PRIVATE_KEY` pays gas for all meta-transactions
- If compromised: attacker can drain ETH (gas funds only), cannot move user funds
- If lost: all gasless transactions stop until replaced
- Not a regulatory risk, but a single point of failure

**RISK 3 (LOW-MEDIUM): Admin Functions on Contracts**
- Can suspend sellers, cancel orders, add/remove admins
- Necessary for fraud protection at this stage
- Becomes a governance question later, not a regulatory one

**RISK 4 (LOW): Hardcoded Testnet USDC Address in Contract**
- `address public constant USDC_ADDRESS = 0x036CbD53842c5426634e7929541eC2318f3dCF7e` (line 36)
- This is the Base Sepolia test USDC. It is a `constant`, meaning it CANNOT be changed without redeploying the contract.
- This is not a risk per se, but it means mainnet deployment requires a fresh contract deploy (which was always the plan).

**RISK 5 (LOW): Domain/Hosting Centralization**
- localroots.love on Vercel DNS (US jurisdiction)
- No blockchain domain backup yet
- The CLAUDE.md already documents the migration path (Njalla, ENS, IPFS via Fleek)

---

## 2. Regulatory Exposure Analysis

### Money Transmitter Status: Probably NOT, But Don't Be Sloppy

The core marketplace is likely NOT money transmission because:
- Funds flow buyer -> smart contract -> seller. The founder's personal wallet never holds user funds.
- The contract is the escrow agent, not the founder.
- There are no platform fees (no revenue from facilitating payments).

**However**, the ambassador cash payments create ambiguity. If the IRS or FinCEN looks at the pattern — founder receives nothing on-chain, but sends cash payments to a network of people based on transaction volumes — it could be mischaracterized. The fix is simple: stop doing it (get to mainnet/$ROOTS).

### 1099-NEC Reporting: REQUIRED, NOT OPTIONAL

This is the most concrete, immediate regulatory obligation:
- If any ambassador earns >$600/year in commissions paid via Venmo/PayPal/Zelle, Doug must file Form 1099-NEC with the IRS.
- This requires collecting each ambassador's legal name, address, and SSN/EIN (Form W-9).
- Failure to file: $50-$290 penalty per form, potentially more with intentional disregard.

**Immediate action items:**
1. Determine if any ambassador has crossed or will cross the $600 threshold in 2026.
2. If yes, collect W-9 forms from those ambassadors NOW.
3. File 1099-NEC by January 31, 2027 for 2026 payments.
4. The faster $ROOTS launches and eliminates cash payments, the fewer 1099s needed.

### Seeds-to-ROOTS Airdrop: Taxable Event

When Seeds convert to $ROOTS tokens:
- Recipients owe income tax on the fair market value of $ROOTS at the time of receipt.
- Doug should document the conversion ratio and attempt to establish FMV (even if it is near-zero initially).
- Consider providing recipients with a notice explaining their potential tax obligation.
- This is standard for any token airdrop and is not unique to LocalRoots.

### Credit Card Payments: Low Risk

Handled entirely by thirdweb Pay / Stripe. The payment processor bears the compliance burden. Doug is not a party to the fiat transaction. Currently gated as testnet-only; will activate on mainnet.

---

## 3. Mainnet Migration Plan

### Current Readiness: ~40%

The contract code is solid and the deployment tooling (Foundry) supports mainnet. But there are significant configuration and safety gaps.

### Phase A: Pre-Deployment (Week 1-2) — DO THIS FIRST

**A1. Contract Preparation**
- The `USDC_ADDRESS` constant on line 36 of `LocalRootsMarketplace.sol` is hardcoded to Base Sepolia test USDC (`0x036CbD53842c5426634e7929541eC2318f3dCF7e`). For mainnet, this must be Base mainnet USDC (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`). Since it is a `constant`, this requires changing the source and redeploying.
- Decision: Make USDC address a constructor parameter instead of a constant, so future deployments are chain-agnostic. Or keep it as a constant but with the mainnet address in the mainnet deployment branch.
- Remove or gate `MockERC20.sol` — ensure it is not deployed to mainnet.

**A2. Environment Variable Audit**
- 72 files reference `baseSepolia` or chain ID `84532`. Most are in `contracts/broadcast/` (historical deploy artifacts — harmless). The critical ones are in `frontend/src/`:
  - `frontend/src/lib/wagmi.ts` — chain configuration
  - `frontend/src/lib/viemClient.ts` — RPC client
  - `frontend/src/lib/thirdweb.ts` — thirdweb chain config
  - `frontend/src/app/providers.tsx` — app-level chain setting
  - `frontend/src/components/admin/AmbassadorPaymentsTab.tsx` — hardcoded `baseSepolia` import
  - `frontend/src/hooks/useChainValidation.ts` — chain validation logic
- Create a single `chainConfig.ts` that switches based on `NEXT_PUBLIC_CHAIN=mainnet|testnet` env var. All other files import from it.

**A3. Security Hardening**
- Remove `NEXT_PUBLIC_TEST_WALLET_PRIVATE_KEY` from Vercel env vars (already on checklist in CLAUDE.md line 594)
- Generate fresh `RELAYER_PRIVATE_KEY` for mainnet (never reuse testnet keys)
- Disable `/api/faucet/route.ts` endpoint on mainnet (or gate behind env var)
- Remove test wallet connector (`frontend/src/lib/testWalletConnector.ts`) from production build

**A4. Mainnet Checklist Items from CLAUDE.md (lines 591-628)**
- The existing checklist in CLAUDE.md is thorough. Follow it. Key items:
  - Update ALL fallback addresses in 6 TypeScript files
  - Update RPC URL env var naming
  - Update BaseScan links (sepolia.basescan.org -> basescan.org)
  - Verify Privy allowed domains
  - Update The Graph subgraph URL

### Phase B: Deployment (Week 2-3)

**B1. Deploy Contracts to Base Mainnet**
- Use existing Foundry deploy scripts (they support mainnet)
- Deploy in order: Forwarder -> ROOTS Token -> Marketplace -> Ambassador Rewards -> Dispute Resolution -> Governance
- Verify all contracts on BaseScan
- Set initial admin to a dedicated admin wallet (not deployer)

**B2. Fund Relayer**
- Fund mainnet relayer wallet with ETH for gas
- Set up monitoring/alerts for low balance
- Document the relayer top-up process

**B3. Update Frontend**
- Switch all env vars to mainnet addresses
- Update fallback addresses in TypeScript files
- Deploy to Vercel staging, test thoroughly
- Enable credit card payments (thirdweb Pay works on mainnet)

### Phase C: Post-Deployment (Week 3-4)

**C1. Smoke Testing on Mainnet**
- Register a test seller, create listing, complete a purchase with real USDC
- Test gasless transactions via relayer
- Test dispute flow
- Test credit card checkout via thirdweb Pay

**C2. $ROOTS Token Launch**
- Seeds -> ROOTS conversion event
- Delete `AmbassadorPaymentsTab.tsx` and all manual payment infrastructure
- Ambassador commissions now flow on-chain automatically

---

## 4. Risk Mitigation — What to Do NOW vs What Can Wait

### DO NOW (This Week)

| Action | Why | Effort |
|--------|-----|--------|
| Audit ambassador earnings against $600 threshold | Legal obligation, penalties for non-compliance | 2 hours |
| Collect W-9 from any ambassador over $600 | Required for 1099-NEC filing | 1-2 days (waiting on people) |
| Stop using personal Venmo for payments; use business account | Reduces personal liability exposure | 1 hour |

### DO BEFORE MAINNET (Weeks 1-3)

| Action | Why | Effort |
|--------|-----|--------|
| Change USDC_ADDRESS from constant to constructor param (or mainnet constant) | Cannot deploy to mainnet without this | 2 hours |
| Create centralized `chainConfig.ts` | Eliminates scattered chain references | 4 hours |
| Remove/gate test wallet, faucet, mock tokens | Security — prevents real money loss | 2 hours |
| Generate fresh relayer key for mainnet | Never reuse testnet keys | 30 min |
| Security review of admin functions | Ensure no accidental fund exposure | 4 hours |

### CAN WAIT (Post-Launch)

| Action | Why | Effort |
|--------|-----|--------|
| Migrate domain to privacy registrar (Njalla) | Low urgency, reduces seizure risk | 2 hours |
| Set up ENS domain (localroots.eth) | Fallback access, not critical for launch | 1 hour |
| Deploy frontend to IPFS via Fleek | Censorship resistance, not day-1 need | 4 hours |
| Multiple relayer setup | Redundancy, not critical with one relayer | 1 week |
| DAO governance | Long-term decentralization, premature now | Months |

---

## 5. Timeline — Realistic Estimate

```
Week 1:  Ambassador tax audit + W-9 collection
         Contract prep (USDC address, remove mocks)
         chainConfig.ts consolidation
         Security hardening (remove test infra)

Week 2:  Deploy contracts to Base Mainnet
         Update all env vars + fallback addresses
         Fund relayer, set up monitoring
         Staging deployment + testing

Week 3:  Mainnet smoke testing
         Enable credit card payments
         $ROOTS token launch + Seeds conversion
         Delete manual ambassador payment system

Week 4:  Post-launch monitoring
         Domain migration (if desired)
         ENS setup (if desired)
```

**Total estimated effort: 2-3 weeks of focused work.**

---

## 6. The Key Insight for Doug

The architecture is genuinely good. The on-chain escrow, gasless meta-transactions, ambassador voting, and zero-fee model are all strong design choices that minimize regulatory surface area.

The existential crisis is really about ONE thing: the temporary manual cash payment system for ambassadors. This creates:
- 1099 reporting obligations
- Money transmitter ambiguity
- Personal payment app risk
- Founder liability

And the fix is already designed into the system: launch $ROOTS, and the entire manual payment layer gets deleted. The `AmbassadorPaymentsTab.tsx` component literally has a comment saying it will be removed.

**Getting to mainnet faster does not just help the product — it actively reduces regulatory risk.** Every week spent on testnet is another week of manual cash payments accumulating tax reporting obligations and regulatory ambiguity.

The priority order is clear:
1. Handle the 1099 obligation NOW (it exists regardless of mainnet timeline)
2. Get to mainnet as fast as safely possible (2-3 weeks)
3. Launch $ROOTS to kill the manual payment system
4. Everything else (domain privacy, IPFS, DAO) is improvement, not risk mitigation
