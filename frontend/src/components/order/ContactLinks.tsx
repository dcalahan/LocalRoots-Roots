'use client';

/**
 * ContactLinks — clickable address + phone fields for order contact info.
 *
 * Used in BOTH directions of the marketplace:
 *   - Seller delivery flow: shows buyer's delivery address + phone
 *   - Buyer pickup flow: shows seller's pickup address + phone
 *
 * Per Buyer/Seller Parity principle (CLAUDE.md), both sides get the same
 * affordances: tap address → opens maps app (Apple Maps / Google Maps /
 * Waze depending on device), tap phone → opens dialer, separate tap →
 * opens SMS composer pre-addressed.
 *
 * No PII custody concern: we're just wiring up `tel:`, `sms:`, and maps
 * URL schemes. The seller's SMS app composes the message, not LR. The
 * data being clicked was already on-screen for the user to see.
 *
 * Doug, Apr 29 2026: "I should be able to click on it to open up Waze,
 * Google Maps, etc.... Would be great to be able to click [the phone]
 * and text him."
 */

interface AddressLinkProps {
  address: string;
  className?: string;
}

/**
 * Renders an address as a tappable link that opens the user's preferred
 * maps app. Uses Google Maps' universal "directions" URL — on mobile this
 * launches the Google Maps app or Apple Maps, on desktop it opens in a
 * browser. Drivers who prefer Waze can copy/paste from there.
 */
export function AddressLink({ address, className = '' }: AddressLinkProps) {
  const encoded = encodeURIComponent(address);
  // Universal maps link — picks the right native app on each platform.
  const href = `https://www.google.com/maps/dir/?api=1&destination=${encoded}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`underline decoration-dotted underline-offset-2 hover:decoration-solid ${className}`}
      aria-label={`Get directions to ${address}`}
    >
      {address}
    </a>
  );
}

interface PhoneLinkProps {
  phone: string;
  /** Optional pre-filled message body for the SMS composer. */
  smsBody?: string;
  className?: string;
}

/**
 * Renders a phone number with two tap targets — Call and Text — sitting
 * right next to it. Native iOS + Android dialers/SMS apps handle the
 * intent. No backend involvement.
 *
 * The phone number itself is also tappable as `tel:` for users who just
 * see a number and reflexively tap.
 */
export function PhoneLink({ phone, smsBody, className = '' }: PhoneLinkProps) {
  // Strip non-digit chars except leading + so URL schemes work consistently.
  // tel: + sms: handle digits, +, -, ( ), spaces — but normalizing avoids
  // edge cases on older Android dialers.
  const sanitized = phone.replace(/[^\d+]/g, '');
  const telHref = `tel:${sanitized}`;
  // SMS scheme: iOS uses `sms:?body=`, Android uses `sms:?body=`. Both work.
  const smsHref = smsBody
    ? `sms:${sanitized}?body=${encodeURIComponent(smsBody)}`
    : `sms:${sanitized}`;

  return (
    <span className={`inline-flex items-center gap-2 flex-wrap ${className}`}>
      <a
        href={telHref}
        className="underline decoration-dotted underline-offset-2 hover:decoration-solid"
        aria-label={`Call ${phone}`}
      >
        {phone}
      </a>
      <a
        href={telHref}
        className="text-xs px-2 py-0.5 rounded-full bg-roots-secondary/10 text-roots-secondary hover:bg-roots-secondary/20 font-medium"
        aria-label={`Call ${phone}`}
      >
        📞 Call
      </a>
      <a
        href={smsHref}
        className="text-xs px-2 py-0.5 rounded-full bg-roots-secondary/10 text-roots-secondary hover:bg-roots-secondary/20 font-medium"
        aria-label={`Text ${phone}`}
      >
        💬 Text
      </a>
    </span>
  );
}
