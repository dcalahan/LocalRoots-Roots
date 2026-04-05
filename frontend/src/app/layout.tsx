import type { Metadata, Viewport } from 'next';
import { Providers } from './providers';
import { Toaster } from '@/components/ui/toaster';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { TestnetBanner } from '@/components/layout/TestnetBanner';
import './globals.css';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  title: 'Local Roots — Your Gardening Companion | Neighbors Feeding Neighbors',
  description: 'AI gardening advice for your exact climate. Track your garden, plan your season, and share your harvest with neighbors.',
  openGraph: {
    title: 'Local Roots — Your Personal Gardening Companion',
    description: 'AI advice for your climate. Track your garden. Share your harvest with neighbors.',
    url: 'https://www.localroots.love',
    siteName: 'Local Roots',
    images: [
      {
        url: 'https://www.localroots.love/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Local Roots — Your Personal Gardening Companion',
      },
    ],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Local Roots — Your Personal Gardening Companion',
    description: 'AI advice for your climate. Track your garden. Share your harvest with neighbors.',
    images: ['https://www.localroots.love/og-image.png'],
  },
  icons: {
    icon: [
      { url: '/favicon.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon-152.png', sizes: '152x152', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/icon-152.png', sizes: '152x152', type: 'image/png' },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">
        <Providers>
          <TestnetBanner />
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
