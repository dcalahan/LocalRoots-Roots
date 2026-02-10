import type { Metadata } from 'next';
import { Providers } from './providers';
import { Toaster } from '@/components/ui/toaster';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { TestnetBanner } from '@/components/layout/TestnetBanner';
import './globals.css';

export const metadata: Metadata = {
  title: 'Local Roots - Neighbors Feeding Neighbors',
  description: 'A decentralized marketplace for neighbors to buy and sell homegrown produce',
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
