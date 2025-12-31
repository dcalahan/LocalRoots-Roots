'use client';

import { type PaymentToken, PAYMENT_TOKENS, rootsToStablecoin } from '@/lib/contracts/marketplace';
import { formatRoots } from '@/lib/pricing';

interface PaymentTokenSelectorProps {
  selected: PaymentToken;
  onChange: (token: PaymentToken) => void;
  rootsAmount: bigint;
  disabled?: boolean;
}

export function PaymentTokenSelector({
  selected,
  onChange,
  rootsAmount,
  disabled = false,
}: PaymentTokenSelectorProps) {
  const stablecoinAmount = rootsToStablecoin(rootsAmount);

  const tokens: { token: PaymentToken; label: string; amount: string }[] = [
    {
      token: 'ROOTS',
      label: 'ROOTS',
      amount: formatRoots(rootsAmount),
    },
    {
      token: 'USDC',
      label: 'USDC',
      amount: `$${(Number(stablecoinAmount) / 1_000_000).toFixed(2)}`,
    },
    {
      token: 'USDT',
      label: 'USDT',
      amount: `$${(Number(stablecoinAmount) / 1_000_000).toFixed(2)}`,
    },
  ];

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-roots-gray">Pay with</label>
      <div className="grid grid-cols-3 gap-2">
        {tokens.map(({ token, label, amount }) => (
          <button
            key={token}
            type="button"
            disabled={disabled}
            onClick={() => onChange(token)}
            className={`
              p-3 rounded-lg border-2 transition-all text-center
              ${selected === token
                ? 'border-roots-primary bg-roots-primary/5'
                : 'border-gray-200 hover:border-gray-300'
              }
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            <div className="font-medium">{label}</div>
            <div className="text-sm text-roots-gray">{amount}</div>
          </button>
        ))}
      </div>
      <p className="text-xs text-roots-gray">
        {selected === 'ROOTS'
          ? 'Pay directly with ROOTS tokens'
          : `Pay with ${selected} - automatically converted to ROOTS at checkout`}
      </p>
    </div>
  );
}
