'use client';

import React, { useState, useMemo } from 'react';
import { Search, Edit2, Ban, CheckCircle, UserCheck, Shield, AlertTriangle } from 'lucide-react';
import { Guest } from '@/lib/types';
import { usePartyStore } from '@/lib/store';
import { calculateEffectiveLimit } from '@/lib/party-engine';
import { GuestEditModal } from './GuestEditModal';

export function GuestTable() {
  const { guests, settings } = usePartyStore();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'entered' | 'at_limit' | 'vip' | 'driver'>('all');
  const [editingGuest, setEditingGuest] = useState<Guest | null>(null);

  const filteredGuests = useMemo(() => {
    return guests.filter(g => {
      // Text search
      const q = search.trim().toLowerCase();
      const matchesSearch =
        !q ||
        (g.name && g.name.toLowerCase().includes(q)) ||
        g.tag_id.toLowerCase().includes(q) ||
        g.id.toLowerCase().includes(q);

      if (!matchesSearch) return false;

      const limit = calculateEffectiveLimit(g, settings);
      const isAtLimit = g.category !== 'vip' && g.drinks_consumed >= limit;

      // Category filter
      if (categoryFilter === 'entered') return g.is_entered;
      if (categoryFilter === 'at_limit') return isAtLimit;
      if (categoryFilter === 'vip') return g.category === 'vip';
      if (categoryFilter === 'driver') return g.category === 'driver_minor';

      return true;
    });
  }, [guests, search, categoryFilter, settings]);

  return (
    <div className="w-full">
      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-6">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-black/40" />
          <input
            type="text"
            placeholder="Search by name, bracelet tag (TAG-001)..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-black/5 border border-black/10 rounded-2xl text-xs font-sans-clean outline-none focus:border-black transition-colors"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              { id: 'all', label: 'all (100)' },
              { id: 'entered', label: 'entered' },
              { id: 'at_limit', label: 'at limit' },
              { id: 'driver', label: 'drivers/minors' },
              { id: 'vip', label: 'vip' },
            ] as const
          ).map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setCategoryFilter(tab.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-sans-clean font-semibold tracking-wider lowercase transition-all ${
                categoryFilter === tab.id
                  ? 'bg-black text-white shadow-sm'
                  : 'bg-black/5 hover:bg-black/10 text-black/60'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Guests Table */}
      <div className="glass-card overflow-hidden border border-black/10 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-black/10 bg-black/[0.02] text-[11px] font-sans-clean uppercase tracking-widest text-black/50">
                <th className="py-3.5 px-4 font-semibold">Wristband</th>
                <th className="py-3.5 px-4 font-semibold">Guest Name</th>
                <th className="py-3.5 px-4 font-semibold">Category</th>
                <th className="py-3.5 px-4 font-semibold">Status</th>
                <th className="py-3.5 px-4 font-semibold">Drinks / Limit</th>
                <th className="py-3.5 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5 text-xs font-sans-clean">
              {filteredGuests.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-black/40 lowercase">
                    no guests match the current filter
                  </td>
                </tr>
              ) : (
                filteredGuests.map(guest => {
                  const limit = calculateEffectiveLimit(guest, settings);
                  const isAtLimit = guest.category !== 'vip' && guest.drinks_consumed >= limit;
                  const isNearLimit = guest.category !== 'vip' && guest.drinks_consumed === limit - 1;

                  return (
                    <tr
                      key={guest.id}
                      className="hover:bg-black/[0.02] transition-colors group cursor-pointer"
                      onClick={() => setEditingGuest(guest)}
                    >
                      {/* Wristband Tag */}
                      <td className="py-3.5 px-4 font-mono font-bold text-black">
                        {guest.tag_id}
                      </td>

                      {/* Guest Name */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-black text-sm">
                          {guest.name || <span className="text-black/30 font-normal italic">unassigned</span>}
                        </div>
                        {guest.notes && (
                          <span className="text-[10px] text-black/50 block truncate max-w-xs">
                            {guest.notes}
                          </span>
                        )}
                      </td>

                      {/* Category Badge */}
                      <td className="py-3.5 px-4">
                        {guest.category === 'vip' && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 uppercase">
                            VIP
                          </span>
                        )}
                        {guest.category === 'driver_minor' && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-900 uppercase">
                            DRIVER / 0 ALC
                          </span>
                        )}
                        {guest.category === 'standard' && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-black/5 text-black/70 lowercase">
                            standard
                          </span>
                        )}
                      </td>

                      {/* Check-in Status */}
                      <td className="py-3.5 px-4">
                        {guest.is_blocked ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-800 uppercase">
                            <Ban className="w-3 h-3" /> BLOCKED
                          </span>
                        ) : guest.is_entered ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 lowercase">
                            <CheckCircle className="w-3 h-3" /> entered
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] text-black/40 lowercase">
                            outside
                          </span>
                        )}
                      </td>

                      {/* Drinks Consumed & Limit */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className={`font-display text-base font-bold ${
                            isAtLimit ? 'text-red-600' : isNearLimit ? 'text-amber-600' : 'text-black'
                          }`}>
                            {guest.drinks_consumed} / {guest.category === 'vip' ? '∞' : limit}
                          </span>

                          {guest.category !== 'vip' && (
                            <div className="w-16 bg-black/10 rounded-full h-1.5 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  isAtLimit ? 'bg-red-600' : isNearLimit ? 'bg-amber-500' : 'bg-black'
                                }`}
                                style={{
                                  width: `${Math.min(100, (guest.drinks_consumed / (limit || 1)) * 100)}%`,
                                }}
                              />
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingGuest(guest);
                          }}
                          className="p-1.5 rounded-full hover:bg-black/5 text-black/50 hover:text-black transition-colors"
                          title="Edit profile & limit"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Guest Edit Modal */}
      <GuestEditModal
        guest={editingGuest}
        isOpen={Boolean(editingGuest)}
        onClose={() => setEditingGuest(null)}
      />
    </div>
  );
}
