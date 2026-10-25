'use client';

import React, { useState, useMemo } from 'react';
import {
  GlassWater,
  Beer,
  Wine,
  Sparkles,
  CupSoda,
  RotateCcw,
  Search,
  X,
  Eye,
  EyeOff,
  Activity,
} from 'lucide-react';
import { Guest, formatDrinkHistoryLabel } from '@/lib/types';
import { usePartyStore } from '@/lib/store';
import { DrinkCategory, computeAdminKpis, getDrinkCategory } from '@/lib/admin-utils';
import { GuestEditModal } from './GuestEditModal';

const drinkCategoryIcons: Record<DrinkCategory, React.ElementType> = {
  cocktail: Sparkles,
  beer: Beer,
  shot: GlassWater,
  wine: Wine,
  soft: CupSoda,
};

const drinkCategoryLabels: Record<DrinkCategory, string> = {
  cocktail: 'cocktails',
  beer: 'beers',
  shot: 'shots',
  wine: 'wine',
  soft: 'soft / water',
};

export function DrinkHistoryList() {
  const { logs, guests, settings, revertLastDrink } = usePartyStore();

  const [selectedCategory, setSelectedCategory] = useState<'all' | DrinkCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showReverted, setShowReverted] = useState(false);
  const [editingGuest, setEditingGuest] = useState<Guest | null>(null);

  const kpis = useMemo(
    () => computeAdminKpis(guests, logs, settings),
    [guests, logs, settings]
  );

  const guestMap = useMemo(() => {
    const map = new Map<string, Guest>();
    for (const g of guests) {
      map.set(g.id, g);
    }
    return map;
  }, [guests]);

  const filteredLogs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return logs.filter(log => {
      if (!showReverted && log.is_reverted) return false;
      const category = getDrinkCategory(log.drink_type);
      if (selectedCategory !== 'all' && category !== selectedCategory) return false;

      if (q) {
        const guest = guestMap.get(log.guest_id);
        const guestName = (guest?.name || '').toLowerCase();
        const tagId = (guest?.tag_id || '').toLowerCase();
        const formattedDrink = formatDrinkHistoryLabel(log.drink_type).toLowerCase();
        const matchesGuest =
          guestName.includes(q) ||
          tagId.includes(q) ||
          log.guest_id.toLowerCase().includes(q) ||
          log.drink_type.toLowerCase().includes(q) ||
          formattedDrink.includes(q);
        if (!matchesGuest) return false;
      }

      return true;
    });
  }, [logs, showReverted, selectedCategory, searchQuery, guestMap]);

  const liveEditingGuest = useMemo(() => {
    if (!editingGuest) return null;
    return guests.find(g => g.id === editingGuest.id) || editingGuest;
  }, [guests, editingGuest]);

  const breakdownItems: Array<{
    id: 'all' | DrinkCategory;
    label: string;
    count: number;
    icon: React.ElementType;
  }> = [
    { id: 'all', label: 'all served', count: kpis.totalActiveLogs, icon: Activity },
    { id: 'cocktail', label: drinkCategoryLabels.cocktail, count: kpis.drinkBreakdown.cocktail, icon: Sparkles },
    { id: 'beer', label: drinkCategoryLabels.beer, count: kpis.drinkBreakdown.beer, icon: Beer },
    { id: 'shot', label: drinkCategoryLabels.shot, count: kpis.drinkBreakdown.shot, icon: GlassWater },
    { id: 'wine', label: drinkCategoryLabels.wine, count: kpis.drinkBreakdown.wine, icon: Wine },
    { id: 'soft', label: drinkCategoryLabels.soft, count: kpis.drinkBreakdown.soft, icon: CupSoda },
  ];

  return (
    <div className="w-full space-y-4">
      {/* 1. Drink-Type Breakdown Bar */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 lg:gap-3">
        {breakdownItems.map(item => {
          const Icon = item.icon;
          const isSelected = selectedCategory === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelectedCategory(item.id)}
              className={`p-3 sm:p-4 rounded-2xl border text-left transition-all cursor-pointer active:scale-95 ${
                isSelected
                  ? 'bg-black text-white border-black shadow-sm'
                  : 'bg-white/90 hover:bg-white text-black border-black/10'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <Icon
                  className={`w-3.5 h-3.5 ${
                    isSelected ? 'text-white/80' : 'text-black/45'
                  }`}
                />
                <span
                  className={`font-display text-2xl sm:text-3xl font-bold leading-none ${
                    isSelected ? 'text-white' : 'text-black'
                  }`}
                >
                  {item.count}
                </span>
              </div>
              <span
                className={`font-sans-clean text-[10px] sm:text-[11px] font-semibold lowercase tracking-wide block truncate ${
                  isSelected ? 'text-white/75' : 'text-black/55'
                }`}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* 2. Search & Reverted Toggle Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-black/40 pointer-events-none" />
          <input
            type="text"
            placeholder="Filter activity by guest name, wristband tag (TAG-014), or drink..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-9 py-2.5 bg-white border border-black/12 rounded-2xl text-xs font-sans-clean text-black outline-none focus:border-black shadow-2xs transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-black/40 hover:text-black hover:bg-black/5"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {kpis.revertedLogsCount > 0 && (
          <button
            type="button"
            onClick={() => setShowReverted(prev => !prev)}
            className={`px-3.5 py-2.5 rounded-2xl text-xs font-sans-clean font-semibold lowercase flex items-center justify-center gap-1.5 border transition-all shrink-0 cursor-pointer ${
              showReverted
                ? 'bg-black text-white border-black'
                : 'bg-white text-black/60 border-black/12 hover:text-black'
            }`}
          >
            {showReverted ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            <span>
              {showReverted ? 'hide undone' : `show undone (${kpis.revertedLogsCount})`}
            </span>
          </button>
        )}
      </div>

      {/* 3. Live Chronological Stream */}
      <div className="glass-card p-4 sm:p-6 border border-black/10">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-black/8">
          <div>
            <h3 className="font-display text-2xl font-bold lowercase text-black leading-none">
              live bar activity stream
            </h3>
            <p className="font-sans-clean text-xs text-black/50 lowercase mt-1">
              tap any guest to inspect their profile or undo a drink
            </p>
          </div>
          <span className="text-xs font-mono font-bold bg-black/5 px-3 py-1 rounded-full text-black/70">
            {filteredLogs.length} {filteredLogs.length === 1 ? 'entry' : 'entries'}
          </span>
        </div>

        {filteredLogs.length === 0 ? (
          <div className="py-12 text-center space-y-2">
            <div className="w-10 h-10 rounded-2xl bg-black/5 flex items-center justify-center mx-auto text-black/35">
              <GlassWater className="w-5 h-5" />
            </div>
            <p className="text-xs font-sans-clean text-black/45 lowercase">
              {logs.length === 0
                ? 'no drinks have been served yet tonight'
                : 'no drink logs match your current filter'}
            </p>
            {(selectedCategory !== 'all' || searchQuery) && (
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory('all');
                  setSearchQuery('');
                }}
                className="btn-premium py-1.5 px-4 text-[11px] mt-1"
              >
                reset filters
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5 max-h-[580px] overflow-y-auto pr-1">
            {filteredLogs.slice(0, 80).map(log => {
              const drinkCat = getDrinkCategory(log.drink_type);
              const Icon = drinkCategoryIcons[drinkCat] || GlassWater;
              const guest = guestMap.get(log.guest_id);
              const guestName = guest?.name || guest?.tag_id || log.guest_id;
              const time = new Date(log.served_at).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              });

              return (
                <div
                  key={log.id}
                  className={`p-3.5 rounded-2xl flex items-center justify-between gap-3 border transition-all ${
                    log.is_reverted
                      ? 'bg-black/[0.015] border-black/5 opacity-45'
                      : 'bg-white/90 border-black/8 hover:border-black/20'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => guest && setEditingGuest(guest)}
                    className="flex items-center gap-3 min-w-0 flex-1 text-left cursor-pointer group"
                  >
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                        log.is_reverted
                          ? 'bg-black/5 text-black/40'
                          : drinkCat === 'soft'
                          ? 'bg-blue-50 text-blue-700'
                          : 'bg-black text-white group-hover:bg-black/85'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`font-sans-clean text-xs font-bold text-black truncate group-hover:underline ${
                            log.is_reverted ? 'line-through' : ''
                          }`}
                        >
                          {guestName}
                        </span>
                        {guest && (
                          <span className="font-mono text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-black/5 text-black/65 shrink-0">
                            {guest.tag_id}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 text-[11px] font-sans-clean text-black/50 mt-0.5">
                        <span className="font-semibold text-black/75">
                          {formatDrinkHistoryLabel(log.drink_type)}
                        </span>
                        <span>•</span>
                        <span className="font-mono text-[10px]">{time}</span>
                        {log.is_reverted && (
                          <span className="text-[10px] font-semibold text-red-600 uppercase ml-1">
                            (undone)
                          </span>
                        )}
                      </div>
                    </div>
                  </button>

                  {!log.is_reverted && (
                    <button
                      type="button"
                      onClick={() => revertLastDrink(log.guest_id, log.id)}
                      className="px-2.5 py-1.5 rounded-xl bg-black/5 hover:bg-black/10 text-black/65 hover:text-black text-[11px] font-sans-clean font-semibold lowercase flex items-center gap-1 transition-colors shrink-0 cursor-pointer"
                      title="Undo this drink"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>undo</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Guest Profile Drawer / Modal when clicking a log's guest */}
      <GuestEditModal
        guest={liveEditingGuest}
        isOpen={Boolean(liveEditingGuest)}
        onClose={() => setEditingGuest(null)}
      />
    </div>
  );
}
