'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Search, X, CornerDownLeft, Keyboard } from 'lucide-react';
import { usePartyStore } from '@/lib/store';
import { Guest } from '@/lib/types';
import { calculateEffectiveLimit } from '@/lib/party-engine';

interface QuickSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectGuest: (guest: Guest) => void;
}

export function QuickSearchModal({
  isOpen,
  onClose,
  onSelectGuest,
}: QuickSearchModalProps) {
  const { guests, settings } = usePartyStore();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const filteredGuests = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      const entered = guests.filter(g => g.is_entered);
      if (entered.length > 0) {
        return entered.slice(0, 20);
      }
      return guests.slice(0, 15);
    }
    return guests
      .filter(
        g =>
          (g.name && g.name.toLowerCase().includes(q)) ||
          g.tag_id.toLowerCase().includes(q) ||
          g.id.toLowerCase().includes(q)
      )
      .slice(0, 20);
  }, [guests, query]);

  // Reset selectedIndex whenever query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const selectCurrent = useCallback(() => {
    if (filteredGuests.length > 0 && selectedIndex < filteredGuests.length) {
      onSelectGuest(filteredGuests[selectedIndex]);
      onClose();
    }
  }, [filteredGuests, selectedIndex, onSelectGuest, onClose]);

  // Keyboard navigation for laptop / desktop users
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1 < filteredGuests.length ? prev + 1 : prev));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 >= 0 ? prev - 1 : 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        selectCurrent();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredGuests, selectCurrent, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200 p-0 sm:p-4">
      <div className="bottom-sheet max-w-lg sm:max-w-xl md:max-w-2xl w-full p-6 sm:p-7 relative bg-white border-t sm:border border-black/15 shadow-2xl flex flex-col max-h-[88dvh] rounded-t-[32px] sm:rounded-3xl pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] sm:pb-6">
        {/* Mobile Pull Handle */}
        <div className="w-10 h-1 rounded-full bg-black/20 mx-auto mb-3 sm:hidden shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-black/10">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-display text-2xl font-bold text-black lowercase">
                search guest
              </h3>
              <div className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/[0.04] text-[10px] font-mono text-black/50">
                <Keyboard className="w-3 h-3 text-black/40" />
                <span>↑↓ navigate • enter to select • esc</span>
              </div>
            </div>
            <p className="font-sans-clean text-xs text-black/60 lowercase mt-0.5">
              select customer to load on barman station
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            title="Close (Esc)"
            className="p-1.5 rounded-full text-black/40 hover:text-black hover:bg-black/5 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative my-4">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-black/40" />
          <input
            type="text"
            placeholder="type name (e.g. janek) or wristband tag (e.g. 001)..."
            value={query}
            autoFocus
            onChange={e => setQuery(e.target.value)}
            className="w-full pl-10 pr-24 py-3 bg-black/[0.04] border border-black/12 rounded-2xl sm:rounded-full text-sm font-sans-clean outline-none focus:border-black transition-colors placeholder:text-black/35 text-black"
          />
          <span className="hidden sm:inline-flex items-center gap-1 absolute right-3.5 top-1/2 -translate-y-1/2 font-mono text-[10px] text-black/40 bg-black/5 px-2 py-0.5 rounded">
            <span>enter</span>
            <CornerDownLeft className="w-2.5 h-2.5" />
          </span>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 no-scrollbar">
          {filteredGuests.length === 0 ? (
            <div className="text-center py-12 text-black/40 font-sans-clean text-xs lowercase">
              no matching guests found
            </div>
          ) : (
            filteredGuests.map((guest, idx) => {
              const limit = calculateEffectiveLimit(guest, settings);
              const isAtLimit = guest.category !== 'vip' && guest.drinks_consumed >= limit;
              const isSelected = idx === selectedIndex;

              return (
                <div
                  key={guest.id}
                  onClick={() => {
                    onSelectGuest(guest);
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between group ${
                    isSelected
                      ? 'bg-black text-white border-black shadow-md'
                      : isAtLimit
                      ? 'bg-black/[0.03] border-black/15 hover:bg-black/[0.06] text-black'
                      : 'bg-white border-black/10 hover:border-black/30 hover:bg-black/[0.02] text-black'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center font-display font-bold shrink-0 lowercase text-base border ${
                        isSelected
                          ? 'bg-white/10 text-white border-white/20'
                          : 'bg-black/[0.05] text-black border-black/10'
                      }`}
                    >
                      {guest.name ? guest.name.charAt(0).toLowerCase() : '#'}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`font-sans-clean text-sm font-bold lowercase truncate ${
                            isSelected ? 'text-white' : 'text-black'
                          }`}
                        >
                          {guest.name || 'unassigned wristband'}
                        </span>
                        <span
                          className={`font-mono text-[10px] px-2 py-0.5 rounded-full ${
                            isSelected
                              ? 'bg-white/20 text-white'
                              : 'bg-black/[0.06] text-black/65'
                          }`}
                        >
                          {guest.tag_id}
                        </span>
                        {guest.category === 'vip' && (
                          <span
                            className={`text-[9px] font-sans-clean font-bold tracking-widest px-2 py-0.5 rounded-full lowercase ${
                              isSelected
                                ? 'bg-amber-400 text-black'
                                : 'bg-black text-white'
                            }`}
                          >
                            vip
                          </span>
                        )}
                        {guest.category === 'driver_minor' && (
                          <span
                            className={`text-[9px] font-sans-clean font-bold tracking-widest px-2 py-0.5 rounded-full lowercase ${
                              isSelected
                                ? 'bg-white/20 text-white'
                                : 'bg-black/10 text-black/70'
                            }`}
                          >
                            driver / minor
                          </span>
                        )}
                      </div>
                      <span
                        className={`text-[11px] font-sans-clean lowercase block ${
                          isSelected ? 'text-white/70' : 'text-black/45'
                        }`}
                      >
                        {guest.is_entered ? 'checked in at door' : 'not entered yet'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <div
                        className={`font-display text-lg font-bold leading-tight ${
                          isSelected ? 'text-white' : 'text-black'
                        }`}
                      >
                        {guest.drinks_consumed} / {guest.category === 'vip' ? '∞' : limit}
                      </div>
                      <span
                        className={`text-[10px] font-sans-clean lowercase ${
                          isSelected
                            ? 'text-white/80 font-medium'
                            : isAtLimit
                            ? 'text-black font-bold'
                            : 'text-black/45'
                        }`}
                      >
                        {isAtLimit ? 'limit reached' : `${Math.max(0, limit - guest.drinks_consumed)} left`}
                      </span>
                    </div>
                    <button
                      type="button"
                      className={`py-2 px-3.5 text-[11px] rounded-xl font-sans-clean font-bold transition-all ${
                        isSelected
                          ? 'bg-white text-black'
                          : 'btn-premium group-hover:bg-black group-hover:text-white'
                      }`}
                    >
                      select
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
