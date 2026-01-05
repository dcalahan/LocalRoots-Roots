'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UnifiedWalletButton } from '@/components/UnifiedWalletButton';
import { useCart } from '@/contexts/CartContext';

export function Header() {
  const pathname = usePathname();
  const { getItemCount } = useCart();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch - only apply active styles after mount
  useEffect(() => {
    setMounted(true);
  }, []);

  const itemCount = getItemCount();

  const isActive = (path: string) => {
    // Don't highlight anything until mounted to prevent hydration mismatch
    if (!mounted) return false;
    // Exact match for /buy to avoid highlighting both Shop and Orders
    if (path === '/buy') {
      return pathname === '/buy' || pathname === '/buy/listings' || pathname.startsWith('/buy/listings/') || pathname.startsWith('/buy/sellers/');
    }
    return pathname.startsWith(path);
  };

  const navLinks = [
    { href: '/buy', label: 'Shop' },
    { href: '/buy/orders', label: 'Orders' },
    { href: '/sell', label: 'Sell' },
    { href: '/grow', label: 'Grow' },
    { href: '/ambassador', label: 'Ambassadors' },
    { href: '/about/vision', label: 'About' },
  ];

  return (
    <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="inline-block">
            <h1 className="font-heading text-2xl md:text-3xl font-bold text-roots-primary">
              local roots
            </h1>
            <p className="text-xs text-roots-gray tracking-wide uppercase hidden sm:block">
              Farm Grown. Delivered Home.
            </p>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-4">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive(link.href)
                    ? 'bg-roots-primary/10 text-roots-primary'
                    : 'text-gray-600 hover:text-roots-primary hover:bg-gray-50'
                }`}
              >
                {link.label}
              </Link>
            ))}

            {/* Cart icon */}
            <Link
              href="/buy/cart"
              className="relative p-2 rounded-lg text-gray-600 hover:text-roots-primary hover:bg-gray-50 transition-colors"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
              {itemCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-roots-primary text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-medium">
                  {itemCount > 9 ? '9+' : itemCount}
                </span>
              )}
            </Link>

            {/* Wallet connect */}
            <div className="ml-2">
              <UnifiedWalletButton />
            </div>
          </nav>

          {/* Mobile Navigation */}
          <div className="flex md:hidden items-center gap-2">
            {/* Cart icon (mobile) */}
            <Link
              href="/buy/cart"
              className="relative p-2 rounded-lg text-gray-600 hover:text-roots-primary hover:bg-gray-50 transition-colors"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
              {itemCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-roots-primary text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-medium">
                  {itemCount > 9 ? '9+' : itemCount}
                </span>
              )}
            </Link>

            {/* Hamburger menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-gray-600 hover:text-roots-primary hover:bg-gray-50 transition-colors"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu Dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-100 mt-3 pt-3">
            <nav className="flex flex-col gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`px-3 py-3 rounded-lg text-sm font-medium transition-colors ${
                    isActive(link.href)
                      ? 'bg-roots-primary/10 text-roots-primary'
                      : 'text-gray-600 hover:text-roots-primary hover:bg-gray-50'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              <div className="pt-2 pb-1 px-3">
                <UnifiedWalletButton />
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
