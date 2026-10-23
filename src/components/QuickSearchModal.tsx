'use client';

import React, { useState, useMemo } from 'react';
import { Search, X } from 'lucide-react';
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bottom-sheet max-w-lg w-full p-6 relative bg-white border-t sm:border border-black/15 shadow-2xl flex flex-col max-h-[85dvh] rounded-t-[32px] sm:rounded-3xl pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] sm:pb-6">
        {/* Mobile Pull Handle */}
        <div className="w-10 h-1 rounded-full bg-black/20 mx-auto mb-3 sm:hidden shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-black/10">
          <div>
            <h3 className="font-display text-2xl font-bold text-black lowercase">
              search guest
            </h3>
            <p className="font-sans-clean text-xs text-black/60 lowercase">
              select customer to load on barman station
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
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
            placeholder="type name (e.g. janek) or tag (e.g. 001)..."
            value={query}
            autoFocus
            onChange={e => setQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-black/[0.04] border border-black/12 rounded-full text-sm font-sans-clean outline-none focus:border-black transition-colors placeholder:text-black/35 text-black"
          />
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {filteredGuests.length === 0 ? (
            <div className="text-center py-10 text-black/40 font-sans-clean text-xs lowercase">
              no matching guests found
            </div>
          ) : (
            filteredGuests.map(guest => {
              const limit = calculateEffectiveLimit(guest, settings);
              const isAtLimit = guest.category !== 'vip' && guest.drinks_consumed >= limit;

              return (
                <div
                  key={guest.id}
                  onClick={() => {
                    onSelectGuest(guest);
                    onClose();
                  }}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between group ${
                    isAtLimit
                      ? 'bg-black/[0.04] border-black/20 hover:bg-black/[0.07]'
                      : 'bg-white border-black/10 hover:border-black/30 hover:bg-black/[0.02]'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-black/[0.05] flex items-center justify-center font-display font-bold text-black border border-black/10 shrink-0 lowercase">
                      {guest.name ? guest.name.charAt(0).toLowerCase() : '#'}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-sans-clean text-sm font-bold text-black lowercase truncate">
                          {guest.name || 'unassigned wristband'}
                        </span>
                        <span className="font-mono text-[10px] bg-black/[0.06] text-black/65 px-2 py-0.5 rounded-full">
                          {guest.tag_id}
                        </span>
                        {guest.category === 'vip' && (
                          <span className="text-[9px] font-sans-clean font-bold tracking-widest px-2 py-0.5 rounded-full bg-black text-white lowercase">
                            vip
                          </span>
                        )}
                        {guest.category === 'driver_minor' && (
                          <span className="text-[9px] font-sans-clean font-bold tracking-widest px-2 py-0.5 rounded-full bg-black/10 text-black/70 lowercase">
                            driver / minor
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-black/45 font-sans-clean lowercase block">
                        {guest.is_entered ? 'checked in at door' : 'not entered yet'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <div className="font-display text-lg font-bold text-black">
                        {guest.drinks_consumed} / {guest.category === 'vip' ? '∞' : limit}
                      </div>
                      <span
                        className={`text-[10px] font-sans-clean font-semibold lowercase ${
                          isAtLimit ? 'text-black font-bold' : 'text-black/45'
                        }`}
                      >
                        {isAtLimit ? 'limit reached' : `${Math.max(0, limit - guest.drinks_consumed)} left`}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="btn-premium py-2 px-3.5 text-[11px] group-hover:bg-black group-hover:text-white transition-all"
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
