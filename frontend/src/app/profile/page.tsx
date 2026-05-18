'use client';

/**
 * /profile — unified profile page.
 *
 * Single source of truth for everything users edit about themselves.
 * Sections render conditionally based on what the user is registered as:
 *
 *   1. Identity         — Privy email + wallet (read-only)
 *   2. Gardener         — display name, bio, photos, location (public garden profile)
 *   3. Seller           — only if isSeller. Pickup/delivery, delivery radius,
 *                         private pickup address. Storefront name/photo/bio
 *                         are INHERITED from the gardener profile, not edited
 *                         separately. Save uploads metadata-derived-from-gardener
 *                         + flips on-chain seller settings + saves private
 *                         pickup info to KV.
 *   4. Ambassador       — only if isAmbassador. Cash payment preferences
 *                         (Venmo/PayPal/Zelle). TEMPORARY — removed at
 *                         $ROOTS launch.
 *   5. Buyer            — saved delivery addresses (placeholder for now).
 *
 * URL scrolls to ?section=X on load (e.g. /profile?section=seller).
 *
 * Replaces the old EditSellerProfileModal popup-on-dashboard pattern.
 */

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { usePrivy } from '@privy-io/react-auth';
import { useSignMessage } from 'wagmi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useUserPreferences } from '@/contexts/UserPreferencesContext';
import { fromKm, toKm, getUnitLabel } from '@/lib/distance';
import { uploadMetadata, getIpfsUrl } from '@/lib/pinata';
import { usePublicGardenProfile } from '@/hooks/usePublicGardenProfile';
import { useSellerStatus } from '@/hooks/useSellerStatus';
import { useSellerProfile } from '@/hooks/useSellerProfile';
import { useUpdateSeller } from '@/hooks/useUpdateSeller';
import { useAmbassadorStatus } from '@/hooks/useAmbassadorStatus';
import { useAmbassadorProfile } from '@/hooks/useAmbassadorProfile';
import { useUpdateAmbassadorProfile } from '@/hooks/useUpdateAmbassadorProfile';
import { savePickup, fetchOwnPickup } from '@/lib/sellerPickup';
import { saveDelivery, fetchOwnDelivery } from '@/lib/buyerDelivery';
import { validateAddress } from '@/lib/addressValidation';
import { PublicGardenSettings } from '@/components/grow/PublicGardenSettings';
import { useOffchainRP } from '@/hooks/useOffchainRP';
import { VERBS, type VerbId } from '@/lib/offchainRP';
import type { AmbassadorProfile } from '@/lib/contracts/ambassador';

type SectionId = 'identity' | 'roots-points' | 'gardener' | 'seller' | 'ambassador' | 'buyer';

export default function ProfilePage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-2xl mx-auto px-4 py-16 text-center text-roots-gray">
          Loading…
        </div>
      }
    >
      <ProfilePageInner />
    </Suspense>
  );
}

function ProfilePageInner() {
  const searchParams = useSearchParams();
  const { authenticated, ready: privyReady, user: privyUser, login } = usePrivy();

  // Scroll to ?section=X on load
  const sectionParam = searchParams.get('section') as SectionId | null;
  useEffect(() => {
    if (!sectionParam) return;
    // Wait a tick for sections to mount
    const t = setTimeout(() => {
      const el = document.getElementById(`section-${sectionParam}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 250);
    return () => clearTimeout(t);
  }, [sectionParam]);

  // ── Auth gate ─────────────────────────────────────────────────────────
  if (privyReady && !authenticated) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <h1 className="font-heading text-3xl font-bold mb-3">Your profile</h1>
        <p className="text-roots-gray mb-6">
          Sign in to manage your gardener, seller, and ambassador info.
        </p>
        <Button onClick={() => login()} className="bg-roots-primary hover:bg-roots-primary/90">
          Sign in
        </Button>
      </div>
    );
  }

  if (!privyReady) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center text-roots-gray">
        Loading…
      </div>
    );
  }

  const userId = privyUser?.id || null;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
      <header className="space-y-1">
        <h1 className="font-heading text-3xl font-bold">Your profile</h1>
        <p className="text-roots-gray text-sm">
          One place for everything about you on LocalRoots — gardener, seller,
          ambassador, buyer.
        </p>
      </header>

      <SectionNav highlight={sectionParam} />

      <IdentitySection />
      <RootsPointsSection userId={userId} highlight={sectionParam === 'roots-points'} />
      <GardenerSection userId={userId} highlight={sectionParam === 'gardener'} />
      <SellerSection highlight={sectionParam === 'seller'} />
      <AmbassadorSection highlight={sectionParam === 'ambassador'} />
      <BuyerSection highlight={sectionParam === 'buyer'} />
    </div>
  );
}

// ─── Section nav (top of page) ──────────────────────────────────────────────

function SectionNav({ highlight }: { highlight: SectionId | null }) {
  const links: { id: SectionId; label: string }[] = [
    { id: 'identity', label: 'Identity' },
    { id: 'roots-points', label: 'Roots Points' },
    { id: 'gardener', label: 'Gardener' },
    { id: 'seller', label: 'Seller' },
    { id: 'ambassador', label: 'Ambassador' },
    { id: 'buyer', label: 'Buyer' },
  ];
  return (
    <nav className="flex flex-wrap gap-2 text-sm">
      {links.map((l) => (
        <a
          key={l.id}
          href={`#section-${l.id}`}
          className={`px-3 py-1 rounded-full border transition-colors ${
            highlight === l.id
              ? 'border-roots-primary bg-roots-primary/10 text-roots-primary'
              : 'border-gray-200 text-roots-gray hover:border-roots-secondary/50 hover:text-roots-secondary'
          }`}
        >
          {l.label}
        </a>
      ))}
    </nav>
  );
}

// ─── Section shell ──────────────────────────────────────────────────────────

function SectionShell({
  id,
  title,
  description,
  highlight,
  children,
}: {
  id: SectionId;
  title: string;
  description?: string;
  highlight?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      id={`section-${id}`}
      className={`rounded-2xl border bg-white p-6 transition-shadow ${
        highlight ? 'border-roots-primary shadow-md' : 'border-gray-200'
      }`}
    >
      <div className="mb-4">
        <h2 className="font-heading text-xl font-bold">{title}</h2>
        {description && (
          <p className="text-roots-gray text-sm mt-1">{description}</p>
        )}
      </div>
      {children}
    </section>
  );
}

// ─── 1. Identity ────────────────────────────────────────────────────────────

function IdentitySection() {
  const { user } = usePrivy();

  const email = user?.email?.address || user?.google?.email;
  const phone = user?.phone?.number;
  const wallet = user?.wallet?.address;

  return (
    <SectionShell
      id="identity"
      title="Identity"
      description="How you signed in. Manage login methods through the wallet menu."
    >
      <dl className="space-y-2 text-sm">
        {email && (
          <div className="flex justify-between gap-4">
            <dt className="text-roots-gray">Email</dt>
            <dd className="font-medium">{email}</dd>
          </div>
        )}
        {phone && (
          <div className="flex justify-between gap-4">
            <dt className="text-roots-gray">Phone</dt>
            <dd className="font-medium">{phone}</dd>
          </div>
        )}
        {wallet && (
          <div className="flex justify-between gap-4">
            <dt className="text-roots-gray">Wallet</dt>
            <dd className="font-mono text-xs">{wallet.slice(0, 6)}…{wallet.slice(-4)}</dd>
          </div>
        )}
      </dl>
    </SectionShell>
  );
}

// ─── 1b. Roots Points (off-chain earning summary) ───────────────────────────

/**
 * Read-only summary of the user's off-chain Roots Points. The on-chain RP
 * (from marketplace sales, purchases, ambassador chain commissions) is NOT
 * shown here — that lives on the existing /leaderboard surface and seller
 * dashboard. This section is specifically for engagement-based RP that
 * doesn't have an on-chain source: garden tracking, photos, Sage chat
 * (Phase 2+), etc.
 *
 * Doug's call (May 12 2026): off-chain RP visibility is private to the user.
 * Public ranking stays the existing on-chain leaderboard. So this section
 * never exposes other users' totals.
 */
function RootsPointsSection({
  userId,
  highlight,
}: {
  userId: string | null;
  highlight: boolean;
}) {
  const { total, byVerb, todayByVerb, isLoading } = useOffchainRP(userId);

  // Show all verbs that have ever been earned, sorted by descending RP.
  // Verbs the user has never earned are not shown — that would clutter the
  // page with 13 rows of "0 RP" and make the live ones harder to find.
  const earnedRows = (Object.entries(byVerb) as [VerbId, { rp: number; count: number; lastEarnedAt: string }][])
    .filter(([, row]) => row && row.rp > 0)
    .sort((a, b) => b[1].rp - a[1].rp);

  // "Today's Earnings" sub-panel (May 17 cap-confusion fix). Renders only
  // when at least one verb has earned today. Shows count + RP earned;
  // deliberately does NOT show caps (anti-gaming) so users see what they
  // DID earn rather than what they have left.
  const todayRows = (Object.entries(todayByVerb) as [VerbId, { count: number; rp: number }][])
    .filter(([, row]) => row && row.rp > 0)
    .sort((a, b) => b[1].rp - a[1].rp);
  const todayTotal = todayRows.reduce((sum, [, row]) => sum + row.rp, 0);

  return (
    <SectionShell
      id="roots-points"
      title="Your Roots Points"
      description="Loyalty rewards you earn through gardening, sharing, and using the app. They convert to $ROOTS when the token launches."
      highlight={highlight}
    >
      <div className="space-y-4">
        {/* Today's earnings — only renders when something earned today */}
        {todayRows.length > 0 && (
          <div className="bg-roots-secondary/5 border border-roots-secondary/20 rounded-lg p-3">
            <div className="flex items-baseline justify-between mb-2">
              <h4 className="text-sm font-semibold text-roots-secondary">Today</h4>
              <span className="text-sm font-bold text-roots-secondary">
                {todayTotal.toLocaleString()} RP
              </span>
            </div>
            <dl className="space-y-1 text-sm">
              {todayRows.map(([verbId, row]) => {
                const verbLabel = VERBS[verbId]?.label ?? verbId;
                return (
                  <div key={verbId} className="flex justify-between gap-4">
                    <dt className="text-roots-gray">
                      {verbLabel}{' '}
                      <span className="text-xs text-roots-gray/70">× {row.count}</span>
                    </dt>
                    <dd className="font-medium text-roots-gray">
                      {row.rp.toLocaleString()} RP
                    </dd>
                  </div>
                );
              })}
            </dl>
          </div>
        )}

        {/* Total (all-time) */}
        <div className="flex items-baseline justify-between border-b border-gray-100 pb-4">
          <span className="text-sm text-roots-gray">Total Roots Points</span>
          <span className="font-heading text-3xl font-bold text-roots-secondary">
            {isLoading ? '…' : total.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </span>
        </div>

        {/* All-time per-verb breakdown */}
        {earnedRows.length > 0 ? (
          <dl className="space-y-2 text-sm">
            {earnedRows.map(([verbId, row]) => {
              const verbLabel = VERBS[verbId]?.label ?? verbId;
              return (
                <div key={verbId} className="flex justify-between gap-4">
                  <dt className="text-roots-gray">
                    {verbLabel}{' '}
                    <span className="text-xs text-roots-gray/70">× {row.count}</span>
                  </dt>
                  <dd className="font-medium">
                    {row.rp.toLocaleString()} RP
                  </dd>
                </div>
              );
            })}
          </dl>
        ) : (
          <p className="text-sm text-roots-gray">
            Add a plant to your garden to start earning Roots Points.
          </p>
        )}

        <div className="text-xs text-roots-gray pt-2 border-t border-gray-100">
          <Link
            href="/about/tokenomics"
            className="text-roots-secondary hover:underline"
          >
            What do Roots Points become? →
          </Link>
        </div>
      </div>
    </SectionShell>
  );
}

// ─── 2. Gardener (public garden profile) ────────────────────────────────────

function GardenerSection({ userId, highlight }: { userId: string | null; highlight: boolean }) {
  return (
    <SectionShell
      id="gardener"
      title="Gardener"
      description="Your public garden profile. This is the source name, photo, and bio for everything else — your seller storefront and ambassador profile inherit these."
      highlight={highlight}
    >
      {userId ? (
        <PublicGardenSettings userId={userId} />
      ) : (
        <p className="text-sm text-roots-gray">Sign in to set up your gardener profile.</p>
      )}
    </SectionShell>
  );
}

// ─── 3. Seller ──────────────────────────────────────────────────────────────

function SellerSection({ highlight }: { highlight: boolean }) {
  const { isSeller, isLoading: isLoadingStatus } = useSellerStatus();
  const { profile, isLoading: isLoadingProfile, refetch } = useSellerProfile();
  const { user: privyUser } = usePrivy();
  const userId = privyUser?.id || null;
  const { profile: gardenProfile } = usePublicGardenProfile(userId);
  const { updateSeller, isPending: isUpdating, isSuccess, error, reset } = useUpdateSeller();
  const { signMessageAsync } = useSignMessage();
  const { toast } = useToast();
  const { preferences } = useUserPreferences();
  const distanceUnit = preferences.distanceUnit;

  // Editable seller-specific fields (NOT name/bio/photo — those come from gardener)
  const [offersPickup, setOffersPickup] = useState(false);
  const [offersDelivery, setOffersDelivery] = useState(false);
  const [deliveryRadius, setDeliveryRadius] = useState(10);
  const [pickupAddress, setPickupAddress] = useState('');
  const [pickupPhone, setPickupPhone] = useState('');
  const [pickupLoaded, setPickupLoaded] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate form from on-chain profile
  useEffect(() => {
    if (!profile || hydrated) return;
    setOffersPickup(profile.offersPickup);
    setOffersDelivery(profile.offersDelivery);
    setDeliveryRadius(Math.round(fromKm(profile.deliveryRadiusKm, distanceUnit)));
    setHydrated(true);
  }, [profile, hydrated, distanceUnit]);

  useEffect(() => {
    if (isSuccess) {
      toast({ title: 'Seller settings saved' });
      refetch();
      reset();
    }
  }, [isSuccess, toast, refetch, reset]);

  useEffect(() => {
    if (error) {
      toast({
        title: 'Save failed',
        description: error.message || 'Try again.',
        variant: 'destructive',
      });
    }
  }, [error, toast]);

  if (isLoadingStatus || isLoadingProfile) {
    return (
      <SectionShell id="seller" title="Seller" highlight={highlight}>
        <p className="text-sm text-roots-gray">Loading seller info…</p>
      </SectionShell>
    );
  }

  if (!isSeller || !profile) {
    return (
      <SectionShell
        id="seller"
        title="Seller"
        description="You're not registered as a seller yet."
        highlight={highlight}
      >
        <Link href="/sell/register">
          <Button className="bg-roots-primary hover:bg-roots-primary/90">
            Become a seller
          </Button>
        </Link>
      </SectionShell>
    );
  }

  // Derived fields from gardener profile (single source of truth for display)
  const storefrontName = gardenProfile?.displayName || profile.metadata?.name || '';
  const storefrontBio = gardenProfile?.bio || profile.metadata?.description || '';
  const storefrontPhotoIpfs =
    gardenProfile?.gardenPhotoIpfs ||
    gardenProfile?.profilePhotoIpfs ||
    profile.metadata?.imageUrl ||
    null;
  const photoUrl = storefrontPhotoIpfs ? resolveImageUrl(storefrontPhotoIpfs) : null;

  const missingGardener =
    !gardenProfile || gardenProfile.hidden || !gardenProfile.displayName;

  // Load private pickup address (signature-gated — only on demand)
  const loadPickup = async () => {
    setPickupLoaded(true);
    const result = await fetchOwnPickup({
      signMessage: (msg) => signMessageAsync({ message: msg }) as Promise<`0x${string}`>,
    });
    if (result) {
      setPickupAddress(result.address || '');
      setPickupPhone(result.phone || '');
    }
  };

  const handleSave = async () => {
    // Validate pickup address before any IPFS / chain work — same rules
    // as buyer delivery + seller registration. Doug's principle (Apr 28
    // 2026): address validation must be consistent across surfaces.
    if (offersPickup) {
      const addressCheck = validateAddress(pickupAddress, true);
      if (!addressCheck.ok) {
        toast({
          title: 'Pickup address looks incomplete',
          description: addressCheck.error || 'Add street, city, state, ZIP.',
          variant: 'destructive',
        });
        return;
      }
    }

    try {
      // Build metadata from GARDENER fields (single source of truth)
      const metadata = {
        name: storefrontName,
        description: storefrontBio,
        imageUrl: storefrontPhotoIpfs,
      };

      toast({ title: 'Saving profile…', description: 'Uploading to IPFS' });
      const metadataResult = await uploadMetadata(metadata, `profile-${Date.now()}.json`);
      const storefrontIpfs = `ipfs://${metadataResult.ipfsHash}`;

      const deliveryRadiusKm = Math.round(toKm(deliveryRadius, distanceUnit));

      toast({ title: 'Confirming on-chain…', description: 'Please confirm the transaction' });
      await updateSeller({
        storefrontIpfs,
        offersDelivery,
        offersPickup,
        deliveryRadiusKm,
        active: profile.active,
      });

      // Save private pickup info if user offers pickup AND filled it in
      if (offersPickup && pickupAddress.trim()) {
        const pickupResult = await savePickup({
          address: pickupAddress.trim(),
          phone: pickupPhone.trim() || undefined,
          signMessage: (msg) => signMessageAsync({ message: msg }) as Promise<`0x${string}`>,
        });
        if (!pickupResult.ok) {
          toast({
            title: 'Pickup info save failed',
            description: pickupResult.error,
            variant: 'destructive',
          });
        }
      }
    } catch (err) {
      console.error('[Profile/Seller] Save error:', err);
      toast({
        title: 'Save failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  return (
    <SectionShell
      id="seller"
      title="Seller"
      description="How you sell on LocalRoots. Your storefront name, photo, and bio come from your Gardener profile above."
      highlight={highlight}
    >
      {/* Inherited fields (read-only) */}
      <div className="mb-6 rounded-xl border border-gray-200 bg-gray-50/50 p-4 space-y-3">
        <div className="flex items-center gap-3">
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoUrl}
              alt={storefrontName}
              className="w-14 h-14 rounded-lg object-cover bg-white"
            />
          ) : (
            <div className="w-14 h-14 rounded-lg bg-roots-primary/10 flex items-center justify-center text-2xl font-bold text-roots-primary">
              {storefrontName.charAt(0).toUpperCase() || 'S'}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate">
              {storefrontName || <span className="text-roots-gray italic">No name set</span>}
            </p>
            <p className="text-xs text-roots-gray truncate">
              {storefrontBio || <span className="italic">No bio set</span>}
            </p>
          </div>
        </div>
        {missingGardener && (
          <div className="text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-2">
            Set your name, bio, and photo in the <strong>Gardener</strong> section above —
            your storefront uses those.
          </div>
        )}
        {!missingGardener && (
          <p className="text-xs text-roots-gray">
            Edit name, bio, or photo in the <strong>Gardener</strong> section above.
          </p>
        )}
      </div>

      {/* Pickup/delivery toggles */}
      <div className="space-y-4">
        <div
          className={`flex items-center justify-between p-3 rounded-lg border-2 transition-colors ${
            offersPickup
              ? 'bg-roots-primary/10 border-roots-primary'
              : 'bg-gray-50 border-gray-200'
          }`}
        >
          <div>
            <p className="font-medium">Offer pickup</p>
            <p className="text-sm text-roots-gray">
              Buyers come to you. Your address is private — only shared with confirmed buyers.
            </p>
          </div>
          <Switch checked={offersPickup} onCheckedChange={setOffersPickup} />
        </div>

        {offersPickup && (
          <div className="ml-1 pl-4 border-l-2 border-roots-primary/30 space-y-3">
            {!pickupLoaded ? (
              <button
                type="button"
                onClick={loadPickup}
                className="text-sm text-roots-primary hover:underline"
              >
                Load my saved pickup address →
              </button>
            ) : (
              <>
                <div>
                  <Label htmlFor="pickupAddress">Pickup address (private)</Label>
                  <Input
                    id="pickupAddress"
                    value={pickupAddress}
                    onChange={(e) => setPickupAddress(e.target.value)}
                    placeholder="123 Garden Lane, Hilton Head SC"
                    className="mt-1"
                  />
                  <p className="text-xs text-roots-gray mt-1">
                    Only shared with buyers after you accept their order.
                  </p>
                </div>
                <div>
                  <Label htmlFor="pickupPhone">Phone (optional)</Label>
                  <Input
                    id="pickupPhone"
                    type="tel"
                    value={pickupPhone}
                    onChange={(e) => setPickupPhone(e.target.value)}
                    placeholder="(555) 555-1234"
                    className="mt-1"
                  />
                </div>
              </>
            )}
          </div>
        )}

        <div
          className={`flex items-center justify-between p-3 rounded-lg border-2 transition-colors ${
            offersDelivery
              ? 'bg-roots-primary/10 border-roots-primary'
              : 'bg-gray-50 border-gray-200'
          }`}
        >
          <div>
            <p className="font-medium">Offer delivery</p>
            <p className="text-sm text-roots-gray">You deliver to buyers within your radius.</p>
          </div>
          <Switch checked={offersDelivery} onCheckedChange={setOffersDelivery} />
        </div>

        {offersDelivery && (
          <div className="ml-1 pl-4 border-l-2 border-roots-primary/30">
            <Label htmlFor="deliveryRadius">
              Delivery radius ({getUnitLabel(distanceUnit)})
            </Label>
            <Input
              id="deliveryRadius"
              type="number"
              min={1}
              max={distanceUnit === 'miles' ? 60 : 100}
              value={deliveryRadius}
              onChange={(e) => setDeliveryRadius(Number(e.target.value))}
              className="mt-1 w-32"
            />
          </div>
        )}
      </div>

      <div className="mt-6 pt-6 border-t flex gap-3">
        <Button
          onClick={handleSave}
          disabled={isUpdating || missingGardener}
          className="bg-roots-primary hover:bg-roots-primary/90"
        >
          {isUpdating ? 'Saving…' : 'Save seller settings'}
        </Button>
        {missingGardener && (
          <span className="text-xs text-roots-gray self-center">
            Finish your Gardener profile first
          </span>
        )}
      </div>
    </SectionShell>
  );
}

// Helper used in the seller card
function resolveImageUrl(ref: string): string {
  if (!ref) return '';
  if (ref.startsWith('http') || ref.startsWith('data:')) return ref;
  return getIpfsUrl(ref);
}

// ─── 4. Ambassador (cash payment prefs) ─────────────────────────────────────

const PAYMENT_METHODS: {
  id: 'venmo' | 'paypal' | 'zelle';
  label: string;
  placeholder: string;
  icon: string;
}[] = [
  { id: 'venmo', label: 'Venmo', placeholder: '@username', icon: '💳' },
  { id: 'paypal', label: 'PayPal', placeholder: 'email@example.com', icon: '💸' },
  { id: 'zelle', label: 'Zelle', placeholder: 'email or phone', icon: '🏦' },
];

function AmbassadorSection({ highlight }: { highlight: boolean }) {
  const { isAmbassador, ambassador, isLoading } = useAmbassadorStatus();
  const { profile: ambassadorProfile } = useAmbassadorProfile(
    ambassador?.profileIpfs || ''
  );
  const { updateProfile, isPending, error } = useUpdateAmbassadorProfile();
  const { toast } = useToast();

  const [method, setMethod] = useState<'venmo' | 'paypal' | 'zelle' | null>(null);
  const [handle, setHandle] = useState('');
  const [bookingUrl, setBookingUrl] = useState('');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!ambassadorProfile || hydrated) return;
    setMethod(ambassadorProfile.paymentMethod || null);
    setHandle(ambassadorProfile.paymentHandle || '');
    setBookingUrl(ambassadorProfile.bookingUrl || '');
    setHydrated(true);
  }, [ambassadorProfile, hydrated]);

  useEffect(() => {
    if (error) {
      toast({
        title: 'Save failed',
        description: error.message || 'Try again.',
        variant: 'destructive',
      });
    }
  }, [error, toast]);

  if (isLoading) {
    return (
      <SectionShell id="ambassador" title="Ambassador" highlight={highlight}>
        <p className="text-sm text-roots-gray">Loading ambassador info…</p>
      </SectionShell>
    );
  }

  if (!isAmbassador) {
    return (
      <SectionShell
        id="ambassador"
        title="Ambassador"
        description="You're not registered as an ambassador yet."
        highlight={highlight}
      >
        <Link href="/ambassador/register">
          <Button className="bg-roots-secondary hover:bg-roots-secondary/90 text-white">
            Become an ambassador
          </Button>
        </Link>
      </SectionShell>
    );
  }

  const handleSave = async () => {
    if (!method || !handle.trim()) {
      toast({
        title: 'Missing info',
        description: 'Pick a payment method and enter your handle.',
        variant: 'destructive',
      });
      return;
    }
    if (method === 'venmo' && !handle.startsWith('@')) {
      toast({
        title: 'Invalid Venmo handle',
        description: 'Venmo usernames start with @',
        variant: 'destructive',
      });
      return;
    }
    const updated: AmbassadorProfile = {
      name: ambassadorProfile?.name || '',
      bio: ambassadorProfile?.bio,
      email: ambassadorProfile?.email,
      imageUrl: ambassadorProfile?.imageUrl,
      createdAt: ambassadorProfile?.createdAt || new Date().toISOString(),
      paymentMethod: method,
      paymentHandle: handle.trim(),
      // Preserve isChief from the existing profile — only admin should
      // flip this. Save bookingUrl from form (Calendly etc.).
      isChief: ambassadorProfile?.isChief,
      bookingUrl: bookingUrl.trim() || undefined,
    };
    const ok = await updateProfile(updated);
    if (ok) {
      toast({ title: 'Payment method saved' });
    }
  };

  return (
    <SectionShell
      id="ambassador"
      title="Ambassador"
      description="Cash payment preferences — temporary while we're pre-launch. Once Roots Points convert to $ROOTS, payments will run on-chain automatically."
      highlight={highlight}
    >
      <div className="space-y-4">
        <div>
          <Label>Payment method</Label>
          <div className="grid grid-cols-3 gap-2 mt-2">
            {PAYMENT_METHODS.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  setMethod(m.id);
                  setHandle('');
                }}
                className={`p-3 rounded-lg border-2 transition-all ${
                  method === m.id
                    ? 'border-roots-primary bg-roots-primary/5'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="text-2xl mb-1">{m.icon}</div>
                <div className="text-sm font-medium">{m.label}</div>
              </button>
            ))}
          </div>
        </div>

        {method && (
          <div>
            <Label htmlFor="payment-handle">
              {method === 'venmo' && 'Venmo username'}
              {method === 'paypal' && 'PayPal email'}
              {method === 'zelle' && 'Zelle email or phone'}
            </Label>
            <Input
              id="payment-handle"
              type={method === 'venmo' ? 'text' : 'email'}
              placeholder={PAYMENT_METHODS.find((m) => m.id === method)?.placeholder}
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              className="mt-1"
            />
            {method === 'venmo' && (
              <p className="text-xs text-roots-gray mt-1">Include the @ (e.g. @johndoe)</p>
            )}
          </div>
        )}

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
          Cash payments are temporary during pre-launch. When $ROOTS launches, ambassadors will
          be paid automatically in $ROOTS.
        </div>

        {/* Booking URL — used by Chief Ambassadors and any ambassador who
            wants prospective gardeners to schedule a call. Surfaces as a
            "Book a call" CTA on the public /ambassadors directory card. */}
        <div className="pt-4 border-t border-gray-100">
          <Label htmlFor="bookingUrl">Booking URL (optional)</Label>
          <Input
            id="bookingUrl"
            type="url"
            placeholder="https://calendly.com/your-handle"
            value={bookingUrl}
            onChange={(e) => setBookingUrl(e.target.value)}
            className="mt-1"
          />
          <p className="text-xs text-roots-gray mt-1">
            Add your Calendly (or similar) link if you want gardeners to book
            calls with you. Shows on your card in the public Ambassadors
            directory.
          </p>
          {ambassadorProfile?.isChief && (
            <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-roots-primary">
              <span>⭐</span> You&apos;re a Chief Ambassador — your card is featured at the top of /ambassadors.
            </p>
          )}
        </div>

        <Button
          onClick={handleSave}
          disabled={isPending || !method || !handle.trim()}
          className="bg-roots-primary hover:bg-roots-primary/90"
        >
          {isPending ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
    </SectionShell>
  );
}

// ─── 5. Buyer (placeholder) ─────────────────────────────────────────────────

function BuyerSection({ highlight }: { highlight: boolean }) {
  const { signMessageAsync } = useSignMessage();
  const { toast } = useToast();
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Load existing record on mount (if any). Signature-gated by design —
  // we ask the user to sign once on entry to confirm wallet ownership,
  // then auto-fill the form. If they decline the signature, the form
  // stays empty and they can still enter a new address.
  const loadDelivery = async () => {
    setIsLoading(true);
    try {
      const record = await fetchOwnDelivery({
        signMessage: (msg) => signMessageAsync({ message: msg }) as Promise<`0x${string}`>,
      });
      if (record) {
        setAddress(record.address || '');
        setPhone(record.phone || '');
        setNotes(record.notes || '');
      }
    } catch (err) {
      console.warn('[BuyerSection] load delivery failed:', err);
    } finally {
      setIsLoading(false);
      setHydrated(true);
    }
  };

  const handleSave = async () => {
    if (!address.trim()) {
      toast({
        title: 'Address required',
        description: 'Please enter a delivery address.',
        variant: 'destructive',
      });
      return;
    }
    setIsSaving(true);
    const result = await saveDelivery({
      address: address.trim(),
      phone: phone.trim() || undefined,
      notes: notes.trim() || undefined,
      signMessage: (msg) => signMessageAsync({ message: msg }) as Promise<`0x${string}`>,
    });
    setIsSaving(false);
    if (result.ok) {
      toast({
        title: 'Delivery info saved',
        description: 'Future checkouts will pre-fill these details.',
      });
    } else {
      toast({
        title: 'Save failed',
        description: result.error,
        variant: 'destructive',
      });
    }
  };

  return (
    <SectionShell
      id="buyer"
      title="Buyer"
      description="Saved delivery info for faster checkout. Sellers receive these details only when you place a delivery order."
      highlight={highlight}
    >
      {!hydrated ? (
        <div className="space-y-3">
          <p className="text-sm text-roots-gray">
            Click below to load your saved delivery info, or enter new details to save.
          </p>
          <Button onClick={loadDelivery} disabled={isLoading} variant="outline">
            {isLoading ? 'Loading…' : 'Load saved delivery info'}
          </Button>
          <p className="text-xs text-roots-gray">
            (You'll be asked to sign a message — free, no gas — to confirm wallet ownership.)
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <Label htmlFor="buyer-delivery-address">Delivery address</Label>
            <Input
              id="buyer-delivery-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="123 Garden Lane, Hilton Head SC 29928"
              className="mt-1"
              disabled={isSaving}
            />
          </div>
          <div>
            <Label htmlFor="buyer-delivery-phone">Phone (optional)</Label>
            <Input
              id="buyer-delivery-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(555) 555-1234"
              className="mt-1"
              disabled={isSaving}
            />
          </div>
          <div>
            <Label htmlFor="buyer-delivery-notes">Delivery notes (optional)</Label>
            <Input
              id="buyer-delivery-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Gate code, leave at door, ring twice…"
              className="mt-1"
              disabled={isSaving}
            />
          </div>
          <Button
            onClick={handleSave}
            disabled={isSaving || !address.trim()}
            className="bg-roots-primary hover:bg-roots-primary/90"
          >
            {isSaving ? 'Saving…' : 'Save delivery info'}
          </Button>
          <p className="text-xs text-roots-gray">
            Saved per-wallet. Sellers only see your address when you place a delivery order; this
            record itself stays private.
          </p>
        </div>
      )}
    </SectionShell>
  );
}
