'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import type { GardenPlant, PlantingMethod, GardenBed, CareAlert } from '@/types/my-garden';
import { computeStatus, getEstimatedHarvestDate, getProgressPercent, getCropDisplayName } from '@/lib/gardenStatus';
import { getCropEmoji } from '@/lib/cropEmoji';
import { PlantProgressBar } from './PlantProgressBar';
import { detectCareAlerts, dismissAlert, loadDismissals, alertColorClasses } from '@/lib/careAlerts';
import { getPruningRules, getBoltingInfo } from '@/lib/plantingCalendar';
import { useSellerStatus } from '@/hooks/useSellerStatus';

interface GardenPlantCardProps {
  plant: GardenPlant;
  firstFallFrost?: Date;
  onRemove?: (plantId: string) => void;
  onHarvest?: (plantId: string) => void;
  onUpdate?: (plantId: string, updates: Partial<GardenPlant>) => void;
  /** Beds available for re-assignment in edit mode. */
  beds?: GardenBed[];
}

export function GardenPlantCard({ plant, firstFallFrost, onRemove, onHarvest, onUpdate, beds = [] }: GardenPlantCardProps) {
  const { user: privyUser } = usePrivy();
  const userId = privyUser?.id || null;
  const { isSeller } = useSellerStatus();
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [editQuantity, setEditQuantity] = useState(String(plant.quantity));
  const [editDate, setEditDate] = useState(plant.plantingDate);
  const [editMethod, setEditMethod] = useState<PlantingMethod>(plant.plantingMethod);
  const [editNotes, setEditNotes] = useState(plant.notes || '');
  const [editBedId, setEditBedId] = useState<string | ''>(plant.bedId || '');
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const qtyRef = useRef<HTMLInputElement>(null);

  const [dismissals, setDismissals] = useState<Record<string, string>>({});
  useEffect(() => { setDismissals(loadDismissals()); }, []);

  // Per-plant per-day tracker for "Log care" pills. Persists in localStorage
  // so the pill turns into "Logged ✓" after the user taps it, and survives
  // a refresh. Server is still the source of truth for the credit dedup —
  // this is just the UI affordance.
  const [careLogToday, setCareLogToday] = useState<Record<string, boolean>>({});
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    const key = `care-log:${plant.id}:${today}`;
    try {
      const raw = localStorage.getItem(key);
      if (raw) setCareLogToday(JSON.parse(raw));
    } catch {
      // ignore — fresh state is fine
    }
  }, [plant.id]);

  // Does this crop support pruning / bolting? Lookup is parent-crop-aware
  // for custom varieties (e.g. "tomato-cherry-sungold" falls back to
  // "tomato-cherry"). The server validates again, but we hide the pill
  // entirely if no rule exists — fewer dead taps.
  const parentCropId = useMemo(() => {
    if (getPruningRules(plant.cropId).length > 0 || getBoltingInfo(plant.cropId)) {
      return plant.cropId;
    }
    const stripped = plant.cropId.split('-').slice(0, 2).join('-');
    return stripped;
  }, [plant.cropId]);

  const hasPruningRules = getPruningRules(parentCropId).length > 0;
  const hasBoltingRules = !!getBoltingInfo(parentCropId);

  const logCareAction = async (action: 'prune' | 'bolt-mgmt') => {
    if (!userId || careLogToday[action]) return;
    // Optimistically mark logged so the pill flips to "✓ Logged today".
    // If the server returns a duplicate or cap, we keep the visual state —
    // the user already tried this today, the pill should stay quiet.
    const today = new Date().toISOString().slice(0, 10);
    const key = `care-log:${plant.id}:${today}`;
    const next = { ...careLogToday, [action]: true };
    setCareLogToday(next);
    try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* quota */ }

    try {
      const res = await fetch(`/api/care-action?userId=${encodeURIComponent(userId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plantId: plant.id, cropId: plant.cropId, action }),
      });
      const data = await res.json().catch(() => null) as
        | { credited?: number; rpAmount?: number; newTotal?: number; cappedCount?: number; cappedVerbs?: string[] }
        | null;
      if (typeof window !== 'undefined' && data) {
        // Dispatch the existing event bus so RPCreditToaster fires the
        // "+15 RP" or cap toast, and useOffchainRP refetches the header
        // pill. Same payload shape every other surface uses.
        window.dispatchEvent(
          new CustomEvent('app:rp-credited', {
            detail: {
              credited: data.credited ?? 0,
              rpAmount: data.rpAmount ?? 0,
              newTotal: data.newTotal ?? 0,
              cappedCount: data.cappedCount ?? 0,
              cappedVerbs: data.cappedVerbs,
              userId,
            },
          }),
        );
      }
    } catch (err) {
      // Don't undo the optimistic state — user can retry on a fresh day.
      // Network errors are rare; the credit was already deduped server-side
      // if it landed before the connection died.
      console.error('[care-action] request failed:', err);
    }
  };

  const alerts = useMemo<CareAlert[]>(
    () => detectCareAlerts(plant, new Date(), { dismissals }),
    [plant, dismissals],
  );
  const primaryAlert = alerts[0];

  const handleAskSage = (alert: CareAlert) => {
    const msg = `My ${getCropDisplayName(plant.cropId, plant.customVarietyName)} — ${alert.title.toLowerCase()}. What should I do?`;
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('sage:ask', { detail: { message: msg } }));
    }
  };

  const handleListForSale = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('app:list-for-sale', {
        detail: { plantId: plant.id, cropId: plant.cropId, quantity: plant.quantity },
      }));
    }
  };

  const handleDismissAlert = (alert: CareAlert) => {
    // Pass userId so the dismissal also mirrors to KV — Sage's next system
    // prompt build sees it and stops mentioning what the user already handled.
    dismissAlert(alert.id, userId);
    setDismissals(prev => ({ ...prev, [alert.id]: new Date().toISOString() }));
  };

  // Sell button — branches on seller status:
  //   - Already a seller → straight to listing creation, pre-filled with this crop
  //   - Not yet a seller → seller registration with intent=list, which auto-routes
  //     to listing creation after registration completes (and pre-fills name/photo
  //     from public garden profile if available)
  const handleSell = () => {
    const params = new URLSearchParams({
      crop: plant.cropId,
      qty: String(plant.quantity || 1),
      source: 'garden',
    });
    if (isSeller) {
      router.push(`/sell/listings/new?${params.toString()}`);
    } else {
      // Preserve listing intent through the registration flow
      const regParams = new URLSearchParams({
        intent: 'list',
        cropId: plant.cropId,
        qty: String(plant.quantity || 1),
      });
      router.push(`/sell/register?${regParams.toString()}`);
    }
  };

  const status = computeStatus(plant, new Date(), firstFallFrost);
  const harvestDate = getEstimatedHarvestDate(plant);
  const progress = getProgressPercent(plant);
  const name = getCropDisplayName(plant.cropId, plant.customVarietyName);
  const parentName = plant.customVarietyName ? getCropDisplayName(plant.cropId) : null;
  const emoji = getCropEmoji(plant.cropId);

  const plantedDate = new Date(plant.plantingDate).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

  const harvestLabel = status === 'done'
    ? 'Completed'
    : `Harvest ~${harvestDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

  const handleSave = () => {
    if (!onUpdate) return;
    const qty = parseInt(editQuantity, 10);
    onUpdate(plant.id, {
      quantity: qty > 0 ? qty : 1,
      plantingDate: editDate || plant.plantingDate,
      plantingMethod: editMethod,
      notes: editNotes.trim() || undefined,
      bedId: editBedId || undefined,
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditQuantity(String(plant.quantity));
    setEditDate(plant.plantingDate);
    setEditMethod(plant.plantingMethod);
    setEditNotes(plant.notes || '');
    setEditBedId(plant.bedId || '');
    setIsEditing(false);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xl">{emoji}</span>
          <div>
            <h4 className="font-semibold text-gray-900">{name}</h4>
            <p className="text-xs text-roots-gray">
              {parentName && <span className="text-roots-secondary/70">({parentName}) · </span>}
              {plant.quantity} plant{plant.quantity !== 1 ? 's' : ''}
              {plant.plantingMethod === 'start-indoors' ? ' · Started indoors' : ''}
              {plant.location ? ` · ${plant.location}` : ''}
            </p>
          </div>
        </div>
        {/* Quick actions. flex-wrap on a narrow viewport so the right-edge
            buttons (✕ / ✏️) don't get pushed off-screen when the plant name
            is long. flex-shrink-0 on each button prevents the tap area from
            being squeezed below ~40px. Doug, May 25 2026 (couldn't tap ✕
            on his Okra card on iPhone — too close to screen edge). */}
        <div className="flex items-center gap-1 flex-wrap justify-end">
          {/* Sell — always available for active plants. Routes to listing
              creation if already a seller, or to seller registration with
              listing intent preserved if not. */}
          {status !== 'done' && (
            <button
              onClick={handleSell}
              className="text-xs px-2.5 py-1.5 rounded-full bg-roots-primary text-white font-semibold hover:bg-roots-primary/90 transition-colors flex-shrink-0"
              title={isSeller ? 'List this for sale on LocalRoots' : 'Sign up to start selling'}
            >
              Sell
            </button>
          )}
          {(status === 'near-harvest' || status === 'ready-to-harvest' || status === 'harvesting') && onHarvest && (
            <button
              onClick={() => onHarvest(plant.id)}
              className="text-xs px-2.5 py-1.5 rounded-full bg-roots-primary/10 text-roots-primary hover:bg-roots-primary/20 transition-colors flex-shrink-0"
            >
              Harvested
            </button>
          )}
          {onUpdate && status !== 'done' && (
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="text-sm rounded-full text-roots-gray hover:bg-gray-100 transition-colors flex-shrink-0 inline-flex items-center justify-center min-w-[40px] min-h-[40px]"
              aria-label={isEditing ? 'Cancel edit' : 'Edit plant'}
            >
              {isEditing ? 'Cancel' : '✏️'}
            </button>
          )}
          {onRemove && status !== 'done' && !confirmingDelete && (
            <button
              onClick={() => setConfirmingDelete(true)}
              className="text-sm rounded-full text-roots-gray hover:bg-gray-100 transition-colors flex-shrink-0 inline-flex items-center justify-center min-w-[40px] min-h-[40px]"
              aria-label="Remove plant"
            >
              ✕
            </button>
          )}
          {confirmingDelete && (
            <div className="flex items-center gap-1 bg-red-50 border border-red-200 rounded-full pl-3 pr-1 py-1 flex-shrink-0">
              <span className="text-xs text-red-700">Delete?</span>
              <button
                onClick={() => { onRemove?.(plant.id); setConfirmingDelete(false); }}
                className="text-xs px-3 py-1.5 rounded-full bg-red-500 text-white font-semibold"
              >
                Yes
              </button>
              <button
                onClick={() => setConfirmingDelete(false)}
                className="text-xs px-3 py-1.5 rounded-full text-roots-gray hover:bg-white/60"
              >
                No
              </button>
            </div>
          )}
        </div>
      </div>

      {isEditing ? (
        <div className="space-y-2 mt-2 bg-gray-50 rounded-lg p-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-roots-gray block mb-1">Quantity</label>
              <input
                ref={qtyRef}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={editQuantity}
                onFocus={() => setTimeout(() => qtyRef.current?.select(), 0)}
                onChange={e => setEditQuantity(e.target.value.replace(/[^0-9]/g, ''))}
                className="w-full px-2 py-2 border border-gray-200 rounded-lg text-sm text-center bg-white"
                style={{ fontSize: 'max(16px, 0.875rem)' }}
              />
            </div>
            <div>
              <label className="text-xs text-roots-gray block mb-1">Method</label>
              <select
                value={editMethod}
                onChange={e => setEditMethod(e.target.value as PlantingMethod)}
                className="w-full px-2 py-2 border border-gray-200 rounded-lg text-sm bg-white"
                style={{ fontSize: 'max(16px, 0.875rem)' }}
              >
                <option value="transplant">Transplant</option>
                <option value="direct-sow">Direct sow</option>
                <option value="start-indoors">Start indoors</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-roots-gray block mb-1">Planted on</label>
            <input
              type="date"
              value={editDate}
              max={new Date().toISOString().split('T')[0]}
              onChange={e => setEditDate(e.target.value)}
              className="w-full px-2 py-2 border border-gray-200 rounded-lg text-sm bg-white"
              style={{ fontSize: 'max(16px, 0.875rem)' }}
            />
          </div>
          {beds.length > 0 && (
            <div>
              <label className="text-xs text-roots-gray block mb-1">Bed</label>
              <select
                value={editBedId}
                onChange={e => setEditBedId(e.target.value)}
                className="w-full px-2 py-2 border border-gray-200 rounded-lg text-sm bg-white"
                style={{ fontSize: 'max(16px, 0.875rem)' }}
              >
                <option value="">No bed (unassigned)</option>
                {beds.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="text-xs text-roots-gray block mb-1">Notes (optional)</label>
            <input
              type="text"
              value={editNotes}
              onChange={e => setEditNotes(e.target.value)}
              placeholder="e.g. South side of bed"
              className="w-full px-2 py-2 border border-gray-200 rounded-lg text-sm bg-white"
              style={{ fontSize: 'max(16px, 0.875rem)' }}
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCancel}
              className="flex-1 py-2 rounded-lg text-sm font-semibold text-roots-gray border border-gray-200"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex-1 py-2 rounded-lg text-sm font-semibold text-white bg-roots-secondary"
            >
              Save
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-2">
            <PlantProgressBar percent={progress} status={status} />
          </div>

          <div className="flex justify-between text-xs text-roots-gray">
            <span>Planted {plantedDate}</span>
            <span>{harvestLabel}</span>
            <span>{progress}%</span>
          </div>

          {plant.notes && (
            <p className="mt-2 text-xs text-roots-gray italic">{plant.notes}</p>
          )}

          {primaryAlert && (() => {
            const c = alertColorClasses(primaryAlert.severity);
            return (
              <div className={`mt-3 rounded-lg border ${c.border} ${c.bg} p-2.5`}>
                <div className="flex items-start gap-2">
                  <span className="text-base leading-none mt-0.5">{c.icon}</span>
                  <div className="flex-1 min-w-0">
                    <button
                      onClick={() => handleAskSage(primaryAlert)}
                      className={`text-left w-full ${c.text} font-semibold text-sm`}
                    >
                      {primaryAlert.title}
                    </button>
                    <p className="text-xs text-roots-gray mt-0.5">
                      {primaryAlert.actionHint || primaryAlert.message}
                    </p>
                    <div className="flex gap-1.5 mt-2 flex-wrap">
                      <button
                        onClick={() => handleAskSage(primaryAlert)}
                        className={`text-xs px-2 py-1 rounded-full bg-white/80 ${c.text} font-semibold hover:bg-white transition-colors`}
                      >
                        Ask Sage
                      </button>
                      {primaryAlert.sellRamp && (
                        <button
                          onClick={handleListForSale}
                          className="text-xs px-2 py-1 rounded-full bg-roots-primary text-white font-semibold hover:bg-roots-primary/90 transition-colors"
                        >
                          List for sale →
                        </button>
                      )}
                      <button
                        onClick={() => handleDismissAlert(primaryAlert)}
                        className="text-xs px-2 py-1 rounded-full text-roots-gray hover:bg-white/60 transition-colors"
                      >
                        Done
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* "Log care" pills — earn the same RP as alert dismissal, but
              available even when no alert is currently active. Only shown
              for actions the crop actually supports (pruning rules for
              "Pruned", bolting rules for "Bolt-managed"). One credit per
              plant per action per UTC day; the +15 RP toaster fires via
              the existing app:rp-credited event. Doug, May 18 2026. */}
          {status !== 'done' && userId && (hasPruningRules || hasBoltingRules) && (
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <span className="text-xs text-roots-gray">Log care:</span>
              {hasPruningRules && (
                <button
                  onClick={() => logCareAction('prune')}
                  disabled={careLogToday['prune']}
                  className={
                    careLogToday['prune']
                      ? 'text-xs px-2.5 py-1 rounded-full bg-roots-secondary/15 text-roots-secondary cursor-default'
                      : 'text-xs px-2.5 py-1 rounded-full bg-gray-50 border border-gray-200 text-roots-gray hover:bg-roots-secondary/10 hover:text-roots-secondary hover:border-roots-secondary/30 transition-colors'
                  }
                  title={careLogToday['prune'] ? 'Logged today' : 'Tap when you\'ve pruned this plant'}
                >
                  {careLogToday['prune'] ? '✓ Pruned today' : 'Pruned'}
                </button>
              )}
              {hasBoltingRules && (
                <button
                  onClick={() => logCareAction('bolt-mgmt')}
                  disabled={careLogToday['bolt-mgmt']}
                  className={
                    careLogToday['bolt-mgmt']
                      ? 'text-xs px-2.5 py-1 rounded-full bg-roots-secondary/15 text-roots-secondary cursor-default'
                      : 'text-xs px-2.5 py-1 rounded-full bg-gray-50 border border-gray-200 text-roots-gray hover:bg-roots-secondary/10 hover:text-roots-secondary hover:border-roots-secondary/30 transition-colors'
                  }
                  title={careLogToday['bolt-mgmt'] ? 'Logged today' : 'Tap when you\'ve harvested early or removed flowers to prevent bolting'}
                >
                  {careLogToday['bolt-mgmt'] ? '✓ Bolt managed' : 'Bolt-managed'}
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
