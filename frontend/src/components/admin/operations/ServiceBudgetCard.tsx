'use client';

import { Card, CardContent } from '@/components/ui/card';
import {
  type ServiceConfig,
  formatUSDC,
  getBudgetUtilization,
  isMonthReset,
  SERVICE_INFO,
} from '@/types/operations';

interface ServiceBudgetCardProps {
  config: ServiceConfig;
}

export function ServiceBudgetCard({ config }: ServiceBudgetCardProps) {
  // Try to match service info by name
  const serviceKey = Object.keys(SERVICE_INFO).find(
    (key) => SERVICE_INFO[key].name.toLowerCase() === config.name.toLowerCase()
  );
  const info = serviceKey ? SERVICE_INFO[serviceKey] : null;

  const utilization = getBudgetUtilization(config);
  const monthReset = isMonthReset(config.lastResetTime);

  // Determine the effective current spend (0 if month has reset)
  const effectiveSpend = monthReset ? 0n : config.currentSpend;
  const effectiveUtilization = monthReset ? 0 : utilization;

  return (
    <Card className={!config.active ? 'opacity-60' : ''}>
      <CardContent className="pt-4">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-xl">
            {info?.icon || '📦'}
          </div>

          {/* Details */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h4 className="font-semibold truncate">{config.name}</h4>
              <div className="flex gap-1">
                {config.requiresOfframp && (
                  <span
                    className="text-xs px-2 py-0.5 bg-amber-100 text-amber-800 rounded"
                    title="Requires off-ramp to fiat"
                  >
                    Off-ramp
                  </span>
                )}
                {!config.active && (
                  <span className="text-xs px-2 py-0.5 bg-gray-200 text-gray-600 rounded">
                    Inactive
                  </span>
                )}
              </div>
            </div>

            {info && (
              <p className="text-xs text-roots-gray mt-0.5 truncate">
                {info.description}
              </p>
            )}

            {/* Budget Progress */}
            <div className="mt-3">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-roots-gray">Monthly Budget</span>
                <span className="font-medium">
                  {formatUSDC(effectiveSpend)} / {formatUSDC(config.monthlyBudget)}
                </span>
              </div>

              {/* Progress Bar */}
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    effectiveUtilization >= 90
                      ? 'bg-red-500'
                      : effectiveUtilization >= 70
                      ? 'bg-amber-500'
                      : 'bg-green-500'
                  }`}
                  style={{ width: `${Math.min(100, effectiveUtilization)}%` }}
                />
              </div>

              <div className="flex justify-between text-xs mt-1">
                <span className="text-roots-gray">
                  {effectiveUtilization.toFixed(0)}% used
                </span>
                {monthReset && (
                  <span className="text-green-600">Budget resets</span>
                )}
              </div>
            </div>

            {/* Payee */}
            <div className="mt-2 text-xs text-roots-gray">
              <span>Payee: </span>
              <span className="font-mono">
                {config.payee.slice(0, 6)}...{config.payee.slice(-4)}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
