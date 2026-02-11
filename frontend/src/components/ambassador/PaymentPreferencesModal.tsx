'use client';

/**
 * PaymentPreferencesModal - Modal to set Venmo/PayPal/Zelle payment preferences
 * TEMPORARY - This entire component will be removed when $ROOTS token launches
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useUpdateAmbassadorProfile } from '@/hooks/useUpdateAmbassadorProfile';
import { useToast } from '@/hooks/use-toast';
import type { AmbassadorProfile } from '@/lib/contracts/ambassador';

type PaymentMethod = 'venmo' | 'paypal' | 'zelle';

interface PaymentPreferencesModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentProfile: AmbassadorProfile | null;
  onSuccess?: () => void;
}

const PAYMENT_METHODS: { id: PaymentMethod; label: string; placeholder: string; icon: string }[] = [
  { id: 'venmo', label: 'Venmo', placeholder: '@username', icon: '💳' },
  { id: 'paypal', label: 'PayPal', placeholder: 'email@example.com', icon: '💸' },
  { id: 'zelle', label: 'Zelle', placeholder: 'email or phone', icon: '🏦' },
];

export function PaymentPreferencesModal({
  isOpen,
  onClose,
  currentProfile,
  onSuccess,
}: PaymentPreferencesModalProps) {
  const { toast } = useToast();
  const { updateProfile, isPending, error } = useUpdateAmbassadorProfile();

  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(
    currentProfile?.paymentMethod || null
  );
  const [handle, setHandle] = useState(currentProfile?.paymentHandle || '');

  // Reset form when profile changes
  useEffect(() => {
    if (currentProfile) {
      setSelectedMethod(currentProfile.paymentMethod || null);
      setHandle(currentProfile.paymentHandle || '');
    }
  }, [currentProfile]);

  // Show error toast
  useEffect(() => {
    if (error) {
      toast({
        title: 'Failed to save',
        description: error.message || 'Please try again.',
        variant: 'destructive',
      });
    }
  }, [error, toast]);

  const handleSave = async () => {
    if (!selectedMethod || !handle.trim()) {
      toast({
        title: 'Missing info',
        description: 'Please select a payment method and enter your payment handle.',
        variant: 'destructive',
      });
      return;
    }

    // Validate Venmo handle format
    if (selectedMethod === 'venmo' && !handle.startsWith('@')) {
      toast({
        title: 'Invalid Venmo handle',
        description: 'Venmo usernames should start with @',
        variant: 'destructive',
      });
      return;
    }

    const updatedProfile: AmbassadorProfile = {
      name: currentProfile?.name || '',
      bio: currentProfile?.bio,
      email: currentProfile?.email,
      imageUrl: currentProfile?.imageUrl,
      createdAt: currentProfile?.createdAt || new Date().toISOString(),
      paymentMethod: selectedMethod,
      paymentHandle: handle.trim(),
    };

    const success = await updateProfile(updatedProfile);

    if (success) {
      toast({
        title: 'Payment method saved!',
        description: 'You\'ll receive payments via ' + selectedMethod,
      });
      onSuccess?.();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">Payment Preferences</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <p className="text-sm text-roots-gray mb-6">
          Choose how you'd like to receive your commission payments.
          Payments are sent monthly.
        </p>

        {/* Payment Method Selection */}
        <div className="space-y-3 mb-6">
          <Label>Payment Method</Label>
          <div className="grid grid-cols-3 gap-2">
            {PAYMENT_METHODS.map((method) => (
              <button
                key={method.id}
                onClick={() => {
                  setSelectedMethod(method.id);
                  setHandle(''); // Clear handle when changing method
                }}
                className={`p-3 rounded-lg border-2 transition-all ${
                  selectedMethod === method.id
                    ? 'border-roots-primary bg-roots-primary/5'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="text-2xl mb-1">{method.icon}</div>
                <div className="text-sm font-medium">{method.label}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Payment Handle Input */}
        {selectedMethod && (
          <div className="space-y-2 mb-6">
            <Label htmlFor="payment-handle">
              {selectedMethod === 'venmo' && 'Venmo Username'}
              {selectedMethod === 'paypal' && 'PayPal Email'}
              {selectedMethod === 'zelle' && 'Zelle Email or Phone'}
            </Label>
            <Input
              id="payment-handle"
              type={selectedMethod === 'venmo' ? 'text' : 'email'}
              placeholder={PAYMENT_METHODS.find(m => m.id === selectedMethod)?.placeholder}
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              className="w-full"
            />
            {selectedMethod === 'venmo' && (
              <p className="text-xs text-roots-gray">
                Include the @ symbol (e.g., @johndoe)
              </p>
            )}
          </div>
        )}

        {/* Info Box */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-6">
          <p className="text-sm text-amber-800">
            <strong>Note:</strong> Cash payments are temporary during pre-launch.
            Once $ROOTS tokens launch, ambassadors will be paid automatically in $ROOTS.
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isPending}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isPending || !selectedMethod || !handle.trim()}
            className="flex-1 bg-roots-primary hover:bg-roots-primary/90"
          >
            {isPending ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  );
}
