'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { logoutStaff } from '@/lib/auth';
import { CheckCircle2, ShieldOff, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function LogoutPage() {
  const router = useRouter();
  const [cleared, setCleared] = useState(false);

  useEffect(() => {
    logoutStaff();
    // Also clear any legacy cookies/storage explicitly
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('halloween_party_staff_auth_v1');
        document.cookie = 'halloween_staff_session=; max-age=0; path=/; SameSite=Lax';
        window.dispatchEvent(new Event('halloween_party_auth_change'));
      } catch {}
    }
    setCleared(true);
  }, []);

  return (
    <div className="w-full py-16 px-4 max-w-sm mx-auto text-center space-y-6">
      <div className="w-16 h-16 rounded-3xl bg-black/5 flex items-center justify-center mx-auto text-black border border-black/10">
        <ShieldOff className="w-8 h-8 text-black/70" />
      </div>

      <div>
        <span className="font-mono text-[10px] text-black/40 uppercase tracking-widest block mb-1">
          SESSION CLEARED
        </span>
        <h1 className="font-display text-3xl font-bold lowercase text-black">
          logged out
        </h1>
        <p className="font-sans-clean text-xs text-black/60 mt-1 max-w-xs mx-auto">
          All staff privileges have been revoked from this device. NFC taps on this device will now display read-only guest passes.
        </p>
      </div>

      <div className="pt-4 space-y-2">
        <Link
          href="/"
          className="btn-premium-primary w-full py-3.5 text-xs flex items-center justify-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Home</span>
        </Link>
      </div>
    </div>
  );
}
