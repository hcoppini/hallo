'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Search, GlassWater, DoorOpen, Settings, LayoutGrid, LogOut, Menu, X } from 'lucide-react';
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
    if (pathname.startsWith('/t/')) return 'party pass';
    return 'lua // pass';
  };

  const navItems = [
    {
      href: '/barman',
      label: 'barman station',
      sub: 'pour & log drinks',
      icon: GlassWater,
      badge: activeDrinksCount > 0 ? `${activeDrinksCount}` : undefined,
    },
    {
      href: '/door',
      label: 'door check-in',
      sub: 'admit & link tags',
      icon: DoorOpen,
      badge: enteredCount > 0 ? `${enteredCount}` : undefined,
    },
    {
      href: '/admin',
      label: 'admin panel',
      sub: 'limits & guest list',
      icon: Settings,
    },
    {
      href: '/',
      label: 'party hub',
      sub: 'overview & status',
      icon: LayoutGrid,
    },
  ];

  const handleNavClick = () => {
    soundSystem.vibrate(20);
    setIsMenuOpen(false);
  };

  return (
    <>
      <header className="sticky top-0 z-40 w-full bg-white/90 backdrop-blur-xl border-b border-black/10 pt-safe">
        <div
          className={`${
            isAdminRoute ? 'max-w-xl md:max-w-4xl' : 'max-w-xl'
          } mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3 relative transition-[max-width] duration-200`}
        >
          {/* Brand / Page Title */}
          <Link
            href="/"
            className="flex items-center gap-2 active:opacity-60 transition-opacity shrink-0"
          >
            <span className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-black lowercase">
              {getPageTitle()}
            </span>
          </Link>

          {/* Right Controls: Search Guest + Menu Pill */}
          <div className="flex items-center gap-2">
            {pathname === '/barman' && isAuthenticated && (
              <button
                type="button"
                onClick={() => setIsSearchOpen(true)}
                className="btn-premium py-2 px-3.5 text-xs gap-1.5"
              >
                <Search className="w-3.5 h-3.5" />
                <span>search guest</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                soundSystem.vibrate(15);
                setIsMenuOpen(prev => !prev);
              }}
              aria-expanded={isMenuOpen}
              aria-label="Toggle navigation menu"
              className={`inline-flex items-center justify-center gap-1.5 rounded-full px-3.5 py-2 font-sans-clean text-xs font-semibold tracking-widest lowercase border transition-all cursor-pointer active:scale-95 ${
                isMenuOpen
                  ? 'bg-black text-white border-black shadow-sm'
                  : 'bg-black/[0.04] hover:bg-black/[0.08] text-black border-black/12'
              }`}
            >
              {isMenuOpen ? <X className="w-3.5 h-3.5" /> : <Menu className="w-3.5 h-3.5" />}
              <span>menu</span>
            </button>
          </div>

          {/* Anchored Dropdown Navigation Card (luaws.pl Glassmorphism) */}
          {isMenuOpen && (
            <div className="absolute right-4 sm:right-6 top-[calc(100%+0.5rem)] w-64 glass-card p-2 border border-black/12 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150">
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

      {/* Transparent click-outside overlay when menu is open */}
      {isMenuOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/[0.04]"
          onClick={() => setIsMenuOpen(false)}
        />
      )}
    </>
  );
}
