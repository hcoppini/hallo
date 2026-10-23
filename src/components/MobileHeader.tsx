'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Search, GlassWater, DoorOpen, Settings, LayoutGrid, LogOut, X } from 'lucide-react';
import { usePartyStore } from '@/lib/store';
import { useStaffAuth } from '@/lib/auth';
import { soundSystem } from '@/lib/audio';

export function MobileHeader() {
  const pathname = usePathname();
  const { guests, logs, setIsSearchOpen } = usePartyStore();
  const { isAuthenticated, logout } = useStaffAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const enteredCount = guests.filter(g => g.is_entered).length;
  const activeDrinksCount = logs.filter(l => !l.is_reverted && l.drink_type !== 'soft').length;
  const isAdminRoute = pathname?.startsWith('/admin');

  const getPageTitle = () => {
    if (pathname === '/barman') return 'barman station';
    if (pathname === '/door') return 'door check-in';
    if (pathname === '/admin') return 'admin panel';
    if (pathname.startsWith('/t/')) return 'party pass';
    return 'halloween pass';
  };

  const navItems = [
    {
      href: '/',
      label: 'Hub',
      icon: LayoutGrid,
    },
    {
      href: '/admin',
      label: 'Admin',
      icon: Settings,
    },
    {
      href: '/door',
      label: 'Door',
      icon: DoorOpen,
      badge: enteredCount > 0 ? `${enteredCount}` : undefined,
    },
    {
      href: '/barman',
      label: 'Bar',
      icon: GlassWater,
      badge: activeDrinksCount > 0 ? `${activeDrinksCount}` : undefined,
    },
  ];

  const handleNavClick = () => {
    soundSystem.vibrate(25);
    setIsMenuOpen(false);
  };

  return (
    <>
      <header className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur-xl border-b border-black/10 pt-safe">
        <div
          className={`${
            isAdminRoute ? 'max-w-xl md:max-w-4xl' : 'max-w-xl'
          } mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3 transition-[max-width] duration-200`}
        >
          {/* Title / Identity */}
          <Link href="/" className="flex items-center gap-2 active:opacity-60 transition-opacity shrink-0">
            <span className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-black lowercase">
              {getPageTitle()}
            </span>
          </Link>

          {/* Right Controls: Search Guest (on Barman Station) + Menu ... */}
          <div className="flex items-center gap-3">
            {pathname === '/barman' && isAuthenticated && (
              <button
                type="button"
                onClick={() => setIsSearchOpen(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-black/[0.05] hover:bg-black/[0.09] border border-black/15 text-xs font-sans-clean font-semibold tracking-wider lowercase text-black transition-all active:scale-95"
              >
                <Search className="w-3.5 h-3.5 text-black/70" />
                <span>search guest</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsMenuOpen(prev => !prev)}
              aria-label="Toggle navigation menu"
              className="flex flex-col items-center justify-center px-3 py-1.5 rounded-xl hover:bg-black/5 active:scale-95 transition-all text-black/80 hover:text-black"
            >
              <span className="font-sans-clean text-[11px] font-semibold tracking-wider lowercase leading-none">
                menu
              </span>
              <span className="font-mono text-xs font-bold text-black/60 leading-none tracking-widest mt-0.5">
                ...
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Right-Hand Vertical Slide-Out Navigation Drawer */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-50">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/15 backdrop-blur-[1px] transition-opacity"
            onClick={() => setIsMenuOpen(false)}
          />

          {/* Vertical Sidebar Rail on Right */}
          <aside className="fixed top-0 right-0 bottom-0 w-24 bg-white/95 backdrop-blur-2xl border-l border-black/10 shadow-2xl flex flex-col items-center justify-between py-6 z-50">
            <button
              type="button"
              onClick={() => setIsMenuOpen(false)}
              aria-label="Close menu"
              className="p-2 rounded-full text-black/40 hover:text-black hover:bg-black/5 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <nav className="flex-1 flex flex-col items-center justify-around py-6 w-full">
              {navItems.map(({ href, label, icon: Icon, badge }) => {
                const isActive = pathname === href;
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={handleNavClick}
                    className={`relative flex flex-col items-center justify-center py-3 px-2 w-full transition-all active:scale-90 ${
                      isActive ? 'text-black' : 'text-black/40 hover:text-black/70'
                    }`}
                  >
                    {isActive && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r-full bg-black" />
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
                      className={`text-[11px] font-sans-clean tracking-wider mt-1.5 ${
                        isActive ? 'font-bold text-black' : 'font-medium'
                      }`}
                    >
                      {label}
                    </span>
                  </Link>
                );
              })}
            </nav>

            {isAuthenticated ? (
              <button
                type="button"
                onClick={() => {
                  logout();
                  setIsMenuOpen(false);
                }}
                title="Lock Station"
                className="flex flex-col items-center justify-center py-2 px-2 text-black/40 hover:text-black transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span className="text-[9px] font-sans-clean font-semibold uppercase tracking-wider mt-1">
                  Lock
                </span>
              </button>
            ) : (
              <div className="h-8" />
            )}
          </aside>
        </div>
      )}
    </>
  );
}
