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

        {/* Right side placeholder or exit */}
        <div className="flex items-center gap-3" />
      </div>
    </header>
  );
}
