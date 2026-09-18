'use client';

import React, { useState, useMemo } from 'react';
import { Search, X, User, GlassWater, AlertCircle } from 'lucide-react';
import { usePartyStore } from '@/lib/store';
import { Guest, DrinkType } from '@/lib/types';
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
      // Show entered guests first
      return guests.filter(g => g.is_entered).slice(0, 15);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-in fade-in duration-200">
      <div className="glass-card max-w-lg w-full p-6 relative border border-black/15 shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-black/10">
          <div>
            <h3 className="font-display text-2xl font-bold text-black lowercase">
              quick guest search
            </h3>
            <p className="font-sans-clean text-xs text-black/60 lowercase">
              manual barman lookup fallback
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-black/40 hover:text-black hover:bg-black/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative my-4">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-black/40" />
          <input
            type="text"
            placeholder="Type name (e.g. Kasia) or tag (e.g. 042)..."
            value={query}
            autoFocus
            onChange={e => setQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-black/5 border border-black/10 rounded-2xl text-sm font-sans-clean outline-none focus:border-black transition-colors placeholder:text-black/30 text-black"
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
                      ? 'bg-red-50/70 border-red-200 hover:bg-red-100/70'
                      : 'bg-white/80 border-black/10 hover:border-black/30 hover:bg-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-black/5 flex items-center justify-center font-display font-bold text-black border border-black/10">
                      {guest.name ? guest.name.charAt(0).toUpperCase() : '#'}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-sans-clean text-sm font-bold text-black">
                          {guest.name || 'Unassigned Wristband'}
                        </span>
                        <span className="font-mono text-[10px] bg-black/5 text-black/60 px-1.5 py-0.5 rounded">
                          {guest.tag_id}
                        </span>
                        {guest.category === 'vip' && (
                          <span className="text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 uppercase">
                            VIP
                          </span>
                        )}
                        {guest.category === 'driver_minor' && (
                          <span className="text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded bg-blue-100 text-blue-900 uppercase">
                            DRIVER / MINOR
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-black/50 font-sans-clean lowercase">
                        {guest.is_entered ? 'checked in at door' : 'not entered yet'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="font-display text-lg font-bold text-black">
                        {guest.drinks_consumed} / {guest.category === 'vip' ? '∞' : limit}
                      </div>
                      <span
                        className={`text-[10px] font-sans-clean font-semibold lowercase ${
                          isAtLimit ? 'text-red-600' : 'text-black/50'
                        }`}
                      >
                        {isAtLimit ? 'limit reached' : `${Math.max(0, limit - guest.drinks_consumed)} left`}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="btn-premium py-2 px-3 text-[11px] group-hover:bg-black group-hover:text-white transition-all"
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
