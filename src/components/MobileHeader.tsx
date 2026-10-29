'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Search,
  GlassWater,
  DoorOpen,
  Settings,
  LayoutGrid,
  LogOut,
  Menu,
  X,
  Tv,
} from 'lucide-react';
import { usePartyStore } from '@/lib/store';
import { useStaffAuth } from '@/lib/auth';
import { soundSystem } from '@/lib/audio';

export function MobileHeader() {
  const pathname = usePathname();
  const { guests, logs, settings, isSyncing, isSupabaseConnected, setIsSearchOpen } = usePartyStore();
  const { isAuthenticated, logout } = useStaffAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const enteredCount = guests.filter(g => g.is_entered).length;
  const activeDrinksCount = logs.filter(l => !l.is_reverted && l.drink_type !== 'soft').length;
  const isTagRoute = pathname === '/t' || Boolean(pathname?.startsWith('/t/'));
  const isGuestOnlyHeader = isTagRoute && !isAuthenticated;

  // Close menu on route change or Escape key
  useEffect(() => {
    setIsMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!isMenuOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsMenuOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMenuOpen]);

  const getPageTitle = () => {
    if (pathname === '/barman') return 'barman station';
    if (pathname === '/door') return 'door check-in';
    if (pathname === '/admin') return 'admin panel';
    if (pathname === '/projector') return 'projector stage';
    if (isTagRoute) return isAuthenticated ? 'party pass' : 'guest dashboard';
    return 'lua // pass';
  };

  const navItems = [
    {
      href: '/',
      label: 'party hub',
      shortLabel: 'hub',
      sub: 'overview & status',
      icon: LayoutGrid,
    },
    {
      href: '/barman',
      label: 'barman station',
      shortLabel: 'barman',
      sub: 'pour & log drinks',
      icon: GlassWater,
      badge: activeDrinksCount > 0 ? `${activeDrinksCount}` : undefined,
    },
    {
      href: '/door',
      label: 'door check-in',
      shortLabel: 'door',
      sub: 'admit & link tags',
      icon: DoorOpen,
    },
    {
      href: '/admin',
      label: 'admin panel',
      shortLabel: 'admin',
      sub: 'limits & guest list',
      icon: Settings,
    },
    {
      href: '/projector',
      label: 'projector feed',
      shortLabel: 'projector',
      sub: 'music & guest arrivals',
      icon: Tv,
      badge: 'PC',
    },
  ];

  const handleNavClick = () => {
    soundSystem.vibrate(20);
    setIsMenuOpen(false);
  };

  return (
    <>
      <header className="sticky top-0 z-40 w-full bg-white/90 backdrop-blur-xl border-b border-black/10 pt-safe">
        <div className="max-w-xl md:max-w-4xl lg:max-w-6xl xl:max-w-7xl 2xl:max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 h-16 md:h-20 flex items-center justify-between gap-3 relative transition-[max-width,padding,height] duration-200">
          {/* Left: Brand / Page Title */}
          {isGuestOnlyHeader ? (
            <div className="flex items-center gap-3 shrink-0">
              <span className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-black lowercase">
                {getPageTitle()}
              </span>
              <span className="hidden md:inline-block text-[11px] font-sans-clean font-semibold tracking-widest text-black/45 lowercase border border-black/12 px-2.5 py-0.5 rounded-full">
                lua // pass
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              <Link
                href="/"
                className="flex items-center gap-2 active:opacity-60 hover:opacity-75 transition-opacity shrink-0"
              >
                <span className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-black lowercase">
                  lua // pass
                </span>
                {pathname !== '/' && (
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-black/5 text-black/60 border border-black/10">
                    {pathname === '/door'
                      ? 'door'
                      : pathname === '/barman'
                      ? 'bar'
                      : pathname === '/admin'
                      ? 'admin'
                      : pathname === '/projector'
                      ? 'stage'
                      : 'pass'}
                  </span>
                )}
              </Link>
            </div>
          )}

          {/* Center (Tablet & Laptop md+): Native Horizontal Station Navigation Bar */}
          {!isGuestOnlyHeader && (
            <nav
              aria-label="Primary station navigation"
              className="hidden md:flex items-center gap-1 p-1.5 rounded-full bg-black/[0.04] border border-black/10"
            >
              {navItems.map(({ href, label, shortLabel, icon: Icon, badge }) => {
                const isActive = pathname === href;
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={handleNavClick}
                    className={`flex items-center gap-2 px-3.5 lg:px-4 py-2 rounded-full font-sans-clean text-xs font-semibold tracking-wider lowercase transition-all ${
                      isActive
                        ? 'bg-black text-white shadow-sm'
                        : 'text-black/65 hover:text-black hover:bg-black/[0.06]'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span className="hidden xl:inline">{label}</span>
                    <span className="xl:hidden">{shortLabel}</span>
                    {badge && (
                      <span
                        className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold leading-tight ${
                          isActive
                            ? 'bg-white text-black'
                            : 'bg-black/10 text-black/75'
                        }`}
                      >
                        {badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
          )}

          {/* Right Controls */}
          <div className="flex items-center gap-2 shrink-0">

            {/* Staff Exit / Lock Button */}
            {isAuthenticated && (
              <button
                type="button"
                onClick={() => {
                  soundSystem.vibrate(15);
                  logout();
                }}
                title="Lock Staff Station"
                className="inline-flex items-center gap-1.5 rounded-full px-3 sm:px-3.5 py-2 font-sans-clean text-xs font-semibold tracking-wider lowercase bg-black/[0.04] hover:bg-black hover:text-white text-black/75 border border-black/12 transition-all cursor-pointer active:scale-95"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">lock</span>
              </button>
            )}

            {/* Mobile Menu Pill Button (< md) */}
            <button
              type="button"
              onClick={() => {
                soundSystem.vibrate(15);
                setIsMenuOpen(prev => !prev);
              }}
              aria-expanded={isMenuOpen}
              aria-label="Toggle navigation menu"
              className={`md:hidden inline-flex items-center justify-center gap-1.5 rounded-full px-3.5 py-2 font-sans-clean text-xs font-semibold tracking-widest lowercase border transition-all cursor-pointer active:scale-95 ${
                isMenuOpen
                  ? 'bg-black text-white border-black shadow-sm'
                  : 'bg-black/[0.04] hover:bg-black/[0.08] text-black border-black/12'
              }`}
            >
              {isMenuOpen ? <X className="w-3.5 h-3.5" /> : <Menu className="w-3.5 h-3.5" />}
              <span>menu</span>
            </button>
          </div>

          {/* Anchored Dropdown Navigation Card for Mobile (< md) */}
          {isMenuOpen && (
            <div className="md:hidden absolute right-4 sm:right-6 top-[calc(100%+0.5rem)] w-64 glass-card p-2 border border-black/12 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="px-3 py-1.5 mb-1 border-b border-black/8 flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-widest text-black/40">
                  navigation
                </span>
                <span className="font-mono text-[10px] text-black/30">
                  lua // pass
                </span>
              </div>

              <nav className="space-y-1">
                {navItems.map(({ href, label, sub, icon: Icon, badge }) => {
                  const isActive = pathname === href;
                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={handleNavClick}
                      className={`flex items-center justify-between px-3.5 py-2.5 rounded-2xl transition-all active:scale-[0.98] ${
                        isActive
                          ? 'bg-black text-white shadow-sm'
                          : 'text-black/80 hover:text-black hover:bg-black/[0.05]'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Icon
                          className={`w-4 h-4 shrink-0 ${
                            isActive ? 'text-white' : 'text-black/60'
                          }`}
                        />
                        <div className="min-w-0">
                          <span className="font-sans-clean text-xs font-semibold tracking-wider lowercase block leading-tight">
                            {label}
                          </span>
                          <span
                            className={`font-sans-clean text-[10px] lowercase block leading-tight mt-0.5 ${
                              isActive ? 'text-white/65' : 'text-black/45'
                            }`}
                          >
                            {sub}
                          </span>
                        </div>
                      </div>

                      {badge && (
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                            isActive
                              ? 'bg-white text-black'
                              : 'bg-black/8 text-black/70'
                          }`}
                        >
                          {badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </nav>

              {isAuthenticated && (
                <div className="mt-1.5 pt-1.5 border-t border-black/8">
                  <button
                    type="button"
                    onClick={() => {
                      logout();
                      setIsMenuOpen(false);
                    }}
                    className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-black/60 hover:text-black hover:bg-black/[0.05] transition-all text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <LogOut className="w-4 h-4 text-black/50" />
                      <span className="font-sans-clean text-xs font-semibold tracking-wider lowercase">
                        lock station
                      </span>
                    </div>
                    <span className="font-mono text-[10px] uppercase text-black/35">
                      pin
                    </span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Transparent click-outside overlay when mobile menu is open */}
      {isMenuOpen && (
        <div
          className="md:hidden fixed inset-0 z-30 bg-black/[0.04]"
          onClick={() => setIsMenuOpen(false)}
        />
      )}
    </>
  );
}
