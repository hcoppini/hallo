'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { GlassWater, DoorOpen, Settings, LayoutGrid } from 'lucide-react';
import { usePartyStore } from '@/lib/store';
import { soundSystem } from '@/lib/audio';

export function MobileTabBar() {
  const pathname = usePathname();
  const { guests, logs } = usePartyStore();

  const enteredCount = guests.filter(g => g.is_entered).length;
  const activeDrinksCount = logs.filter(l => !l.is_reverted && l.drink_type !== 'soft').length;

  const tabs = [
    {
      href: '/barman',
      label: 'Bar',
      icon: GlassWater,
      badge: activeDrinksCount > 0 ? `${activeDrinksCount}` : undefined,
    },
    {
      href: '/door',
      label: 'Door',
      icon: DoorOpen,
      badge: enteredCount > 0 ? `${enteredCount}` : undefined,
    },
    {
      href: '/admin',
      label: 'Admin',
      icon: Settings,
    },
    {
      href: '/',
      label: 'Hub',
      icon: LayoutGrid,
    },
  ];

  const handleTabPress = () => {
    soundSystem.vibrate(25);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 pointer-events-auto">
      {/* Native Frosted Glass Tab Bar */}
      <nav className="mx-auto max-w-lg bg-white/90 backdrop-blur-2xl border-t border-black/10 shadow-[0_-8px_30px_rgba(0,0,0,0.06)] px-3 pt-2 pb-[calc(env(safe-area-inset-bottom,0px)+0.5rem)]">
        <div className="flex items-center justify-around">
          {tabs.map(({ href, label, icon: Icon, badge }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                onClick={handleTabPress}
                className={`relative flex flex-col items-center justify-center py-1 px-4 rounded-2xl transition-all duration-200 active:scale-90 ${
                  isActive ? 'text-black' : 'text-black/40 hover:text-black/70'
                }`}
              >
                {/* Active Pill Highlight */}
                {isActive && (
                  <span className="absolute -top-1 w-6 h-0.5 rounded-full bg-black" />
                )}

                <div className="relative">
                  <Icon
                    className={`w-6 h-6 transition-transform duration-200 ${
                      isActive ? 'stroke-[2.5px] scale-110' : 'stroke-[1.75px]'
                    }`}
                  />
                  {badge && (
                    <span className="absolute -top-1.5 -right-2.5 px-1.5 py-0.2 rounded-full bg-black text-white text-[9px] font-mono font-bold leading-tight">
                      {badge}
                    </span>
                  )}
                </div>

                <span
                  className={`text-[10px] font-sans-clean tracking-wider mt-1 transition-all ${
                    isActive ? 'font-bold' : 'font-medium'
                  }`}
                >
                  {label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
