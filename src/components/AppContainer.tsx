'use client';

import React from 'react';
import { usePathname } from 'next/navigation';

export function AppContainer({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdminRoute = pathname?.startsWith('/admin');

  return (
    <div
      className={`flex-1 pb-12 mx-auto w-full px-4 sm:px-6 transition-[max-width] duration-200 ${
        isAdminRoute ? 'max-w-xl md:max-w-4xl' : 'max-w-xl'
      }`}
    >
      {children}
    </div>
  );
}
