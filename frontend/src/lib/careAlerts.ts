/**
 * Care alert detection — pure functions shared by plant cards, the
 * My Garden summary, Sage's system prompt, and (later) the iCal feed.
 *
 * No React, no side effects, no I/O. Give it a plant + crop info + now,
 * get back an array of CareAlert sorted by severity (most urgent first).
 */

import type { GardenPlant, CareAlert, CareAlertSeverity } from '@/types/my-garden';
import { getBoltingInfo, getPruningRules } from './plantingCalendar';
import { computeStatus } from './gardenStatus';

const SEVERITY_RANK: Record<CareAlertSeverity, number> = {
  critical: 0,
  urgent: 1,
  soon: 2,
  info: 3,
};

function daysBetween(a: string | Date, b: string | Date): number {
  return Math.floor(
    (new Date(b).getTime() - new Date(a).getTime()) / 86400000,
  );
}

/** Stable id so dismissals persist across re-renders and push dedupe works. */
function alertId(plantId: string, type: string, cycle = 0): string {
  return `${plantId}:${type}:${cycle}`;
}

export interface DetectCareAlertsOptions {
  /** Map of alertId -> ISO date dismissed (from localStorage). */
  dismissals?: Record<string, string>;
  /** Reserved for Phase 2. Unused in Phase 1. */
  weather?: unknown;
}

/**
 * Returns CareAlerts for a single plant, sorted by severity desc.
 * Safe to call on every render — cheap and deterministic.
 */
export function detectCareAlerts(
  plant: GardenPlant,
  now: Date = new Date(),
  options: DetectCareAlertsOptions = {},
): CareAlert[] {
  const { dismissals = {} } = options;
  const alerts: CareAlert[] = [];

  // Don't alert on already-done plants
  if (plant.removedDate || plant.harvestedDate) return [];
  if (plant.manualStatus === 'done') return [];

  const status = computeStatus(plant, now);
  if (status === 'done' || status === 'overwintering') return [];

  const elapsed = daysBetween(plant.plantingDate, now);
  if (elapsed < 0) return [];

  // ─── Bolting ─────────────────────────────────────────────
  const bolting = getBoltingInfo(plant.cropId);
  if (bolting) {
    const manualBolting = plant.manualStatus === 'bolting';
    if (manualBolting || elapsed >= bolting.daysToBoltMin) {
      const id = alertId(plant.id, 'bolting');
      if (!dismissals[id]) {
        alerts.push({
          id,
          plantId: plant.id,
          cropId: plant.cropId,
          type: 'bolting',
          severity: 'critical',
          title: 'Bolting — harvest now',
          message: bolting.advice,
          actionHint: 'Harvest the whole plant today. Leaves turn bitter fast.',
          sellRamp: true,
          createdAt: now.toISOString(),
        });
      }
    } else if (elapsed >= bolting.daysToBoltMin * 0.75) {
      const id = alertId(plant.id, 'bolt-risk');
      if (!dismissals[id]) {
        alerts.push({
          id,
          plantId: plant.id,
          cropId: plant.cropId,
          type: 'bolt-risk',
          severity: 'urgent',
          title: 'Bolt risk soon',
          message: `This crop typically bolts between days ${bolting.daysToBoltMin} and ${bolting.daysToBoltMax}. Plan your harvest.`,
          actionHint: bolting.advice,
          sellRamp: true,
          createdAt: now.toISOString(),
        });
      }
    }
  }

  // ─── Pruning ─────────────────────────────────────────────
  const pruneRules = getPruningRules(plant.cropId);
  for (const rule of pruneRules) {
    if (elapsed < rule.triggerDays) continue;

    // Which cycle are we in? Each cycle has its own id so dismissing
    // "today's pinch" won't hide next month's.
    const cyclesPast = Math.floor(
      (elapsed - rule.triggerDays) / Math.max(rule.recurringDays, 1),
    );
    const cycle = Math.max(0, cyclesPast);
    const id = alertId(plant.id, `prune-${rule.type}`, cycle);
    if (dismissals[id]) continue;

    // Overdue if we're well past the recurrence window without any dismissal
    const overdue = cyclesPast >= 2;

    alerts.push({
      id,
      plantId: plant.id,
      cropId: plant.cropId,
      type: overdue ? 'prune-overdue' : 'prune-now',
      severity: overdue ? 'urgent' : 'soon',
      title: rule.title,
      message: rule.message,
      actionHint: rule.actionHint,
      sellRamp: false,
      createdAt: now.toISOString(),
    });
  }

  // ─── Harvest-ready / urgent ──────────────────────────────
  if (status === 'ready-to-harvest' || status === 'harvesting') {
    const id = alertId(plant.id, 'harvest-ready');
    if (!dismissals[id]) {
      alerts.push({
        id,
        plantId: plant.id,
        cropId: plant.cropId,
        type: status === 'harvesting' ? 'harvest-urgent' : 'harvest-ready',
        severity: status === 'harvesting' ? 'urgent' : 'soon',
        title: status === 'harvesting' ? 'Harvest window closing' : 'Ready to harvest',
        message: status === 'harvesting'
          ? 'This plant is past peak — harvest soon or it will go to seed / decline.'
          : 'This plant is at peak. Start harvesting this week.',
        sellRamp: true,
        createdAt: now.toISOString(),
      });
    }
  }

  alerts.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
  return alerts;
}

/** Detect alerts across the whole garden. */
export function detectGardenAlerts(
  plants: GardenPlant[],
  now: Date = new Date(),
  options: DetectCareAlertsOptions = {},
): CareAlert[] {
  const all: CareAlert[] = [];
  for (const p of plants) all.push(...detectCareAlerts(p, now, options));
  all.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
  return all;
}

const DISMISSALS_KEY = 'localroots:care-alert-dismissals';

export function loadDismissals(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(DISMISSALS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export function dismissAlert(alertId: string): void {
  if (typeof window === 'undefined') return;
  try {
    const current = loadDismissals();
    current[alertId] = new Date().toISOString();
    window.localStorage.setItem(DISMISSALS_KEY, JSON.stringify(current));
  } catch {
    /* ignore */
  }
}

/** Severity-aware Tailwind color classes (roots brand palette). */
export function alertColorClasses(severity: CareAlertSeverity): {
  bg: string;
  border: string;
  text: string;
  icon: string;
} {
  if (severity === 'critical' || severity === 'urgent') {
    return {
      bg: 'bg-roots-primary/10',
      border: 'border-roots-primary/30',
      text: 'text-roots-primary',
      icon: '🌼',
    };
  }
  return {
    bg: 'bg-roots-secondary/10',
    border: 'border-roots-secondary/30',
    text: 'text-roots-secondary',
    icon: '✂️',
  };
}
