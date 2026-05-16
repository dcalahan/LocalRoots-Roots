# Admin RP Monitoring Module — Strategic Plan

**Author:** planning agent
**For review by:** Doug
**Date:** May 15 2026
**Status:** APPROVED by Doug May 15 2026. All 8 open questions answered (see below). Ready for implementation when scheduled.

---

## Doug's decisions (locked May 15 2026)

Captured here as a single reference so future sessions don't re-litigate. Each answer is final unless Doug explicitly revisits.

1. **Doug's admin wallet `0x30C4343A742F922Ea8cF10e2042919C873274879` — permanent test flag from day one of Phase 2?** ✅ **YES.** Apply the test flag as the first action on day one of Phase 2 implementation. Doug stops earning RP on test traffic going forward.
2. **Verify what Privy Management API exposes (IP, fingerprint) before promising heuristics #1 and #2?** ✅ **Defer to Claude — accepting plan recommendation.** A 1-hour spike happens before Phase 3 implementation begins: pull a real `/users` response from Privy, document the fields, decide between webhook vs. client-side capture if Privy doesn't natively expose IP and fingerprint. Heuristics 3-10 ship in Phase 3 regardless; 1 and 2 ship only if the spike confirms the data path.
3. **Auto-flag suspected sybils, or always require Doug's click?** ✅ **Doug wants to BE AWARE but must click.** Heuristic engine still computes and surfaces candidates prominently in Top Earners + Clusters views with a "High risk" badge. Doug always clicks to set the flag — no automatic state changes from the heuristic output. Matches the plan's "candidates vs. users" distinction.
4. **When flagged as suspected sybil, zero out on-chain RP too, or only off-chain?** ✅ **Both.** Same flag, both pools zeroed at merkle snapshot.
5. **Sage chat content persistence for cross-user lexical similarity (heuristic #7)?** ✅ **Defer to Phase 3.5.** Other heuristics ship in Phase 3 without it. Doug decides on chat persistence after seeing false-positive rates on the cheaper signals. Privacy implications get evaluated at that point.
6. **Cron interval — 5 minutes, 1 minute, or 15 minutes?** ✅ **Plan recommendation.** 5 minutes for Phase 1. Drop to 1 minute starting Phase 2+ once Doug is actively using the surface and benefits from real-time feel.
7. **Multi-admin confirmation for high-impact flags?** ✅ **NO** for v1. Audit log is the safeguard. Revisit if non-Doug admins ever join.
8. **Public off-chain RP leaderboard, or admin-only forever?** ✅ **ADMIN ONLY** — strictly. The public `/leaderboard` stays on-chain marketplace activity only. Off-chain RP rankings live exclusively in the admin module's Top Earners view.

**No section of this plan is open for revision** without explicit Doug sign-off. Implementation proceeds against the plan as written, with the answers above baked in.

---

## TL;DR

Build a new `/admin` tab — **RP Monitor** — that surfaces all off-chain RP activity in near-real-time, lets Doug drill into individual users, flag suspected gamers, and write those flag decisions into KV where the merkle generator will read them at airdrop snapshot. Three phases (~10 working days total): read-only observability first, then admin actions, then heuristic-driven gaming detection. This module is the **UI layer** for decisions the **merkle generator** enforces at snapshot. They share data (flag records in KV) but serve different purposes.

The plan is opinionated about three things:
1. **One new tab, not a new page.** Extend the existing `/admin` dashboard rather than build a parallel surface. Doug already knows how to get there.
2. **Periodic cron-built analytics index, not live KV scans.** The naive "scan KV on every page load" approach falls over at 1000+ users. A 5-minute cron writing aggregates into `rp:admin:index:*` keys gives Doug a few-minutes-stale view that loads in 200ms.
3. **Privy metadata sync runs as a cron, not on-demand.** Cluster detection needs cross-user comparisons (signup IP collisions, fingerprint matches). On-demand fetches can't see clusters. Daily sync at 4am ET is the right cadence.

---

## 1. Information architecture

### One new tab, four sub-views

Add **RP Monitor** to the existing admin tabs (`'activity' | 'registrations' | 'orders' | 'disputes' | 'suggestions' | 'payments' | 'admins' | 'operations'` → add `'rp'`). Inside that tab, four sub-views accessed via a secondary nav row:

| Sub-view | Purpose | Phase |
|---|---|---|
| **Recent Activity** | Chronological feed of credit events across all users. Filters: time range (24h / 7d / 30d), verb (multi-select), credited-vs-rejected, user search. Default view on tab open. | Phase 1 |
| **Top Earners** | Sortable table — top N users by total off-chain RP. Columns: address, total RP, on-chain RP (from subgraph), off-chain RP, verb breakdown (mini-bar), days active, flag status, signup date. Click row → user detail. | Phase 1 |
| **User Detail** | Single-user deep dive. Header: address, totals, flag status, signup metadata (Privy). Body: full credit history (every event), daily cap utilization chart, heuristic-signal panel (Phase 3 fills these), admin action panel. Reachable from any row click anywhere in the module. | Phase 1 (read) + Phase 2 (actions) |
| **Flag Registry** | Admin-curated list of all flagged users with status (test / suspected-sybil / verified-legit / under-review), notes, who flagged when, and the decision that will be applied at merkle snapshot. CSV export. | Phase 2 |
| **Clusters** | Heuristic-detected suspicious groups. Each cluster card shows: cluster ID, member addresses, the signal that linked them (shared signup IP, etc.), aggregate RP at stake. "Investigate" → opens User Detail for each member. "Flag all as sybil" → bulk action with confirm. | Phase 3 |

### Why one tab, not a new page

The existing `/admin` flow has `useAdminStatus` already wired, polling already running, and a tab-state pattern Doug navigates from muscle memory. Building `/admin/rp` as a separate page means duplicating auth, layout, and breaking the "one place" mental model. The plan doc puts the burden on the merkle generator, but the day-to-day Doug-facing surface is one click deeper than the dashboard he already opens. Same tab, four sub-views.

### Default landing

Tab opens to **Recent Activity** (24h window) because Doug's first question is always "what's happening right now." Top Earners is the second-most-common question. The other three are investigation surfaces — reached by drilling in.

---

## 2. Data sources & ingestion strategy

### The sources we have

| Source | What it gives us | Read pattern |
|---|---|---|
| `rp:offchain:{userId}` | Per-user totals + by-verb breakdown | KV scan via `kv.keys('rp:offchain:*')` + filter |
| `rp:offchain:event:{eventId}` | Audit record per credit event (the granular truth) | KV scan via `kv.keys('rp:offchain:event:*')` |
| `rp:offchain:daily:{userId}:{verbId}:{date}` | Per-user-per-verb-per-day counts | KV scan, can derive cap-fill behavior |
| `rp:offchain:lifetime:{userId}:{verbId}` | Per-user-per-verb lifetime counts | KV scan |
| Subgraph (on-chain) | `SeedsEarned`, `SellerRegistered`, `ListingCreated`, `OrderPlaced` | GraphQL query, existing patterns in `useSeeds.ts` |
| Privy Management API | Signup date, email, phone, embedded wallet, linked accounts | REST API via `PRIVY_APP_SECRET` server-side only (pattern in `fetchPrivyUsers.ts`) |

### Recommended approach: 5-minute cron builds aggregate indexes

**Reject "live KV scan on every page load."** Reason: at 1000 users × 12 verbs × 30 days, the event-key namespace is roughly 360K keys. `KEYS rp:offchain:event:*` on Upstash is O(N) and not paginated in our wrapper. First page load works; tenth concurrent admin (or any user with `?bypass=` curiosity) DoS's the admin surface.

**Reject "rebuild on every credit event."** Reason: every `credit()` call would need to write into a denormalized index, doubling KV write pressure on the hot path. The library's existing principle is "never block the user's primary action on RP crediting" — a denormalization step at credit-time leaks that complexity into 13 surfaces.

**Accept: Vercel cron that runs every 5 minutes (Phase 1) → every 1 minute (Phase 2+).** The cron scans the KV namespace, aggregates into purpose-built indexes, and writes them under `rp:admin:*` keys with a TTL longer than the cron interval. Admin UI reads these indexes — fast, bounded, predictable.

### Proposed index keys

| Key | Shape | Built by | Used by |
|---|---|---|---|
| `rp:admin:index:recent-events` | Sorted list of last 1000 credit events, newest first | Cron | Recent Activity view |
| `rp:admin:index:top-earners` | Sorted list of top 500 users by total off-chain RP | Cron | Top Earners view |
| `rp:admin:index:user:{userId}` | Per-user enriched record (totals + recent events + cap-fill stats + on-chain RP + privy metadata) | Cron (per user) | User Detail view |
| `rp:admin:index:meta` | Cron run metadata: `{lastRunAt, durationMs, eventCount, userCount}` | Cron | Admin UI header "Last updated 2m ago" indicator |

The cron itself: new `frontend/src/app/api/admin/rp-index/route.ts` that Vercel scheduled functions hit on a schedule defined in `vercel.json`. Pattern already used by other Vercel cron routes in this codebase. Function is `runtime: 'nodejs'` (not edge — needs longer execution budget).

### Why this beats the alternatives

- **Scales to airdrop-snapshot day** when Doug will be hammering this surface. Top Earners loads from a single KV `get`, not a scan.
- **Cheap to recover** if the index gets corrupted — wipe `rp:admin:index:*`, next cron run rebuilds it from primary data.
- **Replays cleanly post-incident.** Primary data (the event audit) is never touched by the cron; the cron is purely a read-and-aggregate pass.
- **Stale data is bounded and visible.** UI shows "Last updated 2m ago" — Doug knows what he's looking at. Compare to live scans where he wouldn't know if he saw a partial view due to a stalled scan.

---

## 3. Gaming detection heuristics

Per the plan doc §5, the off-chain pool is the sybil-farm magnet. Here are the heuristics ranked by signal quality. Each gets a row in the User Detail "Heuristic signals" panel and a contribution to a composite "risk score" (0–100) shown in Top Earners.

| # | Heuristic | Detection logic | False-positive risk | Required data | Severity |
|---|---|---|---|---|---|
| 1 | **Shared signup IP cluster** | Group Privy users whose first-seen IP matches another user's first-seen IP. Cluster of size ≥3 = high signal. | College dorms, family households, shared WiFi. Mitigate by combining with #2 and #3. | Privy Management API user metadata (does Privy expose IP in `/users` response? Verify before promising — see open question 2). If not exposed via API, requires Privy webhook or pre-instrumented login capture. | High |
| 2 | **Login fingerprint match** | Privy assigns a device fingerprint per session. Multiple accounts with the same fingerprint across signups = strong signal. | Same physical device used by spouses, dev testing across accounts. | Privy Management API fingerprint field (need to verify availability — same caveat as #1). | High |
| 3 | **No on-chain activity, max off-chain** | User has zero `SeedsEarned` events on chain (no buy, no sell, no ambassador) AND >2000 RP off-chain. Strong signal of a farm-only account. | Engaged Sage user who genuinely loves the app but never transacts. This describes some of LocalRoots' target users! | Subgraph (existing) + KV `rp:offchain:{userId}` (existing) | Medium (use as a multiplier on other signals, not standalone trigger) |
| 4 | **Cap-fill pattern** | User hits the exact daily max for ≥3 distinct verbs on ≥5 distinct days. Bot-like cadence. Compute from `rp:offchain:daily:*` keys. | Highly engaged power users. Mitigate by requiring multiple verbs + multiple days. | KV daily counters (existing) | Medium |
| 5 | **Sequential rapid earning** | ≥5 credit events for the same user within 60 seconds. Bot-like rate. Compute from event timestamps. | Adding plants in a single batch (legitimately) hits this — `AddPlantsModal.tsx` adds multiple plants in one save. **This is a known false-positive vector — needs surface-aware filtering.** | KV event records (existing) | Low standalone, useful corroborating signal |
| 6 | **Photo hash collision** | Same perceptual hash for photos uploaded by different users. Phase 3 wash filter pre-req. | Two users at the same farmers market photographing the same booth. Low practical FP rate. | NEW instrumentation: pHash service on upload. Plan doc §3 calls this out as new work. | High (when present) |
| 7 | **Sage chat lexical similarity** | TF-IDF cosine similarity ≥0.85 across Sage conversations between two accounts = same human or same LLM-generated prompt set. | Two new users asking "how do I plant tomatoes" hit moderate similarity. The threshold needs tuning. | NEW instrumentation: Sage chat content stored in KV (does it currently persist beyond the stream? Need to verify — see open question 4). | Medium |
| 8 | **Verb concentration** | User earns >80% of their RP from a single verb. Suspicious if the verb has a high cap and low effort (e.g., `share-card-sent` at the max 10/day → 50 RP/day with one button press). | A user who really likes one feature. Low standalone signal. | KV `rp:offchain:{userId}` byVerb (existing) | Low |
| 9 | **Account age vs RP velocity** | Account created <7 days ago AND >1000 RP. Plausibly a farm that just launched. | Genuine power user who joined and immediately added 40 plants from their existing garden. | Privy signup date + KV total RP (both existing) | Low (mitigated by lifetime caps) |
| 10 | **Activity time clustering** | Group of accounts whose events fire within the same 10-minute windows daily. Bot-controlled farms hit this. | Friends who garden together at the same time of day. Low practical FP. | KV event timestamps (existing) | Medium |

### How they combine

The User Detail page shows each signal with a checkmark (triggered) or dash (not triggered) and a "Risk score" composite (weighted sum: high=30, med=20, low=10, max 100). Score ≥60 = badge "High risk" in Top Earners. Score ≥40 = "Elevated." Below 40 = no badge.

**Critical:** auto-flag is OFF by default. Even score 95 just surfaces the user prominently — Doug confirms before any merkle-zero-out. Per the plan doc and Doug's framing: false positives hurt trust more than false negatives.

### Instrumentation gaps to close in Phase 3

- **Photo pHash service** — already in the CLAUDE.md Phase 3 list. New endpoint hashes on upload, stores `hash → [userId, photoId]` mapping. Heuristic #6 queries this.
- **Sage chat persistence for similarity** — verify if `garden-ai` route persists full message bodies. If not, add KV write of `sage:msg:{userId}:{messageId}` with bounded retention. Privacy-sensitive — see open question 4.
- **Privy IP / fingerprint** — confirm what the Management API actually exposes. If gaps, add a Privy webhook endpoint that captures login events into KV `privy:login:{userId}:{loginId}` with IP/fingerprint.

---

## 4. Admin actions & flag storage

### Action vocabulary (Phase 2)

Per flagged user, six action verbs:

| Action | What it does | Effect at merkle snapshot |
|---|---|---|
| **Mark as test account** | Adds user to `internal_test` set (same set CLAUDE.md line 1876 already plans for Doug's wallets) | Zero out all RP, both on-chain and off-chain |
| **Mark as suspected sybil** | Sets flag status = `suspected_sybil` with required note | Zero out off-chain RP. On-chain RP also zeroed (separate decision — see open question 5) |
| **Mark as verified legit** | Sets flag status = `verified_legit` | Excluded from heuristic re-flagging. Heuristics still computed but Top Earners shows a green checkmark |
| **Manual RP adjustment** | Subtract or add specific amount with required audit note | The adjustment is recorded at `rp:admin:adjustment:{userId}:{adjustmentId}`. Merkle reads off-chain RP + sum of adjustments |
| **Zero out specific verb** | Subtract all RP from one verb (e.g., remove all `share-card-sent` but keep `plant-added`) | Verb-level subtraction recorded as a structured adjustment |
| **Suspend earning** | Sets `rp:admin:suspended:{userId}` flag. The `credit()` function in `offchainRP.ts` checks this flag and short-circuits as `not-live` | Stops future credits going forward. Past credits unchanged unless adjusted separately |

### Flag storage shape

Single KV key per user:

```
rp:admin:flag:{userId}  →  {
  status: 'test' | 'suspected_sybil' | 'verified_legit' | 'under_review' | 'suspended',
  setBy: '0x...',          // admin's address
  setAt: ISO timestamp,
  reason: string,          // required free-text note
  adjustments?: [
    { id, type: 'add'|'subtract'|'zero-verb', amount?, verbId?, note, setBy, setAt }
  ],
  history: [               // append-only audit trail of every state change
    { previousStatus, newStatus, by, at, reason }
  ]
}
```

### Audit log (separate from flag records)

Every admin action also writes to a global append-only log:

```
rp:admin:audit:{ISO timestamp}:{actionId}  →  {
  actionType, targetUserId, performedBy, payload, timestamp
}
```

Reason for separation: the per-user flag record is the current state; the audit log is the immutable history of every action across every user. The latter is needed if Doug ever wants to publish a transparency report ("X accounts flagged before snapshot, Y reversed on appeal, Z confirmed sybil"). Auditable, separate from the working state.

### Re-flagging guardrails

If a user is `verified_legit`, the heuristic engine still computes signals but the User Detail page shows a banner: "This user has been verified — heuristic signals are informational only." Avoids the trap where Doug verifies a user, two weeks later they hit a new heuristic, and Doug re-flags them because he forgot.

If a user is `suspected_sybil` or `test`, they can be reset to `under_review` (which doesn't zero them out at merkle) with a note. Three statuses-of-record: `none`, `verified_legit`, `<flagged>` where `<flagged>` ∈ {`test`, `suspected_sybil`, `suspended`}.

---

## 5. Privy integration

### Recommended: server-side cron sync, daily 4am ET

Build `frontend/src/app/api/admin/privy-sync/route.ts` as a Vercel cron route (`vercel.json`: `"crons": [{ "path": "/api/admin/privy-sync", "schedule": "0 8 * * *" }]` — 8 UTC = 4 ET). On run:

1. Fetch all Privy users via `auth.privy.io/api/v1/users` (existing pattern in `fetchPrivyUsers.ts`).
2. For each, extract embedded wallet, email, phone, signup date, linked accounts.
3. Store at `privy:user-meta:{userId}` with `{ embeddedWallet, email, phone, createdAt, linkedAccounts, lastSyncedAt }`.
4. Build cross-reference indexes: `privy:by-email:{emailHash} → [userId, ...]`, `privy:by-wallet:{address} → userId`.

### Why cron, not on-demand

- **Cluster detection needs cross-user comparison.** "Find all users with the same signup IP" requires already having every user's signup IP in a queryable form. On-demand can't answer this.
- **Privy rate limits.** Their REST API isn't strictly published with limits, but pagination + 100 users/page + bursty admin clicks would slam it. One nightly batch is friendlier.
- **Cache lifetime matches data churn.** Signup IP doesn't change after signup. Email rarely changes. Linked accounts change occasionally. Daily refresh is plenty.

### Caveat to verify first (open question 2 in §9)

Inspect a real Privy `/users` response to confirm what fields are actually exposed. The `LinkedAccount` interface in `fetchPrivyUsers.ts` has no IP or fingerprint field today. If Privy's API doesn't surface those:
- **Plan B:** add a Privy webhook (`privy.io/dashboard → webhooks`) that fires on `user.created` and `user.session.started`. Endpoint at `/api/admin/privy-webhook` captures IP and fingerprint from the webhook payload. Store at `privy:login:{userId}:{loginId}`.
- **Plan C:** instrument client-side at login (Privy SDK gives us session info on the React side). Fire-and-forget POST to `/api/admin/privy-login-capture` with the session data. Less clean — client can lie — but works without webhook setup.

Until this is confirmed, heuristics #1 and #2 (IP and fingerprint clusters) are **not implementable**. Heuristics #3–#10 work with data we already have. Recommend Phase 1 + Phase 2 ship without #1/#2 and unblock those in Phase 3 once Privy data path is sorted.

---

## 6. UX principles

### Single-admin v1, multi-admin ready

The `isAdmin` check is already plural on the contract (`addAdmin(address)` supports any number). The new tab doesn't need any single-admin assumptions in its data model — every flag record stores `setBy` so multi-admin attribution works from day one. No multi-admin confirmation flow needed for v1.

### No auto-flagging

Per plan doc §4 and Doug's framing: always present for review. The cron computes heuristic signals and updates the risk score, but the user's flag status only changes via an explicit admin click. The system flags **candidates**, the admin flags **users**.

### Audit log always-on

Every admin action writes to `rp:admin:audit:*`. Doug can scroll the audit log under a separate sub-view in Phase 2 (or just CSV-export it). Defends against the "did Doug really flag X?" question and gives a transparency-report substrate.

### Off-chain RP stays private

The plan doc §3 footnote already says: don't extend the public `/leaderboard` to include off-chain RP — it would invite gaming. Top Earners in the admin module is the **only** ranked view of off-chain RP. Public users see their own RP on `/profile` and the global on-chain leaderboard at `/leaderboard`. The admin module's Top Earners is admin-only.

### "Last updated" indicator

Every view shows "Last updated 2m ago" sourced from `rp:admin:index:meta`. Doug knows when he's looking at stale data. A "Refresh now" button triggers `/api/admin/rp-index?force=true` for impatient moments — protected against thundering herd by a 30-second debounce.

---

## 7. Implementation sequencing

### Phase 1 — Read-only observability (~3–4 days)

**Goal:** Doug sees what's happening. No actions. He uses this to develop intuition about what gaming looks like in the real off-chain RP system before deciding what to do about it.

**Scope:**
- New tab `'rp'` in `/admin/page.tsx`.
- New cron route `/api/admin/rp-index` (every 5 min) that scans KV and builds aggregate indexes.
- New cron route entry in `vercel.json`.
- New component `frontend/src/components/admin/RPMonitorTab.tsx` with sub-nav (Recent Activity, Top Earners, User Detail).
- New API routes (admin-gated, server-side `isAdmin` check):
  - `/api/admin/rp/recent` — paginated recent events.
  - `/api/admin/rp/top-earners` — paginated top earners list.
  - `/api/admin/rp/user/[userId]` — single user detail with credit history.
- Subgraph integration for the User Detail "on-chain RP" panel (reuse `useSeeds.ts` patterns).
- "Last updated" indicator across all sub-views.

**Verification gate:** Doug loads the tab, sees a list of actual recent credit events from prod. Clicks his own address in Top Earners (he should be #1 from test traffic). Sees his full credit history. Sees zero crashes, zero N+1 KV scans. Sub-100ms load on every sub-view. Doug signs off.

**Critical files:**
- `frontend/src/app/admin/page.tsx` (add tab)
- `frontend/src/components/admin/RPMonitorTab.tsx` (new)
- `frontend/src/app/api/admin/rp-index/route.ts` (new cron)
- `frontend/src/app/api/admin/rp/recent/route.ts` (new)
- `frontend/src/app/api/admin/rp/top-earners/route.ts` (new)
- `frontend/src/app/api/admin/rp/user/[userId]/route.ts` (new)
- `frontend/src/lib/adminRPIndex.ts` (new — shared index-building helpers)
- `vercel.json` (add cron schedule)

### Phase 2 — Admin actions + Privy metadata sync (~3–4 days)

**Goal:** Doug can act on what he sees. Flags, adjustments, suspensions all persist into KV in a shape the merkle generator will consume.

**Scope:**
- Action panel inside User Detail (flag/unflag, mark test, mark sybil, mark legit, manual adjustment, zero verb, suspend earning).
- New Flag Registry sub-view with all flagged users + CSV export.
- Audit log infrastructure (`rp:admin:audit:*` keys).
- Hook `credit()` in `offchainRP.ts` to check `rp:admin:suspended:{userId}` and short-circuit when suspended.
- New cron route `/api/admin/privy-sync` (daily 4am ET) that pulls Privy user metadata into KV.
- New API routes:
  - `/api/admin/rp/flag/[userId]` POST — set flag status.
  - `/api/admin/rp/adjust/[userId]` POST — record manual adjustment.
  - `/api/admin/rp/audit-log` GET — paginated audit log.
- Update `scripts/distribution/calculateAllocations.ts` to read `rp:admin:flag:*` and apply the documented effects at merkle generation. (Per plan doc §3.4, this is where the off-chain wash filter already lives — extend it to consume admin flag records.)

**Verification gate:** Doug flags one of his own test wallets as `test`. Runs the merkle dry-run script. Confirms the wallet shows up in the zeroed-out set with the reason `admin_flag:test`. Reverses the flag, re-runs, sees the wallet back in the eligible set. Doug signs off.

**Critical files:**
- `frontend/src/components/admin/RPMonitorTab.tsx` (extend with action panel)
- `frontend/src/lib/offchainRP.ts` (add suspended-user short-circuit in `credit()`)
- `frontend/src/app/api/admin/rp/flag/[userId]/route.ts` (new)
- `frontend/src/app/api/admin/privy-sync/route.ts` (new cron)
- `scripts/distribution/calculateAllocations.ts` (read admin flags during merkle build)

### Phase 3 — Heuristic detection + cluster surfacing (~3–5 days)

**Goal:** the cron surfaces candidates worth Doug's attention without him having to spelunk Top Earners by hand. Cluster analysis groups suspicious accounts.

**Scope:**
- Heuristic engine module `frontend/src/lib/rpHeuristics.ts`. Each heuristic is a pure function `(user, allUsers, kvSnapshot) → SignalResult`. Engine runs all of them and emits a composite risk score.
- Extend the 5-min cron (or move to 15-min if heuristics make it heavy) to compute heuristic results per user and store at `rp:admin:heuristics:{userId}`.
- New Clusters sub-view that groups users by shared signal (signup IP cluster, fingerprint cluster).
- Risk-score badges in Top Earners.
- New API routes:
  - `/api/admin/rp/heuristics/[userId]` GET — per-user signals.
  - `/api/admin/rp/clusters` GET — cluster list.
- Photo pHash service (new endpoint hashes on upload, populates `photo:phash:{hash}` → `[userId, photoId]`).
- CSV export of top 100 RP earners (the plan doc's pre-snapshot deliverable).
- (Maybe) Sage chat similarity precompute — depends on open question 4.

**Verification gate:** Doug creates two test Privy accounts from the same browser/IP. Both add a plant. Cluster view groups them within one cron run. He flags both as sybil. Re-runs merkle dry-run, confirms both zero'd out. Doug signs off.

**Critical files:**
- `frontend/src/lib/rpHeuristics.ts` (new)
- `frontend/src/components/admin/RPMonitorTab.tsx` (extend with Clusters sub-view + risk-score badges)
- `frontend/src/app/api/admin/rp-index/route.ts` (extend cron to compute heuristics)
- `frontend/src/app/api/admin/rp/clusters/route.ts` (new)

---

## 8. Hook-in with the existing wash-filter / merkle work

### Two systems, one shared data contract

| System | Where | When it runs | Responsibility |
|---|---|---|---|
| **Admin RP Monitor** | `/admin` tab + new API routes + new cron | Continuously (every 5 min) + on every admin click | UI for observability and decision-making. Writes flag records to KV. |
| **Merkle generator wash filter** | `scripts/distribution/calculateAllocations.ts` | Once, at airdrop snapshot | Reads on-chain + off-chain RP, applies wash filter logic, reads admin flag records from KV, produces final merkle tree. |

They share the data contract: the keys at `rp:admin:flag:*`, `rp:admin:suspended:*`, and `internal_test` set. The admin module writes those records continuously; the merkle generator reads them once at snapshot.

### Explicit non-overlap

- The admin module does **NOT** compute final airdrop allocations. That's the merkle generator's job.
- The merkle generator does **NOT** compute heuristics in real-time. That's the admin cron's job.
- The merkle generator does **NOT** make flag decisions. It enforces decisions Doug already made (via the admin UI) before snapshot.

This separation matters because the merkle generator is a one-shot, audit-ready, open-source script (per plan doc §3.4). Embedding live KV-scan heuristic computation inside it would (a) make the script slow, (b) make it non-deterministic across runs (a heuristic that flags X today might not tomorrow), and (c) couple it to admin-UI iteration cycles. Better: the script reads the flag table as static input.

### What the merkle generator needs to add

The Phase 3 wash-filter work documented in CLAUDE.md line 1869 already touches `calculateAllocations.ts`. As part of Phase 2 of this admin module, that script needs three additions:

1. Read `rp:offchain:{userId}` for every Privy wallet (already in plan doc §3.4 — recompute).
2. Read `rp:admin:flag:{userId}` for every Privy wallet. Apply per-flag effect (zero-out, adjust, etc.).
3. Read `rp:admin:audit:*` for the pre-snapshot transparency export (the "here's why each user was flagged" CSV).

The CLAUDE.md plan to flag Doug's admin wallet `0x30C4343A742F922Ea8cF10e2042919C873274879` as `internal_test = true` is unified into the same flag-record schema: that wallet just gets `rp:admin:flag:0x30c4... → { status: 'test', setAt: ..., setBy: '...', reason: 'founder test wallet' }` set by Doug himself on day one of Phase 2.

---

## 9. Open architectural questions for Doug

Yes/no decisions Doug should make before implementation starts:

1. **Auto-flag suspected sybils based on risk-score threshold, or always require Doug's click?**
   - Recommendation: **always click**. Plan doc §4 already says this. False positives hurt trust.

2. **Verify what Privy Management API actually exposes (IP, fingerprint) before promising heuristics #1 and #2?**
   - Recommendation: **block Phase 3 on a 1-hour spike** — pull an actual `/users` response, document the fields, decide between webhook vs client-side capture if needed. The other heuristics can ship without this.

3. **"Mark as test" feature: should Doug's own admin wallet `0x30C4343A742F922Ea8cF10e2042919C873274879` get a permanent test flag, or just zero-out at snapshot?**
   - Recommendation: **permanent test flag, day one of Phase 2**. Same mechanism, fewer special cases. Doug stops earning RP on test traffic going forward.

4. **Sage chat content: do we persist message bodies to KV for cross-user similarity detection, or skip heuristic #7 to preserve user privacy?**
   - Recommendation: **defer to Phase 3.5**. Persistence has privacy implications. Phase 3 can ship the other 9 heuristics without it; Doug decides on chat persistence after seeing the false-positive rate on the cheaper heuristics.

5. **When a user is flagged `suspected_sybil`, zero out their on-chain RP too, or only off-chain?**
   - Recommendation: **zero both**, because on-chain RP from a sybil account is just farmed wash trades. Plan doc §3.4 already does this implicitly with the existing on-chain wash filter. Make it explicit: same flag, both pools zeroed.

6. **Public "top RP earners" leaderboard — extend the existing public `/leaderboard` to include off-chain RP (admin-only via flag), or strictly admin-only forever?**
   - Recommendation: **admin-only forever**. Plan doc §3 already locks this in.

7. **Multi-admin confirmation for high-impact flags (e.g., zero-out >5000 RP)?**
   - Recommendation: **no for v1**, audit log is the safeguard. Revisit if Doug ever adds non-Doug admins.

8. **Cron interval: 5 minutes (responsive) vs 1 minute (real-time-ish) vs 15 minutes (cheap)?**
   - Recommendation: **5 min for Phase 1, drop to 1 min for Phases 2–3** once Doug is actively using the surface. Vercel cron min interval is 1 min on Pro plan.

---

## What this plan is NOT

- Not implementation. No code is being written until Doug reviews this.
- Not promising launch dates. Phase 1 is ~3–4 days of focused work; total ~10 days. Real wall-clock depends on what else is in flight.
- Not changing on-chain contracts. The marketplace and ambassador contracts stay immutable.
- Not redesigning the existing `/admin` dashboard. One new tab, no changes to existing tabs.
- Not duplicating the Phase 3 wash-filter design from `roots-points-expansion-plan.md`. This module is the **UI layer** for decisions the merkle generator enforces at snapshot. They share data, not logic.

---

### Critical Files for Implementation

- `frontend/src/app/admin/page.tsx`
- `frontend/src/lib/offchainRP.ts`
- `frontend/src/lib/kv.ts`
- `scripts/distribution/calculateAllocations.ts`
- `scripts/distribution/fetchPrivyUsers.ts`
