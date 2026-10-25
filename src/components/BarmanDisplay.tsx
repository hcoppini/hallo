'use client';

import React, { useState, useMemo } from 'react';
import {
  GlassWater,
  Beer,
  Wine,
  Sparkles,
  RotateCcw,
  CheckCircle2,
  Lock,
  Ban,
  Search,
  CornerDownLeft,
  X,
  CupSoda,
} from 'lucide-react';
import { Guest, DrinkType, BAR_DRINKS, formatDrinkHistoryLabel } from '@/lib/types';
import { usePartyStore } from '@/lib/store';
import { calculateEffectiveLimit } from '@/lib/party-engine';
import { parseTagId, stripUidFromNotes } from '@/lib/tag-utils';
import { AdminPinModal } from './AdminPinModal';

interface BarmanDisplayProps {
  activeGuest: Guest | null;
  selectedDrinkType: DrinkType;
  onDrinkTypeChange: (type: DrinkType) => void;
  onManualServe: (guestTagId: string, type: DrinkType) => void;
  onOpenSearch: () => void;
  onClearCustomer?: () => void;
}

const categoryIcons: Record<'beer' | 'cocktail' | 'shot' | 'wine' | 'soft', React.ElementType> = {
  beer: Beer,
  cocktail: Sparkles,
  shot: GlassWater,
  wine: Wine,
  soft: CupSoda,
};

function formatTime24h(isoString: string): string {
  try {
    return new Date(isoString).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  } catch {
    return '--:--';
  }
}

export function BarmanDisplay({
  activeGuest,
  selectedDrinkType,
  onDrinkTypeChange,
  onManualServe,
  onOpenSearch,
  onClearCustomer,
}: BarmanDisplayProps) {
  const { settings, logs, revertLastDrink, updateGuest, menu } = usePartyStore();
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);

  const availableDrinks = useMemo(() => {
    if (menu && menu.length > 0) {
      return menu.filter(item => item.is_available);
    }
    return BAR_DRINKS.map(d => ({
      id: d.type,
      name: d.label,
      type: d.type,
      category: d.category,
      is_available: true,
    }));
  }, [menu]);

  const effectiveLimit = activeGuest
    ? calculateEffectiveLimit(activeGuest, settings)
    : settings.default_drink_limit;

  const isVip = activeGuest?.category === 'vip';
  const isDriver = activeGuest?.category === 'driver_minor';
  const drinksConsumed = activeGuest?.drinks_consumed ?? 0;

  const isLimitReached = Boolean(
    activeGuest && !isVip && drinksConsumed >= effectiveLimit
  );

  // Calculate progress bar percentage
  const progressPercent = useMemo(() => {
    if (!activeGuest) return 0;
    if (isVip) {
      const vipReference = Math.max(10, settings.default_drink_limit * 2);
      return Math.min(100, (drinksConsumed / vipReference) * 100);
    }
    if (effectiveLimit <= 0) return 100;
    return Math.min(100, (drinksConsumed / effectiveLimit) * 100);
  }, [activeGuest, isVip, drinksConsumed, effectiveLimit, settings.default_drink_limit]);

  // Customer's active drink logs sorted newest first
  const guestDrinkLogs = useMemo(() => {
    if (!activeGuest) return [];
    return logs
      .filter(l => l.guest_id === activeGuest.id && !l.is_reverted)
      .sort((a, b) => new Date(b.served_at).getTime() - new Date(a.served_at).getTime());
  }, [logs, activeGuest]);

  const customerName = activeGuest
    ? activeGuest.name?.trim() || activeGuest.tag_id
    : '';

  const slotNumber = activeGuest
    ? parseTagId(activeGuest.tag_id).tagNumber ?? activeGuest.tag_id
    : null;

  const cleanNotes = activeGuest ? stripUidFromNotes(activeGuest.notes) : '';

  const handleSupervisorOverride = async () => {
    if (activeGuest) {
      const newCustomLimit = (activeGuest.custom_drink_limit ?? settings.default_drink_limit) + 1;
      await updateGuest({
        id: activeGuest.id,
        custom_drink_limit: newCustomLimit,
        notes: `Overridden by supervisor at ${new Date().toLocaleTimeString()}`,
      });
      setIsPinModalOpen(false);
    }
  };

  return (
    <div className="w-full space-y-6 lg:space-y-8 glass-card p-6 sm:p-8 lg:p-9 border border-black/12 shadow-lg">
      {/* ================================================================ */}
      {/* 1. CUSTOMER IDENTITY & PROGRESS SECTION                          */}
      {/* ================================================================ */}
      <section className="space-y-4">
        {activeGuest ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-black/10">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-lg bg-black text-white shadow-xs">
                  #{slotNumber}
                </span>
                <span className="font-sans-clean text-xs font-semibold text-black/60">
                  {activeGuest.tag_id}
                </span>
                {isVip && (
                  <span className="text-xs font-sans-clean font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                    VIP Unlimited
                  </span>
                )}
                {isDriver && (
                  <span className="text-xs font-sans-clean font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                    Driver / 0 Alc
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {onClearCustomer && (
                  <button
                    type="button"
                    onClick={onClearCustomer}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:bg-black/5 text-black/60 hover:text-black transition-colors font-sans-clean text-xs font-semibold cursor-pointer"
                    title="Clear customer (Esc)"
                  >
                    <X className="w-4 h-4" />
                    <span>clear bar (esc)</span>
                  </button>
                )}
              </div>
            </div>

            {/* Customer Name & Counter Row */}
            <div className="flex items-baseline justify-between gap-4">
              <div className="min-w-0 flex-1">
                <h2
                  onClick={onOpenSearch}
                  title="Click to search or switch customer"
                  className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold lowercase text-black leading-none tracking-tight truncate cursor-pointer hover:opacity-75 transition-opacity"
                >
                  {customerName}
                </h2>
                {cleanNotes && (
                  <p className="mt-1.5 text-xs font-sans-clean text-black/60">
                    {cleanNotes}
                  </p>
                )}
              </div>

              <div className="text-right shrink-0">
                <div
                  className={`font-display text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-none ${
                    isLimitReached ? 'text-red-600' : 'text-black'
                  }`}
                >
                  {drinksConsumed}
                  <span className="text-2xl sm:text-3xl text-black/25 font-normal">
                    /{isVip ? '∞' : effectiveLimit}
                  </span>
                </div>
                <span
                  className={`font-sans-clean text-xs font-semibold tracking-wider lowercase block mt-1.5 ${
                    isLimitReached ? 'text-red-600 font-bold' : 'text-black/50'
                  }`}
                >
                  {isVip
                    ? 'unlimited drinks unlocked'
                    : isLimitReached
                    ? 'maximum limit reached'
                    : `${Math.max(0, effectiveLimit - drinksConsumed)} drinks remaining`}
                </span>
              </div>
            </div>

            {/* High-Contrast Progress Bar */}
            <div className="w-full h-3 rounded-full bg-black/[0.05] border border-black/15 p-0.5 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  isLimitReached ? 'bg-red-600' : 'bg-black'
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </>
        ) : (
          /* Clean Empty / Idle State */
          <div className="py-8 sm:py-10 text-center space-y-2 border border-dashed border-black/15 rounded-2xl bg-black/[0.02]">
            <div className="w-12 h-12 rounded-2xl bg-black/5 border border-black/10 flex items-center justify-center mx-auto text-black/50 mb-2">
              <GlassWater className="w-6 h-6" />
            </div>
            <h3 className="font-display text-2xl sm:text-3xl font-bold lowercase text-black">
              bar station ready.
            </h3>
            <p className="font-sans-clean text-xs sm:text-sm text-black/50 lowercase max-w-sm mx-auto">
              no customer active. search by name or wristband # above, or tap an nfc band.
            </p>
          </div>
        )}
      </section>

      {/* ================================================================ */}
      {/* 2. TACTILE POS DRINK ACTION WORKSPACE                            */}
      {/* ================================================================ */}
      <section className="space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-black/10">
          <h3 className="font-sans-clean text-xs font-semibold lowercase tracking-widest text-black/50">
            select drink &amp; pour:
          </h3>
          <span className="hidden sm:inline font-mono text-[11px] text-black/45 uppercase tracking-wider">
            POS HOTKEYS: [1]–[7] SELECT • [ENTER] LOG DRINK
          </span>
        </div>

        {/* Responsive POS Drink Grid (Dynamic drinks from party menu with shortcut indicators) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-2.5 sm:gap-3">
          {availableDrinks.map(({ type, name, category }, idx) => {
            const Icon = categoryIcons[category] || GlassWater;
            const isSelected = selectedDrinkType === type;
            const shortcutNum = idx + 1;

            return (
              <button
                key={type}
                type="button"
                onClick={() => onDrinkTypeChange(type as DrinkType)}
                className={`p-3.5 sm:p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between text-left group active:scale-[0.98] ${
                  isSelected
                    ? 'bg-black text-white border-black shadow-md'
                    : 'bg-white hover:bg-black/[0.04] text-black border-black/12 hover:border-black/30'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <Icon
                    className={`w-5 h-5 ${
                      isSelected ? 'text-white' : 'text-black/60 group-hover:text-black'
                    }`}
                  />
                  {shortcutNum <= 9 && (
                    <span
                      className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        isSelected
                          ? 'bg-white/20 text-white'
                          : 'bg-black/6 text-black/50 group-hover:text-black'
                      }`}
                    >
                      #{shortcutNum}
                    </span>
                  )}
                </div>
                <div>
                  <span className="font-sans-clean text-xs sm:text-sm font-bold block lowercase leading-tight">
                    {name}
                  </span>
                  <span
                    className={`font-sans-clean text-[10px] block mt-0.5 lowercase ${
                      isSelected ? 'text-white/70' : 'text-black/40'
                    }`}
                  >
                    {category}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Large Tactile POS Primary Action Button */}
        <div className="pt-2">
          {!activeGuest ? (
            <button
              type="button"
              onClick={onOpenSearch}
              className="btn-premium-primary w-full py-4 sm:py-5 text-sm sm:text-base gap-2.5 cursor-pointer shadow-md"
            >
              <Search className="w-5 h-5" />
              <span>select guest to serve {selectedDrinkType}</span>
            </button>
          ) : isLimitReached ? (
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full">
              <button
                type="button"
                disabled
                className="flex-1 py-4 sm:py-5 px-6 rounded-2xl bg-red-50 text-red-700 border border-red-200 font-sans-clean text-sm font-bold tracking-wider lowercase flex items-center justify-center gap-2 cursor-not-allowed"
              >
                <Ban className="w-5 h-5" />
                <span>drink limit reached ({drinksConsumed}/{effectiveLimit})</span>
              </button>
              <button
                type="button"
                onClick={() => setIsPinModalOpen(true)}
                className="w-full sm:w-auto py-4 sm:py-5 px-6 rounded-2xl bg-white text-black/80 hover:text-black border border-black/20 font-sans-clean text-xs font-bold tracking-wider lowercase flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
              >
                <Lock className="w-4 h-4" />
                <span>supervisor override (+1)</span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => onManualServe(activeGuest.tag_id, selectedDrinkType)}
              className="btn-premium-primary w-full py-4 sm:py-5 text-sm sm:text-base gap-3 cursor-pointer shadow-md justify-between px-6 sm:px-8 group"
            >
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 group-hover:scale-110 transition-transform" />
                <span>
                  {drinksConsumed > 0
                    ? `serve another ${selectedDrinkType} to ${customerName}`
                    : `serve ${selectedDrinkType} to ${customerName}`}
                </span>
              </div>
              <span className="hidden sm:inline-flex items-center gap-1 font-mono text-xs px-2.5 py-1 rounded-lg bg-white/20 text-white font-bold">
                <span>Enter</span>
                <CornerDownLeft className="w-3.5 h-3.5" />
              </span>
            </button>
          )}
        </div>
      </section>

      {/* ================================================================ */}
      {/* 3. CUSTOMER HISTORY STREAM & AUDIT LOG                           */}
      {/* ================================================================ */}
      <section className="space-y-3 pt-2">
        <div className="flex items-center justify-between pb-2 border-b border-black/10">
          <h3 className="font-sans-clean text-xs font-semibold lowercase tracking-widest text-black/50">
            {activeGuest ? `${customerName}’s drink history tonight:` : 'customer history:'}
          </h3>
          {activeGuest && guestDrinkLogs.length > 0 && (
            <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-full bg-black/6 text-black/60">
              {guestDrinkLogs.length} {guestDrinkLogs.length === 1 ? 'pour' : 'pours'}
            </span>
          )}
        </div>

        {!activeGuest ? (
          <p className="font-sans-clean text-xs text-black/40 lowercase py-3 text-center">
            select a customer using the numpad or search to view their activity.
          </p>
        ) : guestDrinkLogs.length === 0 && !activeGuest.entered_at ? (
          <p className="font-sans-clean text-xs text-black/40 lowercase py-3 text-center">
            no drinks logged yet for {customerName}.
          </p>
        ) : (
          <div className="divide-y divide-black/[0.06] max-h-56 overflow-y-auto pr-1 no-scrollbar">
            {guestDrinkLogs.map((log, idx) => (
              <div
                key={log.id}
                className="py-2.5 flex items-center justify-between text-xs sm:text-sm font-sans-clean text-black"
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs text-black/40 tabular-nums w-12">
                    {formatTime24h(log.served_at)}
                  </span>
                  <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-black/5 text-black/55">
                    #{guestDrinkLogs.length - idx}
                  </span>
                  <span className="font-medium lowercase">
                    {formatDrinkHistoryLabel(log.drink_type)}
                  </span>
                </div>

                {idx === 0 ? (
                  <button
                    type="button"
                    onClick={() => revertLastDrink(activeGuest.id, log.id)}
                    className="text-xs font-sans-clean font-semibold text-red-600 hover:text-red-700 flex items-center gap-1 px-2.5 py-1 rounded-lg hover:bg-red-50 transition-colors cursor-pointer lowercase"
                    title="Undo last drink"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>undo last drink</span>
                  </button>
                ) : (
                  <span className="text-[11px] font-mono text-black/30">logged</span>
                )}
              </div>
            ))}

            {activeGuest.entered_at && (
              <div className="py-2.5 flex items-center justify-between text-xs sm:text-sm font-sans-clean text-black/60">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs text-black/40 tabular-nums w-12">
                    {formatTime24h(activeGuest.entered_at)}
                  </span>
                  <span className="font-medium lowercase">
                    checked in at reception
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Supervisor PIN Modal for Drink Overrides */}
      <AdminPinModal
        isOpen={isPinModalOpen}
        title="supervisor drink override"
        subtitle={`enter admin pin to increase drink limit for ${customerName || 'this guest'}`}
        onSuccess={handleSupervisorOverride}
        onClose={() => setIsPinModalOpen(false)}
      />
    </div>
  );
}
