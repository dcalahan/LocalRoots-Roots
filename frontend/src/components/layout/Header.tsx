'use client';

import Link from 'next/link';

export function Header() {
  return (
    <header className="bg-white border-b border-gray-100">
      <div className="container mx-auto px-4 py-4">
        <Link href="/" className="inline-block">
          <h1 className="font-heading text-3xl md:text-4xl font-bold text-roots-primary">
            local roots
          </h1>
          <p className="text-xs text-roots-gray tracking-wide uppercase">
            Farm Grown. Delivered Home.
          </p>
        </Link>
      </div>
    </header>
  );
}
