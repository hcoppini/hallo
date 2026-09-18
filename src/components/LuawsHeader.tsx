'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { GlassWater, ShieldCheck, DoorOpen, Settings, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { usePartyStore } from '@/lib/store';

export function LuawsHeader() {
  const pathname = usePathname();
  const { settings, isSyncing, isSupabaseConnected } = usePartyStore();

  const links = [
    { href: '/barman', label: 'barman station', icon: GlassWater },
    { href: '/door', label: 'door check-in', icon: DoorOpen },
    { href: '/admin', label: 'admin panel', icon: Settings },
  ];

  return (
    <header className="sticky top-0 z-50 w-full bg-white/80 backdrop-blur-md border-b border-black/10 transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-8 h-20 flex items-center justify-between">
        {/* Brand / Title matching luaws.pl */}
        <Link href="/" className="flex items-center gap-3 group">
          <span className="font-display text-3xl sm:text-4xl font-bold tracking-tighter text-black lowercase group-hover:opacity-70 transition-opacity">
            lua // pass
          </span>
          <span className="hidden sm:inline-block text-[11px] font-sans-clean font-semibold tracking-widest text-black/50 lowercase border border-black/15 px-2.5 py-1 rounded-full">
            halloween edition
          </span>
        </Link>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1 sm:gap-2">
          {links.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-full font-sans-clean text-[11px] sm:text-xs font-semibold tracking-widest lowercase transition-all ${
                  isActive
                    ? 'bg-black text-white shadow-sm'
                    : 'text-black/70 hover:text-black hover:bg-black/5'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="hidden md:inline">{label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Live Status Indicators */}
        <div className="flex items-center gap-3">
          {/* Party Status Badge */}
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-sans-clean font-semibold tracking-wider lowercase border ${
              settings.is_party_active
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-amber-50 text-amber-800 border-amber-200'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                settings.is_party_active ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
              }`}
            />
            <span className="hidden sm:inline">
              {settings.is_party_active ? 'active' : 'paused'}
            </span>
          </div>

          {/* Sync / Connectivity Status */}
          <div
            title={isSupabaseConnected ? 'Cloud connected (Supabase)' : 'Local Offline Mode (Indexed/LocalStorage)'}
            className="flex items-center gap-1 text-[11px] font-sans-clean text-black/50 border border-black/10 px-2.5 py-1.5 rounded-full"
          >
            {isSyncing ? (
              <RefreshCw className="w-3 h-3 animate-spin text-black" />
            ) : isSupabaseConnected ? (
              <Wifi className="w-3 h-3 text-emerald-600" />
            ) : (
              <WifiOff className="w-3 h-3 text-neutral-400" />
            )}
            <span className="hidden lg:inline text-[10px]">
              {isSupabaseConnected ? 'cloud' : 'local'}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
