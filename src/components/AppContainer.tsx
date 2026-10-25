'use client';

import React from 'react';
import { usePathname } from 'next/navigation';

export function AppContainer({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isProjector = pathname === '/projector';

  if (isProjector) {
    return (
      <main className="flex-1 w-full max-w-[1920px] mx-auto px-2 sm:px-4 lg:px-6 pb-4 transition-[max-width,padding] duration-200">
        {children}
      </main>
    );
  }

  return (
    <main className="flex-1 pb-12 mx-auto w-full max-w-xl md:max-w-4xl lg:max-w-6xl xl:max-w-7xl 2xl:max-w-[1440px] px-4 sm:px-6 lg:px-8 transition-[max-width,padding] duration-200">
      {children}
    </main>
  );
}
