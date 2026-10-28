'use client';

import React, { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { usePartyStore } from '@/lib/store';
import { subscribeToTagRelay } from '@/lib/tag-relay';
import { parseTagId, findRegisteredGuestByTag, isUniversalOnboardingTag } from '@/lib/tag-utils';
import { soundSystem } from '@/lib/audio';

export function AppContainer({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { guests } = usePartyStore();
  const isProjector = pathname === '/projector';
  const isCompactView = pathname === '/barman' || pathname === '/door';

  // Global NFC tap router: whenever an unregistered sticker is tapped anywhere in the app,
  // route to the Door Check-In console and prompt to create a new guest.
  useEffect(() => {
    if (pathname === '/door' || pathname === '/barman' || pathname.startsWith('/t/')) {
      return;
    }

    const unsubscribe = subscribeToTagRelay(msg => {
      if (msg.type === 'TAG_TAPPED' && (msg.tagId || msg.rawId)) {
        const rawTag = msg.tagId || msg.rawId || '';
        if (isUniversalOnboardingTag(rawTag)) return;

        const parsed = parseTagId(rawTag);
        const canonical = parsed.canonicalTag || rawTag.toUpperCase();
        const registered = findRegisteredGuestByTag(guests, canonical);

        if (!registered) {
          soundSystem.playApprovedSound();
          const pinParam =
            typeof window !== 'undefined'
              ? new URLSearchParams(window.location.search).get('pin')
              : null;
          const pinSuffix = pinParam ? `&pin=${encodeURIComponent(pinParam)}` : '';
          router.push(`/door?tag=${encodeURIComponent(canonical)}&unregistered=1${pinSuffix}`);
        }
      }
    });

    return () => unsubscribe();
  }, [pathname, router, guests]);

  if (isProjector) {
    return (
      <main className="flex-1 w-full max-w-[1920px] mx-auto px-2 sm:px-4 lg:px-6 pb-4 transition-[max-width,padding] duration-200">
        {children}
      </main>
    );
  }

  return (
    <main
      className={`flex-1 mx-auto w-full max-w-xl md:max-w-4xl lg:max-w-6xl xl:max-w-7xl 2xl:max-w-[1440px] px-3 sm:px-6 lg:px-8 transition-[max-width,padding] duration-200 ${
        isCompactView ? 'pb-3 sm:pb-4 lg:pb-5' : 'pb-12'
      }`}
    >
      {children}
    </main>
  );
}
