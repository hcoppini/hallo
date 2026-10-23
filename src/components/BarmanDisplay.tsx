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
} from 'lucide-react';
import { Guest, DrinkType, BAR_DRINKS, formatDrinkHistoryLabel } from '@/lib/types';
import { usePartyStore } from '@/lib/store';
import { calculateEffectiveLimit } from '@/lib/party-engine';
import { AdminPinModal } from './AdminPinModal';

interface BarmanDisplayProps {
  activeGuest: Guest | null;
  selectedDrinkType: DrinkType;
  onDrinkTypeChange: (type: DrinkType) => void;
  onManualServe: (guestTagId: string, type: DrinkType) => void;
  onOpenSearch: () => void;
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
}: BarmanDisplayProps) {
  const { settings, logs, revertLastDrink, updateGuest } = usePartyStore();
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);

  const effectiveLimit = activeGuest
    ? calculateEffectiveLimit(activeGuest, settings)
    : settings.default_drink_limit;

  const isVip = activeGuest?.category === 'vip';
  const drinksConsumed = activeGuest?.drinks_consumed ?? 0;

  const isLimitReached = Boolean(
    activeGuest &&
    !isVip &&
    drinksConsumed >= effectiveLimit
  );

  // Calculate progress bar percentage (always visible, even for VIPs)
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
    <div className="w-full space-y-8 pt-2">
      {/* ================================================================ */}
      {/* 1. CUSTOMER SECTION                                              */}
      {/* ================================================================ */}
      <section>
        <span className="block font-sans-clean text-sm font-medium text-[#7A0010] mb-1">
          Customer:
        </span>

        <div className="flex items-baseline justify-between gap-4">
          <div className="min-w-0 flex-1">
            {activeGuest ? (
              <h2
                onClick={onOpenSearch}
                title="Click to search or switch customer"
                className="font-display text-5xl sm:text-6xl font-bold lowercase text-black leading-none tracking-tight truncate cursor-pointer hover:opacity-75 transition-opacity"
              >
                {customerName}
              </h2>
            ) : (
              <button
                type="button"
                onClick={onOpenSearch}
                className="font-display text-4xl sm:text-5xl font-bold lowercase text-black/35 hover:text-black leading-none tracking-tight text-left transition-colors"
              >
                select guest...
              </button>
            )}
          </div>

          <div className="text-right shrink-0">
            <div className="font-display text-5xl sm:text-6xl font-bold tracking-tight text-black leading-none">
              {drinksConsumed}
              <span className="text-3xl sm:text-4xl text-black/30 font-normal">
                /{isVip ? '∞' : effectiveLimit}
              </span>
            </div>
            <span
              className={`font-sans-clean text-[11px] font-semibold tracking-wider uppercase block mt-1.5 ${
                isLimitReached ? 'text-[#7A0010] font-bold' : 'text-black/55'
              }`}
            >
              {isVip
                ? 'UNLIMITED DRINKS'
                : isLimitReached
                ? 'LIMIT REACHED'
                : `${Math.max(0, effectiveLimit - drinksConsumed)} DRINKS LEFT`}
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full max-w-md h-5 bg-white border-2 border-[#7A0010] mt-4 overflow-hidden">
          <div
            className="h-full bg-[#7A0010] transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </section>

      {/* ================================================================ */}
      {/* 2. SERVE DRINK SECTION                                           */}
      {/* ================================================================ */}
      <section>
        <div className="border-b-2 border-[#7A0010] pb-1 mb-4">
          <h3 className="font-sans-clean text-sm font-medium text-[#7A0010]">
            Serve Drink:
          </h3>
        </div>

        <div className="p-4 sm:p-5 bg-black/[0.04] rounded-2xl border border-black/5 space-y-5">
          {/* 7 Hardcoded Specific Drinks */}
          <div className="flex flex-wrap gap-2">
            {BAR_DRINKS.map(({ type, label, category }) => {
              const Icon = categoryIcons[category];
              const isSelected = selectedDrinkType === type;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => onDrinkTypeChange(type)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-sans-clean text-xs font-semibold tracking-wider lowercase transition-all active:scale-95 ${
                    isSelected
                      ? 'bg-black text-white shadow-md'
                      : 'bg-white hover:bg-white/90 text-black/80 hover:text-black border border-black/10'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>

          {/* Primary Action Button Row */}
          <div className="flex flex-wrap items-center justify-end gap-3 pt-1">
            {!activeGuest ? (
              <button
                type="button"
                onClick={onOpenSearch}
                className="btn-premium-primary gap-2 py-3.5 px-7 text-xs"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>select guest to serve {selectedDrinkType}</span>
              </button>
            ) : isLimitReached ? (
              <div className="flex flex-wrap items-center justify-end gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setIsPinModalOpen(true)}
                  className="px-4 py-3 rounded-full bg-white text-black/70 hover:text-black border border-black/15 font-sans-clean text-[11px] font-semibold lowercase flex items-center gap-1.5 transition-colors"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>override (+1)</span>
                </button>
                <button
                  type="button"
                  disabled
                  className="py-3.5 px-7 rounded-full bg-[#7A0010]/15 text-[#7A0010] border border-[#7A0010]/30 font-sans-clean text-xs font-bold tracking-wider lowercase flex items-center gap-2 cursor-not-allowed"
                >
                  <Ban className="w-4 h-4" />
                  <span>limit reached</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => onManualServe(activeGuest.tag_id, selectedDrinkType)}
                className="btn-premium-primary gap-2 py-3.5 px-7 text-xs"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {drinksConsumed > 0
                    ? `serve another ${selectedDrinkType}`
                    : `serve ${selectedDrinkType}`}
                </span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/* 3. CUSTOMER HISTORY SECTION                                      */}
      {/* ================================================================ */}
      <section>
        <div className="border-b-2 border-[#7A0010] pb-1 mb-3">
          <h3 className="font-sans-clean text-sm font-medium text-[#7A0010]">
            {activeGuest ? `${customerName}'s History:` : 'History:'}
          </h3>
        </div>

        {!activeGuest ? (
          <p className="font-sans-clean text-xs text-black/40 lowercase py-2">
            select a customer to view their drink history.
          </p>
        ) : guestDrinkLogs.length === 0 && !activeGuest.entered_at ? (
          <p className="font-sans-clean text-xs text-black/40 lowercase py-2">
            no activity recorded yet for {customerName}.
          </p>
        ) : (
          <div className="space-y-1.5">
            {guestDrinkLogs.map(log => (
              <div
                key={log.id}
                className="flex items-center justify-between py-1 text-sm font-sans-clean text-[#5A000C]"
              >
                <div className="flex items-baseline gap-4">
                  <span className="font-mono text-xs sm:text-sm font-medium tabular-nums">
                    {formatTime24h(log.served_at)}
                  </span>
                  <span className="font-medium">
                    {formatDrinkHistoryLabel(log.drink_type)}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => revertLastDrink(activeGuest.id, log.id)}
                  className="text-[11px] font-sans-clean text-black/35 hover:text-[#7A0010] flex items-center gap-1 px-2 py-0.5 rounded hover:bg-black/5 transition-colors"
                  title="Undo this drink"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>undo</span>
                </button>
              </div>
            ))}

            {activeGuest.entered_at && (
              <div className="flex items-baseline gap-4 py-1 text-sm font-sans-clean text-[#5A000C]">
                <span className="font-mono text-xs sm:text-sm font-medium tabular-nums">
                  {formatTime24h(activeGuest.entered_at)}
                </span>
                <span className="font-medium">
                  Registered in the reception
                </span>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Supervisor PIN Modal */}
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
