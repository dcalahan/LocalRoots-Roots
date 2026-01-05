'use client';

import { GardenAIChat } from '@/components/grow/GardenAIChat';

export default function SellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {children}
      <GardenAIChat />
    </>
  );
}
