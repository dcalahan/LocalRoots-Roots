'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';

/**
 * Generic printable QR poster primitive.
 *
 * Turn any URL into a letter-sized (8.5×11) poster with a QR code.
 * Used by community gardens, sellers, ambassadors, and email campaigns.
 *
 * Query params:
 *   ?url=<target URL to encode>          (required)
 *   &title=<big title>                   (optional)
 *   &eyebrow=<small label above title>   (optional, e.g. "COMMUNITY GARDEN")
 *   &tagline=<subheadline under title>   (optional)
 *   &accent=coral|teal                   (optional, default coral)
 *
 * Example:
 *   /poster?url=https://www.localroots.love/garden/heritage-farm-hhi
 *          &title=Heritage%20Farm%20at%20Sea%20Pines
 *          &eyebrow=COMMUNITY%20GARDEN
 *          &tagline=Fresh%20food%20grown%20a%20few%20feet%20from%20here.
 *          &accent=teal
 */
function PosterInner() {
  const sp = useSearchParams();
  const url = sp.get('url') || '';
  const title = sp.get('title') || 'LocalRoots';
  const eyebrow = sp.get('eyebrow') || '';
  const tagline = sp.get('tagline') || 'Scan to buy fresh local food.';
  const accent = sp.get('accent') === 'teal' ? 'teal' : 'coral';

  // Explicit class maps so Tailwind JIT can see the literals
  const cls = accent === 'teal'
    ? {
        bg: 'bg-roots-secondary',
        bgHover: 'hover:bg-roots-secondary/90',
        text: 'text-roots-secondary',
      }
    : {
        bg: 'bg-roots-primary',
        bgHover: 'hover:bg-roots-primary/90',
        text: 'text-roots-primary',
      };

  const handlePrint = () => {
    if (typeof window !== 'undefined') window.print();
  };

  if (!url) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-bold text-gray-900 mb-2">
            Missing `url` parameter
          </h1>
          <p className="text-roots-gray text-sm">
            Pass a `?url=` query string pointing at the page the QR code
            should open.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4 print:p-0 print:bg-white">
      {/* Controls (hidden in print) */}
      <div className="max-w-2xl mx-auto mb-6 print:hidden flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Printable poster</h1>
          <p className="text-sm text-roots-gray">
            Print on letter-size paper and post where people will scan it.
          </p>
        </div>
        <button
          onClick={handlePrint}
          className={`px-5 py-2.5 rounded-xl ${cls.bg} ${cls.bgHover} text-white font-semibold transition-colors`}
        >
          Print poster
        </button>
      </div>

      {/* Poster */}
      <div
        className="mx-auto bg-white shadow-lg print:shadow-none print:mx-0"
        style={{
          width: '8.5in',
          height: '11in',
          maxWidth: '100%',
          padding: '0.75in',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'space-between',
          textAlign: 'center',
        }}
      >
        <div className={`w-full h-2 ${cls.bg} rounded-full mb-6`} />

        <div>
          {eyebrow && (
            <p
              className={`${cls.text} font-semibold mb-2`}
              style={{ fontSize: '18pt', letterSpacing: '0.08em' }}
            >
              {eyebrow}
            </p>
          )}
          <h1
            className="text-gray-900 font-bold leading-tight"
            style={{ fontSize: '44pt' }}
          >
            {title}
          </h1>
        </div>

        <div className="max-w-lg">
          <p
            className="text-gray-900 font-semibold"
            style={{ fontSize: '28pt', lineHeight: 1.2 }}
          >
            {tagline}
          </p>
          <p
            className="text-roots-gray mt-4"
            style={{ fontSize: '16pt' }}
          >
            Scan with your phone camera.
          </p>
        </div>

        <div className="flex flex-col items-center">
          <div className="p-4 bg-white border-4 border-gray-900 rounded-2xl">
            <QRCodeSVG value={url} size={280} level="H" includeMargin={false} />
          </div>
          <p
            className="mt-4 font-mono text-gray-700"
            style={{ fontSize: '12pt' }}
          >
            {url.replace(/^https?:\/\//, '')}
          </p>
        </div>

        <div
          className="w-full border-t-2 border-gray-200 pt-4"
          style={{ fontSize: '13pt' }}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <p className={`font-bold ${cls.text}`}>1. Scan</p>
              <p className="text-roots-gray text-sm">Open your phone camera</p>
            </div>
            <div className="flex-1">
              <p className={`font-bold ${cls.text}`}>2. Pick</p>
              <p className="text-roots-gray text-sm">See what&apos;s available today</p>
            </div>
            <div className="flex-1">
              <p className={`font-bold ${cls.text}`}>3. Pay</p>
              <p className="text-roots-gray text-sm">Credit card. No app needed.</p>
            </div>
          </div>
        </div>

        <div className="w-full">
          <p
            className="text-gray-900 font-semibold"
            style={{ fontSize: '14pt' }}
          >
            🌱 LocalRoots
          </p>
          <p
            className="text-roots-gray italic"
            style={{ fontSize: '11pt' }}
          >
            Neighbors feeding neighbors
          </p>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          @page {
            size: letter;
            margin: 0;
          }
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>
    </div>
  );
}

export default function PosterPage() {
  return (
    <Suspense fallback={null}>
      <PosterInner />
    </Suspense>
  );
}
