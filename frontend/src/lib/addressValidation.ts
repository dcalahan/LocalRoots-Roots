/**
 * Shared address validation for any place we collect a US street address
 * from a user — buyer delivery, seller pickup, future flows.
 *
 * Doug's principle (Apr 28 2026): buyer and seller flows must enforce the
 * same standards. Don't accept "88 cypress marsh dr" as a complete address
 * on the buyer side AND let it through on the seller side. One source of
 * truth.
 *
 * What "complete" means here, pragmatically:
 *   - Has a street component (just any non-empty trimmed text)
 *   - Has either a comma (suggests "street, city, state ZIP") OR a 5-digit
 *     ZIP code somewhere in the string (some users format "123 Main St
 *     29928" without commas)
 *
 * This isn't an RFC-perfect address parser. It catches the most common
 * incomplete-address footgun (typing only a street name) without forcing
 * users into rigid structured fields. When we adopt a Google Places
 * autocomplete or similar, replace this module — every consumer goes
 * through one function.
 */

export interface AddressValidationResult {
  ok: boolean;
  /** User-facing message when ok is false. Null when ok. */
  error: string | null;
}

const COMPLETION_HINT =
  'Include street, city, state, and ZIP — e.g. "123 Main St, Hilton Head, SC 29928".';

/**
 * Validate a US street address string.
 *
 * @param raw   The address text. Untrimmed input is fine.
 * @param required  If true, empty addresses fail. If false, empty is ok
 *                  (e.g. seller chose pickup-only and no delivery flow
 *                  needs an address). Defaults to true.
 */
export function validateAddress(
  raw: string,
  required: boolean = true,
): AddressValidationResult {
  const trimmed = raw.trim();

  if (!trimmed) {
    return required
      ? { ok: false, error: 'Address is required.' }
      : { ok: true, error: null };
  }

  const hasComma = trimmed.includes(',');
  const hasZip = /\b\d{5}(-\d{4})?\b/.test(trimmed);

  if (!hasComma && !hasZip) {
    return {
      ok: false,
      error: `Address looks incomplete. ${COMPLETION_HINT}`,
    };
  }

  return { ok: true, error: null };
}

/**
 * Validate a basic email format. Not RFC-perfect; catches typos.
 */
export function validateEmail(raw: string): AddressValidationResult {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, error: 'Email is required.' };
  }
  if (!/^\S+@\S+\.\S+$/.test(trimmed)) {
    return { ok: false, error: "That email doesn't look right — check the format." };
  }
  return { ok: true, error: null };
}
