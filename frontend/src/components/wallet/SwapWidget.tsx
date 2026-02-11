'use client';

import { useState } from 'react';
import { ArrowDownUp, ExternalLink, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

// Swap is disabled until liquidity pool is created
const SWAP_ENABLED = false;

interface TokenInputProps {
  label: string;
  token: string;
  icon: string;
  value: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  balance?: string;
}

function TokenInput({
  label,
  token,
  icon,
  value,
  onChange,
  disabled = false,
  balance,
}: TokenInputProps) {
  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-roots-gray">{label}</span>
        {balance && (
          <span className="text-xs text-roots-gray">
            Balance: {balance}
          </span>
        )}
      </div>
      <div className="flex items-center gap-3">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder="0.00"
          disabled={disabled}
          className="flex-1 bg-transparent text-2xl font-medium outline-none disabled:cursor-not-allowed"
        />
        <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border">
          <span className="text-lg">{icon}</span>
          <span className="font-medium">{token}</span>
        </div>
      </div>
    </div>
  );
}

export function SwapWidget() {
  const [fromAmount, setFromAmount] = useState('');
  const [toAmount, setToAmount] = useState('');
  const [isFlipped, setIsFlipped] = useState(false);

  // Token pair (can be flipped)
  const fromToken = isFlipped ? { symbol: 'USDC', icon: '💵' } : { symbol: 'ROOTS', icon: '🌱' };
  const toToken = isFlipped ? { symbol: 'ROOTS', icon: '🌱' } : { symbol: 'USDC', icon: '💵' };

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
    // Swap the amounts
    const temp = fromAmount;
    setFromAmount(toAmount);
    setToAmount(temp);
  };

  return (
    <Card className="relative overflow-hidden">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <ArrowDownUp className="w-5 h-5" />
          Swap
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Coming Soon Overlay */}
        {!SWAP_ENABLED && (
          <div className="absolute inset-0 bg-white/80 backdrop-blur-[2px] z-10 flex flex-col items-center justify-center">
            <div className="bg-roots-cream rounded-full p-4 mb-4">
              <Clock className="w-8 h-8 text-roots-primary" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Coming Soon</h3>
            <p className="text-sm text-roots-gray text-center max-w-xs px-4 mb-4">
              Swap ROOTS ↔ USDC on Aerodrome after the liquidity pool launches.
            </p>
            <a
              href="https://aerodrome.finance"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-roots-secondary hover:underline inline-flex items-center"
            >
              Learn about Aerodrome
              <ExternalLink className="w-3 h-3 ml-1" />
            </a>
          </div>
        )}

        {/* Swap Interface Preview */}
        <div className="space-y-2">
          {/* From Token */}
          <TokenInput
            label="From"
            token={fromToken.symbol}
            icon={fromToken.icon}
            value={fromAmount}
            onChange={setFromAmount}
            disabled={!SWAP_ENABLED}
            balance="0.00"
          />

          {/* Flip Button */}
          <div className="flex justify-center -my-2 relative z-[1]">
            <button
              onClick={handleFlip}
              disabled={!SWAP_ENABLED}
              className="bg-white border-2 border-gray-100 rounded-full p-2 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ArrowDownUp className="w-4 h-4 text-roots-gray" />
            </button>
          </div>

          {/* To Token */}
          <TokenInput
            label="To (estimated)"
            token={toToken.symbol}
            icon={toToken.icon}
            value={toAmount}
            disabled={true}
            balance="0.00"
          />
        </div>

        {/* Swap Details (preview) */}
        <div className="bg-gray-50 rounded-lg p-3 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-roots-gray">Rate</span>
            <span>1 ROOTS = 0.01 USDC</span>
          </div>
          <div className="flex justify-between">
            <span className="text-roots-gray">Slippage</span>
            <span>0.5%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-roots-gray">Network</span>
            <span>Base</span>
          </div>
        </div>

        {/* Swap Button */}
        <Button
          disabled={!SWAP_ENABLED}
          className="w-full bg-roots-secondary hover:bg-roots-secondary/90"
        >
          {SWAP_ENABLED ? 'Swap' : 'Swap Coming Soon'}
        </Button>

        {/* Powered by Aerodrome */}
        <div className="text-center">
          <a
            href="https://aerodrome.finance"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-roots-gray hover:text-roots-secondary inline-flex items-center"
          >
            Powered by Aerodrome
            <ExternalLink className="w-3 h-3 ml-1" />
          </a>
        </div>
      </CardContent>
    </Card>
  );
}
