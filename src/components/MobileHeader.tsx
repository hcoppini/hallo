'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Wifi, WifiOff, RefreshCw, HelpCircle } from 'lucide-react';
import { usePartyStore } from '@/lib/store';
import { HelpGuideModal } from '@/components/HelpGuideModal';

export function MobileHeader() {
  const pathname = usePathname();
  const { settings, isSyncing, isSupabaseConnected } = usePartyStore();
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  const getPageTitle = () => {
    if (pathname === '/barman') return 'barman station';
    if (pathname === '/door') return 'door check-in';
    if (pathname === '/admin') return 'admin panel';
    if (pathname.startsWith('/t/')) return 'party pass';
    return 'halloween pass';
  };

  return (
    <>
      <header className="sticky top-0 z-40 w-full bg-white/85 backdrop-blur-xl border-b border-black/8 pt-safe">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          {/* Title / Identity */}
          <Link href="/" className="flex items-center gap-2 active:opacity-60 transition-opacity">
            <span className="font-display text-2xl font-bold tracking-tight text-black lowercase">
              {getPageTitle()}
            </span>
          </Link>

          {/* Status Indicators & Help */}
          <div className="flex items-center gap-2">
            {/* Help Guide Button */}
            <button
              type="button"
              onClick={() => setIsHelpOpen(true)}
              className="p-1.5 rounded-full hover:bg-black/5 active:scale-95 text-black/60 hover:text-black transition-all"
              title="Open Step-by-Step Guide"
            >
              <HelpCircle className="w-4 h-4" />
            </button>

            {/* Party Active Status Pill */}
            <div
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-sans-clean font-bold tracking-wider lowercase border ${
                settings.is_party_active
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-amber-50 text-amber-800 border-amber-200'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  settings.is_party_active ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                }`}
              />
              <span>{settings.is_party_active ? 'live' : 'paused'}</span>
            </div>

            {/* Cloud Sync Status */}
            <div
              title={isSupabaseConnected ? 'Connected to Supabase Cloud' : 'Running Offline Local Cache'}
              className="flex items-center p-1.5 rounded-full bg-black/5 text-black/60"
            >
              {isSyncing ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-black" />
              ) : isSupabaseConnected ? (
                <Wifi className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <WifiOff className="w-3.5 h-3.5 text-black/40" />
              )}
            </div>
          </div>
        </div>
      </header>

      {/* In-App Help Guide Modal */}
      <HelpGuideModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
    </>
  );
}
