'use client';

import { usePrivy } from '@privy-io/react-auth';

/**
 * Pull contact info from the Privy user object — single source of truth
 * for buyer + seller forms that pre-fill email/phone from login.
 *
 * Doug's principle (Apr 28 2026): buyer and seller work must be consistent.
 * If we have the user's email from Privy, we shouldn't ask them again at
 * checkout, on seller registration, or on profile editing — same rule
 * everywhere.
 *
 * Privy's user object stores email + phone in different shapes depending on
 * how the account was linked (oauth vs email-otp vs phone-otp). The cast
 * here normalizes both shapes — empty string when not present so callers
 * can do `email || ''` without nullable noise.
 */
export function usePrivyContact(): { email: string; phone: string } {
  const { user } = usePrivy();

  if (!user) return { email: '', phone: '' };

  const emailField = (user as unknown as { email?: { address?: string } | string }).email;
  const email =
    typeof emailField === 'string'
      ? emailField
      : emailField?.address || '';

  const phoneField = (user as unknown as { phone?: { number?: string } | string }).phone;
  const phone =
    typeof phoneField === 'string'
      ? phoneField
      : phoneField?.number || '';

  return { email, phone };
}
