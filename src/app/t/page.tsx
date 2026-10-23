'use client';

import React, { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

function UniversalTagRouter() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const id = searchParams.get('id') || searchParams.get('tag');
    if (id) {
      router.replace(`/t/${encodeURIComponent(id.trim().toUpperCase())}`);
    } else {
      router.replace('/door');
    }
  }, [router, searchParams]);

  return (
    <div className="w-full py-16 flex flex-col items-center justify-center max-w-sm mx-auto text-center">
      <div className="glass-card p-10 border border-black/15 shadow-xl space-y-4">
        <Loader2 className="w-8 h-8 text-black animate-spin mx-auto" />
        <span className="font-mono text-xs uppercase tracking-widest text-black/50 block">
          RESOLVING WRISTBAND
        </span>
        <p className="font-sans-clean text-xs text-black/60">
          Loading wristband identity...
        </p>
      </div>
    </div>
  );
}

export default function UniversalTagPage() {
  return (
    <Suspense fallback={
      <div className="w-full py-16 flex flex-col items-center justify-center max-w-sm mx-auto text-center">
        <Loader2 className="w-8 h-8 text-black animate-spin mx-auto" />
      </div>
    }>
      <UniversalTagRouter />
    </Suspense>
  );
}
