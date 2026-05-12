# LocalRoots Platform Update — May 2026

**To:** Common Area NIF engineering + content team
**From:** the LocalRoots build team
**Date:** May 12, 2026
**Subject:** Stripe Crypto Onramp migration + buyer-flow updates that affect outreach copy

---

## 1. TL;DR

- **Coinbase auto-rejected our Onramp/Offramp application on May 5 and blocked our app at their API layer.** No path to a human at Coinbase without a paid support tier.
- **We pivoted to Stripe Crypto Onramp.** Live in production behind a feature flag, currently in Stripe test mode; live mode pending Stripe approval (24–48h as of writing).
- **Buyer minimum dropped from $5 to $1**, Apple Pay / Google Pay supported, "Powered by Stripe" branding throughout. First-time buyers go through Stripe Link KYC once; repeat buys are one-tap.
- **Cash Out (USDC → bank) is temporarily disabled.** Bridge is the planned replacement but not yet integrated.
- **The "Unknown Product" listing-blanking bug on `/buy` is fixed as of today.** If NIF heard early "broken site" reports from cold targets, that's resolved.
- **Legal entity for partner docs: Common Area LLC** (Delaware, EIN 41-5376265). LocalRoots is a DBA / product line, not a separate LLC.

---

## 2. What changed since the last update

### The Coinbase → Stripe pivot (the big one)

Through April we were running credit-card buyer payments through Coinbase Onramp. In early May we were in active back-and-forth with Coinbase CDP support — they asked us to decouple onramp from checkout (shipped) and pass `clientIp` for fraud detection (shipped). On May 5, Coinbase sent an auto-rejection of our CDP application with no explanation and closed the case. Their portal disabled outbound messaging. Within hours, our app ID was blocked at their API layer — the session-token endpoint started returning HTTP 502 with `NotFound: app id ... is blocked`. Real production outage on the credit-card buyer flow.

We pivoted that night and shipped Stripe Crypto Onramp over the following week. Stripe acquired Privy in 2025, so this is now a first-party ecosystem stack: Privy embedded wallet + Stripe Crypto Onramp + USDC on Base. **Stripe is the merchant of record on the fiat-to-crypto purchase.** LocalRoots never custodies funds — same zero-liability posture as before. The food-safety liability still sits with sellers per ToS Section 6; that hasn't changed.

### Feature-flag state in production

Stripe is gated behind `NEXT_PUBLIC_USE_STRIPE_ONRAMP=true`. When that's on (it is), Buy USDC in `/wallet` and Card checkout in `/buy/checkout` route through Stripe. Coinbase code remains in the tree for rollback safety — we'll delete it after ~30 days of clean Stripe operation. Cash Out is gated separately by `NEXT_PUBLIC_COINBASE_DISABLED=true` and currently shows a "temporarily unavailable" banner.

### Fee math is provider-aware

Stripe pad: 1.5% + $0.30 flat, $1 floor. Coinbase pad (legacy): 2.5%, $5 floor. A $4.50 cart charges $4.87 via Stripe vs $5.00 via Coinbase. Smaller carts are now economically viable — a $1 bunch of basil actually works.

### "Unknown Product" bug fixed (May 12)

Before today, some listings on `/buy` were rendering as "Unknown Product." Root cause: Pinata's public IPFS gateway routinely takes 4–7 seconds to serve listing metadata, exceeding our 5-second timeout. Fixed by racing ipfs.io (~150ms) against Pinata via `Promise.any`. If NIF outreach received early "broken site" or "no products" feedback from cold targets, that's resolved as of this morning.

### Other recent build work (lower outreach impact)

- Buyer/seller flow parity audit — extracted shared address validation and listing-image resolution so the two sides can't drift again
- Roots Points rebrand (the loyalty currency formerly called "Seeds") — non-crypto-native testers were literally thinking we mailed seed packets
- Ambassador prominence pass (public `/ambassadors` directory, Chief Ambassador tier, ambassador credit visible on listings)
- Unified `/profile` page replaces scattered per-feature modals

---

## 3. Implications for outreach copy

### What to add or emphasize

- **"Pay with card, Apple Pay, or Google Pay — $1 minimum."** This is a real change from the old $5 minimum. For community-garden outreach, the small-purchase friction (one bunch of herbs, a single cucumber) is materially better now.
- **"Powered by Stripe."** Stripe is a recognized brand for our older, less-crypto-native target audience. The brand reassurance carries weight that "Coinbase Onramp" never did with this segment.
- **First-purchase KYC is real, set expectations.** First-time card buyers go through Stripe Link's identity flow once (name, DOB, address, last 4 of SSN, phone, ID photo). It's standard US fiat-to-crypto regulation, not something we can skip. The second purchase is one-tap because Stripe Link remembers them across any Stripe-powered site. Frame this honestly — "one-time setup, then it's instant" — instead of pretending it doesn't exist.

### What to soften or remove

- Any copy referencing Coinbase as the payment path — outdated. If you've shipped emails mentioning Coinbase by name, those are stale.
- Any copy that implies seamless instant onboarding for first-time buyers. The first-purchase KYC is a real step. Soft-pedal "instant" claims.

### What stays the same

- The zero-liability framing (LocalRoots is infrastructure, sellers are the food producers, smart contracts hold escrow). Stripe doesn't change any of this.
- "Neighbors Feeding Neighbors" as the brand soul, gardening-first positioning, AI gardening companion (Sage) as the front door.
- Ambassador economics (25% commission + Roots Points share).

### Legal entity note

When partner/legal docs require the merchant or counterparty name, it's **Common Area LLC (Delaware, EIN 41-5376265)**. NOT a separate LocalRoots entity. This matters for vendor onboarding forms, contract templates, and anything that references "the LocalRoots company."

---

## 4. What buyers experience now

**Crypto-native buyer** (has MetaMask, Coinbase Wallet, etc.): unchanged. They connect their external wallet on `/buy`, pay USDC directly, get goods. Cash Out is currently disabled but they can move USDC out themselves via their wallet app.

**Credit-card buyer (first-time):**

1. Browses `/buy`, adds an item to cart, hits checkout.
2. Picks "Card or Mobile Pay." A Stripe-hosted popup opens.
3. Sees "Powered by Stripe" branding and a heads-up about a quick verification step.
4. Enters card details (or Apple Pay / Google Pay).
5. Stripe Link prompts for one-time identity verification — name, DOB, address, last 4 of SSN, phone, ID photo.
6. Stripe charges the card, USDC arrives in a Privy embedded wallet tied to the buyer's email.
7. Marketplace contract pulls the cart amount; order is placed on-chain.

**Credit-card buyer (returning):**

1. Same up to the Stripe popup.
2. Stripe Link recognizes them by email/phone — one tap, no re-KYC.
3. Same settlement.

**For Doug-tracked, NIF-relevant: returning buyers benefit from Stripe Link's cross-site memory.** If a buyer already has a Stripe Link account from any other Stripe-powered site (Shopify checkouts, Robinhood, etc.), our site is one-tap from purchase one. This is a real tailwind for warm-outreach conversion that didn't exist with Coinbase.

---

## 5. Open questions / known friction

- **Cash Out is broken right now.** Coinbase's offramp was the only path; Stripe doesn't offer crypto offramp. Bridge (already plugin-enabled in Doug's Privy dashboard) is the planned replacement but not yet integrated. For non-crypto-native sellers who eventually want to convert USDC earnings to USD in their bank, this is real friction. Crypto-native sellers can move USDC themselves via wallet apps. Outreach to early sellers should set expectations: "earn now, withdraw to bank coming soon."
- **Stripe live-mode approval pending.** As of writing, we're in Stripe test mode — only Stripe test cards work. Live-mode approval is 24–48h from Stripe. Don't send card-driven outreach campaigns until live mode is confirmed.
- **First-purchase KYC drop-off risk.** US regulatory requirements make this unavoidable on the fiat-to-crypto path. Outreach copy should be honest about it. We don't have first-purchase KYC abandonment data yet — we'll get signal once live mode is in production.
- **No first-party offramp for now.** Even after Bridge ships, expect 1.5–2% fees on USDC → bank conversions. This is the cost of the regulatory regime, not something we control.

---

## 6. Asks of NIF

1. **Pause any in-flight email blasts that mention Coinbase by name.** Update copy to "Stripe" or "card / Apple Pay / Google Pay" before re-sending.
2. **Audit cold-outreach templates for stale flow descriptions.** Anything claiming "instant onboarding" for first-time buyers needs the one-time-KYC reality check baked in.
3. **For community-garden outreach in particular:** the $1 minimum is a real story. Lean on it. Small bunches of herbs, single tomatoes, single cucumbers — all viable now where they weren't before.
4. **For ambassador-recruitment outreach:** set expectations that Cash Out (seller USDC → bank) is in flight, not live. Honest framing > surprised sellers later.
5. **When in doubt about legal entity references:** Common Area LLC, not LocalRoots LLC. There is no LocalRoots LLC — by design.
6. **If you hear "the site was broken / showed no products" feedback from cold targets contacted in the last week or two:** that was the IPFS gateway timeout bug, fixed today. Worth re-engaging those targets if the dropoff was specifically site-functionality-driven.

NIF has the Collections Sync API to keep proposing gardens on its existing cadence — no changes there. The discovery → outreach pipeline you already operate is unaffected; this update is about the copy that flows through it.

Questions, edge cases, or anything that looks wrong from the NIF side — ping the LocalRoots build team. We've been moving fast on this pivot and welcome the second pair of eyes.

— from the LocalRoots build team
