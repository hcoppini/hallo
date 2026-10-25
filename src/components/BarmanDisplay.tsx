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

const categoryIcons: Record<'beer' | 'cocktail' | 'shot' | 'wine', React.ElementType> = {
  beer: Beer,
  cocktail: Sparkles,
  shot: GlassWater,
  wine: Wine,
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
  const { settings, logs, revertLastDrink, updateGuest } = usePartyStore();
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);

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
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-black/10">
          <div className="flex items-center gap-2">
            <span className="font-sans-clean text-xs font-semibold lowercase tracking-widest text-black/45">
              current customer:
            </span>
            {activeGuest && (
              <>
                <span className="font-mono text-xs font-bold px-3 py-1 rounded-full bg-black text-white shadow-xs">
                  #{slotNumber} ({activeGuest.tag_id})
                </span>
                {isVip ? (
                  <span className="text-[10px] font-sans-clean font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                    VIP Unlimited
                  </span>
                ) : isDriver ? (
                  <span className="text-[10px] font-sans-clean font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-blue-100 text-blue-900 border border-blue-300">
                    Driver / 0 Alc
                  </span>
                ) : (
                  <span className="text-[10px] font-sans-clean font-semibold lowercase px-2.5 py-1 rounded-full bg-black/5 text-black/60 border border-black/8">
                    standard 18+
                  </span>
                )}
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onOpenSearch}
              className="inline-flex items-center gap-1.5 text-xs font-sans-clean font-semibold text-black/60 hover:text-black px-3 py-1.5 rounded-xl hover:bg-black/5 transition-colors cursor-pointer lowercase border border-black/10"
            >
              <Search className="w-3.5 h-3.5" />
              <span>search / switch customer</span>
              <kbd className="hidden lg:inline-block ml-1 px-1.5 py-0.2 rounded bg-black/8 font-mono text-[10px]">
                /
              </kbd>
            </button>

            {activeGuest && onClearCustomer && (
              <button
                type="button"
                onClick={onClearCustomer}
                className="p-1.5 rounded-xl hover:bg-black/5 text-black/40 hover:text-black transition-colors"
                title="Deselect customer (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Customer Name & Counter Row */}
        <div className="flex items-baseline justify-between gap-4">
          <div className="min-w-0 flex-1">
            {activeGuest ? (
              <div>
                <h2
                  onClick={onOpenSearch}
                  title="Click to search or switch customer"
                  className="font-display text-5xl sm:text-6xl lg:text-7xl font-bold lowercase text-black leading-none tracking-tight truncate cursor-pointer hover:opacity-75 transition-opacity"
                >
                  {customerName}
                </h2>
                {cleanNotes && (
                  <span className="inline-block mt-2 px-3 py-1 rounded-full bg-black/[0.04] border border-black/8 text-xs font-sans-clean text-black/60">
                    {cleanNotes}
                  </span>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={onOpenSearch}
                className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold lowercase text-black/30 hover:text-black leading-none tracking-tight text-left transition-colors cursor-pointer"
              >
                select customer...
              </button>
            )}
          </div>

          <div className="text-right shrink-0">
            <div
              className={`font-display text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-none ${
                isLimitReached ? 'text-red-600' : 'text-black'
              }`}
            >
              {drinksConsumed}
              <span className="text-3xl sm:text-4xl text-black/25 font-normal">
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
        <div className="w-full h-4 rounded-full bg-black/[0.05] border border-black/20 p-0.5 mt-2 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              isLimitReached ? 'bg-red-600' : 'bg-black'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
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

        {/* Responsive POS Drink Grid (7 hardcoded drinks with shortcut indicators) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-2.5 sm:gap-3">
          {BAR_DRINKS.map(({ type, label, category }, idx) => {
            const Icon = categoryIcons[category] || GlassWater;
            const isSelected = selectedDrinkType === type;
            const shortcutNum = idx + 1;

            return (
              <button
                key={type}
                type="button"
                onClick={() => onDrinkTypeChange(type)}
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
                  <span
                    className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      isSelected
                        ? 'bg-white/20 text-white'
                        : 'bg-black/6 text-black/50 group-hover:text-black'
                    }`}
                  >
                    #{shortcutNum}
                  </span>
                </div>
                <div>
                  <span className="font-sans-clean text-xs sm:text-sm font-bold block lowercase leading-tight">
                    {label}
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

          {/* Quick Soft Drink 8th tile */}
          <button
            type="button"
            onClick={() => onDrinkTypeChange('soft' as DrinkType)}
            className={`p-3.5 sm:p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between text-left group active:scale-[0.98] ${
              selectedDrinkType === 'soft'
                ? 'bg-black text-white border-black shadow-md'
                : 'bg-white hover:bg-black/[0.04] text-black border-black/12 hover:border-black/30'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <CupSoda
                className={`w-5 h-5 ${
                  selectedDrinkType === 'soft'
                    ? 'text-white'
                    : 'text-black/60 group-hover:text-black'
                }`}
              />
              <span
                className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded ${
                  selectedDrinkType === 'soft'
                    ? 'bg-white/20 text-white'
                    : 'bg-black/6 text-black/50'
                }`}
              >
                #8
              </span>
            </div>
            <div>
              <span className="font-sans-clean text-xs sm:text-sm font-bold block lowercase leading-tight">
                water / soft
              </span>
              <span
                className={`font-sans-clean text-[10px] block mt-0.5 lowercase ${
                  selectedDrinkType === 'soft' ? 'text-white/70' : 'text-black/40'
                }`}
              >
                0 alc
              </span>
            </div>
          </button>
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

                <button
                  type="button"
                  onClick={() => revertLastDrink(activeGuest.id, log.id)}
                  className="text-xs font-sans-clean font-semibold text-black/45 hover:text-black flex items-center gap-1 px-3 py-1 rounded-lg hover:bg-black/5 transition-colors cursor-pointer lowercase"
                  title="Undo this drink"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>undo</span>
                </button>
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
